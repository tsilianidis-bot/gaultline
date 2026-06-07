CREATE TABLE `userMarketAwarenessActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`actionKey` varchar(80) NOT NULL,
	`sourcePage` varchar(80),
	`metadata` text,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userMarketAwarenessActions_id` PRIMARY KEY(`id`)
);
