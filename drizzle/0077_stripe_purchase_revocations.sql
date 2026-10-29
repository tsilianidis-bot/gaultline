-- NOT APPLIED. Do not run this against production or any shared database.
-- Additive refund and dispute entitlement state for the webhook:
--   users.lifetimePaymentIntentId (which PaymentIntent funded stored lifetime)
--   entitlementAuditLog.sourceEventCreated (Stripe event.created, unix seconds)
--   stripePurchaseRevocations (one row per purchase and revocation reason)
-- This file does not drop, modify, or rewrite existing columns.
-- Validated only on a disposable database.
ALTER TABLE `users` ADD `lifetimePaymentIntentId` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `entitlementAuditLog` ADD `sourceEventCreated` bigint NULL;
--> statement-breakpoint
CREATE TABLE `stripePurchaseRevocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseKey` varchar(191) NOT NULL,
	`reasonKind` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`purchaseKind` varchar(32) NOT NULL,
	`chargeId` varchar(64) NOT NULL,
	`invoiceId` varchar(64) NULL,
	`paymentIntentId` varchar(64) NULL,
	`subscriptionId` varchar(64) NULL,
	`disputeId` varchar(64) NULL,
	`disputeOutcome` varchar(16) NULL,
	`active` tinyint NOT NULL,
	`sourceEventId` varchar(128) NOT NULL,
	`sourceEventCreated` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripePurchaseRevocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripePurchaseRevocations_purchase_reason_uniq` UNIQUE(`purchaseKey`, `reasonKind`)
);
--> statement-breakpoint
CREATE INDEX `stripePurchaseRevocations_userId_idx` ON `stripePurchaseRevocations` (`userId`);
