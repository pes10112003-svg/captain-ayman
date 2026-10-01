import type { ReactNode } from "react";
import { KeyRound, Languages, LogOut, Lock, UserRound } from "lucide-react";
import { requireClientPage } from "@/server/auth/guards";
import { logoutAction } from "@/server/actions/auth";
import { getClientProfile } from "@/server/services/clients";
import { coachToday } from "@/server/services/settings";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/components/shared/password-form";
import { AppearanceControls } from "@/components/shared/preferences";
import { AvatarEditor, OwnProfileForm } from "@/components/client/profile-forms";
import { ageFromDob } from "@/lib/time";
import { getI18n } from "@/i18n/server";
import { genderLabel, goalLabel } from "@/i18n/labels";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.profile };
}

export default async function ClientProfilePage() {
  const actor = await requireClientPage();
  const [{ client, permissions }, { prefs, today }, { t, fmt }] = await Promise.all([
    getClientProfile(actor, actor.clientId),
    coachToday(actor.coachId),
    getI18n(),
  ]);
  const age = ageFromDob(client.dateOfBirth, today);
  const rows: { key: string; label: string; value: ReactNode }[] = [
    { key: "email", label: t.common.email, value: <span dir="ltr">{client.email}</span> },
    { key: "phone", label: t.common.phone, value: client.phone ? <span dir="ltr">{client.phone}</span> : "—" },
    { key: "age", label: t.clientProfile.age, value: age != null ? fmt.num(age, 0) : "—" },
    { key: "gender", label: t.overview.gender, value: genderLabel(t, client.gender) },
    { key: "height", label: t.common.height, value: fmt.length(client.heightCm, prefs.lengthUnit, 0) },
    { key: "goal", label: t.common.goal, value: goalLabel(t, client.goal) },
    { key: "goalWeight", label: t.clientProfile.goalWeight, value: fmt.weight(client.goalWeightKg, prefs.weightUnit) },
    { key: "memberSince", label: t.clientProfile.memberSince, value: fmt.date(client.joinedOn) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <AvatarEditor clientId={client.id} name={client.fullName} avatarKey={client.avatarKey} canEdit={permissions.editPersonalInfo} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{client.fullName}</h1>
          <p className="font-mono text-xs text-muted" dir="ltr">
            {client.code}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title={t.clientProfile.personalInfo} icon={<UserRound />} />
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {rows.map((r) => (
              <div key={r.key} className="min-w-0">
                <dt className="text-xs text-muted">{r.label}</dt>
                <dd className="truncate font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
          {client.goalNote ? <p dir="auto" className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-start text-sm text-ink-2">{client.goalNote}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.clientProfile.editInfo} icon={permissions.editPersonalInfo ? undefined : <Lock />} />
        <CardBody>
          {permissions.editPersonalInfo ? (
            <OwnProfileForm phone={client.phone} dateOfBirth={client.dateOfBirth} gender={client.gender} today={today} />
          ) : (
            <p className="text-sm text-muted">{t.clientProfile.managedByCoach}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t.auth.changePassword}
          icon={permissions.changeOwnPassword ? <KeyRound /> : <Lock />}
          description={permissions.changeOwnPassword ? t.settings.changePasswordSub : undefined}
        />
        <CardBody>
          {permissions.changeOwnPassword ? <ChangePasswordForm requireCurrent /> : <p className="text-sm text-muted">{t.auth.passwordManagedByCoach}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.settings.appearance} description={t.settings.appearanceSub} icon={<Languages />} />
        <CardBody>
          <AppearanceControls />
        </CardBody>
      </Card>

      <form action={logoutAction}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          <LogOut className="rtl-flip" /> {t.common.signOut}
        </Button>
      </form>
    </div>
  );
}
