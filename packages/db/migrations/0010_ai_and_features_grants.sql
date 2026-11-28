-- AI keys and settings are read only by the platform and the AI runtime through
-- withSystemScope; a box-scoped request must never reach them.
REVOKE ALL ON ai_settings, ai_provider_keys FROM guaranix_app;
--> statement-breakpoint
-- Feature catalog per GuaraniX plan: readable from a box, written only by the platform.
REVOKE INSERT, UPDATE, DELETE ON platform_plan_features FROM guaranix_app;
--> statement-breakpoint
-- Per-box overrides are platform decisions; a box may read its own but not change them.
REVOKE INSERT, UPDATE, DELETE ON box_feature_overrides FROM guaranix_app;
--> statement-breakpoint
-- Usage is append-only, so a box cannot erase what it spent to get more uses.
REVOKE UPDATE, DELETE ON ai_usage FROM guaranix_app;
