import Link from "next/link";
import { ResetPasswordForm } from "@/components/shared/password-form";
import { FormMessage } from "@/components/shared/form-message";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.newPassword, referrer: "no-referrer" as const };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, { t }] = await Promise.all([searchParams, getI18n()]);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t.titles.newPassword}</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">{t.auth.newPasswordSubtitle}</p>
      {typeof token === "string" && token.length >= 20 ? (
        <ResetPasswordForm token={token} />
      ) : (
        <FormMessage>
          {t.auth.invalidLink}{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            {t.auth.requestNew}
          </Link>
        </FormMessage>
      )}
    </div>
  );
}
