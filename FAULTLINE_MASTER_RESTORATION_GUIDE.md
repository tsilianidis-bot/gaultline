# FAULTLINE Master Restoration Guide

> **Purpose:** Rebuild the current FAULTLINE application from a safe backup when the original Manus task history, project state, generated artifacts, or deployment records are unavailable. This guide intentionally contains no secret values.

## 1. Recovery priorities

Restore in this sequence: retain the original backup archive unchanged, inspect its manifest, rebuild source dependencies, provision a new MySQL-compatible database, apply reviewed migrations, restore safe configuration names through a secrets manager, deploy the service, reconnect the domain and webhooks, then validate the application and scheduled workloads. A restoration is incomplete until the Five Questions routes, pressure data, authentication, billing webhook, and public marketing routes have been validated.

| Recovery object | Authoritative backup location | Recovery rule |
|---|---|---|
| Frontend and backend source | `client/`, `server/`, `shared/` | Restore without changing application behavior first. |
| Database model | `drizzle/schema.ts`, `drizzle/*.sql` | Schema source and ordered migrations are authoritative; this does not include production records. |
| Dependency graph | `package.json`, `pnpm-lock.yaml`, `patches/` | Install with pnpm and preserve lockfile resolution. |
| Product and logic documentation | `FAULTLINE_*.md` | Use as an operational map, not a replacement for source code. |
| Runtime secrets | External owner-controlled secret stores | Re-enter values; never expect them inside this archive. |
| Live database records | Database provider export | Obtain a separate database backup; source backup alone cannot recreate customer, content, payment, or analytics records. |

## 2. Technology stack

FAULTLINE is a full-stack TypeScript application. The browser client uses **React 19**, **Vite**, **Tailwind CSS 4**, **Wouter**, and **TanStack React Query**. The application server uses **Express 4**, **tRPC 11**, and Node.js ES modules. Data is modeled through **Drizzle ORM** for **MySQL/TiDB**. The project includes Stripe billing, Manus OAuth-oriented authentication code, external market and macro-data adapters, and a server-side LLM gateway for ASHA and other intelligence workflows.

The current scripts in `package.json` establish the standard recovery commands:

```bash
pnpm install --frozen-lockfile
pnpm dev       # development server: tsx watch server/_core/index.ts
pnpm test      # Vitest regression suite
pnpm build     # Vite browser build + bundled server output in dist/
pnpm start     # production server: node dist/index.js
```

Use Node.js 22.x and pnpm 10.x or a compatible version. Keep `patches/wouter@3.7.1.patch` available because `package.json` declares it as a patched dependency.

## 3. Directory map

| Directory / file | Role during restoration |
|---|---|
| `client/src/` | React pages, components, application shell, route registration, UI state, and browser-side integrations. |
| `server/` | tRPC procedures, intelligence engines, external-provider adapters, Stripe integration, scheduled-job implementations, and tests. |
| `server/_core/` | HTTP bootstrap, OAuth plumbing, context construction, environment validation, LLM gateway, and platform-oriented runtime helpers. |
| `server/routers/` | Feature routers registered by `server/routers.ts`. |
| `server/pressure/` | Canonical V1 Pressure Index calculation and the separately evaluated V3-H shadow model. |
| `shared/` | Shared domain contracts, market-state model, Five Questions route registry, and product constants. |
| `drizzle/` | SQL migration chain and migration metadata. |
| `drizzle/schema.ts` | Current executable Drizzle schema definition. |
| `scripts/` | Operational utilities, including `generateBackupDocs.mjs`. |
| `references/` | Product reference materials and assets that should be retained with the source. |
| `FAULTLINE_*.md` | This backup package's restoration, architecture, engine, product, state, and schema records. |

## 4. Safe extraction and source setup

1. Copy `FAULTLINE_FULL_BACKUP_2026-08-13.zip` to immutable storage before extracting it.
2. Confirm the archive has the critical paths listed in `FAULTLINE_BACKUP_MANIFEST.csv`.
3. Extract into a new private repository or clean working directory.
4. Verify no `.env`, credential export, session cookie, `node_modules`, build cache, or runtime logs were unexpectedly included.
5. Initialize a fresh Git repository and make a read-only baseline commit before changing configuration.
6. Install dependencies with `pnpm install --frozen-lockfile`.

## 5. Environment configuration

Copy `FAULTLINE_ENVIRONMENT_TEMPLATE.env.example` to a private secret-management workflow. Set values in the hosting provider's encrypted environment system; do not commit an `.env` file.

