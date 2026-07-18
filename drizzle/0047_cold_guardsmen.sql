CREATE TABLE `promoCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` varchar(255),
	`trialTier` enum('free','core','premium','founding') NOT NULL DEFAULT 'premium',
	`trialDays` int NOT NULL DEFAULT 30,
	`maxRedemptions` int NOT NULL DEFAULT 100,
	`redemptionCount` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`source` varchar(100),
	`milestones` varchar(100) DEFAULT '75,90,100',
	`milestonesNotified` text DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promoCampaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `promoCampaigns_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `promoRedemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`userId` int NOT NULL,
	`redemptionNumber` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(200),
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`trialExpiresAt` timestamp NOT NULL,
	`engaged` boolean NOT NULL DEFAULT false,
	`converted` boolean NOT NULL DEFAULT false,
	`stripeSubscriptionId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promoRedemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `promoRedemptions_userId_campaignId_uniq` UNIQUE(`userId`,`campaignId`),
	CONSTRAINT `promoRedemptions_email_campaignId_uniq` UNIQUE(`email`,`campaignId`)
);
--> statement-breakpoint
ALTER TABLE `promoRedemptions` ADD CONSTRAINT `promoRedemptions_campaignId_promoCampaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `promoCampaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promoRedemptions` ADD CONSTRAINT `promoRedemptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `promoRedemptions_campaignId_idx` ON `promoRedemptions` (`campaignId`);--> statement-breakpoint
CREATE INDEX `promoRedemptions_userId_idx` ON `promoRedemptions` (`userId`);--> statement-breakpoint
CREATE INDEX `promoRedemptions_email_idx` ON `promoRedemptions` (`email`);