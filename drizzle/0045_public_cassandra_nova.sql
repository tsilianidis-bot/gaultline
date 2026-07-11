CREATE TABLE `marketMemory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoryKey` varchar(120) NOT NULL,
	`memoryValue` text NOT NULL,
	`description` varchar(255),
	`writtenBy` varchar(60),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketMemory_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketMemory_memoryKey_unique` UNIQUE(`memoryKey`)
);
--> statement-breakpoint
CREATE TABLE `seismographPatterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`detectedAt` varchar(10) NOT NULL,
	`patternType` varchar(60) NOT NULL,
	`patternName` varchar(120) NOT NULL,
	`patternDescription` text NOT NULL,
	`confidence` int NOT NULL,
	`frequency` varchar(20) NOT NULL,
	`historicalCount` int NOT NULL DEFAULT 0,
	`analogMatchesJson` text NOT NULL DEFAULT ('[]'),
	`outcomeDistributionJson` text NOT NULL DEFAULT ('{}'),
	`invalidationConditions` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`resolvedAt` varchar(10),
	`actualOutcome` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seismographPatterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seismographReadings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`readingDate` varchar(10) NOT NULL,
	`pressureScore` int NOT NULL,
	`stressLevel` varchar(20) NOT NULL,
	`regime` varchar(80) NOT NULL,
	`subScoresJson` text NOT NULL,
	`bullProbability` int,
	`crashProbability` int,
	`direction` varchar(10) NOT NULL DEFAULT 'stable',
	`deltaFromPrior` int NOT NULL DEFAULT 0,
	`streakDays` int NOT NULL DEFAULT 0,
	`historicalPercentile` int,
	`pressureDriversJson` text NOT NULL DEFAULT ('[]'),
	`activeAlertsJson` text NOT NULL DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seismographReadings_id` PRIMARY KEY(`id`),
	CONSTRAINT `seismographReadings_readingDate_unique` UNIQUE(`readingDate`)
);
--> statement-breakpoint
CREATE TABLE `seismographTransitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transitionDate` varchar(10) NOT NULL,
	`fromRegime` varchar(80) NOT NULL,
	`toRegime` varchar(80) NOT NULL,
	`pressureAtTransition` int NOT NULL,
	`confidence` int NOT NULL,
	`priorRegimeDuration` int NOT NULL DEFAULT 0,
	`explanation` text,
	`driversJson` text NOT NULL DEFAULT ('[]'),
	`historicalBaseRate` int,
	`confirmed` boolean,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seismographTransitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `market_memory_key_idx` ON `marketMemory` (`memoryKey`);--> statement-breakpoint
CREATE INDEX `seismo_patterns_detected_idx` ON `seismographPatterns` (`detectedAt`);--> statement-breakpoint
CREATE INDEX `seismo_patterns_type_idx` ON `seismographPatterns` (`patternType`);--> statement-breakpoint
CREATE INDEX `seismo_patterns_active_idx` ON `seismographPatterns` (`isActive`);--> statement-breakpoint
CREATE INDEX `seismo_readings_date_idx` ON `seismographReadings` (`readingDate`);--> statement-breakpoint
CREATE INDEX `seismo_readings_score_idx` ON `seismographReadings` (`pressureScore`);--> statement-breakpoint
CREATE INDEX `seismo_transitions_date_idx` ON `seismographTransitions` (`transitionDate`);--> statement-breakpoint
CREATE INDEX `seismo_transitions_from_idx` ON `seismographTransitions` (`fromRegime`);--> statement-breakpoint
CREATE INDEX `seismo_transitions_to_idx` ON `seismographTransitions` (`toRegime`);