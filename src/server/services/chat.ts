/**
 * Coach chat: one group chat per coach + a private chat between the coach and each client,
 * and coach announcements that arrive as notifications only.
 *
 * Writes go only to the chat_* tables and add new rows to `notifications` — no existing row is changed.
 *
 * Threads: "group" = the group chat. For the coach, a client id = the private chat with that client.
 * For a client, "coach" = their private chat with the coach (the client id always comes from the session).
 */
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { chatMessages, chatPosters, chatReads, chatSettings, clients, notifications, users } from "../db/schema";
import { assertCoach, authorizeClient } from "../authz";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import type { Actor } from "../auth/types";
import { isUuid } from "@/lib/utils";

export type ChatMode = "coach_only" | "everyone" | "selected";
export type ChatMessage = { id: string; body: string; createdAt: string; senderId: string | null; senderName: string | null; fromCoach: boolean; mine: boolean };

const GROUP = "group";
const PAGE = 150;

/* ───────────── settings ───────────── */

export async function loadChatSettings(coachId: string) {
  const [[row], posters] = await Promise.all([
    db.select({ mode: chatSettings.mode }).from(chatSettings).where(eq(chatSettings.coachId, coachId)).limit(1),
    db.select({ clientId: chatPosters.clientId }).from(chatPosters).where(eq(chatPosters.coachId, coachId)),
  ]);
  return { mode: (row?.mode ?? "coach_only") as ChatMode, posters: posters.map((p) => p.clientId) };
}

export function clientCanPostInGroup(settings: { mode: ChatMode; posters: string[] }, clientId: string) {
  return settings.mode === "everyone" || (settings.mode === "selected" && settings.posters.includes(clientId));
}

export async function updateChatSettings(actor: Actor, input: { mode: ChatMode; clientIds: string[] }) {
  assertCoach(actor);
  const own = input.clientIds.length
    ? await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.coachId, actor.userId), inArray(clients.id, input.clientIds.filter(isUuid))))
    : [];
  await db.transaction(async (tx) => {
    await tx
      .insert(chatSettings)
      .values({ coachId: actor.userId, mode: input.mode })
      .onConflictDoUpdate({ target: chatSettings.coachId, set: { mode: input.mode, updatedAt: new Date() } });
    await tx.delete(chatPosters).where(eq(chatPosters.coachId, actor.userId));
    if (own.length) await tx.insert(chatPosters).values(own.map((c) => ({ clientId: c.id, coachId: actor.userId })));
  });
}

/* ───────────── threads ───────────── */

/** Resolves a thread the actor may read: coach → own group / own client; client → own group / own private chat. */
async function resolveThread(actor: Actor, thread: string) {
  if (actor.role === "coach") {
    if (thread === GROUP) return { coachId: actor.userId, clientId: null as string | null, key: GROUP, client: null };
    const { client } = await authorizeClient(actor, thread);
    return { coachId: actor.userId, clientId: client.id, key: client.id, client };
  }
  if (!actor.clientId) throw new ForbiddenError();
  const [client] = await db.select().from(clients).where(eq(clients.id, actor.clientId)).limit(1);
  if (!client || client.status !== "active") throw new NotFoundError("Client not found.");
  if (thread === GROUP) return { coachId: client.coachId, clientId: null as string | null, key: GROUP, client };
  if (thread === "coach") return { coachId: client.coachId, clientId: client.id, key: "coach", client };
  throw new NotFoundError("Chat not found.");
}

