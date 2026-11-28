-- An import is a record of what happened, like the audit log: the app may add
-- one and read its own box's, never rewrite or delete it.
REVOKE UPDATE, DELETE ON data_imports FROM guaranix_app;
