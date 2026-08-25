ALTER TABLE `dailyBriefSnapshots` ADD `originatingStateId` varchar(96);--> statement-breakpoint
ALTER TABLE `dailyBriefSnapshots` ADD `originatingStateId` varchar(96);--> statement-breakpoint
ALTER TABLE `dailyBriefSnapshots` ADD `originatingEffectiveAt` timestamp;--> statement-breakpoint
ALTER TABLE `dailyBriefSnapshots` ADD `originatingGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `dailyBriefSnapshots` ADD `originatingModelVersion` varchar(96);--> statement-breakpoint
ALTER TABLE `dailyBriefSnapshots` ADD `originatingConfigurationVersion` varchar(96);--> statement-breakpoint
ALTER TABLE `dailyBriefSnapshots` ADD `originatingInputSnapshotId` varchar(128);--> statement-breakpoint
CREATE INDEX `dailyBriefSnapshots_originatingStateId_idx` ON `dailyBriefSnapshots` (`originatingStateId`);
