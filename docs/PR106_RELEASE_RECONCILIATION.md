# PR 106 release reconciliation

Date: 2026-10-19. `origin/release/2026-10-05-ux-r3` was merged into this branch. The release branch was not pushed, rebased, or retargeted. No other PR was modified.

| Item | SHA |
| --- | --- |
| Release tip merged | `f908e04ff265d004488f92a909cba4b2e0cebe3b` |
| Tip movement since the prior check | none — still `f908e04` |
| Merge-base before this merge | `d49f4e32ad9e4ef164ce96df2ad8525fe60f65bc` |
| Journal tail | `0073_pressure_v2_shadow` (unchanged; no `drizzle/` diff) |

Release commits included: `3dd8ef9`, `df60fc9`, `7bd2192`, `d0ccd2a`, `1e2a03f`, `db124cd`, `2c8d798`, `21f5820`, `743cd24`, `49c090c`, `5dd60a4`, `f908e04`.

## Conflict resolution

| File | Side | Reason |
| --- | --- | --- |
| `client/src/pages/CryptoSignals.tsx` | #106 | Five-state badge, null-safe dominance readout, finite-only momentum leader. Release `toFixed` and `hasData` label were not kept. |
| `client/src/pages/Signals.tsx` | #106 | RSI `.toFixed` only when the estimate is non-null. |
| `docs/RC_CRON_HEARTBEAT_REGISTRY.md` | #106 | Documents finalize of stale rows. Cron expression unchanged. |
| `server/coingeckoProxy.ts` | release | `interval=daily` and the 35-minute completed-daily buffer. |
| `server/cryptoSignals.test.ts` | #106 | 40-bar MACD test. The release 30-bar MACD test asserted a series shorter than the 35-close minimum. |
| `server/cryptoSignals.ts` | #106, plus release daily admission | RSI null below 15 and on a flat series. No RSI from 24h change. No momentum 50. Bars pass `completedCoinDailyBars` before scoring. |
| `server/evidenceFreshness.ts` | #106 | Required `macro`/`ticker` scope, quote observations, no `computedAt` substitute. |
| `server/remediationIntegrity.test.ts` | #106 | Scope and provider-row cases. |
| `server/routers/smartDiscovery.ts` | #106 | Ask ticker quote requirement. `fred.asOf ?? computedAt` was not kept. |
| `server/scheduledSeismograph.ts` | #106 handler, release hook | Finalize, reconcile, and cron-only transitions. `captureTrackRecordFromScheduledRun` from `21f5820` stays in the pipeline and no-ops unless `TRACK_RECORD_CRON_WRITES=true` and the flag are on. |
| `server/scheduledSessionClaim.ts` and both claim tests | #106 | Generation cap, reconcile-once, out-of-window finalize, `SCHEDULED_CRON` only. |
| `server/signalsHierarchy.ux.test.ts` | #106 | Does not require the release `rsi : 50` string. Engine freeze vs `1cfa1299` stays. |
| `server/tradingSignals.ts` | #106 | Withheld confidence, RSI, and momentum stay null. Release used 30 / 0 / 0. |
| `server/yahooProxy.ts` | #106 rule | `isEquityDailyBarComplete`: today's bar is kept after the NYSE close, including an early close, and dropped before it. The release helper dropped the whole New York date after the close. |
| `shared/evidenceStatus.ts` | #106 | 60s skew and future-timestamp rejection. |

Auto-merged and kept as the release tip has them: Track Record pages, `trackRecordCapture.ts`, SQL scripts, `server/db.ts`, the evidence pipeline (`7bd2192`, `db124cd`), the NOW Core visual (`2c8d798`), and `f908e04` `selectEffectiveTradeDate` in `server/signalsProxy.ts`.

## Release tests adjusted

