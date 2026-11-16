import { BarChart3, CalendarDays, History } from "lucide-react";
import { Segmented } from "@/components/ui/link-tabs";
import { getI18n } from "@/i18n/server";

/** Today's workout · past workouts · the client's stats. */
export async function WorkoutTabs() {
  const { t } = await getI18n();
  return (
    <Segmented
      className="w-full [&>a]:flex-1 [&>a]:justify-center"
      items={[
        { href: "/client/workout", label: t.myTraining.today, icon: <CalendarDays />, exact: true },
        { href: "/client/workout/history", label: t.myTraining.history, icon: <History /> },
        { href: "/client/workout/stats", label: t.myTraining.stats, icon: <BarChart3 /> },
      ]}
    />
  );
}
