CREATE TABLE "kpi_target_override" (
	"kpi_key" text PRIMARY KEY NOT NULL,
	"target" double precision,
	"rationale_basis" text NOT NULL,
	"rationale_note" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "kpi_target_override_updated_idx" ON "kpi_target_override" USING btree ("updated_at");