| Test | Why |
| --- | --- |
| `server/cryptoIndicatorIntegrity.test.ts` | Withheld rationale is the #106 sentence. The page uses `CryptoRsiReadout` instead of an unguarded `rsiIsTrue ? (` toFixed. RSI wording is still forbidden when bars are missing. The direct-caller current-candle case still expects `rsiIsTrue === false`. |
| `server/evidenceIntegrityFinal.test.ts` CoinGecko case | `days=30` is now `interval=daily`. A candle inside the 35-minute buffer is dropped; an older close is kept. |
| `server/optionAIntegrity.test.ts` | The 4-hour `days=30` comment assertion now requires `interval=daily`. |
| `server/completedCandleIntegrity.test.ts` | Added after-close and Christmas Eve early-close cases. During-session exclusions remain. |
| `server/cryptoSignals.test.ts` | Dropped the release 30-bar MACD expectation (below the 35-close minimum). |
| `server/trackRecordWorkflow.e2e.test.ts` | Port `3307` → `3309` so the isolated server does not attach to the disposable claim database already bound on 3307. SQL, flags, and capture behaviour are unchanged. |

## Files this branch owns

Concurrent release-branch work should avoid these until the next review:

`client/src/components/HomeCryptoSection.tsx`, `client/src/components/ShareCard.tsx`, `client/src/components/TickerSearch.tsx`, `client/src/components/dashboard/PulseMode.tsx`, `client/src/lib/nullableFormat.ts`, `client/src/pages/Alerts.tsx`, `client/src/pages/AltRotation.tsx`, `client/src/pages/CryptoSearch.tsx`, `client/src/pages/CryptoSignals.tsx`, `client/src/pages/DayTradeIntelligence.tsx`, `client/src/pages/OwnerSimulation.tsx`, `client/src/pages/SeismographicDash.tsx`, `client/src/pages/Signals.tsx`, `client/src/pages/SmartDiscovery.tsx`, `client/src/pages/TodaysStory.tsx`, `client/src/pages/Watchlist.tsx`, `client/src/pages/mobile/MobileCrypto.tsx`, `client/src/pages/mobile/MobileSignals.tsx`, `docs/PR106_RELEASE_RECONCILIATION.md`, `docs/RC_CRON_HEARTBEAT_REGISTRY.md`, `server/coingeckoProxy.ts`, `server/completedCandleIntegrity.test.ts`, `server/cryptoIndicatorIntegrity.test.ts`, `server/cryptoSignals.ts`, `server/cryptoSignals.test.ts`, `server/dayTradeEngine.ts`, `server/evidenceFreshness.ts`, `server/evidenceIntegrityFinal.test.ts`, `server/mergedTreeProbes.test.ts`, `server/optionAIntegrity.test.ts`, `server/ownerSimulation.ts`, `server/remediationIntegrity.test.ts`, `server/routers.ts`, `server/routers/smartDiscovery.ts`, `server/scheduledSeismograph.ts`, `server/scheduledSessionClaim.ts`, `server/scheduledSessionClaim.test.ts`, `server/scheduledSessionClaim.db.test.ts`, `server/screenerNullRender.test.ts`, `server/signalConfidenceBoundary.ts`, `server/signalsClassifier.ts`, `server/signalsHierarchy.ux.test.ts`, `server/signalsProxy.ts`, `server/simPortfolioEngine.ts`, `server/tradingSignals.ts`, `server/yahooProxy.ts`, `shared/completedBars.ts`, `shared/evidenceStatus.ts`.

## Do not change

- `shared/nyseSession.ts`, Pressure Index formulas, canonical MarketState, authorization, Stripe/billing, insider containment.
- Production cron `15 20,21 * * 1-5` and Railway schedules.
- Drizzle journal. Tail stays `0073_pressure_v2_shadow`.
- Track Record flags, `TRACK_RECORD_CRON_WRITES`, and the capture hook's default-off behaviour.
- Frozen engines: `server/tradePreflight.ts`, `server/signalOutlook.ts`, `server/preFlight.ts`. `server/cryptoEngine.ts` stays frozen except the authorized null handling: a missing BTC dominance is withheld instead of substituted with 55; a missing total market cap, 24h volume, or 24h market-cap change is withheld from the systemic score instead of being scored as 0 or 5; and a missing coin price, 24h range, volume, or market cap is left out of the asset score. Present inputs keep the prior weighted formula.
