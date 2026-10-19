# Qualification — Pressure Index and Market Overview (`pressure-overview`)

**Decision: BLOCKED** (read-only review on 2026-10-19)
**Candidate identity:** `marketing/premium-homepage-20261019` @ `49d6ab7dbf97dcca272e96339217acf9e8ca022d`
**Selected strongest potentially-public feature:** **canonical Public Pressure Index reading** at `/pressure-index`. It is the only permissible no-login candidate in this category. **Market Overview is not a public candidate.**

## Result

No qualifying desktop or mobile operational capture exists locally. The gallery manifest deliberately has a pending `pressure-index` record: all operational/source/privacy booleans are false and capture/provenance/timing fields are null (`client/src/components/marketing/showcaseEvidence.ts:52-65,76-90`). The fail-closed gate requires verified operation and source, a same-origin `/marketing/` raster, capture time, branch, SHA, `public-sanitized`, an allowed observation classification and `observationAt`, plus a completed no-sensitive-information review (`showcaseEvidence.ts:149-197`). The gallery therefore correctly shows a **TEMPORARY DESIGN PLACEHOLDER**, not a product capture (`client/src/components/marketing/ProductShowcase.tsx:98-101,155-205`).

`docs/marketing/SCREENSHOT_EVIDENCE.md:3,7-11` confirms that every gallery entry has zero eligible images and that renders/metadata alone are not proof. Its static preview images are expressly layout-only, not operational evidence (`docs/marketing/VERIFICATION.md:80-82`).

## Routes and category boundary

| Surface | Route / status | Qualification disposition |
|---|---|---|
| **Public Pressure Index** | **`/pressure-index`** — explicitly no-login public route (`client/src/App.tsx:404-415`); marketing CTA links here (`ProductShowcase.tsx:191-197`). | **Only authorized public capture route**, subject to the nonproduction runtime resource below. It reads one canonical snapshot every 60s (`client/src/hooks/usePressureSnapshot.ts:5-16`) and shows an explicit unavailable state rather than inventing a score (`client/src/lib/pressureSnapshot.ts:153-181`; `PressureSnapshotGauge.tsx:95-125`). |
| **Market Overview / Market Movers** | `/app/market-movers` hosts `MarketOverview` (`client/src/App.tsx:812-813`; `client/src/pages/MarketMovers.tsx:5-26`). | **Not eligible.** It is inside the product `/app/*` router (`App.tsx:736-836`), whose no-user product path invokes the auth gate (`App.tsx:942-964`). Its top performers, crypto, and watchlist requests are user-enabled (`MarketOverview.tsx:472-485`), and a capture would involve protected/user-specific material. No login is allowed for this task. |
| **`/demo/pressure`** | Redirects into the product pressure route (`App.tsx:280-297`). | **Explicitly excluded.** DemoContext creates a synthetic premium demo user and bypasses OAuth (`client/src/contexts/DemoContext.tsx:1-8,41-65`), so it cannot establish genuine operation or a real observation. |

The examined PR heads do not remove this blocker. Path-level review found no target-contract change in #107. Direct relevant changes were inspected by `git show`: #106 touched the Market Movers host (not a public data admission) and #108 refactored the protected app shell/navigation; neither supplies a public, sourced capture or capture record. PR #109 itself records #106/#107/#108 as separate approval dependencies (`docs/marketing/VERIFICATION.md:68-74`).

## Local persisted material — found, but unusable for admission

1. **Historic production-origin QA fixtures, not nonproduction evidence.** `server/__fixtures__/prod-2026-10-01/` contains canonical, market-state, global-snapshot, and quotes payloads. The test itself says they are **production API payloads** captured during an Oct. 1 QA pass/deployments (`server/failClosedCanonical.test.ts:1-7,52-60`), and the inventory likewise calls them “prod captures” (`docs/probability/INVENTORY.md:3-6`). The canonical payload is dated 2026-10-01 and reports pressure `33`, but it has no screenshot admission record, capture date, reviewer privacy decision, or approved nonproduction runtime provenance (`server/__fixtures__/prod-2026-10-01/canonical-current.json:2-16,180-206`). Do **not** use it: it is historic production-origin test material, not an authorized nonproduction observation.
2. **Historic FRED reproducibility fixture, not operational evidence.** `server/pressure/__fixtures__/fred-2026-10-12.json:2` labels raw FRED latest-vintage downloads, bounded to observations through 2026-10-09. The methodology identifies it as the fixture for a reproducibility unit test (`docs/pressure/V1_METHODOLOGY.md:32-33`). It may support historical parsing/reproducibility review only; it cannot qualify the currently rendered application or substitute for a runtime observation.
3. **No admitted local marketing raster.** Eligibility requires a path under `/marketing/` (`showcaseEvidence.ts:149-159`), while the repository’s only candidate screenshots are `docs/marketing/previews/*`; the verification record classifies them as sanitized layout captures only (`VERIFICATION.md:80-82`). No local database artifact or approved nonproduction canonical-state resource was found during this review.

