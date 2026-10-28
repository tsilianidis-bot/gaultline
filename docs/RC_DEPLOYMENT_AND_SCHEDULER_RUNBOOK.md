# Deployment and scheduler runbook

Date: 2026-10-28. This document does not deploy, merge, tag, change Railway, change repository settings, apply migrations, or enable `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` or `TRACK_RECORD_CRON_WRITES`.

Production today:

| Item | Value |
| --- | --- |
| Deployed commit | `1cb5dee13832c0556ec5a380ecc4ffb02513e875` |
| Deployment id to preserve | `b19716b1` |
| Seismograph cron (not changed) | `0 18 * * *` UTC |
| Systemic-regime infer (not changed) | daily 19:00 UTC |

The only git ref whose tip is exactly `1cb5dee` is `origin/cursor/production-1cb5dee-base-17cd`. That is not proof of the Railway source branch. James must name that branch before any protection command is applied.

## Candidate scheduler (not applied)

Copy is in `config/scheduler-candidate.txt`.

| Job | Current | Candidate | Why |
| --- | --- | --- | --- |
| `seismograph-cron` | `0 18 * * *` UTC | `15 20,21 * * 1-5` UTC | 18:00 UTC is 14:00 EDT / 13:00 EST, outside 16:15–16:45 America/New_York. The handler now returns **409** for that fire (`server/scheduledSeismograph.ts`). |
| `systemic-regime-infer` | daily 19:00 UTC | `30 21 * * 1-5` UTC | `runSystemicRegimeInferenceJob` reads `seismograph:latest_output` before Signal Convergence (`server/systemicRegime/scheduled.ts`). 19:00 UTC is before both candidate seismograph hours, so convergence would use the previous session. 21:30 UTC is after 20:15 and 21:15 UTC. |

`15 20,21 * * 1-5` fires twice. Exactly one instant is 16:15 ET:

- EDT: 20:15 UTC is admitted. 21:15 UTC is the companion (`17:15 ET`) and returns 409 `dst_companion_outside_window`.
- EST: 21:15 UTC is admitted. 20:15 UTC is the companion (`15:15 ET`) and returns 409.

Weekends, holidays, and the current `0 18 * * *` fire return 409 `outside_nyse_post_close_window`. `curl -f` fails. The process logs `[Seismograph][SCHEDULE-ALERT]` and sends an error-severity capture when error tracking is configured.

A completed claim is the only duplicate that stays HTTP 200 (`execution: already_completed`). A leased or failed claim is HTTP 409 `session_incomplete`. One recovery is allowed after the lease expires (3 minutes without a heartbeat) or after `failScheduledSession`, and only inside that session's 16:15–16:45 ET window. A second recovery is `exhausted` (409).

Do not store `15 20,21` with an `America/New_York` timezone. Railway cron is UTC-only.

## Rollback

Leave deployment `b19716b1` in place. Do not redeploy this branch to replace it.

If a later deploy of an approved SHA must be rolled back to production:

1. Confirm the running deployment id is still the one to keep, or that `b19716b1` is the rollback target.
2. Roll the service back to deployment `b19716b1` (commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875`) from the host UI. Do not run `railway up`, do not change cron, do not run migrations.
3. `GET /api/health` must report commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875`.
4. Leave `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` and `TRACK_RECORD_CRON_WRITES` unset.

The in-repo guard (`scripts/guard-approved-deploy.sh`, `server/deployGuard.ts`, `config/approved-production-commits.txt`) refuses a Railway boot whose `RAILWAY_GIT_COMMIT_SHA`, `BUILD_COMMIT`, or baked build identity is not that production SHA. It does not run for local or CI boots.

## Commands prepared and not executed

Tag the deployed commit. This does not move a branch.

```bash
git tag -a production-1cb5dee 1cb5dee13832c0556ec5a380ecc4ffb02513e875 \
  -m "Production deployment b19716b1. Do not move this tag."
git push origin production-1cb5dee
```

Branch protection changes repository settings. Replace `BRANCH` only after James confirms the Railway production source branch. Do not point this at `release/verified-2026-10-22` or at PR #117 / #118.

```bash
gh api --method PUT -H "Accept: application/vnd.github+json" \
  /repos/tsilianidis-bot/gaultline/branches/BRANCH/protection \
  --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
```

## NOW Core when evidence is disabled

No product change in this branch. Decision for James.

`client/src/pages/Now.tsx` mounts `IntelligenceCoreExperience` for every visitor who has a canonical state (the section after Active Pressure Channels, and again on the degraded canonical state). `presentVerifiedEvidenceCore` (`client/src/components/intelligence-core-visual/evidencePresentation.ts`) returns the unavailable Core when `response.enabled` is false. Guests do not call `intelligenceEvidence.current` (`enabled: Boolean(user && canonicalState)`). With the flag off, signed-in users receive the disabled response and still see the unavailable Core shell.

Options:

1. Keep the current shell. The unavailable Core is visible, and it does not invent a market conclusion.
2. Hide the Core section unless the server says the evidence flag is on and a snapshot exists.
3. Show the shell only to owner/admin while the flag is off.
4. Leave the shell, and change the heading so it cannot be read as a live score.

## Isolated integration check (this run)

This process environment did not have `FRED_API_KEY`, `POLYGON_API_KEY`, `COINGECKO_API_KEY`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `JWT_SECRET`, `DATABASE_URL`, or `CRON_SECRET`. No live provider call was made and no secret was printed.

What the code already does without those values:

| Integration | Missing here | Fail-closed behavior |
| --- | --- | --- |
| FRED | `FRED_API_KEY` | Bulk fetch records the provider error. Evidence rows stay unavailable. Live FRED vitest is skipped without the key. |
| Polygon | `POLYGON_API_KEY` | Yahoo fallback does not call Polygon. Previous-close path stays closed. |
| CoinGecko | `COINGECKO_API_KEY` | Public CoinGecko routes can still be called by the server if a test opts in. This run did not. The key-gated vitest is skipped. |
| OAuth | `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | Login URL stays empty. Callback and user sync fail closed with no request to the OAuth host. `JWT_SECRET` was also unset, so session signing was not exercised. |

`CRON_SECRET` unset means `requireCron` fail-opens. Do not run that configuration on a reachable host.
