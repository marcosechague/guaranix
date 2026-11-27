-- Role that box-scoped requests switch to with SET LOCAL ROLE (see withBoxScope).
-- It owns nothing, so Row Level Security always applies to it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guaranix_app') THEN
    CREATE ROLE guaranix_app NOLOGIN NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint
-- Postgres 16+ does not let the creator SET ROLE to a new role unless granted.
GRANT guaranix_app TO CURRENT_USER;
