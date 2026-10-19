# Six-Domain Intelligence Architecture — capture qualification

**Scope/pin:** `marketing/premium-homepage-20261019` at `49d6ab7dbf97dcca272e96339217acf9e8ca022d` (PR 109 candidate). This is a read-only source/evidence review; no runtime, browser, provider, production, Railway, database, API, credential, login, or checkout action was taken.

## Decision: BLOCKED

There is **no operationally qualified Six-Domain observation or admissible raster capture** in this candidate. Do not replace the gallery placeholder with a render, a static architecture screenshot, a fixture, a simulated signal, or the existing marketing preview PNGs.

### File:line evidence

| Finding | Evidence |
|---|---|
| Gallery admissions are presently zero; marketing previews are layout-only and not operational proof. | `docs/marketing/SCREENSHOT_EVIDENCE.md:3-11` |
| The six-domain hero itself deliberately constructs `createUnavailableCore("Illustrative architecture. No live domain evidence is connected…")`. | `client/src/components/marketing/MarketingIntelligenceHero.tsx:54-61` |
| Its rendered topology is explicitly **ILLUSTRATIVE**, not live risk transmission or verified causation, with no scores/source states simulated. | `client/src/components/marketing/MarketingIntelligenceHero.tsx:176-184,209-214`; `docs/marketing/SCREENSHOT_EVIDENCE.md:13-17` |
| The gallery record `six-domain-intelligence` is `pending`; it describes a proposed architecture, intentionally has no dashboard/chart/score/signal, and has no capture metadata. | `client/src/components/marketing/showcaseEvidence.ts:105-117` |
| The sole admission function is fail-closed: requires verified operational/source checks, same-origin `/marketing/` raster, capture time, branch/SHA, `public-sanitized`, an allowed observation classification and timestamp, sensitive-info review, and no sensitive information. | `client/src/components/marketing/showcaseEvidence.ts:149-205` |
| The visual contract permits unavailable evidence but the production adapter expressly excludes fixtures/demonstrations from its graph. | `client/src/components/intelligence-core-visual/types.ts:21-46,88-119`; `client/src/components/intelligence-core-visual/adapter.ts:860-942` |
| The only documented local source activity is dated 2026-10-16: one genuine CoinGecko timing check and Yahoo observations classified `completed_session`; local FRED was unavailable. It is not a persisted, current six-domain observation set. | `docs/INTELLIGENCE_CORE_PHASE1_1_EVIDENCE_READINESS_2026-10-16.md:30-38,42-46` |
| The readiness decision permits feature-flagged visual work but explicitly says not to activate a production visual claiming live/current six-domain coverage. | `docs/INTELLIGENCE_CORE_PHASE1_1_EVIDENCE_READINESS_2026-10-16.md:62-66` |

**Local persisted materials found:** only marketing layout previews under `docs/marketing/previews/` and the dated readiness narrative above. There is no tracked `client/public/marketing/` capture and no eligible manifest record. The preview images are expressly non-operational (`docs/marketing/SCREENSHOT_EVIDENCE.md:3`; `docs/marketing/VERIFICATION.md:82`). Synthetic/local fake-DB test coverage described in readiness documentation is not real operation and does not qualify a capture.

## Routes and capture boundary

| Route | Status | Capture use |
|---|---|---|
| `/` (marketing candidate; Six-Domain hero) | Public architecture illustration; no account note and a link to the public reading are rendered. | **Not eligible**: capture can only document `demonstration/unavailable` architecture, never operational six-domain output. |
| `/pressure-index` | Authorized public canonical-reading route; the hero links to it (`MarketingIntelligenceHero.tsx:135-147`), and `marketState.current` is a `publicProcedure` (`server/routers/marketState.ts:9-20`). | **Not a Six-Domain capture route**. It is the only verified public non-login route potentially useful to establish a separately sourced canonical Pressure Index reading, subject to its own qualification. It must not be relabeled as Six-Domain Intelligence. |

No public, operationally wired Six-Domain experience route is established by the pinned candidate. PR 107 is the only current PR 106–108 whose changed-file list touches the intelligence-core visual files; it is not part of this pinned PR 109 candidate and supplies no capture evidence. PRs 106 and 108 were not audited further.

## Exact blockers / required nonproduction resource

1. **Real local six-domain data absent.** The candidate hero hard-codes unavailable observations. Obtain a sanctioned **nonproduction canonical-intelligence/evidence snapshot source** that supplies all six domain records with source lineage and timestamps (not fixtures, mocks, or manually entered values). It must be wired to the full Six-Domain experience rather than the marketing illustration.
2. **No public operational Six-Domain route.** With feature-flag approval, expose that real-source experience on an explicitly authorized, no-login **nonproduction public route**. Do not activate production. Do not substitute `/pressure-index` or the architecture hero.
3. **No admissible capture file/record.** After real observations render, create sanitized desktop and mobile original rasters at same-origin `/marketing/...` paths and preserve the underlying operational verification report and raw capture separately.
4. **Per-capture admission record required.** For **each** desktop and mobile raster record: source branch `marketing/premium-homepage-20261019`, SHA `49d6ab7dbf97dcca272e96339217acf9e8ca022d` (or the actual approved capture build), ISO capture date/time, each displayed `observationAt`, `live`/`recent`/`delayed`/`historical` classification, `operationalVerified: true`, `sourceVerified: true`, `dataClassification: public-sanitized`, completed sensitive-information review, and `containsSensitiveInformation: false`. Do not mark any field true without the review.

## Parent-safe verification/capture procedure (runtime/browser owner only)

1. Use only an approved local/nonproduction runtime and the nonproduction resource above; no production/Railway/database/secrets calls, no authentication or checkout.
2. Open the explicit public Six-Domain route. Confirm all six displayed records have genuine source lineage, source status, `observationAt`, and allowed classification; verify no unavailable/mocked placeholder is presented as a live observation.
3. Independently record operational behavior and source provenance before capture. If any source is unavailable, stale beyond its allowed policy, static-only, simulated, or lacks a date/classification, stop: the category remains blocked.
4. Privacy-review the complete viewport/dialog states for names, account/session data, tokens, URLs with sensitive parameters, proprietary identifiers, and unintended historical/private data. Sanitize only by approved redaction that does not alter observations; otherwise do not capture.
5. Capture original desktop and mobile rasters, save them under same-origin `/marketing/…`, preserve originals plus the verification report, then populate the manifest fields and confirm `hasVerifiedCapture(...)` admits each. If the gate does not pass, retain the placeholder.

**Additional-feature selection:** none. The assignment authorizes qualification of exactly one category; expanding into Pressure Index or another gallery category would duplicate/unnecessarily audit other engines. The Pressure Index is mentioned only as a route-boundary control, not as a second qualification.

## Parent scope clarification

This was a source-only review with no session supplied, not a claim that the user prohibited all login. An explicitly authorized nonproduction test session may later qualify member-only captures without changing authentication or customer access. No such resource is available in this checkout. Public links above are documentation/preview destinations, not proof that data is currently operational. The source review is pinned to the original candidate SHA; subsequent changes are marketing/bootstrap only and do not activate these capabilities.
