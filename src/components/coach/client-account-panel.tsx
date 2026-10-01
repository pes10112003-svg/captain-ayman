"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, KeyRound, Link2, MessageCircle, Power, Trash2, UserX, Wand2 } from "lucide-react";
import {
  createClientResetLinkAction,
  deleteClientAction,
  removeClientAvatarAction,
  setClientPasswordAction,
  setClientStatusAction,
  uploadClientAvatarAction,
} from "@/server/actions/clients";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { PasswordInput } from "@/components/shared/password-input";
import { useI18n } from "@/i18n/client";
import { generatePassword } from "@/lib/passwords";
import { buildInviteMessage, type InviteInfo } from "./client-form";

type PanelClient = { id: string; fullName: string; email: string; status: "active" | "inactive"; avatarKey: string | null };

export function ClientAccountPanel({ client, invite }: { client: PanelClient; invite?: InviteInfo }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState<{ kind: "password" | "link"; value: string } | null>(null);
  const [password, setPassword] = useState("");
  const [forceChange, setForceChange] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmName, setConfirmName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const savePassword = () =>
    start(async () => {
      setPasswordError(undefined);
      const value = password.trim();
      const res = await setClientPasswordAction(client.id, { password: value, forcePasswordChange: forceChange });
      if (!res.ok) {
        setPasswordError(res.fieldErrors?.password?.[0] ?? res.error);
        return;
      }
      toast.success(t.account.passwordSet);
      setSecret({ kind: "password", value: res.data.generatedPassword ?? value });
      setPassword("");
      setForceChange(false);
    });

  const resetLink = () =>
    start(async () => {
      const res = await createClientResetLinkAction(client.id);
      if (!res.ok) return void toast.error(res.error);
      if (res.data.resetUrl) setSecret({ kind: "link", value: res.data.resetUrl });
    });

  const inviteMessage =
    secret?.kind === "password" && invite ? buildInviteMessage(t, invite, { name: client.fullName, email: client.email, password: secret.value }) : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t.account.profilePhoto} />
        <CardBody className="flex items-center gap-4">
          <Avatar name={client.fullName} clientId={client.id} avatarKey={client.avatarKey} size="xl" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={pending}>
              <ImagePlus /> {client.avatarKey ? t.common.change : t.common.upload}
            </Button>
            {client.avatarKey ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  start(async () => {
                    const res = await removeClientAvatarAction(client.id);
                    if (!res.ok) return void toast.error(res.error);
                    router.refresh();
                  })
                }
              >
                {t.common.remove}
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("avatar", file);
                start(async () => {
                  const res = await uploadClientAvatarAction(client.id, fd);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(t.account.photoUpdated);
                  router.refresh();
                });
                e.target.value = "";
              }}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.account.password} description={t.account.passwordSub} icon={<KeyRound />} />
        <CardBody className="space-y-3">
          <Field label={t.account.newPassword} htmlFor="client-new-password" error={passwordError}>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <PasswordInput
                  id="client-new-password"
                  autoComplete="new-password"
                  value={password}
                  invalid={!!passwordError}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.clientForm.passwordPh}
                />
              </div>
              <Button type="button" variant="secondary" size="md" onClick={() => setPassword(generatePassword())}>
                <Wand2 /> {t.account.generate}
              </Button>
            </div>
          </Field>
          <label className="flex items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" checked={forceChange} onChange={(e) => setForceChange(e.target.checked)} className="mt-0.5 size-4 rounded accent-[var(--primary)]" />
            {t.account.forceChange}
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={savePassword} loading={pending}>
              <KeyRound /> {t.account.setPassword}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetLink} disabled={pending}>
              <Link2 /> {t.account.resetLink}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.account.access} icon={<Power />} description={client.status === "active" ? t.account.accessActive : t.account.accessDisabled} />
        <CardBody>
          <ConfirmDialog
            title={f(client.status === "active" ? t.account.disableTitle : t.account.enableTitle, { name: client.fullName })}
            description={client.status === "active" ? t.account.disableText : t.account.enableText}
            confirmLabel={client.status === "active" ? t.account.disable : t.account.enableShort}
            variant={client.status === "active" ? "danger" : "primary"}
            onConfirm={async () => {
              const res = await setClientStatusAction(client.id, client.status === "active" ? "inactive" : "active");
              if (!res.ok) {
                toast.error(res.error);
                return false;
              }
              toast.success(client.status === "active" ? t.account.disabled : t.account.enabled);
              router.refresh();
            }}
            trigger={
              <Button variant={client.status === "active" ? "secondary" : "primary"} size="sm">
                <UserX /> {client.status === "active" ? t.account.disable : t.account.enable}
              </Button>
            }
          />
        </CardBody>
      </Card>

      <Card className="border-crit/40">
        <CardHeader title={t.account.deleteTitle} icon={<AlertTriangle />} description={t.account.deleteSub} />
        <CardBody>
          <ConfirmDialog
            title={f(t.account.deleteConfirmTitle, { name: client.fullName })}
            description={t.account.deleteConfirmText}
            confirmLabel={t.account.deleteForever}
            onConfirm={async () => {
              const res = await deleteClientAction(client.id, confirmName);
              if (res && !res.ok) {
                toast.error(res.error);
                return false;
              }
            }}
            trigger={
              <Button variant="danger-ghost" size="sm">
                <Trash2 /> {t.account.deleteButton}
              </Button>
            }
          >
            <Field label={f(t.account.typeToConfirm, { name: client.fullName })} htmlFor="confirm-name">
              <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
            </Field>
          </ConfirmDialog>
        </CardBody>
      </Card>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        {secret ? (
          <DialogContent
            title={secret.kind === "password" ? t.account.password : t.account.resetLinkTitle}
            description={secret.kind === "password" ? t.account.passwordSet : t.account.resetLinkText}
          >
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-sm" dir="ltr">
                {secret.value}
              </code>
              <CopyButton value={secret.value} />
            </div>
            {inviteMessage ? (
              <div className="mt-4">
                <pre className="whitespace-pre-wrap rounded-xl border border-dashed border-line-strong p-3 font-sans text-[13px] leading-relaxed text-ink-2">
                  {inviteMessage}
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton value={inviteMessage} label={t.clientForm.copyInvite} variant="primary" />
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
                  >
                    <MessageCircle className="size-4" aria-hidden /> WhatsApp
                  </a>
                </div>
              </div>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
