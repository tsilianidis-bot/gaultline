# Maintenance Mode Runbook

**Code:** `server/publicMaintenance.ts`  
**Default:** OFF unless `FAULTLINE_MAINTENANCE_MODE=true` (exact, case-sensitive)

## Behavior
- When active, public GET/HEAD HTML routes receive the branded maintenance page (HTTP 200, `no-store`, `noindex`).
- Unset, `false`, `TRUE`, `1`, `yes`, or any other value leaves the public app live.
- APIs, auth, scheduled intelligence, storage, assets, robots, and sitemap remain operational beneath the gate.

## Before enabling maintenance
1. Confirm this is an intentional public-facing hold (launch, incident, or planned upgrade).
2. Set `FAULTLINE_MAINTENANCE_MODE=true` in the deployment environment and redeploy/restart as required.

## Before disabling maintenance
1. Confirm production (or custom domain) serves the intended Git SHA.
2. Prefer checking a version endpoint (e.g. `/api/version` if present) **or** inspecting deployed bundle/commit metadata so it matches tip of `grok/faultline-completion-2026-09-08` (or the approved release SHA).
3. Confirm critical provider secrets and Stripe/webhook routing for that host.
4. Confirm cron/heartbeat can reach `/api/scheduled/*` with `CRON_SECRET`.
5. Only then unset `FAULTLINE_MAINTENANCE_MODE` or set it to any value other than exact `true`, and redeploy/restart as required.

## Do not
- Flip the code default back to on in source just to “hold” locally.
- Disable maintenance while custom domain still serves a stale older bundle (`PRODUCTION_VALIDATION_STATUS.md`).
