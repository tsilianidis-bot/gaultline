CREATE TABLE `systemicRegimeModels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelVersion` varchar(64) NOT NULL,
	`modelType` varchar(64) NOT NULL,
	`pcaMethod` varchar(64) NOT NULL DEFAULT 'standard_scaler_pca',
	`nStates` int NOT NULL DEFAULT 2,
	`featureSchemaVersion` varchar(64) NOT NULL,
	`trainingStart` varchar(10),
	`trainingEnd` varchar(10),
	`approved` boolean NOT NULL DEFAULT false,
	`registryJson` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `systemicRegimeModels_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemicRegimeModels_modelVersion_uniq` UNIQUE(`modelVersion`)
);
--> statement-breakpoint
CREATE TABLE `systemicRegimeReadings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataAsOf` varchar(10) NOT NULL,
	`computedAt` timestamp NOT NULL,
	`historyClass` enum('LIVE_INFERENCE','OOS_RESEARCH') NOT NULL DEFAULT 'LIVE_INFERENCE',
	`currentRegime` varchar(32) NOT NULL,
	`systemicRiskScore` int,
	`crisisProbability` decimal(8,6),
	`stressBuildingProbability` decimal(8,6),
	`transitionProbability` decimal(8,6),
	`regimeConfidence` decimal(8,6),
	`creditStressZ` decimal(8,4),
	`volStressZ` decimal(8,4),
	`ratesStressZ` decimal(8,4),
	`pc1` decimal(10,6),
	`factorArrowsJson` text,
	`freshnessStatus` varchar(16) NOT NULL DEFAULT 'UNAVAILABLE',
	`modelVersion` varchar(64) NOT NULL,
	`modelType` varchar(64) NOT NULL,
	`payloadJson` text NOT NULL,
	`contributesToPressureIndex` boolean NOT NULL DEFAULT false,
	CONSTRAINT `systemicRegimeReadings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signalConvergenceReadings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`computedAt` timestamp NOT NULL,
	`level` varchar(16) NOT NULL,
	`deterioratingCount` int NOT NULL,
	`availableCount` int NOT NULL,
	`voteCount` int NOT NULL,
	`methodology` varchar(64) NOT NULL,
	`payloadJson` text NOT NULL,
	`contributesToPressureIndex` boolean NOT NULL DEFAULT false,
	CONSTRAINT `signalConvergenceReadings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `systemicRegimeReadings_dataAsOf_idx` ON `systemicRegimeReadings` (`dataAsOf`);--> statement-breakpoint
CREATE INDEX `systemicRegimeReadings_historyClass_idx` ON `systemicRegimeReadings` (`historyClass`);--> statement-breakpoint
CREATE INDEX `systemicRegimeReadings_computedAt_idx` ON `systemicRegimeReadings` (`computedAt`);--> statement-breakpoint
CREATE INDEX `signalConvergenceReadings_computedAt_idx` ON `signalConvergenceReadings` (`computedAt`);
