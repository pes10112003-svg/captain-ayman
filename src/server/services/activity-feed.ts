import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { activityLogs, clients, users } from "../db/schema";
import { assertCoach, authorizeClient } from "../authz";
import type { Actor } from "../auth/types";

const actorUser = alias(users, "actor_user");

/** Coach-only audit feed, either for one client or across all of the coach's clients. */
export async function listActivity(actor: Actor, opts: { clientId?: string; page?: number; pageSize?: number } = {}) {
  assertCoach(actor);
  let clientFilter;
  if (opts.clientId) {
    const { client } = await authorizeClient(actor, opts.clientId);
    clientFilter = eq(activityLogs.clientId, client.id);
  } else {
    clientFilter = isNotNull(activityLogs.clientId);
  }
  const where = and(eq(activityLogs.coachId, actor.userId), clientFilter);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);

  const [{ total }] = await db.select({ total: count() }).from(activityLogs).where(where);
  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
      clientId: activityLogs.clientId,
      clientName: clients.fullName,
      clientAvatarKey: clients.avatarKey,
      actorName: actorUser.name,
      actorRole: actorUser.role,
    })
    .from(activityLogs)
    .leftJoin(clients, eq(clients.id, activityLogs.clientId))
    .leftJoin(actorUser, eq(actorUser.id, activityLogs.actorId))
    .where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
export type ActivityRow = Awaited<ReturnType<typeof listActivity>>["rows"][number];
