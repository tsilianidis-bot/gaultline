-- Design-only migration. Do not apply from deploy, startup, or this change.
-- Numbered 0075 because the intended deployment branch release/verified-2026-10-22
-- already uses 0072_final_recovery_controls and 0073_pressure_v2_shadow, and the
-- entitlement resync migration uses 0074. This file must not replace those.
-- Journal `when` is 1792200000000, after 0074 (1792100000000). On this branch the
-- journal idx continues after 0071. When histories merge onto the deployment
-- branch, keep this tag and this `when`, and place the entry at the next free
-- idx after 0074. Do not assign this migration over 0072_final_recovery_controls.
-- Each thesis row is immutable. Outcome notes are a separate append-only table.
-- Do not apply this against production.
CREATE TABLE `pentagonalThesisRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` varchar(64) NOT NULL,
	`scopeKind` enum('stock','sector','market') NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`thesisVersion` int NOT NULL,
	`supersedesRecordId` varchar(64),
	`engineVersion` varchar(64) NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`payloadJson` text NOT NULL,
	`generatedAt` timestamp NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pentagonalThesisRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `pentagonalThesisRecords_recordId_uniq` UNIQUE(`recordId`),
	CONSTRAINT `pentagonalThesisRecords_symbol_version_uniq` UNIQUE(`scopeKind`,`symbol`,`thesisVersion`)
);
--> statement-breakpoint
CREATE INDEX `pentagonalThesisRecords_symbol_idx` ON `pentagonalThesisRecords` (`symbol`,`recordedAt`);
--> statement-breakpoint
CREATE TRIGGER `pentagonal_thesis_records_block_update`
BEFORE UPDATE ON `pentagonalThesisRecords`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pentagonalThesisRecords is append-only';
--> statement-breakpoint
CREATE TRIGGER `pentagonal_thesis_records_block_delete`
BEFORE DELETE ON `pentagonalThesisRecords`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pentagonalThesisRecords is append-only';
--> statement-breakpoint
CREATE TABLE `pentagonalThesisOutcomeScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scoreId` varchar(64) NOT NULL,
	`recordId` varchar(64) NOT NULL,
	`notes` text,
	`scoredAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pentagonalThesisOutcomeScores_id` PRIMARY KEY(`id`),
	CONSTRAINT `pentagonalThesisOutcomeScores_scoreId_uniq` UNIQUE(`scoreId`)
);
--> statement-breakpoint
CREATE INDEX `pentagonalThesisOutcomeScores_record_idx` ON `pentagonalThesisOutcomeScores` (`recordId`,`scoredAt`);
--> statement-breakpoint
CREATE TRIGGER `pentagonal_thesis_outcomes_block_update`
BEFORE UPDATE ON `pentagonalThesisOutcomeScores`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pentagonalThesisOutcomeScores is append-only';
--> statement-breakpoint
CREATE TRIGGER `pentagonal_thesis_outcomes_block_delete`
BEFORE DELETE ON `pentagonalThesisOutcomeScores`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pentagonalThesisOutcomeScores is append-only';
