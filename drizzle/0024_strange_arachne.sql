CREATE TABLE `outlookHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(30) NOT NULL,
	`assetType` enum('stock','crypto') NOT NULL,
	`timeframe` enum('short','swing','long') NOT NULL DEFAULT 'swing',
	`outlookScore` int NOT NULL,
	`direction` enum('Bullish','Bearish','Neutral','Avoid') NOT NULL,
	`confidence` int NOT NULL,
	`riskLevel` enum('Low','Moderate','High','Extreme') NOT NULL,
	`pressureIndex` int NOT NULL,
	`regime` varchar(40) NOT NULL,
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outlookHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `outlookHistory_symbol_idx` ON `outlookHistory` (`symbol`);--> statement-breakpoint
CREATE INDEX `outlookHistory_symbol_time_idx` ON `outlookHistory` (`symbol`,`snapshotAt`);