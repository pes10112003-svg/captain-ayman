"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Bell, MessageCircle } from "lucide-react";
import { clientInboxAction } from "@/server/actions/chat";
import { notificationHref, notificationText } from "@/lib/notification-text";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

/* A tiny shared store so the bell and the chat tab show the same live counts. */
type Counts = { notifications: number; chat: number; group: number; coach: number };
let counts: Counts | null = null;
const listeners = new Set<() => void>();
function setCounts(next: Partial<Counts>) {
  counts = { ...(counts ?? { notifications: 0, chat: 0, group: 0, coach: 0 }), ...next };
  listeners.forEach((l) => l());
}
export function useInboxCounts(initial: Counts) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => counts ?? initial,
    () => initial,
  );
}
/** Updates the chat counts after a chat was opened (its messages are now read). */
export const setChatCounts = (group: number, coach: number) => setCounts({ group, coach, chat: group + coach });
export const clearNotifications = () => setCounts({ notifications: 0 });

const SEEN_KEY = "ca-seen-notifications";
function seenIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function remember(ids: string[]) {
  try {
    const all = [...seenIds(), ...ids].slice(-100);
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Background check (every ~40 s while the app is open, and when it comes back to the front):
 * updates the bell and chat counts, and pops up each new notification once.
 */
export function InboxWatcher({ initial }: { initial: Counts }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!counts) setCounts(initial);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await clientInboxAction();
        if (stopped || !res.ok) return;
        setCounts({ notifications: res.data.unread, ...res.data.chat, chat: res.data.chat.total });
        let firstRun = false;
        try {
          firstRun = localStorage.getItem(SEEN_KEY) == null;
        } catch {
          /* storage unavailable */
        }
        const seen = seenIds();
        // The very first time, older notifications are only listed on the bell page, not popped up.
        const dayAgo = Date.now() - 86_400_000;
        const fresh = res.data.latest.filter((n) => !seen.has(n.id));
        remember(fresh.map((n) => n.id));
        const toShow = firstRun ? fresh.filter((n) => new Date(n.createdAt).getTime() > dayAgo) : fresh;
        for (const n of toShow.slice(0, 3).reverse()) {
          const href = notificationHref(n, "client");
          if (n.type.startsWith("chat.") && path.current.startsWith("/client/chat")) continue;
          const text = notificationText(n, t);
          toast(text.title, {
            description: text.body ?? undefined,
            duration: 10000,
            icon: n.type.startsWith("chat.") ? <MessageCircle className="size-4" /> : <Bell className="size-4" />,
            action: { label: t.common.details, onClick: () => router.push(href) },
          });
        }
      } catch {
        /* offline — try again later */
      }
    };
    const loop = async () => {
      await check();
      if (!stopped) timer = setTimeout(loop, 40_000);
    };
    void loop();
    const onShow = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={cn("grid min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-semibold leading-4 text-white", className)}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function NotificationBell({ initial }: { initial: Counts }) {
  const { t, f, fmt } = useI18n();
  const c = useInboxCounts(initial);
  return (
    <Link
      href="/client/notifications"
      aria-label={c.notifications ? `${t.notifications.label} (${f(t.notifications.unread, { n: fmt.num(c.notifications, 0) })})` : t.notifications.label}
      className="relative grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
    >
      <Bell className="size-[18px]" />
      <CountBadge n={c.notifications} className="absolute end-0.5 top-0.5" />
    </Link>
  );
}

export function ChatBadge({ initial, className }: { initial: Counts; className?: string }) {
  const c = useInboxCounts(initial);
  return <CountBadge n={c.chat} className={className} />;
}
