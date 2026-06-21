CREATE TABLE `mobileUsage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`usageDate` varchar(10) NOT NULL,
	`stockSignalsViewed` int NOT NULL DEFAULT 0,
	`cryptoSignalsViewed` int NOT NULL DEFAULT 0,
	`signalOutlooksRun` int NOT NULL DEFAULT 0,
	`situationRoomMonth` varchar(7) NOT NULL,
	`situationRoomCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mobileUsage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mobileUsage` ADD CONSTRAINT `mobileUsage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobileUsage_userId_usageDate_idx` ON `mobileUsage` (`userId`,`usageDate`);--> statement-breakpoint
CREATE INDEX `mobileUsage_userId_usageDate_uniq` ON `mobileUsage` (`userId`,`usageDate`);