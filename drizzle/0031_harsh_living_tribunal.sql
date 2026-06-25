CREATE TABLE `tradeJournal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`assetType` enum('stock','crypto') NOT NULL DEFAULT 'stock',
	`direction` enum('long','short') NOT NULL DEFAULT 'long',
	`entryPrice` decimal(18,6) NOT NULL,
	`exitPrice` decimal(18,6),
	`quantity` decimal(18,8) NOT NULL,
	`stopLoss` decimal(18,6),
	`target` decimal(18,6),
	`realizedPnl` decimal(18,4),
	`pnlPercent` decimal(8,4),
	`outcome` enum('win','loss','breakeven','open') NOT NULL DEFAULT 'open',
	`setupGrade` varchar(4),
	`executionScore` int,
	`notes` text,
	`tags` varchar(300),
	`followedSetup` int NOT NULL DEFAULT 0,
	`enteredAt` timestamp NOT NULL,
	`exitedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tradeJournal_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tradeJournal` ADD CONSTRAINT `tradeJournal_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tradeJournal_userId_idx` ON `tradeJournal` (`userId`);--> statement-breakpoint
CREATE INDEX `tradeJournal_userId_symbol_idx` ON `tradeJournal` (`userId`,`symbol`);--> statement-breakpoint
CREATE INDEX `tradeJournal_userId_enteredAt_idx` ON `tradeJournal` (`userId`,`enteredAt`);