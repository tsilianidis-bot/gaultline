import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SPEC_ID } from "../lock";

export const CANDIDATE_SPEC_ID = "FL-PI-v2-funding-candidate-cp-tbill-NOT-FROZEN";
export const CP_SERIES_ID = "DCPF3M";
export const TBILL_SERIES_ID = "DTB3";

export type DatedValue = { date: string; value: number };

export type CpTbillResult = {
  candidateSpecId: typeof CANDIDATE_SPEC_ID;
  frozenSpecId: typeof SPEC_ID;
  frozenSpecAccepts: false;
  series: { commercialPaper: typeof CP_SERIES_ID; treasuryBill: typeof TBILL_SERIES_ID };
  spreadDefinition: "DCPF3M minus DTB3, inner join on observation date, no interpolation";
  basisNote: "DCPF3M is a yield and DTB3 is a discount rate. The difference is a research candidate, not a TED replacement.";
  threshold: number | null;
  consecutiveSessionsRequired: 5;
  claim: "NONE";
  pass: null;
  evaluable: false;
  reason: string;
  spreads: { date: string; spread: number }[];
  descriptiveStreakCount: number | null;
};

export function assertCandidateStaysOutsideFrozenSpec(targetSpecId: string): void {
  if (targetSpecId === SPEC_ID) {
    throw new Error("CP minus T-bill cannot be inserted into FL-PI-v2-research-0");
  }
}

export function cpMinusTbill(cp: number, tbill: number): number {
  return cp - tbill;
}

export function evaluateCpTbillCandidate(args: {
  cp: readonly DatedValue[];
  tbill: readonly DatedValue[];
  threshold: number | null;
  targetSpecId?: string;
}): CpTbillResult {
  assertCandidateStaysOutsideFrozenSpec(args.targetSpecId ?? CANDIDATE_SPEC_ID);
  const bills = new Map(args.tbill.map(point => [point.date, point.value]));
  const spreads = args.cp
    .filter(point => bills.has(point.date) && Number.isFinite(point.value) && Number.isFinite(bills.get(point.date)!))
    .map(point => ({ date: point.date, spread: cpMinusTbill(point.value, bills.get(point.date)!) }))
    .sort((left, right) => left.date.localeCompare(right.date));
  let descriptiveStreakCount: number | null = null;
  if (args.threshold != null) {
    descriptiveStreakCount = 0;
    let run = 0;
    for (const point of spreads) {
      run = point.spread >= args.threshold ? run + 1 : 0;
      if (run === 5) descriptiveStreakCount += 1;
    }
  }
  return {
    candidateSpecId: CANDIDATE_SPEC_ID,
    frozenSpecId: SPEC_ID,
    frozenSpecAccepts: false,
    series: { commercialPaper: CP_SERIES_ID, treasuryBill: TBILL_SERIES_ID },
    spreadDefinition: "DCPF3M minus DTB3, inner join on observation date, no interpolation",
    basisNote: "DCPF3M is a yield and DTB3 is a discount rate. The difference is a research candidate, not a TED replacement.",
    threshold: args.threshold,
    consecutiveSessionsRequired: 5,
    claim: "NONE",
    pass: null,
    evaluable: false,
    reason: args.threshold == null
      ? "No threshold is set. A T-LIQ threshold has to be preregistered before any evaluation claim, and that preregistration is a different spec from FL-PI-v2-research-0."
      : "A descriptive streak count was computed from the supplied threshold. It is not a pass, a fail, or an approval to change the frozen funding pillar.",
    spreads,
    descriptiveStreakCount,
  };
}

export function main(argv: string[]): number {
  const thresholdFlag = argv.indexOf("--threshold");
  const threshold = thresholdFlag === -1 ? null : Number(argv[thresholdFlag + 1]);
  const cpFlag = argv.indexOf("--cp");
  const billFlag = argv.indexOf("--tbill");
  const cp = cpFlag === -1 ? [] : JSON.parse(readFileSync(argv[cpFlag + 1]!, "utf8")) as DatedValue[];
  const tbill = billFlag === -1 ? [] : JSON.parse(readFileSync(argv[billFlag + 1]!, "utf8")) as DatedValue[];
  const result = evaluateCpTbillCandidate({ cp, tbill, threshold: thresholdFlag === -1 ? null : threshold });
  process.stdout.write(`${JSON.stringify({ ...result, spreads: result.spreads.slice(0, 5), spreadCount: result.spreads.length }, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