| Group | Required restoration action |
|---|---|
| Database | Provision MySQL 8+ or a compatible TiDB service and set `DATABASE_URL`. Preserve a separately exported data backup if records must be restored. |
| Core identity | Configure `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, and `VITE_OAUTH_PORTAL_URL` only if the Manus OAuth flow remains available. |
| Market and macro data | Restore FRED, Polygon, CoinGecko, and Yahoo-compatible access credentials/configuration. Validate rate limits and terms separately. |
| AI | Restore the server-side LLM gateway credentials/configuration. The code must not expose these to the browser. |
| Billing | Restore Stripe test/live keys, price IDs, and the webhook signing secret; update the destination endpoint after deployment. |
| Communications | Restore SendGrid sender identity and API credential after independently verifying account authorization. |
| Operations | Restore Sentry, GA4, X, Google Search Console, cron/heartbeat secrets, and build metadata only where currently used. |

## 6. Database restoration

### 6.1 Provision

Provision a blank MySQL-compatible database with TLS enabled. Create a least-privilege application user that can run the required DDL/DML during migration, then create a lower-privilege runtime credential after migration if operationally appropriate. Store only the connection string in the secret manager as `DATABASE_URL`.

### 6.2 Apply the migration chain

The project currently includes SQL migrations under `drizzle/`, ordered by zero-padded filename. Review the full chain before running it against any non-empty database.

```bash
# Inspect migrations first; do not blindly apply to a live database.
find drizzle -maxdepth 1 -name '*.sql' | sort

# After DATABASE_URL has been configured and review is complete:
pnpm drizzle-kit migrate
```

If the original production records are required, restore a separate provider-level database export **before** validating the application. This source archive preserves schema and migrations, not a database data dump. Confirm `__drizzle_migrations` matches the applied migration state. See `FAULTLINE_DATABASE_SCHEMA.md` for a readable schema map.

### 6.3 Post-migration checks

Confirm the application can read the `users`, `dailyReadingSnapshots`, `seismographReadings`, blog, entitlement, and Stripe webhook tables. Validate that all migrations expected by the checked-in schema have executed. Do not seed fictional user records, reviews, testimonials, or payment history.

## 7. Authentication restoration

The current code is built around Manus OAuth plumbing in `server/_core/oauth.ts` and browser helpers in `client/src/_core/hooks/useAuth.ts`. If restoring inside Manus, re-enable the platform application settings and connectors after restoring the project package.

If restoring outside Manus, treat authentication as a migration project: the code cannot rely on unavailable Manus OAuth endpoints. Either provide a compatible OIDC/OAuth implementation and adapt the server callback/session layer, or replace it with a deliberately chosen external provider. Re-test account creation, login, logout, protected tRPC procedures, role checks, and subscription entitlement gating after the replacement.

## 8. Data-provider and AI reconnection

| Provider / integration | Source location | Validation after restore |
|---|---|---|
| FRED macro data | `server/fredClient.ts`, `server/fredProxy.ts`, `server/pressure/engine.ts` | Verify current series results and freshness labels; delayed macro series must remain labeled as such. |
| Yahoo Finance market data | `server/yahooProxy.ts`, `server/routers/markets.ts` | Verify quote parsing, cache behavior, and delayed-data labeling. |
| Polygon market data | `server/signalsProxy.ts`, Symbol/Signal modules | Verify API key, rate limits, price data, and stale-cache fallback. |
| CoinGecko crypto data | `server/coingeckoProxy.ts`, `server/cryptoIntelligence.ts` | Verify asset lookup, market state, and provider health surfaces. |
| Built-in / compatible LLM | `server/_core/llm.ts`, `server/ashaGateway.ts` | Verify ASHA gets canonical MarketState and exposes limitations on failure. |
| SendGrid | `server/email.ts` | Verify sender authorization with a non-production test. |
| X / social services | `server/xPoster.ts`, social modules | Re-authorize deliberately; do not run automated posting until owner approval. |

## 9. Stripe and payment restoration

1. Recreate or recover the Stripe products and price IDs referenced by `server/stripe/products.ts` and environment names in the template.
2. Set `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and the relevant price IDs through the host's secret manager.
3. Configure the production webhook endpoint as `https://<production-domain>/api/stripe/webhook`.
4. Subscribe Stripe to the event types handled in `server/stripe/webhook.ts`.
5. Use Stripe test mode and a Stripe-provided test payment method to validate checkout, entitlement updates, refunds/cancellations, and webhook signature verification.
6. Only after validation, enable the live endpoint. Preserve live/test mode separation and do not copy credentials into source.

## 10. Scheduled workloads and webhooks

