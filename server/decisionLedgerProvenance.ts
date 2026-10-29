import { createHash, randomUUID } from "node:crypto";
import { decisionLedgerOutcomeProvenance } from "../drizzle/decisionOutcomeProvenanceSchema";

export const DECISION_LEDGER_OUTCOME_PROVENANCE_VERSION =
  "decision-ledger-horizon-v1";

export type DecisionLedgerOutcomeProvenanceState =
  | "verified"
  | "pending_unverifiable";

export type DecisionLedgerAutomatedOutcome =
  | "correct"
  | "incorrect"
  | "partially_correct"
  | "still_active";

/**
 * The evidence receipt is deliberately complete enough to audit a calculation
 * without revising the original recommendation. `receivedAt` is the time this
 * evaluator obtained the adapter result, not a provider observation time.
 */
export interface DecisionLedgerOutcomeProvenanceInput {
  provenanceKey?: string;
  decisionLedgerId: number;
  evaluationState: DecisionLedgerOutcomeProvenanceState;
  sourceProvider: string | null;
  assetType: "stock" | "crypto" | null;
  assetSymbol: string | null;
  originalIssuedAt: Date;
  horizonAt: Date;
  entryObservationAt: Date | null;
  entryPrice: number | null;
  horizonObservationAt: Date | null;
  horizonPrice: number | null;
  returnPct: number | null;
  outcome: DecisionLedgerAutomatedOutcome | null;
  receivedAt: Date;
  reason: string;
  evidence: unknown;
}

export interface DecisionLedgerOutcomeProvenanceWriter {
  append(input: DecisionLedgerOutcomeProvenanceInput): Promise<void>;
}

/**
 * A completed horizon has exactly one immutable receipt for each evaluation
 * state. The key is deterministic so a restart uses the same claim instead of
 * creating competing evidence rows. The database additionally enforces the
 * entry/horizon/state uniqueness; this digest is an auditable stable identity,
 * not the only concurrency control.
 */
export function decisionLedgerOutcomeProvenanceKey(
  input: Pick<
    DecisionLedgerOutcomeProvenanceInput,
    "decisionLedgerId" | "horizonAt" | "evaluationState"
  >
): string {
  const claim = [
    DECISION_LEDGER_OUTCOME_PROVENANCE_VERSION,
    input.decisionLedgerId,
    input.horizonAt.toISOString(),
    input.evaluationState,
  ].join(":");
  return `dlop_${createHash("sha256").update(claim).digest("hex")}`;
}

/** Keeps the standalone writer and the evaluator transaction on one row shape. */
export function decisionLedgerOutcomeProvenanceValues(
  input: DecisionLedgerOutcomeProvenanceInput
): Record<string, unknown> {
  return {
    provenanceKey: input.provenanceKey ?? randomUUID(),
    decisionLedgerId: input.decisionLedgerId,
    provenanceVersion: DECISION_LEDGER_OUTCOME_PROVENANCE_VERSION,
    evaluationState: input.evaluationState,
    sourceProvider: input.sourceProvider,
    assetType: input.assetType,
    assetSymbol: input.assetSymbol,
    originalIssuedAt: input.originalIssuedAt,
    horizonAt: input.horizonAt,
    entryObservationAt: input.entryObservationAt,
    entryPrice: input.entryPrice,
    horizonObservationAt: input.horizonObservationAt,
    horizonPrice: input.horizonPrice,
    returnPct: input.returnPct,
    outcome: input.outcome,
    receivedAt: input.receivedAt,
    reason: input.reason,
    evidenceJson: JSON.stringify(input.evidence),
  };
}

type InsertableDb = {
  insert: (table: typeof decisionLedgerOutcomeProvenance) => {
    values: (values: Record<string, unknown>) => unknown;
  };
};

/**
 * Makes the only persistence adapter used by the automatic evaluator. The
 * caller must not finalize decision_ledger until this append resolves.
 */
export function createDecisionLedgerOutcomeProvenanceWriter(
  database: unknown
): DecisionLedgerOutcomeProvenanceWriter {
  const db = database as InsertableDb;
  return {
    async append(input: DecisionLedgerOutcomeProvenanceInput): Promise<void> {
      await db
        .insert(decisionLedgerOutcomeProvenance)
        .values(decisionLedgerOutcomeProvenanceValues(input));
    },
  };
}
