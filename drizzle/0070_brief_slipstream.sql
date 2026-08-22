CREATE TABLE `phase9AuthorityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phase9EventId` varchar(160) NOT NULL,
	`planId` varchar(128) NOT NULL,
	`thesisId` varchar(128) NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`conditionEvaluationIdsJson` text NOT NULL,
	`evidenceClaimIdsJson` text NOT NULL,
	`ruleSetVersion` varchar(96) NOT NULL,
	`ruleConfigVersion` varchar(96) NOT NULL,
	`limitationsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase9AuthorityEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase9AuthorityEvents_phase9EventId_unique` UNIQUE(`phase9EventId`)
);
--> statement-breakpoint
CREATE TABLE `phase9ConditionEvaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluationId` varchar(160) NOT NULL,
	`planId` varchar(128) NOT NULL,
	`thesisId` varchar(128) NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`conditionId` varchar(128) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`status` varchar(40) NOT NULL,
	`observedValueJson` text NOT NULL,
	`requiredRuleJson` text NOT NULL,
	`dataQuality` varchar(32) NOT NULL,
	`evidenceStrength` varchar(32) NOT NULL,
	`evidenceClaimIdsJson` text NOT NULL,
	`evidenceIndependence` varchar(48) NOT NULL,
	`ruleSetVersion` varchar(96) NOT NULL,
	`ruleConfigVersion` varchar(96) NOT NULL,
	`limitationsJson` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase9ConditionEvaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase9ConditionEvaluations_evaluationId_unique` UNIQUE(`evaluationId`)
);
--> statement-breakpoint
CREATE TABLE `phase9ConfirmationPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` varchar(128) NOT NULL,
	`thesisId` varchar(128) NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`candidateType` varchar(64) NOT NULL,
	`planPayloadJson` text NOT NULL,
	`ruleModelVersion` varchar(32) NOT NULL,
	`ruleConfigVersion` varchar(96) NOT NULL,
	`ruleSetVersion` varchar(96) NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase9ConfirmationPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase9ConfirmationPlans_planId_unique` UNIQUE(`planId`)
);
--> statement-breakpoint
CREATE TABLE `phase9CurrentProjections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`planId` varchar(128) NOT NULL,
	`latestPlanEvaluationId` varchar(160) NOT NULL,
	`latestAuthorityEventId` varchar(160),
	`latestResult` varchar(64) NOT NULL,
	`latestEffectiveAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phase9CurrentProjections_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase9CurrentProjections_lifecycleId_unique` UNIQUE(`lifecycleId`)
);
--> statement-breakpoint
CREATE TABLE `phase9PlanEvaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planEvaluationId` varchar(160) NOT NULL,
	`planId` varchar(128) NOT NULL,
	`thesisId` varchar(128) NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`lifecycleState` varchar(32) NOT NULL,
	`confirmationStatus` varchar(40) NOT NULL,
	`invalidationStatus` varchar(40) NOT NULL,
	`result` varchar(64) NOT NULL,
	`conditionEvaluationIdsJson` text NOT NULL,
	`evidenceClaimIdsJson` text NOT NULL,
	`limitationsJson` text NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase9PlanEvaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase9PlanEvaluations_planEvaluationId_unique` UNIQUE(`planEvaluationId`)
);
--> statement-breakpoint
CREATE TABLE `phase9WarningTheses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thesisId` varchar(128) NOT NULL,
	`lifecycleId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`candidateType` varchar(64) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`thesisType` varchar(96) NOT NULL,
	`thesisStatementCode` varchar(160) NOT NULL,
	`thesisPayloadJson` text NOT NULL,
	`thesisModelId` varchar(96) NOT NULL,
	`thesisModelVersion` varchar(32) NOT NULL,
	`thesisConfigVersion` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase9WarningTheses_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase9WarningTheses_thesisId_unique` UNIQUE(`thesisId`),
	CONSTRAINT `phase9WarningTheses_lifecycleId_unique` UNIQUE(`lifecycleId`)
);
--> statement-breakpoint
CREATE INDEX `phase9AuthorityEvents_lifecycle_event_idx` ON `phase9AuthorityEvents` (`lifecycleId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9AuthorityEvents_plan_event_idx` ON `phase9AuthorityEvents` (`planId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9ConditionEvaluations_plan_state_idx` ON `phase9ConditionEvaluations` (`planId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9ConditionEvaluations_lifecycle_idx` ON `phase9ConditionEvaluations` (`lifecycleId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9ConfirmationPlans_lifecycle_rule_idx` ON `phase9ConfirmationPlans` (`lifecycleId`,`ruleSetVersion`,`ruleConfigVersion`);--> statement-breakpoint
CREATE INDEX `phase9ConfirmationPlans_thesis_idx` ON `phase9ConfirmationPlans` (`thesisId`);--> statement-breakpoint
CREATE INDEX `phase9CurrentProjections_plan_idx` ON `phase9CurrentProjections` (`planId`,`latestEffectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9PlanEvaluations_plan_effective_idx` ON `phase9PlanEvaluations` (`planId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9PlanEvaluations_lifecycle_effective_idx` ON `phase9PlanEvaluations` (`lifecycleId`,`effectiveAt`);--> statement-breakpoint
CREATE INDEX `phase9WarningTheses_candidate_idx` ON `phase9WarningTheses` (`candidateId`);--> statement-breakpoint
CREATE INDEX `phase9WarningTheses_state_idx` ON `phase9WarningTheses` (`originatingStateId`);