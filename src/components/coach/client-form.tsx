"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, KeyRound, MessageCircle, Save, UserPlus, Wand2 } from "lucide-react";
import { createClientAction, updateClientAction } from "@/server/actions/clients";
import type { ActionResult } from "@/server/actions/helpers";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { FormMessage } from "@/components/shared/form-message";
import { CopyButton } from "@/components/shared/copy-button";
import { PasswordInput } from "@/components/shared/password-input";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/en";
import { interpolate } from "@/i18n/format";
import { GENDER_KEYS, GOAL_KEYS, type Gender, type Goal } from "@/lib/constants";
import { generatePassword } from "@/lib/passwords";

export { CopyButton };

export type ClientFormDefaults = {
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender;
  height: number | null;
  startingWeight: number | null;
  goalWeight: number | null;
  goal: Goal;
  goalNote: string | null;
  coachNotes: string | null;
  status: "active" | "inactive";
};

/** What the coach needs to invite a client: the site link and (if enabled) the site access code. */
export type InviteInfo = { url: string };

const EMPTY: ClientFormDefaults = {
  fullName: "",
  email: "",
  phone: null,
  dateOfBirth: null,
  gender: "unspecified",
  height: null,
  startingWeight: null,
  goalWeight: null,
  goal: "general_fitness",
  goalNote: null,
  coachNotes: null,
  status: "active",
};

/** Ready-to-send WhatsApp message with everything the client needs to sign in. */
export function buildInviteMessage(t: Dict, info: InviteInfo, client: { name: string; email: string; password: string }) {
  const msg = interpolate(t.clientForm.invite, {
    name: client.name.split(" ")[0],
    url: info.url,
    email: client.email,
    password: client.password,
  });
  // Android clients use the app (client pages don't open in Android browsers).
  return `${msg}\n${interpolate(t.app.inviteLine, { url: `${info.url.replace(/\/+$/, "")}/get-app` })}`;
}

type CreateResult = { id: string; email: string; generatedPassword: string | null };

