-- Design-only migration. Do not apply from deploy, startup, or this change.
-- Each row is one immutable thesis version. Superseding versions insert a new row.
-- payloadJson is not updated. outcome columns are a future scoring hook only.
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
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`outcomeStatus` enum('UNSCORED') NOT NULL DEFAULT 'UNSCORED',
	`outcomeScoredAt` timestamp,
	`outcomeNotes` text,
	CONSTRAINT `pentagonalThesisRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `pentagonalThesisRecords_recordId_uniq` UNIQUE(`recordId`),
	CONSTRAINT `pentagonalThesisRecords_symbol_version_uniq` UNIQUE(`scopeKind`,`symbol`,`thesisVersion`)
);
--> statement-breakpoint
CREATE INDEX `pentagonalThesisRecords_symbol_idx` ON `pentagonalThesisRecords` (`symbol`,`recordedAt`);
