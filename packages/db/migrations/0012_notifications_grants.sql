-- Push subscriptions, Telegram links and preferences belong to a person, not a
-- box; only withSystemScope services that filter by the signed-in user touch them.
REVOKE ALL ON push_subscriptions, telegram_links, telegram_link_codes, notification_preferences FROM guaranix_app;
--> statement-breakpoint
-- A box-scoped request may record an event (insert) and read its own, but only
-- the queue consumer, outside box scope, marks it expanded.
REVOKE UPDATE, DELETE ON notifications FROM guaranix_app;
--> statement-breakpoint
-- Deliveries are written by the consumer alone. A box can read its own (history,
-- WhatsApp usage) but never erase what it spent to get more quota.
REVOKE INSERT, UPDATE, DELETE ON notification_deliveries FROM guaranix_app;
