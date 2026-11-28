-- A conversation with Brodi is a record of what staff asked and what they were told: append-only.
REVOKE UPDATE, DELETE ON brodi_messages FROM guaranix_app;
--> statement-breakpoint
-- A weekly summary is written once by the Monday job and never rewritten.
REVOKE UPDATE, DELETE ON brodi_weekly_summaries FROM guaranix_app;
