CREATE TABLE `ownerSimulationAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`startingCapital` decimal(14,2) NOT NULL DEFAULT '100000.00',
	`currentCash` decimal(14,2) NOT NULL DEFAULT '100000.00',
	`currentValue` decimal(14,2) NOT NULL DEFAULT '100000.00',
	`targetValue` decimal(14,2) NOT NULL DEFAULT '1000000.00',
	`startedAt` varchar(12) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ownerSimulationAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerSimulationDailySnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`date` varchar(12) NOT NULL,
	`startValue` decimal(14,2),
	`endValue` decimal(14,2),
	`dailyPnl` decimal(14,2),
	`dailyReturnPct` decimal(8,4),
	`bestTrade` varchar(128),
	`worstTrade` varchar(128),
	`aiSummary` text,
	`tradesCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownerSimulationDailySnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerSimulationObjectives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`objectiveType` varchar(32) NOT NULL,
	`assetPreference` varchar(16) NOT NULL DEFAULT 'both',
	`riskMode` varchar(16) NOT NULL DEFAULT 'balanced',
	`maxPositionSizePct` decimal(5,2) NOT NULL DEFAULT '10.00',
	`maxLossPerTrade` decimal(14,2) NOT NULL DEFAULT '2000.00',
	`timeframe` varchar(20) NOT NULL DEFAULT '1_5_days',
	`customNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownerSimulationObjectives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerSimulationPositions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`name` varchar(128),
	`assetType` enum('stock','crypto') NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`averageEntry` decimal(14,6) NOT NULL,
	`currentPrice` decimal(14,6),
	`marketValue` decimal(14,2),
	`unrealizedPnl` decimal(14,2),
	`stopLoss` decimal(14,6),
	`targetOne` decimal(14,6),
	`targetTwo` decimal(14,6),
	`objective` varchar(64),
	`pressureAtEntry` int,
	`regimeAtEntry` varchar(80),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ownerSimulationPositions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerSimulationTrades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`positionId` int,
	`symbol` varchar(20) NOT NULL,
	`assetType` enum('stock','crypto') NOT NULL,
	`side` enum('BUY','SELL','TRIM','ADD') NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`entryPrice` decimal(14,6) NOT NULL,
	`exitPrice` decimal(14,6),
	`notionalValue` decimal(14,2) NOT NULL,
	`realizedPnl` decimal(14,2),
	`stopLoss` decimal(14,6),
	`targetOne` decimal(14,6),
	`targetTwo` decimal(14,6),
	`faultlineScoreAtEntry` int,
	`pressureIndexAtEntry` int,
	`regimeAtEntry` varchar(80),
	`bullBearAtEntry` varchar(40),
	`objective` varchar(64),
	`rationale` text,
	`status` enum('open','closed','watchlist','rejected') NOT NULL DEFAULT 'open',
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `ownerSimulationTrades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `simPortfolioAccounts` DROP INDEX `simPortfolioAccounts_accountType_unique`;--> statement-breakpoint
ALTER TABLE `simPortfolioAccounts` ADD `accountLabel` varchar(32) DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `ownerSimulationAccounts` ADD CONSTRAINT `ownerSimulationAccounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;