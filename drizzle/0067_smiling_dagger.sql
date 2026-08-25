CREATE TABLE `candidateDetectionObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`observationKey` varchar(220) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`observationType` varchar(64) NOT NULL,
	`observationPayloadJson` text NOT NULL,
	`provenanceJson` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `candidateDetectionObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidateDetectionObservations_observationKey_unique` UNIQUE(`observationKey`)
);
--> statement-breakpoint
CREATE TABLE `candidateDetections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`candidateType` varchar(96) NOT NULL,
	`title` varchar(255) NOT NULL,
	`originalStateId` varchar(128) NOT NULL,
	`originalSynthesisId` varchar(128) NOT NULL,
	`originalEffectiveAt` timestamp NOT NULL,
	`originalPayloadJson` text NOT NULL,
	`detectorId` varchar(96) NOT NULL,
	`detectorVersion` varchar(32) NOT NULL,
	`detectorConfigVersion` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `candidateDetections_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidateDetections_candidateId_unique` UNIQUE(`candidateId`)
);
--> statement-breakpoint
CREATE INDEX `candidateDetectionObservations_candidateObserved_idx` ON `candidateDetectionObservations` (`candidateId`,`observedAt`);--> statement-breakpoint
CREATE INDEX `candidateDetectionObservations_synthesis_idx` ON `candidateDetectionObservations` (`originatingSynthesisId`);--> statement-breakpoint
CREATE INDEX `candidateDetections_state_idx` ON `candidateDetections` (`originalStateId`);--> statement-breakpoint
CREATE INDEX `candidateDetections_synthesis_idx` ON `candidateDetections` (`originalSynthesisId`);