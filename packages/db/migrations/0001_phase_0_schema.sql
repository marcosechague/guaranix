CREATE TYPE "public"."booking_status" AS ENUM('booked', 'waitlisted', 'cancelled', 'late_cancelled', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."box_role" AS ENUM('box_owner', 'box_admin', 'coach', 'reception', 'member');--> statement-breakpoint
CREATE TYPE "public"."box_status" AS ENUM('trial', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('open', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."class_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_plan_status" AS ENUM('active', 'paused', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."movement_category" AS ENUM('weightlifting', 'gymnastics', 'monostructural', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'qr');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending_review', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."plan_kind" AS ENUM('unlimited', 'weekly_limit', 'class_pack', 'drop_in');--> statement-breakpoint
CREATE TYPE "public"."scaling" AS ENUM('rx', 'scaled');--> statement-breakpoint
CREATE TYPE "public"."score_type" AS ENUM('none', 'time', 'rounds_reps', 'reps', 'load', 'distance', 'calories', 'points');--> statement-breakpoint
CREATE TYPE "public"."timer_type" AS ENUM('none', 'for_time', 'amrap', 'emom', 'tabata');--> statement-breakpoint
CREATE TYPE "public"."workout_component_kind" AS ENUM('warm_up', 'skill', 'strength', 'metcon', 'accessory', 'cool_down');--> statement-breakpoint
CREATE TABLE "boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"legal_name" text,
	"ruc" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"timezone" text DEFAULT 'America/Asuncion' NOT NULL,
	"accent_color" text,
	"logo_file_key" text,
	"status" "box_status" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"platform_plan_id" uuid,
	"booking_opens_hours_before" integer DEFAULT 168 NOT NULL,
	"booking_closes_minutes_before" integer DEFAULT 0 NOT NULL,
	"late_cancel_minutes_before" integer DEFAULT 120 NOT NULL,
	"late_cancel_consumes_credit" boolean DEFAULT true NOT NULL,
	"no_show_consumes_credit" boolean DEFAULT true NOT NULL,
	"waitlist_auto_promote" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boxes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "boxes_booking_policy_non_negative" CHECK ("boxes"."booking_opens_hours_before" > 0 and "boxes"."booking_closes_minutes_before" >= 0 and "boxes"."late_cancel_minutes_before" >= 0)
);
--> statement-breakpoint
ALTER TABLE "boxes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"monthly_price_gs" integer NOT NULL,
	"extra_location_monthly_price_gs" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_plans_code_unique" UNIQUE("code"),
	CONSTRAINT "platform_plans_prices_non_negative" CHECK ("platform_plans"."monthly_price_gs" >= 0 and "platform_plans"."extra_location_monthly_price_gs" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"full_name" text NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_has_contact" CHECK ("users"."email" is not null or "users"."phone" is not null)
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "box_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "box_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "box_users_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "box_users_box_id_user_id_unique" UNIQUE("box_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "box_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"document_number" text,
	"email" text,
	"phone" text,
	"birth_date" date,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"medical_notes" text,
	"notes" text,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_on" date DEFAULT current_date NOT NULL,
	"external_ref" text,
	CONSTRAINT "members_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "members_box_id_user_id_unique" UNIQUE("box_id","user_id"),
	CONSTRAINT "members_box_id_document_number_unique" UNIQUE("box_id","document_number")
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "member_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "member_plan_status" DEFAULT 'active' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"price_gs" integer NOT NULL,
	"classes_per_week" integer,
	"classes_remaining" integer,
	CONSTRAINT "member_plans_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "member_plans_dates_ordered" CHECK ("member_plans"."ends_on" >= "member_plans"."starts_on"),
	CONSTRAINT "member_plans_price_non_negative" CHECK ("member_plans"."price_gs" >= 0),
	CONSTRAINT "member_plans_classes_remaining_non_negative" CHECK ("member_plans"."classes_remaining" is null or "member_plans"."classes_remaining" >= 0)
);
--> statement-breakpoint
ALTER TABLE "member_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_plan_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	CONSTRAINT "plan_pauses_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "plan_pauses_dates_ordered" CHECK ("plan_pauses"."ends_on" >= "plan_pauses"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "plan_pauses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_programs" (
	"box_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	CONSTRAINT "plan_programs_plan_id_program_id_pk" PRIMARY KEY("plan_id","program_id")
);
--> statement-breakpoint
ALTER TABLE "plan_programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "plan_kind" NOT NULL,
	"price_gs" integer NOT NULL,
	"classes_per_week" integer,
	"class_count" integer,
	"duration_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "plans_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "plans_price_non_negative" CHECK ("plans"."price_gs" >= 0),
	CONSTRAINT "plans_duration_positive" CHECK ("plans"."duration_days" > 0),
	CONSTRAINT "plans_kind_limits" CHECK (case "plans"."kind"
        when 'unlimited' then "plans"."classes_per_week" is null and "plans"."class_count" is null
        when 'weekly_limit' then "plans"."classes_per_week" > 0 and "plans"."class_count" is null
        when 'class_pack' then "plans"."classes_per_week" is null and "plans"."class_count" >= 2
        when 'drop_in' then "plans"."classes_per_week" is null and "plans"."class_count" = 1
      end)
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"class_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_plan_id" uuid,
	"status" "booking_status" NOT NULL,
	"waitlist_position" integer,
	"cancelled_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	CONSTRAINT "bookings_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "bookings_class_id_member_id_unique" UNIQUE("class_id","member_id"),
	CONSTRAINT "bookings_class_id_waitlist_position_unique" UNIQUE("class_id","waitlist_position"),
	CONSTRAINT "bookings_waitlist_position_only_when_waitlisted" CHECK (("bookings"."status" = 'waitlisted') = ("bookings"."waitlist_position" is not null))
);
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "class_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"program_id" uuid NOT NULL,
	"coach_user_id" uuid,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"capacity" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	CONSTRAINT "class_schedules_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "class_schedules_weekday_valid" CHECK ("class_schedules"."weekday" between 0 and 6),
	CONSTRAINT "class_schedules_duration_positive" CHECK ("class_schedules"."duration_minutes" > 0),
	CONSTRAINT "class_schedules_capacity_positive" CHECK ("class_schedules"."capacity" > 0),
	CONSTRAINT "class_schedules_valid_range" CHECK ("class_schedules"."valid_until" is null or "class_schedules"."valid_until" >= "class_schedules"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "class_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"program_id" uuid NOT NULL,
	"schedule_id" uuid,
	"coach_user_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"status" "class_status" DEFAULT 'scheduled' NOT NULL,
	"cancellation_reason" text,
	CONSTRAINT "classes_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "classes_schedule_id_starts_at_unique" UNIQUE("schedule_id","starts_at"),
	CONSTRAINT "classes_ends_after_start" CHECK ("classes"."ends_at" > "classes"."starts_at"),
	CONSTRAINT "classes_capacity_positive" CHECK ("classes"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "programs_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "programs_box_id_name_unique" UNIQUE("box_id","name")
);
--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"category" "movement_category" NOT NULL,
	CONSTRAINT "movements_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "movements_box_id_name_unique" UNIQUE("box_id","name")
);
--> statement-breakpoint
ALTER TABLE "movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"rep_max" smallint,
	"load_grams" integer,
	"time_seconds" integer,
	"reps" integer,
	"achieved_on" date NOT NULL,
	"result_id" uuid,
	CONSTRAINT "personal_records_has_value" CHECK ("personal_records"."load_grams" is not null or "personal_records"."time_seconds" is not null or "personal_records"."reps" is not null)
);
--> statement-breakpoint
ALTER TABLE "personal_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "result_fist_bumps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "result_fist_bumps_result_id_member_id_unique" UNIQUE("result_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "result_fist_bumps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workout_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workout_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"kind" "workout_component_kind" NOT NULL,
	"title" text,
	"description" text NOT NULL,
	"score_type" "score_type" DEFAULT 'none' NOT NULL,
	"timer_type" timer_type DEFAULT 'none' NOT NULL,
	"time_cap_seconds" integer,
	"rounds" integer,
	"interval_seconds" integer,
	"work_seconds" integer,
	"rest_seconds" integer,
	"movement_id" uuid,
	CONSTRAINT "workout_components_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "workout_components_workout_id_position_unique" UNIQUE("workout_id","position"),
	CONSTRAINT "workout_components_timer_config" CHECK (case "workout_components"."timer_type"
        when 'amrap' then "workout_components"."time_cap_seconds" is not null
        when 'emom' then "workout_components"."interval_seconds" is not null and "workout_components"."rounds" is not null
        when 'tabata' then "workout_components"."work_seconds" is not null and "workout_components"."rest_seconds" is not null and "workout_components"."rounds" is not null
        else true
      end)
);
--> statement-breakpoint
ALTER TABLE "workout_components" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workout_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"component_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"scaling" "scaling" NOT NULL,
	"time_seconds" integer,
	"rounds" integer,
	"reps" integer,
	"load_grams" integer,
	"distance_meters" integer,
	"calories" integer,
	"points" integer,
	"notes" text,
	CONSTRAINT "workout_results_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "workout_results_component_id_member_id_unique" UNIQUE("component_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "workout_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"program_id" uuid NOT NULL,
	"workout_date" date NOT NULL,
	"title" text,
	"coach_notes" text,
	"published_at" timestamp with time zone,
	"created_by_user_id" uuid,
	CONSTRAINT "workouts_box_id_id_unique" UNIQUE("box_id","id")
);
--> statement-breakpoint
ALTER TABLE "workouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"member_plan_id" uuid,
	"description" text NOT NULL,
	"amount_gs" integer NOT NULL,
	"due_on" date NOT NULL,
	"status" charge_status DEFAULT 'open' NOT NULL,
	CONSTRAINT "charges_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "charges_amount_positive" CHECK ("charges"."amount_gs" > 0)
);
--> statement-breakpoint
ALTER TABLE "charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"charge_id" uuid,
	"amount_gs" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending_review' NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"reference" text,
	"receipt_file_key" text,
	"notes" text,
	"recorded_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "payments_box_id_id_unique" UNIQUE("box_id","id"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_gs" > 0),
	CONSTRAINT "payments_qr_has_receipt" CHECK ("payments"."method" <> 'qr' or "payments"."receipt_file_key" is not null),
	CONSTRAINT "payments_review_consistent" CHECK (("payments"."status" = 'pending_review') = ("payments"."reviewed_at" is null))
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"box_id" uuid,
	"actor_user_id" uuid,
	"impersonator_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_platform_plan_id_platform_plans_id_fk" FOREIGN KEY ("platform_plan_id") REFERENCES "public"."platform_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_users" ADD CONSTRAINT "box_users_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_users" ADD CONSTRAINT "box_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_box_user_fk" FOREIGN KEY ("box_id","user_id") REFERENCES "public"."box_users"("box_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_plans" ADD CONSTRAINT "member_plans_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_plans" ADD CONSTRAINT "member_plans_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_plans" ADD CONSTRAINT "member_plans_plan_fk" FOREIGN KEY ("box_id","plan_id") REFERENCES "public"."plans"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pauses" ADD CONSTRAINT "plan_pauses_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pauses" ADD CONSTRAINT "plan_pauses_member_plan_fk" FOREIGN KEY ("box_id","member_plan_id") REFERENCES "public"."member_plans"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pauses" ADD CONSTRAINT "plan_pauses_created_by_fk" FOREIGN KEY ("box_id","created_by_user_id") REFERENCES "public"."box_users"("box_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_programs" ADD CONSTRAINT "plan_programs_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_programs" ADD CONSTRAINT "plan_programs_plan_fk" FOREIGN KEY ("box_id","plan_id") REFERENCES "public"."plans"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_programs" ADD CONSTRAINT "plan_programs_program_fk" FOREIGN KEY ("box_id","program_id") REFERENCES "public"."programs"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_class_fk" FOREIGN KEY ("box_id","class_id") REFERENCES "public"."classes"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_plan_fk" FOREIGN KEY ("box_id","member_plan_id") REFERENCES "public"."member_plans"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_program_fk" FOREIGN KEY ("box_id","program_id") REFERENCES "public"."programs"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_coach_fk" FOREIGN KEY ("box_id","coach_user_id") REFERENCES "public"."box_users"("box_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_program_fk" FOREIGN KEY ("box_id","program_id") REFERENCES "public"."programs"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_schedule_fk" FOREIGN KEY ("box_id","schedule_id") REFERENCES "public"."class_schedules"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_coach_fk" FOREIGN KEY ("box_id","coach_user_id") REFERENCES "public"."box_users"("box_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_movement_fk" FOREIGN KEY ("box_id","movement_id") REFERENCES "public"."movements"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_result_fk" FOREIGN KEY ("box_id","result_id") REFERENCES "public"."workout_results"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_fist_bumps" ADD CONSTRAINT "result_fist_bumps_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_fist_bumps" ADD CONSTRAINT "result_fist_bumps_result_fk" FOREIGN KEY ("box_id","result_id") REFERENCES "public"."workout_results"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_fist_bumps" ADD CONSTRAINT "result_fist_bumps_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_components" ADD CONSTRAINT "workout_components_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_components" ADD CONSTRAINT "workout_components_workout_fk" FOREIGN KEY ("box_id","workout_id") REFERENCES "public"."workouts"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_components" ADD CONSTRAINT "workout_components_movement_fk" FOREIGN KEY ("box_id","movement_id") REFERENCES "public"."movements"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_results" ADD CONSTRAINT "workout_results_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_results" ADD CONSTRAINT "workout_results_component_fk" FOREIGN KEY ("box_id","component_id") REFERENCES "public"."workout_components"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_results" ADD CONSTRAINT "workout_results_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_program_fk" FOREIGN KEY ("box_id","program_id") REFERENCES "public"."programs"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_created_by_fk" FOREIGN KEY ("box_id","created_by_user_id") REFERENCES "public"."box_users"("box_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_member_plan_fk" FOREIGN KEY ("box_id","member_plan_id") REFERENCES "public"."member_plans"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_fk" FOREIGN KEY ("box_id","member_id") REFERENCES "public"."members"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_fk" FOREIGN KEY ("box_id","charge_id") REFERENCES "public"."charges"("box_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonator_user_id_users_id_fk" FOREIGN KEY ("impersonator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "box_users_user_id_idx" ON "box_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "members_box_id_last_name_idx" ON "members" USING btree ("box_id","last_name");--> statement-breakpoint
CREATE INDEX "member_plans_box_id_member_id_idx" ON "member_plans" USING btree ("box_id","member_id");--> statement-breakpoint
CREATE INDEX "member_plans_box_id_ends_on_idx" ON "member_plans" USING btree ("box_id","ends_on");--> statement-breakpoint
CREATE INDEX "bookings_box_id_member_id_idx" ON "bookings" USING btree ("box_id","member_id");--> statement-breakpoint
CREATE INDEX "classes_box_id_starts_at_idx" ON "classes" USING btree ("box_id","starts_at");--> statement-breakpoint
CREATE INDEX "personal_records_box_id_member_id_movement_id_idx" ON "personal_records" USING btree ("box_id","member_id","movement_id");--> statement-breakpoint
CREATE INDEX "workout_results_box_id_member_id_idx" ON "workout_results" USING btree ("box_id","member_id");--> statement-breakpoint
CREATE INDEX "workouts_box_id_workout_date_idx" ON "workouts" USING btree ("box_id","workout_date");--> statement-breakpoint
CREATE INDEX "charges_box_id_status_due_on_idx" ON "charges" USING btree ("box_id","status","due_on");--> statement-breakpoint
CREATE INDEX "payments_box_id_paid_at_idx" ON "payments" USING btree ("box_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_box_id_member_id_idx" ON "payments" USING btree ("box_id","member_id");--> statement-breakpoint
CREATE INDEX "audit_logs_box_id_created_at_idx" ON "audit_logs" USING btree ("box_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE POLICY "boxes_select_own" ON "boxes" AS PERMISSIVE FOR SELECT TO "guaranix_app" USING ("boxes"."id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "boxes_update_own" ON "boxes" AS PERMISSIVE FOR UPDATE TO "guaranix_app" USING ("boxes"."id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("boxes"."id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "users_select_linked" ON "users" AS PERMISSIVE FOR SELECT TO "guaranix_app" USING ("users"."id" = nullif(current_setting('app.user_id', true), '')::uuid or exists (select 1 from box_users where box_users.user_id = "users"."id"));--> statement-breakpoint
CREATE POLICY "users_update_self" ON "users" AS PERMISSIVE FOR UPDATE TO "guaranix_app" USING ("users"."id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("users"."id" = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "box_users" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("box_users"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("box_users"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "members" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("members"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("members"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_plans" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("member_plans"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("member_plans"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_pauses" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("plan_pauses"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("plan_pauses"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_programs" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("plan_programs"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("plan_programs"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plans" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("plans"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("plans"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "bookings" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("bookings"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("bookings"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "class_schedules" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("class_schedules"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("class_schedules"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "classes" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("classes"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("classes"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "programs" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("programs"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("programs"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "movements" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("movements"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("movements"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "personal_records" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("personal_records"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("personal_records"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "result_fist_bumps" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("result_fist_bumps"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("result_fist_bumps"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workout_components" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("workout_components"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("workout_components"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workout_results" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("workout_results"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("workout_results"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workouts" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("workouts"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("workouts"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "charges" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("charges"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("charges"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payments" AS PERMISSIVE FOR ALL TO "guaranix_app" USING ("payments"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid) WITH CHECK ("payments"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_logs_select_own_box" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "guaranix_app" USING ("audit_logs"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_logs_insert_own_box" ON "audit_logs" AS PERMISSIVE FOR INSERT TO "guaranix_app" WITH CHECK ("audit_logs"."box_id" = nullif(current_setting('app.box_id', true), '')::uuid);