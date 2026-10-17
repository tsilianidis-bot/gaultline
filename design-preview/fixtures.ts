import {
  adaptIntelligenceCore,
  createUnavailableCore,
} from "../client/src/components/intelligence-core-visual/adapter";
import type {
  CoreDomain,
  CoreEvidence,
  EvidenceStatus,
  IntelligenceCoreInput,
  IntelligenceCoreViewModel,
} from "../client/src/components/intelligence-core-visual/types";

// FICTIONAL DESIGN FIXTURES ONLY. Never import this file from client/src or server.
const previewClock = Date.now();
const observedAt = new Date(previewClock - 300_000).toISOString();
const evaluatedAt = new Date(previewClock).toISOString();
const validUntil = new Date(previewClock + 3_600_000).toISOString();
const classifications: EvidenceStatus[] = [
  "current",
  "delayed",
  "stale",
  "static",
  "degraded",
  "unavailable",
];
const labels = [
  "Liquidity Stress",
  "Credit Contagion",
  "Volatility Regime",
  "Macro Sensitivity",
  "Market Breadth",
  "AI Bubble Risk",
];
const ids = [
  "liquidity",
  "credit",
  "volatility",
  "macro",
  "breadth",
  "ai",
] as const;
const significance = [
  "Liquidity evidence helps explain whether market participants can obtain funding and transfer risk. A change requires source-backed confirmation.",
  "Credit evidence helps assess financing conditions and whether stress is spreading across borrowers. An association does not establish contagion.",
  "Volatility evidence describes the scale and persistence of price uncertainty. A stale reading cannot establish the current volatility regime.",
  "Macro sensitivity organizes the potential influence of rates, inflation and growth. A model baseline is not an observed market condition.",
  "Breadth evidence examines participation beneath headline index moves. A degraded source cannot confirm current participation.",
  "AI Bubble Risk organizes valuation, concentration and financing evidence. Missing inputs do not establish an elevated risk assessment.",
];
const evidence: CoreEvidence[] = ids.map((id, index) => ({
  id: `DEMO-${id}`,
  label: `${labels[index]} — fictional observation`,
  source: "Design fixture · no real provider",
  sourceUrl: null,
  observationAt:
    index === 5 ? null : index === 2 ? "2026-10-09T20:00:00Z" : observedAt,
  status: classifications[index],
  value:
    index === 5
      ? null
      : [
          "Funding conditions example",
          "Published credit reading example",
          "Prior volatility reading example",
          "Versioned sensitivity baseline example",
          "Last retained breadth reading example",
        ][index],
  explanation:
    "Fictional fixture used to demonstrate the evidence classification and drawer. This is not a verified observation of any real market.",
  admitted: index !== 5,
  validUntil: index === 0 ? validUntil : null,
}));
const domains: CoreDomain[] = ids.map((id, index) => ({
  id,
  label: labels[index],
  status: classifications[index],
  assessment: index === 0 ? "Pressure building · design example" : null,
  direction: index === 0 ? "rising" : "unknown",
  observationAt: evidence[index].observationAt,
  evidenceIds: index === 5 ? [] : [evidence[index].id],
  significance: significance[index],
  context:
    index === 0
      ? "Fictional example: admitted liquidity evidence contributes context to the Core readout. This is not a live market assessment."
      : null,
  developingSince: index === 0 ? "2026-10-12T20:00:00Z" : null,
  historicalComparison:
    index === 0
      ? "No actual historical comparison. This example demonstrates where verified historical context would appear."
      : null,
}));
export const demonstrationInput: IntelligenceCoreInput = {
  canonicalStateId: "DEMO-CORE-016",
  observationAt: observedAt,
  evaluatedAt,
  integrity: "current",
  integrityReason:
    "Fixed fictional snapshot. Mixed classifications intentionally demonstrate why source availability is not the same as current evidence.",
  pressure: { value: 62.4, status: "current", evidenceIds: ["DEMO-liquidity"] },
  regime: {
    label: "Building pressure · example",
    evidenceIds: ["DEMO-liquidity"],
  },
  overview:
    "In this fictional design example, liquidity carries current evidence while the other domains remain delayed, stale, modeled, degraded or unavailable. They are not treated as live signals.",
  overviewEvidenceIds: ["DEMO-liquidity"],
  evidence,
  domains,
  relationships: [],
  emergingStress: [
    {
      id: "DEMO-stress",
      statement: "Funding pressure developing — fictional example",
      evidenceIds: ["DEMO-liquidity"],
      domainIds: ["liquidity"],
    },
  ],
  scenarios: [
    {
      id: "A",
      title: "Conditions stabilize · example",
      status: "conditional",
      summary:
        "Fictional conditional path: source-backed funding conditions stabilize. This is a UI example, not a forecast.",
      conditions: [
        "Admitted liquidity observations stop deteriorating",
        "Credit observations become current and corroborate stabilization",
      ],
      invalidations: [
        "Fresh evidence shows funding conditions continuing to tighten",
      ],
      evidenceIds: ["DEMO-liquidity"],
      domainIds: ["liquidity", "credit"],
    },
    {
      id: "B",
      title: "Stress broadens · example",
      status: "conditional",
      summary:
        "Fictional conditional path: new credit evidence corroborates liquidity stress. No probability or favored classification is assigned.",
      conditions: [
        "Fresh credit evidence corroborates pressure",
        "Breadth evidence becomes available and confirms weakening participation",
      ],
      invalidations: [
        "Current liquidity evidence demonstrates sustained improvement",
      ],
      evidenceIds: ["DEMO-liquidity"],
      domainIds: ["liquidity", "credit", "breadth"],
    },
    {
      id: "C",
      title: "Dislocation · example",
      status: "conditional",
      summary:
        "Fictional contingency path for investigating a dislocation. Scenario C cannot be favored.",
      conditions: [
        "Current evidence independently corroborates multiple stress domains",
      ],
      invalidations: [
        "Admitted current observations contradict cross-domain stress",
      ],
      evidenceIds: ["DEMO-liquidity"],
      domainIds: ["liquidity", "credit", "volatility"],
    },
  ],
  trackRecord: { records: [], metrics: [] },
};
export function getPreviewModel(state: string): IntelligenceCoreViewModel {
  if (state === "unavailable")
    return createUnavailableCore(
      "No verified Core payload connected. This production-safe state does not substitute synthetic evidence."
    );
  const input = structuredClone(demonstrationInput);
  if (state === "degraded") {
    input.integrity = "degraded";
    input.integrityReason =
      "Fictional source outage example. Last observations are retained for inspection; current pressure, regime and stress claims are withheld.";
    input.evidence[0].status = "degraded";
    input.domains[0].status = "degraded";
    input.pressure.status = "degraded";
  }
  const model = adaptIntelligenceCore(input);
  // This mode override exists ONLY in the separate, conspicuously labeled design-preview graph.
  model.mode = "demonstration";
  if (state === "records") {
    model.trackRecord.records = [
      {
        id: "DEMO-RECORD-001",
        assessmentAt: "2026-10-12T20:00:00Z",
        classification: "forward_recorded",
        outcome: "supported",
        summary: "Fictional forward assessment — layout example only",
        evidenceIds: ["DEMO-liquidity"],
        example: true,
      },
      {
        id: "DEMO-RECORD-002",
        assessmentAt: "2026-10-13T20:00:00Z",
        classification: "forward_recorded",
        outcome: "contradicted",
        summary: "Fictional contradicted assessment — layout example only",
        evidenceIds: ["DEMO-liquidity"],
        example: true,
      },
      {
        id: "DEMO-RECORD-003",
        assessmentAt: "2026-10-14T20:00:00Z",
        classification: "forward_recorded",
        outcome: "unresolved",
        summary: "Fictional unresolved assessment — layout example only",
        evidenceIds: ["DEMO-liquidity"],
        example: true,
      },
      {
        id: "DEMO-RECORD-004",
        assessmentAt: "2026-10-09T20:00:00Z",
        classification: "reconstructed",
        outcome: "unresolved",
        summary: "Fictional reconstruction — not forward-recorded",
        evidenceIds: ["DEMO-volatility"],
        example: true,
      },
    ];
  }
  return model;
}
