CREATE TABLE `risingStarEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventKey` varchar(220) NOT NULL,
	`ticker` varchar(30) NOT NULL,
	`snapshotId` int NOT NULL,
	`eventType` enum('first_qualification','score_strengthened','score_weakened','confirmation','risk_threshold','invalidation','removed') NOT NULL,
	`eventAt` timestamp NOT NULL,
	`headline` varchar(255) NOT NULL,
	`detailsJson` text NOT NULL,
	`historyClass` enum('live_verified') NOT NULL DEFAULT 'live_verified',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risingStarEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `risingStarEvents_eventKey_unique` UNIQUE(`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `risingStarHistoryJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risingStarHistoryJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `risingStarHistoryJobs_jobKey_unique` UNIQUE(`jobKey`)
);
--> statement-breakpoint
CREATE TABLE `risingStarSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotKey` varchar(180) NOT NULL,
	`ticker` varchar(30) NOT NULL,
	`assetType` enum('stock') NOT NULL DEFAULT 'stock',
	`observationType` enum('daily','engine') NOT NULL,
	`observationDate` varchar(10) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`marketDataAsOf` timestamp,
	`sourceFetchedAt` timestamp,
	`qualification` enum('qualified','watchlist') NOT NULL,
	`risingStarScore` int NOT NULL,
	`baseScore` int NOT NULL,
	`crowdingPenalty` int NOT NULL DEFAULT 0,
	`crossSignalConfidence` varchar(20) NOT NULL,
	`informationLead` varchar(20) NOT NULL,
	`crowdingRisk` varchar(20) NOT NULL,
	`price` decimal(18,6),
	`dailyChangePercent` decimal(10,4),
	`momentumScore` int NOT NULL,
	`relativeStrengthScore` int NOT NULL,
	`volumeParticipationScore` int NOT NULL,
	`riskLevel` varchar(24) NOT NULL,
	`pressureIndex` int NOT NULL,
	`marketRegime` varchar(64) NOT NULL,
	`sector` varchar(128),
	`industry` varchar(160),
	`macroContext` text,
	`evidenceJson` text NOT NULL,
	`technicalJson` text NOT NULL,
	`provenanceJson` text NOT NULL,
	`historyClass` enum('live_verified') NOT NULL DEFAULT 'live_verified',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risingStarSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `risingStarSnapshots_snapshotKey_unique` UNIQUE(`snapshotKey`)
);
--> statement-breakpoint
CREATE INDEX `risingStarEvents_ticker_event_idx` ON `risingStarEvents` (`ticker`,`eventAt`);--> statement-breakpoint
CREATE INDEX `risingStarEvents_snapshot_idx` ON `risingStarEvents` (`snapshotId`);--> statement-breakpoint
CREATE INDEX `risingStarSnapshots_ticker_observed_idx` ON `risingStarSnapshots` (`ticker`,`observedAt`);--> statement-breakpoint
CREATE INDEX `risingStarSnapshots_type_date_idx` ON `risingStarSnapshots` (`observationType`,`observationDate`);