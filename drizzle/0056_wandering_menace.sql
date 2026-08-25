CREATE TABLE `symbolEventOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcomeKey` varchar(240) NOT NULL,
	`sourceEventType` varchar(64) NOT NULL,
	`sourceEventKey` varchar(220) NOT NULL,
	`symbol` varchar(30) NOT NULL,
	`assetClass` varchar(48) NOT NULL,
	`horizonTradingDays` int NOT NULL,
	`observedAt` timestamp NOT NULL,
	`outcomeJson` text NOT NULL,
	`provenanceJson` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `symbolEventOutcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `symbolEventOutcomes_outcomeKey_unique` UNIQUE(`outcomeKey`)
);
--> statement-breakpoint
CREATE INDEX `symbolEventOutcomes_source_event_idx` ON `symbolEventOutcomes` (`sourceEventType`,`sourceEventKey`);--> statement-breakpoint
CREATE INDEX `symbolEventOutcomes_symbol_horizon_idx` ON `symbolEventOutcomes` (`symbol`,`horizonTradingDays`);