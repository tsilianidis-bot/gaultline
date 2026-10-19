-- INERT. Not a Drizzle migration. Do not apply this file to production.
-- It is not registered in drizzle/meta/_journal.json, so drizzle-kit migrate will not run it.
-- PR #84 owns journal idx 74 (0074_pi_v2_research_private). If this protection is
-- journaled later, use idx 75 after 0074. These triggers touch only
-- governedResearchObservations and governedResearchResolutions. They do not alter
-- piV2Research* tables, marketMemory, or any other writer.
-- Current application writers INSERT and do not UPDATE or DELETE these tables.
-- A future writer that updates or deletes a protected row will fail closed.
-- Idempotent on MariaDB 10.11 / MySQL: DROP TRIGGER IF EXISTS, then CREATE.
-- Apply only on a disposable database until an operator explicitly accepts it.

DROP TRIGGER IF EXISTS governedResearchObservations_append_only_update;
DROP TRIGGER IF EXISTS governedResearchObservations_append_only_delete;
DROP TRIGGER IF EXISTS governedResearchResolutions_append_only_update;
DROP TRIGGER IF EXISTS governedResearchResolutions_append_only_delete;

CREATE TRIGGER governedResearchObservations_append_only_update
BEFORE UPDATE ON governedResearchObservations
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchObservations append-only';

CREATE TRIGGER governedResearchObservations_append_only_delete
BEFORE DELETE ON governedResearchObservations
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchObservations append-only';

CREATE TRIGGER governedResearchResolutions_append_only_update
BEFORE UPDATE ON governedResearchResolutions
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchResolutions append-only';

CREATE TRIGGER governedResearchResolutions_append_only_delete
BEFORE DELETE ON governedResearchResolutions
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchResolutions append-only';
