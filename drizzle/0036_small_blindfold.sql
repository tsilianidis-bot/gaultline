ALTER TABLE `decision_ledger` MODIFY COLUMN `outcome` enum('pending','correct','incorrect','partially_correct','still_active') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `evaluationNotes` text;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `priceAtEntry` double;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `priceAtResolution` double;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `elapsedMs` bigint;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `autoEvaluated` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `evaluatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `decision_ledger` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
CREATE INDEX `decision_ledger_cronUid_idx` ON `decision_ledger` (`scheduleCronTaskUid`);