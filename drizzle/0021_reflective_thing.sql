CREATE TABLE `simPortfolioAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountType` enum('stocks','crypto') NOT NULL,
	`startingCapital` decimal(14,2) NOT NULL DEFAULT '10000.00',
	`cashBalance` decimal(14,2) NOT NULL DEFAULT '10000.00',
	`startedAt` varchar(12) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `simPortfolioAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `simPortfolioAccounts_accountType_unique` UNIQUE(`accountType`)
);
--> statement-breakpoint
CREATE TABLE `simPortfolioJournal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(12) NOT NULL,
	`pressureScore` int,
	`regime` varchar(80),
	`totalValue` decimal(14,2),
	`stocksValue` decimal(14,2),
	`cryptoValue` decimal(14,2),
	`dailyPnl` decimal(14,2),
	`dailyPnlPct` decimal(8,4),
	`journalEntry` text NOT NULL,
	`holdingsJson` text,
	`tradesJson` text,
	`tradesMade` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simPortfolioJournal_id` PRIMARY KEY(`id`),
	CONSTRAINT `simPortfolioJournal_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `simPortfolioPositions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`ticker` varchar(16) NOT NULL,
	`name` varchar(128),
	`assetType` enum('stock','crypto') NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`entryPrice` decimal(14,6) NOT NULL,
	`totalCost` decimal(14,2) NOT NULL,
	`currentPrice` decimal(14,6),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`exitPrice` decimal(14,6),
	`entrySignal` varchar(128),
	`exitSignal` varchar(128),
	`entryRationale` text,
	`exitRationale` text,
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `simPortfolioPositions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simPortfolioTrades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`positionId` int,
	`ticker` varchar(16) NOT NULL,
	`assetType` enum('stock','crypto') NOT NULL,
	`action` enum('BUY','SELL') NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`price` decimal(14,6) NOT NULL,
	`totalValue` decimal(14,2) NOT NULL,
	`pressureScore` int,
	`regime` varchar(80),
	`rationale` text,
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simPortfolioTrades_id` PRIMARY KEY(`id`)
);
