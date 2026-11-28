ALTER TABLE "boxes" ADD COLUMN "check_in_desk_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "check_in_coach_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "check_in_wall_qr_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "boxes" ADD COLUMN "check_in_radius_meters" integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_check_in_radius_range" CHECK ("boxes"."check_in_radius_meters" between 30 and 1000);--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_coordinates_valid" CHECK (("locations"."latitude" is null and "locations"."longitude" is null) or ("locations"."latitude" between -90 and 90 and "locations"."longitude" between -180 and 180));