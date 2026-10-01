import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { ForgotPasswordForm } from "./forgot-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  // Without an email provider configured, password help goes through the coach (clients) or /setup (coach).
  const mailEnabled = process.env.NODE_ENV !== "production" || !!process.env.MAIL_DRIVER;
  return (
    <div>
      <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl-flip" /> {t.auth.backToSignIn}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t.auth.forgotTitle}</h1>
      {mailEnabled ? (
        <>
          <p className="mb-8 mt-1.5 text-sm text-muted">{t.auth.forgotSubtitle}</p>
          <ForgotPasswordForm />
        </>
      ) : (
        <ul className="mt-6 space-y-3">
          <li className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden />
            <p className="leading-relaxed text-ink-2">{t.auth.forgotClient}</p>
          </li>
          <li className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden />
            <p className="leading-relaxed text-ink-2">{t.auth.forgotCoach}</p>
          </li>
        </ul>
      )}
    </div>
  );
}
