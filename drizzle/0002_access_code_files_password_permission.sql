CREATE TABLE "site_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"access_code_enc" text,
	"access_version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton_chk" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"content_type" varchar(80) NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_permissions" ADD COLUMN "change_own_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
