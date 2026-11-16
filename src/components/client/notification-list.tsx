"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Bell, Megaphone, MessageCircle } from "lucide-react";
import { markNotificationsReadAction } from "@/server/actions/settings";
import { notificationHref, notificationText } from "@/lib/notification-text";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { clearNotifications } from "./inbox";

type Item = { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; createdAt: string; unread: boolean };

/** The client's notifications, newest first. Opening the page marks them read. */
export function NotificationList({ items, timezone }: { items: Item[]; timezone: string }) {
  const { t, fmt } = useI18n();
  useEffect(() => {
    if (!items.some((n) => n.unread)) return;
    clearNotifications();
    void markNotificationsReadAction();
  }, [items]);

  return (
    <ul className="space-y-2.5">
      {items.map((n) => {
        const text = notificationText(n, t);
        const announcement = n.type === "coach.announcement";
        const Icon = announcement ? Megaphone : n.type.startsWith("chat.") ? MessageCircle : Bell;
        const body = (
          <>
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", announcement ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2")}>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              {announcement ? <span className="block text-[11px] font-semibold text-muted">{t.notifications.announcement}</span> : null}
              <span dir="auto" className="block text-start font-semibold text-ink">
                {text.title}
              </span>
              {text.body ? (
                <span dir="auto" className="mt-0.5 block whitespace-pre-wrap text-start text-sm text-ink-2">
                  {text.body}
                </span>
              ) : null}
              <span className="mt-1 block text-xs text-muted">{fmt.relativeDay(n.createdAt, timezone)}</span>
            </span>
            {n.unread ? <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-info" aria-label={t.notifications.label} /> : null}
          </>
        );
        const cls = cn("flex items-start gap-3 rounded-2xl border bg-surface p-4", n.unread ? "border-ink/30" : "border-line");
        return (
          <li key={n.id}>
            {announcement ? (
              <div className={cls}>{body}</div>
            ) : (
              <Link href={notificationHref(n, "client")} className={cn(cls, "transition hover:bg-surface-2/60")}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
