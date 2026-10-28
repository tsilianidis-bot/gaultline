# RC cron / heartbeat registry

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Policy:** document only. This RC does **not** create, retarget, or fire Forge Heartbeat jobs. Do not point production schedules at a random preview.

## How auth actually works

Mounts are explicit in `server/_core/index.ts` (not auto-registered). Wrapper:

```ts
CRON_SECRET = process.env.CRON_SECRET ?? process.env.HEARTBEAT_SECRET ?? ''
// next() if: secret empty OR bearer matches OR (localhost && NODE_ENV=development)
```

| Fact | Evidence |
| --- | --- |
| Empty `CRON_SECRET` **fail-opens** all `requireCron` routes | `index.ts` `if (!CRON_SECRET \|\| …)` |
| Platform secrets file has **no** `CRON_SECRET` / `HEARTBEAT_SECRET` | `docs/RC_PROJECT_CONFIG_SHAPES.md` |
| Some handlers **also** require `sdk.authenticateRequest` → `user.isCron` | blog, X, drip, organic, weekly report |
| Others trust `requireCron` only | ping, daily-snapshot, seismograph, shadow, rising-stars, ledger, sim |
| In-repo Heartbeat **API** exists (`create/update/delete/listHeartbeatJob`) | `server/_core/heartbeat.ts` — **no job catalog is persisted in git** |
| GitHub Actions has **no** schedule for these routes | `.github/workflows/faultline-verify.yml` is verify-only; Manus deploy job refuses |

Schedules below are **comments in handlers**, not a live Forge export. Owner must confirm in Manus Schedules UI.

## Registry

