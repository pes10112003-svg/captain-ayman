import type { Dict } from "@/i18n/en";
import { interpolate } from "@/i18n/format";

export type NotificationLike = { type: string; title: string; body: string | null; data: Record<string, unknown> | null };

/** Notifications are rendered from their type + data so they follow the viewer's language. */
export function notificationText(n: NotificationLike, t: Dict): { title: string; body: string | null } {
  const d = n.data ?? {};
  const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  if (n.type === "workout.completed" && d.clientName)
    return {
      title: interpolate(t.notifications.workoutCompleted, { name: s(d.clientName), workout: s(d.workout) }),
      body: d.pct != null ? interpolate(t.notifications.completion, { pct: s(d.pct) }) : n.body,
    };
  if (n.type === "photo.uploaded_by_client" && d.clientName)
    return { title: interpolate(t.notifications.photoUploaded, { name: s(d.clientName) }), body: null };
  if (n.type === "plan.updated" && d.plan)
    return { title: d.plan === "workout" ? t.notifications.workoutPlanUpdated : t.notifications.nutritionPlanUpdated, body: null };
  if (n.type === "chat.group")
    return { title: d.clientName ? interpolate(t.notifications.chatGroupFromClient, { name: s(d.clientName) }) : t.notifications.chatGroupFromCoach, body: n.body };
  if (n.type === "chat.private")
    return { title: d.clientName ? interpolate(t.notifications.chatPrivateFromClient, { name: s(d.clientName) }) : t.notifications.chatPrivateFromCoach, body: n.body };
  return { title: n.title, body: n.body };
}

/** Where tapping a notification goes. */
export function notificationHref(n: NotificationLike, role: "coach" | "client"): string {
  const d = n.data ?? {};
  if (n.type.startsWith("chat.")) {
    const thread = typeof d.thread === "string" ? d.thread : "group";
    return role === "coach" ? `/coach/chat?c=${encodeURIComponent(thread)}` : `/client/chat?c=${thread === "coach" ? "coach" : "group"}`;
  }
  if (role === "coach") return typeof d.clientId === "string" ? `/coach/clients/${d.clientId}` : "/coach";
  if (n.type === "plan.updated") return d.plan === "nutrition" ? "/client/nutrition" : "/client/workout";
  return "/client/notifications";
}
