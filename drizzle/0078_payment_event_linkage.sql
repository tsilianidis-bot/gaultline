-- REGISTERED / ACCEPTED WAVE-2 INTEGRATION. Do not run from startup, deploy,
-- or manually; apply only through the ordered Drizzle journal after independent QA.
-- Additive evidence only: no users/entitlements are changed and no historical
-- payment provenance is synthesized. Registration does not authorize application,
-- deployment, provider use, customer activity, or operational action.
--
-- Origin and reversal rows are evidence. The only narrowly permitted origin
-- update completes a previously absent Checkout Session identifier after an
-- independently corroborated later signed event. Reversal rows remain fully
-- append-only and always policy_pending; any future entitlement decision must
-- use separately reviewed policy state, not rewrite this evidence.
-- MariaDB triggers cannot block TRUNCATE. The deployment role must not receive
-- DROP or TRUNCATE on these tables; this migration cannot revoke unknown roles.
CREATE TABLE `stripePaymentOrigins` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `stripeCheckoutSessionId` varchar(255),
  `stripePaymentIntentId` varchar(255) NOT NULL,
  `stripeChargeId` varchar(255) NOT NULL,
  `stripeCustomerId` varchar(255) NOT NULL,
  `amount` bigint NOT NULL,
  `currency` varchar(3) NOT NULL,
  `livemode` boolean NOT NULL,
  `sourceEventId` varchar(255) NOT NULL,
  `sourceEventCreated` bigint NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `stripePaymentOrigins_id` PRIMARY KEY(`id`),
  CONSTRAINT `stripePaymentOrigins_paymentIntent_uniq` UNIQUE(`stripePaymentIntentId`),
  CONSTRAINT `stripePaymentOrigins_charge_uniq` UNIQUE(`stripeChargeId`),
  CONSTRAINT `stripePaymentOrigins_checkoutSession_uniq` UNIQUE(`stripeCheckoutSessionId`),
  CONSTRAINT `stripePaymentOrigins_sourceEvent_uniq` UNIQUE(`sourceEventId`)
);
--> statement-breakpoint
CREATE INDEX `stripePaymentOrigins_user_idx` ON `stripePaymentOrigins` (`userId`);
--> statement-breakpoint
CREATE INDEX `stripePaymentOrigins_customer_idx` ON `stripePaymentOrigins` (`stripeCustomerId`);
--> statement-breakpoint
CREATE TRIGGER `stripePaymentOrigins_immutable_update`
BEFORE UPDATE ON `stripePaymentOrigins`
FOR EACH ROW
BEGIN
  IF NOT (
    OLD.stripeCheckoutSessionId IS NULL
    AND NEW.stripeCheckoutSessionId IS NOT NULL
    AND NEW.id <=> OLD.id
    AND NEW.userId <=> OLD.userId
    AND NEW.stripePaymentIntentId <=> OLD.stripePaymentIntentId
    AND NEW.stripeChargeId <=> OLD.stripeChargeId
    AND NEW.stripeCustomerId <=> OLD.stripeCustomerId
    AND NEW.amount <=> OLD.amount
    AND NEW.currency <=> OLD.currency
    AND NEW.livemode <=> OLD.livemode
    AND NEW.sourceEventId <=> OLD.sourceEventId
    AND NEW.sourceEventCreated <=> OLD.sourceEventCreated
    AND NEW.createdAt <=> OLD.createdAt
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stripePaymentOrigins evidence is immutable';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `stripePaymentOrigins_immutable_delete`
BEFORE DELETE ON `stripePaymentOrigins`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stripePaymentOrigins evidence is append-only';
--> statement-breakpoint
CREATE TABLE `stripePaymentReversalEvents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `stripeEventId` varchar(255) NOT NULL,
  `stripeEventType` varchar(128) NOT NULL,
  `reversalKind` varchar(16) NOT NULL,
  `providerObjectId` varchar(255),
  `stripePaymentOriginId` int NOT NULL,
  `userId` int NOT NULL,
  `stripeCheckoutSessionId` varchar(255),
  `stripePaymentIntentId` varchar(255) NOT NULL,
  `stripeChargeId` varchar(255) NOT NULL,
  `stripeCustomerId` varchar(255) NOT NULL,
  `reversalAmount` bigint NOT NULL,
  `currency` varchar(3) NOT NULL,
  `livemode` boolean NOT NULL,
  `providerStatus` varchar(64) NOT NULL,
  `eventCreated` bigint NOT NULL,
  `reconciliationState` varchar(32) NOT NULL DEFAULT 'policy_pending',
  `recordedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `stripePaymentReversalEvents_id` PRIMARY KEY(`id`),
  CONSTRAINT `stripePaymentReversalEvents_event_uniq` UNIQUE(`stripeEventId`),
  CONSTRAINT `stripePaymentReversalEvents_origin_fk` FOREIGN KEY (`stripePaymentOriginId`) REFERENCES `stripePaymentOrigins`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `stripePaymentReversalEvents_policy_pending_only` CHECK (`reconciliationState` = 'policy_pending')
);
--> statement-breakpoint
CREATE INDEX `stripePaymentReversalEvents_providerObject_idx` ON `stripePaymentReversalEvents` (`providerObjectId`);
--> statement-breakpoint
CREATE INDEX `stripePaymentReversalEvents_origin_idx` ON `stripePaymentReversalEvents` (`stripePaymentOriginId`,`eventCreated`);
--> statement-breakpoint
CREATE INDEX `stripePaymentReversalEvents_user_idx` ON `stripePaymentReversalEvents` (`userId`,`eventCreated`);
--> statement-breakpoint
CREATE TRIGGER `stripePaymentReversalEvents_immutable_update`
BEFORE UPDATE ON `stripePaymentReversalEvents`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stripePaymentReversalEvents evidence is immutable';
--> statement-breakpoint
CREATE TRIGGER `stripePaymentReversalEvents_immutable_delete`
BEFORE DELETE ON `stripePaymentReversalEvents`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stripePaymentReversalEvents evidence is append-only';
