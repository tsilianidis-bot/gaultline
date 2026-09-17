# RC preview pin instructions (no production publish)

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Do not** deploy or retarget **getfaultline.live** / **www.getfaultline.live**.  
**Do not** flip `FAULTLINE_MAINTENANCE_MODE`.  
**Do not** enable Stripe live mode.

## Exact pin (owner / Manus preview only)

1. Create or reuse a **Manus preview** (or other non-production host). Do not bind the production domain.
2. Check out this branch tip (must be `761f73fdc2ba5d2fbecfe6668fb8e9d04c681dbb` or **newer on this branch only**).
3. Before `pnpm run build` on that host, export:

```bash
export BUILD_COMMIT=$(git rev-parse HEAD)   # full SHA of the preview tip
export BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export NODE_ENV=production
# optional
export BUILD_BRANCH=grok/faultline-baseline-stabilization-2026-09-11
```

4. Inject **preview** secrets only: `sk_test_` Stripe, **test-mode** price IDs that match `shared/tiers.ts` (not the live-locked quartet). Do not copy production `CRON_SECRET` targets or live keys.
5. Set `CRON_SECRET` to a non-empty preview value so `/api/scheduled/*` does not fail-open.
6. Build + start: `pnpm install --frozen-lockfile && pnpm run build && pnpm start`.
7. Prove the pin (JSON routes are registered **before** maintenance HTML):

```bash
curl -sS https://<preview-host>/api/build-info
curl -sS https://<preview-host>/api/version
# commit must equal git rev-parse HEAD on the preview checkout
```

8. Optional: `bash scripts/ci-write-build-identity.sh` and keep `dist/build-identity.json`.

## What this is not

- Not a production domain change.
- Not a Heartbeat retarget. Do not point production Forge jobs at the preview.
- Not a Manus production deploy. GitHub job `Manus deploy (manual / disabled)` refuses even on `workflow_dispatch`.

## Related

- `docs/RC_PREVIEW_BUILD_IDENTITY.md`
- `docs/RC_PREVIEW_OAUTH.md` — preview `VITE_APP_ID` must equal the Manus app-auth `appId` (faultline1 Space `Xbzsed6coyZiRmSu4UeiVi`)
- `.github/workflows/faultline-verify.yml`
