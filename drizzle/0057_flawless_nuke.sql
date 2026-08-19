CREATE TABLE `algorithmOutcomeObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcomeKey` varchar(220) NOT NULL,
	`provenanceId` int NOT NULL,
	`horizonTradingDays` int NOT NULL,
	`observedAt` timestamp NOT NULL,
	`outcomeJson` text NOT NULL,
	`provenanceJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `algorithmOutcomeObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `algorithmOutcomeObservations_outcomeKey_unique` UNIQUE(`outcomeKey`)
);
--> statement-breakpoint
CREATE TABLE `algorithmScoreProvenance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`observationKey` varchar(160) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`engineVersion` varchar(64) NOT NULL,
	`formulaHash` varchar(128) NOT NULL,
	`pressureIndex` int NOT NULL,
	`regime` varchar(80) NOT NULL,
	`formulaJson` text NOT NULL,
	`inputManifestJson` text NOT NULL,
	`availabilityJson` text NOT NULL,
	`provenanceStatus` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `algorithmScoreProvenance_id` PRIMARY KEY(`id`),
	CONSTRAINT `algorithmScoreProvenance_observationKey_unique` UNIQUE(`observationKey`)
);
--> statement-breakpoint
ALTER TABLE `algorithmOutcomeObservations` ADD CONSTRAINT `algorithmOutcomeObservations_provenanceId_algorithmScoreProvenance_id_fk` FOREIGN KEY (`provenanceId`) REFERENCES `algorithmScoreProvenance`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `algorithmOutcomeObservations_provenance_horizon_idx` ON `algorithmOutcomeObservations` (`provenanceId`,`horizonTradingDays`);--> statement-breakpoint
CREATE INDEX `algorithmOutcomeObservations_observedAt_idx` ON `algorithmOutcomeObservations` (`observedAt`);--> statement-breakpoint
CREATE INDEX `algorithmScoreProvenance_observedAt_idx` ON `algorithmScoreProvenance` (`observedAt`);--> statement-breakpoint
CREATE INDEX `algorithmScoreProvenance_regime_idx` ON `algorithmScoreProvenance` (`regime`);