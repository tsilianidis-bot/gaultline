-- NOT APPLIED. Do not run this against production or any shared database.
-- Webhook entitlement re-sync needs these objects before a deploy:
--   users.accessExpiresAt, users.entitlementRevision,
--   stripeSubscriptionCancellations (monotonic per-subscription cancellation marker
--   plus supersededEventCreated for a corroborated resume).
-- This PR only adds the file. It does not migrate any database.
ALTER TABLE `users` ADD `accessExpiresAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `entitlementRevision` int NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `stripeSubscriptionCancellations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stripeSubscriptionId` varchar(64) NOT NULL,
	`canceledEventCreated` bigint NOT NULL,
	`status` varchar(32) NOT NULL,
	`sourceEventId` varchar(128) NOT NULL,
	`userId` int,
	`supersededEventCreated` bigint NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeSubscriptionCancellations_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeSubscriptionCancellations_sub_uniq` UNIQUE(`stripeSubscriptionId`)
);