| Route | Trigger / documented schedule | Auth | Expected output | Failure | Verification |
| --- | --- | --- | --- | --- | --- |
| `POST /api/scheduled/ping` | Owner heartbeat (health) | `requireCron` | `{ ok: true }` | N/A | `curl -X POST -H "Authorization: Bearer $CRON_SECRET"` → 200 |
| `POST /api/scheduled/daily-snapshot` | Comment: **06:30 UTC weekdays** | `requireCron` only | `{ ok, date, score }` from live `calculateFaultlinePressure` + optional diagnostic | 500 `{ ok:false, error }`; diagnostic miss continues without crash/bull | DB `dailyReadingSnapshots` row for UTC day; logs `[DailySnapshot]` |
| `POST /api/scheduled/publish-blog` | AGENT cron (body = post) | `requireCron` **and** `isCron` | 200 inserted post; 409 slug/same-day title | 400 missing fields; 403 not cron; 503 no DB | Row in `blogPosts` |
| `POST /api/scheduled/auto-publish-drafts` | Owner cadence | `requireCron` + `isCron` (same file) | Publishes due drafts | 403/503 | Drafts → published |
| `POST /api/scheduled/x-post-scheduled` | Comment: **12:10 / 16:00 / 19:45 UTC** (8:10 / 12:00 / 15:45 ET). Body `{ postType }` | `requireCron` + `isCron` | `{ ok, postType, xPostId }` or `{ ok, skipped:"no-content" }` | 403; 500 posts `xPostQueue` status `failed` | Queue row + X status |
| `POST /api/scheduled/x-news-monitor` | Comment: **every 15 min** | `requireCron` + `isCron` | `{ ok, skipped:"no-breaking-headline" }` or posted id | 403/500 | Queue + cooldown |
| `POST /api/scheduled/daily-sim-portfolio` | Comment: **21:00 UTC weekdays** | `requireCron` only | Sim valuation + journal persisted | 500 on engine throw | `simPortfolio*` tables |
| `POST /api/scheduled/generate-organic-content` | Owner / agent body `contentType` | `requireCron` + cron/admin SDK | Generator JSON | 400 invalid type; 403; 500 | `organicContent` row |
| `POST /api/scheduled/refresh-signal-pages` | Owner | `requireCron` + cron/admin | Per-symbol `{ ok }` list | 403/500 | `signalPages` |
| `POST /api/scheduled/ledger-evaluation` | Comment: **every 6 hours** | `requireCron` only | `{ ok, evaluated, skipped, errors, results }` max 100; never overwrites user outcomes | 500 + stack | `decision_ledger` auto-eval flags |
| `POST /api/scheduled/weekly-improvement-report` | Comment: **Monday 06:00 UTC**. File comment still says `/weeklyImprovementReport` (**path drift**) | `requireCron` + SDK in handler | Idempotent skip if week exists; else LLM report row | Auth fail / LLM / DB | `ai_improvement_reports` |
| `POST /api/scheduled/drip-email` | Comment: **hourly** | `requireCron` + cron/admin SDK | `{ sent1, sent2, sent3 }` (handler continues per-user on send fail) | 403; SendGrid 401 historically | `onboardingEmailSequence`; **not WORKING** until SendGrid live |
| `POST /api/scheduled/seismograph-daily` | **Admission window:** 16:15–16:45 America/New_York on valid NYSE sessions (`shared/nyseSession.ts`). **Candidate crontab, not applied:** `15 20,21 * * 1-5` UTC (`config/scheduler-candidate.txt`). Exactly one fire is 16:15 ET. Production cron remains `0 18 * * *` UTC until James applies the candidate. See `docs/RC_DEPLOYMENT_AND_SCHEDULER_RUNBOOK.md`. | `requireCron` only | 200 `{ ok, date, pressureScore, regime, … }` for the admitted run; 200 `{ ok:true, execution:"already_completed" }` only when the stored claim is completed; **409** `{ ok:false, alert:true }` for outside-window, DST companion, incomplete/failed claims, and exhausted recovery; 503 when the claim database is unavailable | **Non-2xx so `curl -f` fails**, with `[Seismograph][SCHEDULE-ALERT]`; a missing database claim does not capture forward records | In-process guard plus `marketMemory` claim `seismograph-scheduled-session:YYYY-MM-DD` (leased, then completed or failed). A failed or expired lease can be recovered only inside that session's NYSE window, only for SCHEDULED_CRON, and only when insert-only `seismograph-scheduled-outcome:YYYY-MM-DD` is absent. Recovery is one compare-and-swap and stops after that single recovery (`exhausted`). A crash after the outcome insert and before the score write is reconciled once inside the NYSE window when evidence is still verified; otherwise the outcome is `skipped: unrecoverable`. Reconcile does not capture a second forward record. The out-of-window `15 20,21` fire, and the next session's in-window fire, finalize stale pending or scoring rows for sessions outside the NYSE window as `skipped: unrecoverable`. That step does not write a late score, does not capture a forward record, and does not run the pipeline. Production cron is unchanged. |
| `POST /api/scheduled/shadow-forward-outcomes` | Owner (shadow eval) | `requireCron` only | `{ ok, collected }` or `{ ok:false, error:"DB unavailable" }` **200 even on no DB** | 500 `{ ok:false, error:"Failed" }` | `shadowForwardOutcomes.collectedAt` |
| `POST /api/scheduled/shadow-daily-summary` | Owner daily | `requireCron` only | Summary row or `{ message:"No readings today" }` | 500 | `shadowDailySummaries` |
| `POST /api/scheduled/rising-stars-continuity` | Owner daily | `requireCron` only | `{ ok, historyClass:"live_verified", … }` | 500 `rising_stars_daily_continuity_failed` | `risingStarHistoryJobs` |
| `POST /api/scheduled/systemic-regime-infer` | Documented Railway cron **daily 19:00 UTC**, written when seismograph production was `0 18 * * *` UTC. The infer job reads `seismograph:latest_output` before Signal Convergence (`server/systemicRegime/scheduled.ts`). Candidate seismograph `15 20,21 * * 1-5` finishes at 20:15 UTC (EDT) or 21:15 UTC (EST), which is **after** 19:00 UTC, so 19:00 would converge on the previous session. **Candidate, not applied:** `30 21 * * 1-5` UTC. | `requireCron` only | Load approved PCA+HMM bundle, persist `LIVE_INFERENCE` reading + Signal Convergence. **Never fits.** | 200 `{ok:false,skipped}` if no approved model; 500 on crash | `systemicRegimeReadings` LIVE_INFERENCE |
| `POST /api/scheduled/systemic-regime-train` | Railway cron **weekly Monday 06:15 UTC** | `requireCron` only | Fit chosen n-state scaler+PCA+HMM offline (`--skip-compare`); write approved joblib + DB artifact. Not an API-request path. | 500 | `quant/systemic-regime/artifacts/approved` + `systemicRegimeModels` |
| `POST /api/scheduled/daily-brief` | Comment: **07:00 UTC weekdays** | `requireCron` | Publish or draft after evidence guard | Fail closed on missing engine data (no fabrication) | `daily_brief_snapshots` / `organicContent` |
| `POST /api/scheduled/weekly-review` | Comment: **Sunday 08:00 UTC** | `requireCron` | Same pipeline, weekly type | Same | Publishing tables |
| `POST /api/scheduled/monthly-report` | Comment: **1st 09:00 UTC** | `requireCron` | Monthly type | Same | Publishing tables |
| `POST /api/scheduled/daily-brief/manual` | Owner/manual | `requireCron` | Same as daily-brief | Same | Same |
| `GET /api/publishing/status` | Ops | `requireCron` | Schedule stats | 401 if secret set and bearer wrong | — |
| `POST /api/publishing/toggle-active` | Ops | `requireCron` | Toggle | 401 | — |
| `POST /api/publishing/publish-draft/:id` | Ops | `requireCron` | Publish one draft | 401 | — |

