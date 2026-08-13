# FAULTLINE Restoration Checklist

> Use this checklist after a Manus restoration, repository recovery, or migration to another hosting platform. Complete the steps in order and keep the original backup archive unmodified.

## Preserve and inspect

- [ ] Store the original `FAULTLINE_FULL_BACKUP_2026-08-13.zip` in at least two private, durable locations.
- [ ] Confirm archive integrity and compare critical contents against `FAULTLINE_BACKUP_MANIFEST.csv`.
- [ ] Confirm no real secret file, session token, `node_modules`, build cache, or raw runtime log was included.
- [ ] Create a new private Git repository and baseline commit before modifications.

## Rebuild source environment

- [ ] Install Node.js 22.x and pnpm 10.x or a compatible toolchain.
- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Confirm the Wouter patch in `patches/` resolves during installation.
- [ ] Create host-side encrypted environment variables from `FAULTLINE_ENVIRONMENT_TEMPLATE.env.example`.
- [ ] Confirm secrets are not committed to the repository or emitted to client bundles/logs.

## Restore persistence

- [ ] Provision a TLS-enabled MySQL/TiDB-compatible database.
- [ ] Restore a separately acquired database data export if customer/content/history records are required.
- [ ] Review and apply migration files under `drizzle/` in order.
- [ ] Verify the resulting schema against `drizzle/schema.ts` and `FAULTLINE_DATABASE_SCHEMA.md`.
- [ ] Confirm `__drizzle_migrations` reflects the intended chain.
- [ ] Validate essential reads/writes for users, snapshots, Seismograph records, blog content, and entitlement data.

## Reconnect integrations

- [ ] Reconfigure authentication. For non-Manus hosting, replace or adapt the Manus OAuth-oriented flow before launch.
- [ ] Add FRED, Polygon, CoinGecko, and AI gateway settings through secure host configuration.
- [ ] Configure Stripe keys, price IDs, webhook signing secret, and final production webhook URL.
- [ ] Verify SendGrid account authorization and sender identity.
- [ ] Reconnect GA4, Sentry, Google Search Console, and X integrations only if needed.
- [ ] Rotate job secrets and configure each approved scheduled workload in the new scheduler.

## Test and launch

- [ ] Run `pnpm test` and investigate any newly introduced test failures.
- [ ] Run `pnpm build` and launch with `NODE_ENV=production pnpm start`.
- [ ] Verify public routes, robots, sitemap, metadata, and redirects.
- [ ] Verify all Five Questions destinations: Home/NOW, What, Why, Outlook, Watch, and Act.
- [ ] Verify Pressure, Seismograph, Global Markets, Crypto, Signals, Symbol Intelligence, Pre-Flight, and ASHA show freshness/limitation information correctly.
- [ ] Run a Stripe test-mode checkout and verify signed webhook handling plus entitlement update.
- [ ] Validate scheduled jobs in a safe non-production window before enabling recurring execution.
- [ ] Attach `getfaultline.live` and `www.getfaultline.live`, complete TLS validation, then verify canonical redirects.

## Final acceptance

- [ ] Confirm there is no unlabelled fallback data presented as live data.
- [ ] Confirm historical pages use retrospective language and do not claim the system existed at historical event dates.
- [ ] Confirm no market-level probability is presented as an instrument-specific forecast.
- [ ] Confirm customer data, Stripe state, and external provider account status were restored independently of source code.
- [ ] Record the new deployment ID, commit SHA, database migration state, domain status, and validation date in `FAULTLINE_CURRENT_STATE.md`.

