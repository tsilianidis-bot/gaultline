ALTER TABLE `shadowForwardOutcomes`
  ADD COLUMN `horizon` enum('1d','5d','20d') NOT NULL,
  ADD COLUMN `sp500ReturnPct` decimal(8,4),
  ADD COLUMN `nasdaqReturnPct` decimal(8,4),
  ADD COLUMN `vixAtOutcome` decimal(6,2),
  ADD COLUMN `stressEventOccurred` boolean DEFAULT false;
