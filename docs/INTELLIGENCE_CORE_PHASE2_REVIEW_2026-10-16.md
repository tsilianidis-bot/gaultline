# FAULTLINE Intelligence Core — Phase 2 Review

**Review date:** October 16, 2026

**Branch:** `feature/intelligence-core-phase2-visual`

**Baseline:** `feature/intelligence-core-phase1-evidence-clean` / Phase 1.1 Evidence Readiness
**Production status:** **Not merged, not deployed, and disabled by default.**

## Scope completed

Phase 2 adds a premium, evidence-bound Intelligence Core to the existing **NOW** experience without changing the Pressure Index, canonical MarketState calculation, trading engines, Daily Briefs, blogs, pricing, Stripe, authentication, or the existing five-question navigation.

### Premium visual system

- **Six-domain constellation:** Equities, Bonds / Rates, Credit, Liquidity, Volatility, and Crypto are rendered as interactive WebGL nodes, grouped only from validated source observations.
- **Neutral system map:** Gold links are explicitly described as a conceptual systems map. They do **not** claim a measured relationship, causal transmission path, contagion estimate, confidence level, forecast, or trading signal.
- **Evidence drawer:** Selecting a node exposes the exact provider, original observation timestamp, receipt time, temporal classification, value (where valid), and Integrity Gate reason.
- **Analyst Command Center:** Six evidence-backed domain modules display the mapped observation count, current-use eligibility, most recent source time, and `CURRENT`, `DEGRADED`, or `UNAVAILABLE` state. No uptime percentage or synthetic activity metric is used.
- **Intelligence Activity Stream:** The view shows the completed evidence capture and timestamped original source observations. It transparently reserves material-change and assessment entries for the separately enabled, append-only ledger; it does not simulate activity.
- **Graceful degradation:** The Core renders explicit `DISABLED`, `UNAVAILABLE`, and `DEGRADED` states. It withholds the visual map if no verified evidence snapshot exists.
- **Accessibility and performance:** `prefers-reduced-motion` replaces WebGL with an accessible domain-selector fallback. The heavy Three.js visual is code-split behind the visual feature gate; it is not imported when the gate is off. The mobile Pulse route provides a compact six-domain, status-aware link and continues to show it if canonical mobile state is unavailable.

## Data and integrity controls

### Preserved Phase 1.1 behavior

- CoinGecko source timestamps are preserved; missing timestamps remain unavailable.
- Yahoo observations retain live, delayed, completed-session, stale, and unavailable classifications.
- Stale, invalid, unavailable, or source-unhealthy observations cannot support a current claim.
- The six-domain projection groups evidence only. It does not alter canonical scoring.
- Existing `marketMemory` storage is reused by the evidence snapshot store without a migration.

### Decision Ledger extension

The implementation adds an opt-in `intelligence_core_assessment` record using the existing append-only institutional-event infrastructure.

It records only an initial verified snapshot, a change in canonical MarketState identifier, or a change in six-domain current-source support. Each potential record includes:

- capture timestamp and original provider observations;
- canonical state identifier plus existing canonical regime, pressure index, direction, effective time, and model version when available;
- evidence method and assessment versions;
- source-health state and limitations;
- explicit non-predictive interpretation/scenario boundary;
- confirmation and invalidation conditions; and
- immutable prior/current state payloads for later outcome evaluation.

The ledger does not write unless its dedicated flag is explicitly enabled. Duplicate assessments use the existing unique event key, preserving the original record rather than overwriting it. This is evidence history, **not a claim of validated forecasting performance**.

## Review screenshots

| Surface | Result |
|---|---|
| Desktop NOW / Intelligence Core | [Desktop review image](review-assets/intelligence-core-phase2-desktop.png) |
| 390px mobile Pulse unavailable-state continuity | [Mobile review image](review-assets/intelligence-core-phase2-mobile.png) |

The desktop review exercised node selection and confirmed that choosing **Crypto** updated the evidence drawer with the provider-provided CoinGecko timestamp and validated source status. The 390px mobile review had no horizontal overflow and retained the compact Core entry point while the canonical mobile pulse was intentionally withheld.

## Provider and persistence verification

### Local feature-gated preview

The preview used real configured provider adapters; it did not insert fixtures as live data.

| Surface | Observed result | Presentation behavior |
|---|---|---|
| Yahoo Finance | Completed-session observations were received, then exceeded the Core’s current-use freshness window in the after-hours preview. | Shown with original source/receipt times and classified non-current; no current market claim was made. |
| CoinGecko global aggregate | Provider observation time was available and passed the declared freshness gate in the preview. | Shown as `CURRENT` with its provider timestamp. |
| FRED | `FRED_API_KEY` is not configured in the isolated local preview. | Rates and credit observations were explicitly `UNAVAILABLE`; no substitute values were used. |
| Canonical MarketState | No database was attached to the isolated local preview. | Canonical-state-dependent claims were withheld; the independent verified evidence boundary remained visible. |
| Local `marketMemory` behavior | Append-only claim / insert / latest-readback behavior is unit tested using the existing adapter contract. | No production data was written. |

### Railway production verification blocker

A read-only Railway scope query was attempted with the existing task environment. It could not start because **`RAILWAY_PROJECT_TOKEN` is absent from the active Sandbox shell**. This is a credential-binding problem, not a confirmed Railway outage, billing problem, deployment failure, database failure, or FRED failure.

No production service, environment, logs, FRED configuration, database, or `marketMemory` rows were read or changed as a result. No secret values were requested or exposed.

**Required owner action:** reconnect or repair the existing Railway API/project-token connector for the existing FAULTLINE production project so that this task receives a valid, read-only project token as `RAILWAY_PROJECT_TOKEN`. After that binding exists, the first verification will be the safe scope query `projectToken { projectId environmentId }`, followed only by read-only service, deployment, log, environment-variable-name, and database-readback checks.

## Validation completed

| Check | Result |
|---|---:|
| TypeScript (`pnpm check`) | Passed |
| Focused Integrity / collector / timestamp / ledger tests | **21 tests passed** across 6 test files |
| Full regression suite (`pnpm test`) | **2,086 passed**, 44 skipped; 196 files passed, 7 skipped |
| Production build (`pnpm build`) | Passed |
| Feature-disabled route | Verified response: `enabled: false`, `status: DISABLED`, `snapshot: null` |
| Desktop visual and evidence-drawer interaction | Passed locally |
| Mobile 390px responsive / no horizontal overflow | Passed locally |

The existing full suite contains expected warnings from deliberate negative provider-fallback tests; all executable tests passed.

## Production activation requirements

No merge, deployment, feature flag, schedule, credential, or production data change is authorized by this branch.

Before an activation request, complete the following in order:

1. Repair the read-only Railway project-token binding identified above.
2. Verify the existing production service and deployment branch, FRED configuration presence, canonical MarketState availability, and `marketMemory` **readback** without a write.
3. Review and merge the dedicated Phase 2 pull request after Phase 1.1 is accepted.
4. Deploy with all three new flags **off**; verify no regression to the existing platform.
5. Under a separate explicit authorization, enable `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED=true` only; verify provider timestamps, source health, and persisted snapshot readback in production.
6. Under a separate explicit authorization, enable `FAULTLINE_INTELLIGENCE_CORE_VISUAL_ENABLED=true`; verify the NOW desktop/mobile presentation and evidence drawer against production data.
7. Keep `FAULTLINE_INTELLIGENCE_CORE_LEDGER_ENABLED=false` until an explicit production-data-write approval is given. Only then may append-only assessment recording begin.

This staged release protects the current production system and keeps the Core’s visual sophistication within verified analytical capability.
