"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing, Check, Settings2 } from "lucide-react";
import { sendAnnouncementAction, updateChatSettingsAction } from "@/server/actions/chat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { ChatMode } from "@/server/services/chat";

type ClientOption = { id: string; name: string; status: string };

/** Who can write in the group chat: only the coach (default), every client, or the ticked clients. */
export function ChatSettingsDialog({ mode, posters, clients }: { mode: ChatMode; posters: string[]; clients: ClientOption[] }) {
  const { t, f, fmt } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<ChatMode>(mode);
  const [picked, setPicked] = useState<Set<string>>(new Set(posters));
  const [saving, start] = useTransition();
  const status = mode === "everyone" ? t.chat.statusEveryone : mode === "selected" ? f(t.chat.statusSelected, { n: fmt.num(posters.length, 0) }) : t.chat.statusCoach;

  const save = () =>
    start(async () => {
      const res = await updateChatSettingsAction({ mode: m, clientIds: m === "selected" ? [...picked] : [] });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t.chat.saved);
      setOpen(false);
      router.refresh();
    });

  const options: { key: ChatMode; label: string; sub: string }[] = [
    { key: "coach_only", label: t.chat.modeCoach, sub: t.chat.modeCoachSub },
    { key: "everyone", label: t.chat.modeEveryone, sub: t.chat.modeEveryoneSub },
    { key: "selected", label: t.chat.modeSelected, sub: t.chat.modeSelectedSub },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setM(mode);
          setPicked(new Set(posters));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Settings2 /> <span className="max-sm:hidden">{status}</span>
          <span className="sm:hidden">{t.chat.settings}</span>
        </Button>
      </DialogTrigger>
      <DialogContent title={t.chat.settingsTitle} description={t.chat.settingsSub}>
        <div className="space-y-2" role="radiogroup" aria-label={t.chat.settingsTitle}>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={m === o.key}
              onClick={() => setM(o.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3.5 text-start transition",
                m === o.key ? "border-ink bg-surface-2" : "border-line hover:bg-surface-2/60",
              )}
            >
              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", m === o.key ? "border-ink bg-ink text-page" : "border-line-strong")}>
                {m === o.key ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>

        {m === "selected" ? (
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-ink-2">{t.chat.pickClients}</p>
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {clients.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2/60">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-ink)]"
                      checked={picked.has(c.id)}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const next = new Set(cur);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                    <span dir="auto" className="flex-1">
                      {c.name}
                    </span>
                    {c.status !== "active" ? <span className="text-xs text-muted">{t.chat.inactive}</span> : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button className="mt-5 w-full" onClick={save} loading={saving}>
          {t.common.save}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** A notification to every client (or one client) — not posted in the chat. */
export function AnnounceDialog({ clients }: { clients: ClientOption[] }) {
  const { t, f, fmt } = useI18n();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = await sendAnnouncementAction({ title, body: body.trim() || null, clientId: to === "all" ? null : to });
      if (!res.ok) return void toast.error(res.error);
      toast.success(f(t.chat.announceSent, { n: fmt.num(res.data.sent, 0) }));
      setTitle("");
      setBody("");
      setTo("all");
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="brand">
          <BellRing /> {t.chat.announce}
        </Button>
      </DialogTrigger>
      <DialogContent title={t.chat.announceTitle} description={t.chat.announceSub}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Field label={t.chat.announceTo} htmlFor="announce-to">
            <Select id="announce-to" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="all">{t.chat.announceAll}</option>
              {clients
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t.chat.announceHeading} htmlFor="announce-title">
            <Input id="announce-title" dir="auto" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.chat.announceHeadingPh} />
          </Field>
          <Field label={t.chat.announceBody} htmlFor="announce-body" optional>
            <Textarea id="announce-body" dir="auto" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.chat.announceBodyPh} />
          </Field>
          <Button type="submit" className="w-full" loading={sending} disabled={!title.trim()}>
            <BellRing /> {t.chat.announceSend}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
