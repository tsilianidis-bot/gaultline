# FAULTLINE Current State

> **Snapshot date:** 2026-08-13. This is a source- and task-state-backed recovery record, not a claim that every external provider or deployed surface was live-tested at this exact moment.

## Verified working scope

| Area | Current state | Evidence |
|---|---|---|
| Application architecture | React/Vite client, Express/tRPC server, Drizzle schema, MySQL/TiDB integration, and Manus OAuth-oriented authentication source are present. | `package.json`, `client/`, `server/`, `drizzle/`. |
| Global Markets | A `/app/markets` route, Global Markets nav entry, markets tRPC router, 23-instrument cached Yahoo snapshot, and a second 24px live market ticker were added in checkpoint `02ec5d42`. | Source and checkpoint record. |
| Market intelligence core | Pressure V1, Seismograph, MarketState, ASHA, crypto, signal, preflight, and related source modules are present. | Engine files in `server/`. |
| Tests | The latest completed Global Markets session reported **1,557 passing** Vitest tests and 22 intentionally skipped tests. | Session checkpoint record `02ec5d42`; rerun required after restore. |
| Current deployment domains | Known project domains include `getfaultline.live`, `www.getfaultline.live`, and a Manus subdomain. | Project deployment context. |

## Partially implemented or provider-dependent scope

| Area | Accurate characterization |
|---|---|
| ASHA / LLM | Source is implemented but depends on a server-side model gateway and healthy Canonical MarketState. It must show limitations when context/providers are unavailable. |
| Pressure data | V1 calculation is implemented; FRED provider availability and publication lags determine live versus delayed/fallback state. AI concentration is explicitly a static model baseline, not live market-cap data. |
| Global Markets | Router and UI are implemented; Yahoo-compatible quote availability determines live/delayed coverage. Server cache is 90 seconds. |
| Scheduled jobs | Job modules exist, but their execution depends on the hosting platform's scheduler/heartbeat configuration and approved operational secrets. |
| Payments | Stripe integration source and configured project secrets exist, but external Stripe account/webhook state must be independently verified after any recovery. |
| Authentication | Current code depends on Manus OAuth plumbing; moving outside Manus requires an intentional auth migration. |

## Known defects, operational risks, and data-quality constraints

| Item | State / required action |
|---|---|
| TypeScript watcher diagnostics | Pre-existing errors were reported in `client/src/pages/UniversalSymbolIntelligence.tsx` for `_providerHealth` typing and in `server/scheduledShadowModel.ts` for implicit `any` parameters. These existed before the Global Markets task and need a separate corrective pass. |
| TypeScript watcher stability | The watcher has previously aborted from memory pressure; esbuild syntax checks and the Vitest suite were used for targeted validation. Re-run the normal type check in a sufficiently resourced recovery environment. |
| V3-H shadow database mismatch | Runtime logs have previously reported a non-fatal `engineVersion` database-column mismatch in shadow-model writes. Compare schema/migration state before enabling or evaluating shadow collection. |
| SendGrid credential | `KNOWN_ISSUES.md` records an HTTP 401 during a read-only SendGrid validation despite injected credential presence. Owner/SendGrid administrator must validate/replace the credential; source code cannot resolve account authorization. |
| Historical claims | Historical Track Record methodology was flagged for reconciliation. Current product language must use neutral retrospective analysis wording and must not say FAULTLINE issued live historical warnings. |
| Market data | External providers can be delayed, rate-limited, unavailable, or cached. UI must preserve source/freshness/fallback labels and never display missing data as false zeroes. |
| Production infrastructure | Previous sessions recorded intermittent deployment failures with `cloudrun service not found`. Confirm active hosting service, latest deployment ID, and custom-domain routing before relying on automatic publication. |

## Technical debt and unfinished work

The repository's long-running `todo.md` contains historical and active work items across many earlier sessions. The disaster-recovery package does not mark unrelated items complete. The most urgent recovery-oriented work after this backup is to maintain external account exports, verify current database schema versus migrations, resolve pre-existing TypeScript issues, repair any shadow-model schema drift, and obtain a current provider-level database backup.

## Highest-priority next steps

1. Download and store this safe source/documentation archive in multiple private locations.
2. Create a current database-provider export; do not assume source/migrations preserve customer, content, history, entitlement, or analytics records.
3. Export or document owner-controlled external dependencies: domain registrar/DNS, Stripe, OAuth, FRED/Polygon/CoinGecko, SendGrid, Google, X, LLM gateway, S3/storage, scheduler, and hosting accounts.
4. Confirm that the active production service is attached to `getfaultline.live` and that automatic publication reaches it.
5. Run `pnpm test`, `pnpm build`, and a clean type check after any restoration; fix the known type/shadow-schema issues in a separate measured release.
6. Keep V3-H as a shadow model until the defined evaluation period and reconciliation criteria are completed.

## Launch blockers for an external reconstruction

An external reconstruction cannot launch until an authentication replacement/compatibility decision is made, a production database is restored or initialized, host-side secrets are configured, Stripe webhook/domain settings are updated, provider credentials are validated, scheduled jobs are re-provisioned, and the custom domains pass SSL/DNS validation. Missing any of these may leave the code buildable but not operationally complete.

## Recent decision record

| Decision | Recovery implication |
|---|---|
| Preserve Five Questions architecture | Keep Home/NOW as `/app/now`; treat Markets as Layer 2 evidence, not a replacement dashboard. |
| Preserve existing AppMarketHeader | Global Markets adds a second ticker row; it does not replace intelligence metrics. |
| Use live/delayed data labels | Provider failures, stale values, and static models must stay explicit. |
| Historical claims are retrospective | Do not reintroduce claims that FAULTLINE warned users before historical events. |
| V3-H remains shadow-only | Preserve parameter freeze/evaluation intent; avoid user-facing substitution without formal approval. |
| No fake scarcity/testimonials | Payment/member counters and user-generated proof must be real, database-backed, and legally safe. |

