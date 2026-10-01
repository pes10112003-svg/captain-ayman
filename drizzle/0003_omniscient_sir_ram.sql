CREATE TYPE "public"."photo_phase" AS ENUM('before', 'after');--> statement-breakpoint
ALTER TYPE "public"."photo_angle" ADD VALUE 'inbody' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "coach_settings" ALTER COLUMN "timezone" SET DEFAULT 'Africa/Cairo';--> statement-breakpoint
ALTER TABLE "coach_settings" ALTER COLUMN "week_starts_on" SET DEFAULT 6;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD COLUMN "phase" "photo_phase" DEFAULT 'after' NOT NULL;--> statement-breakpoint
UPDATE "coach_settings" SET "timezone" = 'Africa/Cairo', "weight_unit" = 'kg', "length_unit" = 'cm', "week_starts_on" = 6;