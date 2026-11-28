CREATE TYPE "public"."brodi_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."brodi_summary_source" AS ENUM('ai', 'template');--> statement-breakpoint
ALTER TYPE "public"."feature_flag" ADD VALUE 'brodi';--> statement-breakpoint
CREATE TABLE "brodi_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "brodi_message_role" NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "brodi_messages_content_length" CHECK (char_length("brodi_messages"."content") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "brodi_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brodi_weekly_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"week_start" date NOT NULL,
	"source" "brodi_summary_source" NOT NULL,
	"summary" text NOT NULL,
	"figures" jsonb NOT NULL,
	CONSTRAINT "brodi_weekly_summaries_box_id_week_start_unique" UNIQUE("box_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "brodi_weekly_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brodi_messages" ADD CONSTRAINT "brodi_messages_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brodi_messages" ADD CONSTRAINT "brodi_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brodi_weekly_summaries" ADD CONSTRAINT "brodi_weekly_summaries_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brodi_messages_box_id_user_id_created_at_idx" ON "brodi_messages" USING btree ("box_id","user_id","created_at");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "brodi_messages" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("brodi_messages"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("brodi_messages"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "brodi_weekly_summaries" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("brodi_weekly_summaries"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("brodi_weekly_summaries"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);