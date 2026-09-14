# Independent staging (no Manus)

Run the existing app from GitHub on an independent host. This is not production, not getfaultline.live, and not a Manus deploy.

## Local

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm test
pnpm start
```

`pnpm start` reads `PORT` (default 3000) and listens on `0.0.0.0`. Health: `GET /api/health` → `{ ok: true, commit, buildTime }`.

Do **not** run `pnpm db:push` from deploy. Schema changes are owner/manual.

## Required env names

See `.env.example`. Set values in the host secret manager, never in git.

| Name | Staging notes |
| --- | --- |
| `DATABASE_URL` | MySQL/TiDB URL |
| `JWT_SECRET` | Session signing |
| `QA_ACCESS_SECRET` | Secret-gated `/qa-access` on production-like hosts (`NODE_ENV=production`) |
| `OAUTH_SERVER_URL` | OAuth token/userinfo host |
| `VITE_APP_ID` | OAuth client / app id (baked at `pnpm run build`) |
| `VITE_OAUTH_PORTAL_URL` | Browser login portal (baked at build) |
| `BUILD_COMMIT` / `BUILD_TIME` | Build identity; Dockerfile ARG/ENV; Railway can inject |
| `FAULTLINE_MAINTENANCE_MODE` | **`false` on staging** so the app shell renders |
| `PORT` | Injected by Railway |
| `CRON_SECRET` | Scheduled routes; optional if jobs are not pointed at staging |
| Stripe names | Optional; boot is null-safe without them |

Optional: `FAULTLINE_MANAGED_PREVIEW=true` enables auto QA (no cookie) on this host without a `*.manus.computer` hostname. Default is off. Do **not** set on production.

Staging auth: keep `QA_ACCESS_SECRET`. Open `/qa-access`, submit the secret, receive the HttpOnly QA cookie. Production stays secret-gated; this does not weaken production.

## Docker

```bash
docker build \
  --build-arg BUILD_COMMIT="$(git rev-parse HEAD)" \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t faultline .
docker run --rm -p 3000:3000 --env-file /path/to/staging.env -e PORT=3000 faultline
curl -fsS http://127.0.0.1:3000/api/health
```

Install/build/start inside the image: `pnpm install --frozen-lockfile` → `pnpm run build` → `pnpm start`.

## Railway

1. New project → deploy from this GitHub repo → branch `grok/faultline-baseline-stabilization-2026-09-11` (or the SHA you pin).
2. Railway uses `railway.toml` + `Dockerfile`. Health check: `/api/health`.
3. Set the env **names** from `.env.example` (values only in Railway). Include `FAULTLINE_MAINTENANCE_MODE=false`.
4. Do **not** pin `BUILD_COMMIT` / `BUILD_TIME` as stale Railway service variables. The Dockerfile bakes `RAILWAY_GIT_COMMIT_SHA` (or `--build-arg BUILD_COMMIT`) into `dist/build-identity.json`; `/api/health`, `/api/build-info`, and `/api/version` read that file so a new deploy reports the new SHA.
5. Add a MySQL-compatible `DATABASE_URL`. Do not attach production DB. Do not run `db:push` from Railway.
6. Deploy. Confirm `GET /api/health` is 200, then open `/qa-access` with `QA_ACCESS_SECRET`.

Nixpacks fallback (if the Dockerfile builder is not used): `nixpacks.toml` runs the same install/build/start commands; `PORT` still comes from the environment.
