# RESTORE.md — FAULTLINE v2.5 Pre Project Black

> **This document is the official recovery guide for the pre-redesign snapshot of FAULTLINE.**
> Do not modify this file. It is part of the immutable backup record.

---

## Backup Identity

| Field | Value |
|---|---|
| **Backup Name** | FAULTLINE v2.5 — Pre Project Black |
| **Backup Date** | 2026-06-26 (UTC) |
| **Git Commit Hash** | `2bcbe1bb6a55c82b799866f49aeabe1d9cf3fcc7` |
| **Git Branch** | `optimization/platform-v2` |
| **Manus Checkpoint ID** | `2bcbe1bb` |
| **Deployment Version** | `2bcbe1bb` (live at getfaultline.live) |
| **Database Migration Version** | `0032_glorious_speedball.sql` (migration 33 of 33) |
| **Stripe Integration Version** | Live + Test keys configured; webhook at `/api/stripe/webhook` |
| **Total Source Files** | 456 files (excluding node_modules, .git, .manus-logs) |
| **Test Suite** | 654 passing, 1 pre-existing SendGrid 401 (expected) |
| **TypeScript Errors** | 0 |

---

## How to Restore This Project

### Option 1 — Rollback via Manus UI (Recommended)

1. Open the Manus project management UI for **copy-of-faultline**.
2. Click **More (⋯) → Version history**.
3. Find checkpoint `2bcbe1bb` labelled "Fix: Apply sanitizeNumbers to dayTrade.getFavorability...".
4. Click **Rollback** to restore the full project to this exact state.
5. Click **Publish** to redeploy.

### Option 2 — Git Restore

```bash
git fetch origin
git checkout 2bcbe1bb6a55c82b799866f49aeabe1d9cf3fcc7
pnpm install
pnpm build
```

### Option 3 — Manual File Restore

All source files are preserved in the Manus checkpoint `2bcbe1bb`. The checkpoint includes:
- All frontend source (`client/`)
- All backend source (`server/`)
- Database schema (`drizzle/schema.ts`)
- All 33 migration SQL files (`drizzle/0000_*.sql` through `drizzle/0032_*.sql`)
- Shared types and constants (`shared/`)
- Build configuration (`vite.config.ts`, `tsconfig.json`, `package.json`)
- Test suite (`server/*.test.ts`)

---

## Database Restore Steps

> **Warning:** The production database is a live TiDB/MySQL instance. Never run destructive commands on it without explicit authorization.

### Schema Restore

The complete schema is defined in `drizzle/schema.ts`. To re-apply all migrations from scratch:

```bash
# From the project root:
pnpm drizzle-kit generate   # regenerate SQL from schema.ts
# Then apply each migration via webdev_execute_sql in order
```

### Migration History

The project has 33 applied migrations (`0000` through `0032`). The migration state is tracked in the `__drizzle_migrations` table in the database.

### Database Tables (37 tables as of backup date)

| Table | Purpose |
|---|---|
| `users` | User accounts, roles, access tiers, Stripe IDs |
| `positions` | Portfolio positions per user |
| `cryptoWatchlist` | User crypto watchlist items |
| `mobileWatchlist` | Mobile app watchlist |
| `mobileUsage` | Mobile daily usage limits |
| `foundingAccessRequests` | Founding member access request queue |
| `blogPosts` | Blog content management |
| `xPostQueue` | X/Twitter post scheduling queue |
| `pressureHistory` | Historical FAULTLINE Pressure Index readings |
| `pressureRuns` | Pressure engine audit trail |
| `featureFlags` | Kill switches for platform features |
| `simPortfolioAccounts` | $10K→$1M simulated portfolio accounts |
| `simPortfolioPositions` | Simulated portfolio open positions |
| `simPortfolioTrades` | Simulated portfolio trade history |
| `simPortfolioJournal` | Simulated portfolio AI journal entries |
| `ownerSimulationAccounts` | Owner simulation module accounts |
| `ownerSimulationPositions` | Owner simulation open positions |
| `ownerSimulationTrades` | Owner simulation trade history |
| `ownerSimulationDailySnapshots` | Owner simulation daily snapshots |
| `ownerSimulationObjectives` | Owner simulation investment objectives |
| `sharedReports` | Publicly shareable signal/outlook reports |
| `outlookHistory` | Signal Outlook Center history |
| `visitorProfiles` | Anonymous visitor tracking for chatbot |
| `organicContent` | AI-generated organic content |
| `signalPages` | SEO signal landing page cache |
| `contentCtaClicks` | Content CTA click tracking |
| `dayTradeWatchlist` | Day Trade Intelligence watchlist |
| `tradeJournal` | User trade journal entries |
| `chatbot_sessions` | AI chatbot conversation sessions |
| `chatbot_messages` | AI chatbot message history |
| `chatbot_leads` | Chatbot lead capture records |
| `pageViews` | Analytics page view events |
| `analyticsSessions` | Analytics session tracking |
| `siteEvents` | Analytics custom event tracking |
| `dailyReadingSnapshots` | Daily market reading snapshots |
| `userMarketAwarenessActions` | Market awareness action log |
| `__drizzle_migrations` | Drizzle migration state tracker |

