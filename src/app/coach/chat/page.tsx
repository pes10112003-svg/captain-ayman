import Link from "next/link";
import { Fragment } from "react";
import { ChevronLeft, Megaphone, MessagesSquare } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { coachChatList, listMessages, markRead } from "@/server/services/chat";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Avatar } from "@/components/ui/avatar";
import { ChatView } from "@/components/shared/chat-view";
import { AnnounceDialog, ChatSettingsDialog } from "@/components/coach/chat-tools";
import { cn, isUuid } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.chat.title };
}

export default async function CoachChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const actor = await requireCoachPage();
  const { c } = await searchParams;
  const thread = c === "group" ? "group" : c && isUuid(c) ? c : null;
  const { t, fmt } = await getI18n();
  const prefs = await getCoachPrefs(actor.userId);

  let open: Awaited<ReturnType<typeof listMessages>> | null = null;
  if (thread) {
    open = await orNotFound(listMessages(actor, thread));
    await markRead(actor, thread);
  }
  const list = await coachChatList(actor);
  const active = thread && thread !== "group" ? list.clients.find((x) => x.id === thread) : null;
  const options = list.clients.map((x) => ({ id: x.id, name: x.name, status: x.status }));

  const row = (href: string, selected: boolean, icon: React.ReactNode, title: string, sub: string | null, last: string | null, unread: number) => (
    <li>
      <Link
        href={href}
        replace
        aria-current={selected ? "page" : undefined}
        className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 transition", selected ? "bg-surface-2" : "hover:bg-surface-2/60")}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span dir="auto" className="truncate text-sm font-semibold">
              {title}
            </span>
            {last ? <span className="shrink-0 text-[11px] text-muted">{fmt.timeAgo(last)}</span> : null}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span dir="auto" className="truncate text-xs text-muted">
              {sub ?? t.chat.noMessages}
            </span>
            {unread > 0 ? <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-crit px-1 text-[11px] font-semibold leading-5 text-white">{unread}</span> : null}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessagesSquare className="size-6" /> {t.chat.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ChatSettingsDialog mode={list.settings.mode} posters={list.settings.posters} clients={options} />
          <AnnounceDialog clients={options} />
        </div>
      </div>

      <div className="grid h-[calc(100dvh-12rem)] min-h-[480px] overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[320px_1fr]">
        <aside className={cn("min-h-0 overflow-y-auto border-e border-line p-2", thread && "max-lg:hidden")}>
          <ul className="space-y-0.5">
            {row(
              "/coach/chat?c=group",
              thread === "group",
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                <Megaphone className="size-5" />
              </span>,
              t.chat.group,
              list.group.lastBody,
              list.group.last,
              list.group.unread,
            )}
          </ul>
          <p className="mb-1 mt-4 px-3 text-[11px] font-medium uppercase tracking-wide text-muted">{t.chat.clients}</p>
          <ul className="space-y-0.5">
            {list.clients.map((x) => (
              <Fragment key={x.id}>
                {row(
                  `/coach/chat?c=${x.id}`,
                  thread === x.id,
                  <Avatar name={x.name} clientId={x.id} avatarKey={x.avatarKey} size="md" />,
                  x.name,
                  x.lastBody,
                  x.last,
                  x.unread,
                )}
              </Fragment>
            ))}
          </ul>
        </aside>

        <section className={cn("flex min-h-0 flex-col", !thread && "max-lg:hidden")}>
          {thread && open ? (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Link href="/coach/chat" replace className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden" aria-label={t.chat.back}>
                  <ChevronLeft className="rtl-flip size-5" />
                </Link>
                {active ? (
                  <Avatar name={active.name} clientId={active.id} avatarKey={active.avatarKey} size="sm" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-ink">
                    <Megaphone className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p dir="auto" className="truncate font-semibold">
                    {active ? active.name : t.chat.group}
                  </p>
                  <p className="text-xs text-muted">{active ? t.chat.private : t.chat.groupSub}</p>
                </div>
              </header>
              <ChatView
                key={thread}
                thread={thread}
                initial={open.messages}
                canPost
                showNames={thread === "group"}
                timezone={prefs.timezone}
                emptyText={thread === "group" ? t.chat.emptyGroup : t.chat.emptyPrivate}
                className="flex-1 bg-surface-2/40"
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <MessagesSquare className="mx-auto size-10 text-muted" />
                <p className="mt-3 font-semibold">{t.chat.pick}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t.chat.pickSub}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
