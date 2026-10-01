import Link from "next/link";
import { Camera, CheckCheck, CircleUser, ClipboardList, Dumbbell, KeyRound, LogIn, Ruler, ShieldCheck, Utensils } from "lucide-react";
import { describeActivity, type ActivityKind } from "@/lib/activity-format";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import type { ActivityRow } from "@/server/services/activity-feed";

const ICONS: Record<ActivityKind, typeof LogIn> = {
  login: LogIn,
  workout: CheckCheck,
  set: Dumbbell,
  meal: Utensils,
  plan: ClipboardList,
  measure: Ruler,
  photo: Camera,
  account: CircleUser,
  permission: ShieldCheck,
};

export async function ActivityList({ rows, timezone, showClient = true, dense }: { rows: ActivityRow[]; timezone: string; showClient?: boolean; dense?: boolean }) {
  const { t, fmt } = await getI18n();
  return (
    <ol className="relative">
      {rows.map((row, i) => {
        const d = describeActivity(row, t, fmt);
        const Icon = row.action.startsWith("auth.password") || row.action === "coach.client.password_reset" ? KeyRound : ICONS[d.kind];
        return (
          <li key={row.id} className={cn("relative flex gap-3", dense ? "pb-4" : "pb-5", i === rows.length - 1 && "pb-0")}>
            {i < rows.length - 1 ? <span className="absolute bottom-0 start-[15px] top-9 w-px bg-line" aria-hidden /> : null}
            <span
              className={cn(
                "relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface [&_svg]:size-3.5",
                d.tone === "good" ? "bg-good-soft text-good-text" : d.tone === "warn" ? "bg-warn-soft text-warn-text" : d.tone === "crit" ? "bg-crit-soft text-crit-text" : "bg-surface-2 text-ink-2",
              )}
            >
              <Icon aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm leading-snug text-ink">
                {showClient && row.clientId ? (
                  <Link href={`/coach/clients/${row.clientId}`} className="hover:underline">
                    {d.text}
                  </Link>
                ) : (
                  d.text
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {d.detail ? <span>{d.detail} · </span> : null}
                <time dateTime={row.createdAt.toISOString()}>{fmt.relativeDay(row.createdAt, timezone)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
