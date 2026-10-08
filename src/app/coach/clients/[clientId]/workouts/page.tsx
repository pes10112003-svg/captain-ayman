import { ClipboardList, History } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getWorkoutPlanForEditor } from "@/server/services/workouts";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Segmented } from "@/components/ui/link-tabs";
import { WorkoutSheetEditor } from "@/components/coach/workout-sheet-editor";
import { getI18n } from "@/i18n/server";

export default async function ClientWorkoutsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const [{ plan, weightUnit, today, thisWeekStart, results }, prefs] = await Promise.all([
    orNotFound(getWorkoutPlanForEditor(actor, clientId)),
    getCoachPrefs(actor.userId),
  ]);
  const { t, f, fmt } = await getI18n();
  const base = `/coach/clients/${clientId}/workouts`;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          items={[
            { href: base, label: t.tabs.planEditor, icon: <ClipboardList />, exact: true },
            { href: `${base}/history`, label: t.tabs.history, icon: <History /> },
          ]}
        />
        {plan ? <p className="text-xs text-muted">{f(t.workoutEditor.lastEdited, { when: fmt.relativeDay(plan.updatedAt, prefs.timezone) })}</p> : null}
      </div>
      {/* Remount after every save so the editor starts from the saved copy. */}
      <WorkoutSheetEditor
        key={plan?.updatedAt ?? "new"}
        clientId={clientId}
        initial={plan}
        weightUnit={weightUnit}
        today={today}
        thisWeekStart={thisWeekStart}
        results={results}
      />
    </>
  );
}
