-- Repair the 0057 foreign key so the name fits MariaDB's 64-character limit.
-- Fresh databases already create `algo_outcome_prov_fk` from the corrected 0057.
-- Drizzle does not re-run 0057 after its journal timestamp is recorded, so an
-- upgraded database still needs this idempotent rename-or-add.
-- Each statement is one COM_QUERY. User variables persist on the session.
SET @old_fk = (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'algorithmOutcomeObservations'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME <> 'algo_outcome_prov_fk'
  LIMIT 1
);--> statement-breakpoint
SET @drop_fk = IF(
  @old_fk IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `algorithmOutcomeObservations` DROP FOREIGN KEY `', REPLACE(@old_fk, '`', '``'), '`')
);--> statement-breakpoint
PREPARE faultline_drop_fk FROM @drop_fk;--> statement-breakpoint
EXECUTE faultline_drop_fk;--> statement-breakpoint
DEALLOCATE PREPARE faultline_drop_fk;--> statement-breakpoint
-- Rows whose provenance id is missing would make the short foreign key fail
-- (errno 1452). Remove only those orphans, and only when the short key is
-- not already present. A present key already forbids orphans.
SET @purge_orphans = IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'algorithmOutcomeObservations'
      AND CONSTRAINT_NAME = 'algo_outcome_prov_fk'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
  'SELECT 1',
  'DELETE o FROM `algorithmOutcomeObservations` o LEFT JOIN `algorithmScoreProvenance` p ON p.`id` = o.`provenanceId` WHERE p.`id` IS NULL'
);--> statement-breakpoint
PREPARE faultline_purge_orphans FROM @purge_orphans;--> statement-breakpoint
EXECUTE faultline_purge_orphans;--> statement-breakpoint
DEALLOCATE PREPARE faultline_purge_orphans;--> statement-breakpoint
SET @add_fk = IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'algorithmOutcomeObservations'
      AND CONSTRAINT_NAME = 'algo_outcome_prov_fk'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
  'SELECT 1',
  'ALTER TABLE `algorithmOutcomeObservations` ADD CONSTRAINT `algo_outcome_prov_fk` FOREIGN KEY (`provenanceId`) REFERENCES `algorithmScoreProvenance`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
);--> statement-breakpoint
PREPARE faultline_add_fk FROM @add_fk;--> statement-breakpoint
EXECUTE faultline_add_fk;--> statement-breakpoint
DEALLOCATE PREPARE faultline_add_fk;