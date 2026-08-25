CREATE TABLE `importanceQualificationEvaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluationId` varchar(128) NOT NULL,
	`candidateId` varchar(128) NOT NULL,
	`originatingStateId` varchar(128) NOT NULL,
	`originatingSynthesisId` varchar(128) NOT NULL,
	`evaluatedAt` timestamp NOT NULL,
	`importanceScore` int NOT NULL,
	`qualificationStatus` varchar(32) NOT NULL,
	`qualificationRank` int,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`factorTraceJson` text NOT NULL,
	`qualificationReasonsJson` text NOT NULL,
	`suppressionReasonsJson` text NOT NULL,
	`evidenceClaimIdsJson` text NOT NULL,
	`relationshipIdsJson` text NOT NULL,
	`limitationsJson` text NOT NULL,
	`scoringModelId` varchar(96) NOT NULL,
	`scoringModelVersion` varchar(32) NOT NULL,
	`scoringConfigVersion` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `importanceQualificationEvaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `importanceQualificationEvaluations_evaluationId_unique` UNIQUE(`evaluationId`)
);
--> statement-breakpoint
CREATE INDEX `importanceQualificationEvaluations_candidate_idx` ON `importanceQualificationEvaluations` (`candidateId`,`evaluatedAt`);--> statement-breakpoint
CREATE INDEX `importanceQualificationEvaluations_state_idx` ON `importanceQualificationEvaluations` (`originatingStateId`);--> statement-breakpoint
CREATE INDEX `importanceQualificationEvaluations_status_idx` ON `importanceQualificationEvaluations` (`qualificationStatus`,`importanceScore`);