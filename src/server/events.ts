/**
 * Minimal in-process domain-event bus.
 *
 * Services emit events after a successful write; handlers fan them out to channels.
 * Today there is one channel (in-app notifications for the coach). Adding reminders,
 * email, push or WhatsApp is a matter of registering another handler — or swapping
 * `emit` for a durable queue (pg-boss, BullMQ, SQS) without touching the services.
 */
import { db } from "./db";
import { notifications } from "./db/schema";

export type DomainEvent =
  | { type: "workout.completed"; coachId: string; clientId: string; clientName: string; title: string; completionPercent: number; logId: string }
  | { type: "meal.completed"; coachId: string; clientId: string; clientName: string; mealName: string }
  | { type: "photo.uploaded_by_client"; coachId: string; clientId: string; clientName: string; photoId: string }
  | { type: "plan.updated"; clientUserId: string; clientId: string; plan: "workout" | "nutrition" };

type Handler<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void>;
const handlers = new Map<DomainEvent["type"], Handler[]>();

export function on<T extends DomainEvent["type"]>(type: T, handler: Handler<Extract<DomainEvent, { type: T }>>) {
  const list = handlers.get(type) ?? [];
  list.push(handler as Handler);
  handlers.set(type, list);
}

/** Fire-and-forget safe: handler failures are logged, never surfaced to the user action. */
export async function emit(event: DomainEvent) {
  for (const handler of handlers.get(event.type) ?? []) {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[kinetic] event handler failed for ${event.type}`, err);
    }
  }
}

/* ── built-in handlers: in-app notifications ─────────────────── */

on("workout.completed", async (e) => {
  await db.insert(notifications).values({
    userId: e.coachId,
    type: e.type,
    title: `${e.clientName} completed ${e.title}`,
    body: `Completion ${Math.round(e.completionPercent)}%`,
    data: { clientId: e.clientId, logId: e.logId, clientName: e.clientName, workout: e.title, pct: Math.round(e.completionPercent) },
  });
});

on("photo.uploaded_by_client", async (e) => {
  await db.insert(notifications).values({
    userId: e.coachId,
    type: e.type,
    title: `${e.clientName} uploaded a progress photo`,
    data: { clientId: e.clientId, photoId: e.photoId, clientName: e.clientName },
  });
});

on("plan.updated", async (e) => {
  await db.insert(notifications).values({
    userId: e.clientUserId,
    type: e.type,
    title: e.plan === "workout" ? "Your coach updated your workout plan" : "Your coach updated your nutrition plan",
    data: { clientId: e.clientId, plan: e.plan },
  });
});
