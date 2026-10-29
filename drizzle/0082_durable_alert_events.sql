-- REGISTERED / ACCEPTED WAVE-2 INTEGRATION. Do not run from startup, deploy,
-- or manually; use only the ordered journal after independent QA.
-- This is additive only: no historical events, provider readings, or delivery
-- statuses are backfilled or inferred.
--
-- MariaDB row triggers do not run for TRUNCATE. The deploy/runtime role must
-- not receive DROP or TRUNCATE on the append-only evidence tables below.
CREATE TABLE `userAlertMonitorStates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `ruleId` varchar(64) NOT NULL,
  `lastBreached` boolean NOT NULL,
  `lastValue` decimal(18,6) NULL,
  `lastFreshness` varchar(32) NOT NULL,
  `lastSource` varchar(255) NULL,
  `lastObservedAt` timestamp NULL,
  `transitionSequence` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `userAlertMonitorStates_id` PRIMARY KEY(`id`),
  CONSTRAINT `userAlertMonitorStates_user_rule_unique` UNIQUE(`userId`,`ruleId`),
  CONSTRAINT `userAlertMonitorStates_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `userAlertMonitorStates_user_updated_idx` ON `userAlertMonitorStates` (`userId`,`updatedAt`);
--> statement-breakpoint
CREATE TABLE `userAlertEvents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `eventKey` varchar(128) NOT NULL,
  `ruleId` varchar(64) NOT NULL,
  `transitionSequence` int NOT NULL,
  `category` enum('threshold_breach') NOT NULL,
  `severity` enum('critical','high','elevated','moderate') NOT NULL,
  `metric` varchar(64) NOT NULL,
  `direction` enum('above','below') NOT NULL,
  `threshold` decimal(18,6) NOT NULL,
  `observedValue` decimal(18,6) NOT NULL,
  `source` varchar(255) NOT NULL,
  `sourceObservedAt` timestamp NOT NULL,
  `dataFreshness` varchar(32) NOT NULL,
  `evidenceKind` enum('client_observed') NOT NULL DEFAULT 'client_observed',
  `deliveryStatus` enum('not_sent') NOT NULL DEFAULT 'not_sent',
  `eventAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `userAlertEvents_id` PRIMARY KEY(`id`),
  CONSTRAINT `userAlertEvents_user_event_key_unique` UNIQUE(`userId`,`eventKey`),
  -- Restricting user deletion avoids a foreign-key cascade bypass of the
  -- append-only DELETE trigger. User erasure/retention policy is not invented
  -- by this migration and requires an explicit approved evidence-preservation path.
  CONSTRAINT `userAlertEvents_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `userAlertEvents_user_event_idx` ON `userAlertEvents` (`userId`,`id`);
--> statement-breakpoint
CREATE INDEX `userAlertEvents_user_rule_event_idx` ON `userAlertEvents` (`userId`,`ruleId`,`id`);
--> statement-breakpoint
CREATE TABLE `userAlertEventAcknowledgements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventId` int NOT NULL,
  `acknowledgedAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `userAlertEventAcknowledgements_id` PRIMARY KEY(`id`),
  CONSTRAINT `userAlertEventAcknowledgements_event_unique` UNIQUE(`eventId`),
  CONSTRAINT `userAlertEventAcknowledgements_event_fk` FOREIGN KEY (`eventId`) REFERENCES `userAlertEvents`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TRIGGER `user_alert_events_append_only_update`
BEFORE UPDATE ON `userAlertEvents`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'userAlertEvents is append-only';
--> statement-breakpoint
CREATE TRIGGER `user_alert_events_append_only_delete`
BEFORE DELETE ON `userAlertEvents`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'userAlertEvents is append-only';
--> statement-breakpoint
CREATE TRIGGER `user_alert_event_acknowledgements_append_only_update`
BEFORE UPDATE ON `userAlertEventAcknowledgements`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'userAlertEventAcknowledgements is append-only';
--> statement-breakpoint
CREATE TRIGGER `user_alert_event_acknowledgements_append_only_delete`
BEFORE DELETE ON `userAlertEventAcknowledgements`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'userAlertEventAcknowledgements is append-only';
