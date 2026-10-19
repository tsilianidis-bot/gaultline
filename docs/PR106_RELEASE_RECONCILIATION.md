# PR 106 release reconciliation

Date: 2026-10-19. Throwaway check only. The release branch was not modified, and this branch was not rebased.

| Item | SHA |
| --- | --- |
| Verified implementation | `a2279d0122ca64ba5b2bf4549d67ff74bf7b5e42` |
| Starting point James authorized | `2d0746dfe989fc92b280893ddd681490c7f0d75c` |
| Merge-base with release | `d49f4e32ad9e4ef164ce96df2ad8525fe60f65bc` |
| Current `release/2026-10-05-ux-r3` tip | `f908e04ff265d004488f92a909cba4b2e0cebe3b` |

`git merge-tree --write-tree HEAD origin/release/2026-10-05-ux-r3` exited 1. The release tip was **not** merged into this branch. Production cron, Track Record flags, and the drizzle journal were not changed. Journal tail remains `0073_pressure_v2_shadow`.

## Why it does not apply cleanly

Release and this branch recommitted the same two trees under different SHAs, then both kept editing the evidence and session files:

- `4bd95e4` (this branch) and `3dd8ef9` (release) are the same tree: insider procedure types.
- `e73f83c` (this branch) and `df60fc9` (release) are the same tree: stop false LIVE labels and claim each scheduled session once.

After that shared tree, release added Manus/candidate commits that edit the same files this branch continued to edit through `66ed350`, `32267b3`, `2d0746d`, `4621074`, and `a2279d0`.

## Content conflicts (17)

