CREATE TABLE `governedIntelligenceClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimObservationKey` varchar(220) NOT NULL,
	`stateId` varchar(96) NOT NULL,
	`claimId` varchar(160) NOT NULL,
	`claimType` enum('MODEL_PROBABILITY','HISTORICAL_FREQUENCY','ANALOG_SIMILARITY','EVIDENCE_CONFIDENCE','DERIVED_SCENARIO_SCORE','DERIVED_SCENARIO_COMPONENT','UNSUPPORTED') NOT NULL,
	`eventDefinition` text,
	`timeHorizon` varchar(128),
	`valueNumeric` double,
	`unit` varchar(64) NOT NULL,
	`sourceModel` varchar(128) NOT NULL,
	`modelVersion` varchar(96) NOT NULL,
	`methodology` text NOT NULL,
	`sampleSize` int,
	`datasetSpan` varchar(128),
	`confidence` varchar(64) NOT NULL,
	`generatedAt` timestamp NOT NULL,
	`evidenceStatus` enum('SUPPORTED','SUPPORTED_WITH_QUALIFICATION','UNSUPPORTED','UNVERIFIED','RESEARCH_ONLY') NOT NULL,
	`displayStatus` enum('PREDICTIVE_ELIGIBLE','DISPLAY_WITH_QUALIFICATION','SUPPRESS_PREDICTIVE_PRESENTATION','INTERNAL_ONLY') NOT NULL,
	`metadataJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `governedIntelligenceClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `governedIntelligenceClaims_claimObservationKey_unique` UNIQUE(`claimObservationKey`)
);
--> statement-breakpoint
CREATE TABLE `governedResearchObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`observationKey` varchar(220) NOT NULL,
	`observationVersion` varchar(96) NOT NULL,
	`historyClass` enum('live_verified','reconstructed_research','revised_data_reconstruction','proxy_reconstruction') NOT NULL,
	`observationDate` timestamp NOT NULL,
	`informationCutoff` timestamp NOT NULL,
	`inputSnapshotId` varchar(128),
	`sourceModel` varchar(128) NOT NULL,
	`modelVersion` varchar(96) NOT NULL,
	`originalStateJson` text NOT NULL,
	`originalInterpretation` text,
	`outcomeDefinition` text,
	`outcomeWindow` varchar(128),
	`sourceDataVersionsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `governedResearchObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `governedResearchObservations_observationKey_unique` UNIQUE(`observationKey`)
);
--> statement-breakpoint
CREATE TABLE `governedResearchResolutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resolutionKey` varchar(220) NOT NULL,
	`observationId` int NOT NULL,
	`resolutionVersion` varchar(96) NOT NULL,
	`outcomeValueJson` text NOT NULL,
	`resolvedAt` timestamp NOT NULL,
	`sourceDataVersionsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `governedResearchResolutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `governedResearchResolutions_resolutionKey_unique` UNIQUE(`resolutionKey`)
);
--> statement-breakpoint
CREATE TABLE `intelligenceStateManifests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stateId` varchar(96) NOT NULL,
	`generatedAt` timestamp NOT NULL,
	`championVersion` varchar(96) NOT NULL,
	`modelVersion` varchar(96) NOT NULL,
	`scoringVersion` varchar(96) NOT NULL,
	`configurationVersion` varchar(96) NOT NULL,
	`inputSnapshotId` varchar(128) NOT NULL,
	`stateHash` varchar(128) NOT NULL,
	`coherenceStatus` enum('COHERENT','EXPLICIT_MISMATCH','UNAVAILABLE') NOT NULL,
	`manifestJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligenceStateManifests_id` PRIMARY KEY(`id`),
	CONSTRAINT `intelligenceStateManifests_stateId_unique` UNIQUE(`stateId`)
);
--> statement-breakpoint
ALTER TABLE `governedResearchResolutions` ADD CONSTRAINT `governedResearchResolutions_observation_fk` FOREIGN KEY (`observationId`) REFERENCES `governedResearchObservations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `governedIntelligenceClaims_state_idx` ON `governedIntelligenceClaims` (`stateId`);--> statement-breakpoint
CREATE INDEX `governedIntelligenceClaims_claim_idx` ON `governedIntelligenceClaims` (`claimId`);--> statement-breakpoint
CREATE INDEX `governedIntelligenceClaims_status_idx` ON `governedIntelligenceClaims` (`evidenceStatus`,`displayStatus`);--> statement-breakpoint
CREATE INDEX `governedResearchObservations_observed_idx` ON `governedResearchObservations` (`observationDate`);--> statement-breakpoint
CREATE INDEX `governedResearchObservations_class_idx` ON `governedResearchObservations` (`historyClass`);--> statement-breakpoint
CREATE INDEX `governedResearchResolutions_observation_idx` ON `governedResearchResolutions` (`observationId`);--> statement-breakpoint
CREATE INDEX `governedResearchResolutions_resolved_idx` ON `governedResearchResolutions` (`resolvedAt`);--> statement-breakpoint
CREATE INDEX `intelligenceStateManifests_generatedAt_idx` ON `intelligenceStateManifests` (`generatedAt`);--> statement-breakpoint
CREATE INDEX `intelligenceStateManifests_coherence_idx` ON `intelligenceStateManifests` (`coherenceStatus`);