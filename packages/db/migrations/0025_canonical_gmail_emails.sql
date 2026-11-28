-- Gmail ignores dots and "+tags", so accounts are now stored and looked up in
-- that canonical form (canonicalAccountEmail in packages/shared). Existing
-- Gmail accounts are rewritten to it. When the canonical address already
-- belongs to another account, or two old spellings collide, only one row is
-- rewritten and the rest keep their spelling: merging accounts is a manual
-- decision (see docs/decisions/0017).
WITH candidates AS (
  SELECT
    id,
    regexp_replace(split_part(split_part(lower(email), '@', 1), '+', 1), '\.', '', 'g') || '@gmail.com' AS canonical
  FROM users
  WHERE lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
),
changed AS (
  SELECT DISTINCT ON (c.canonical) c.id, c.canonical
  FROM candidates c
  JOIN users u ON u.id = c.id
  WHERE u.email <> c.canonical
    AND NOT EXISTS (SELECT 1 FROM users taken WHERE taken.email = c.canonical)
  ORDER BY c.canonical, u.email_verified_at NULLS LAST, u.created_at
)
UPDATE users SET email = changed.canonical, updated_at = now()
FROM changed
WHERE users.id = changed.id;