export async function listMessages(actor: Actor, thread: string, after?: string | null) {
  const t = await resolveThread(actor, thread);
  const afterDate = after ? new Date(after) : null;
  const where = and(
    eq(chatMessages.coachId, t.coachId),
    t.clientId ? eq(chatMessages.clientId, t.clientId) : isNull(chatMessages.clientId),
    afterDate && !Number.isNaN(afterDate.getTime()) ? gt(chatMessages.createdAt, afterDate) : undefined,
  );
  const rows = await db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      senderId: chatMessages.senderId,
      senderName: users.name,
      senderRole: users.role,
    })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.senderId))
    .where(where)
    .orderBy(desc(chatMessages.createdAt))
    .limit(PAGE);

  // Clients see other clients' names from their client record (what the coach typed), never e-mails.
  const clientNames = new Map<string, string>();
  const senderIds = [...new Set(rows.filter((r) => r.senderRole === "client" && r.senderId).map((r) => r.senderId!))];
  if (senderIds.length) {
    for (const c of await db.select({ userId: clients.userId, name: clients.fullName }).from(clients).where(inArray(clients.userId, senderIds)))
      clientNames.set(c.userId, c.name);
  }

  const messages: ChatMessage[] = rows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    senderId: r.senderId,
    senderName: r.senderRole === "client" ? (clientNames.get(r.senderId!) ?? r.senderName) : r.senderName,
    fromCoach: r.senderId === t.coachId,
    mine: r.senderId === actor.userId,
  }));

  let canPost = true;
  if (actor.role === "client" && t.key === GROUP) canPost = clientCanPostInGroup(await loadChatSettings(t.coachId), t.client!.id);
  return { messages, canPost };
}

export async function sendMessage(actor: Actor, thread: string, rawBody: string) {
  const body = rawBody.trim().slice(0, 2000);
  if (!body) throw new ValidationError("Write a message first.");
  const t = await resolveThread(actor, thread);

  if (actor.role === "client" && t.key === GROUP && !clientCanPostInGroup(await loadChatSettings(t.coachId), t.client!.id)) {
    throw new ForbiddenError("Only the coach can write in this chat right now.");
  }

  const [row] = await db
    .insert(chatMessages)
    .values({ coachId: t.coachId, clientId: t.clientId, senderId: actor.userId, body })
    .returning({ id: chatMessages.id, createdAt: chatMessages.createdAt });
  await markRead(actor, thread);

  // Notifications (new rows only).
  const preview = body.length > 140 ? `${body.slice(0, 137)}…` : body;
  try {
    if (actor.role === "coach") {
      const targets = t.clientId
        ? [{ userId: t.client!.userId }]
        : await db
            .select({ userId: clients.userId })
            .from(clients)
            .where(and(eq(clients.coachId, actor.userId), eq(clients.status, "active")));
      if (targets.length)
        await db.insert(notifications).values(
          targets.map((x) => ({
            userId: x.userId,
            type: t.clientId ? "chat.private" : "chat.group",
            title: t.clientId ? "New message from your coach" : "New message in the group chat",
            body: preview,
            data: { thread: t.clientId ? "coach" : GROUP, fromCoach: true },
          })),
        );
    } else {
      await db.insert(notifications).values({
        userId: t.coachId,
        type: t.clientId ? "chat.private" : "chat.group",
        title: t.clientId ? `${t.client!.fullName} sent you a message` : `${t.client!.fullName} wrote in the group chat`,
        body: preview,
        data: { thread: t.clientId ? t.client!.id : GROUP, clientId: t.client!.id, clientName: t.client!.fullName },
      });
    }
  } catch (err) {
    console.error("[kinetic] chat notification failed", err);
  }
  return { id: row!.id, createdAt: row!.createdAt.toISOString() };
}

export async function markRead(actor: Actor, thread: string) {
  const t = await resolveThread(actor, thread);
  await db
    .insert(chatReads)
    .values({ userId: actor.userId, thread: t.key, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [chatReads.userId, chatReads.thread], set: { lastReadAt: new Date() } });
  // Opening a chat also clears its chat notifications.
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, actor.userId),
        isNull(notifications.readAt),
        sql`${notifications.type} LIKE 'chat.%'`,
        sql`${notifications.data}->>'thread' = ${t.key}`,
      ),
    );
}

/* ───────────── unread counts ───────────── */

async function lastReads(userId: string) {
  const rows = await db.select({ thread: chatReads.thread, at: chatReads.lastReadAt }).from(chatReads).where(eq(chatReads.userId, userId));
  return new Map(rows.map((r) => [r.thread, r.at]));
}

