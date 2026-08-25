CREATE TABLE `earlyWarningObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`observationKey` varchar(220) NOT NULL,
	`warningId` varchar(96) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`observationType` varchar(64) NOT NULL,
	`lifecycleState` varchar(32) NOT NULL,
	`qualificationState` varchar(32) NOT NULL,
	`warningScore` int NOT NULL,
	`observationPayloadJson` text NOT NULL,
	`provenanceJson` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `earlyWarningObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `earlyWarningObservations_observationKey_unique` UNIQUE(`observationKey`)
);
--> statement-breakpoint
CREATE TABLE `earlyWarnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warningId` varchar(96) NOT NULL,
	`candidateType` varchar(96) NOT NULL,
	`title` varchar(255) NOT NULL,
	`originalStateId` varchar(128) NOT NULL,
	`originalSynthesisId` varchar(128) NOT NULL,
	`originalEffectiveAt` timestamp NOT NULL,
	`originalScore` int NOT NULL,
	`originalLifecycleState` varchar(32) NOT NULL,
	`originalPayloadJson` text NOT NULL,
	`currentStateId` varchar(128) NOT NULL,
	`currentSynthesisId` varchar(128) NOT NULL,
	`currentScore` int NOT NULL,
	`currentLifecycleState` varchar(32) NOT NULL,
	`currentQualificationState` varchar(32) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `earlyWarnings_id` PRIMARY KEY(`id`),
	CONSTRAINT `earlyWarnings_warningId_unique` UNIQUE(`warningId`)
);
--> statement-breakpoint
CREATE INDEX `earlyWarningObservations_warningObserved_idx` ON `earlyWarningObservations` (`warningId`,`observedAt`);--> statement-breakpoint
CREATE INDEX `earlyWarningObservations_synthesis_idx` ON `earlyWarningObservations` (`originatingSynthesisId`);--> statement-breakpoint
CREATE INDEX `earlyWarnings_active_idx` ON `earlyWarnings` (`isActive`,`currentScore`);--> statement-breakpoint
CREATE INDEX `earlyWarnings_currentState_idx` ON `earlyWarnings` (`currentStateId`);--> statement-breakpoint
CREATE INDEX `earlyWarnings_currentSynthesis_idx` ON `earlyWarnings` (`currentSynthesisId`);