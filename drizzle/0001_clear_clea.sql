CREATE TABLE `positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`name` varchar(120) NOT NULL,
	`shares` decimal(18,8) NOT NULL,
	`costBasis` decimal(18,4) NOT NULL,
	`assetType` enum('Stock','ETF','Crypto','Other') NOT NULL DEFAULT 'Stock',
	`notes` text,
	`openedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `positions_id` PRIMARY KEY(`id`)
);
