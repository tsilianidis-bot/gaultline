# FAULTLINE

Market risk intelligence. This repository is the production application: Express + tRPC server, Vite client, and Vitest suite.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm test
pnpm dev
```

`STRIPE_SECRET_KEY` is optional for boot. When it is missing, `stripe` is `null`, billing fails closed, and the HTTP server still listens.

## CI

GitHub Actions workflow: [`.github/workflows/faultline-verify.yml`](.github/workflows/faultline-verify.yml).

Policy: [`FAULTLINE_BUILD_POLICY.md`](FAULTLINE_BUILD_POLICY.md).

Default verify gates (no live vendor secrets required):

1. `pnpm install --frozen-lockfile`
2. Typecheck (`pnpm run check`)
3. Production build (`pnpm run build`)
4. Vitest (`pnpm test`) — secret suites are `describe.skipIf` / `it.skipIf` gated; see [`docs/TEST_ENV_GATING.md`](docs/TEST_ENV_GATING.md)
5. Startup smoke (`scripts/ci-startup-smoke.sh`) — server must listen without `STRIPE_SECRET_KEY`
6. Build identity artifact (`scripts/ci-write-build-identity.sh` → `dist/build-identity.json`)

The `manus-deploy` job is **disabled** and **manual** (`workflow_dispatch` only). It does not publish.

This baseline does not merge to `main`, force-push, or delete recovery branches.
