# Deployment and scheduler runbook

Date: 2026-10-28. This document does not deploy, merge, tag, change Railway, change repository settings, apply migrations, or enable `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` or `TRACK_RECORD_CRON_WRITES`.

Production today:

| Item | Value |
| --- | --- |
| Last reviewed git SHA | `1cb5dee13832c0556ec5a380ecc4ffb02513e875` |
| Live `/api/health` on 2026-10-28 | `f7756c7fad3cac0f96df45723ca5c4e2713146d0` (`buildTime` `2026-10-27T18:43:24Z`) |
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

- EDT: 20:15 UTC is admitted. 21:15 UTC is the companion (`17:15 ET`). It logs `[Seismograph][SCHEDULE-HEARTBEAT]` and returns HTTP 200 `alert: false` when the session claim is already completed. If that later companion is the only fire and the claim is not completed, it returns 409 `missed_scheduled_run` with `alert: true`.
- EST: 21:15 UTC is admitted. 20:15 UTC is the companion (`15:15 ET`), before the window. It logs the same heartbeat and returns HTTP 200 `alert: false`. A winter cron that only hits 20:15 UTC does not look like a successful daily run: infer after 16:45 ET returns 409 `missed_scheduled_run` when the claim is not completed.

A weekend or full NYSE holiday returns HTTP 200 `{ ok: true, alert: false, skipped: "outside_nyse_post_close_window" }`. The DST companion hour returns HTTP 200 `{ ok: true, alert: false, skipped: "dst_companion_outside_window" }`. Neither writes a score and neither sends `[Seismograph][SCHEDULE-ALERT]`. An unexpected hour on a real session, including the current production `0 18 * * *` UTC fire, still returns 409 with `alert: true` so `curl -f` fails.

A completed claim is the only duplicate that stays HTTP 200 (`execution: already_completed`). A leased claim that is still inside its 3-minute lease is HTTP 409 `session_incomplete`. If the pipeline throws, the same request fails the claim and retries once. If that retry also throws, the claim is marked exhausted in that request. A run that finishes is sealed even when the first compare-and-swap misses, so a later lease expiry does not start another pipeline. A second recovery after that is `exhausted` (409). The DST companion hour is not the recovery mechanism.

Do not store `15 20,21` with an `America/New_York` timezone. Railway cron is UTC-only.

## Rollback

Leave deployment `b19716b1` in place. Do not redeploy this branch to replace it.

If a later deploy of an approved SHA must be rolled back to production:

1. Confirm the running deployment id is still the one to keep, or that `b19716b1` is the rollback target.
2. Roll the service back to deployment `b19716b1` (commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875`) from the host UI. Do not run `railway up`, do not change cron, do not run migrations.
3. `GET /api/health` must report commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875`.
4. Leave `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` and `TRACK_RECORD_CRON_WRITES` unset.

Production protection is Railway commit pinning plus the tag `production-1cb5dee` on `1cb5dee13832c0556ec5a380ecc4ffb02513e875`. The tag command below has not been executed. `config/approved-production-commits.txt` is not a control and is not read.

The container start command is `bash scripts/start-production.sh`. It always reaches `node dist/index.js` unless `FAULTLINE_ENFORCE_DEPLOY_GUARD=1`. With that flag, `scripts/guard-approved-deploy.sh` must pass before the process listens. The flag is off in this candidate, so a Docker boot without the external allowlist still starts. Turning the flag on without `FAULTLINE_APPROVED_DEPLOY_SHAS` or `FAULTLINE_APPROVED_DEPLOY_TAGS` refuses the boot. `BUILD_COMMIT` is not an allowlist input. The runtime image copies `scripts/start-production.sh` and `scripts/guard-approved-deploy.sh`. It does not need `config/`.

Before a deploy, compare the target SHA to an allowlist held outside the commit. `BUILD_COMMIT` is not an input.

```bash
# Allow the production SHA from the environment, not from a file in the commit.
FAULTLINE_APPROVED_DEPLOY_SHAS=1cb5dee13832c0556ec5a380ecc4ffb02513e875 \
  FAULTLINE_DEPLOY_SHA=1cb5dee13832c0556ec5a380ecc4ffb02513e875 \
  bash scripts/guard-approved-deploy.sh

# Or resolve a release tag. The tag command is in the next section and has
# not been executed; this line only reads the tag when it exists.
FAULTLINE_APPROVED_DEPLOY_TAGS=production-1cb5dee \
  FAULTLINE_DEPLOY_SHA=1cb5dee13832c0556ec5a380ecc4ffb02513e875 \
  bash scripts/guard-approved-deploy.sh
```

A missing external allowlist, a non-SHA target, or any other SHA exits 1. A stale `BUILD_COMMIT` does not change the result.

When `FAULTLINE_ENFORCE_DEPLOY_GUARD=1`, the boot refuses with a clear message if neither `RAILWAY_GIT_COMMIT_SHA` nor `FAULTLINE_DEPLOY_SHA` is a full lowercase SHA. If both are set and they differ, the boot refuses. The platform SHA is the deploy identity. Tag mode (`FAULTLINE_APPROVED_DEPLOY_TAGS`) needs a git checkout. An image without `.git` must use `FAULTLINE_APPROVED_DEPLOY_SHAS`.

## Schema gate before deploy

`0074`, `0075`, and `0076` are not applied by boot. Boot runs `assertDeploySchemaReady` (`server/schemaGate.ts`) and refuses to listen if `users.accessExpiresAt`, `users.entitlementRevision`, `stripeSubscriptionCancellations`, `pentagonalThesisRecords`, or `pentagonalThesisOutcomeScores` are missing. The error names the three SQL files. Apply them on a backup before the deploy. An unmigrated `users` select that includes `accessExpiresAt` otherwise fails with `Unknown column`.

`0076` deletes outcome rows whose `provenanceId` does not exist before it adds `algo_outcome_prov_fk`, so orphan rows do not abort the foreign key. `0075` row triggers do not run for `TRUNCATE`. The deploy role must not receive `DROP` or `TRUNCATE` on the thesis tables.

The disposable MariaDB check is not part of CI. Local only:

```bash
FAULTLINE_ISOLATED_MARIADB=1 pnpm exec vitest run server/migration0057Fk.test.ts
```

Systemic-regime infer on a weekend or NYSE holiday returns HTTP 200 `{ ok: true, alert: false, skipped: "nyse_closed" }` and does not run the job. After 16:45 ET on a session day with no completed seismograph claim, infer returns 409 `missed_scheduled_run` with `alert: true`.

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

Unset, empty, and whitespace `CRON_SECRET` values all fail closed. `requireCron` returns 401 (`server/_core/cronGuard.ts`).
