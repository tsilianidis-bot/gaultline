-- REGISTERED / ACCEPTED WAVE-2 INTEGRATION. Do not run this from application
-- startup, deploy, or manually; use only the shared ordered journal after
-- independent QA and rehearse it against an isolated restored database only.
--
-- A `generating` run and a `dispatching`/`ambiguous` delivery are intentionally
-- retained rather than retried automatically: the remote LLM/email transport may
-- already have accepted work before the process lost its local acknowledgement.
CREATE TABLE `publishingRunClaims` (
  `id` int AUTO_INCREMENT NOT NULL,
  `runKey` varchar(160) NOT NULL,
  `publishType` varchar(32) NOT NULL,
  `cycleDateEt` varchar(10) NOT NULL,
  `state` enum('claimed','generating','completed','failed','exhausted') NOT NULL,
  `attemptId` varchar(32) NOT NULL,
  `attempt` int NOT NULL,
  `leaseExpiresAt` timestamp NULL,
  `retryAfter` timestamp NULL,
  `outputStatus` varchar(16) NULL,
  `outputSlug` varchar(220) NULL,
  `failureReason` varchar(255) NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `publishingRunClaims_id` PRIMARY KEY(`id`),
  CONSTRAINT `publishingRunClaims_runKey_uniq` UNIQUE(`runKey`)
);
--> statement-breakpoint
CREATE INDEX `publishingRunClaims_state_retry_idx` ON `publishingRunClaims` (`state`,`retryAfter`);
--> statement-breakpoint
CREATE TABLE `publishingDeliveryClaims` (
  `id` int AUTO_INCREMENT NOT NULL,
  `deliveryKey` varchar(220) NOT NULL,
  `deliveryType` varchar(48) NOT NULL,
  `userId` int NOT NULL,
  `state` enum('claimed','dispatching','accepted','rejected','skipped','exhausted','ambiguous') NOT NULL,
  `attemptId` varchar(32) NOT NULL,
  `attempt` int NOT NULL,
  `leaseExpiresAt` timestamp NULL,
  `retryAfter` timestamp NULL,
  `providerAcceptedAt` timestamp NULL,
  `failureReason` varchar(255) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `publishingDeliveryClaims_id` PRIMARY KEY(`id`),
  CONSTRAINT `publishingDeliveryClaims_deliveryKey_uniq` UNIQUE(`deliveryKey`)
);
--> statement-breakpoint
CREATE INDEX `publishingDeliveryClaims_state_retry_idx` ON `publishingDeliveryClaims` (`state`,`retryAfter`);
--> statement-breakpoint
CREATE INDEX `publishingDeliveryClaims_user_delivery_idx` ON `publishingDeliveryClaims` (`userId`,`deliveryType`);
