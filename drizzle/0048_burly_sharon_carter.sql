CREATE TABLE `entitlementAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fromTier` varchar(32),
	`toTier` varchar(32) NOT NULL,
	`reason` varchar(128) NOT NULL,
	`stripeEventId` varchar(128),
	`stripeCustomerId` varchar(64),
	`stripeSubscriptionId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entitlementAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gsc_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiryDate` bigint,
	`siteUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gsc_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `gscTokens_userId_uniq` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `stripeWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeWebhookEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeWebhookEvents_eventId_uniq` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `startupPage` varchar(32) DEFAULT 'now';--> statement-breakpoint
CREATE INDEX `entitlementAuditLog_userId_idx` ON `entitlementAuditLog` (`userId`);--> statement-breakpoint
CREATE INDEX `entitlementAuditLog_createdAt_idx` ON `entitlementAuditLog` (`createdAt`);