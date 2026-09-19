# RC preview build identity

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Scope:** preview / CI identity only. This document does **not** change production domain config or deploy to getfaultline.live.

## What exists

| Surface | Source | If unset |
| --- | --- | --- |
| `GET /api/build-info` | `resolveBuildIdentity()` — `BUILD_COMMIT`, `BUILD_TIME`, `NODE_ENV` | commit → git `HEAD` if `.git` exists, else `"dev"`; time → process boot ISO |
| `GET /api/version` | same helper + `npm_package_version` | version `"1.0.0"` |
| Client `__BUILD_COMMIT__` / `__BUILD_TIME__` | Vite `define` at **build** time | `BUILD_COMMIT` / `BUILD_TIME` env if non-empty, else `git rev-parse --short HEAD` / `git log -1 --format=%cI` |
| `BuildBadge` | fetches `/api/build-info` | shows `"dev"` when commit is exactly `dev` |
| CI artifact `dist/build-identity.json` | `scripts/ci-write-build-identity.sh` after verify | `BUILD_COMMIT` → `GITHUB_SHA` → git HEAD; empty `BUILD_TIME` now falls back to UTC now |

Scheduled jobs are **not** build identity. Heartbeat/cron POSTs `/api/scheduled/*` with `Authorization: Bearer $CRON_SECRET` (or `HEARTBEAT_SECRET`). Forge/Manus registers the crontab; there is no in-repo GitHub cron for Seismograph. Preview will not fire production heartbeats unless the owner points a Heartbeat job at that preview URL (do not point production schedules at a random preview).

### Scheduled routes (auth: `requireCron`)

`/api/scheduled/ping`, `daily-snapshot`, `publish-blog`, `auto-publish-drafts`, `x-post-scheduled`, `x-news-monitor`, `daily-sim-portfolio`, `generate-organic-content`, `refresh-signal-pages`, `ledger-evaluation`, `weekly-improvement-report`, `drip-email`, `seismograph-daily`, `shadow-forward-outcomes`, `shadow-daily-summary`, `rising-stars-continuity`, `daily-brief`, `weekly-review`, `monthly-report`, `daily-brief/manual`.

Owner gate (unchanged): RV-7 heartbeat fire is **BLOCKED-OWNER**. This RC does not create or retarget Forge jobs.

## Expected **preview** env

Set these on the preview host (or the CI job that builds the preview artifact). Do not copy production live Stripe or production cron targets.

```bash
NODE_ENV=production          # or preview-specific; badge shows this string
BUILD_COMMIT=<full git SHA of the preview tip>
BUILD_TIME=<ISO-8601, e.g. 2026-09-13T12:00:00Z>
# optional but recommended so /api/version.version is not a guess
npm_package_version=1.0.0    # usually injected by Node when started via npm/pnpm
```

Vite preview bundles: export the same `BUILD_COMMIT` / `BUILD_TIME` **before** `pnpm run build` so the client constants match the API. Short vs full SHA: badge displays the first 7 characters unless the value is `dev`.

CI `faultline-verify.yml` already exports `BUILD_COMMIT=${{ github.sha }}` when writing the artifact. `github.event.head_commit.timestamp` is **empty on `pull_request`**. The write script treats a blank `BUILD_TIME` as unset and stamps UTC now so the artifact is never `buildTime: ""`.

## How to verify a preview (no production domain)

```bash
curl -sS https://<preview-host>/api/build-info
curl -sS https://<preview-host>/api/version
# expect commit == preview tip SHA (or git HEAD if env was omitted)
```

Compare to `git rev-parse HEAD` on this branch. Public HTML may still be maintenance-gated; these JSON routes are registered **before** the maintenance middleware.

## Code fix in this RC (preview-safe)

1. `server/buildIdentity.ts` — single resolver; empty env strings do not count as set; git fallback only when env is missing (typical unset preview). Production hosts that already inject `BUILD_COMMIT` / `BUILD_TIME` are unchanged.
2. `/api/build-info` and `/api/version` no longer emit a **new** ISO timestamp on every request when `BUILD_TIME` is missing (boot-stable identity).
3. Vite prefers env over git so a preview build pipeline can pin the SHA.
4. `scripts/ci-write-build-identity.sh` — empty `BUILD_TIME` falls back.

No getfaultline.live / www.getfaultline.live config is edited.

## Related

- `FAULTLINE_BUILD_POLICY.md` — verify gates include the identity script
- `docs/MAINTENANCE_MODE_RUNBOOK.md` — APIs stay up under the public HTML gate
