import { ClipboardList, History } from "lucide-react";
import { requireCoachPage } from "@/server/auth/guards";
import { getNutritionPlanForEditor } from "@/server/services/nutrition";
import { getCoachPrefs } from "@/server/services/settings";
import { orNotFound } from "@/server/page-helpers";
import { Segmented } from "@/components/ui/link-tabs";
import { NutritionPlanEditor } from "@/components/coach/nutrition-plan-editor";
import { getI18n } from "@/i18n/server";

export default async function ClientNutritionPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireCoachPage();
  const { clientId } = await params;
  const [plan, prefs] = await Promise.all([orNotFound(getNutritionPlanForEditor(actor, clientId)), getCoachPrefs(actor.userId)]);
  const { t, f, fmt } = await getI18n();
  const base = `/coach/clients/${clientId}/nutrition`;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          items={[
            { href: base, label: t.tabs.planEditor, icon: <ClipboardList />, exact: true },
            { href: `${base}/history`, label: t.tabs.mealHistory, icon: <History /> },
          ]}
        />
        {plan ? <p className="text-xs text-muted">{f(t.workoutEditor.lastEdited, { when: fmt.relativeDay(plan.updatedAt, prefs.timezone) })}</p> : null}
      </div>
      <NutritionPlanEditor clientId={clientId} initial={plan} />
    </>
  );
}
