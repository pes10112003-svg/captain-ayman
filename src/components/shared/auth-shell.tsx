import { Activity, LineChart, ShieldCheck, Utensils } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LanguageIconButton, ThemeIconButton } from "@/components/shared/preferences";
import { getI18n } from "@/i18n/server";
import { brandName } from "@/lib/constants";

/** Two-column frame for public pages (access code, sign-in, password reset, admin setup). */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getI18n();
  const features = [
    { icon: Activity, text: t.auth.feature1 },
    { icon: Utensils, text: t.auth.feature2 },
    { icon: LineChart, text: t.auth.feature3 },
    { icon: ShieldCheck, text: t.auth.feature4 },
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -end-40 -top-40 size-[520px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #C4F042 0%, transparent 65%)" }}
          aria-hidden
        />
        <Logo invert subtitle={t.brand.tagline} />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.2] tracking-tight">
            {t.auth.heroTitle} <span className="text-[#C4F042]">{t.auth.heroAccent}</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">{t.auth.heroText}</p>
          <ul className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-white/80">
                <Icon className="size-4 shrink-0 text-[#C4F042]" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} {brandName(locale)} · {t.auth.footer}
        </p>
      </aside>
      <main className="relative flex items-center justify-center px-5 py-16 sm:px-10">
        <div className="absolute end-3 top-3 flex items-center gap-0.5 sm:end-5 sm:top-5">
          <LanguageIconButton />
          <ThemeIconButton />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo subtitle={t.brand.tagline} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