**Conclusion on local resources:** locally saved historical data does exist, but it is either fixture-bound or production-origin. There is **no genuine, source-qualified nonproduction observation resource** that can be safely promoted under this task’s restrictions.

## Exact missing nonproduction resource

An authorized, isolated **nonproduction app + backend** that serves `/pressure-index` and a real response from `marketState.canonicalCurrent` using a newly generated, governed canonical manifest in its own nonproduction `intelligenceStateManifests` store. The current server contract proves why: `canonicalCurrent` is public only after `getAuthoritativeCanonicalIntelligenceState()` returns a state (`server/routers/marketState.ts:9-20`), and that function reads the latest database manifest and returns `null` if no DB/row exists (`server/canonicalIntelligenceState.ts:180-188`).

That resource must use approved public-source observations without production/Railway/production-DB/API credentials, retain source input provenance and timestamps, and fail closed if unavailable. It must not load the checked-in fixtures or synthesize a score. The pressure methodology requires all eight inputs to be finite, plausible and fresh before a verified computation, otherwise preserving an old reading or failing closed (`docs/pressure/V1_METHODOLOGY.md:25-30`). There is no public anonymous Market Overview variant that avoids the user watchlist/protected data; creating or reclassifying one is outside this review.

## Safe runtime verification and capture handoff (parent only)

1. In the approved nonproduction runtime, visit **only** `/pressure-index` anonymously at desktop and mobile viewports. Do not visit `/demo/*` or `/app/*`, log in, start checkout, call production endpoints, or load fixtures.
2. Confirm the canonical public query returns a real state from the isolated resource and that UI score, regime, vector values, and **AS OF** timestamp agree with that one state. The gauge is explicitly bound to one snapshot and exposes `stateId`/score attributes (`PressureSnapshotGauge.tsx:31-45,84-125`). If it displays loading/unavailable, stop: do not capture as evidence.
3. Independently record the resource’s observation timestamp (use canonical `effectiveAt`, shown as the snapshot `asOf`; `pressureSnapshot.ts:100-107,142-150`) and classify it **only** from actual source freshness: `live`, `recent`, `delayed`, or `historical` — never `demonstration`.
4. Capture genuine desktop and mobile screenshots only after the above checks. Perform a privacy review confirming no account data, email, identifier, token, internal URL, user watchlist, or other sensitive information is visible. Sanitize/crop only to remove such information without altering readings or provenance.
5. For **each** raster, retain the original alongside the report and create its admission record with: `status=verified`; `operationalVerified=true`; `sourceVerified=true`; same-origin `actualCapturePath` under `/marketing/`; `sourceBranch=marketing/premium-homepage-20261019`; `sourceSha=49d6ab7dbf97dcca272e96339217acf9e8ca022d`; real ISO `capturedAt`; real ISO `observationAt`; actual allowed observation classification; `dataClassification=public-sanitized`; `sensitiveInformationReviewed=true`; `containsSensitiveInformation=false`. Do not fill these values until verified.
6. Preserve the pending gallery state unless all checks pass. A build, static render, fixture test, architecture illustration, or metadata record remains insufficient (`SCREENSHOT_EVIDENCE.md:9-11`).

## Evidence paths

- `docs/marketing/SCREENSHOT_EVIDENCE.md`
- `docs/marketing/VERIFICATION.md`
- `client/src/components/marketing/showcaseEvidence.ts`
- `client/src/components/marketing/ProductShowcase.tsx`
- `client/src/App.tsx`
- `client/src/pages/PressureIndex.tsx`
- `client/src/hooks/usePressureSnapshot.ts`
- `client/src/lib/pressureSnapshot.ts`
- `client/src/components/PressureSnapshotGauge.tsx`
- `server/routers/marketState.ts`
- `server/canonicalIntelligenceState.ts`
- `client/src/components/MarketOverview.tsx`
- `client/src/pages/MarketMovers.tsx`
- `client/src/contexts/DemoContext.tsx`
- `server/failClosedCanonical.test.ts`
- `server/__fixtures__/prod-2026-10-01/canonical-current.json`
- `server/pressure/__fixtures__/fred-2026-10-12.json`
- `docs/pressure/V1_METHODOLOGY.md`

## Parent scope clarification

This was a source-only review with no session supplied, not a claim that the user prohibited all login. An explicitly authorized nonproduction test session may later qualify member-only captures without changing authentication or customer access. No such resource is available in this checkout. Public links above are documentation/preview destinations, not proof that data is currently operational. The source review is pinned to the original candidate SHA; subsequent changes are marketing/bootstrap only and do not activate these capabilities.
