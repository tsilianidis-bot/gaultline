# Maintenance Mode Runbook

**Code:** `server/publicMaintenance.ts`  
**Default:** ON unless `FAULTLINE_MAINTENANCE_MODE=false`

## Behavior
- When active, public GET/HEAD HTML routes receive the branded maintenance page (HTTP 200, `no-store`, `noindex`).
- APIs, auth, scheduled intelligence, storage, assets, robots, and sitemap remain operational beneath the gate.

## Before disabling maintenance
1. Confirm production (or custom domain) serves the intended Git SHA.
2. Prefer checking a version endpoint (e.g. `/api/version` if present) **or** inspecting deployed bundle/commit metadata so it matches tip of `grok/faultline-completion-2026-09-08` (or the approved release SHA).
3. Confirm critical provider secrets and Stripe/webhook routing for that host.
4. Confirm cron/heartbeat can reach `/api/scheduled/*` with `CRON_SECRET`.
5. Only then set `FAULTLINE_MAINTENANCE_MODE=false` in the deployment environment and redeploy/restart as required.

## Do not
- Flip the code default to off in source just to “finish” locally.
- Disable maintenance while custom domain still serves a stale older bundle (`PRODUCTION_VALIDATION_STATUS.md`).
