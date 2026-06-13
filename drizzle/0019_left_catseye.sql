CREATE TABLE `featureFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`description` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featureFlags_id` PRIMARY KEY(`id`),
	CONSTRAINT `featureFlags_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `pressureRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`overallPressure` int NOT NULL,
	`regime` varchar(80) NOT NULL,
	`level` varchar(20) NOT NULL,
	`dataSource` enum('live','fallback') NOT NULL,
	`vectorsJson` text NOT NULL,
	`alertsJson` text NOT NULL,
	`topAnalogJson` text NOT NULL,
	`rawInputsJson` text,
	`engineVersion` varchar(20) NOT NULL DEFAULT '1.0.0',
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pressureRuns_id` PRIMARY KEY(`id`)
);
