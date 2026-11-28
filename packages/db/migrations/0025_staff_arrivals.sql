CREATE TABLE "staff_arrivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"arrived_on" date NOT NULL,
	"arrived_at" timestamp with time zone NOT NULL,
	CONSTRAINT "staff_arrivals_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "staff_arrivals_one_per_day" UNIQUE("box_id","user_id","arrived_on")
);
--> statement-breakpoint
ALTER TABLE "staff_arrivals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "check_in_staff_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_arrivals" ADD CONSTRAINT "staff_arrivals_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_arrivals" ADD CONSTRAINT "staff_arrivals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_arrivals_box_day_idx" ON "staff_arrivals" USING btree ("box_id","arrived_on");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "staff_arrivals" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("staff_arrivals"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("staff_arrivals"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);