ALTER TABLE `intelligenceStateManifests` ADD `originatingRunId` varchar(160);--> statement-breakpoint
UPDATE `intelligenceStateManifests`
SET `originatingRunId` = CONCAT('legacy-unattributed:', `stateId`)
WHERE `originatingRunId` IS NULL;--> statement-breakpoint
ALTER TABLE `intelligenceStateManifests` MODIFY `originatingRunId` varchar(160) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `intelligenceStateManifests_originatingRunId_uniq` ON `intelligenceStateManifests` (`originatingRunId`);
