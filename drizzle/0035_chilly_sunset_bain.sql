CREATE TABLE `daily_brief_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL DEFAULT '0 0 7 * * *',
	`isActive` boolean NOT NULL DEFAULT true,
	`confidenceThreshold` int NOT NULL DEFAULT 70,
	`minWordCount` int NOT NULL DEFAULT 600,
	`lastRunAt` timestamp,
	`lastRunStatus` varchar(20),
	`lastRunSlug` varchar(220),
	`lastRunError` text,
	`totalPublished` int NOT NULL DEFAULT 0,
	`totalDrafts` int NOT NULL DEFAULT 0,
	`totalSkipped` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_brief_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `daily_brief_schedule_taskUid_idx` ON `daily_brief_schedule` (`taskUid`);