---

## Feature Flags

Feature flags are stored in the `featureFlags` database table. Known flags as of backup:

| Flag Key | Purpose |
|---|---|
| `pressure_engine` | Enable/disable the FAULTLINE Pressure Index engine |
| `sim_portfolio_visible` | Show/hide the $10K→$1M Simulated Portfolio ("The Proof") |

Additional flags may exist in the database. Query with: `SELECT key, enabled, description FROM featureFlags ORDER BY key;`

---

## Stripe Configuration

### Products and Pricing (as of backup)

| Plan ID | Name | Price | Interval | Tier | Env Var |
|---|---|---|---|---|---|
| `core` | FAULTLINE Core | $9.99 | Monthly | `core` | `STRIPE_CORE_PRICE_ID` |
| `core_annual` | FAULTLINE Core (Annual) | $95.88 | Yearly | `core` | `STRIPE_CORE_ANNUAL_PRICE_ID` |
| `premium` | FAULTLINE Pro | $59.00 | Monthly | `premium` | `STRIPE_PREMIUM_PRICE_ID` |
| `premium_annual` | FAULTLINE Pro (Annual) | $564.00 | Yearly | `premium` | `STRIPE_PREMIUM_ANNUAL_PRICE_ID` |
| `founding` | FAULTLINE Founding Member | $49.00 | Monthly | `founding` | `STRIPE_FOUNDING_PRICE_ID` |
| `lifetime` | FAULTLINE Founding Lifetime | $299.00 | One-time | `founding` | `STRIPE_LIFETIME_PRICE_ID` |

### Webhook

- **Endpoint:** `https://getfaultline.live/api/stripe/webhook` (production)
- **Secret:** `STRIPE_WEBHOOK_SECRET` environment variable
- **Handled Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

### Access Tier Gates

| Gate | Required Tier |
|---|---|
| `signals` | `core` |
| `portfolio` | `core` |
| `altRotation` | `core` |
| `risk` | `premium` |
| `intelligence` | `premium` |
| `crypto` | `premium` |
| `aftershock` | `premium` |
| `watchlist` | `premium` |
| `founding` | `premium` (founding badge) |

---

## Analytics Configuration

### Google Analytics GA4

- **Measurement ID:** `G-YLJ9EQZK7P`
- **Configuration:** SPA-friendly; `send_page_view: false` (manual via `RouteTracker` component)
- **Cookie flags:** `SameSite=None;Secure`
- **Ad personalization:** Disabled
- **Debug mode:** Enabled on localhost only

### Custom Analytics (Built-in)

- Tables: `pageViews`, `analyticsSessions`, `siteEvents`
- Admin dashboard at `/app/analytics` (admin-only)
- Tracked events include: chatbot interactions, CTA clicks, signal views, pressure index loads

---

## AI System Prompts

### Chatbot (FAULTLINE AI Market Intelligence Concierge)

**Location:** `server/chatbotEngine.ts` → `buildSystemPrompt()`

The chatbot system prompt is dynamically constructed at runtime and includes:
- Full FAULTLINE product knowledge (9 core features)
- Pricing block injected from `CANONICAL_PRICING` (sourced from `shared/tiers.ts`)
- Behavior rules (10 rules governing tone, pricing accuracy, disclaimer requirements)
- Forbidden price validation (legacy prices `$29.99`, `$39`, `$79`, `$199` are blocked)
- Disclaimer: *"FAULTLINE provides market intelligence and risk analysis, not personalized financial advice."*

