-- Permit only the approved, versioned roster edits. Keep identifiers, codes,
-- roster keys and provisioning privileges outside runtime write authority.
GRANT UPDATE ("name", "group_id", "version", "updated_at") ON "members" TO cfp_app;
GRANT UPDATE ("name", "version") ON "groups" TO cfp_app;
