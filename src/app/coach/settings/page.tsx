import { Globe2, KeyRound, LogOut, Palette, UserRound } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { logoutAction } from "@/server/actions/auth";
import { getCoachPrefs } from "@/server/services/settings";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AppSettingsForm, CoachProfileForm } from "@/components/coach/settings-forms";
import { ChangePasswordForm } from "@/components/shared/password-form";
import { AppearanceControls } from "@/components/shared/preferences";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.settings };
}

export default async function SettingsPage() {
  const actor = await requireCoachPage();
  const [prefs, { t }] = await Promise.all([getCoachPrefs(actor.userId), getI18n()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.titles.settings} description={t.settings.subtitle} />
      <div className="space-y-6">
        <Card>
          <CardHeader title={t.settings.appearance} description={t.settings.appearanceSub} icon={<Palette />} />
          <CardBody>
            <AppearanceControls />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.settings.coachProfile} icon={<UserRound />} />
          <CardBody>
            <CoachProfileForm name={actor.name} email={actor.email} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.settings.app} icon={<Globe2 />} />
          <CardBody>
            <AppSettingsForm businessName={prefs.businessName} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.settings.changePassword} description={t.settings.changePasswordSub} icon={<KeyRound />} />
          <CardBody className="max-w-md">
            <ChangePasswordForm requireCurrent />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.settings.account} description={t.settings.accountSub} icon={<LogOut className="rtl-flip" />} />
          <CardBody>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary">
                <LogOut className="rtl-flip" /> {t.common.signOut}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
