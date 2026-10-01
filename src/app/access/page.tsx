import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/shared/auth-shell";
import { hasValidAccess } from "@/server/auth/gate";
import { getI18n } from "@/i18n/server";
import { AccessForm } from "./access-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.access };
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/access") ? next : "/login";
  if (await hasValidAccess()) redirect(target);
  const { t } = await getI18n();
  return (
    <AuthShell>
      <div>
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-ink">
          <LockKeyhole className="size-3.5" aria-hidden /> {t.access.badge}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{t.access.title}</h1>
        <p className="mb-8 mt-1.5 text-sm leading-relaxed text-muted">{t.access.subtitle}</p>
        <AccessForm next={target} />
        <p className="mt-6 text-xs text-muted">{t.access.note}</p>
      </div>
    </AuthShell>
  );
}
