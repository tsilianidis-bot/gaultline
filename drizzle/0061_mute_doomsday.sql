CREATE TABLE `reconstructedHistoricalFormulaVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelVersion` varchar(128) NOT NULL,
	`formulaHash` varchar(128) NOT NULL,
	`sourceCommit` varchar(96) NOT NULL,
	`policyVersion` varchar(128) NOT NULL,
	`policyPath` varchar(255) NOT NULL,
	`formulaJson` text NOT NULL,
	`status` enum('frozen','deprecated') NOT NULL DEFAULT 'frozen',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconstructedHistoricalFormulaVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconstructedHistoricalFormulaVersions_modelVersion_unique` UNIQUE(`modelVersion`)
);
--> statement-breakpoint
CREATE TABLE `reconstructedHistoricalOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcomeKey` varchar(255) NOT NULL,
	`reconstructedScoreId` int NOT NULL,
	`horizonTradingDays` int NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10),
	`forwardReturnPct` double,
	`maximumDrawdownPct` double,
	`maximumAdverseExcursionPct` double,
	`realizedVolatilityPct` double,
	`outcomeStatus` enum('COMPLETE','PENDING','UNAVAILABLE') NOT NULL,
	`outcomeJson` text NOT NULL,
	`sourceMetadataJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconstructedHistoricalOutcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconstructedHistoricalOutcomes_outcomeKey_unique` UNIQUE(`outcomeKey`)
);
--> statement-breakpoint
CREATE TABLE `reconstructedHistoricalScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scoreKey` varchar(255) NOT NULL,
	`formulaVersionId` int NOT NULL,
	`scoreMonth` varchar(7) NOT NULL,
	`scoreTimestamp` timestamp NOT NULL,
	`scoreStatus` enum('COMPLETE','INCOMPLETE','EXCLUDED') NOT NULL,
	`overallPressure` int,
	`regime` varchar(80),
	`vectorScoresJson` text NOT NULL,
	`rawInputsJson` text NOT NULL,
	`sourceObservationKeysJson` text NOT NULL,
	`qualitySummary` enum('RECONSTRUCTED_HISTORICAL','UNAVAILABLE') NOT NULL,
	`missingFlagsJson` text NOT NULL,
	`datasetChecksum` varchar(128) NOT NULL,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconstructedHistoricalScores_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconstructedHistoricalScores_scoreKey_unique` UNIQUE(`scoreKey`),
	CONSTRAINT `reconstructed_score_formula_month_idx` UNIQUE(`formulaVersionId`,`scoreMonth`)
);
--> statement-breakpoint
CREATE TABLE `reconstructedHistoricalSourceObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(255) NOT NULL,
	`seriesId` varchar(96) NOT NULL,
	`sourceClass` enum('ARCHIVED_OFFICIAL_REVISED','CURRENT_OFFICIAL_REVISED','OFFICIAL_PROXY_RECONSTRUCTED','UNAVAILABLE') NOT NULL,
	`observationDate` varchar(10) NOT NULL,
	`valueText` varchar(128),
	`valueNumeric` double,
	`publicationAvailableAt` timestamp,
	`sourceUrl` text NOT NULL,
	`transformation` text NOT NULL,
	`sourceMetadataJson` text NOT NULL,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconstructedHistoricalSourceObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconstructedHistoricalSourceObservations_sourceKey_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `reconstructedHistoricalValidationRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(160) NOT NULL,
	`formulaVersionId` int NOT NULL,
	`policyVersion` varchar(128) NOT NULL,
	`datasetChecksum` varchar(128) NOT NULL,
	`coverageJson` text NOT NULL,
	`limitationJson` text NOT NULL,
	`status` enum('IN_PROGRESS','COMPLETE','BLOCKED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconstructedHistoricalValidationRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconstructedHistoricalValidationRuns_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
ALTER TABLE `reconstructedHistoricalOutcomes` ADD CONSTRAINT `reconstructed_outcome_score_fk` FOREIGN KEY (`reconstructedScoreId`) REFERENCES `reconstructedHistoricalScores`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reconstructedHistoricalScores` ADD CONSTRAINT `reconstructed_score_formula_fk` FOREIGN KEY (`formulaVersionId`) REFERENCES `reconstructedHistoricalFormulaVersions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reconstructedHistoricalValidationRuns` ADD CONSTRAINT `reconstructed_run_formula_fk` FOREIGN KEY (`formulaVersionId`) REFERENCES `reconstructedHistoricalFormulaVersions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `reconstructed_outcome_score_horizon_idx` ON `reconstructedHistoricalOutcomes` (`reconstructedScoreId`,`horizonTradingDays`);--> statement-breakpoint
CREATE INDEX `reconstructed_outcome_status_idx` ON `reconstructedHistoricalOutcomes` (`outcomeStatus`);--> statement-breakpoint
CREATE INDEX `reconstructed_score_timestamp_idx` ON `reconstructedHistoricalScores` (`scoreTimestamp`);--> statement-breakpoint
CREATE INDEX `reconstructed_score_status_idx` ON `reconstructedHistoricalScores` (`scoreStatus`);--> statement-breakpoint
CREATE INDEX `reconstructed_source_series_date_idx` ON `reconstructedHistoricalSourceObservations` (`seriesId`,`observationDate`);--> statement-breakpoint
CREATE INDEX `reconstructed_source_class_idx` ON `reconstructedHistoricalSourceObservations` (`sourceClass`);--> statement-breakpoint
CREATE INDEX `reconstructed_run_status_idx` ON `reconstructedHistoricalValidationRuns` (`status`);