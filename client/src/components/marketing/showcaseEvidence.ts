export type ShowcaseId =
  | "pressure-index"
  | "six-domain-intelligence"
  | "signals-discovery"
  | "outlook-scenarios"
  | "daily-brief";

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
  mobileCapturePath: string | null;
  desktopWidth: number | null;
  desktopHeight: number | null;
  mobileWidth: number | null;
  mobileHeight: number | null;
  captureSha256: string | null;
  mobileCaptureSha256: string | null;
  operationalQualificationPath: string | null;
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
  benefit?: string;
  promotionBlockers?: readonly string[];
  publicDemoHref?: string;
  publicDemoLabel?: string;
  verification: CaptureVerification;
}

const pendingVerification = (): CaptureVerification => ({
  status: "pending",
  operationalVerified: false,
  sourceVerified: false,
  actualCapturePath: null,
  mobileCapturePath: null,
  desktopWidth: null,
  desktopHeight: null,
  mobileWidth: null,
  mobileHeight: null,
  captureSha256: null,
  mobileCaptureSha256: null,
  operationalQualificationPath: null,
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
  "Source provenance, desktop/mobile captures and image hashes recorded.",
  "Capture timestamp, exact source SHA, branch and qualification report recorded.",
  "Data observation date and live, recent, delayed or historical classification recorded.",
  "Public-safe classification confirmed; no sensitive information present.",
] as const;

/** Candidate slots only — none of these descriptions are operational claims. */
export const SHOWCASE_EVIDENCE: readonly ShowcaseEvidence[] = [
  {
    id: "pressure-index",
    label: "Pressure Index & Overview",
    eyebrow: "PRESSURE AND CONTEXT",
    title: "Pressure Index and Market Overview",
    intent:
      "Read one canonical pressure snapshot alongside its drivers, date and source health. Market Overview is a separate member workspace.",
    benefit:
      "Understand what is happening, which inputs are driving pressure and how current conditions should be interpreted—not just a headline number.",
    placeholderTitle: "One reading. Its drivers and date, in view.",
    placeholderBody:
      "A genuine public Pressure Index capture belongs here only after the candidate snapshot and displayed observation agree. Member-only Market Overview requires separately authorized nonproduction access.",
    promotionBlockers: [
      "No genuine nonproduction canonical manifest is connected to this candidate.",
      "Market Overview has no authorized nonproduction member session or reviewed source payload.",
    ],
    publicDemoHref: "/pressure-index",
    publicDemoLabel: "Open the public Pressure Index",
    verificationRequirements: sharedRequirements,
    imageAlt:
      "Source-qualified FAULTLINE Pressure Index and Market Overview product capture.",
    verification: pendingVerification(),
  },
  {
    id: "six-domain-intelligence",
    label: "Six-Domain Intelligence",
    eyebrow: "CROSS-MARKET ARCHITECTURE",
    title: "Six-Domain Intelligence Architecture",
    intent:
      "Connect the six approved domains while keeping direct observations distinct from proxy limitations and inferred relationships.",
    benefit:
      "See where pressure is developing across markets, and distinguish measured evidence from an explanatory relationship.",
    placeholderTitle: "Architecture is visible. Evidence must follow.",
    placeholderBody:
      "The approved hero remains an educational illustration. It cannot stand in for an operational six-domain application capture.",
    promotionBlockers: [
      "PR #107 activation is a separate unmerged integration dependency.",
      "No source-qualified six-domain evidence set or operational capture surface is connected here.",
    ],
    publicDemoHref: "/methodology#sources",
    publicDemoLabel: "Review domain sources and limitations",
    verificationRequirements: sharedRequirements,
    imageAlt:
      "Source-qualified FAULTLINE six-domain intelligence product capture.",
    verification: pendingVerification(),
  },
  {
    id: "signals-discovery",
    label: "Signals & Smart Discovery",
    eyebrow: "OBSERVATION AND EXPLANATION",
    title: "Signals and Smart Discovery",
    intent:
      "Inspect dated observations and investigate what changed, why it matters and what evidence would confirm or challenge the interpretation.",
    benefit:
      "Move from a market question to an explanation anchored in actual observations—not an unsupported recommendation.",
    placeholderTitle: "An answer needs evidence behind it.",
    placeholderBody:
      "Neither a fallback quote nor a synthetic demo account qualifies an operational signal or a Smart Discovery answer.",
    promotionBlockers: [
      "No reviewed nonproduction quote response, source-backed answer or provider runtime is available.",
      "Computed signals and Discovery require authorized candidate access; demo paths cannot supply operational proof.",
    ],
    publicDemoHref: "/methodology#stack",
    publicDemoLabel: "Read the existing capability inventory",
    verificationRequirements: sharedRequirements,
    imageAlt:
      "Source-qualified FAULTLINE Signals and Smart Discovery product capture.",
    verification: pendingVerification(),
  },
  {
    id: "outlook-scenarios",
    label: "Outlook & Scenarios",
    eyebrow: "CONDITIONS, NOT CERTAINTY",
    title: "Outlook and Scenario Analysis",
    intent:
      "Understand conditional outlook, confirmation and invalidation while withholding scenario claims the canonical evidence does not support.",
    benefit:
      "Know what to watch next, which developments would change the interpretation and where uncertainty remains.",
    placeholderTitle: "A conditional outlook, not invented odds.",
    placeholderBody:
      "Only the current canonical OUTLOOK surface is a capture candidate. Legacy seeded scenarios and research-only history are excluded.",
    promotionBlockers: [
      "No genuine nonproduction canonical observation or authorized OUTLOOK session is available.",
      "No public operational Outlook demo is currently established; static or seeded scenarios cannot substitute.",
    ],
    publicDemoHref: "/methodology#limitations",
    publicDemoLabel: "Review uncertainty and limitations",
    verificationRequirements: sharedRequirements,
    imageAlt: "Source-qualified FAULTLINE canonical Outlook product capture.",
    verification: pendingVerification(),
  },
  {
    id: "daily-brief",
    label: "Daily Intelligence Brief",
    eyebrow: "SNAPSHOT-BOUND PUBLIC CONTEXT",
    title: "Daily Intelligence Brief",
    intent:
      "Read a saved market explanation tied to the exact generation snapshot, rather than quietly substituting a later live reading.",
    benefit:
      "Follow how the market interpretation developed over time, with the original observation date kept in view.",
    placeholderTitle: "A market explanation with its original context.",
    placeholderBody:
      "Selected as the strongest additional public capture candidate because the existing archive supports published, snapshot-bound briefs. No qualified brief is connected in this checkout.",
    promotionBlockers: [
      "No genuinely generated published brief and immutable linked snapshot are available in the isolated runtime.",
      "An archive render or unbound legacy article does not qualify a product capture.",
    ],
    publicDemoHref: "/daily-brief",
    publicDemoLabel: "Open the existing public brief archive",
    verificationRequirements: sharedRequirements,
    imageAlt:
      "Source-qualified FAULTLINE snapshot-bound Daily Intelligence Brief capture.",
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
  return (
    typeof sha === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sha)
  );
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
    isLocalMarketingAssetPath(gate.mobileCapturePath) &&
    [
      gate.desktopWidth,
      gate.desktopHeight,
      gate.mobileWidth,
      gate.mobileHeight,
    ].every(value => Number.isInteger(value) && (value ?? 0) > 0) &&
    /^[a-f0-9]{64}$/i.test(gate.captureSha256 ?? "") &&
    /^[a-f0-9]{64}$/i.test(gate.mobileCaptureSha256 ?? "") &&
    /^docs\/marketing\/qualification\/[a-z0-9-]+\.md$/.test(
      gate.operationalQualificationPath ?? ""
    ) &&
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
