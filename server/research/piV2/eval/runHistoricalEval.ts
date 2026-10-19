import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { computeV2At } from "../compute";
import { ResearchSpecError } from "../errors";
import { FIRST_OFFICIAL_FRIDAY, loadLockedSpec } from "../spec";
import { auroc } from "./metrics";
import { equityDrawdownEvent, evaluateFundingTarget, type ClosePoint } from "./targets";
import type { InputPanel } from "../types";

export type HistoricalRequest = {
  panels: InputPanel[];
  closes?: ClosePoint[];
};

export type HistoricalArtifact = {
  artifactKind: "HISTORICAL_BACKTEST";
  recordClass: "RETROSPECTIVE";
  origin: "BACKFILL";
  eligibleForForwardLedger: false;
  specId: "FL-PI-v2-research-0";
  specSha256: string;
  disclaimer: string;
  scores: Array<{
    asOfDate: string;
    recordClass: "RETROSPECTIVE";
    origin: "BACKFILL";
    eligibleForForwardLedger: false;
    forwardGridBackfill: boolean;
    status: "ok" | "unavailable" | "calculation_error";
    v2Score: number | null;
    band: string | null;
    nPillars: number | null;
    missingDataStatus: string | null;
    message?: string;
  }>;
  evaluations: Record<string, { status: string; auc?: number | null; events?: number; reason?: string }>;
};

export function buildHistoricalArtifact(request: HistoricalRequest): HistoricalArtifact {
  const { spec, sha256 } = loadLockedSpec();
  const scores: HistoricalArtifact["scores"] = [];
  for (const panel of request.panels) {
    const forwardGridBackfill = panel.asOfDate >= FIRST_OFFICIAL_FRIDAY;
    try {
      const computed = computeV2At(panel);
      scores.push({
        asOfDate: panel.asOfDate,
        recordClass: "RETROSPECTIVE",
        origin: "BACKFILL",
        eligibleForForwardLedger: false,
        forwardGridBackfill,
        status: computed.status,
        v2Score: computed.v2Score,
        band: computed.band,
        nPillars: computed.nPillars,
        missingDataStatus: computed.missingDataStatus,
      });
    } catch (error) {
      scores.push({
        asOfDate: panel.asOfDate,
        recordClass: "RETROSPECTIVE",
        origin: "BACKFILL",
        eligibleForForwardLedger: false,
        forwardGridBackfill,
        status: "calculation_error",
        v2Score: null,
        band: null,
        nPillars: null,
        missingDataStatus: null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const evaluations: HistoricalArtifact["evaluations"] = {
    "T-LIQ": evaluateFundingTarget(),
  };
  if (!request.closes || request.closes.length === 0) {
    for (const target of ["T-EQ10", "T-EQ20", "T-REC", "T-BANK"]) {
      evaluations[target] = { status: "NOT_COMPUTED", reason: "No outcome series was supplied. This script does not manufacture results." };
    }
  } else {
    for (const [target, threshold, horizon] of [
      ["T-EQ10", -10, spec.evaluation.primaryEquityHorizonSessions],
      ["T-EQ20", -20, spec.evaluation.sessionHorizons[2]],
    ] as const) {
      const labeled = scores.flatMap(score => {
        if (score.v2Score == null) return [];
        const event = equityDrawdownEvent(request.closes!, score.asOfDate, threshold, { sessions: horizon });
        if (event == null) return [];
        return [{ score: score.v2Score, event }];
      });
      const auc = auroc(labeled.map(row => row.score), labeled.map(row => row.event));
      evaluations[target] = labeled.length === 0
        ? { status: "NOT_COMPUTED", reason: "No completed forward windows in the supplied closes." }
        : { status: "COMPUTED_FROM_SUPPLIED_PANEL", auc, events: labeled.filter(row => row.event).length };
    }
    evaluations["T-REC"] = { status: "NOT_COMPUTED", reason: "Pass an explicit NBER list into a caller-side evaluation. The artifact does not infer recession dates from prices." };
    evaluations["T-BANK"] = { status: "NOT_COMPUTED", reason: "T-BANK stays unevaluable until a preregistered event list is supplied." };
  }
  return {
    artifactKind: "HISTORICAL_BACKTEST",
    recordClass: "RETROSPECTIVE",
    origin: "BACKFILL",
    eligibleForForwardLedger: false,
    specId: "FL-PI-v2-research-0",
    specSha256: sha256,
    disclaimer: "Diagnostic historical artifact. Every row is RETROSPECTIVE. None of these rows are forward-live evidence, crisis probabilities, or a promotion result.",
    scores,
    evaluations,
  };
}

export function assertRetrospectiveArtifact(artifact: HistoricalArtifact): void {
  if (artifact.recordClass !== "RETROSPECTIVE" || artifact.artifactKind !== "HISTORICAL_BACKTEST" || artifact.eligibleForForwardLedger !== false) {
    throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "Historical artifacts stay retrospective");
  }
  for (const score of artifact.scores) {
    if (score.recordClass !== "RETROSPECTIVE" || score.origin !== "BACKFILL" || score.eligibleForForwardLedger !== false) {
      throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "A historical score was labeled forward");
    }
  }
  if (JSON.stringify(artifact).includes("crisisProbability")) {
    throw new ResearchSpecError("SPEC_VIOLATION", "Historical artifacts do not carry crisis probabilities");
  }
}

export function main(argv: string[]): number {
  const panelFlag = argv.indexOf("--panel");
  if (panelFlag === -1 || !argv[panelFlag + 1]) {
    process.stderr.write("No panel supplied. Refusing to manufacture historical results.\n");
    return 2;
  }
  const request = JSON.parse(readFileSync(argv[panelFlag + 1]!, "utf8")) as HistoricalRequest;
  const artifact = buildHistoricalArtifact(request);
  assertRetrospectiveArtifact(artifact);
  const outFlag = argv.indexOf("--out");
  const body = `${JSON.stringify(artifact, null, 2)}\n`;
  if (outFlag !== -1 && argv[outFlag + 1]) writeFileSync(argv[outFlag + 1]!, body);
  else process.stdout.write(body);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