| File | Release commits that touch it |
| --- | --- |
| `client/src/pages/CryptoSignals.tsx` | `49c090c` fail-closed signal evidence; `5dd60a4` customer market labels |
| `client/src/pages/Signals.tsx` | `df60fc9` (same tree as this branch's earlier commit, then this branch continued) |
| `docs/RC_CRON_HEARTBEAT_REGISTRY.md` | `df60fc9` |
| `server/coingeckoProxy.ts` | `49c090c` |
| `server/cryptoSignals.test.ts` | `49c090c` |
| `server/cryptoSignals.ts` | `49c090c` |
| `server/evidenceFreshness.ts` | `df60fc9`, `743cd24` Smart Discovery freshness |
| `server/remediationIntegrity.test.ts` | `df60fc9`, `743cd24` |
| `server/routers/smartDiscovery.ts` | `df60fc9`, `743cd24` |
| `server/scheduledSeismograph.ts` | `df60fc9`, `743cd24`, `21f5820` track-record capture call |
| `server/scheduledSessionClaim.db.test.ts` | `df60fc9`, `743cd24` |
| `server/scheduledSessionClaim.test.ts` | `df60fc9`, `743cd24` |
| `server/scheduledSessionClaim.ts` | `df60fc9`, `743cd24` |
| `server/signalsHierarchy.ux.test.ts` | `df60fc9`, `49c090c` |
| `server/tradingSignals.ts` | `df60fc9` |
| `server/yahooProxy.ts` | `49c090c`, `db124cd` evidence-readiness timestamps |
| `shared/evidenceStatus.ts` | `743cd24` |

`21f5820` adds `captureTrackRecordFromScheduledRun` inside `runSeismographPipeline`. This branch changes the handler's window, claim, and finalize path. Those edits conflict. Track Record stays default-off; this branch does not activate it.

## Overlap that auto-merged in the throwaway tree only

Not checked out, not tested, not pushed: `client/src/contexts/EngineContext.tsx`, `client/src/pages/DayTradeIntelligence.tsx`, `client/src/pages/InsiderIntelligence.tsx`, `client/src/pages/IntelligenceHub.tsx`, `client/src/pages/SignalDetail.tsx`, `client/src/pages/SmartDiscovery.tsx`, `server/insiderContainment.test.ts`, `server/marketStateService.ts`, `server/marketStateService.test.ts`, `server/ownerSimulation.ts`, `server/routers.ts`, `server/routers/seismograph.ts`, `server/seismographUnified.ts`, `server/signalsProxy.ts`, `server/tradingSignals.test.ts`, `vitest.config.ts`.

`f908e04` (completed session date) touches `server/signalsProxy.ts` and auto-merged in the throwaway. It was not applied.

Non-overlapping release work (intelligence Core visuals, evidence pipeline modules, track-record modules other than the seismograph call, docs under `docs/INTELLIGENCE_CORE_*`) does not by itself make the merge clean. The 17 conflicts block it.

## Other open PRs that touch files this branch also changes

| PR | Intersection with this branch's diff |
| --- | --- |
| #98 `feature/intelligence-core-phase1-rebased` | `server/routers.ts`, `server/yahooProxy.ts` |
| #103 `fix/verified-intelligence-inputs-20261017` | none |
| #105 insider types / quote admission | `client/src/pages/InsiderIntelligence.tsx`, `server/insiderContainment.test.ts`, `server/routers.ts` |
| #84 PI v2 private research | none |
| #88 intelligence integrity gate | none |
| #95 track-record / Core | `docs/RC_CRON_HEARTBEAT_REGISTRY.md`, `server/coingeckoProxy.ts`, `server/routers.ts`, `server/scheduledSeismograph.ts`, `server/yahooProxy.ts`, `vitest.config.ts` |
| #102 integration review #97/#98 | `docs/RC_CRON_HEARTBEAT_REGISTRY.md`, `server/routers.ts`, `server/scheduledSeismograph.ts`, `server/yahooProxy.ts`, `vitest.config.ts` |

Do not retarget or modify those PRs or the release branch.

## Files this branch owns

Candidate work on the release branch should avoid these until a human integration resolves the conflicts:

`client/src/components/ShareCard.tsx`, `client/src/components/TickerSearch.tsx`, `client/src/components/dashboard/PulseMode.tsx`, `client/src/contexts/EngineContext.tsx`, `client/src/pages/Alerts.tsx`, `client/src/pages/AltRotation.tsx`, `client/src/pages/AnalyticsDashboard.tsx`, `client/src/pages/CryptoSignals.tsx`, `client/src/pages/DayTradeIntelligence.tsx`, `client/src/pages/InsiderIntelligence.tsx`, `client/src/pages/IntelligenceHub.tsx`, `client/src/pages/MarketMovers.tsx`, `client/src/pages/OwnerSimulation.tsx`, `client/src/pages/Portfolio.tsx`, `client/src/pages/PressureHistory.tsx`, `client/src/pages/RisingStarDetail.tsx`, `client/src/pages/Scenarios.tsx`, `client/src/pages/SeismographIntelligence.tsx`, `client/src/pages/SeismographicDash.tsx`, `client/src/pages/SignalDetail.tsx`, `client/src/pages/Signals.tsx`, `client/src/pages/SmartDiscovery.tsx`, `client/src/pages/SocialIntelligence.tsx`, `client/src/pages/TodaysStory.tsx`, `client/src/pages/ValidationLab.tsx`, `client/src/pages/Watchlist.tsx`, `client/src/pages/mobile/MobileCrypto.tsx`, `docs/RC_CRON_HEARTBEAT_REGISTRY.md`, `server/coingeckoProxy.ts`, `server/cryptoSignals.test.ts`, `server/cryptoSignals.ts`, `server/dayTradeEngine.ts`, `server/dayTradeEvidence.test.ts`, `server/evidenceFreshness.ts`, `server/evidenceIntegrityFinal.test.ts`, `server/insiderContainment.test.ts`, `server/institutionalOutcomeDisplay.test.ts`, `server/marketStateService.test.ts`, `server/marketStateService.ts`, `server/optionAIntegrity.test.ts`, `server/ownerSimulation.ts`, `server/recoveryEngine.test.ts`, `server/recoveryEngine.ts`, `server/remediationIntegrity.test.ts`, `server/risingStarsVisual.ts`, `server/routers.ts`, `server/routers/seismograph.ts`, `server/routers/smartDiscovery.ts`, `server/scheduledSeismograph.ts`, `server/scheduledSessionClaim.db.test.ts`, `server/scheduledSessionClaim.test.ts`, `server/scheduledSessionClaim.ts`, `server/seismographUnified.ts`, `server/signalConfidenceBoundary.test.ts`, `server/signalConfidenceBoundary.ts`, `server/signalUpgrade.regression.test.ts`, `server/signalsClassifier.ts`, `server/signalsHierarchy.ux.test.ts`, `server/signalsProxy.ts`, `server/simPortfolioEngine.ts`, `server/tradingSignals.test.ts`, `server/tradingSignals.ts`, `server/yahooProxy.ts`, `shared/completedBars.ts`, `shared/evidenceStatus.ts`, `vitest.config.ts`.

## Do not change

- `shared/nyseSession.ts` and the production cron expression `15 20,21 * * 1-5`.
- Canonical MarketState and Pressure Index formulas.
- Authorization, Stripe, and billing.
- Insider containment behavior.
- Forward capture: `SCHEDULED_CRON` only. Claim, reconcile, and finalize stay fail-closed for every other trigger.
- Track Record modules and flags. Do not turn the flag on. Do not edit the seismograph claim/finalize path to retarget that capture.
- Frozen engine files: `server/tradePreflight.ts`, `server/cryptoEngine.ts`, `server/signalOutlook.ts`, `server/preFlight.ts`.
- Drizzle journal. No migration. Tail stays `0073_pressure_v2_shadow`.
