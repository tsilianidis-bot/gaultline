import { addCalendarDays } from "../dates";

export type WalkForwardFold = {
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
};

/** Expanding train, one-year test steps. Transforms stay frozen; this split is for metrics only. */
export function expandingYearFolds(dates: readonly string[], minTrainYears: number, stepYears = 1): WalkForwardFold[] {
  const sorted = Array.from(new Set(dates)).sort();
  if (sorted.length === 0) return [];
  const first = sorted[0]!;
  const lastYear = Number(sorted[sorted.length - 1]!.slice(0, 4));
  const folds: WalkForwardFold[] = [];
  for (let testYear = Number(first.slice(0, 4)) + minTrainYears; testYear <= lastYear; testYear += stepYears) {
    const testStart = `${testYear}-01-01`;
    const testEnd = `${testYear + stepYears - 1}-12-31`;
    const trainEnd = addCalendarDays(testStart, -1);
    if (trainEnd < first) continue;
    if (!sorted.some(date => date >= testStart && date <= testEnd)) continue;
    folds.push({ trainStart: first, trainEnd, testStart, testEnd });
  }
  return folds;
}

export function rowsInTestWindow<T extends { asOfDate: string }>(rows: readonly T[], fold: WalkForwardFold): T[] {
  return rows.filter(row => row.asOfDate >= fold.testStart && row.asOfDate <= fold.testEnd);
}

export function assertOutOfSample<T extends { asOfDate: string }>(rows: readonly T[], fold: WalkForwardFold): void {
  if (rows.some(row => row.asOfDate <= fold.trainEnd)) {
    throw new Error("Test metric received a row from the training window");
  }
}
