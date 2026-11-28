CREATE TYPE "public"."business_type" AS ENUM('functional_box', 'pilates_studio', 'combat_gym');--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "business_type" "business_type" DEFAULT 'functional_box' NOT NULL;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "extra_locations" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "platform_plans" ADD COLUMN "box_limit" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "impersonated_box_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "impersonation_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_box_id_boxes_id_fk" FOREIGN KEY ("impersonated_box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_extra_locations_non_negative" CHECK ("boxes"."extra_locations" >= 0);--> statement-breakpoint
ALTER TABLE "platform_plans" ADD CONSTRAINT "platform_plans_box_limit_positive" CHECK ("platform_plans"."box_limit" is null or "platform_plans"."box_limit" > 0);