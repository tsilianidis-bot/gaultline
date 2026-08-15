CREATE TABLE `dailyBriefSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` varchar(64) NOT NULL,
	`briefDateEt` varchar(10) NOT NULL,
	`tradingDate` varchar(10),
	`generatedAt` timestamp NOT NULL,
	`engineComputedAt` timestamp,
	`seismographComputedAt` timestamp,
	`status` enum('generating','blocked','published','draft') NOT NULL DEFAULT 'generating',
	`articleId` int,
	`promptVersion` varchar(40) NOT NULL,
	`modelVersion` varchar(80),
	`snapshotJson` text NOT NULL,
	`inputFreshnessJson` text NOT NULL,
	`validationJson` text NOT NULL,
	`warningsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyBriefSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyBriefSnapshots_snapshotId_unique` UNIQUE(`snapshotId`)
);
--> statement-breakpoint
ALTER TABLE `organicContent` ADD `briefSnapshotId` varchar(64);--> statement-breakpoint
CREATE INDEX `dailyBriefSnapshots_snapshotId_idx` ON `dailyBriefSnapshots` (`snapshotId`);--> statement-breakpoint
CREATE INDEX `dailyBriefSnapshots_briefDateEt_idx` ON `dailyBriefSnapshots` (`briefDateEt`);--> statement-breakpoint
CREATE INDEX `dailyBriefSnapshots_articleId_idx` ON `dailyBriefSnapshots` (`articleId`);--> statement-breakpoint
CREATE INDEX `organicContent_briefSnapshotId_idx` ON `organicContent` (`briefSnapshotId`);