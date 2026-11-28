-- Owners and admins turn staff arrivals on; the service checks the role.
GRANT UPDATE (check_in_staff_enabled) ON boxes TO guaranix_app;
--> statement-breakpoint
-- An arrival is a record of when someone came in: written once, never edited.
REVOKE UPDATE, DELETE ON staff_arrivals FROM guaranix_app;
