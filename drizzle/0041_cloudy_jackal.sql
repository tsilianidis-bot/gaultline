CREATE TABLE `regimeAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`asset` varchar(16) NOT NULL,
	`previous` varchar(128) NOT NULL,
	`current` varchar(128) NOT NULL,
	`message` text NOT NULL,
	`whyItMatters` text NOT NULL,
	`whatToWatchNext` text NOT NULL,
	`detectedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regimeAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `regime_alerts_asset_idx` ON `regimeAlerts` (`asset`);--> statement-breakpoint
CREATE INDEX `regime_alerts_detectedAt_idx` ON `regimeAlerts` (`detectedAt`);