## CURRENT impact

| Job | Can write CURRENT? |
| --- | --- |
| `seismograph-daily` | **Yes — Champion persist + cache invalidate** |
| `daily-snapshot` | Today’s snapshot number (Preflight / history) |
| `daily-brief` / weekly / monthly | Archived / published narrative from live engines |
| `rising-stars-continuity` | Live outlook Pressure snapshot into history |
| `systemic-regime-infer` | Independent Systemic Regime row + Signal Convergence. **Does not write Pressure Index / Champion CURRENT.** |
| `systemic-regime-train` | Frozen model artifacts only |
| X / drip / blog / organic / sim / shadow / ledger | Publishing, email, sim, or ledger — not EngineContext |

## Owner verification (preview only)

```bash
# 1) Confirm secret is SET on the host (empty secret fail-opens — do not ship that)
# 2) Ping
curl -sS -X POST "$PREVIEW_URL/api/scheduled/ping" \
  -H "Authorization: Bearer $CRON_SECRET"
# expect {"ok":true}

# 3) Do NOT retarget production Heartbeat URLs to preview
# 4) Preferred seismograph crontab is `15 16 * * 1-5` in America/New_York.
#    Railway cron does not accept that timezone (UTC only; see the registry row).
#    Candidate Railway schedule is `15 20,21 * * 1-5` (see config/scheduler-candidate.txt).
#    This file does not change the live production cron. Skipped callbacks are HTTP 409.
#    A second process is stopped by the marketMemory unique claim
#    `seismograph-scheduled-session:<ET date>`. A live lease, a completed claim,
#    or an existing outcome row blocks another run. A failed or expired lease can
#    be recovered only inside that same NYSE window, only as SCHEDULED_CRON, and
#    only by winning one compare-and-swap while the outcome row is absent.
#    If the claim cannot be recorded, the handler returns 503 and does not
#    capture forward evidence. This file does not change the live production cron.
```

There is **no** in-repo proof any job has `lastExecutedAt`. Treat all schedules as **UNVERIFIED** until the owner screenshot/export of Forge jobs.

## Related

- `docs/RC_PREVIEW_BUILD_IDENTITY.md`
- `references/periodic-updates.md`
- `server/_core/heartbeat.ts`
