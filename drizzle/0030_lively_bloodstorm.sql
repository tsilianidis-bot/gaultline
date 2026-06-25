CREATE TABLE `dayTradeWatchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`assetType` enum('stock','crypto') NOT NULL DEFAULT 'stock',
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dayTradeWatchlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `dayTradeWatchlist_user_symbol_idx` UNIQUE(`userId`,`symbol`)
);
--> statement-breakpoint
ALTER TABLE `dayTradeWatchlist` ADD CONSTRAINT `dayTradeWatchlist_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `dayTradeWatchlist_userId_idx` ON `dayTradeWatchlist` (`userId`);