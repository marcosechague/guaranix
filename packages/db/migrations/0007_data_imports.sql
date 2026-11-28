CREATE TYPE "public"."import_source" AS ENUM('spreadsheet', 'crosshero', 'ai');--> statement-breakpoint
CREATE TABLE "data_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"file_name" text NOT NULL,
	"source" "import_source" NOT NULL,
	"payload_hash" text NOT NULL,
	"summary" jsonb NOT NULL,
	CONSTRAINT "data_imports_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "data_imports_box_id_payload_hash_unique" UNIQUE("box_id","payload_hash")
);
--> statement-breakpoint
ALTER TABLE "data_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "member_plans" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_imports_box_id_created_at_idx" ON "data_imports" USING btree ("box_id","created_at");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_import_fk" FOREIGN KEY ("box_id","import_id") REFERENCES "public"."data_imports"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_plans" ADD CONSTRAINT "member_plans_import_fk" FOREIGN KEY ("box_id","import_id") REFERENCES "public"."data_imports"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_import_fk" FOREIGN KEY ("box_id","import_id") REFERENCES "public"."data_imports"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_import_fk" FOREIGN KEY ("box_id","import_id") REFERENCES "public"."data_imports"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "data_imports" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("data_imports"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("data_imports"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);