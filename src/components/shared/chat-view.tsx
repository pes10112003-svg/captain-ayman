"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, SendHorizontal } from "lucide-react";
import { pollChatAction, sendChatMessageAction } from "@/server/actions/chat";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { ChatMessage } from "@/server/services/chat";

/**
 * One chat (group or private). New messages are fetched every few seconds while the chat is on
 * screen; sending shows the message right away and confirms it in the background.
 */
export function ChatView({
  thread,
  initial,
  canPost,
  showNames,
  timezone,
  emptyText,
  onRead,
  className,
}: {
  thread: string;
  initial: ChatMessage[];
  canPost: boolean;
  /** Group chats show who wrote each message. */
  showNames: boolean;
  timezone: string;
  emptyText: string;
  onRead?: () => void;
  className?: string;
}) {
  const { t, fmt } = useI18n();
  const [messages, setMessages] = useState<(ChatMessage & { pending?: boolean })[]>(initial);
  const [allowed, setAllowed] = useState(canPost);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(initial.at(-1)?.createdAt ?? null);
  const stick = useRef(true);

  useEffect(() => {
    onRead?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for new messages while visible.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await pollChatAction(thread, lastAt.current);
          if (!stopped && res.ok) {
            setAllowed(res.data.canPost);
            if (res.data.messages.length) {
              lastAt.current = res.data.messages.at(-1)!.createdAt;
              setMessages((cur) => {
                const known = new Set(cur.map((m) => m.id));
                const fresh = res.data.messages.filter((m) => !known.has(m.id));
                return fresh.length ? [...cur, ...fresh] : cur;
              });
              onRead?.();
            }
          }
        } catch {
          /* offline — next round */
        }
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  // Keep the newest message in view (unless the reader scrolled up).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const tempId = `tmp-${Date.now()}`;
    stick.current = true;
    setText("");
    setMessages((cur) => [
      ...cur,
      { id: tempId, body, createdAt: new Date().toISOString(), senderId: null, senderName: null, fromCoach: false, mine: true, pending: true },
    ]);
    try {
      const res = await sendChatMessageAction({ thread, body });
      if (!res.ok) throw new Error(res.error);
      lastAt.current = res.data.createdAt > (lastAt.current ?? "") ? res.data.createdAt : lastAt.current;
      setMessages((cur) => cur.map((m) => (m.id === tempId ? { ...m, id: res.data.id, createdAt: res.data.createdAt, pending: false } : m)));
    } catch (err) {
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      setText(body);
      toast.error(err instanceof Error && err.message ? err.message : t.chat.sendFailed);
    }
  };

  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
  const days = messages.map((m) => dayOf(m.createdAt));
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? <p className="px-6 py-16 text-center text-sm text-muted">{emptyText}</p> : null}
        {messages.map((m, i) => {
          const day = days[i]!;
          const showDay = i === 0 || day !== days[i - 1];
          return (
            <div key={m.id}>
              {showDay ? (
                <p className="my-3 text-center">
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-muted">{fmt.date(day)}</span>
                </p>
              ) : null}
              <div className={cn("flex", m.mine ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-card",
                    m.mine ? "rounded-ss-md bg-primary text-primary-fg" : m.fromCoach ? "rounded-se-md bg-brand text-brand-ink" : "rounded-se-md bg-surface",
                    m.pending && "opacity-60",
                  )}
                >
                  {showNames && !m.mine ? (
                    <p className={cn("mb-0.5 text-xs font-semibold", m.fromCoach ? "text-brand-ink/80" : "text-info-text")}>
                      {m.fromCoach ? t.chat.coachName : (m.senderName ?? "—")}
                    </p>
                  ) : null}
                  <p dir="auto" className="whitespace-pre-wrap break-words text-start">
                    {m.body}
                  </p>
                  <p className={cn("mt-0.5 text-end text-[10px]", m.mine ? "text-primary-fg/70" : "text-muted")}>{fmt.time(m.createdAt, timezone)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allowed ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2 border-t border-line bg-page p-2.5"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            dir="auto"
            placeholder={t.chat.placeholder}
            aria-label={t.chat.placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] outline-none field-sizing-content focus:border-ink"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={t.chat.send}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition disabled:opacity-40"
          >
            <SendHorizontal className="rtl-flip size-5" />
          </button>
        </form>
      ) : (
        <p className="flex items-center justify-center gap-2 border-t border-line bg-surface-2 px-4 py-3.5 text-sm text-muted">
          <Lock className="size-4" /> {t.chat.onlyCoach}
        </p>
      )}
    </div>
  );
}
