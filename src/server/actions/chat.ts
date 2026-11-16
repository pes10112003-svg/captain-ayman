"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "../auth/guards";
import {
  clientChatUnread,
  listClientNotifications,
  listMessages,
  markRead,
  sendAnnouncement,
  sendMessage,
  updateChatSettings,
} from "../services/chat";
import { parseInput, runAction } from "./helpers";

const threadSchema = z.string().min(1).max(40);
const sendSchema = z.object({ thread: threadSchema, body: z.string().trim().min(1).max(2000) });
const settingsSchema = z.object({ mode: z.enum(["coach_only", "everyone", "selected"]), clientIds: z.array(z.string().max(40)).max(500) });
const announceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(1000).nullable(),
  clientId: z.string().max(40).nullable(),
});

/** New messages in a chat since `after` (polled while the chat is open); also marks the chat read. */
export async function pollChatAction(thread: string, after: string | null) {
  return runAction(async () => {
    const actor = await requireActor();
    const t = parseInput(threadSchema, thread);
    const res = await listMessages(actor, t, after);
    if (res.messages.some((m) => !m.mine)) await markRead(actor, t);
    return res;
  });
}

export async function sendChatMessageAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActor();
    const { thread, body } = parseInput(sendSchema, input);
    return sendMessage(actor, thread, body);
  });
}

export async function updateChatSettingsAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await updateChatSettings(actor, parseInput(settingsSchema, input));
    revalidatePath("/coach/chat");
    return null;
  });
}

export async function sendAnnouncementAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    return sendAnnouncement(actor, parseInput(announceSchema, input));
  });
}

/** Client app: unread notifications + chat counts, polled in the background to show new ones. */
export async function clientInboxAction() {
  return runAction(async () => {
    const actor = await requireActor("client");
    const [{ rows, unread }, chat] = await Promise.all([listClientNotifications(actor, 10), clientChatUnread(actor)]);
    return {
      unread,
      chat,
      latest: rows
        .filter((n) => !n.readAt)
        .map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data ?? null, createdAt: n.createdAt.toISOString() })),
    };
  });
}
