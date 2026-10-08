DROP INDEX "workout_sets_exercise_idx";--> statement-breakpoint
ALTER TABLE "workout_logs" ADD COLUMN "week_index" smallint;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD COLUMN "week_count" smallint;--> statement-breakpoint
ALTER TABLE "workout_plans" ADD COLUMN "week_count" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_plans" ADD COLUMN "starts_on" date;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "week" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "set_count" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets" USING btree ("exercise_id","week");--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_week_chk" CHECK ("workout_sets"."week" BETWEEN 0 AND 11);--> statement-breakpoint
-- Existing plans become 3-week training sheets: week 1 keeps today's targets, weeks 2–3 start as copies.
INSERT INTO "workout_sets" ("exercise_id", "week", "set_number", "target_reps", "target_weight_kg")
SELECT s."exercise_id", w.n, s."set_number", s."target_reps", s."target_weight_kg"
FROM "workout_sets" s CROSS JOIN generate_series(1, 2) AS w(n)
WHERE s."week" = 0;--> statement-breakpoint
-- Week 1 starts on the Saturday of the current week (Egypt time).
UPDATE "workout_plans" SET "week_count" = 3, "starts_on" = ((now() AT TIME ZONE 'Africa/Cairo')::date - ((EXTRACT(DOW FROM (now() AT TIME ZONE 'Africa/Cairo'))::int + 1) % 7));--> statement-breakpoint
UPDATE "workouts" w SET "set_count" = LEAST(10, GREATEST(4, COALESCE((SELECT MAX(s."set_number") FROM "workout_sets" s JOIN "workout_exercises" e ON e."id" = s."exercise_id" WHERE e."workout_id" = w."id"), 4)));
