CREATE TABLE "admin_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"source_name" text,
	"mentions_found" integer DEFAULT 0 NOT NULL,
	"mentions_new" integer DEFAULT 0 NOT NULL,
	"extracted_ok" integer DEFAULT 0 NOT NULL,
	"extracted_failed" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "crawler_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"publisher" text NOT NULL,
	"url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"pages" integer DEFAULT 1 NOT NULL,
	"schedule" text DEFAULT 'tat' NOT NULL,
	"note" text,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_user_id_admin_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_session_token_key" ON "admin_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_session_expires_idx" ON "admin_session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "crawler_run_started_idx" ON "crawler_run" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crawler_source_name_key" ON "crawler_source" USING btree ("name");--> statement-breakpoint
CREATE INDEX "crawler_source_enabled_idx" ON "crawler_source" USING btree ("enabled");