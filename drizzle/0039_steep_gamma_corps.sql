CREATE TABLE `demoTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`usedByIp` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demoTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `demoTokens_token_unique` UNIQUE(`token`)
);
