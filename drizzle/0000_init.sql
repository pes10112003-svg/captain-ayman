CREATE TYPE "public"."client_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."fitness_goal" AS ENUM('fat_loss', 'muscle_gain', 'recomposition', 'strength', 'endurance', 'general_fitness', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."length_unit" AS ENUM('cm', 'in');--> statement-breakpoint
CREATE TYPE "public"."meal_log_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."measurement_kind" AS ENUM('mass', 'length', 'percent', 'index', 'other');--> statement-breakpoint
CREATE TYPE "public"."photo_angle" AS ENUM('front', 'side', 'back', 'other');--> statement-breakpoint
CREATE TYPE "public"."set_log_status" AS ENUM('pending', 'completed', 'partial', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('coach', 'client');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TYPE "public"."workout_log_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"client_id" uuid,
	"coach_id" uuid,
	"action" varchar(60) NOT NULL,
	"entity_type" varchar(40),
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_permissions" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"view_workouts" boolean DEFAULT true NOT NULL,
	"complete_workouts" boolean DEFAULT true NOT NULL,
	"enter_actual_reps" boolean DEFAULT true NOT NULL,
	"view_nutrition" boolean DEFAULT true NOT NULL,
	"complete_meals" boolean DEFAULT true NOT NULL,
	"view_progress" boolean DEFAULT true NOT NULL,
	"view_measurements" boolean DEFAULT true NOT NULL,
	"view_photos" boolean DEFAULT true NOT NULL,
	"upload_photos" boolean DEFAULT false NOT NULL,
	"edit_personal_info" boolean DEFAULT false NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"code" varchar(16) NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"phone" varchar(32),
	"date_of_birth" date,
	"gender" "gender" DEFAULT 'unspecified' NOT NULL,
	"height_cm" numeric(5, 1),
	"starting_weight_kg" numeric(6, 2),
	"current_weight_kg" numeric(6, 2),
	"goal_weight_kg" numeric(6, 2),
	"goal" "fitness_goal" DEFAULT 'general_fitness' NOT NULL,
	"goal_note" varchar(280),
	"coach_notes" text,
	"avatar_key" varchar(255),
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"joined_on" date DEFAULT CURRENT_DATE NOT NULL,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_settings" (
	"coach_id" uuid PRIMARY KEY NOT NULL,
	"business_name" varchar(120),
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"weight_unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"length_unit" "length_unit" DEFAULT 'cm' NOT NULL,
	"week_starts_on" smallint DEFAULT 1 NOT NULL,
	"last_snapshot_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"quantity" varchar(60),
	"calories" numeric(7, 1),
	"protein" numeric(6, 1),
	"carbs" numeric(6, 1),
	"fats" numeric(6, 1),
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"plan_id" uuid,
	"meal_id" uuid,
	"meal_name" varchar(80) NOT NULL,
	"scheduled_time" time NOT NULL,
	"notes" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_calories" numeric(7, 1),
	"total_protein" numeric(6, 1),
	"total_carbs" numeric(6, 1),
	"total_fats" numeric(6, 1),
	"position" integer DEFAULT 0 NOT NULL,
	"status" "meal_log_status" DEFAULT 'pending' NOT NULL,
	"consumed_at" timestamp with time zone,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"scheduled_time" time NOT NULL,
	"notes" text,
	"reference_url" varchar(500),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid,
	"key" varchar(40) NOT NULL,
	"name" varchar(60) NOT NULL,
	"kind" "measurement_kind" NOT NULL,
	"unit" varchar(16) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"value" numeric(8, 2) NOT NULL,
	"unit" varchar(16) NOT NULL,
	"measured_on" date NOT NULL,
	"note" varchar(500),
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"content_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"thumb_key" varchar(255) NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"angle" "photo_angle" DEFAULT 'front' NOT NULL,
	"taken_on" date NOT NULL,
	"note" varchar(500),
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"workout_id" uuid,
	CONSTRAINT "workout_days_dow_chk" CHECK ("workout_days"."day_of_week" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE "workout_exercise_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_log_id" uuid NOT NULL,
	"source_exercise_id" uuid,
	"name" varchar(120) NOT NULL,
	"rest_seconds" integer,
	"tempo" varchar(20),
	"notes" text,
	"video_url" varchar(500),
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"rest_seconds" integer,
	"tempo" varchar(20),
	"notes" text,
	"video_url" varchar(500),
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"plan_id" uuid,
	"workout_id" uuid,
	"title" varchar(80) NOT NULL,
	"muscle_group" varchar(80),
	"instructions" text,
	"status" "workout_log_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completion_percent" numeric(5, 2) DEFAULT 0 NOT NULL,
	"total_sets" integer DEFAULT 0 NOT NULL,
	"completed_sets" integer DEFAULT 0 NOT NULL,
	"partial_sets" integer DEFAULT 0 NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"coach_note" text,
	"coach_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_logs_id_client_uq" UNIQUE("id","client_id"),
	CONSTRAINT "workout_logs_pct_chk" CHECK ("workout_logs"."completion_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "workout_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"content_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_set_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"workout_log_id" uuid NOT NULL,
	"exercise_log_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"target_reps" integer NOT NULL,
	"target_weight_kg" numeric(6, 2),
	"actual_reps" integer,
	"status" "set_log_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wsl_reps_chk" CHECK ("workout_set_logs"."actual_reps" IS NULL OR ("workout_set_logs"."actual_reps" >= 0 AND "workout_set_logs"."actual_reps" <= 1000))
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"target_reps" integer NOT NULL,
	"target_weight_kg" numeric(6, 2),
	CONSTRAINT "workout_sets_reps_chk" CHECK ("workout_sets"."target_reps" >= 0 AND "workout_sets"."target_reps" <= 1000)
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"muscle_group" varchar(80),
	"instructions" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_permissions" ADD CONSTRAINT "client_permissions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_permissions" ADD CONSTRAINT "client_permissions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_settings" ADD CONSTRAINT "coach_settings_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_plan_id_nutrition_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."nutrition_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_plan_id_nutrition_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."nutrition_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_types" ADD CONSTRAINT "measurement_types_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_type_id_measurement_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."measurement_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_days" ADD CONSTRAINT "workout_days_plan_id_workout_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."workout_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_days" ADD CONSTRAINT "workout_days_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise_logs" ADD CONSTRAINT "workout_exercise_logs_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise_logs" ADD CONSTRAINT "workout_exercise_logs_source_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("source_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_plan_id_workout_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."workout_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_exercise_log_id_workout_exercise_logs_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."workout_exercise_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "wsl_log_client_fk" FOREIGN KEY ("workout_log_id","client_id") REFERENCES "public"."workout_logs"("id","client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_id_workout_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."workout_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_client_created_idx" ON "activity_logs" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_coach_created_idx" ON "activity_logs" USING btree ("coach_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_user_uq" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_code_uq" ON "clients" USING btree ("code");--> statement-breakpoint
CREATE INDEX "clients_coach_idx" ON "clients" USING btree ("coach_id","status");--> statement-breakpoint
CREATE INDEX "meal_items_meal_idx" ON "meal_items" USING btree ("meal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_logs_client_date_meal_uq" ON "meal_logs" USING btree ("client_id","date","meal_id");--> statement-breakpoint
CREATE INDEX "meal_logs_client_date_idx" ON "meal_logs" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "meals_plan_idx" ON "meals" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_types_coach_key_uq" ON "measurement_types" USING btree ("coach_id","key");--> statement-breakpoint
CREATE INDEX "measurements_client_type_date_idx" ON "measurements" USING btree ("client_id","type_id","measured_on");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_plans_one_active_uq" ON "nutrition_plans" USING btree ("client_id") WHERE "nutrition_plans"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "prt_token_hash_uq" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "prt_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_photos_client_date_idx" ON "progress_photos" USING btree ("client_id","taken_on");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "workout_days_plan_dow_uq" ON "workout_days" USING btree ("plan_id","day_of_week");--> statement-breakpoint
CREATE INDEX "wel_log_idx" ON "workout_exercise_logs" USING btree ("workout_log_id");--> statement-breakpoint
CREATE INDEX "workout_exercises_workout_idx" ON "workout_exercises" USING btree ("workout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_logs_client_date_uq" ON "workout_logs" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "workout_logs_date_idx" ON "workout_logs" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_plans_one_active_uq" ON "workout_plans" USING btree ("client_id") WHERE "workout_plans"."is_active";--> statement-breakpoint
CREATE INDEX "wsl_exercise_idx" ON "workout_set_logs" USING btree ("exercise_log_id");--> statement-breakpoint
CREATE INDEX "wsl_log_idx" ON "workout_set_logs" USING btree ("workout_log_id");--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workouts_plan_idx" ON "workouts" USING btree ("plan_id");