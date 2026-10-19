-- INERT. This is not a Drizzle migration and nothing in the application runs it.
-- Do not apply it to production. It only inserts the publication flag, default OFF.
-- Idempotent: a second run does not change an existing row and does not enable the flag.
--
-- Cron writes are a separate switch and also default off:
--   TRACK_RECORD_CRON_WRITES=true
-- Unset, empty, or any other value means the scheduled job records nothing.

INSERT INTO featureFlags (`key`, enabled, description, updatedBy)
SELECT
  'intelligence_track_record',
  0,
  'Intelligence track record publication. Default off. Inert until an operator sets enabled to 1.',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM featureFlags WHERE `key` = 'intelligence_track_record'
);
