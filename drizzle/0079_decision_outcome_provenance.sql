-- REGISTERED / ACCEPTED WAVE-2 INTEGRATION. Do not apply from deploy, startup,
-- or manually; use only the ordered Drizzle journal after independent QA. It never
-- changes existing decision_ledger rows or backfills historical prices or outcomes.
-- MariaDB triggers do not block TRUNCATE; the deploy role must not receive DROP
-- or TRUNCATE privileges on decisionLedgerOutcomeProvenance.
CREATE TABLE `decisionLedgerOutcomeProvenance` (
  `id` int AUTO_INCREMENT NOT NULL,
  `provenanceKey` varchar(96) NOT NULL,
  `decisionLedgerId` int NOT NULL,
  `provenanceVersion` varchar(48) NOT NULL,
  `evaluationState` enum('verified','pending_unverifiable') NOT NULL,
  `sourceProvider` varchar(64),
  `assetType` enum('stock','crypto'),
  `assetSymbol` varchar(20),
  `originalIssuedAt` timestamp NOT NULL,
  `horizonAt` timestamp NOT NULL,
  `entryObservationAt` timestamp,
  `entryPrice` double,
  `horizonObservationAt` timestamp,
  `horizonPrice` double,
  `returnPct` double,
  `outcome` enum('correct','incorrect','partially_correct','still_active'),
  `receivedAt` timestamp NOT NULL,
  `reason` varchar(96) NOT NULL,
  `evidenceJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `decisionLedgerOutcomeProvenance_id` PRIMARY KEY(`id`),
  CONSTRAINT `decisionLedgerOutcomeProvenance_key_uniq` UNIQUE(`provenanceKey`),
  CONSTRAINT `decisionLedgerOutcomeProvenance_entry_horizon_state_uniq`
    UNIQUE(`decisionLedgerId`,`horizonAt`,`evaluationState`),
  CONSTRAINT `decisionLedgerOutcomeProvenance_ledger_fk`
    FOREIGN KEY (`decisionLedgerId`) REFERENCES `decision_ledger`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `decisionLedgerOutcomeProvenance_ledger_receipt_idx`
  ON `decisionLedgerOutcomeProvenance` (`decisionLedgerId`,`receivedAt`);
--> statement-breakpoint
CREATE TRIGGER `decision_ledger_outcome_provenance_block_update`
BEFORE UPDATE ON `decisionLedgerOutcomeProvenance`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'decisionLedgerOutcomeProvenance is append-only';
--> statement-breakpoint
CREATE TRIGGER `decision_ledger_outcome_provenance_block_delete`
BEFORE DELETE ON `decisionLedgerOutcomeProvenance`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'decisionLedgerOutcomeProvenance is append-only';
