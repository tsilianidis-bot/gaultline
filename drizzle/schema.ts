import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /**
   * Access tier controls which features a user can access.
   * - free: basic dashboard, limited previews
   * - core: $9.99/mo — Signals screener, Portfolio tracker, Alt Rotation
   * - premium: full intelligence platform, all signals, all engines
   * - founding: same as premium, early-access badge, lifetime benefits
   */
  accessTier: mysqlEnum("accessTier", ["free", "core", "premium", "founding"]).default("free").notNull(),
  /**
   * Dashboard intelligence mode preference.
   * - pulse: fast market interpretation (default)
   * - signals: tactical movement tracking
   * - intelligence: deep structural interpretation
   */
  dashboardMode: mysqlEnum("dashboardMode", ["pulse", "signals", "intelligence"]).default("pulse").notNull(),
  /**
   * Market Preflight Prompts preference.
   * - full_guidance: show dashboard card, checklist CTA, missing checks, and helper prompts (default)
   * - minimal_reminders: show only compact score and Run Market Preflight button
   * - off: hide page-level prompts (feature stays accessible from Profile and How to Use FAULTLINE)
   */
  preflightPromptMode: mysqlEnum("preflightPromptMode", ["full_guidance", "minimal_reminders", "off"]).default("full_guidance").notNull(),
  /** Stripe customer ID — set on first checkout, used for billing portal and subscription lookups. */
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  /** Active Stripe subscription ID — set by webhook on successful payment, cleared on cancellation. */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  /**
   * Timestamp of the last completed Market Preflight session.
   * NULL means the user has never completed a preflight review.
   * Used by the PreflightGate to determine if a prompt is needed on dashboard load.
   */
  lastPreflightCompletedAt: timestamp("lastPreflightCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Portfolio positions ──────────────────────────────────────

/**
 * Stores each user's portfolio positions.
 * One row per position (user + ticker combination).
 * Supports stocks, ETFs, and crypto.
 */
export const positions = mysqlTable("positions", {
  id:        int("id").autoincrement().primaryKey(),
  userId:    int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker:    varchar("ticker", { length: 20 }).notNull(),
  name:      varchar("name", { length: 120 }).notNull(),
  shares:    decimal("shares", { precision: 18, scale: 8 }).notNull(),   // supports fractional crypto
  costBasis: decimal("costBasis", { precision: 18, scale: 4 }).notNull(), // avg cost per share/unit
  assetType: mysqlEnum("assetType", ["Stock", "ETF", "Crypto", "Other"]).default("Stock").notNull(),
  notes:     text("notes"),
  openedAt:  timestamp("openedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  /** Fast lookup of all positions for a given user */
  userIdIdx: index("positions_userId_idx").on(t.userId),
  /** Fast lookup of all users holding a given ticker */
  tickerIdx:  index("positions_ticker_idx").on(t.ticker),
}));

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

// ── Crypto Watchlist ─────────────────────────────────────────
/**
 * Stores each user's saved crypto tokens for the watchlist.
 * One row per (userId, symbol) pair — unique constraint prevents duplicates.
 */
export const cryptoWatchlist = mysqlTable("cryptoWatchlist", {
  id:      int("id").autoincrement().primaryKey(),
  userId:  int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol:  varchar("symbol", { length: 20 }).notNull(),
  name:    varchar("name", { length: 120 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (t) => ({
  userIdIdx:        index("cryptoWatchlist_userId_idx").on(t.userId),
  userSymbolIdx:    index("cryptoWatchlist_userId_symbol_idx").on(t.userId, t.symbol),
}));

export type CryptoWatchlistItem = typeof cryptoWatchlist.$inferSelect;
export type InsertCryptoWatchlistItem = typeof cryptoWatchlist.$inferInsert;

// ── Founding Access Requests ─────────────────────────────────
/**
 * Stores founding access / waitlist requests from users and visitors.
 * Admins review these and can manually promote users to founding tier.
 */
export const foundingAccessRequests = mysqlTable("foundingAccessRequests", {
  id:        int("id").autoincrement().primaryKey(),
  userId:    int("userId"),                                             // null for unauthenticated visitors
  email:     varchar("email", { length: 320 }).notNull(),
  name:      varchar("name", { length: 200 }),
  message:   text("message"),                                           // optional "why I want access" note
  status:    mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FoundingAccessRequest = typeof foundingAccessRequests.$inferSelect;
export type InsertFoundingAccessRequest = typeof foundingAccessRequests.$inferInsert;

// ── Blog Posts ─────────────────────────────────────────────
/**
 * Stores FAULTLINE macro intelligence blog posts.
 * Admin-authored, publicly readable.
 */
export const blogPosts = mysqlTable("blogPosts", {
  id:          int("id").autoincrement().primaryKey(),
  slug:        varchar("slug", { length: 200 }).notNull().unique(),
  title:       varchar("title", { length: 300 }).notNull(),
  subtitle:    varchar("subtitle", { length: 400 }),
  content:     text("content").notNull(),           // Markdown
  author:      varchar("author", { length: 100 }).default("FAULTLINE").notNull(),
  category:    varchar("category", { length: 80 }).default("Macro Intelligence").notNull(),
  tags:        text("tags"),                        // comma-separated
  published:   int("published").default(0).notNull(), // 0=draft, 1=published
  publishedAt: timestamp("publishedAt"),
  viewCount:   int("viewCount").default(0).notNull(),  // incremented each time the post is opened
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
  updatedAt:   timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

// ── X Post Queue ────────────────────────────────────────────
/**
 * Tracks auto-generated and auto-posted X (Twitter) posts.
 * One row per post attempt. Status tracks the lifecycle.
 */
export const xPostQueue = mysqlTable("xPostQueue", {
  id:          int("id").autoincrement().primaryKey(),
  postType:    mysqlEnum("postType", ["premarket", "midday", "closing", "breaking"]).notNull(),
  variant:     mysqlEnum("variant", ["short", "thread", "founder", "institutional", "breaking"]).notNull(),
  content:     text("content").notNull(),           // The actual post text
  headline:    varchar("headline", { length: 500 }), // For breaking alerts
  status:      mysqlEnum("status", ["pending", "posted", "failed", "skipped"]).default("pending").notNull(),
  xPostId:     varchar("xPostId", { length: 64 }),  // Twitter post ID after posting
  errorMsg:    text("errorMsg"),                    // Error message if failed
  pressureScore: int("pressureScore"),              // Pressure index at time of generation
  pressureRegime: varchar("pressureRegime", { length: 100 }), // Regime label
  postedAt:    timestamp("postedAt"),
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
});
export type XPostQueue = typeof xPostQueue.$inferSelect;
export type InsertXPostQueue = typeof xPostQueue.$inferInsert;

// ── Pressure History ────────────────────────────────────────
/**
 * Backfilled monthly Pressure Index readings from 2000-01 to present.
 * Computed from FRED macroeconomic data using the FAULTLINE scoring engine.
 * Used for the public Track Record page.
 */
export const pressureHistory = mysqlTable("pressureHistory", {
  id:               int("id").autoincrement().primaryKey(),
  month:            varchar("month", { length: 7 }).notNull().unique(), // YYYY-MM
  overallPressure:  int("overallPressure").notNull(),
  regime:           varchar("regime", { length: 50 }).notNull(),
  liquidityStress:  int("liquidityStress"),
  creditContagion:  int("creditContagion"),
  volatilityRegime: int("volatilityRegime"),
  macroSensitivity: int("macroSensitivity"),
  marketBreadth:    int("marketBreadth"),
  aiBubble:         int("aiBubble"),
  baaSpread:        decimal("baaSpread", { precision: 6, scale: 2 }),
  hySpreadProxy:    decimal("hySpreadProxy", { precision: 6, scale: 2 }),
  tsy10y:           decimal("tsy10y", { precision: 6, scale: 2 }),
  tsy2y:            decimal("tsy2y", { precision: 6, scale: 2 }),
  fedfunds:         decimal("fedfunds", { precision: 6, scale: 2 }),
  cpiYoy:           decimal("cpiYoy", { precision: 6, scale: 2 }),
  unemployment:     decimal("unemployment", { precision: 5, scale: 1 }),
  sp500:            decimal("sp500", { precision: 10, scale: 2 }),
  createdAt:        timestamp("createdAt").defaultNow().notNull(),
});

export type PressureHistory = typeof pressureHistory.$inferSelect;
export type InsertPressureHistory = typeof pressureHistory.$inferInsert;

// ── Mobile Watchlist ─────────────────────────────────────────
/**
 * Stores each user's saved tickers/crypto for the Core mobile watchlist.
 * type: 'stock' | 'crypto'
 * One row per (userId, symbol, type) — unique constraint prevents duplicates.
 */
export const mobileWatchlist = mysqlTable("mobileWatchlist", {
  id:        int("id").autoincrement().primaryKey(),
  userId:    int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol:    varchar("symbol", { length: 30 }).notNull(),
  name:      varchar("name", { length: 120 }).notNull(),
  type:      mysqlEnum("type", ["stock", "crypto"]).notNull().default("stock"),
  addedAt:   timestamp("addedAt").defaultNow().notNull(),
}, (t) => ({
  userIdIdx:     index("mobileWatchlist_userId_idx").on(t.userId),
  userSymbolIdx: index("mobileWatchlist_userId_symbol_idx").on(t.userId, t.symbol),
}));
export type MobileWatchlistItem = typeof mobileWatchlist.$inferSelect;
export type InsertMobileWatchlistItem = typeof mobileWatchlist.$inferInsert;

// ── Market Awareness Actions ────────────────────────────────
/**
 * Lightweight action log for the Complete Market Awareness™ system.
 * Records which preflight checkpoints a user has completed each day.
 * One row per user action event — no unique constraint, allows repeated logs.
 */
export const userMarketAwarenessActions = mysqlTable("userMarketAwarenessActions", {
  id:          int("id").autoincrement().primaryKey(),
  userId:      int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  actionKey:   varchar("actionKey", { length: 80 }).notNull(),
  sourcePage:  varchar("sourcePage", { length: 80 }),
  metadata:    text("metadata"),           // JSON string for optional context
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  /** Fast lookup of today's actions for a given user */
  userCompletedIdx: index("marketAwareness_userId_completedAt_idx").on(t.userId, t.completedAt),
  /** Fast lookup of a specific action key across all users */
  actionKeyIdx:     index("marketAwareness_actionKey_idx").on(t.actionKey),
}));
export type UserMarketAwarenessAction = typeof userMarketAwarenessActions.$inferSelect;
export type InsertUserMarketAwarenessAction = typeof userMarketAwarenessActions.$inferInsert;

// ── Daily Reading Snapshots ────────────────────────────────
/**
 * One official system-wide FAULTLINE reading snapshot per calendar day.
 * Stores the full engine output so users can review historical readings.
 * No personal user data. No trade recommendations. No buy/sell/hold.
 */
export const dailyReadingSnapshots = mysqlTable("dailyReadingSnapshots", {
  id:                   int("id").autoincrement().primaryKey(),
  /** Calendar date of this snapshot (YYYY-MM-DD) — unique per day */
  readingDate:          varchar("readingDate", { length: 10 }).notNull().unique(),
  /** FAULTLINE composite pressure index 0–100 */
  faultlineScore:       int("faultlineScore").notNull(),
  /** Qualitative stress level: Low | Moderate | Elevated | High | Critical */
  stressLevel:          varchar("stressLevel", { length: 20 }).notNull(),
  /** Regime label e.g. ELEVATED RISK, HIGH STRESS */
  regime:               varchar("regime", { length: 80 }).notNull(),
  /** Crash risk score 0–100 from diagnosticAI (null if unavailable) */
  crashProbability:     int("crashProbability"),
  /** Bull continuation score 0–100 from diagnosticAI (null if unavailable) */
  bullProbability:      int("bullProbability"),
  /** JSON array of top pressure drivers */
  pressureDriversJson:  text("pressureDriversJson").notNull(),
  /** JSON array of active alerts */
  activeAlertsJson:     text("activeAlertsJson").notNull(),
  /** JSON array of top signals (empty array if unavailable) */
  topSignalsJson:       text("topSignalsJson").notNull(),
  /** JSON object with data source status (live | fallback | stale | demo) */
  dataStatusJson:       text("dataStatusJson").notNull(),
  /** Plain-English reading summary (AI-generated interpretation) */
  readingSummary:       text("readingSummary"),
  /** JSON array of possible outcome objects */
  possibleOutcomesJson: text("possibleOutcomesJson"),
  /** JSON object with scenario support scores */
  scenarioSupportJson:  text("scenarioSupportJson"),
  createdAt:            timestamp("createdAt").defaultNow().notNull(),
  updatedAt:            timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DailyReadingSnapshot = typeof dailyReadingSnapshots.$inferSelect;
export type InsertDailyReadingSnapshot = typeof dailyReadingSnapshots.$inferInsert;

// ─── Analytics Tables ────────────────────────────────────────────────────────

/**
 * Records every page view on the site (marketing + app).
 * Collected server-side via the /api/analytics/pageview endpoint.
 */
export const pageViews = mysqlTable("pageViews", {
  id:          int("id").autoincrement().primaryKey(),
  /** Anonymous session ID (UUID stored in a cookie, not tied to user account) */
  sessionId:   varchar("sessionId", { length: 64 }).notNull(),
  /** Authenticated user ID — null for anonymous visitors */
  userId:      int("userId"),
  /** Full path e.g. /app/signals, /, /blog/post-slug */
  path:        varchar("path", { length: 512 }).notNull(),
  /** Page title at time of visit */
  title:       varchar("title", { length: 256 }),
  /** HTTP Referer header — where the user came from */
  referrer:    varchar("referrer", { length: 1024 }),
  /** UTM source parameter */
  utmSource:   varchar("utmSource", { length: 128 }),
  /** UTM medium parameter */
  utmMedium:   varchar("utmMedium", { length: 128 }),
  /** UTM campaign parameter */
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  /** Parsed country code from IP (e.g. US, GB, CA) */
  country:     varchar("country", { length: 4 }),
  /** Parsed device type: desktop | mobile | tablet */
  deviceType:  varchar("deviceType", { length: 16 }),
  /** Browser name: Chrome | Safari | Firefox | Edge | Other */
  browser:     varchar("browser", { length: 32 }),
  /** OS name: Windows | macOS | iOS | Android | Linux | Other */
  os:          varchar("os", { length: 32 }),
  /** Screen width in pixels */
  screenWidth: int("screenWidth"),
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  /** Analytics dashboard: count views per path in a time range */
  pathCreatedIdx:    index("pageViews_path_createdAt_idx").on(t.path, t.createdAt),
  /** Per-session page history */
  sessionIdIdx:      index("pageViews_sessionId_idx").on(t.sessionId),
  /** Per-user page history */
  userIdCreatedIdx:  index("pageViews_userId_createdAt_idx").on(t.userId, t.createdAt),
}));
export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

/**
 * One row per visitor session. A session expires after 30 minutes of inactivity.
 * Aggregates page count, duration, and entry/exit pages.
 */
export const analyticsSessions = mysqlTable("analyticsSessions", {
  id:           int("id").autoincrement().primaryKey(),
  sessionId:    varchar("sessionId", { length: 64 }).notNull().unique(),
  userId:       int("userId"),
  /** First page the user landed on */
  entryPage:    varchar("entryPage", { length: 512 }),
  /** Last page viewed before session ended */
  exitPage:     varchar("exitPage", { length: 512 }),
  /** Total number of pages viewed in this session */
  pageCount:    int("pageCount").default(1).notNull(),
  /** Session duration in seconds (updated on each pageview) */
  durationSecs: int("durationSecs").default(0).notNull(),
  /** Whether the session was a bounce (only 1 page viewed) */
  isBounce:     int("isBounce").default(1).notNull(),
  country:      varchar("country", { length: 4 }),
  deviceType:   varchar("deviceType", { length: 16 }),
  browser:      varchar("browser", { length: 32 }),
  os:           varchar("os", { length: 32 }),
  referrer:     varchar("referrer", { length: 1024 }),
  utmSource:    varchar("utmSource", { length: 128 }),
  utmMedium:    varchar("utmMedium", { length: 128 }),
  utmCampaign:  varchar("utmCampaign", { length: 128 }),
  startedAt:    timestamp("startedAt").defaultNow().notNull(),
  lastSeenAt:   timestamp("lastSeenAt").defaultNow().notNull(),
}, (t) => ({
  startedAtIdx:  index("analyticsSessions_startedAt_idx").on(t.startedAt),
  userIdIdx:     index("analyticsSessions_userId_idx").on(t.userId),
}));
export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type InsertAnalyticsSession = typeof analyticsSessions.$inferInsert;

/**
 * Custom event log — tracks named user actions beyond page views.
 * e.g. signal_search, watchlist_add, upgrade_click, preflight_launch
 */
export const siteEvents = mysqlTable("siteEvents", {
  id:        int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  userId:    int("userId"),
  /** Event name e.g. signal_search, upgrade_click, preflight_launch */
  eventName: varchar("eventName", { length: 128 }).notNull(),
  /** Optional JSON payload with event-specific properties */
  props:     text("props"),
  path:      varchar("path", { length: 512 }),
  country:   varchar("country", { length: 4 }),
  deviceType: varchar("deviceType", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  /** Count events by name in a time range */
  eventNameCreatedIdx: index("siteEvents_eventName_createdAt_idx").on(t.eventName, t.createdAt),
  /** Per-user event history */
  userIdIdx:           index("siteEvents_userId_idx").on(t.userId),
}));
export type SiteEvent = typeof siteEvents.$inferSelect;
export type InsertSiteEvent = typeof siteEvents.$inferInsert;

// ── Pressure Engine Audit Trail ──────────────────────────────
/**
 * Immutable audit log of every pressure engine execution.
 * One row per calculateFaultlinePressure() call that completes successfully.
 * Used for reproducibility, debugging, and admin inspection.
 * Never deleted — append-only.
 */
export const pressureRuns = mysqlTable("pressureRuns", {
  id:               int("id").autoincrement().primaryKey(),
  /** Composite pressure index 0–100 */
  overallPressure:  int("overallPressure").notNull(),
  /** Regime label e.g. ELEVATED RISK, HIGH STRESS */
  regime:           varchar("regime", { length: 80 }).notNull(),
  /** Qualitative level: Low | Moderate | Elevated | High | Critical */
  level:            varchar("level", { length: 20 }).notNull(),
  /** Whether live FRED data was used or fallback values */
  dataSource:       mysqlEnum("dataSource", ["live", "fallback"]).notNull(),
  /** JSON array of RiskVector objects (scores, drivers, dataStatus, source) */
  vectorsJson:      text("vectorsJson").notNull(),
  /** JSON array of PressureAlert objects */
  alertsJson:       text("alertsJson").notNull(),
  /** JSON object of the top historical analog match */
  topAnalogJson:    text("topAnalogJson").notNull(),
  /** Raw FRED input values used in this run (for reproducibility) */
  rawInputsJson:    text("rawInputsJson"),
  /** Engine version tag — increment manually when scoring logic changes */
  engineVersion:    varchar("engineVersion", { length: 20 }).default("1.0.0").notNull(),
  /** ISO timestamp when this run was computed */
  computedAt:       timestamp("computedAt").defaultNow().notNull(),
});
export type PressureRun = typeof pressureRuns.$inferSelect;
export type InsertPressureRun = typeof pressureRuns.$inferInsert;

// ── Feature Flags / Kill Switches ────────────────────────────
/**
 * Admin-controlled feature flags for disabling risky or broken features
 * without a redeploy. All production-safe features default to enabled (1).
 * One row per feature key — unique constraint prevents duplicates.
 */
export const featureFlags = mysqlTable("featureFlags", {
  id:          int("id").autoincrement().primaryKey(),
  /** Machine-readable feature key e.g. ai_narrative, x_posting */
  key:         varchar("key", { length: 80 }).notNull().unique(),
  /** Whether the feature is currently enabled (1) or disabled (0) */
  enabled:     int("enabled").default(1).notNull(),
  /** Human-readable description of what this flag controls */
  description: text("description"),
  /** Admin user ID who last changed this flag (null = system default) */
  updatedBy:   int("updatedBy"),
  updatedAt:   timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
});
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

// ── $10K → $1M Simulated Portfolio ("The Proof") ─────────────────────────────

/**
 * One row per simulated portfolio account (stocks + crypto are separate accounts).
 * Tracks starting capital, current value, and account metadata.
 */
export const simPortfolioAccounts = mysqlTable("simPortfolioAccounts", {
  id:             int("id").autoincrement().primaryKey(),
  /** "stocks" or "crypto" */
  accountType:    mysqlEnum("accountType", ["stocks", "crypto"]).notNull(),
  /** "demo" = public $10K demo account, "owner" = owner $100K command account */
  accountLabel:   varchar("accountLabel", { length: 32 }).notNull().default("demo"),
  /** Starting capital in USD */
  startingCapital: decimal("startingCapital", { precision: 14, scale: 2 }).notNull().default("10000.00"),
  /** Cash not yet deployed */
  cashBalance:    decimal("cashBalance", { precision: 14, scale: 2 }).notNull().default("10000.00"),
  /** ISO date the account was started e.g. 2026-06-14 */
  startedAt:      varchar("startedAt", { length: 12 }).notNull(),
  createdAt:      timestamp("createdAt").defaultNow().notNull(),
  updatedAt:      timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SimPortfolioAccount = typeof simPortfolioAccounts.$inferSelect;
export type InsertSimPortfolioAccount = typeof simPortfolioAccounts.$inferInsert;

/**
 * Open and closed simulated positions.
 * Each row represents one lot (one BUY trade that may later be closed by a SELL).
 */
export const simPortfolioPositions = mysqlTable("simPortfolioPositions", {
  id:              int("id").autoincrement().primaryKey(),
  accountId:       int("accountId").notNull(),
  ticker:          varchar("ticker", { length: 16 }).notNull(),
  name:            varchar("name", { length: 128 }),
  /** "stock" | "crypto" */
  assetType:       mysqlEnum("assetType", ["stock", "crypto"]).notNull(),
  /** Number of shares or units */
  quantity:        decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  /** Average cost basis per unit */
  entryPrice:      decimal("entryPrice", { precision: 14, scale: 6 }).notNull(),
  /** Total cost of this position */
  totalCost:       decimal("totalCost", { precision: 14, scale: 2 }).notNull(),
  /** Most recent mark-to-market price */
  currentPrice:    decimal("currentPrice", { precision: 14, scale: 6 }),
  /** "open" | "closed" */
  status:          mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  /** Price at which position was closed (null if still open) */
  exitPrice:       decimal("exitPrice", { precision: 14, scale: 6 }),
  /** FAULTLINE signal that triggered the entry */
  entrySignal:     varchar("entrySignal", { length: 128 }),
  /** FAULTLINE signal that triggered the exit */
  exitSignal:      varchar("exitSignal", { length: 128 }),
  /** Short rationale for entry (1-2 sentences) */
  entryRationale:  text("entryRationale"),
  /** Short rationale for exit (1-2 sentences) */
  exitRationale:   text("exitRationale"),
  openedAt:        timestamp("openedAt").defaultNow().notNull(),
  closedAt:        timestamp("closedAt"),
  updatedAt:       timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SimPortfolioPosition = typeof simPortfolioPositions.$inferSelect;
export type InsertSimPortfolioPosition = typeof simPortfolioPositions.$inferInsert;

/**
 * Immutable trade log — one row per BUY or SELL action.
 */
export const simPortfolioTrades = mysqlTable("simPortfolioTrades", {
  id:            int("id").autoincrement().primaryKey(),
  accountId:     int("accountId").notNull(),
  positionId:    int("positionId"),
  ticker:        varchar("ticker", { length: 16 }).notNull(),
  assetType:     mysqlEnum("assetType", ["stock", "crypto"]).notNull(),
  /** "BUY" | "SELL" */
  action:        mysqlEnum("action", ["BUY", "SELL"]).notNull(),
  quantity:      decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price:         decimal("price", { precision: 14, scale: 6 }).notNull(),
  totalValue:    decimal("totalValue", { precision: 14, scale: 2 }).notNull(),
  /** FAULTLINE pressure score at time of trade */
  pressureScore: int("pressureScore"),
  /** Regime label at time of trade */
  regime:        varchar("regime", { length: 80 }),
  /** 1-2 sentence rationale referencing FAULTLINE signals */
  rationale:     text("rationale"),
  executedAt:    timestamp("executedAt").defaultNow().notNull(),
});
export type SimPortfolioTrade = typeof simPortfolioTrades.$inferSelect;
export type InsertSimPortfolioTrade = typeof simPortfolioTrades.$inferInsert;

/**
 * Daily journal entries — AI-generated documentation of why positions
 * were held, traded, or adjusted based on FAULTLINE platform readings.
 * One entry per day per account type (or one combined entry).
 */
export const simPortfolioJournal = mysqlTable("simPortfolioJournal", {
  id:                int("id").autoincrement().primaryKey(),
  /** ISO date string e.g. 2026-06-14 */
  date:              varchar("date", { length: 12 }).notNull().unique(),
  /** FAULTLINE pressure score on this date */
  pressureScore:     int("pressureScore"),
  /** Regime label on this date */
  regime:            varchar("regime", { length: 80 }),
  /** Total portfolio value (stocks + crypto) at market close */
  totalValue:        decimal("totalValue", { precision: 14, scale: 2 }),
  /** Stocks account value */
  stocksValue:       decimal("stocksValue", { precision: 14, scale: 2 }),
  /** Crypto account value */
  cryptoValue:       decimal("cryptoValue", { precision: 14, scale: 2 }),
  /** Daily P&L in USD */
  dailyPnl:          decimal("dailyPnl", { precision: 14, scale: 2 }),
  /** Daily P&L as percentage */
  dailyPnlPct:       decimal("dailyPnlPct", { precision: 8, scale: 4 }),
  /** AI-generated journal entry (markdown) — explains market conditions and decisions */
  journalEntry:      text("journalEntry").notNull(),
  /** JSON array of tickers held on this date */
  holdingsJson:      text("holdingsJson"),
  /** JSON array of trades executed on this date */
  tradesJson:        text("tradesJson"),
  /** Whether any trades were made today */
  tradesMade:        int("tradesMade").default(0).notNull(),
  createdAt:         timestamp("createdAt").defaultNow().notNull(),
});
export type SimPortfolioJournalEntry = typeof simPortfolioJournal.$inferSelect;
export type InsertSimPortfolioJournalEntry = typeof simPortfolioJournal.$inferInsert;

// ── Owner Simulation Module ──────────────────────────────────
// Private admin-only $100K virtual trading cockpit.
// Route: /owner/simulation

/**
 * One row per simulation account (one per owner/admin user).
 * Tracks the virtual $100K → $1M journey.
 */
export const ownerSimulationAccounts = mysqlTable("ownerSimulationAccounts", {
  id:              int("id").autoincrement().primaryKey(),
  userId:          int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  startingCapital: decimal("startingCapital", { precision: 14, scale: 2 }).notNull().default("100000.00"),
  currentCash:     decimal("currentCash", { precision: 14, scale: 2 }).notNull().default("100000.00"),
  currentValue:    decimal("currentValue", { precision: 14, scale: 2 }).notNull().default("100000.00"),
  targetValue:     decimal("targetValue", { precision: 14, scale: 2 }).notNull().default("1000000.00"),
  /** ISO date account was started */
  startedAt:       varchar("startedAt", { length: 12 }).notNull(),
  createdAt:       timestamp("createdAt").defaultNow().notNull(),
  updatedAt:       timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OwnerSimulationAccount = typeof ownerSimulationAccounts.$inferSelect;
export type InsertOwnerSimulationAccount = typeof ownerSimulationAccounts.$inferInsert;

/**
 * Open and closed simulated positions for the owner simulation account.
 */
export const ownerSimulationPositions = mysqlTable("ownerSimulationPositions", {
  id:              int("id").autoincrement().primaryKey(),
  accountId:       int("accountId").notNull(),
  symbol:          varchar("symbol", { length: 20 }).notNull(),
  name:            varchar("name", { length: 128 }),
  assetType:       mysqlEnum("assetType", ["stock", "crypto"]).notNull(),
  quantity:        decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  averageEntry:    decimal("averageEntry", { precision: 14, scale: 6 }).notNull(),
  currentPrice:    decimal("currentPrice", { precision: 14, scale: 6 }),
  marketValue:     decimal("marketValue", { precision: 14, scale: 2 }),
  unrealizedPnl:   decimal("unrealizedPnl", { precision: 14, scale: 2 }),
  stopLoss:        decimal("stopLoss", { precision: 14, scale: 6 }),
  targetOne:       decimal("targetOne", { precision: 14, scale: 6 }),
  targetTwo:       decimal("targetTwo", { precision: 14, scale: 6 }),
  /** Objective selected when trade was entered */
  objective:       varchar("objective", { length: 64 }),
  /** FAULTLINE pressure score at entry */
  pressureAtEntry: int("pressureAtEntry"),
  /** Regime label at entry */
  regimeAtEntry:   varchar("regimeAtEntry", { length: 80 }),
  /** "open" | "closed" */
  status:          mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  openedAt:        timestamp("openedAt").defaultNow().notNull(),
  closedAt:        timestamp("closedAt"),
  updatedAt:       timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OwnerSimulationPosition = typeof ownerSimulationPositions.$inferSelect;
export type InsertOwnerSimulationPosition = typeof ownerSimulationPositions.$inferInsert;

/**
 * Immutable trade log for the owner simulation account.
 */
export const ownerSimulationTrades = mysqlTable("ownerSimulationTrades", {
  id:                    int("id").autoincrement().primaryKey(),
  accountId:             int("accountId").notNull(),
  positionId:            int("positionId"),
  symbol:                varchar("symbol", { length: 20 }).notNull(),
  assetType:             mysqlEnum("assetType", ["stock", "crypto"]).notNull(),
  side:                  mysqlEnum("side", ["BUY", "SELL", "TRIM", "ADD"]).notNull(),
  quantity:              decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  entryPrice:            decimal("entryPrice", { precision: 14, scale: 6 }).notNull(),
  exitPrice:             decimal("exitPrice", { precision: 14, scale: 6 }),
  notionalValue:         decimal("notionalValue", { precision: 14, scale: 2 }).notNull(),
  realizedPnl:           decimal("realizedPnl", { precision: 14, scale: 2 }),
  stopLoss:              decimal("stopLoss", { precision: 14, scale: 6 }),
  targetOne:             decimal("targetOne", { precision: 14, scale: 6 }),
  targetTwo:             decimal("targetTwo", { precision: 14, scale: 6 }),
  faultlineScoreAtEntry: int("faultlineScoreAtEntry"),
  pressureIndexAtEntry:  int("pressureIndexAtEntry"),
  regimeAtEntry:         varchar("regimeAtEntry", { length: 80 }),
  bullBearAtEntry:       varchar("bullBearAtEntry", { length: 40 }),
  objective:             varchar("objective", { length: 64 }),
  rationale:             text("rationale"),
  /** "open" | "closed" | "watchlist" | "rejected" */
  status:                mysqlEnum("status", ["open", "closed", "watchlist", "rejected"]).default("open").notNull(),
  rejectionReason:       text("rejectionReason"),
  createdAt:             timestamp("createdAt").defaultNow().notNull(),
  closedAt:              timestamp("closedAt"),
});
export type OwnerSimulationTrade = typeof ownerSimulationTrades.$inferSelect;
export type InsertOwnerSimulationTrade = typeof ownerSimulationTrades.$inferInsert;

/**
 * Daily performance snapshots for the owner simulation account.
 */
export const ownerSimulationDailySnapshots = mysqlTable("ownerSimulationDailySnapshots", {
  id:              int("id").autoincrement().primaryKey(),
  accountId:       int("accountId").notNull(),
  /** ISO date YYYY-MM-DD */
  date:            varchar("date", { length: 12 }).notNull(),
  startValue:      decimal("startValue", { precision: 14, scale: 2 }),
  endValue:        decimal("endValue", { precision: 14, scale: 2 }),
  dailyPnl:        decimal("dailyPnl", { precision: 14, scale: 2 }),
  dailyReturnPct:  decimal("dailyReturnPct", { precision: 8, scale: 4 }),
  bestTrade:       varchar("bestTrade", { length: 128 }),
  worstTrade:      varchar("worstTrade", { length: 128 }),
  /** AI-generated day summary (markdown) */
  aiSummary:       text("aiSummary"),
  tradesCount:     int("tradesCount").default(0).notNull(),
  createdAt:       timestamp("createdAt").defaultNow().notNull(),
});
export type OwnerSimulationDailySnapshot = typeof ownerSimulationDailySnapshots.$inferSelect;
export type InsertOwnerSimulationDailySnapshot = typeof ownerSimulationDailySnapshots.$inferInsert;

/**
 * Session objective settings for the owner simulation.
 * One row per session/update — latest row is the active objective.
 */
export const ownerSimulationObjectives = mysqlTable("ownerSimulationObjectives", {
  id:               int("id").autoincrement().primaryKey(),
  accountId:        int("accountId").notNull(),
  /** e.g. "short_swing" | "long_position" | "crypto_momentum" | "defensive" | "ai_tech" | "custom" */
  objectiveType:    varchar("objectiveType", { length: 32 }).notNull(),
  /** "stocks" | "crypto" | "both" */
  assetPreference:  varchar("assetPreference", { length: 16 }).notNull().default("both"),
  /** "aggressive" | "balanced" | "defensive" */
  riskMode:         varchar("riskMode", { length: 16 }).notNull().default("balanced"),
  /** Max position size as % of account (e.g. 10 = 10%) */
  maxPositionSizePct: decimal("maxPositionSizePct", { precision: 5, scale: 2 }).notNull().default("10.00"),
  /** Max loss per trade in USD */
  maxLossPerTrade:  decimal("maxLossPerTrade", { precision: 14, scale: 2 }).notNull().default("2000.00"),
  /** "intraday" | "1_5_days" | "2_6_weeks" | "3_12_months" */
  timeframe:        varchar("timeframe", { length: 20 }).notNull().default("1_5_days"),
  customNote:       text("customNote"),
  createdAt:        timestamp("createdAt").defaultNow().notNull(),
});
export type OwnerSimulationObjective = typeof ownerSimulationObjectives.$inferSelect;
export type InsertOwnerSimulationObjective = typeof ownerSimulationObjectives.$inferInsert;

// ── Shared Public Reports ────────────────────────────────────
/**
 * Shareable public report links.
 * Premium/founding users can generate a public read-only snapshot of any intelligence report.
 * The publicShareId is a nanoid (21 chars) — never sequential.
 */
export const sharedReports = mysqlTable("sharedReports", {
  id:             int("id").autoincrement().primaryKey(),
  ownerUserId:    int("ownerUserId").notNull(),
  /** "stock_intelligence" | "crypto_intelligence" | "market_preflight" | "diagnostic_ai" | "daily_report" */
  reportType:     varchar("reportType", { length: 32 }).notNull(),
  /** Ticker symbol or report subject (e.g. "NVDA", "BTC", "Market Overview") */
  subject:        varchar("subject", { length: 64 }).notNull(),
  /** nanoid 21-char random public ID — used in /r/[publicShareId] URL */
  publicShareId:  varchar("publicShareId", { length: 32 }).notNull().unique(),
  /** Full report snapshot as JSON — only safe public fields, no proprietary formulas */
  snapshotJson:   text("snapshotJson").notNull(),
  /** Optional expiry — null means never expires */
  expiresAt:      timestamp("expiresAt"),
  viewCount:      int("viewCount").default(0).notNull(),
  revoked:        tinyint("revoked").default(0).notNull(),
  createdAt:      timestamp("createdAt").defaultNow().notNull(),
});
export type SharedReport = typeof sharedReports.$inferSelect;
export type InsertSharedReport = typeof sharedReports.$inferInsert;

// ── Signal Outlook History ───────────────────────────────────
/**
 * Stores periodic snapshots of outlook scores for a symbol so users
 * can compare current vs 24h / 7d / 30d readings.
 * Written by the outlook engine on every full outlook computation.
 */
export const outlookHistory = mysqlTable("outlookHistory", {
  id:           int("id").autoincrement().primaryKey(),
  symbol:       varchar("symbol", { length: 30 }).notNull(),
  assetType:    mysqlEnum("assetType", ["stock", "crypto"]).notNull(),
  timeframe:    mysqlEnum("timeframe", ["short", "swing", "long"]).notNull().default("swing"),
  outlookScore: int("outlookScore").notNull(),
  direction:    mysqlEnum("direction", ["Bullish", "Bearish", "Neutral", "Avoid"]).notNull(),
  confidence:   int("confidence").notNull(),
  riskLevel:    mysqlEnum("riskLevel", ["Low", "Moderate", "High", "Extreme"]).notNull(),
  pressureIndex: int("pressureIndex").notNull(),
  regime:       varchar("regime", { length: 40 }).notNull(),
  snapshotAt:   timestamp("snapshotAt").defaultNow().notNull(),
}, (t) => ({
  symbolIdx:     index("outlookHistory_symbol_idx").on(t.symbol),
  symbolTimeIdx: index("outlookHistory_symbol_time_idx").on(t.symbol, t.snapshotAt),
}));
export type OutlookHistory = typeof outlookHistory.$inferSelect;
export type InsertOutlookHistory = typeof outlookHistory.$inferInsert;
