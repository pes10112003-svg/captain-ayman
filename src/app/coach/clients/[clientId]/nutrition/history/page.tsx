import Link from "next/link";
import { ClipboardList, History, Timer } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getMealHistory } from "@/server/services/nutrition";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Card, CardBody } from "@/components/ui/card";
import { Segmented } from "@/components/ui/link-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClass } from "@/components/ui/button";
import { addDays, clockToMinutes, minutesOfDayInTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export default async function MealHistoryPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ before?: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const { before } = await searchParams;
  const [data, prefs] = await Promise.all([orNotFound(getMealHistory(actor, clientId, { days: 14, before })), getCoachPrefs(actor.userId)]);
  const { t, f, fmt } = await getI18n();
  const base = `/coach/clients/${clientId}/nutrition`;
  const tz = prefs.timezone;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          items={[
            { href: base, label: t.tabs.planEditor, icon: <ClipboardList />, exact: true },
            { href: `${base}/history`, label: t.tabs.mealHistory, icon: <History /> },
          ]}
        />
        <p className="text-xs text-muted">
          {fmt.date(data.start)} – {fmt.date(data.end)}
        </p>
      </div>
      {data.groups.length === 0 ? (
        <EmptyState icon={<History />} title={t.mealHistory.emptyTitle} description={t.mealHistory.emptyText} />
      ) : (
        <div className="space-y-4">
          {data.groups.map((g) => (
            <Card key={g.date}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div>
                  <p className="font-semibold">{fmt.date(g.date, { weekday: "long", month: "long", day: "numeric" })}</p>
                  <p className="text-xs text-muted">
                    {f(t.mealHistory.dailyCompletion, { done: fmt.num(g.completed, 0), total: fmt.num(g.total, 0) })}
                    {g.date === data.today ? t.mealHistory.todaySuffix : ""}
                  </p>
                </div>
                <div className="flex w-40 items-center gap-3">
                  <ProgressBar value={g.adherence} tone="series-2" size="sm" label={f(t.mealHistory.adherence, { pct: fmt.num(g.adherence ?? 0, 0) })} />
                  <span className="w-10 text-end text-sm font-semibold tabular">{fmt.pct(Math.round(g.adherence ?? 0))}</span>
                </div>
              </div>
              <CardBody className="p-0">
                <ul className="divide-y divide-line">
                  {g.logs.map((m) => {
                    const delay = m.consumedAt ? minutesOfDayInTz(m.consumedAt, tz) - clockToMinutes(m.scheduledTime) : null;
                    return (
                      <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.mealName}</p>
                          <p className="truncate text-xs text-muted">{m.items.map((i) => i.name).join(", ") || "—"}</p>
                        </div>
                        <div className="text-xs text-muted sm:text-sm">
                          <span className="sm:hidden">{t.mealHistory.scheduled} </span>
                          <span className="hidden text-xs sm:block">{t.mealHistory.scheduled}</span>
                          <span className="font-medium text-ink-2 tabular">{fmt.clock(m.scheduledTime)}</span>
                        </div>
                        <div className="text-xs text-muted sm:text-sm">
                          <span className="hidden text-xs sm:block">{t.mealHistory.consumed}</span>
                          {m.consumedAt ? (
                            <span className="font-semibold text-good-text tabular">
                              {fmt.time(m.consumedAt, tz)}
                              {delay != null && Math.abs(delay) >= 5 ? (
                                <span className={cn("ms-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium", Math.abs(delay) > 60 ? "text-warn-text" : "text-muted")}>
                                  <Timer className="size-3" />
                                  <span dir="ltr">
                                    {delay > 0 ? "+" : "−"}
                                    {fmt.num(Math.abs(delay), 0)} {fmt.unit("min")}
                                  </span>
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        <div className="justify-self-start sm:justify-self-end">
                          {m.displayStatus === "completed" ? (
                            <Badge tone="good">{t.mealHistory.completed}</Badge>
                          ) : m.displayStatus === "missed" ? (
                            <Badge tone="crit">{t.mealHistory.notCompleted}</Badge>
                          ) : (
                            <Badge>{t.mealHistory.pending}</Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-between">
        {data.hasMore ? (
          <Link href={`${base}/history?before=${addDays(data.start, -1)}`} className={buttonClass("secondary", "sm")}>
            {t.mealHistory.olderDays}
          </Link>
        ) : (
          <span />
        )}
        {before ? (
          <Link href={`${base}/history`} className={buttonClass("ghost", "sm")}>
            {t.mealHistory.backToLatest}
          </Link>
        ) : null}
      </div>
    </>
  );
}
