export type ShowcaseId =
  | "pressure-index"
  | "detection"
  | "six-domain-intelligence"
  | "sector-rotation"
  | "smart-discovery";

export type CaptureStatus = "pending" | "verified";
export type DataClassification =
  | "unclassified"
  | "public-sanitized"
  | "restricted";

/**
 * A capture is deliberately unusable unless every provenance and safety check is
 * completed. `pending` is the only status used by the candidate manifest below.
 */
export interface CaptureVerification {
  status: CaptureStatus;
  operationalVerified: boolean;
  sourceVerified: boolean;
  actualCapturePath: string | null;
  capturedAt: string | null;
  sourceBranch: string | null;
  sourceSha: string | null;
  dataClassification: DataClassification;
  observationClassification:
    | "live"
    | "recent"
    | "delayed"
    | "historical"
    | "demonstration"
    | null;
  observationAt: string | null;
  sensitiveInformationReviewed: boolean;
  containsSensitiveInformation: boolean;
}

export interface ShowcaseEvidence {
  id: ShowcaseId;
  label: string;
  eyebrow: string;
  title: string;
  intent: string;
  placeholderTitle: string;
  placeholderBody: string;
  verificationRequirements: readonly string[];
  imageAlt: string;
  verification: CaptureVerification;
}

const pendingVerification = (): CaptureVerification => ({
  status: "pending",
  operationalVerified: false,
  sourceVerified: false,
  actualCapturePath: null,
  capturedAt: null,
  sourceBranch: null,
  sourceSha: null,
  dataClassification: "unclassified",
  observationClassification: null,
  observationAt: null,
  sensitiveInformationReviewed: false,
  containsSensitiveInformation: false,
});

const sharedRequirements = [
  "Operational behavior reviewed in the release candidate.",
  "Source provenance and actual capture path recorded.",
  "Capture timestamp, source branch, and source SHA recorded.",
  "Data observation date and live, recent, delayed or historical classification recorded.",
  "Public-safe classification confirmed; no sensitive information present.",
] as const;

/** Candidate slots only — none of these descriptions are operational claims. */
export const SHOWCASE_EVIDENCE: readonly ShowcaseEvidence[] = [
  {
    id: "pressure-index",
    label: "Pressure Index",
    eyebrow: "PUBLIC READING",
    title: "Pressure Index",
    intent:
      "A proposed evidence view for the public reading and its documented context.",
    placeholderTitle: "A public reading, shown with its evidence trail.",
    placeholderBody:
      "This reserved space will hold a source-qualified capture only after the public state, provenance, and capture metadata are independently checked.",
    verificationRequirements: sharedRequirements,
    imageAlt: "Verified FAULTLINE Pressure Index product capture.",
    verification: pendingVerification(),
  },
  {
    id: "detection",
    label: "Detection",
    eyebrow: "EVIDENCE TREATMENT",
    title: "Detection",
    intent:
      "A proposed evidence view for how reviewed observations may be presented with context.",
    placeholderTitle: "Observation needs provenance before presentation.",
    placeholderBody:
      "No detection output is represented here. A capture may be added only when its operational state and source record can be reviewed together.",
    verificationRequirements: sharedRequirements,
    imageAlt: "Verified FAULTLINE detection product capture.",
    verification: pendingVerification(),
  },
  {
    id: "six-domain-intelligence",
    label: "Six-Domain Intelligence",
    eyebrow: "ARCHITECTURE CONTEXT",
    title: "Six-Domain Intelligence",
    intent:
      "A proposed evidence view for the approved six-domain architecture, not a claim of live output.",
    placeholderTitle: "Architecture context, not a simulated screen.",
    placeholderBody:
      "This placeholder intentionally contains no dashboard, chart, score, or signal. It is reserved for a reviewed application capture with clear evidence labels.",
    verificationRequirements: sharedRequirements,
    imageAlt: "Verified FAULTLINE six-domain intelligence product capture.",
    verification: pendingVerification(),
  },
  {
    id: "sector-rotation",
    label: "Sector Rotation",
    eyebrow: "CANDIDATE EVIDENCE",
    title: "Sector Rotation",
    intent:
      "A candidate evidence slot, not a statement that a sector-rotation capability is currently available.",
    placeholderTitle: "Candidate capture awaiting qualification.",
    placeholderBody:
      "The capability description is intent only. A genuine capture can replace this panel after operational, source, and privacy verification is complete.",
    verificationRequirements: sharedRequirements,
    imageAlt: "Verified FAULTLINE sector rotation product capture.",
    verification: pendingVerification(),
  },
  {
    id: "smart-discovery",
    label: "Smart Discovery",
    eyebrow: "CANDIDATE EVIDENCE",
    title: "Smart Discovery",
    intent:
      "A candidate evidence slot, not a promise of an available discovery workflow.",
    placeholderTitle: "Evidence first. Interface second.",
    placeholderBody:
      "No workflow is implied by this design placeholder. A verified capture must document its source, timing, classification, and privacy review before it can appear.",
    verificationRequirements: sharedRequirements,
    imageAlt: "Verified FAULTLINE Smart Discovery product capture.",
    verification: pendingVerification(),
  },
] as const;

/** Only same-origin image files inside the public marketing asset directory are eligible. */
export function isLocalMarketingAssetPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    /^\/marketing\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(?:avif|webp|png|jpe?g)$/i.test(
      path
    ) &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !/[?#]/.test(path)
  );
}

function isRecordedTimestamp(timestamp: string | null): timestamp is string {
  return (
    typeof timestamp === "string" &&
    timestamp.trim().length > 0 &&
    !Number.isNaN(Date.parse(timestamp))
  );
}

function isRecordedSourceSha(sha: string | null): sha is string {
  return typeof sha === "string" && /^[a-f0-9]{7,64}$/i.test(sha);
}

/**
 * Fail closed: a design candidate can render as a screenshot only when each
 * operational, source, capture, provenance, classification, and privacy gate passes.
 */
export function hasVerifiedCapture(evidence: ShowcaseEvidence): boolean {
  const gate = evidence.verification;

  return (
    gate.status === "verified" &&
    gate.operationalVerified &&
    gate.sourceVerified &&
    isLocalMarketingAssetPath(gate.actualCapturePath) &&
    isRecordedTimestamp(gate.capturedAt) &&
    typeof gate.sourceBranch === "string" &&
    gate.sourceBranch.trim().length > 0 &&
    isRecordedSourceSha(gate.sourceSha) &&
    gate.dataClassification === "public-sanitized" &&
    ["live", "recent", "delayed", "historical"].includes(
      gate.observationClassification ?? ""
    ) &&
    isRecordedTimestamp(gate.observationAt) &&
    gate.sensitiveInformationReviewed &&
    !gate.containsSensitiveInformation
  );
}

export function getVerifiedCapturePath(
  evidence: ShowcaseEvidence
): string | null {
  return hasVerifiedCapture(evidence)
    ? evidence.verification.actualCapturePath
    : null;
}
