CREATE TABLE `day_trade_snapshot` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(120) NOT NULL,
	`payload` text NOT NULL,
	`capturedAt` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `day_trade_snapshot_id` PRIMARY KEY(`id`),
	CONSTRAINT `day_trade_snapshot_cacheKey_idx` UNIQUE(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_health_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`provider` varchar(40) NOT NULL,
	`endpoint` varchar(200) NOT NULL,
	`responseCode` int,
	`latencyMs` int,
	`failureReason` text,
	`retryAttempts` int NOT NULL DEFAULT 0,
	`recoveryStatus` varchar(30),
	`resolutionTimeMs` int,
	`autoRecovered` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pipeline_health_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pipeline_health_log_provider_idx` ON `pipeline_health_log` (`provider`);--> statement-breakpoint
CREATE INDEX `pipeline_health_log_createdAt_idx` ON `pipeline_health_log` (`createdAt`);