-- Privileges for guaranix_app. RLS decides which rows; these grants decide which
-- tables and columns. Tables added later get the default privileges below.
GRANT USAGE ON SCHEMA public TO guaranix_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO guaranix_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO guaranix_app;
--> statement-breakpoint
-- GuaraniX's own catalog: readable, never writable from a box.
REVOKE INSERT, UPDATE, DELETE ON platform_plans FROM guaranix_app;
--> statement-breakpoint
-- Boxes are created and deleted by the platform. A box may edit its profile and
-- booking policy, but not its status, trial, plan or slug.
REVOKE INSERT, UPDATE, DELETE ON boxes FROM guaranix_app;
--> statement-breakpoint
GRANT UPDATE (
  name, legal_name, ruc, email, phone, address, city, timezone, accent_color, logo_file_key,
  booking_opens_hours_before, booking_closes_minutes_before, late_cancel_minutes_before,
  late_cancel_consumes_credit, no_show_consumes_credit, waitlist_auto_promote, updated_at
) ON boxes TO guaranix_app;
--> statement-breakpoint
-- Accounts are created by the auth service. A user may rename themselves; email,
-- phone and the platform-admin flag change only through verified flows.
REVOKE INSERT, UPDATE, DELETE ON users FROM guaranix_app;
--> statement-breakpoint
GRANT UPDATE (full_name, updated_at) ON users TO guaranix_app;
--> statement-breakpoint
-- The audit log is append-only.
REVOKE UPDATE, DELETE ON audit_logs FROM guaranix_app;
