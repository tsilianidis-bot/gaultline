# FAULTLINE External Dependencies and Manual Recovery Inventory

> This record identifies the dependencies required to operate FAULTLINE that are **not safely recoverable from source code alone**. It names services, configuration variables, and retrieval owners without exposing secret values.

## Owner-controlled accounts and credentials

| Dependency | Purpose | Configuration names / recovery artifact | Where the owner must retrieve or reconfigure it | Backup limitation |
|---|---|---|---|---|
| MySQL/TiDB database | Users, content, snapshots, entitlements, analytics, history | `DATABASE_URL`; provider-level database export | Database provider account / Manus database settings | Source and migrations do **not** preserve production records. |
| Manus OAuth / identity | Current sign-in callback/session flow | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `JWT_SECRET`, owner IDs | Manus project/security settings; if external, a replacement OIDC provider | External migration requires auth adaptation. |
| Stripe | Checkout, subscriptions, lifetime/founding access, webhook fulfillment | Stripe keys, webhook secret, price IDs | Stripe Dashboard: Developers, Products, Webhooks | Account, products, customers, payments, webhook history are external. |
| FRED | Macro data for Pressure and related systems | `FRED_API_KEY` | FRED API account | Provider availability/publication lag is external. |
| Polygon.io | Market data and symbol/signal enrichment | `POLYGON_API_KEY` | Polygon account | Entitlement/rate limits are external. |
| Yahoo Finance-compatible endpoints | Global Markets snapshot data | No stored credential identified in router; adapter configuration is source-side | Verify operational access/terms at recovery | Quotes can be delayed/changed/unavailable. |
| CoinGecko | Crypto intelligence and market data | `COINGECKO_API_KEY` | CoinGecko account | Provider plan/rate limits are external. |
| Server-side LLM gateway | ASHA and AI enrichment | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` or compatible replacement | Manus project secret settings or replacement AI provider | Manus built-in service cannot be assumed available off-platform. |
| Browser-side gateway | Approved frontend gateway access where used | `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Manus / selected provider configuration | Must not expose a privileged server credential. |
| SendGrid | Transactional email | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` | SendGrid account and verified sender domains | Known credential/account validation issue must be resolved by account owner. |
| Google APIs / Search Console | SEO/search integrations | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, stored GSC token state | Google Cloud Console and Search Console owner account | OAuth grants/tokens are external and may need reauthorization. |
| GA4 | Browser analytics | `VITE_GA4_MEASUREMENT_ID` | Google Analytics property | Analytics history is external. |
| Sentry | Error tracking | `SENTRY_DSN` | Sentry project settings | Issue/event history is external. |
| X API | Approved social publishing/data workflows | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` | X developer account | Do not re-enable posting automatically after restore. |
| Object storage | Uploaded/generated file storage | Hosting/platform storage credentials/configuration | Manus storage/project account or selected S3-compatible replacement | Unreferenced/disconnected objects may not be in source archive. |
| Hosting / deployment | Runtime service and environment injection | Host project settings, build config, deployment version | Manus project management UI or replacement host | Runtime instance and platform deployment history are external. |
| Scheduler / heartbeat | Daily snapshots, Seismograph, content, email/social, shadow workflows | `CRON_SECRET`, `HEARTBEAT_SECRET`, scheduler definitions | Manus schedule UI or replacement job scheduler | Source modules do not automatically recreate schedules. |
| Domain / DNS / SSL | `getfaultline.live`, `www.getfaultline.live` routing and TLS | Registrar/DNS account, host domain binding | Domain registrar/DNS provider and hosting domain settings | Domain ownership and DNS records are outside this archive. |

## Required manual exports before a destructive-platform window

The owner should independently save: a database-provider backup (schema **and data**), current Stripe product/price/customer/subscription exports where permitted, domain registrar/DNS record screenshots or exports, OAuth client registrations/redirect URI settings, provider API account ownership records, SendGrid verified-sender configuration, Google/X integration records, hosting/deployment settings, scheduler definitions/run history, and object-storage assets/metadata not represented in the repository.

Do not store API keys, database passwords, OAuth client secrets, webhook signing secrets, JWT secrets, session cookies, or recovery codes inside Git, this archive, issue trackers, or unencrypted personal notes.

## Recovery order

1. Restore source and dependencies from the safe archive.
2. Provision infrastructure and set safe placeholder configuration.
3. Restore database schema, then separately restore approved data export.
4. Reconnect one provider at a time and validate source-health behavior.
5. Reconfigure auth and Stripe final URLs only after the production domain is attached.
6. Re-enable only reviewed scheduled jobs.
7. Maintain a written deployment record with commit, migration, domain, and provider validation state.
