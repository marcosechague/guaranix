CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."feature_flag" AS ENUM('ai_import');--> statement-breakpoint
CREATE TABLE "box_feature_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature" "feature_flag" NOT NULL,
	"enabled" boolean,
	"monthly_limit" integer,
	"updated_by_user_id" uuid,
	CONSTRAINT "box_feature_overrides_box_id_feature_unique" UNIQUE("box_id","feature"),
	CONSTRAINT "box_feature_overrides_limit_non_negative" CHECK ("box_feature_overrides"."monthly_limit" is null or "box_feature_overrides"."monthly_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "box_feature_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_plan_features" (
	"platform_plan_id" uuid NOT NULL,
	"feature" "feature_flag" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"monthly_limit" integer,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_plan_features_platform_plan_id_feature_pk" PRIMARY KEY("platform_plan_id","feature"),
	CONSTRAINT "platform_plan_features_limit_non_negative" CHECK ("platform_plan_features"."monthly_limit" is null or "platform_plan_features"."monthly_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "platform_plan_features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_provider_keys" (
	"provider" "ai_provider" PRIMARY KEY NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_provider_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_single_row" CHECK ("ai_settings"."id" = 'default')
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature" "feature_flag" NOT NULL,
	"user_id" uuid,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "box_feature_overrides" ADD CONSTRAINT "box_feature_overrides_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_feature_overrides" ADD CONSTRAINT "box_feature_overrides_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_plan_features" ADD CONSTRAINT "platform_plan_features_platform_plan_id_platform_plans_id_fk" FOREIGN KEY ("platform_plan_id") REFERENCES "public"."platform_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_plan_features" ADD CONSTRAINT "platform_plan_features_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_box_id_feature_created_at_idx" ON "ai_usage" USING btree ("box_id","feature","created_at");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "box_feature_overrides" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("box_feature_overrides"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("box_feature_overrides"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "platform_plan_features_select" ON "platform_plan_features" AS PERMISSIVE FOR SELECT TO "guaranix_app" USING (true);--> statement-breakpoint
CREATE POLICY "deny_app_role" ON "ai_provider_keys" AS PERMISSIVE FOR ALL TO "guaranix_app" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "deny_app_role" ON "ai_settings" AS PERMISSIVE FOR ALL TO "guaranix_app" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ai_usage" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("ai_usage"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("ai_usage"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);