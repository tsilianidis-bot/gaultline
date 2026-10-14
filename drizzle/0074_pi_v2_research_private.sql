-- Private Pressure Index v2 research tables.
-- Not used by the public Pressure Index. Do not apply this migration to production
-- as part of the research branch; the Friday recorder stays unregistered.
CREATE TABLE `piV2ResearchRawInputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seriesId` varchar(64) NOT NULL,
	`observationDate` varchar(10) NOT NULL,
	`valueText` varchar(64) NOT NULL,
	`releaseTime` varchar(40),
	`realtimeStart` varchar(10),
	`vintageId` varchar(128) NOT NULL,
	`ingestionTime` varchar(40) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`coverageLabel` varchar(64) NOT NULL,
	`inComposite` boolean NOT NULL,
	`specId` varchar(64) NOT NULL,
	`inputHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `piV2ResearchRawInputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `piV2ResearchSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`asOfDate` varchar(10) NOT NULL,
	`onSpecGrid` boolean NOT NULL,
	`recordClass` enum('FORWARD_LIVE') NOT NULL,
	`specId` varchar(64) NOT NULL,
	`specSha256` varchar(64) NOT NULL,
	`implementationVersion` varchar(64) NOT NULL,
	`referenceSha256` varchar(64) NOT NULL,
	`runTrigger` enum('SCHEDULED_CRON','ADMIN_SEED') NOT NULL,
	`status` enum('ok','unavailable') NOT NULL,
	`v2Score` decimal(8,4),
	`band` varchar(32),
	`nPillars` int NOT NULL,
	`missingDataStatus` enum('complete','partial','unavailable') NOT NULL,
	`pillarsJson` text NOT NULL,
	`benchmarksJson` text NOT NULL,
	`inputsProvenanceJson` text NOT NULL,
	`inputSnapshotHash` varchar(64) NOT NULL,
	`decisionTimeUtc` varchar(40) NOT NULL,
	`v1Reading` int,
	`v1MethodologyVersion` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `piV2ResearchSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `piV2Snap_forward_only` CHECK (`recordClass` = 'FORWARD_LIVE'),
	CONSTRAINT `piV2Snap_on_grid` CHECK (`onSpecGrid` = 1 AND `asOfDate` >= '2026-10-16')
);
--> statement-breakpoint
CREATE TABLE `piV2ResearchLedger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordClass` enum('RETROSPECTIVE','FORWARD_LIVE') NOT NULL,
	`origin` enum('BACKFILL','OBSERVED_AT_DECISION') NOT NULL,
	`rowKind` enum('SCORE','OUTCOME') NOT NULL,
	`asOfDate` varchar(10) NOT NULL,
	`specId` varchar(64) NOT NULL,
	`specSha256` varchar(64) NOT NULL,
	`implementationVersion` varchar(64) NOT NULL,
	`targetId` varchar(32) NOT NULL,
	`horizon` varchar(32) NOT NULL,
	`snapshotId` int,
	`parentLedgerId` int,
	`score` decimal(8,4),
	`outcome` tinyint,
	`artifactKind` varchar(64) NOT NULL,
	`notes` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `piV2ResearchLedger_id` PRIMARY KEY(`id`),
	CONSTRAINT `piV2Ledger_class_origin` CHECK (
		(`recordClass` = 'RETROSPECTIVE' AND `origin` = 'BACKFILL' AND `snapshotId` IS NULL)
		OR (`recordClass` = 'FORWARD_LIVE' AND `origin` = 'OBSERVED_AT_DECISION' AND `snapshotId` IS NOT NULL AND `asOfDate` >= '2026-10-16')
	),
	CONSTRAINT `piV2Ledger_row_kind` CHECK (
		(`rowKind` = 'SCORE' AND `parentLedgerId` IS NULL AND `outcome` IS NULL)
		OR (`rowKind` = 'OUTCOME' AND `parentLedgerId` IS NOT NULL AND `outcome` IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE TABLE `piV2ResearchMonitorEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`detectedAt` varchar(40) NOT NULL,
	`kind` enum('MISSING_FRIDAY_SNAPSHOT','STALE_DATA','CALCULATION_FAILURE','SPEC_HASH_DRIFT','EXPECTED_UNAVAILABLE') NOT NULL,
	`severity` enum('info','alert') NOT NULL,
	`specId` varchar(64) NOT NULL,
	`specSha256` varchar(64),
	`asOfDate` varchar(10),
	`detailJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `piV2ResearchMonitorEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `piV2Raw_dedupe_uq` ON `piV2ResearchRawInputs` (`seriesId`,`observationDate`,`vintageId`,`valueText`);
--> statement-breakpoint
CREATE INDEX `piV2Raw_series_date_idx` ON `piV2ResearchRawInputs` (`seriesId`,`observationDate`);
--> statement-breakpoint
CREATE UNIQUE INDEX `piV2Snap_spec_date_uq` ON `piV2ResearchSnapshots` (`specId`,`asOfDate`);
--> statement-breakpoint
CREATE INDEX `piV2Ledger_class_idx` ON `piV2ResearchLedger` (`recordClass`,`asOfDate`);
--> statement-breakpoint
CREATE INDEX `piV2Ledger_snapshot_idx` ON `piV2ResearchLedger` (`snapshotId`);
--> statement-breakpoint
CREATE INDEX `piV2Monitor_kind_idx` ON `piV2ResearchMonitorEvents` (`kind`,`detectedAt`);
--> statement-breakpoint
ALTER TABLE `piV2ResearchLedger` ADD CONSTRAINT `piV2Ledger_snapshot_fk` FOREIGN KEY (`snapshotId`) REFERENCES `piV2ResearchSnapshots`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `piV2ResearchLedger` ADD CONSTRAINT `piV2Ledger_parent_fk` FOREIGN KEY (`parentLedgerId`) REFERENCES `piV2ResearchLedger`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchRawInputs_no_update` BEFORE UPDATE ON `piV2ResearchRawInputs` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchRawInputs append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchRawInputs_no_delete` BEFORE DELETE ON `piV2ResearchRawInputs` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchRawInputs append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchSnapshots_no_update` BEFORE UPDATE ON `piV2ResearchSnapshots` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchSnapshots append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchSnapshots_no_delete` BEFORE DELETE ON `piV2ResearchSnapshots` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchSnapshots append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchLedger_no_update` BEFORE UPDATE ON `piV2ResearchLedger` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchLedger append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchLedger_no_delete` BEFORE DELETE ON `piV2ResearchLedger` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchLedger append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchMonitorEvents_no_update` BEFORE UPDATE ON `piV2ResearchMonitorEvents` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchMonitorEvents append-only';
--> statement-breakpoint
CREATE TRIGGER `piV2ResearchMonitorEvents_no_delete` BEFORE DELETE ON `piV2ResearchMonitorEvents` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'piV2ResearchMonitorEvents append-only';
