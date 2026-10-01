import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "../db/schema";
import type { Actor } from "../auth/types";

export async function listNotifications(actor: Actor, limit = 12) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, actor.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
  return { rows, unread };
}

export async function markAllNotificationsRead(actor: Actor) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
}
