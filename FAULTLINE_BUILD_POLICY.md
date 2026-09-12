# FAULTLINE build policy

This is the minimum-safe verify policy for the baseline stabilization branch.
It does **not** merge to `main`, deploy via Manus, force-push, or delete recovery branches.

## Required verify gates

Every change on `grok/faultline-baseline-stabilization-2026-09-11` must pass:

1. `pnpm install --frozen-lockfile`
2. `pnpm run check` / `npm run check` — TypeScript, 0 errors
3. `pnpm run build` / `npm run build` — Vite client + esbuild server
4. `pnpm test` / `npm test` — Vitest default suite, 0 failed (skipped secret suites are OK)
5. `scripts/ci-startup-smoke.sh` — production server listens **without** `STRIPE_SECRET_KEY`
6. `scripts/ci-write-build-identity.sh` — writes `dist/build-identity.json`

## Stripe boot rule

`server/stripe/client.ts` exports `stripe: Stripe | null` and `requireStripe()`.
Never construct `new Stripe("")` when the secret is missing. Billing/webhook/product
call sites must fail closed and leave the HTTP server listening.

## Out of scope

- Intelligence Contract v2
- Merge to `main`
- Manus production deploy
- Force-push
- Deleting recovery branches

The GitHub Actions `manus-deploy` job stays disabled / `workflow_dispatch` only.
