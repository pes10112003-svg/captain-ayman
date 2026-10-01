import Link from "next/link";
import { Camera, ChevronLeft, Dumbbell, Mail, Phone, Ruler, ShieldCheck, Utensils } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ClientStatusBadge } from "@/components/shared/status";
import type { Goal } from "@/lib/constants";
import { getI18n } from "@/i18n/server";
import { goalLabel } from "@/i18n/labels";

export async function ClientHeader({
  client,
}: {
  client: { id: string; fullName: string; code: string; email: string; phone: string | null; status: "active" | "inactive"; goal: Goal; avatarKey: string | null; pendingPasswordSetup: boolean };
}) {
  const { t } = await getI18n();
  const base = `/coach/clients/${client.id}`;
  return (
    <div className="mb-5">
      <Link href="/coach/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="rtl-flip size-4" /> {t.clientHeader.back}
      </Link>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={client.fullName} clientId={client.id} avatarKey={client.avatarKey} size="xl" className="size-16 sm:size-20" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[28px]">{client.fullName}</h1>
              <ClientStatusBadge status={client.status} />
              {client.pendingPasswordSetup ? <Badge tone="warn">{t.clientHeader.awaitingFirst}</Badge> : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="font-mono text-xs" dir="ltr">
                {client.code}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> <span dir="ltr">{client.email}</span>
              </span>
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                  <Phone className="size-3.5" /> <span dir="ltr">{client.phone}</span>
                </a>
              ) : null}
              <span>{goalLabel(t, client.goal)}</span>
            </div>
          </div>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0 xl:justify-end">
          <LinkButton href={`${base}/workouts`} variant="secondary" size="sm">
            <Dumbbell /> {t.clientHeader.editWorkout}
          </LinkButton>
          <LinkButton href={`${base}/nutrition`} variant="secondary" size="sm">
            <Utensils /> {t.clientHeader.editNutrition}
          </LinkButton>
          <LinkButton href={`${base}/progress?add=1`} variant="secondary" size="sm">
            <Ruler /> {t.clientHeader.addMeasurement}
          </LinkButton>
          <LinkButton href={`${base}/photos?upload=1`} variant="secondary" size="sm">
            <Camera /> {t.clientHeader.uploadPhoto}
          </LinkButton>
          <LinkButton href={`${base}/permissions`} variant="secondary" size="sm">
            <ShieldCheck /> {t.clientHeader.permissions}
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
