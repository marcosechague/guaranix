-- Owners and admins choose how attendance is marked; the service checks the role.
GRANT UPDATE (
  check_in_desk_enabled, check_in_coach_enabled, check_in_wall_qr_enabled, check_in_radius_meters
) ON boxes TO guaranix_app;
--> statement-breakpoint
-- New boxes start without the entrance tablet. A box that already checked someone in
-- since the entrance shipped (2026-11-28) keeps it; the coach list sets the same column,
-- so a box that only used the list keeps it on too, which is how it was before.
UPDATE boxes SET check_in_desk_enabled = true
WHERE EXISTS (
  SELECT 1 FROM bookings
  WHERE bookings.box_id = boxes.id AND bookings.checked_in_at >= '2026-11-28T00:00:00-03:00'
);
