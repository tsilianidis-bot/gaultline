CREATE TABLE `verifiedHistoricalFormulaVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelVersion` varchar(96) NOT NULL,
	`formulaHash` varchar(128) NOT NULL,
	`engineSourceHash` varchar(128) NOT NULL,
	`sourceCommit` varchar(96) NOT NULL,
	`formulaJson` text NOT NULL,
	`frozenSpecificationPath` varchar(255) NOT NULL,
	`status` enum('frozen','deprecated') NOT NULL DEFAULT 'frozen',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verifiedHistoricalFormulaVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `verifiedHistoricalFormulaVersions_modelVersion_unique` UNIQUE(`modelVersion`)
);
--> statement-breakpoint
CREATE TABLE `verifiedHistoricalOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcomeKey` varchar(255) NOT NULL,
	`verifiedScoreId` int NOT NULL,
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
	CONSTRAINT `verifiedHistoricalOutcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `verifiedHistoricalOutcomes_outcomeKey_unique` UNIQUE(`outcomeKey`),
	CONSTRAINT `verifiedHist_outcome_score_horizon_idx` UNIQUE(`verifiedScoreId`,`horizonTradingDays`)
);
--> statement-breakpoint
CREATE TABLE `verifiedHistoricalScores` (
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
	`qualitySummary` enum('POINT_IN_TIME_CONFIRMED','POINT_IN_TIME_APPROXIMATED','REVISED_HISTORICAL','UNAVAILABLE') NOT NULL,
	`missingFlagsJson` text NOT NULL,
	`datasetChecksum` varchar(128) NOT NULL,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verifiedHistoricalScores_id` PRIMARY KEY(`id`),
	CONSTRAINT `verifiedHistoricalScores_scoreKey_unique` UNIQUE(`scoreKey`),
	CONSTRAINT `verifiedHist_score_formula_month_idx` UNIQUE(`formulaVersionId`,`scoreMonth`)
);
--> statement-breakpoint
CREATE TABLE `verifiedHistoricalSourceObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(255) NOT NULL,
	`seriesId` varchar(64) NOT NULL,
	`observationDate` varchar(10) NOT NULL,
	`realtimeStart` varchar(10),
	`realtimeEnd` varchar(10),
	`valueText` varchar(128),
	`valueNumeric` double,
	`publicationAvailableAt` timestamp,
	`availabilityTimestamp` timestamp,
	`qualityClassification` enum('POINT_IN_TIME_CONFIRMED','POINT_IN_TIME_APPROXIMATED','REVISED_HISTORICAL','UNAVAILABLE') NOT NULL,
	`sourceUrl` text NOT NULL,
	`transformation` text NOT NULL,
	`sourceMetadataJson` text NOT NULL,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verifiedHistoricalSourceObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `verifiedHistoricalSourceObservations_sourceKey_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `verifiedHistoricalValidationRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(160) NOT NULL,
	`formulaVersionId` int NOT NULL,
	`scoringTimestampPolicy` text NOT NULL,
	`missingDataPolicy` text NOT NULL,
	`datasetChecksum` varchar(128) NOT NULL,
	`coverageJson` text NOT NULL,
	`partitionJson` text NOT NULL,
	`status` enum('IN_PROGRESS','COMPLETE','BLOCKED') NOT NULL,
	`limitationJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verifiedHistoricalValidationRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `verifiedHistoricalValidationRuns_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
ALTER TABLE `verifiedHistoricalOutcomes` ADD CONSTRAINT `verified_hist_outcome_score_fk` FOREIGN KEY (`verifiedScoreId`) REFERENCES `verifiedHistoricalScores`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verifiedHistoricalScores` ADD CONSTRAINT `verified_hist_score_formula_fk` FOREIGN KEY (`formulaVersionId`) REFERENCES `verifiedHistoricalFormulaVersions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verifiedHistoricalValidationRuns` ADD CONSTRAINT `verified_hist_run_formula_fk` FOREIGN KEY (`formulaVersionId`) REFERENCES `verifiedHistoricalFormulaVersions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `verifiedHist_outcome_status_idx` ON `verifiedHistoricalOutcomes` (`outcomeStatus`);--> statement-breakpoint
CREATE INDEX `verifiedHist_score_timestamp_idx` ON `verifiedHistoricalScores` (`scoreTimestamp`);--> statement-breakpoint
CREATE INDEX `verifiedHist_score_status_idx` ON `verifiedHistoricalScores` (`scoreStatus`);--> statement-breakpoint
CREATE INDEX `verifiedHist_source_series_date_idx` ON `verifiedHistoricalSourceObservations` (`seriesId`,`observationDate`);--> statement-breakpoint
CREATE INDEX `verifiedHist_source_quality_idx` ON `verifiedHistoricalSourceObservations` (`qualityClassification`);--> statement-breakpoint
CREATE INDEX `verifiedHist_run_status_idx` ON `verifiedHistoricalValidationRuns` (`status`);