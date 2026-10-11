import Link from "next/link";
import { headers } from "next/headers";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { AuthShell } from "@/components/shared/auth-shell";
import { buttonClass } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { APK_PATH, appIntentUrl, clientDevice } from "@/lib/app-shell";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.app.pageTitle };
}

/**
 * Where client pages send Android browsers and computers (src/proxy.ts). Public on purpose:
 * the invite message links here so new clients can install the app before signing in.
 */
export default async function GetAppPage() {
  const h = await headers();
  const device = clientDevice(h.get("user-agent"));
  const host = h.get("host") ?? "captain-ayman.vercel.app";
  const { t } = await getI18n();

  const badge = (
    <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-ink">
      <Smartphone className="size-3.5" aria-hidden /> {t.app.badge}
    </span>
  );

  if (device === "app" || device === "ios") {
    return (
      <AuthShell>
        <h1 className="text-2xl font-semibold tracking-tight">{t.app.inApp}</h1>
        <Link href="/client" className={buttonClass("primary", "lg", "mt-8 w-full")}>
          {t.app.continue}
        </Link>
      </AuthShell>
    );
  }

  if (device === "other") {
    return (
      <AuthShell>
        {badge}
        <h1 className="text-2xl font-semibold tracking-tight">{t.app.otherTitle}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.app.otherText}</p>
        <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium" dir="ltr">
          {host}/get-app
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {badge}
      <h1 className="text-2xl font-semibold tracking-tight">{t.app.title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.app.text}</p>
      <div className="mt-8 grid gap-3">
        <a href={APK_PATH} download className={buttonClass("brand", "lg", "w-full")}>
          <Download aria-hidden /> {t.app.download}
        </a>
        <a href={appIntentUrl(host, "/client")} className={buttonClass("secondary", "lg", "w-full")}>
          <ExternalLink aria-hidden /> {t.app.open}
        </a>
      </div>
      <h2 className="mt-8 text-sm font-semibold">{t.app.stepsTitle}</h2>
      <ol className="mt-3 space-y-2.5 text-sm text-ink-2">
        {[t.app.step1, t.app.step2, t.app.step3].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink">{i + 1}</span>
            <span className="pt-0.5 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </AuthShell>
  );
}