Scheduled code is present in modules such as `server/scheduledDailySnapshot.ts`, `server/scheduledSeismograph.ts`, `server/scheduledBlog.ts`, `server/scheduledShadowModel.ts`, and related job files. In the current platform these may rely on Manus heartbeat/scheduling infrastructure. An external restoration must assign each job an explicit scheduler (managed cron, queue worker, or serverless scheduler), secure it with a rotated `CRON_SECRET`/`HEARTBEAT_SECRET`, and log execution outcomes.

Do not assume a job is safe to run merely because code exists. Review every task's idempotency, database impact, data-provider load, outbound-email or outbound-posting behavior, and production owner approval before enabling it.

## 11. Development, build, and production startup

```bash
# Development
pnpm dev

# Static/build validation
pnpm test
pnpm build

# Production (after build)
NODE_ENV=production pnpm start
```

The server must respect the host-assigned port. Do not hardcode a port in a production adaptation. Confirm that the production reverse proxy forwards HTTPS traffic, protects webhook paths appropriately, and forwards `Origin`/cookie-related headers required by the selected authentication system.

## 12. Domain, SSL, SEO, and deployment

The known user-facing domains are `getfaultline.live` and `www.getfaultline.live`. Record the registrar, DNS provider, and account access outside this archive. In a new host:

1. Deploy the application and obtain the provider's target hostname or IP.
2. Create/verify the required DNS records at the actual registrar or DNS provider.
3. Attach both apex and `www` domains in the hosting platform.
4. Complete automated TLS/SSL validation before redirecting traffic.
5. Reconfirm canonical URLs, redirects, sitemap delivery, robots directives, public page metadata, and `/app/*` noindex behavior.
6. Reconfigure Stripe and any OAuth redirect URI to the final canonical domain.

If restoring during a temporary platform unavailability event, preserve domain ownership. A separately hosted maintenance page is an operational decision, not a substitute for restoring the application and database.

## 13. Acceptance testing

Use the existing test suite plus manual checks:

| Area | Minimum check |
|---|---|
| Unit/regression | `pnpm test` completes without newly introduced failures. |
| Build | `pnpm build` creates both client assets and server bundle. |
| Public routes | Home, pricing, blog, methodology, trust, and robots/sitemap endpoints respond correctly. |
| Five Questions | `/app/now`, `/app/what`, `/app/why`, `/app/outlook`, `/app/watch`, `/app/act` load under the reconstructed auth model. |
| Intelligence | Pressure, Seismograph, Global Markets, Signal Outlook, Symbol Intelligence, Crypto, and Preflight show source/freshness limitations. |
| Data integrity | No missing migrations; pressure/seismograph snapshots can read/write; customer entitlements resolve correctly. |
| Payments | Stripe checkout and webhook verification operate in test mode. |
| Scheduling | Each approved job is executed once in a safe environment and produces an audited result. |

## 14. Troubleshooting map

| Symptom | First investigation |
|---|---|
| Blank browser screen | Inspect browser console, route imports, and icon/component imports; confirm the requested route is registered in `client/src/App.tsx`. |
| tRPC errors | Verify server boot, database connection, router registration in `server/routers.ts`, and auth context. |
| Pressure data shows fallback | Check FRED provider health, key/configuration, network access, and preserve the data-status label. |
| Market quote failure | Check Yahoo/Polygon/CoinGecko adapters, provider rate limits, cache fallback, and the upstream symbol mapping. |
| Checkout fails | Confirm mode alignment, price IDs, webhook secret, webhook endpoint, and account entitlement logic. |
| Login loop | Confirm OAuth redirect URLs, cookie settings, JWT secret continuity, and reverse-proxy origin headers. |
| Scheduled task repeats or does not run | Verify scheduler registration, rotated job secret, time zone, idempotency, and persisted job evidence. |

## 15. What this package cannot restore by itself

This archive cannot reconstruct production database contents, secret values, domain registrar control, OAuth application registrations, payment-provider account state, external-provider subscription agreements, cloud-hosting accounts, CDN configuration, historical Manus conversation history, or a deleted external artifact that was never committed to the project. Those items require separate owner-controlled exports or account access.

## 16. References inside the backup

| Source | Why it matters |
|---|---|
| `package.json` | Exact commands and dependency intent. |
| `drizzle/schema.ts` and `drizzle/*.sql` | Executable schema and migration chain. |
| `server/_core/index.ts` | Server entry point and HTTP route registration. |
| `server/routers.ts` | Main tRPC application router. |
| `server/pressure/engine.ts` | Canonical V1 Pressure Index logic. |
| `server/ashaEngine.ts`, `server/ashaGateway.ts` | ASHA behavior and canonical context integration. |
| `FAULTLINE_SYSTEM_ARCHITECTURE.md` | Connected-system recovery map. |
| `FAULTLINE_RESTORE_CHECKLIST.md` | Operational post-disaster checklist. |
