CREATE TABLE `decision_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(20),
	`assetType` enum('stock','crypto'),
	`verdict` varchar(32) NOT NULL,
	`opportunityScore` int NOT NULL,
	`confidence` int NOT NULL,
	`primaryDriver` text NOT NULL,
	`expectedTimeframe` varchar(64) NOT NULL,
	`queryType` varchar(32) NOT NULL,
	`outcome` enum('pending','correct','incorrect') NOT NULL DEFAULT 'pending',
	`notes` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD CONSTRAINT `decision_ledger_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `decision_ledger_userId_idx` ON `decision_ledger` (`userId`);--> statement-breakpoint
CREATE INDEX `decision_ledger_userId_date_idx` ON `decision_ledger` (`userId`,`createdAt`);