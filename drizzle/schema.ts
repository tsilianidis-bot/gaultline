import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
   * - premium: full intelligence platform, all signals, all engines
   * - founding: same as premium, early-access badge, lifetime benefits
   */
  accessTier: mysqlEnum("accessTier", ["free", "premium", "founding"]).default("free").notNull(),
  /** Stripe customer ID — set on first checkout, used for billing portal and subscription lookups. */
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  /** Active Stripe subscription ID — set by webhook on successful payment, cleared on cancellation. */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
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
  userId:    int("userId").notNull(),            // FK → users.id
  ticker:    varchar("ticker", { length: 20 }).notNull(),
  name:      varchar("name", { length: 120 }).notNull(),
  shares:    decimal("shares", { precision: 18, scale: 8 }).notNull(),   // supports fractional crypto
  costBasis: decimal("costBasis", { precision: 18, scale: 4 }).notNull(), // avg cost per share/unit
  assetType: mysqlEnum("assetType", ["Stock", "ETF", "Crypto", "Other"]).default("Stock").notNull(),
  notes:     text("notes"),
  openedAt:  timestamp("openedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

// ── Crypto Watchlist ─────────────────────────────────────────
/**
 * Stores each user's saved crypto tokens for the watchlist.
 * One row per (userId, symbol) pair — unique constraint prevents duplicates.
 */
export const cryptoWatchlist = mysqlTable("cryptoWatchlist", {
  id:      int("id").autoincrement().primaryKey(),
  userId:  int("userId").notNull(),
  symbol:  varchar("symbol", { length: 20 }).notNull(),
  name:    varchar("name", { length: 120 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

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
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
  updatedAt:   timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;