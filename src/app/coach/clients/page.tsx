import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Users } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { listClients, type ClientListFilters } from "@/server/services/clients";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientFilters } from "@/components/coach/client-filters";
import { ClientRowActions } from "@/components/coach/client-row-actions";
import { ClientStatusBadge, NutritionStatusBadge, WorkoutStatusBadge } from "@/components/shared/status";
import { goalLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.clients };
}

type SP = Record<string, string | undefined>;

function adherenceTone(v: number | null) {
  if (v == null) return "text-muted";
  if (v >= 80) return "text-good-text";
  if (v >= 50) return "text-warn-text";
  return "text-crit-text";
}

function SortLink({ active, dir, href, children }: { active: boolean; dir: "asc" | "desc"; href: string; children: React.ReactNode }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
      {children}
      <Icon className={cn("size-3", !active && "opacity-40")} />
    </Link>
  );
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireCoachPage();
  const sp = await searchParams;
  const filters: ClientListFilters = {
    q: sp.q,
    status: (sp.status as ClientListFilters["status"]) ?? "all",
    workout: (sp.workout as ClientListFilters["workout"]) ?? "all",
    nutrition: (sp.nutrition as ClientListFilters["nutrition"]) ?? "all",
    goal: (sp.goal as ClientListFilters["goal"]) ?? "all",
    activity: (sp.activity as ClientListFilters["activity"]) ?? "all",
    sort: (sp.sort as ClientListFilters["sort"]) ?? "name",
    dir: sp.dir === "desc" ? "desc" : "asc",
    page: Number(sp.page) || 1,
    pageSize: 12,
  };
  const data = await listClients(actor, filters);
  const { prefs } = data;
  const { t, f, fmt } = await getI18n();

  const qs = (patch: SP) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v != null && v !== "") as [string, string][]);
    return `/coach/clients?${p.toString()}`;
  };
  const sortProps = (k: NonNullable<ClientListFilters["sort"]>) => {
    const active = filters.sort === k;
    const nextDir = active && filters.dir === "asc" ? "desc" : "asc";
    return { active, dir: filters.dir ?? "asc", href: qs({ sort: k, dir: nextDir, page: undefined }) };
  };

  return (
    <>
      <PageHeader
        title={t.clients.title}
        description={`${fmt.plural(t.clients.count, data.total)}${filters.q ? ` ${f(t.clients.matching, { q: filters.q })}` : ""}`}
        actions={
          <LinkButton href="/coach/clients/new">
            <Plus /> {t.clients.addClient}
          </LinkButton>
        }
      />
      <div className="mb-5">
        <ClientFilters />
      </div>

      {data.clients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={t.clients.noneFound}
          description={sp.q || sp.status || sp.workout || sp.nutrition || sp.goal || sp.activity ? t.clients.noneFoundFiltered : t.clients.noneYet}
          action={
            <LinkButton href="/coach/clients/new" variant="secondary">
              <Plus /> {t.clients.addClient}
            </LinkButton>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-start text-xs font-medium text-muted">
                    <th className="py-3 pe-3 ps-5 text-start"><SortLink {...sortProps("name")}>{t.clients.colClient}</SortLink></th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("status")}>{t.clients.colStatus}</SortLink></th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("weight")}>{t.clients.colWeight}</SortLink></th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("goal")}>{t.clients.colGoal}</SortLink></th>
                    <th className="px-3 py-3 text-start">{t.clients.colToday}</th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("workoutAdherence")}>{t.clients.colWorkout30}</SortLink></th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("nutritionAdherence")}>{t.clients.colMeals30}</SortLink></th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("lastActivity")}>{t.clients.colLastActivity}</SortLink></th>
                    <th className="px-3 py-3 text-start"><SortLink {...sortProps("joined")}>{t.clients.colJoined}</SortLink></th>
                    <th className="w-12 py-3 pe-5 ps-3"><span className="sr-only">{t.common.actions}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.clients.map((c) => (
                    <tr key={c.id} className="group transition-colors hover:bg-surface-2/50">
                      <td className="py-3 pe-3 ps-5">
                        <Link href={`/coach/clients/${c.id}`} className="flex items-center gap-3">
                          <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="md" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink group-hover:underline">{c.fullName}</span>
                            <span className="block truncate text-xs text-muted">
                              <span dir="ltr">{c.email}</span>
                              {c.phone ? (
                                <>
                                  {" · "}
                                  <span dir="ltr">{c.phone}</span>
                                </>
                              ) : null}
                            </span>
                            <span className="font-mono text-[10.5px] text-muted/80" dir="ltr">
                              {c.code}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><ClientStatusBadge status={c.status} /></td>
                      <td className="px-3 py-3 tabular">
                        <span className="block font-medium">{fmt.weight(c.currentWeightKg, prefs.weightUnit)}</span>
                        <span className="block text-xs text-muted">{fmt.length(c.heightCm, prefs.lengthUnit, 0)}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{goalLabel(t, c.goal)}</td>
                      <td className="px-3 py-3">
                        {c.status === "active" ? (
                          <div className="flex flex-col items-start gap-1">
                            <WorkoutStatusBadge status={c.today.workout} pct={c.today.workout === "in_progress" ? c.today.workoutPct : null} />
                            <NutritionStatusBadge status={c.today.nutrition} done={c.today.mealsDone} total={c.today.mealsTotal} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted">{t.clients.disabledAccount}</span>
                        )}
                      </td>
                      <td className={cn("px-3 py-3 font-semibold tabular", adherenceTone(c.adherence.workoutAdherence))}>{fmt.pct(c.adherence.workoutAdherence)}</td>
                      <td className={cn("px-3 py-3 font-semibold tabular", adherenceTone(c.adherence.mealRate))}>{fmt.pct(c.adherence.mealRate)}</td>
                      <td className="px-3 py-3 text-ink-2">{c.lastActivityAt ? fmt.timeAgo(c.lastActivityAt) : <span className="text-muted">{t.common.never}</span>}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">{fmt.date(c.joinedOn)}</td>
                      <td className="py-3 pe-5 ps-3 text-end"><ClientRowActions id={c.id} name={c.fullName} status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile / tablet cards */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {data.clients.map((c) => (
              <li key={c.id}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Link href={`/coach/clients/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={c.fullName} clientId={c.id} avatarKey={c.avatarKey} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.fullName}</span>
                        <span className="block truncate text-xs text-muted">
                          <span dir="ltr">{c.phone ?? c.email}</span>
                        </span>
                      </span>
                    </Link>
                    <ClientRowActions id={c.id} name={c.fullName} status={c.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <ClientStatusBadge status={c.status} />
                    {c.status === "active" ? (
                      <>
                        <WorkoutStatusBadge status={c.today.workout} />
                        <NutritionStatusBadge status={c.today.nutrition} done={c.today.mealsDone} total={c.today.mealsTotal} />
                      </>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                    <div>
                      <dt className="text-muted">{t.clients.colWeight}</dt>
                      <dd className="mt-0.5 font-semibold tabular">{fmt.weight(c.currentWeightKg, prefs.weightUnit)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t.clients.colWorkout30}</dt>
                      <dd className={cn("mt-0.5 font-semibold tabular", adherenceTone(c.adherence.workoutAdherence))}>{fmt.pct(c.adherence.workoutAdherence)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t.clients.colMeals30}</dt>
                      <dd className={cn("mt-0.5 font-semibold tabular", adherenceTone(c.adherence.mealRate))}>{fmt.pct(c.adherence.mealRate)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">
                    {goalLabel(t, c.goal)} · {c.lastActivityAt ? f(t.clients.activeAgo, { ago: fmt.timeAgo(c.lastActivityAt) }) : t.clients.noActivityYet}
                  </p>
                </Card>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <Pagination page={data.page} pages={data.pages} total={data.total} label={t.clients.paginationLabel} hrefFor={(p) => qs({ page: String(p) })} />
          </div>
        </>
      )}
    </>
  );
}
