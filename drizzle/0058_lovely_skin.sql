ALTER TABLE `algorithmOutcomeObservations` ADD CONSTRAINT `algo_outcome_prov_fk` FOREIGN KEY (`provenanceId`) REFERENCES `algorithmScoreProvenance`(`id`) ON DELETE cascade ON UPDATE no action;
