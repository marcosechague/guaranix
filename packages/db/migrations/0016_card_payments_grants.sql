-- Customer, card and order numbers come from this sequence inside box-scoped requests.
GRANT USAGE ON SEQUENCE provider_reference_seq TO guaranix_app;
--> statement-breakpoint
-- The processor's event log is evidence: a box can add to it but never rewrite it.
REVOKE UPDATE, DELETE ON payment_events FROM guaranix_app;
--> statement-breakpoint
-- An attempt is never deleted, so every try to move money stays on record.
REVOKE DELETE ON payment_attempts FROM guaranix_app;
