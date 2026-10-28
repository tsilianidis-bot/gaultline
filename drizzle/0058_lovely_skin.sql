-- 0057 now creates algo_outcome_prov_fk. This migration still runs on databases
-- whose 0057 did not leave that constraint (the historical 72-character name
-- cannot be created on MariaDB). It does not add a second foreign key.
SET @add_fk = IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'algorithmOutcomeObservations'
      AND CONSTRAINT_NAME = 'algo_outcome_prov_fk'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
  'SELECT 1',
  'ALTER TABLE `algorithmOutcomeObservations` ADD CONSTRAINT `algo_outcome_prov_fk` FOREIGN KEY (`provenanceId`) REFERENCES `algorithmScoreProvenance`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
);
--> statement-breakpoint
PREPARE faultline_0058_add_fk FROM @add_fk;
--> statement-breakpoint
EXECUTE faultline_0058_add_fk;
--> statement-breakpoint
DEALLOCATE PREPARE faultline_0058_add_fk;
