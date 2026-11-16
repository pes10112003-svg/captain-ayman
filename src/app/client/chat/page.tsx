import Link from "next/link";
import { Megaphone, UserRound } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { clientChatUnread, listMessages, markRead } from "@/server/services/chat";
import { getClientProfile } from "@/server/services/clients";
import { getCoachPrefs } from "@/server/services/settings";
import { ChatView } from "@/components/shared/chat-view";
import { ChatReadSync } from "@/components/client/chat-read-sync";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.chat.title };
}

export default async function ClientChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const actor = await requireClientPage();
  const { c } = await searchParams;
  const thread = c === "coach" ? "coach" : "group";
  const { t } = await getI18n();
  const { client } = await getClientProfile(actor, actor.clientId);
  const [{ messages, canPost }, prefs] = await Promise.all([listMessages(actor, thread), getCoachPrefs(client.coachId)]);
  await markRead(actor, thread);
  const unread = await clientChatUnread(actor);

  const tabs = [
    { key: "group", href: "/client/chat", label: t.chat.group, icon: Megaphone, n: unread.group },
    { key: "coach", href: "/client/chat?c=coach", label: t.chat.coach, icon: UserRound, n: unread.coach },
  ];

  return (
    <div className="-mx-4 -mt-5 flex h-[calc(100dvh-3.5rem-4.75rem-env(safe-area-inset-bottom))] flex-col md:-mt-8 md:h-[calc(100dvh-4rem-2rem)]">
      <ChatReadSync group={unread.group} coach={unread.coach} />
      <div className="grid grid-cols-2 gap-1 border-b border-line bg-page p-2">
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={x.href}
            replace
            aria-current={thread === x.key ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition",
              thread === x.key ? "bg-primary text-primary-fg" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            <x.icon className="size-4" /> {x.label}
            {x.n > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-crit px-1 text-[11px] font-semibold leading-5 text-white">{x.n}</span> : null}
          </Link>
        ))}
      </div>
      <p className="border-b border-line bg-surface-2/60 px-4 py-2 text-center text-xs text-muted">{thread === "group" ? t.chat.groupSub : t.chat.coachSub}</p>
      <ChatView
        key={thread}
        thread={thread}
        initial={messages}
        canPost={canPost}
        showNames={thread === "group"}
        timezone={prefs.timezone}
        emptyText={thread === "group" ? t.chat.emptyGroup : t.chat.emptyPrivate}
        className="flex-1 bg-surface-2/40"
      />
    </div>
  );
}
