export const DOMAIN_IDS = [
  "liquidity",
  "credit",
  "volatility",
  "macro",
  "breadth",
  "ai",
] as const;
export type DomainId = (typeof DOMAIN_IDS)[number];
export type EvidenceStatus =
  | "current"
  | "delayed"
  | "recent"
  | "stale"
  | "static"
  | "degraded"
  | "unavailable";
export type Direction = "rising" | "falling" | "stable" | "unknown";
export type ScenarioId = "A" | "B" | "C";
export type ThesisDestination = "now" | "why" | "outlook" | "watch" | "act";

/** This is a presentation boundary, not a provider or market-calculation contract. */
export interface CoreEvidence {
  id: string;
  label: string;
  source: string;
  sourceUrl: string | null;
  observationAt: string | null;
  status: EvidenceStatus;
  value: string | null;
  explanation: string;
  admitted: boolean;
  /** Canonical validator's validity deadline; the visual layer never invents a refresh policy. */
  validUntil: string | null;
}
export interface CoreDomain {
  id: DomainId;
  label: string;
  status: EvidenceStatus;
  assessment: string | null;
  direction: Direction;
  observationAt: string | null;
  evidenceIds: string[];
  significance: string;
  context: string | null;
  developingSince: string | null;
  historicalComparison: string | null;
  /** Supplied calibrated label only; this view never derives a numeric confidence. */
  confidence?: string | null;
  /** Canonical conditions are displayed as supplied only when domain lineage survives. */
  confirmationConditions?: string[];
  invalidationConditions?: string[];
  /** A supplied domain detail, not a visual calculation of the central Pressure Index. */
  pressureContribution?: string | null;
  previousObservation?: string | null;
}
export interface CoreRelationship {
  id: string;
  from: DomainId;
  to: DomainId;
  kind: "association" | "causal";
  explanation: string;
  evidenceIds: string[];
  /** Upstream evidence validation, not a visual inference. */
  supported: boolean;
}
export interface CoreScenario {
  id: ScenarioId;
  title: string;
  status: "favored" | "conditional" | "unsupported";
  summary: string | null;
  conditions: string[];
  invalidations: string[];
  evidenceIds: string[];
  domainIds: DomainId[];
}
export interface CoreAssessmentRecord {
  id: string;
  assessmentAt: string;
  classification: "forward_recorded" | "reconstructed";
  outcome: "supported" | "contradicted" | "unresolved";
  summary: string;
  evidenceIds: string[];
  example: boolean;
}
export interface CorePerformanceMetric {
  id: string;
  label: string;
  displayValue: string;
  eligibleSample: number;
  minimumSample: number;
  /** Includes upstream cohort separation, diversity and provenance rules. */
  admitted: boolean;
  cohort: "forward_recorded" | "reconstructed";
  evidenceIds: string[];
}
export interface IntelligenceCoreInput {
  canonicalStateId: string | null;
  observationAt: string | null;
  evaluatedAt: string;
  integrity: EvidenceStatus;
  integrityReason: string;
  pressure: {
    value: number | null;
    status: EvidenceStatus;
    evidenceIds: string[];
  };
  regime: { label: string | null; evidenceIds: string[] };
  overview: string | null;
  overviewEvidenceIds?: string[];
  evidence: CoreEvidence[];
  domains: CoreDomain[];
  relationships: CoreRelationship[];
  scenarios: CoreScenario[];
  emergingStress: {
    id: string;
    statement: string;
    evidenceIds: string[];
    domainIds: DomainId[];
  }[];
  trackRecord: {
    records: CoreAssessmentRecord[];
    metrics: CorePerformanceMetric[];
  };
}
export interface IntelligenceCoreViewModel extends IntelligenceCoreInput {
  mode: "production" | "demonstration";
  animateVerifiedChange: boolean;
}
export interface IntelligenceCoreExperienceProps {
  model?: IntelligenceCoreViewModel;
  onNavigate?: (destination: ThesisDestination) => void;
}
