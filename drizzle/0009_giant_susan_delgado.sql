CREATE TABLE `mobileWatchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(30) NOT NULL,
	`name` varchar(120) NOT NULL,
	`type` enum('stock','crypto') NOT NULL DEFAULT 'stock',
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobileWatchlist_id` PRIMARY KEY(`id`)
);
