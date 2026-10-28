-- The unique index is the only index MariaDB can use for verified_hist_outcome_score_fk.
-- Create a supporting index on verifiedScoreId before dropping the unique index,
-- or MariaDB rejects the drop (errno 1553).
CREATE INDEX `verifiedHist_outcome_score_fk_support_idx` ON `verifiedHistoricalOutcomes` (`verifiedScoreId`);
--> statement-breakpoint
ALTER TABLE `verifiedHistoricalOutcomes` DROP INDEX `verifiedHist_outcome_score_horizon_idx`;
--> statement-breakpoint
CREATE INDEX `verifiedHist_outcome_score_horizon_idx` ON `verifiedHistoricalOutcomes` (`verifiedScoreId`,`horizonTradingDays`);
