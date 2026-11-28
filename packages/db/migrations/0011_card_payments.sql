CREATE TYPE "public"."payment_attempt_kind" AS ENUM('autopay', 'link');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('pending', 'approved', 'declined', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('bancard', 'mock');--> statement-breakpoint
CREATE TYPE "public"."payment_provider_environment" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TYPE "public"."saved_card_status" AS ENUM('pending', 'active', 'removed');--> statement-breakpoint
ALTER TYPE "public"."feature_flag" ADD VALUE 'card_payments';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'card';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'refunded';--> statement-breakpoint
CREATE SEQUENCE "public"."provider_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100000 CACHE 1;--> statement-breakpoint
CREATE TABLE "payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"environment" "payment_provider_environment" NOT NULL,
	"public_key" text NOT NULL,
	"encrypted_private_key" text NOT NULL,
	"private_key_hint" text NOT NULL,
	"autopay_enabled" boolean DEFAULT false NOT NULL,
	"connected_by_user_id" uuid,
	"disconnected_at" timestamp with time zone,
	CONSTRAINT "payment_accounts_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "payment_accounts_box_id_unique" UNIQUE("box_id")
);
--> statement-breakpoint
ALTER TABLE "payment_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "payment_attempt_kind" NOT NULL,
	"saved_card_id" uuid,
	"payment_link_id" uuid,
	"order_number" bigint DEFAULT nextval('provider_reference_seq') NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"amount_gs" integer NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"checkout_ref" text,
	"authorization_code" text,
	"provider_reference" text,
	"decline_code" text,
	"decline_message" text,
	"payment_id" uuid,
	"next_retry_on" date,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "payment_attempts_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "payment_attempts_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "payment_attempts_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "payment_attempts_amount_positive" CHECK ("payment_attempts"."amount_gs" > 0),
	CONSTRAINT "payment_attempts_kind_source" CHECK (("payment_attempts"."kind" = 'autopay') = ("payment_attempts"."saved_card_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"customer_ref" text DEFAULT (nextval('provider_reference_seq'))::text NOT NULL,
	CONSTRAINT "payment_customers_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "payment_customers_account_id_member_id_unique" UNIQUE("account_id","member_id"),
	CONSTRAINT "payment_customers_customer_ref_unique" UNIQUE("customer_ref")
);
--> statement-breakpoint
ALTER TABLE "payment_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"type" text NOT NULL,
	"event_key" text,
	"order_number" bigint,
	"signature_valid" boolean NOT NULL,
	"outcome" text NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"charge_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "payment_links_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "payment_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "payment_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"card_ref" text DEFAULT (nextval('provider_reference_seq'))::text NOT NULL,
	"status" "saved_card_status" DEFAULT 'pending' NOT NULL,
	"brand" text,
	"last4" text,
	"expires_on" text,
	"autopay_consent_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	CONSTRAINT "saved_cards_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "saved_cards_card_ref_unique" UNIQUE("card_ref")
);
--> statement-breakpoint
ALTER TABLE "saved_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_plans" ADD COLUMN "renewed_from_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_account_fk" FOREIGN KEY ("box_id","account_id") REFERENCES "public"."payment_accounts"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_charge_fk" FOREIGN KEY ("box_id","charge_id") REFERENCES "public"."charges"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_card_fk" FOREIGN KEY ("box_id","saved_card_id") REFERENCES "public"."saved_cards"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_link_fk" FOREIGN KEY ("box_id","payment_link_id") REFERENCES "public"."payment_links"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_fk" FOREIGN KEY ("box_id","payment_id") REFERENCES "public"."payments"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_account_fk" FOREIGN KEY ("box_id","account_id") REFERENCES "public"."payment_accounts"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_account_fk" FOREIGN KEY ("box_id","account_id") REFERENCES "public"."payment_accounts"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_charge_fk" FOREIGN KEY ("box_id","charge_id") REFERENCES "public"."charges"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_account_fk" FOREIGN KEY ("box_id","account_id") REFERENCES "public"."payment_accounts"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_customer_fk" FOREIGN KEY ("box_id","customer_id") REFERENCES "public"."payment_customers"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_autopay_number" ON "payment_attempts" USING btree ("charge_id","attempt_number") WHERE "payment_attempts"."kind" = 'autopay';--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_one_pending_autopay" ON "payment_attempts" USING btree ("charge_id") WHERE "payment_attempts"."kind" = 'autopay' and "payment_attempts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "payment_attempts_box_id_charge_id_idx" ON "payment_attempts" USING btree ("box_id","charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_account_id_event_key" ON "payment_events" USING btree ("account_id","event_key") WHERE "payment_events"."event_key" is not null;--> statement-breakpoint
CREATE INDEX "payment_events_box_id_created_at_idx" ON "payment_events" USING btree ("box_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_cards_one_active_per_member" ON "saved_cards" USING btree ("box_id","member_id") WHERE "saved_cards"."status" = 'active';--> statement-breakpoint
ALTER TABLE "member_plans" ADD CONSTRAINT "member_plans_renewed_from_id_unique" UNIQUE("renewed_from_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payment_accounts" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("payment_accounts"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("payment_accounts"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payment_attempts" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("payment_attempts"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("payment_attempts"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payment_customers" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("payment_customers"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("payment_customers"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payment_events" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("payment_events"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("payment_events"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payment_links" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("payment_links"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("payment_links"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "saved_cards" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("saved_cards"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("saved_cards"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);