export function ClientForm({
  mode,
  clientId,
  defaults = EMPTY,
  weightUnit,
  lengthUnit,
  today,
  invite,
}: {
  mode: "create" | "edit";
  clientId?: string;
  defaults?: ClientFormDefaults;
  weightUnit: string;
  lengthUnit: string;
  today: string;
  invite?: InviteInfo;
}) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const action = mode === "create" ? createClientAction : updateClientAction.bind(null, clientId!);
  const [state, formAction, pending] = useActionState(
    action as (s: ActionResult<CreateResult> | ActionResult | null, f: FormData) => Promise<ActionResult<CreateResult> | ActionResult>,
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(defaults.fullName);
  const fileRef = useRef<HTMLInputElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const savedMsg = t.clientForm.saved;

  useEffect(() => {
    if (state?.ok && mode === "edit") {
      toast.success(savedMsg);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, router]);

  if (state?.ok && mode === "create") {
    const data = (state as { ok: true; data: CreateResult }).data;
    const finalPassword = data.generatedPassword ?? password;
    const message = invite ? buildInviteMessage(t, invite, { name, email: data.email, password: finalPassword }) : null;
    return (
      <Card className="mx-auto max-w-xl">
        <CardBody className="p-6 sm:p-8">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-good-soft text-good-text">
            <Check className="size-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{t.clientForm.createdTitle}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.clientForm.createdText}</p>
          <div className="mt-6 space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">{t.clientForm.signInEmail}</p>
                <p className="truncate font-mono text-sm" dir="ltr">
                  {data.email}
                </p>
              </div>
              <CopyButton value={data.email} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">{t.clientForm.signInPassword}</p>
                <p className="font-mono text-base font-semibold tracking-wide" dir="ltr">
                  {finalPassword}
                </p>
              </div>
              <CopyButton value={finalPassword} />
            </div>
          </div>
          {message ? (
            <div className="mt-4">
              <pre className="whitespace-pre-wrap rounded-2xl border border-dashed border-line-strong bg-surface p-4 font-sans text-[13px] leading-relaxed text-ink-2">
                {message}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton value={message} label={t.clientForm.copyInvite} variant="primary" />
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
              </div>
            </div>
          ) : null}
          <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" /> {t.clientForm.shownOnce}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <LinkButton href={`/coach/clients/${data.id}/workouts`} className="flex-1">
              {t.clientForm.buildWorkout}
            </LinkButton>
            <LinkButton href={`/coach/clients/${data.id}`} variant="secondary" className="flex-1">
              {t.clientForm.openProfile}
            </LinkButton>
          </div>
        </CardBody>
      </Card>
    );
  }

  const d = defaults;
  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}

      <Card>
        <CardHeader title={t.clientForm.personal} description={t.clientForm.personalSub} />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {mode === "create" ? (
            <div className="flex items-center gap-4 sm:col-span-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-line-strong bg-surface-2 text-muted transition hover:border-ink hover:text-ink"
                aria-label={t.clientForm.choosePhoto}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6" />}
              </button>
              <div className="text-sm">
                <p className="font-medium">{t.clientForm.photo}</p>
                <p className="text-muted">{t.clientForm.photoHint}</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                name="avatar"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
              />
            </div>
          ) : null}
          <Field label={t.clientForm.fullName} htmlFor="fullName" error={errors?.fullName}>
            <Input id="fullName" name="fullName" defaultValue={d.fullName} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
          </Field>
          <Field label={t.clientForm.email} htmlFor="email" error={errors?.email}>
            <Input id="email" name="email" type="email" dir="ltr" defaultValue={d.email} required autoComplete="off" />
          </Field>
          <Field label={t.clientForm.phone} htmlFor="phone" error={errors?.phone} optional>
            <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={d.phone ?? ""} placeholder="+20 100 000 0000" />
          </Field>
          <Field label={t.clientForm.dob} htmlFor="dateOfBirth" error={errors?.dateOfBirth} optional>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" max={today} defaultValue={d.dateOfBirth ?? ""} />
          </Field>
          <Field label={t.clientForm.gender} htmlFor="gender" error={errors?.gender}>
            <Select id="gender" name="gender" defaultValue={d.gender}>
              {GENDER_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t.genders[k]}
                </option>
              ))}
            </Select>
          </Field>
          {mode === "edit" ? (
            <Field label={t.clientForm.accountStatus} htmlFor="status" error={errors?.status} hint={t.clientForm.accountStatusHint}>
              <Select id="status" name="status" defaultValue={d.status}>
                <option value="active">{t.clientForm.active}</option>
                <option value="inactive">{t.clientForm.inactiveDisabled}</option>
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="status" value="active" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.clientForm.body} description={t.clientForm.bodySub} />
        <CardBody className="grid gap-5 sm:grid-cols-3">
          <Field label={t.clientForm.height} htmlFor="height" error={errors?.height} optional>
            <UnitInput id="height" name="height" unit={fmt.unit(lengthUnit)} type="number" step="0.1" defaultValue={d.height ?? ""} />
          </Field>
          <Field label={t.clientForm.startingWeight} htmlFor="startingWeight" error={errors?.startingWeight} optional>
            <UnitInput id="startingWeight" name="startingWeight" unit={fmt.unit(weightUnit)} type="number" step="0.1" defaultValue={d.startingWeight ?? ""} />
          </Field>
          <Field label={t.clientForm.goalWeight} htmlFor="goalWeight" error={errors?.goalWeight} optional>
            <UnitInput id="goalWeight" name="goalWeight" unit={fmt.unit(weightUnit)} type="number" step="0.1" defaultValue={d.goalWeight ?? ""} />
          </Field>
          <Field label={t.clientForm.fitnessGoal} htmlFor="goal" error={errors?.goal}>
            <Select id="goal" name="goal" defaultValue={d.goal}>
              {GOAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t.goals[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.clientForm.goalDetails} htmlFor="goalNote" error={errors?.goalNote} optional className="sm:col-span-2">
            <Input id="goalNote" name="goalNote" defaultValue={d.goalNote ?? ""} placeholder={t.clientForm.goalDetailsPh} />
          </Field>
          <Field
            label={t.clientForm.coachNotes}
            htmlFor="coachNotes"
            error={errors?.coachNotes}
            hint={t.clientForm.coachNotesHint}
            optional
            className="sm:col-span-3"
          >
            <Textarea id="coachNotes" name="coachNotes" defaultValue={d.coachNotes ?? ""} rows={3} placeholder={t.clientForm.coachNotesPh} />
          </Field>
        </CardBody>
      </Card>

      {mode === "create" ? (
        <Card>
          <CardHeader title={t.clientForm.signIn} description={t.clientForm.signInSub} icon={<KeyRound />} />
          <CardBody className="space-y-4">
            <Field label={t.clientForm.password} htmlFor="password" error={errors?.password} optional>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder={t.clientForm.passwordPh}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>
                  <Wand2 /> {t.clientForm.generate}
                </Button>
              </div>
            </Field>
            <label className="flex items-start gap-2.5 text-sm text-ink-2">
              <input type="checkbox" name="forcePasswordChange" className="mt-0.5 size-4 rounded accent-[var(--primary)]" />
              {t.clientForm.forceChange}
            </label>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={clientId ? `/coach/clients/${clientId}` : "/coach/clients"}
          className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-ink-2 hover:bg-surface-2"
        >
          {t.common.cancel}
        </Link>
        <Button type="submit" loading={pending}>
          {!pending ? mode === "create" ? <UserPlus /> : <Save /> : null}
          {mode === "create" ? t.clientForm.create : t.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
