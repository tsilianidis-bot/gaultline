# Intelligence Core visual integration handoff

This draft is an embeddable presentation build on the verified live release `1cb5dee13832c0556ec5a380ecc4ffb02513e875`, not an activation or deployment. It deliberately does not change any production page, startup, router, provider, calculation, checkout, registration, feature flag or migration. The functioning interaction surface is the separate `design-preview/` Vite entry. Keep the draft unmerged until the Core and accountability contracts are approved.

## Host connection

Import `IntelligenceCoreExperience`, `adaptIntelligenceCore`, and `createUnavailableCore` from `client/src/components/intelligence-core-visual`. Mount it in an existing NOW analysis surface only after owner approval; do not create another primary destination. The release already has NOW / WHY / OUTLOOK / WATCH / ACT. Its Pentagonal Thesis links preserve those five existing destinations.

```tsx
import {
  IntelligenceCoreExperience,
  adaptIntelligenceCore,
  createUnavailableCore,
  type IntelligenceCoreInput,
} from "@/components/intelligence-core-visual";

// Build this mapping in the approved host integration, from admitted Core data.
// Never pass raw provider results, generated narratives or preview fixtures.
const model = verifiedPayload
  ? adaptIntelligenceCore(mapApprovedCoreToPresentation(verifiedPayload), previousModel)
  : createUnavailableCore("The verified Intelligence Core is not available.");

return (
  <IntelligenceCoreExperience
    model={model}
    onNavigate={(destination) => navigate(`/app/${destination}`)}
  />
);
```

`mapApprovedCoreToPresentation` and `navigate` are illustrative host-owned functions, not functions shipped by this PR. The typed `IntelligenceCoreInput` contract is the mapping target. Store the previously admitted view model at the host to permit one-shot highlighting only when a later canonical observation changes verified pressure. Do not assign demonstration mode in production.

## Core evidence mapping

PR #90 proposes `shared/intelligenceEvidence.ts` and `shared/intelligenceIntegrity.ts`. This draft reviewed those interfaces read-only and did not import or merge them. Finalize the mapping against the approved version, not the current unmerged branch. Source observation time must come from the source, not request time, cache refresh time or narrative-generation time. `evaluatedAt` is the canonical validator's timestamp; `validUntil` is its admitted current-claim deadline, not a freshness policy invented by the UI.

Map admitted verified observations to `current`. Map latest published delayed evidence to `delayed`, elapsed observations to `stale`, versioned model baselines to `static`, source/coverage failures to `degraded`, and missing inputs to `unavailable`. Do not blanket-map all modeled outputs to current or reinterpret a source failure as neutral. `admitted` means the canonical evidence validator has allowed this source record to be used for the stated purpose. Current claims additionally require complete current source lineage and a validity deadline that has not expired at either the canonical evaluation time or the actual browser clock.

Supply the canonical state ID, original observation timestamp, Pressure Index exactly as calculated upstream, integrity reason and all supporting evidence IDs. Supply separate `overviewEvidenceIds` for the overview narrative; unrelated current evidence cannot authorize the overview. Preserve uncertainty: stale/static/degraded pressure is withheld from the central current readout, delayed pressure remains visibly delayed, and unavailable pressure is never zero. Retained stale/degraded source observations remain inspectable in the evidence drawer.

Supply each domain's admitted assessment, direction, source observation, evidence IDs, significance and supported context. `developingSince` and `historicalComparison` stay null unless the approved Core provides supported history. The UI does not estimate duration or historic analogs. The six domain identities and full names are fixed by the presentation adapter.

Organization lines merely arrange evidence domains around the Core. Cross-domain `relationships` require explicit upstream support, complete evidence IDs and a declared `association` or `causal` type. Do not populate causal edges from correlations or generic financial mechanisms. The drawer distinguishes supported causal claims from associations, and the topology exposes selected supported edges without assuming all domain connections are causal.

## Scenario and accountability mapping

A/B/C scenarios accept approved summaries, conditions, invalidations, supporting evidence and related domains. There are no probability or confidence fields. Scenario C cannot be favored: the adapter and rendering layer both guard that rule. Favored A/B scenarios require current evidence. A conditional historical/model relationship must retain its evidence classifications in the drawer.

PR #91 proposes `shared/intelligenceAccountability.ts`; PR #95 proposes its Core evidence connection. Map verified append-only assessment records from the approved ledger, with recorded dates, original evidence lineage, outcome and provenance. Map `forward_recorded` to the forward cohort, and `historical_reconstruction` to `reconstructed`. Never combine them in a performance metric. Preserve `supported`, `contradicted` and `unresolved` outcomes exactly; this component does not resolve an assessment.

Metric values, sample thresholds, eligible sample counts and admission must come from the approved ledger's governance rules, including provenance and diversity constraints. The visual layer gates the supplied admission and minimum sample; it does not recompute rates, change thresholds or manufacture benchmark results. Example records are removed by the production adapter and no fabricated metrics are shipped in fixtures. An empty ledger displays an informative unavailable state.

## Rendering and accessibility

The visualization uses SVG and scoped CSS, not Canvas/WebGL or a continuously running rendering loop. A genuine verified change may highlight the ring and current-evidence organization links once; there are no simulated price paths or animated live-looking particles. The component schedules one timer for the next admitted source validity deadline and rechecks the production model when it expires. Open drawer content reads the latest sanitized model rather than a cached selected-domain snapshot. Reduced motion suppresses animation and transitions.

Radix Dialog supplies the evidence focus trap and Escape close behavior; focus returns to the exact opening control. Domain nodes are keyboard and touch controls. Scenario and ledger tabs support arrow keys, Home and End. Scoped, instance-unique IDs allow multiple hosts to embed panels. Mobile uses a focused larger Core and a separate two-column domain matrix, not a shrunken desktop map.

## Run the isolated preview

The project uses its existing pinned package manager and lockfile. No new production dependency is added. The release's npm lockfile is out of sync with its declared `xlsx` dependency, so use the existing pnpm lockfile rather than `npm ci`. On pnpm 10.4.1, follow your environment's reviewed build-script permission policy for `esbuild` and `@tailwindcss/oxide`; do not run application startup or database commands just to preview this module.

```bash
pnpm install --frozen-lockfile
pnpm exec vite --config design-preview/vite.config.ts
# http://localhost:4173 defaults to the production-safe unavailable presentation
# ?state=demo, ?state=degraded, ?state=records are labeled isolated fixtures

pnpm run check
pnpm exec tsc -p design-preview/tsconfig.json
pnpm exec vitest run server/premiumIntelligenceCorePresentation.test.ts
pnpm exec vite build --config design-preview/vite.config.ts
```

The preview config does not load environment files or import the application backend. `design-preview/fixtures.ts` is outside the production client entry graph. Do not move it into `client/src`, wire it into production data paths, activate a Core flag, merge another draft, change the release branch or deploy as part of this handoff.

Browser verification is reproducible with `design-preview/verify-browser.py`, Python Playwright, Chromium and an axe-core 4.10.3 script path. Example: `python3 design-preview/verify-browser.py --url http://localhost:4173 --axe /path/to/axe.min.js --out /tmp/core-validation`. It performs read-only local interactions and makes no production/provider API requests. The companion validation report records measured results and limitations.
