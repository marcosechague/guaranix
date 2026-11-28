CREATE TYPE "public"."notification_channel" AS ENUM('push', 'telegram', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('booking_confirmed', 'waitlist_promoted', 'class_cancelled', 'workout_published', 'membership_due', 'membership_overdue', 'staff_class_cancelled', 'staff_overdue_digest');--> statement-breakpoint
CREATE TYPE "public"."notification_topic" AS ENUM('bookings', 'workouts', 'billing', 'staff');--> statement-breakpoint
ALTER TYPE "public"."feature_flag" ADD VALUE 'whatsapp';--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient_key" text NOT NULL,
	"user_id" uuid,
	"member_id" uuid,
	"status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"status_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"address" text,
	"message" jsonb NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_deliveries_once" UNIQUE("notification_id","recipient_key","channel"),
	CONSTRAINT "notification_deliveries_whatsapp_address" CHECK ("notification_deliveries"."channel" <> 'whatsapp' or "notification_deliveries"."address" is not null)
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"topic" "notification_topic" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_topic_channel_pk" PRIMARY KEY("user_id","topic","channel")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"idempotency_key" text NOT NULL,
	"audience" jsonb NOT NULL,
	"params" jsonb NOT NULL,
	"actor_user_id" uuid,
	"expanded_at" timestamp with time zone,
	CONSTRAINT "notifications_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "notifications_box_id_idempotency_key_unique" UNIQUE("box_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_links_chatId_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "telegram_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_fk" FOREIGN KEY ("box_id","notification_id") REFERENCES "public"."notifications"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_box_id_channel_created_at_idx" ON "notification_deliveries" USING btree ("box_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_updated_at_idx" ON "notification_deliveries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "notifications_expanded_at_created_at_idx" ON "notifications" USING btree ("expanded_at","created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "telegram_link_codes_user_id_idx" ON "telegram_link_codes" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "notification_deliveries" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("notification_deliveries"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("notification_deliveries"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "deny_app_role" ON "notification_preferences" AS PERMISSIVE FOR ALL TO "guaranix_app" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "notifications" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("notifications"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("notifications"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "deny_app_role" ON "push_subscriptions" AS PERMISSIVE FOR ALL TO "guaranix_app" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "deny_app_role" ON "telegram_link_codes" AS PERMISSIVE FOR ALL TO "guaranix_app" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "deny_app_role" ON "telegram_links" AS PERMISSIVE FOR ALL TO "guaranix_app" USING (false) WITH CHECK (false);