/** Client: unread messages in the group chat and in the private chat with the coach. */
export async function clientChatUnread(actor: Actor) {
  if (actor.role !== "client" || !actor.clientId) return { group: 0, coach: 0, total: 0 };
  const [client] = await db.select({ id: clients.id, coachId: clients.coachId }).from(clients).where(eq(clients.id, actor.clientId)).limit(1);
  if (!client) return { group: 0, coach: 0, total: 0 };
  const reads = await lastReads(actor.userId);
  const since = (k: string) => reads.get(k) ?? new Date(0);
  const count = async (clientId: string | null, k: string) => {
    const [r] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.coachId, client.coachId),
          clientId ? eq(chatMessages.clientId, clientId) : isNull(chatMessages.clientId),
          gt(chatMessages.createdAt, since(k)),
          sql`${chatMessages.senderId} IS DISTINCT FROM ${actor.userId}`,
        ),
      );
    return r?.n ?? 0;
  };
  const [group, coach] = await Promise.all([count(null, GROUP), count(client.id, "coach")]);
  return { group, coach, total: group + coach };
}

/** Coach: the chat list — group + every client with their last message and unread count. */
export async function coachChatList(actor: Actor) {
  assertCoach(actor);
  const list = await db
    .select({ id: clients.id, name: clients.fullName, status: clients.status, avatarKey: clients.avatarKey })
    .from(clients)
    .where(eq(clients.coachId, actor.userId))
    .orderBy(asc(clients.fullName));

  const stats = await db
    .select({
      clientId: chatMessages.clientId,
      last: sql<Date>`max(${chatMessages.createdAt})`.mapWith((v) => new Date(v)),
      lastBody: sql<string>`(array_agg(${chatMessages.body} ORDER BY ${chatMessages.createdAt} DESC))[1]`,
    })
    .from(chatMessages)
    .where(eq(chatMessages.coachId, actor.userId))
    .groupBy(chatMessages.clientId);

  const unreadRows = await db.execute<{ thread: string; n: number }>(sql`
    SELECT COALESCE(m.client_id::text, 'group') AS thread, count(*)::int AS n
    FROM chat_messages m
    LEFT JOIN chat_reads r ON r.user_id = ${actor.userId} AND r.thread = COALESCE(m.client_id::text, 'group')
    WHERE m.coach_id = ${actor.userId}
      AND m.sender_id IS DISTINCT FROM ${actor.userId}
      AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
    GROUP BY 1`);
  const unread = new Map(unreadRows.rows.map((r) => [r.thread, Number(r.n)]));

  const statFor = (id: string | null) => stats.find((s) => s.clientId === id);
  const group = statFor(null);
  const settings = await loadChatSettings(actor.userId);
  return {
    settings,
    group: { last: group?.last.toISOString() ?? null, lastBody: group?.lastBody ?? null, unread: unread.get(GROUP) ?? 0 },
    clients: list
      .map((c) => {
        const s = statFor(c.id);
        return { ...c, last: s?.last.toISOString() ?? null, lastBody: s?.lastBody ?? null, unread: unread.get(c.id) ?? 0 };
      })
      .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "") || a.name.localeCompare(b.name)),
    totalUnread: [...unread.values()].reduce((a, b) => a + b, 0),
  };
}

/* ───────────── announcements (notification only, not in the chat) ───────────── */

export async function sendAnnouncement(actor: Actor, input: { title: string; body: string | null; clientId: string | null }) {
  assertCoach(actor);
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new ValidationError("Write the notification title.");
  const body = input.body?.trim().slice(0, 1000) || null;
  let targets: { userId: string }[];
  if (input.clientId) {
    const { client } = await authorizeClient(actor, input.clientId);
    targets = [{ userId: client.userId }];
  } else {
    targets = await db
      .select({ userId: clients.userId })
      .from(clients)
      .where(and(eq(clients.coachId, actor.userId), eq(clients.status, "active")));
  }
  if (targets.length) await db.insert(notifications).values(targets.map((x) => ({ userId: x.userId, type: "coach.announcement", title, body, data: { fromCoach: true } })));
  return { sent: targets.length };
}

/* ───────────── client inbox (notifications) ───────────── */

export async function listClientNotifications(actor: Actor, limit = 40) {
  if (actor.role !== "client") throw new ForbiddenError();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, actor.userId)).orderBy(desc(notifications.createdAt)).limit(limit);
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
  return { rows, unread };
}
