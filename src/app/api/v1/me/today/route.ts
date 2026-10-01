import { apiRoute } from "@/server/api/handler";
import { getTodayWorkout } from "@/server/services/workouts";
import { getTodayMeals } from "@/server/services/nutrition";
import { ForbiddenError } from "@/server/errors";

/** GET /api/v1/me/today — the signed-in client's workout + meals for today. */
export const GET = apiRoute(async (_req, { actor }) => {
  const safe = async <T,>(p: Promise<T>) => {
    try {
      return await p;
    } catch (e) {
      if (e instanceof ForbiddenError) return null;
      throw e;
    }
  };
  const workout = await safe(getTodayWorkout(actor));
  const meals = await safe(getTodayMeals(actor));
  return {
    date: workout?.today ?? meals?.today,
    workout: workout ? { log: workout.log, week: workout.week } : null,
    meals: meals ? meals.logs : null,
  };
}, { role: "client" });
