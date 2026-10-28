-- Read-only checks for a production BACKUP. Do not run this against live production.
-- It does not INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE, or CREATE.
-- Expected before deploy:
--   * algo_outcome_prov_fk is present, or orphans_0076_would_delete is the
--     count 0076 would remove before adding that key.
--   * SHOW GRANTS for the migration role includes TRIGGER.
--   * SHOW GRANTS for the app role does not include DROP or TRUNCATE,
--     including a global *.* grant.
-- Run this file twice: once as the migration user, once as the app user.
-- Read both SHOW GRANTS results. A grant of *.* includes DROP and TRUNCATE.

SELECT CONSTRAINT_NAME AS foreign_key_name
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'algorithmOutcomeObservations'
  AND CONSTRAINT_NAME = 'algo_outcome_prov_fk'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

SELECT COUNT(*) AS orphans_0076_would_delete
FROM algorithmOutcomeObservations o
LEFT JOIN algorithmScoreProvenance p ON p.id = o.provenanceId
WHERE p.id IS NULL;

-- Privilege check is SHOW GRANTS only.
-- information_schema.SCHEMA_PRIVILEGES and TABLE_PRIVILEGES omit global *.* grants,
-- so they are not the check.
-- Run this file once connected as the migration role, then again as the app role.
-- Read the SHOW GRANTS text for ON *.* as well as ON database.*.
-- Migration role: TRIGGER must appear.
-- App role: DROP and TRUNCATE must not appear, including inside ALL PRIVILEGES ON *.*.

SHOW GRANTS FOR CURRENT_USER();
SHOW GRANTS;
