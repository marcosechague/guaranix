-- Login tables belong to the auth service, which runs outside box scope. The
-- default privileges from 0002 granted them to guaranix_app; take that back so a
-- box-scoped request cannot reach hashes or tokens even if a policy were wrong.
REVOKE ALL ON user_credentials, oauth_accounts, sessions, password_reset_tokens, rate_limit_counters FROM guaranix_app;
