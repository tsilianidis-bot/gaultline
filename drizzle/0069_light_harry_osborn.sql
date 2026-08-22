CREATE TABLE `earlyWarningLifecycleObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lifecycleObservationId` varchar(160) NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`qualificationEvaluationId` varchar(128) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`observedAt` timestamp NOT NULL,
	`previousLifecycleState` varchar(32),
	`newLifecycleState` varchar(32) NOT NULL,
	`importanceScore` int NOT NULL,
	`qualificationStatus` varchar(32) NOT NULL,
	`evidenceStrength` varchar(32) NOT NULL,
	`dataQuality` varchar(32) NOT NULL,
	`persistenceCount` int NOT NULL DEFAULT 0,
	`nonQualifyingCount` int NOT NULL DEFAULT 0,
	`transitionReasonCode` varchar(64) NOT NULL,
	`transitionInputsJson` text NOT NULL,
	`limitationsJson` text NOT NULL,
	`lifecycleModelId` varchar(96) NOT NULL,
	`lifecycleModelVersion` varchar(32) NOT NULL,
	`lifecycleConfigVersion` varchar(96) NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `earlyWarningLifecycleObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `earlyWarningLifecycleObservations_lifecycleObservationId_unique` UNIQUE(`lifecycleObservationId`)
);
--> statement-breakpoint
CREATE TABLE `earlyWarningLifecycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`openedAt` timestamp NOT NULL,
	`currentLifecycleState` varchar(32) NOT NULL,
	`latestObservationAt` timestamp NOT NULL,
	`latestQualificationEvaluationId` varchar(128) NOT NULL,
	`qualifyingObservationCount` int NOT NULL DEFAULT 0,
	`nonQualifyingObservationCount` int NOT NULL DEFAULT 0,
	`lifecycleModelId` varchar(96) NOT NULL,
	`lifecycleModelVersion` varchar(32) NOT NULL,
	`lifecycleConfigVersion` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `earlyWarningLifecycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `earlyWarningLifecycles_lifecycleId_unique` UNIQUE(`lifecycleId`),
	CONSTRAINT `earlyWarningLifecycles_candidateId_unique` UNIQUE(`candidateId`)
);
--> statement-breakpoint
CREATE INDEX `earlyWarningLifecycleObservations_lifecycle_idx` ON `earlyWarningLifecycleObservations` (`lifecycleId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `earlyWarningLifecycleObservations_candidate_idx` ON `earlyWarningLifecycleObservations` (`candidateId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `earlyWarningLifecycleObservations_evaluation_idx` ON `earlyWarningLifecycleObservations` (`qualificationEvaluationId`);--> statement-breakpoint
CREATE INDEX `earlyWarningLifecycleObservations_state_idx` ON `earlyWarningLifecycleObservations` (`originatingStateId`);--> statement-breakpoint
CREATE INDEX `earlyWarningLifecycles_state_idx` ON `earlyWarningLifecycles` (`currentLifecycleState`,`latestObservationAt`);--> statement-breakpoint
CREATE INDEX `earlyWarningLifecycles_origin_state_idx` ON `earlyWarningLifecycles` (`originatingStateId`);