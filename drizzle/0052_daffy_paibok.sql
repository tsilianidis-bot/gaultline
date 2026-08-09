CREATE TABLE `shadowDailySummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`summaryDate` varchar(10) NOT NULL,
	`v1Pressure` int NOT NULL,
	`v3hPressure` int NOT NULL,
	`scoreDiff` int NOT NULL,
	`v1Regime` varchar(50),
	`v3hRegime` varchar(50),
	`regimeAgreement` boolean,
	`stlfsiRaw` decimal(8,4),
	`stlfsiZ` decimal(8,4),
	`stlfsiContribution` int,
	`largestComponentChange` varchar(200),
	`fallbackUsed` boolean DEFAULT false,
	`anomalousFlag` boolean DEFAULT false,
	`reviewRequired` boolean DEFAULT false,
	`readingCount` int NOT NULL DEFAULT 0,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shadowDailySummaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `shadowDailySummaries_summaryDate_unique` UNIQUE(`summaryDate`)
);
--> statement-breakpoint
CREATE TABLE `shadowForwardOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shadowReadingId` int NOT NULL,
	`horizon` enum('1d','5d','20d') NOT NULL,
	`dueAt` timestamp NOT NULL,
	`collectedAt` timestamp,
	`sp500ReturnPct` decimal(8,4),
	`nasdaqReturnPct` decimal(8,4),
	`vixAtOutcome` decimal(6,2),
	`stressEventOccurred` boolean DEFAULT false,
	`notes` text,
	CONSTRAINT `shadowForwardOutcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shadowModelReadings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`readingAt` timestamp NOT NULL DEFAULT (now()),
	`v1Pressure` int NOT NULL,
	`v3hPressure` int NOT NULL,
	`scoreDiff` int NOT NULL,
	`absScoreDiff` int NOT NULL,
	`v1Regime` varchar(50) NOT NULL,
	`v3hRegime` varchar(50) NOT NULL,
	`regimeAgreement` boolean NOT NULL DEFAULT true,
	`v3hLiquidityScore` int,
	`v3hCreditScore` int,
	`v3hVolatilityScore` int,
	`v3hMacroScore` int,
	`v3hBreadthScore` int,
	`v3hAiBubbleScore` int,
	`v3hStlfsiScore` int,
	`stlfsiRaw` decimal(8,4),
	`stlfsiZ` decimal(8,4),
	`flagDivergence5` boolean NOT NULL DEFAULT false,
	`flagDivergence10` boolean NOT NULL DEFAULT false,
	`flagRegimeDisagreement` boolean NOT NULL DEFAULT false,
	`flagStlfsiSpike` boolean NOT NULL DEFAULT false,
	`flagStaleStlfsi` boolean NOT NULL DEFAULT false,
	`flagFallback` boolean NOT NULL DEFAULT false,
	`engineVersion` varchar(20) DEFAULT 'v3h-1.0.0',
	CONSTRAINT `shadowModelReadings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shadowStressAnnotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventAt` timestamp NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`severity` enum('low','moderate','high','critical') NOT NULL,
	`v1AtEvent` int,
	`v3hAtEvent` int,
	`v1RegimeAtEvent` varchar(50),
	`v3hRegimeAtEvent` varchar(50),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shadowStressAnnotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `shadowForwardOutcomes` ADD CONSTRAINT `shadowForwardOutcomes_shadowReadingId_shadowModelReadings_id_fk` FOREIGN KEY (`shadowReadingId`) REFERENCES `shadowModelReadings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shadowDailySummaries_summaryDate_idx` ON `shadowDailySummaries` (`summaryDate`);--> statement-breakpoint
CREATE INDEX `shadowForwardOutcomes_shadowReadingId_idx` ON `shadowForwardOutcomes` (`shadowReadingId`);--> statement-breakpoint
CREATE INDEX `shadowForwardOutcomes_dueAt_idx` ON `shadowForwardOutcomes` (`dueAt`);--> statement-breakpoint
CREATE INDEX `shadowModelReadings_readingAt_idx` ON `shadowModelReadings` (`readingAt`);--> statement-breakpoint
CREATE INDEX `shadowModelReadings_divergence_idx` ON `shadowModelReadings` (`flagDivergence10`);--> statement-breakpoint
CREATE INDEX `shadowStressAnnotations_eventAt_idx` ON `shadowStressAnnotations` (`eventAt`);