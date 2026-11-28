-- location_id starts nullable; 0018 backfills it with each box's default location and sets NOT NULL.
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "locations_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "locations_box_id_name_unique" UNIQUE("box_id","name"),
	CONSTRAINT "locations_default_is_active" CHECK (not "locations"."is_default" or "locations"."is_active")
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_locations" (
	"box_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "plan_locations_plan_id_location_id_pk" PRIMARY KEY("plan_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "plan_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "home_location_id" uuid;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_locations" ADD CONSTRAINT "plan_locations_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_locations" ADD CONSTRAINT "plan_locations_plan_fk" FOREIGN KEY ("box_id","plan_id") REFERENCES "public"."plans"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_locations" ADD CONSTRAINT "plan_locations_location_fk" FOREIGN KEY ("box_id","location_id") REFERENCES "public"."locations"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_one_default_per_box" ON "locations" USING btree ("box_id") WHERE "locations"."is_default";--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_home_location_fk" FOREIGN KEY ("box_id","home_location_id") REFERENCES "public"."locations"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_location_fk" FOREIGN KEY ("box_id","location_id") REFERENCES "public"."locations"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_location_fk" FOREIGN KEY ("box_id","location_id") REFERENCES "public"."locations"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_box_id_location_id_starts_at_idx" ON "classes" USING btree ("box_id","location_id","starts_at");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "locations" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("locations"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("locations"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_locations" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("plan_locations"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("plan_locations"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);