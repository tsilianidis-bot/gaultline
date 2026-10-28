-- Read-only checks for a production BACKUP. Do not run this against live production.
-- It does not INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE, or CREATE.
-- Expected before deploy:
--   * algo_outcome_prov_fk is present, or orphans_0076_would_delete is the
--     count 0076 would remove before adding that key.
--   * The migration role's grants include TRIGGER.
--   * Neither the migration role nor the app role has DROP or TRUNCATE.
-- Run once as the migration user and once as the app user. Read SHOW GRANTS.

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

SELECT GRANTEE, PRIVILEGE_TYPE, TABLE_SCHEMA
FROM information_schema.SCHEMA_PRIVILEGES
WHERE GRANTEE = CONCAT('''', REPLACE(CURRENT_USER(), '@', '''@'''), '''')
  AND PRIVILEGE_TYPE IN ('TRIGGER', 'DROP', 'ALL PRIVILEGES');

SELECT GRANTEE, TABLE_NAME, PRIVILEGE_TYPE
FROM information_schema.TABLE_PRIVILEGES
WHERE TABLE_SCHEMA = DATABASE()
  AND GRANTEE = CONCAT('''', REPLACE(CURRENT_USER(), '@', '''@'''), '''')
  AND PRIVILEGE_TYPE IN ('TRIGGER', 'DROP', 'TRUNCATE', 'ALL PRIVILEGES');

SHOW GRANTS FOR CURRENT_USER;
