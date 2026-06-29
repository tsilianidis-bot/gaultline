CREATE TABLE `ai_improvement_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`weekOf` varchar(10) NOT NULL,
	`reportText` text NOT NULL,
	`totalAnalyzed` int NOT NULL DEFAULT 0,
	`correctCount` int NOT NULL DEFAULT 0,
	`incorrectCount` int NOT NULL DEFAULT 0,
	`partialCount` int NOT NULL DEFAULT 0,
	`activeCount` int NOT NULL DEFAULT 0,
	`topPatterns` text,
	`weaknesses` text,
	`recommendations` text,
	`accuracyRate` double,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_improvement_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_improvement_reports_weekOf_unique` UNIQUE(`weekOf`)
);
--> statement-breakpoint
CREATE TABLE `improvement_lessons` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ledgerEntryId` int NOT NULL,
	`ticker` varchar(20),
	`assetType` varchar(20),
	`verdict` varchar(32),
	`outcome` varchar(30),
	`lessonText` text NOT NULL,
	`patternTag` varchar(60),
	`confidence` int,
	`engineSource` varchar(50),
	`regimeAtTime` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `improvement_lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `sector` varchar(40);--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `recommendationType` varchar(40);--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `engineSource` varchar(50);--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `returnPct` double;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `drawdownPct` double;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `timeToTargetHours` double;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `regimeAtTime` varchar(80);--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `marketCapCategory` varchar(20);--> statement-breakpoint
ALTER TABLE `improvement_lessons` ADD CONSTRAINT `improvement_lessons_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_improvement_reports_weekOf_idx` ON `ai_improvement_reports` (`weekOf`);--> statement-breakpoint
CREATE INDEX `improvement_lessons_userId_idx` ON `improvement_lessons` (`userId`);--> statement-breakpoint
CREATE INDEX `improvement_lessons_ledgerEntry_idx` ON `improvement_lessons` (`ledgerEntryId`);--> statement-breakpoint
CREATE INDEX `improvement_lessons_patternTag_idx` ON `improvement_lessons` (`patternTag`);--> statement-breakpoint
CREATE INDEX `improvement_lessons_engineSource_idx` ON `improvement_lessons` (`engineSource`);--> statement-breakpoint
CREATE INDEX `decision_ledger_engineSource_idx` ON `decision_ledger` (`engineSource`);--> statement-breakpoint
CREATE INDEX `decision_ledger_sector_idx` ON `decision_ledger` (`sector`);