**Intent Detection Keywords:**
- Pricing: `price`, `pricing`, `cost`, `how much`, `plan`, `subscription`, `pay`, `free`, `premium`, `founding`, `upgrade`, `tier`, `monthly`, `annual`, `$`, `mobile`, `trader`, `lifetime`
- Signup: `sign up`, `signup`, `register`, `join`, `get started`, `create account`, `start`, `try`, `access`
- Upgrade: `upgrade`, `premium`, `founding`, `paid plan`, `unlock`, `full access`, `trader`, `lifetime`

### Signal Outlook Center

**Location:** `server/signalOutlook.ts`

LLM calls are made for: full outlook generation, quick outlook, top opportunities, watchlist outlooks, and opportunity discovery. All prompts include regime context and FAULTLINE methodology framing.

### Day Trade Intelligence

**Location:** `server/dayTradeEngine.ts`

LLM enrichment is applied per-setup for: catalyst identification, execution rationale, why-trade explanation, and market favorability summaries. System prompt frames the AI as "FAULTLINE's Day Trade Intelligence™ AI."

### Diagnostic AI

**Location:** `server/diagnosticAI.ts`

4-timeframe analysis (Today / Week / Month / Year) with regime label, trend direction, crash risk, and bull continuation probability.

### Trade Preflight

**Location:** `server/tradePreflight.ts`

Move-type simulation (add_risk, reduce_risk, rotate, raise_cash, deploy_cash, hold) with ticker-specific context when provided.

### Situation Room

**Location:** `server/tradePreflight.ts` (shared engine)

Portfolio stress simulation with macro regime context.

---

## Known Dependencies

### External APIs

| Service | Purpose | Auth Method |
|---|---|---|
| Polygon.io | Live stock market data | `POLYGON_API_KEY` env var |
| CoinGecko | Crypto market data | `COINGECKO_API_KEY` env var |
| FRED (Federal Reserve) | Macroeconomic indicators | Proxied via `/api/fred` |
| Manus Built-in LLM | AI analysis and chat | `BUILT_IN_FORGE_API_KEY` env var |
| SendGrid | Transactional email | `SENDGRID_API_KEY` env var |
| Stripe | Payments | `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Manus OAuth | Authentication | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` |
| Google Analytics | Web analytics | Hardcoded `G-YLJ9EQZK7P` in `client/index.html` |

### Node.js Runtime

- **Node version:** 22.13.0
- **Package manager:** pnpm
- **Framework:** React 19 + Vite (frontend), Express 4 + tRPC 11 (backend)
- **Database ORM:** Drizzle ORM (MySQL/TiDB)
- **Auth:** Manus OAuth 2.0

---

## Deployment Restore Steps

1. Ensure the Manus checkpoint `2bcbe1bb` is the active version.
2. Click **Publish** in the Manus management UI.
3. Verify deployment at `https://getfaultline.live`.
4. Confirm Stripe webhook is active at `https://getfaultline.live/api/stripe/webhook`.
5. Confirm GA4 is receiving events (check GA4 Realtime dashboard).

---

## Rollback Instructions

If Project Black introduces a regression:

1. Go to Manus management UI → **More (⋯) → Version history**.
2. Find checkpoint `2bcbe1bb`.
3. Click **Rollback**.
4. Click **Publish**.

The rollback restores all source code, configuration, and build artifacts. The database is **not** rolled back by a code rollback — schema changes made during Project Black must be manually reverted if needed.

---

## Verification Checklist

- [x] Source code copied (456 files, git commit `2bcbe1bb6a55c82b799866f49aeabe1d9cf3fcc7`)
- [x] Database schema preserved (`drizzle/schema.ts`, 37 tables)
- [x] 33 migration SQL files preserved (`drizzle/0000_*.sql` through `drizzle/0032_*.sql`)
- [x] Feature flags documented (2 known flags)
- [x] AI prompts documented (chatbot, outlook, DTI, diagnostic, preflight, situation room)
- [x] Stripe configuration documented (6 plans, webhook endpoint, access tier gates)
- [x] Analytics configuration documented (GA4 `G-YLJ9EQZK7P`, custom analytics tables)
- [x] Environment variable names documented (no secrets stored)
- [x] TypeScript: 0 errors
- [x] Tests: 654 passing
- [x] Build: verified (dev server running)
- [x] Backup is restorable via Manus checkpoint rollback

---

*This document was generated on 2026-06-26 as part of the FAULTLINE v2.5 Pre Project Black backup protocol. Do not modify.*
