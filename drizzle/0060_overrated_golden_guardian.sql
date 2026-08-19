ALTER TABLE `verifiedHistoricalOutcomes` DROP INDEX `verifiedHist_outcome_score_horizon_idx`;--> statement-breakpoint
CREATE INDEX `verifiedHist_outcome_score_fk_support_idx` ON `verifiedHistoricalOutcomes` (`verifiedScoreId`);
ALTER TABLE `verifiedHistoricalOutcomes` DROP INDEX `verifiedHist_outcome_score_horizon_idx`;
CREATE INDEX `verifiedHist_outcome_score_horizon_idx` ON `verifiedHistoricalOutcomes` (`verifiedScoreId`,`horizonTradingDays`);
