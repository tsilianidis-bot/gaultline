CREATE TABLE `institutionalEventOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcomeKey` varchar(240) NOT NULL,
	`eventId` int NOT NULL,
	`horizonTradingDays` int NOT NULL,
	`observedAt` timestamp NOT NULL,
	`outcomeJson` text NOT NULL,
	`provenanceJson` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `institutionalEventOutcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `institutionalEventOutcomes_outcomeKey_unique` UNIQUE(`outcomeKey`)
);
--> statement-breakpoint
CREATE TABLE `institutionalEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventKey` varchar(220) NOT NULL,
	`eventType` varchar(96) NOT NULL,
	`sourceEngine` varchar(96) NOT NULL,
	`entityType` varchar(64) NOT NULL DEFAULT 'market',
	`entityId` varchar(96),
	`assetClass` varchar(48),
	`severity` enum('info','low','moderate','high','critical') NOT NULL DEFAULT 'info',
	`direction` enum('improving','deteriorating','stable','neutral') NOT NULL DEFAULT 'neutral',
	`eventAt` timestamp NOT NULL,
	`sourceObservedAt` timestamp,
	`dataFreshness` varchar(32) NOT NULL,
	`pressureIndex` int,
	`marketRegime` varchar(96),
	`magnitude` decimal(18,6),
	`relevantValue` decimal(18,6),
	`headline` varchar(255) NOT NULL,
	`explanation` text NOT NULL,
	`previousStateJson` text,
	`newStateJson` text NOT NULL,
	`supportingStateJson` text NOT NULL,
	`historyClass` enum('live_verified') NOT NULL DEFAULT 'live_verified',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `institutionalEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `institutionalEvents_eventKey_unique` UNIQUE(`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `institutionalMemoryJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(96) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`lastRunAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`lastFailureMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institutionalMemoryJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `institutionalMemoryJobs_jobKey_unique` UNIQUE(`jobKey`)
);
--> statement-breakpoint
CREATE INDEX `institutionalEventOutcomes_event_idx` ON `institutionalEventOutcomes` (`eventId`);--> statement-breakpoint
CREATE INDEX `institutionalEventOutcomes_horizon_idx` ON `institutionalEventOutcomes` (`horizonTradingDays`);--> statement-breakpoint
CREATE INDEX `institutionalEvents_eventAt_idx` ON `institutionalEvents` (`eventAt`);--> statement-breakpoint
CREATE INDEX `institutionalEvents_sourceType_idx` ON `institutionalEvents` (`sourceEngine`,`eventType`);--> statement-breakpoint
CREATE INDEX `institutionalEvents_regime_idx` ON `institutionalEvents` (`marketRegime`);--> statement-breakpoint
CREATE INDEX `institutionalEvents_severity_idx` ON `institutionalEvents` (`severity`);--> statement-breakpoint
CREATE INDEX `institutionalEvents_entity_idx` ON `institutionalEvents` (`entityType`,`entityId`);