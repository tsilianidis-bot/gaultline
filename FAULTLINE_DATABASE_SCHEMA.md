# FAULTLINE Database Schema Backup

> **Generated from:** `drizzle/schema.ts` on 2026-08-13. This document contains structure only; it contains **no credentials, record exports, or production data**.

## Restore Authority

The TypeScript schema and all SQL migrations in `drizzle/` are the executable authorities. This Markdown document is a readable recovery map. Use `drizzle/schema.ts` and apply the ordered migration SQL files after a fresh database is provisioned.

## Inventory

| Table | Source declaration | Columns | Index definitions |
|---|---:|---:|---:|
| `users` | `users` | 18 | 0 |
| `positions` | `positions` | 13 | 2 |
| `cryptoWatchlist` | `cryptoWatchlist` | 7 | 2 |
| `foundingAccessRequests` | `foundingAccessRequests` | 8 | 0 |
| `blogPosts` | `blogPosts` | 17 | 0 |
| `xPostQueue` | `xPostQueue` | 12 | 0 |
| `pressureHistory` | `pressureHistory` | 19 | 0 |
| `mobileWatchlist` | `mobileWatchlist` | 8 | 2 |
| `mobileUsage` | `mobileUsage` | 13 | 2 |
| `userMarketAwarenessActions` | `userMarketAwarenessActions` | 9 | 2 |
| `dailyReadingSnapshots` | `dailyReadingSnapshots` | 16 | 0 |
| `pageViews` | `pageViews` | 18 | 3 |
| `analyticsSessions` | `analyticsSessions` | 20 | 2 |
| `siteEvents` | `siteEvents` | 11 | 2 |
| `pressureRuns` | `pressureRuns` | 11 | 0 |
| `featureFlags` | `featureFlags` | 7 | 0 |
| `simPortfolioAccounts` | `simPortfolioAccounts` | 8 | 0 |
| `simPortfolioPositions` | `simPortfolioPositions` | 18 | 0 |
| `simPortfolioTrades` | `simPortfolioTrades` | 13 | 0 |
| `simPortfolioJournal` | `simPortfolioJournal` | 14 | 0 |
| `ownerSimulationAccounts` | `ownerSimulationAccounts` | 9 | 0 |
| `ownerSimulationPositions` | `ownerSimulationPositions` | 20 | 0 |
| `ownerSimulationTrades` | `ownerSimulationTrades` | 24 | 0 |
| `ownerSimulationDailySnapshots` | `ownerSimulationDailySnapshots` | 12 | 0 |
| `ownerSimulationObjectives` | `ownerSimulationObjectives` | 10 | 0 |
| `sharedReports` | `sharedReports` | 10 | 0 |
| `outlookHistory` | `outlookHistory` | 13 | 2 |
| `visitorProfiles` | `visitorProfiles` | 22 | 3 |
| `organicContent` | `organicContent` | 22 | 3 |
| `signalPages` | `signalPages` | 21 | 2 |
| `contentCtaClicks` | `contentCtaClicks` | 11 | 3 |
| `dayTradeWatchlist` | `dayTradeWatchlist` | 7 | 2 |
| `tradeJournal` | `tradeJournal` | 25 | 3 |
| `chatbot_sessions` | `chatbotSessions` | 20 | 4 |
| `chatbot_messages` | `chatbotMessages` | 7 | 1 |
| `chatbot_leads` | `chatbotLeads` | 10 | 2 |
| `decision_ledger` | `decisionLedger` | 37 | 5 |
| `user_preferences` | `userPreferences` | 17 | 1 |
| `daily_brief_schedule` | `dailyBriefSchedule` | 16 | 1 |
| `pipeline_health_log` | `pipelineHealthLog` | 13 | 2 |
| `day_trade_snapshot` | `dayTradeSnapshot` | 6 | 1 |
| `improvement_lessons` | `improvementLessons` | 17 | 4 |
| `ai_improvement_reports` | `aiImprovementReports` | 15 | 1 |
| `demoTokens` | `demoTokens` | 6 | 0 |
| `regimeAlerts` | `regimeAlerts` | 11 | 2 |
| `onboardingEmailSequence` | `onboardingEmailSequence` | 6 | 1 |
| `conversationLogs` | `conversationLogs` | 22 | 4 |
| `conversationMessages` | `conversationMessages` | 15 | 3 |
| `topicClusters` | `topicClusters` | 13 | 2 |
| `featureRequests` | `featureRequests` | 12 | 2 |
| `conversationRetentionPolicy` | `conversationRetentionPolicy` | 6 | 0 |
| `seismographReadings` | `seismographReadings` | 18 | 2 |
| `seismographPatterns` | `seismographPatterns` | 19 | 3 |
| `seismographTransitions` | `seismographTransitions` | 15 | 3 |
| `marketMemory` | `marketMemory` | 7 | 1 |
| `promoCampaigns` | `promoCampaigns` | 13 | 0 |
| `promoRedemptions` | `promoRedemptions` | 18 | 5 |
| `gsc_tokens` | `gscTokens` | 9 | 1 |
| `stripeWebhookEvents` | `stripeWebhookEvents` | 5 | 1 |
| `entitlementAuditLog` | `entitlementAuditLog` | 11 | 2 |
| `shadowModelReadings` | `shadowModelReadings` | 27 | 2 |
| `shadowForwardOutcomes` | `shadowForwardOutcomes` | 12 | 2 |
| `shadowStressAnnotations` | `shadowStressAnnotations` | 13 | 1 |
| `shadowDailySummaries` | `shadowDailySummaries` | 18 | 1 |

## Relationships

| Child field | References |
|---|---|
| `positions.userId` | `users.id` |
| `cryptoWatchlist.userId` | `users.id` |
| `mobileWatchlist.userId` | `users.id` |
| `mobileUsage.userId` | `users.id` |
| `userMarketAwarenessActions.userId` | `users.id` |
| `ownerSimulationAccounts.userId` | `users.id` |
| `dayTradeWatchlist.userId` | `users.id` |
| `tradeJournal.userId` | `users.id` |
| `decision_ledger.userId` | `users.id` |
| `user_preferences.userId` | `users.id` |
| `improvement_lessons.userId` | `users.id` |
| `conversationMessages.conversationId` | `conversationLogs.id` |
| `promoRedemptions.campaignId` | `promoCampaigns.id` |
| `promoRedemptions.userId` | `users.id` |
| `shadowForwardOutcomes.shadowReadingId` | `shadowModelReadings.id` |

## `users`

**Source:** `drizzle/schema.ts:9` — variable `users`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `openId` → `openId` | `varchar("openId", { length: 64 }).notNull().unique()` | Yes | No | Yes | — |
| `name` → `name` | `text("name")` | No | No | No | — |
| `email` → `email` | `varchar("email", { length: 320 })` | No | No | No | — |
| `loginMethod` → `loginMethod` | `varchar("loginMethod", { length: 64 })` | No | No | No | — |
| `role` → `role` | `mysqlEnum("role", ["user", "admin"]).default("user").notNull()` | Yes | No | No | — |
| `accessTier` → `accessTier` | `mysqlEnum("accessTier", ["free", "core", "premium", "founding"]).default("free").notNull()` | Yes | No | No | — |
| `dashboardMode` → `dashboardMode` | `mysqlEnum("dashboardMode", ["pulse", "signals", "intelligence"]).default("pulse").notNull()` | Yes | No | No | — |
| `preflightPromptMode` → `preflightPromptMode` | `mysqlEnum("preflightPromptMode", ["full_guidance", "minimal_reminders", "off"]).default("full_guidance").notNull()` | Yes | No | No | — |
| `stripeCustomerId` → `stripeCustomerId` | `varchar("stripeCustomerId", { length: 64 })` | No | No | No | — |
| `stripeSubscriptionId` → `stripeSubscriptionId` | `varchar("stripeSubscriptionId", { length: 64 })` | No | No | No | — |
| `lifetimeAccess` → `lifetimeAccess` | `boolean("lifetimeAccess").default(false).notNull()` | Yes | No | No | — |
| `lifetimePurchasedAt` → `lifetimePurchasedAt` | `timestamp("lifetimePurchasedAt")` | No | No | No | — |
| `lastPreflightCompletedAt` → `lastPreflightCompletedAt` | `timestamp("lastPreflightCompletedAt")` | No | No | No | — |
| `adminNotes` → `adminNotes` | `text("adminNotes")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `lastSignedIn` → `lastSignedIn` | `timestamp("lastSignedIn").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `positions`

**Source:** `drizzle/schema.ts:77` — variable `positions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `ticker` → `ticker` | `varchar("ticker", { length: 20 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 120 }).notNull()` | Yes | No | No | — |
| `shares` → `shares` | `decimal("shares", { precision: 18, scale: 8 }).notNull()` | Yes | No | No | — |
| `costBasis` → `costBasis` | `decimal("costBasis", { precision: 18, scale: 4 }).notNull()` | Yes | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["Stock", "ETF", "Crypto", "Other"]).default("Stock").notNull()` | Yes | No | No | — |
| `notes` → `notes` | `text("notes")` | No | No | No | — |
| `openedAt` → `openedAt` | `timestamp("openedAt").notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `positions_userId_idx` | `index("positions_userId_idx").on(t.userId)` | No | No | No | — |
| `tickerIdx` → `positions_ticker_idx` | `index("positions_ticker_idx").on(t.ticker)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `positions_userId_idx` | `userId` |
| `tickerIdx` | `index` | `positions_ticker_idx` | `ticker` |

## `cryptoWatchlist`

**Source:** `drizzle/schema.ts:104` — variable `cryptoWatchlist`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `symbol` → `symbol` | `varchar("symbol", { length: 20 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 120 }).notNull()` | Yes | No | No | — |
| `addedAt` → `addedAt` | `timestamp("addedAt").defaultNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `cryptoWatchlist_userId_idx` | `index("cryptoWatchlist_userId_idx").on(t.userId)` | No | No | No | — |
| `userSymbolIdx` → `cryptoWatchlist_userId_symbol_idx` | `index("cryptoWatchlist_userId_symbol_idx").on(t.userId, t.symbol)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `cryptoWatchlist_userId_idx` | `userId` |
| `userSymbolIdx` | `index` | `cryptoWatchlist_userId_symbol_idx` | `userId, symbol` |

## `foundingAccessRequests`

**Source:** `drizzle/schema.ts:123` — variable `foundingAccessRequests`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `email` → `email` | `varchar("email", { length: 320 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 200 })` | No | No | No | — |
| `message` → `message` | `text("message")` | No | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `blogPosts`

**Source:** `drizzle/schema.ts:141` — variable `blogPosts`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `slug` → `slug` | `varchar("slug", { length: 200 }).notNull().unique()` | Yes | No | Yes | — |
| `title` → `title` | `varchar("title", { length: 300 }).notNull()` | Yes | No | No | — |
| `subtitle` → `subtitle` | `varchar("subtitle", { length: 400 })` | No | No | No | — |
| `content` → `content` | `text("content").notNull()` | Yes | No | No | — |
| `author` → `author` | `varchar("author", { length: 100 }).default("FAULTLINE").notNull()` | Yes | No | No | — |
| `category` → `category` | `varchar("category", { length: 80 }).default("Macro Intelligence").notNull()` | Yes | No | No | — |
| `tags` → `tags` | `text("tags")` | No | No | No | — |
| `published` → `published` | `int("published").default(0).notNull()` | Yes | No | No | — |
| `publishedAt` → `publishedAt` | `timestamp("publishedAt")` | No | No | No | — |
| `viewCount` → `viewCount` | `int("viewCount").default(0).notNull()` | Yes | No | No | — |
| `contentClass` → `contentClass` | `mysqlEnum("contentClass", ["evergreen", "intel_record", "test"]).default("intel_record").notNull()` | Yes | No | No | — |
| `metaTitle` → `metaTitle` | `varchar("metaTitle", { length: 70 })` | No | No | No | — |
| `metaDescription` → `metaDescription` | `varchar("metaDescription", { length: 165 })` | No | No | No | — |
| `readTimeMinutes` → `readTimeMinutes` | `int("readTimeMinutes")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `xPostQueue`

**Source:** `drizzle/schema.ts:169` — variable `xPostQueue`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `postType` → `postType` | `mysqlEnum("postType", ["premarket", "midday", "closing", "breaking"]).notNull()` | Yes | No | No | — |
| `variant` → `variant` | `mysqlEnum("variant", ["short", "thread", "founder", "institutional", "breaking"]).notNull()` | Yes | No | No | — |
| `content` → `content` | `text("content").notNull()` | Yes | No | No | — |
| `headline` → `headline` | `varchar("headline", { length: 500 })` | No | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["pending", "posted", "failed", "skipped"]).default("pending").notNull()` | Yes | No | No | — |
| `xPostId` → `xPostId` | `varchar("xPostId", { length: 64 })` | No | No | No | — |
| `errorMsg` → `errorMsg` | `text("errorMsg")` | No | No | No | — |
| `pressureScore` → `pressureScore` | `int("pressureScore")` | No | No | No | — |
| `pressureRegime` → `pressureRegime` | `varchar("pressureRegime", { length: 100 })` | No | No | No | — |
| `postedAt` → `postedAt` | `timestamp("postedAt")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `pressureHistory`

**Source:** `drizzle/schema.ts:192` — variable `pressureHistory`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `month` → `month` | `varchar("month", { length: 7 }).notNull().unique()` | Yes | No | Yes | — |
| `overallPressure` → `overallPressure` | `int("overallPressure").notNull()` | Yes | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 50 }).notNull()` | Yes | No | No | — |
| `liquidityStress` → `liquidityStress` | `int("liquidityStress")` | No | No | No | — |
| `creditContagion` → `creditContagion` | `int("creditContagion")` | No | No | No | — |
| `volatilityRegime` → `volatilityRegime` | `int("volatilityRegime")` | No | No | No | — |
| `macroSensitivity` → `macroSensitivity` | `int("macroSensitivity")` | No | No | No | — |
| `marketBreadth` → `marketBreadth` | `int("marketBreadth")` | No | No | No | — |
| `aiBubble` → `aiBubble` | `int("aiBubble")` | No | No | No | — |
| `baaSpread` → `baaSpread` | `decimal("baaSpread", { precision: 6, scale: 2 })` | No | No | No | — |
| `hySpreadProxy` → `hySpreadProxy` | `decimal("hySpreadProxy", { precision: 6, scale: 2 })` | No | No | No | — |
| `tsy10y` → `tsy10y` | `decimal("tsy10y", { precision: 6, scale: 2 })` | No | No | No | — |
| `tsy2y` → `tsy2y` | `decimal("tsy2y", { precision: 6, scale: 2 })` | No | No | No | — |
| `fedfunds` → `fedfunds` | `decimal("fedfunds", { precision: 6, scale: 2 })` | No | No | No | — |
| `cpiYoy` → `cpiYoy` | `decimal("cpiYoy", { precision: 6, scale: 2 })` | No | No | No | — |
| `unemployment` → `unemployment` | `decimal("unemployment", { precision: 5, scale: 1 })` | No | No | No | — |
| `sp500` → `sp500` | `decimal("sp500", { precision: 10, scale: 2 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `mobileWatchlist`

**Source:** `drizzle/schema.ts:223` — variable `mobileWatchlist`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `symbol` → `symbol` | `varchar("symbol", { length: 30 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 120 }).notNull()` | Yes | No | No | — |
| `type` → `type` | `mysqlEnum("type", ["stock", "crypto"]).notNull().default("stock")` | Yes | No | No | — |
| `addedAt` → `addedAt` | `timestamp("addedAt").defaultNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `mobileWatchlist_userId_idx` | `index("mobileWatchlist_userId_idx").on(t.userId)` | No | No | No | — |
| `userSymbolIdx` → `mobileWatchlist_userId_symbol_idx` | `index("mobileWatchlist_userId_symbol_idx").on(t.userId, t.symbol)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `mobileWatchlist_userId_idx` | `userId` |
| `userSymbolIdx` | `index` | `mobileWatchlist_userId_symbol_idx` | `userId, symbol` |

## `mobileUsage`

**Source:** `drizzle/schema.ts:247` — variable `mobileUsage`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `usageDate` → `usageDate` | `varchar("usageDate", { length: 10 }).notNull()` | Yes | No | No | — |
| `stockSignalsViewed` → `stockSignalsViewed` | `int("stockSignalsViewed").default(0).notNull()` | Yes | No | No | — |
| `cryptoSignalsViewed` → `cryptoSignalsViewed` | `int("cryptoSignalsViewed").default(0).notNull()` | Yes | No | No | — |
| `signalOutlooksRun` → `signalOutlooksRun` | `int("signalOutlooksRun").default(0).notNull()` | Yes | No | No | — |
| `situationRoomMonth` → `situationRoomMonth` | `varchar("situationRoomMonth", { length: 7 }).notNull()` | Yes | No | No | — |
| `situationRoomCount` → `situationRoomCount` | `int("situationRoomCount").default(0).notNull()` | Yes | No | No | — |
| `askQuestionsToday` → `askQuestionsToday` | `int("askQuestionsToday").default(0).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `userDateIdx` → `mobileUsage_userId_usageDate_idx` | `index("mobileUsage_userId_usageDate_idx").on(t.userId, t.usageDate)` | No | No | No | — |
| `userDateUniq` → `mobileUsage_userId_usageDate_uniq` | `index("mobileUsage_userId_usageDate_uniq").on(t.userId, t.usageDate)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userDateIdx` | `index` | `mobileUsage_userId_usageDate_idx` | `userId, usageDate` |
| `userDateUniq` | `index` | `mobileUsage_userId_usageDate_uniq` | `userId, usageDate` |

## `userMarketAwarenessActions`

**Source:** `drizzle/schema.ts:281` — variable `userMarketAwarenessActions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `actionKey` → `actionKey` | `varchar("actionKey", { length: 80 }).notNull()` | Yes | No | No | — |
| `sourcePage` → `sourcePage` | `varchar("sourcePage", { length: 80 })` | No | No | No | — |
| `metadata` → `metadata` | `text("metadata")` | No | No | No | — |
| `completedAt` → `completedAt` | `timestamp("completedAt").defaultNow().notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `userCompletedIdx` → `marketAwareness_userId_completedAt_idx` | `index("marketAwareness_userId_completedAt_idx").on(t.userId, t.completedAt)` | No | No | No | — |
| `actionKeyIdx` → `marketAwareness_actionKey_idx` | `index("marketAwareness_actionKey_idx").on(t.actionKey)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userCompletedIdx` | `index` | `marketAwareness_userId_completedAt_idx` | `userId, completedAt` |
| `actionKeyIdx` | `index` | `marketAwareness_actionKey_idx` | `actionKey` |

## `dailyReadingSnapshots`

**Source:** `drizzle/schema.ts:304` — variable `dailyReadingSnapshots`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `readingDate` → `readingDate` | `varchar("readingDate", { length: 10 }).notNull().unique()` | Yes | No | Yes | — |
| `faultlineScore` → `faultlineScore` | `int("faultlineScore").notNull()` | Yes | No | No | — |
| `stressLevel` → `stressLevel` | `varchar("stressLevel", { length: 20 }).notNull()` | Yes | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 }).notNull()` | Yes | No | No | — |
| `crashProbability` → `crashProbability` | `int("crashProbability")` | No | No | No | — |
| `bullProbability` → `bullProbability` | `int("bullProbability")` | No | No | No | — |
| `pressureDriversJson` → `pressureDriversJson` | `text("pressureDriversJson").notNull()` | Yes | No | No | — |
| `activeAlertsJson` → `activeAlertsJson` | `text("activeAlertsJson").notNull()` | Yes | No | No | — |
| `topSignalsJson` → `topSignalsJson` | `text("topSignalsJson").notNull()` | Yes | No | No | — |
| `dataStatusJson` → `dataStatusJson` | `text("dataStatusJson").notNull()` | Yes | No | No | — |
| `readingSummary` → `readingSummary` | `text("readingSummary")` | No | No | No | — |
| `possibleOutcomesJson` → `possibleOutcomesJson` | `text("possibleOutcomesJson")` | No | No | No | — |
| `scenarioSupportJson` → `scenarioSupportJson` | `text("scenarioSupportJson")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `pageViews`

**Source:** `drizzle/schema.ts:344` — variable `pageViews`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `sessionId` → `sessionId` | `varchar("sessionId", { length: 64 }).notNull()` | Yes | No | No | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `path` → `path` | `varchar("path", { length: 512 }).notNull()` | Yes | No | No | — |
| `title` → `title` | `varchar("title", { length: 256 })` | No | No | No | — |
| `referrer` → `referrer` | `varchar("referrer", { length: 1024 })` | No | No | No | — |
| `utmSource` → `utmSource` | `varchar("utmSource", { length: 128 })` | No | No | No | — |
| `utmMedium` → `utmMedium` | `varchar("utmMedium", { length: 128 })` | No | No | No | — |
| `utmCampaign` → `utmCampaign` | `varchar("utmCampaign", { length: 128 })` | No | No | No | — |
| `country` → `country` | `varchar("country", { length: 4 })` | No | No | No | — |
| `deviceType` → `deviceType` | `varchar("deviceType", { length: 16 })` | No | No | No | — |
| `browser` → `browser` | `varchar("browser", { length: 32 })` | No | No | No | — |
| `os` → `os` | `varchar("os", { length: 32 })` | No | No | No | — |
| `screenWidth` → `screenWidth` | `int("screenWidth")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `pathCreatedIdx` → `pageViews_path_createdAt_idx` | `index("pageViews_path_createdAt_idx").on(t.path, t.createdAt)` | No | No | No | — |
| `sessionIdIdx` → `pageViews_sessionId_idx` | `index("pageViews_sessionId_idx").on(t.sessionId)` | No | No | No | — |
| `userIdCreatedIdx` → `pageViews_userId_createdAt_idx` | `index("pageViews_userId_createdAt_idx").on(t.userId, t.createdAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `pathCreatedIdx` | `index` | `pageViews_path_createdAt_idx` | `path, createdAt` |
| `sessionIdIdx` | `index` | `pageViews_sessionId_idx` | `sessionId` |
| `userIdCreatedIdx` | `index` | `pageViews_userId_createdAt_idx` | `userId, createdAt` |

## `analyticsSessions`

**Source:** `drizzle/schema.ts:388` — variable `analyticsSessions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `sessionId` → `sessionId` | `varchar("sessionId", { length: 64 }).notNull().unique()` | Yes | No | Yes | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `entryPage` → `entryPage` | `varchar("entryPage", { length: 512 })` | No | No | No | — |
| `exitPage` → `exitPage` | `varchar("exitPage", { length: 512 })` | No | No | No | — |
| `pageCount` → `pageCount` | `int("pageCount").default(1).notNull()` | Yes | No | No | — |
| `durationSecs` → `durationSecs` | `int("durationSecs").default(0).notNull()` | Yes | No | No | — |
| `isBounce` → `isBounce` | `int("isBounce").default(1).notNull()` | Yes | No | No | — |
| `country` → `country` | `varchar("country", { length: 4 })` | No | No | No | — |
| `deviceType` → `deviceType` | `varchar("deviceType", { length: 16 })` | No | No | No | — |
| `browser` → `browser` | `varchar("browser", { length: 32 })` | No | No | No | — |
| `os` → `os` | `varchar("os", { length: 32 })` | No | No | No | — |
| `referrer` → `referrer` | `varchar("referrer", { length: 1024 })` | No | No | No | — |
| `utmSource` → `utmSource` | `varchar("utmSource", { length: 128 })` | No | No | No | — |
| `utmMedium` → `utmMedium` | `varchar("utmMedium", { length: 128 })` | No | No | No | — |
| `utmCampaign` → `utmCampaign` | `varchar("utmCampaign", { length: 128 })` | No | No | No | — |
| `startedAt` → `startedAt` | `timestamp("startedAt").defaultNow().notNull()` | Yes | No | No | — |
| `lastSeenAt` → `lastSeenAt` | `timestamp("lastSeenAt").defaultNow().notNull()` | Yes | No | No | — |
| `startedAtIdx` → `analyticsSessions_startedAt_idx` | `index("analyticsSessions_startedAt_idx").on(t.startedAt)` | No | No | No | — |
| `userIdIdx` → `analyticsSessions_userId_idx` | `index("analyticsSessions_userId_idx").on(t.userId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `startedAtIdx` | `index` | `analyticsSessions_startedAt_idx` | `startedAt` |
| `userIdIdx` | `index` | `analyticsSessions_userId_idx` | `userId` |

## `siteEvents`

**Source:** `drizzle/schema.ts:423` — variable `siteEvents`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `sessionId` → `sessionId` | `varchar("sessionId", { length: 64 }).notNull()` | Yes | No | No | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `eventName` → `eventName` | `varchar("eventName", { length: 128 }).notNull()` | Yes | No | No | — |
| `props` → `props` | `text("props")` | No | No | No | — |
| `path` → `path` | `varchar("path", { length: 512 })` | No | No | No | — |
| `country` → `country` | `varchar("country", { length: 4 })` | No | No | No | — |
| `deviceType` → `deviceType` | `varchar("deviceType", { length: 16 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `eventNameCreatedIdx` → `siteEvents_eventName_createdAt_idx` | `index("siteEvents_eventName_createdAt_idx").on(t.eventName, t.createdAt)` | No | No | No | — |
| `userIdIdx` → `siteEvents_userId_idx` | `index("siteEvents_userId_idx").on(t.userId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `eventNameCreatedIdx` | `index` | `siteEvents_eventName_createdAt_idx` | `eventName, createdAt` |
| `userIdIdx` | `index` | `siteEvents_userId_idx` | `userId` |

## `pressureRuns`

**Source:** `drizzle/schema.ts:451` — variable `pressureRuns`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `overallPressure` → `overallPressure` | `int("overallPressure").notNull()` | Yes | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 }).notNull()` | Yes | No | No | — |
| `level` → `level` | `varchar("level", { length: 20 }).notNull()` | Yes | No | No | — |
| `dataSource` → `dataSource` | `mysqlEnum("dataSource", ["live", "fallback"]).notNull()` | Yes | No | No | — |
| `vectorsJson` → `vectorsJson` | `text("vectorsJson").notNull()` | Yes | No | No | — |
| `alertsJson` → `alertsJson` | `text("alertsJson").notNull()` | Yes | No | No | — |
| `topAnalogJson` → `topAnalogJson` | `text("topAnalogJson").notNull()` | Yes | No | No | — |
| `rawInputsJson` → `rawInputsJson` | `text("rawInputsJson")` | No | No | No | — |
| `engineVersion` → `engineVersion` | `varchar("engineVersion", { length: 20 }).default("1.0.0").notNull()` | Yes | No | No | — |
| `computedAt` → `computedAt` | `timestamp("computedAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `featureFlags`

**Source:** `drizzle/schema.ts:483` — variable `featureFlags`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `key` → `key` | `varchar("key", { length: 80 }).notNull().unique()` | Yes | No | Yes | — |
| `enabled` → `enabled` | `int("enabled").default(1).notNull()` | Yes | No | No | — |
| `description` → `description` | `text("description")` | No | No | No | — |
| `updatedBy` → `updatedBy` | `int("updatedBy")` | No | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `simPortfolioAccounts`

**Source:** `drizzle/schema.ts:505` — variable `simPortfolioAccounts`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountType` → `accountType` | `mysqlEnum("accountType", ["stocks", "crypto"]).notNull()` | Yes | No | No | — |
| `accountLabel` → `accountLabel` | `varchar("accountLabel", { length: 32 }).notNull().default("demo")` | Yes | No | No | — |
| `startingCapital` → `startingCapital` | `decimal("startingCapital", { precision: 14, scale: 2 }).notNull().default("10000.00")` | Yes | No | No | — |
| `cashBalance` → `cashBalance` | `decimal("cashBalance", { precision: 14, scale: 2 }).notNull().default("10000.00")` | Yes | No | No | — |
| `startedAt` → `startedAt` | `varchar("startedAt", { length: 12 }).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `simPortfolioPositions`

**Source:** `drizzle/schema.ts:527` — variable `simPortfolioPositions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountId` → `accountId` | `int("accountId").notNull()` | Yes | No | No | — |
| `ticker` → `ticker` | `varchar("ticker", { length: 16 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 128 })` | No | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull()` | Yes | No | No | — |
| `quantity` → `quantity` | `decimal("quantity", { precision: 18, scale: 8 }).notNull()` | Yes | No | No | — |
| `entryPrice` → `entryPrice` | `decimal("entryPrice", { precision: 14, scale: 6 }).notNull()` | Yes | No | No | — |
| `totalCost` → `totalCost` | `decimal("totalCost", { precision: 14, scale: 2 }).notNull()` | Yes | No | No | — |
| `currentPrice` → `currentPrice` | `decimal("currentPrice", { precision: 14, scale: 6 })` | No | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["open", "closed"]).default("open").notNull()` | Yes | No | No | — |
| `exitPrice` → `exitPrice` | `decimal("exitPrice", { precision: 14, scale: 6 })` | No | No | No | — |
| `entrySignal` → `entrySignal` | `varchar("entrySignal", { length: 128 })` | No | No | No | — |
| `exitSignal` → `exitSignal` | `varchar("exitSignal", { length: 128 })` | No | No | No | — |
| `entryRationale` → `entryRationale` | `text("entryRationale")` | No | No | No | — |
| `exitRationale` → `exitRationale` | `text("exitRationale")` | No | No | No | — |
| `openedAt` → `openedAt` | `timestamp("openedAt").defaultNow().notNull()` | Yes | No | No | — |
| `closedAt` → `closedAt` | `timestamp("closedAt")` | No | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `simPortfolioTrades`

**Source:** `drizzle/schema.ts:564` — variable `simPortfolioTrades`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountId` → `accountId` | `int("accountId").notNull()` | Yes | No | No | — |
| `positionId` → `positionId` | `int("positionId")` | No | No | No | — |
| `ticker` → `ticker` | `varchar("ticker", { length: 16 }).notNull()` | Yes | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull()` | Yes | No | No | — |
| `action` → `action` | `mysqlEnum("action", ["BUY", "SELL"]).notNull()` | Yes | No | No | — |
| `quantity` → `quantity` | `decimal("quantity", { precision: 18, scale: 8 }).notNull()` | Yes | No | No | — |
| `price` → `price` | `decimal("price", { precision: 14, scale: 6 }).notNull()` | Yes | No | No | — |
| `totalValue` → `totalValue` | `decimal("totalValue", { precision: 14, scale: 2 }).notNull()` | Yes | No | No | — |
| `pressureScore` → `pressureScore` | `int("pressureScore")` | No | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 })` | No | No | No | — |
| `rationale` → `rationale` | `text("rationale")` | No | No | No | — |
| `executedAt` → `executedAt` | `timestamp("executedAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `simPortfolioJournal`

**Source:** `drizzle/schema.ts:591` — variable `simPortfolioJournal`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `date` → `date` | `varchar("date", { length: 12 }).notNull().unique()` | Yes | No | Yes | — |
| `pressureScore` → `pressureScore` | `int("pressureScore")` | No | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 })` | No | No | No | — |
| `totalValue` → `totalValue` | `decimal("totalValue", { precision: 14, scale: 2 })` | No | No | No | — |
| `stocksValue` → `stocksValue` | `decimal("stocksValue", { precision: 14, scale: 2 })` | No | No | No | — |
| `cryptoValue` → `cryptoValue` | `decimal("cryptoValue", { precision: 14, scale: 2 })` | No | No | No | — |
| `dailyPnl` → `dailyPnl` | `decimal("dailyPnl", { precision: 14, scale: 2 })` | No | No | No | — |
| `dailyPnlPct` → `dailyPnlPct` | `decimal("dailyPnlPct", { precision: 8, scale: 4 })` | No | No | No | — |
| `journalEntry` → `journalEntry` | `text("journalEntry").notNull()` | Yes | No | No | — |
| `holdingsJson` → `holdingsJson` | `text("holdingsJson")` | No | No | No | — |
| `tradesJson` → `tradesJson` | `text("tradesJson")` | No | No | No | — |
| `tradesMade` → `tradesMade` | `int("tradesMade").default(0).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `ownerSimulationAccounts`

**Source:** `drizzle/schema.ts:630` — variable `ownerSimulationAccounts`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `startingCapital` → `startingCapital` | `decimal("startingCapital", { precision: 14, scale: 2 }).notNull().default("100000.00")` | Yes | No | No | — |
| `currentCash` → `currentCash` | `decimal("currentCash", { precision: 14, scale: 2 }).notNull().default("100000.00")` | Yes | No | No | — |
| `currentValue` → `currentValue` | `decimal("currentValue", { precision: 14, scale: 2 }).notNull().default("100000.00")` | Yes | No | No | — |
| `targetValue` → `targetValue` | `decimal("targetValue", { precision: 14, scale: 2 }).notNull().default("1000000.00")` | Yes | No | No | — |
| `startedAt` → `startedAt` | `varchar("startedAt", { length: 12 }).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `ownerSimulationPositions`

**Source:** `drizzle/schema.ts:648` — variable `ownerSimulationPositions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountId` → `accountId` | `int("accountId").notNull()` | Yes | No | No | — |
| `symbol` → `symbol` | `varchar("symbol", { length: 20 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 128 })` | No | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull()` | Yes | No | No | — |
| `quantity` → `quantity` | `decimal("quantity", { precision: 18, scale: 8 }).notNull()` | Yes | No | No | — |
| `averageEntry` → `averageEntry` | `decimal("averageEntry", { precision: 14, scale: 6 }).notNull()` | Yes | No | No | — |
| `currentPrice` → `currentPrice` | `decimal("currentPrice", { precision: 14, scale: 6 })` | No | No | No | — |
| `marketValue` → `marketValue` | `decimal("marketValue", { precision: 14, scale: 2 })` | No | No | No | — |
| `unrealizedPnl` → `unrealizedPnl` | `decimal("unrealizedPnl", { precision: 14, scale: 2 })` | No | No | No | — |
| `stopLoss` → `stopLoss` | `decimal("stopLoss", { precision: 14, scale: 6 })` | No | No | No | — |
| `targetOne` → `targetOne` | `decimal("targetOne", { precision: 14, scale: 6 })` | No | No | No | — |
| `targetTwo` → `targetTwo` | `decimal("targetTwo", { precision: 14, scale: 6 })` | No | No | No | — |
| `objective` → `objective` | `varchar("objective", { length: 64 })` | No | No | No | — |
| `pressureAtEntry` → `pressureAtEntry` | `int("pressureAtEntry")` | No | No | No | — |
| `regimeAtEntry` → `regimeAtEntry` | `varchar("regimeAtEntry", { length: 80 })` | No | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["open", "closed"]).default("open").notNull()` | Yes | No | No | — |
| `openedAt` → `openedAt` | `timestamp("openedAt").defaultNow().notNull()` | Yes | No | No | — |
| `closedAt` → `closedAt` | `timestamp("closedAt")` | No | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `ownerSimulationTrades`

**Source:** `drizzle/schema.ts:680` — variable `ownerSimulationTrades`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountId` → `accountId` | `int("accountId").notNull()` | Yes | No | No | — |
| `positionId` → `positionId` | `int("positionId")` | No | No | No | — |
| `symbol` → `symbol` | `varchar("symbol", { length: 20 }).notNull()` | Yes | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull()` | Yes | No | No | — |
| `side` → `side` | `mysqlEnum("side", ["BUY", "SELL", "TRIM", "ADD"]).notNull()` | Yes | No | No | — |
| `quantity` → `quantity` | `decimal("quantity", { precision: 18, scale: 8 }).notNull()` | Yes | No | No | — |
| `entryPrice` → `entryPrice` | `decimal("entryPrice", { precision: 14, scale: 6 }).notNull()` | Yes | No | No | — |
| `exitPrice` → `exitPrice` | `decimal("exitPrice", { precision: 14, scale: 6 })` | No | No | No | — |
| `notionalValue` → `notionalValue` | `decimal("notionalValue", { precision: 14, scale: 2 }).notNull()` | Yes | No | No | — |
| `realizedPnl` → `realizedPnl` | `decimal("realizedPnl", { precision: 14, scale: 2 })` | No | No | No | — |
| `stopLoss` → `stopLoss` | `decimal("stopLoss", { precision: 14, scale: 6 })` | No | No | No | — |
| `targetOne` → `targetOne` | `decimal("targetOne", { precision: 14, scale: 6 })` | No | No | No | — |
| `targetTwo` → `targetTwo` | `decimal("targetTwo", { precision: 14, scale: 6 })` | No | No | No | — |
| `faultlineScoreAtEntry` → `faultlineScoreAtEntry` | `int("faultlineScoreAtEntry")` | No | No | No | — |
| `pressureIndexAtEntry` → `pressureIndexAtEntry` | `int("pressureIndexAtEntry")` | No | No | No | — |
| `regimeAtEntry` → `regimeAtEntry` | `varchar("regimeAtEntry", { length: 80 })` | No | No | No | — |
| `bullBearAtEntry` → `bullBearAtEntry` | `varchar("bullBearAtEntry", { length: 40 })` | No | No | No | — |
| `objective` → `objective` | `varchar("objective", { length: 64 })` | No | No | No | — |
| `rationale` → `rationale` | `text("rationale")` | No | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["open", "closed", "watchlist", "rejected"]).default("open").notNull()` | Yes | No | No | — |
| `rejectionReason` → `rejectionReason` | `text("rejectionReason")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `closedAt` → `closedAt` | `timestamp("closedAt")` | No | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `ownerSimulationDailySnapshots`

**Source:** `drizzle/schema.ts:713` — variable `ownerSimulationDailySnapshots`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountId` → `accountId` | `int("accountId").notNull()` | Yes | No | No | — |
| `date` → `date` | `varchar("date", { length: 12 }).notNull()` | Yes | No | No | — |
| `startValue` → `startValue` | `decimal("startValue", { precision: 14, scale: 2 })` | No | No | No | — |
| `endValue` → `endValue` | `decimal("endValue", { precision: 14, scale: 2 })` | No | No | No | — |
| `dailyPnl` → `dailyPnl` | `decimal("dailyPnl", { precision: 14, scale: 2 })` | No | No | No | — |
| `dailyReturnPct` → `dailyReturnPct` | `decimal("dailyReturnPct", { precision: 8, scale: 4 })` | No | No | No | — |
| `bestTrade` → `bestTrade` | `varchar("bestTrade", { length: 128 })` | No | No | No | — |
| `worstTrade` → `worstTrade` | `varchar("worstTrade", { length: 128 })` | No | No | No | — |
| `aiSummary` → `aiSummary` | `text("aiSummary")` | No | No | No | — |
| `tradesCount` → `tradesCount` | `int("tradesCount").default(0).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `ownerSimulationObjectives`

**Source:** `drizzle/schema.ts:736` — variable `ownerSimulationObjectives`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `accountId` → `accountId` | `int("accountId").notNull()` | Yes | No | No | — |
| `objectiveType` → `objectiveType` | `varchar("objectiveType", { length: 32 }).notNull()` | Yes | No | No | — |
| `assetPreference` → `assetPreference` | `varchar("assetPreference", { length: 16 }).notNull().default("both")` | Yes | No | No | — |
| `riskMode` → `riskMode` | `varchar("riskMode", { length: 16 }).notNull().default("balanced")` | Yes | No | No | — |
| `maxPositionSizePct` → `maxPositionSizePct` | `decimal("maxPositionSizePct", { precision: 5, scale: 2 }).notNull().default("10.00")` | Yes | No | No | — |
| `maxLossPerTrade` → `maxLossPerTrade` | `decimal("maxLossPerTrade", { precision: 14, scale: 2 }).notNull().default("2000.00")` | Yes | No | No | — |
| `timeframe` → `timeframe` | `varchar("timeframe", { length: 20 }).notNull().default("1_5_days")` | Yes | No | No | — |
| `customNote` → `customNote` | `text("customNote")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `sharedReports`

**Source:** `drizzle/schema.ts:763` — variable `sharedReports`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `ownerUserId` → `ownerUserId` | `int("ownerUserId").notNull()` | Yes | No | No | — |
| `reportType` → `reportType` | `varchar("reportType", { length: 32 }).notNull()` | Yes | No | No | — |
| `subject` → `subject` | `varchar("subject", { length: 64 }).notNull()` | Yes | No | No | — |
| `publicShareId` → `publicShareId` | `varchar("publicShareId", { length: 32 }).notNull().unique()` | Yes | No | Yes | — |
| `snapshotJson` → `snapshotJson` | `text("snapshotJson").notNull()` | Yes | No | No | — |
| `expiresAt` → `expiresAt` | `timestamp("expiresAt")` | No | No | No | — |
| `viewCount` → `viewCount` | `int("viewCount").default(0).notNull()` | Yes | No | No | — |
| `revoked` → `revoked` | `tinyint("revoked").default(0).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `outlookHistory`

**Source:** `drizzle/schema.ts:789` — variable `outlookHistory`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `symbol` → `symbol` | `varchar("symbol", { length: 30 }).notNull()` | Yes | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull()` | Yes | No | No | — |
| `timeframe` → `timeframe` | `mysqlEnum("timeframe", ["day", "short", "swing", "long"]).notNull().default("swing")` | Yes | No | No | — |
| `outlookScore` → `outlookScore` | `int("outlookScore").notNull()` | Yes | No | No | — |
| `direction` → `direction` | `mysqlEnum("direction", ["Bullish", "Bearish", "Neutral", "Avoid"]).notNull()` | Yes | No | No | — |
| `confidence` → `confidence` | `int("confidence").notNull()` | Yes | No | No | — |
| `riskLevel` → `riskLevel` | `mysqlEnum("riskLevel", ["Low", "Moderate", "High", "Extreme"]).notNull()` | Yes | No | No | — |
| `pressureIndex` → `pressureIndex` | `int("pressureIndex").notNull()` | Yes | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 40 }).notNull()` | Yes | No | No | — |
| `snapshotAt` → `snapshotAt` | `timestamp("snapshotAt").defaultNow().notNull()` | Yes | No | No | — |
| `symbolIdx` → `outlookHistory_symbol_idx` | `index("outlookHistory_symbol_idx").on(t.symbol)` | No | No | No | — |
| `symbolTimeIdx` → `outlookHistory_symbol_time_idx` | `index("outlookHistory_symbol_time_idx").on(t.symbol, t.snapshotAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `symbolIdx` | `index` | `outlookHistory_symbol_idx` | `symbol` |
| `symbolTimeIdx` | `index` | `outlookHistory_symbol_time_idx` | `symbol, snapshotAt` |

## `visitorProfiles`

**Source:** `drizzle/schema.ts:814` — variable `visitorProfiles`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `visitorId` → `visitorId` | `varchar("visitorId", { length: 64 }).notNull().unique()` | Yes | No | Yes | — |
| `visitCount` → `visitCount` | `int("visitCount").default(1).notNull()` | Yes | No | No | — |
| `totalPages` → `totalPages` | `int("totalPages").default(1).notNull()` | Yes | No | No | — |
| `country` → `country` | `varchar("country", { length: 4 })` | No | No | No | — |
| `countryName` → `countryName` | `varchar("countryName", { length: 80 })` | No | No | No | — |
| `city` → `city` | `varchar("city", { length: 80 })` | No | No | No | — |
| `region` → `region` | `varchar("region", { length: 80 })` | No | No | No | — |
| `deviceType` → `deviceType` | `varchar("deviceType", { length: 16 })` | No | No | No | — |
| `browser` → `browser` | `varchar("browser", { length: 32 })` | No | No | No | — |
| `os` → `os` | `varchar("os", { length: 32 })` | No | No | No | — |
| `firstReferrer` → `firstReferrer` | `varchar("firstReferrer", { length: 1024 })` | No | No | No | — |
| `firstUtmSource` → `firstUtmSource` | `varchar("firstUtmSource", { length: 128 })` | No | No | No | — |
| `firstUtmMedium` → `firstUtmMedium` | `varchar("firstUtmMedium", { length: 128 })` | No | No | No | — |
| `firstUtmCampaign` → `firstUtmCampaign` | `varchar("firstUtmCampaign", { length: 128 })` | No | No | No | — |
| `converted` → `converted` | `int("converted").default(0).notNull()` | Yes | No | No | — |
| `convertedAt` → `convertedAt` | `timestamp("convertedAt")` | No | No | No | — |
| `firstSeenAt` → `firstSeenAt` | `timestamp("firstSeenAt").defaultNow().notNull()` | Yes | No | No | — |
| `lastSeenAt` → `lastSeenAt` | `timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `visitorIdIdx` → `visitorProfiles_visitorId_idx` | `index("visitorProfiles_visitorId_idx").on(t.visitorId)` | No | No | No | — |
| `countryIdx` → `visitorProfiles_country_idx` | `index("visitorProfiles_country_idx").on(t.country)` | No | No | No | — |
| `lastSeenIdx` → `visitorProfiles_lastSeenAt_idx` | `index("visitorProfiles_lastSeenAt_idx").on(t.lastSeenAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `visitorIdIdx` | `index` | `visitorProfiles_visitorId_idx` | `visitorId` |
| `countryIdx` | `index` | `visitorProfiles_country_idx` | `country` |
| `lastSeenIdx` | `index` | `visitorProfiles_lastSeenAt_idx` | `lastSeenAt` |

## `organicContent`

**Source:** `drizzle/schema.ts:863` — variable `organicContent`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `contentType` → `contentType` | `varchar("contentType", { length: 60 }).notNull()` | Yes | No | No | — |
| `slug` → `slug` | `varchar("slug", { length: 220 }).notNull().unique()` | Yes | No | Yes | — |
| `title` → `title` | `varchar("title", { length: 300 }).notNull()` | Yes | No | No | — |
| `metaDescription` → `metaDescription` | `varchar("metaDescription", { length: 200 }).notNull()` | Yes | No | No | — |
| `content` → `content` | `text("content").notNull()` | Yes | No | No | — |
| `schemaJson` → `schemaJson` | `text("schemaJson")` | No | No | No | — |
| `internalLinksJson` → `internalLinksJson` | `text("internalLinksJson")` | No | No | No | — |
| `featuredImagePrompt` → `featuredImagePrompt` | `text("featuredImagePrompt")` | No | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["draft", "published", "rejected"]).default("draft").notNull()` | Yes | No | No | — |
| `qualityScore` → `qualityScore` | `int("qualityScore")` | No | No | No | — |
| `wordCount` → `wordCount` | `int("wordCount")` | No | No | No | — |
| `duplicateOf` → `duplicateOf` | `int("duplicateOf")` | No | No | No | — |
| `rejectionReason` → `rejectionReason` | `varchar("rejectionReason", { length: 200 })` | No | No | No | — |
| `pressureScore` → `pressureScore` | `int("pressureScore")` | No | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 })` | No | No | No | — |
| `publishedAt` → `publishedAt` | `timestamp("publishedAt")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `slugIdx` → `organicContent_slug_idx` | `index("organicContent_slug_idx").on(t.slug)` | No | No | No | — |
| `typeStatusIdx` → `organicContent_type_status_idx` | `index("organicContent_type_status_idx").on(t.contentType, t.status)` | No | No | No | — |
| `publishedAtIdx` → `organicContent_publishedAt_idx` | `index("organicContent_publishedAt_idx").on(t.publishedAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `slugIdx` | `index` | `organicContent_slug_idx` | `slug` |
| `typeStatusIdx` | `index` | `organicContent_type_status_idx` | `contentType, status` |
| `publishedAtIdx` | `index` | `organicContent_publishedAt_idx` | `publishedAt` |

## `signalPages`

**Source:** `drizzle/schema.ts:912` — variable `signalPages`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `symbol` → `symbol` | `varchar("symbol", { length: 20 }).notNull().unique()` | Yes | No | Yes | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 128 })` | No | No | No | — |
| `signalSummary` → `signalSummary` | `text("signalSummary")` | No | No | No | — |
| `bullishCase` → `bullishCase` | `text("bullishCase")` | No | No | No | — |
| `bearishCase` → `bearishCase` | `text("bearishCase")` | No | No | No | — |
| `macroRisks` → `macroRisks` | `text("macroRisks")` | No | No | No | — |
| `technicalRisks` → `technicalRisks` | `text("technicalRisks")` | No | No | No | — |
| `catalystAnalysis` → `catalystAnalysis` | `text("catalystAnalysis")` | No | No | No | — |
| `confidenceScore` → `confidenceScore` | `int("confidenceScore")` | No | No | No | — |
| `faqJson` → `faqJson` | `text("faqJson")` | No | No | No | — |
| `signalLabel` → `signalLabel` | `varchar("signalLabel", { length: 20 })` | No | No | No | — |
| `lastPrice` → `lastPrice` | `decimal("lastPrice", { precision: 14, scale: 4 })` | No | No | No | — |
| `dailyChangePct` → `dailyChangePct` | `decimal("dailyChangePct", { precision: 8, scale: 4 })` | No | No | No | — |
| `pressureScore` → `pressureScore` | `int("pressureScore")` | No | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 })` | No | No | No | — |
| `lastUpdatedAt` → `lastUpdatedAt` | `timestamp("lastUpdatedAt").defaultNow().notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `symbolIdx` → `signalPages_symbol_idx` | `index("signalPages_symbol_idx").on(t.symbol)` | No | No | No | — |
| `assetTypeIdx` → `signalPages_assetType_idx` | `index("signalPages_assetType_idx").on(t.assetType)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `symbolIdx` | `index` | `signalPages_symbol_idx` | `symbol` |
| `assetTypeIdx` | `index` | `signalPages_assetType_idx` | `assetType` |

## `contentCtaClicks`

**Source:** `drizzle/schema.ts:960` — variable `contentCtaClicks`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `pageSlug` → `pageSlug` | `varchar("pageSlug", { length: 300 }).notNull()` | Yes | No | No | — |
| `ctaType` → `ctaType` | `mysqlEnum("ctaType", ["start_free", "demo", "pricing", "related_tool"]).notNull()` | Yes | No | No | — |
| `visitorId` → `visitorId` | `varchar("visitorId", { length: 64 })` | No | No | No | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `country` → `country` | `varchar("country", { length: 4 })` | No | No | No | — |
| `deviceType` → `deviceType` | `varchar("deviceType", { length: 16 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `pageSlugIdx` → `contentCtaClicks_pageSlug_idx` | `index("contentCtaClicks_pageSlug_idx").on(t.pageSlug)` | No | No | No | — |
| `ctaTypeIdx` → `contentCtaClicks_ctaType_idx` | `index("contentCtaClicks_ctaType_idx").on(t.ctaType)` | No | No | No | — |
| `createdAtIdx` → `contentCtaClicks_createdAt_idx` | `index("contentCtaClicks_createdAt_idx").on(t.createdAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `pageSlugIdx` | `index` | `contentCtaClicks_pageSlug_idx` | `pageSlug` |
| `ctaTypeIdx` | `index` | `contentCtaClicks_ctaType_idx` | `ctaType` |
| `createdAtIdx` | `index` | `contentCtaClicks_createdAt_idx` | `createdAt` |

## `dayTradeWatchlist`

**Source:** `drizzle/schema.ts:986` — variable `dayTradeWatchlist`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `symbol` → `symbol` | `varchar("symbol", { length: 20 }).notNull()` | Yes | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull().default("stock")` | Yes | No | No | — |
| `addedAt` → `addedAt` | `timestamp("addedAt").defaultNow().notNull()` | Yes | No | No | — |
| `userSymbolIdx` → `dayTradeWatchlist_user_symbol_idx` | `uniqueIndex("dayTradeWatchlist_user_symbol_idx").on(t.userId, t.symbol)` | No | No | No | — |
| `userIdx` → `dayTradeWatchlist_userId_idx` | `index("dayTradeWatchlist_userId_idx").on(t.userId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userSymbolIdx` | `uniqueIndex` | `dayTradeWatchlist_user_symbol_idx` | `userId, symbol` |
| `userIdx` | `index` | `dayTradeWatchlist_userId_idx` | `userId` |

## `tradeJournal`

**Source:** `drizzle/schema.ts:1005` — variable `tradeJournal`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `symbol` → `symbol` | `varchar("symbol", { length: 20 }).notNull()` | Yes | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"]).notNull().default("stock")` | Yes | No | No | — |
| `direction` → `direction` | `mysqlEnum("direction", ["long", "short"]).notNull().default("long")` | Yes | No | No | — |
| `entryPrice` → `entryPrice` | `decimal("entryPrice", { precision: 18, scale: 6 }).notNull()` | Yes | No | No | — |
| `exitPrice` → `exitPrice` | `decimal("exitPrice", { precision: 18, scale: 6 })` | No | No | No | — |
| `quantity` → `quantity` | `decimal("quantity", { precision: 18, scale: 8 }).notNull()` | Yes | No | No | — |
| `stopLoss` → `stopLoss` | `decimal("stopLoss", { precision: 18, scale: 6 })` | No | No | No | — |
| `target` → `target` | `decimal("target", { precision: 18, scale: 6 })` | No | No | No | — |
| `realizedPnl` → `realizedPnl` | `decimal("realizedPnl", { precision: 18, scale: 4 })` | No | No | No | — |
| `pnlPercent` → `pnlPercent` | `decimal("pnlPercent", { precision: 8, scale: 4 })` | No | No | No | — |
| `outcome` → `outcome` | `mysqlEnum("outcome", ["win", "loss", "breakeven", "open"]).default("open").notNull()` | Yes | No | No | — |
| `setupGrade` → `setupGrade` | `varchar("setupGrade", { length: 4 })` | No | No | No | — |
| `executionScore` → `executionScore` | `int("executionScore")` | No | No | No | — |
| `notes` → `notes` | `text("notes")` | No | No | No | — |
| `tags` → `tags` | `varchar("tags", { length: 300 })` | No | No | No | — |
| `followedSetup` → `followedSetup` | `int("followedSetup").default(0).notNull()` | Yes | No | No | — |
| `enteredAt` → `enteredAt` | `timestamp("enteredAt").notNull()` | Yes | No | No | — |
| `exitedAt` → `exitedAt` | `timestamp("exitedAt")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `tradeJournal_userId_idx` | `index("tradeJournal_userId_idx").on(t.userId)` | No | No | No | — |
| `userSymbolIdx` → `tradeJournal_userId_symbol_idx` | `index("tradeJournal_userId_symbol_idx").on(t.userId, t.symbol)` | No | No | No | — |
| `userEnteredIdx` → `tradeJournal_userId_enteredAt_idx` | `index("tradeJournal_userId_enteredAt_idx").on(t.userId, t.enteredAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `tradeJournal_userId_idx` | `userId` |
| `userSymbolIdx` | `index` | `tradeJournal_userId_symbol_idx` | `userId, symbol` |
| `userEnteredIdx` | `index` | `tradeJournal_userId_enteredAt_idx` | `userId, enteredAt` |

## `chatbot_sessions`

**Source:** `drizzle/schema.ts:1060` — variable `chatbotSessions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `visitorId` → `visitorId` | `varchar("visitorId", { length: 64 }).notNull()` | Yes | No | No | — |
| `pageUrl` → `pageUrl` | `varchar("pageUrl", { length: 512 })` | No | No | No | — |
| `email` → `email` | `varchar("email", { length: 320 })` | No | No | No | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `leadScore` → `leadScore` | `int("leadScore").default(0).notNull()` | Yes | No | No | — |
| `signupIntent` → `signupIntent` | `tinyint("signupIntent").default(0).notNull()` | Yes | No | No | — |
| `pricingIntent` → `pricingIntent` | `tinyint("pricingIntent").default(0).notNull()` | Yes | No | No | — |
| `securitiesMentioned` → `securitiesMentioned` | `varchar("securitiesMentioned", { length: 512 })` | No | No | No | — |
| `planInterest` → `planInterest` | `varchar("planInterest", { length: 32 })` | No | No | No | — |
| `conversionStatus` → `conversionStatus` | `mysqlEnum("conversionStatus", ["none", "lead", "signup", "paid"]).default("none").notNull()` | Yes | No | No | — |
| `reviewed` → `reviewed` | `tinyint("reviewed").default(0).notNull()` | Yes | No | No | — |
| `adminNote` → `adminNote` | `text("adminNote")` | No | No | No | — |
| `messageCount` → `messageCount` | `int("messageCount").default(0).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `visitorIdx` → `chatbot_sessions_visitor_idx` | `index("chatbot_sessions_visitor_idx").on(t.visitorId)` | No | No | No | — |
| `createdIdx` → `chatbot_sessions_created_idx` | `index("chatbot_sessions_created_idx").on(t.createdAt)` | No | No | No | — |
| `leadScoreIdx` → `chatbot_sessions_lead_score_idx` | `index("chatbot_sessions_lead_score_idx").on(t.leadScore)` | No | No | No | — |
| `statusIdx` → `chatbot_sessions_status_idx` | `index("chatbot_sessions_status_idx").on(t.conversionStatus)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `visitorIdx` | `index` | `chatbot_sessions_visitor_idx` | `visitorId` |
| `createdIdx` | `index` | `chatbot_sessions_created_idx` | `createdAt` |
| `leadScoreIdx` | `index` | `chatbot_sessions_lead_score_idx` | `leadScore` |
| `statusIdx` | `index` | `chatbot_sessions_status_idx` | `conversionStatus` |

## `chatbot_messages`

**Source:** `drizzle/schema.ts:1100` — variable `chatbotMessages`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `sessionId` → `sessionId` | `int("sessionId").notNull()` | Yes | No | No | — |
| `role` → `role` | `mysqlEnum("role", ["user", "bot"]).notNull()` | Yes | No | No | — |
| `content` → `content` | `text("content").notNull()` | Yes | No | No | — |
| `intent` → `intent` | `varchar("intent", { length: 64 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `sessionIdx` → `chatbot_messages_session_idx` | `index("chatbot_messages_session_idx").on(t.sessionId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `sessionIdx` | `index` | `chatbot_messages_session_idx` | `sessionId` |

## `chatbot_leads`

**Source:** `drizzle/schema.ts:1116` — variable `chatbotLeads`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `sessionId` → `sessionId` | `int("sessionId").notNull()` | Yes | No | No | — |
| `visitorId` → `visitorId` | `varchar("visitorId", { length: 64 }).notNull()` | Yes | No | No | — |
| `email` → `email` | `varchar("email", { length: 320 }).notNull()` | Yes | No | No | — |
| `interest` → `interest` | `text("interest")` | No | No | No | — |
| `leadScore` → `leadScore` | `int("leadScore").default(0).notNull()` | Yes | No | No | — |
| `planInterest` → `planInterest` | `varchar("planInterest", { length: 32 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `sessionIdx` → `chatbot_leads_session_idx` | `index("chatbot_leads_session_idx").on(t.sessionId)` | No | No | No | — |
| `emailIdx` → `chatbot_leads_email_idx` | `index("chatbot_leads_email_idx").on(t.email)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `sessionIdx` | `index` | `chatbot_leads_session_idx` | `sessionId` |
| `emailIdx` | `index` | `chatbot_leads_email_idx` | `email` |

## `decision_ledger`

**Source:** `drizzle/schema.ts:1138` — variable `decisionLedger`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `ticker` → `ticker` | `varchar("ticker", { length: 20 })` | No | No | No | — |
| `assetType` → `assetType` | `mysqlEnum("assetType", ["stock", "crypto"])` | No | No | No | — |
| `verdict` → `verdict` | `varchar("verdict", { length: 32 }).notNull()` | Yes | No | No | — |
| `opportunityScore` → `opportunityScore` | `int("opportunityScore").notNull()` | Yes | No | No | — |
| `confidence` → `confidence` | `int("confidence").notNull()` | Yes | No | No | — |
| `primaryDriver` → `primaryDriver` | `text("primaryDriver").notNull()` | Yes | No | No | — |
| `expectedTimeframe` → `expectedTimeframe` | `varchar("expectedTimeframe", { length: 64 }).notNull()` | Yes | No | No | — |
| `queryType` → `queryType` | `varchar("queryType", { length: 32 }).notNull()` | Yes | No | No | — |
| `outcome` → `outcome` | `mysqlEnum("outcome", ["pending", "correct", "incorrect", "partially_correct", "still_active"]).default("pending").notNull()` | Yes | No | No | — |
| `notes` → `notes` | `text("notes")` | No | No | No | — |
| `evaluationNotes` → `evaluationNotes` | `text("evaluationNotes")` | No | No | No | — |
| `priceAtEntry` → `priceAtEntry` | `double("priceAtEntry")` | No | No | No | — |
| `priceAtResolution` → `priceAtResolution` | `double("priceAtResolution")` | No | No | No | — |
| `elapsedMs` → `elapsedMs` | `bigint("elapsedMs", { mode: "number" })` | No | No | No | — |
| `autoEvaluated` → `autoEvaluated` | `boolean("autoEvaluated").default(false).notNull()` | Yes | No | No | — |
| `evaluatedAt` → `evaluatedAt` | `timestamp("evaluatedAt")` | No | No | No | — |
| `scheduleCronTaskUid` → `scheduleCronTaskUid` | `varchar("scheduleCronTaskUid", { length: 65 })` | No | No | No | — |
| `resolvedAt` → `resolvedAt` | `timestamp("resolvedAt")` | No | No | No | — |
| `sector` → `sector` | `varchar("sector", { length: 40 })` | No | No | No | — |
| `recommendationType` → `recommendationType` | `varchar("recommendationType", { length: 40 })` | No | No | No | — |
| `engineSource` → `engineSource` | `varchar("engineSource", { length: 50 })` | No | No | No | — |
| `returnPct` → `returnPct` | `double("returnPct")` | No | No | No | — |
| `drawdownPct` → `drawdownPct` | `double("drawdownPct")` | No | No | No | — |
| `timeToTargetHours` → `timeToTargetHours` | `double("timeToTargetHours")` | No | No | No | — |
| `regimeAtTime` → `regimeAtTime` | `varchar("regimeAtTime", { length: 80 })` | No | No | No | — |
| `stockRegimeAtTime` → `stockRegimeAtTime` | `varchar("stockRegimeAtTime", { length: 80 })` | No | No | No | — |
| `cryptoRegimeAtTime` → `cryptoRegimeAtTime` | `varchar("cryptoRegimeAtTime", { length: 100 })` | No | No | No | — |
| `alignmentAtTime` → `alignmentAtTime` | `varchar("alignmentAtTime", { length: 80 })` | No | No | No | — |
| `marketCapCategory` → `marketCapCategory` | `varchar("marketCapCategory", { length: 20 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `decision_ledger_userId_idx` | `index("decision_ledger_userId_idx").on(t.userId)` | No | No | No | — |
| `userDateIdx` → `decision_ledger_userId_date_idx` | `index("decision_ledger_userId_date_idx").on(t.userId, t.createdAt)` | No | No | No | — |
| `cronUidIdx` → `decision_ledger_cronUid_idx` | `index("decision_ledger_cronUid_idx").on(t.scheduleCronTaskUid)` | No | No | No | — |
| `engineIdx` → `decision_ledger_engineSource_idx` | `index("decision_ledger_engineSource_idx").on(t.engineSource)` | No | No | No | — |
| `sectorIdx` → `decision_ledger_sector_idx` | `index("decision_ledger_sector_idx").on(t.sector)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `decision_ledger_userId_idx` | `userId` |
| `userDateIdx` | `index` | `decision_ledger_userId_date_idx` | `userId, createdAt` |
| `cronUidIdx` | `index` | `decision_ledger_cronUid_idx` | `scheduleCronTaskUid` |
| `engineIdx` | `index` | `decision_ledger_engineSource_idx` | `engineSource` |
| `sectorIdx` | `index` | `decision_ledger_sector_idx` | `sector` |

## `user_preferences`

**Source:** `drizzle/schema.ts:1216` — variable `userPreferences`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique()` | Yes | No | Yes | `users.id` |
| `onboardingComplete` → `onboardingComplete` | `boolean("onboardingComplete").default(false).notNull()` | Yes | No | No | — |
| `investorType` → `investorType` | `varchar("investorType", { length: 32 })` | No | No | No | — |
| `riskProfile` → `riskProfile` | `varchar("riskProfile", { length: 32 })` | No | No | No | — |
| `interests` → `interests` | `text("interests")` | No | No | No | — |
| `watchlistTickers` → `watchlistTickers` | `text("watchlistTickers")` | No | No | No | — |
| `notificationPrefs` → `notificationPrefs` | `text("notificationPrefs")` | No | No | No | — |
| `hasSeenGettingStartedVideo` → `hasSeenGettingStartedVideo` | `boolean("hasSeenGettingStartedVideo").default(false).notNull()` | Yes | No | No | — |
| `startupPage` → `startupPage` | `varchar("startupPage", { length: 32 }).default("now")` | No | No | No | — |
| `experienceMode` → `experienceMode` | `varchar("experienceMode", { length: 16 }).default("guided")` | No | No | No | — |
| `skipAshaWelcome` → `skipAshaWelcome` | `boolean("skipAshaWelcome").default(false).notNull()` | Yes | No | No | — |
| `lastVisitSnapshot` → `lastVisitSnapshot` | `text("lastVisitSnapshot")` | No | No | No | — |
| `lastVisitAt` → `lastVisitAt` | `timestamp("lastVisitAt")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `user_preferences_userId_idx` | `index("user_preferences_userId_idx").on(t.userId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `user_preferences_userId_idx` | `userId` |

## `daily_brief_schedule`

**Source:** `drizzle/schema.ts:1257` — variable `dailyBriefSchedule`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `taskUid` → `taskUid` | `varchar("taskUid", { length: 65 })` | No | No | No | — |
| `cronExpression` → `cronExpression` | `varchar("cronExpression", { length: 64 }).notNull().default("0 0 7 * * *")` | Yes | No | No | — |
| `isActive` → `isActive` | `boolean("isActive").default(true).notNull()` | Yes | No | No | — |
| `confidenceThreshold` → `confidenceThreshold` | `int("confidenceThreshold").default(70).notNull()` | Yes | No | No | — |
| `minWordCount` → `minWordCount` | `int("minWordCount").default(600).notNull()` | Yes | No | No | — |
| `lastRunAt` → `lastRunAt` | `timestamp("lastRunAt")` | No | No | No | — |
| `lastRunStatus` → `lastRunStatus` | `varchar("lastRunStatus", { length: 20 })` | No | No | No | — |
| `lastRunSlug` → `lastRunSlug` | `varchar("lastRunSlug", { length: 220 })` | No | No | No | — |
| `lastRunError` → `lastRunError` | `text("lastRunError")` | No | No | No | — |
| `totalPublished` → `totalPublished` | `int("totalPublished").default(0).notNull()` | Yes | No | No | — |
| `totalDrafts` → `totalDrafts` | `int("totalDrafts").default(0).notNull()` | Yes | No | No | — |
| `totalSkipped` → `totalSkipped` | `int("totalSkipped").default(0).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `taskUidIdx` → `daily_brief_schedule_taskUid_idx` | `index("daily_brief_schedule_taskUid_idx").on(t.taskUid)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `taskUidIdx` | `index` | `daily_brief_schedule_taskUid_idx` | `taskUid` |

## `pipeline_health_log`

**Source:** `drizzle/schema.ts:1295` — variable `pipelineHealthLog`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey()` | No | Yes | No | — |
| `provider` → `provider` | `varchar("provider", { length: 40 }).notNull()` | Yes | No | No | — |
| `endpoint` → `endpoint` | `varchar("endpoint", { length: 200 }).notNull()` | Yes | No | No | — |
| `responseCode` → `responseCode` | `int("responseCode")` | No | No | No | — |
| `latencyMs` → `latencyMs` | `int("latencyMs")` | No | No | No | — |
| `failureReason` → `failureReason` | `text("failureReason")` | No | No | No | — |
| `retryAttempts` → `retryAttempts` | `int("retryAttempts").default(0).notNull()` | Yes | No | No | — |
| `recoveryStatus` → `recoveryStatus` | `varchar("recoveryStatus", { length: 30 })` | No | No | No | — |
| `resolutionTimeMs` → `resolutionTimeMs` | `int("resolutionTimeMs")` | No | No | No | — |
| `autoRecovered` → `autoRecovered` | `boolean("autoRecovered").default(false).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `providerIdx` → `pipeline_health_log_provider_idx` | `index("pipeline_health_log_provider_idx").on(t.provider)` | No | No | No | — |
| `createdAtIdx` → `pipeline_health_log_createdAt_idx` | `index("pipeline_health_log_createdAt_idx").on(t.createdAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `providerIdx` | `index` | `pipeline_health_log_provider_idx` | `provider` |
| `createdAtIdx` | `index` | `pipeline_health_log_createdAt_idx` | `createdAt` |

## `day_trade_snapshot`

**Source:** `drizzle/schema.ts:1327` — variable `dayTradeSnapshot`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey()` | No | Yes | No | — |
| `cacheKey` → `cacheKey` | `varchar("cacheKey", { length: 120 }).notNull()` | Yes | No | No | — |
| `payload` → `payload` | `text("payload").notNull()` | Yes | No | No | — |
| `capturedAt` → `capturedAt` | `bigint("capturedAt", { mode: "number", unsigned: true }).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `cacheKeyIdx` → `day_trade_snapshot_cacheKey_idx` | `uniqueIndex("day_trade_snapshot_cacheKey_idx").on(t.cacheKey)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `cacheKeyIdx` | `uniqueIndex` | `day_trade_snapshot_cacheKey_idx` | `cacheKey` |

## `improvement_lessons`

**Source:** `drizzle/schema.ts:1347` — variable `improvementLessons`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `ledgerEntryId` → `ledgerEntryId` | `int("ledgerEntryId").notNull()` | Yes | No | No | — |
| `ticker` → `ticker` | `varchar("ticker", { length: 20 })` | No | No | No | — |
| `assetType` → `assetType` | `varchar("assetType", { length: 20 })` | No | No | No | — |
| `verdict` → `verdict` | `varchar("verdict", { length: 32 })` | No | No | No | — |
| `outcome` → `outcome` | `varchar("outcome", { length: 30 })` | No | No | No | — |
| `lessonText` → `lessonText` | `text("lessonText").notNull()` | Yes | No | No | — |
| `patternTag` → `patternTag` | `varchar("patternTag", { length: 60 })` | No | No | No | — |
| `confidence` → `confidence` | `int("confidence")` | No | No | No | — |
| `engineSource` → `engineSource` | `varchar("engineSource", { length: 50 })` | No | No | No | — |
| `regimeAtTime` → `regimeAtTime` | `varchar("regimeAtTime", { length: 80 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `userIdIdx` → `improvement_lessons_userId_idx` | `index("improvement_lessons_userId_idx").on(t.userId)` | No | No | No | — |
| `ledgerEntryIdx` → `improvement_lessons_ledgerEntry_idx` | `index("improvement_lessons_ledgerEntry_idx").on(t.ledgerEntryId)` | No | No | No | — |
| `patternTagIdx` → `improvement_lessons_patternTag_idx` | `index("improvement_lessons_patternTag_idx").on(t.patternTag)` | No | No | No | — |
| `engineIdx` → `improvement_lessons_engineSource_idx` | `index("improvement_lessons_engineSource_idx").on(t.engineSource)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdIdx` | `index` | `improvement_lessons_userId_idx` | `userId` |
| `ledgerEntryIdx` | `index` | `improvement_lessons_ledgerEntry_idx` | `ledgerEntryId` |
| `patternTagIdx` | `index` | `improvement_lessons_patternTag_idx` | `patternTag` |
| `engineIdx` | `index` | `improvement_lessons_engineSource_idx` | `engineSource` |

## `ai_improvement_reports`

**Source:** `drizzle/schema.ts:1386` — variable `aiImprovementReports`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey()` | No | Yes | No | — |
| `weekOf` → `weekOf` | `varchar("weekOf", { length: 10 }).notNull().unique()` | Yes | No | Yes | — |
| `reportText` → `reportText` | `text("reportText").notNull()` | Yes | No | No | — |
| `totalAnalyzed` → `totalAnalyzed` | `int("totalAnalyzed").default(0).notNull()` | Yes | No | No | — |
| `correctCount` → `correctCount` | `int("correctCount").default(0).notNull()` | Yes | No | No | — |
| `incorrectCount` → `incorrectCount` | `int("incorrectCount").default(0).notNull()` | Yes | No | No | — |
| `partialCount` → `partialCount` | `int("partialCount").default(0).notNull()` | Yes | No | No | — |
| `activeCount` → `activeCount` | `int("activeCount").default(0).notNull()` | Yes | No | No | — |
| `topPatterns` → `topPatterns` | `text("topPatterns")` | No | No | No | — |
| `weaknesses` → `weaknesses` | `text("weaknesses")` | No | No | No | — |
| `recommendations` → `recommendations` | `text("recommendations")` | No | No | No | — |
| `accuracyRate` → `accuracyRate` | `double("accuracyRate")` | No | No | No | — |
| `generatedAt` → `generatedAt` | `timestamp("generatedAt").defaultNow().notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `weekOfIdx` → `ai_improvement_reports_weekOf_idx` | `index("ai_improvement_reports_weekOf_idx").on(t.weekOf)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `weekOfIdx` | `index` | `ai_improvement_reports_weekOf_idx` | `weekOf` |

## `demoTokens`

**Source:** `drizzle/schema.ts:1426` — variable `demoTokens`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `token` → `token` | `varchar("token", { length: 64 }).notNull().unique()` | Yes | No | Yes | — |
| `used` → `used` | `boolean("used").default(false).notNull()` | Yes | No | No | — |
| `usedAt` → `usedAt` | `timestamp("usedAt")` | No | No | No | — |
| `usedByIp` → `usedByIp` | `varchar("usedByIp", { length: 64 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `regimeAlerts`

**Source:** `drizzle/schema.ts:1447` — variable `regimeAlerts`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `asset` → `asset` | `varchar("asset", { length: 16 }).notNull()` | Yes | No | No | — |
| `previous` → `previous` | `varchar("previous", { length: 128 }).notNull()` | Yes | No | No | — |
| `current` → `current` | `varchar("current", { length: 128 }).notNull()` | Yes | No | No | — |
| `message` → `message` | `text("message").notNull()` | Yes | No | No | — |
| `whyItMatters` → `whyItMatters` | `text("whyItMatters").notNull()` | Yes | No | No | — |
| `whatToWatchNext` → `whatToWatchNext` | `text("whatToWatchNext").notNull()` | Yes | No | No | — |
| `detectedAt` → `detectedAt` | `bigint("detectedAt", { mode: "number" }).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `assetIdx` → `regime_alerts_asset_idx` | `index("regime_alerts_asset_idx").on(t.asset)` | No | No | No | — |
| `detectedAtIdx` → `regime_alerts_detectedAt_idx` | `index("regime_alerts_detectedAt_idx").on(t.detectedAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `assetIdx` | `index` | `regime_alerts_asset_idx` | `asset` |
| `detectedAtIdx` | `index` | `regime_alerts_detectedAt_idx` | `detectedAt` |

## `onboardingEmailSequence`

**Source:** `drizzle/schema.ts:1478` — variable `onboardingEmailSequence`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull()` | Yes | No | No | — |
| `step` → `step` | `int("step").notNull()` | Yes | No | No | — |
| `sentAt` → `sentAt` | `bigint("sentAt", { mode: "number" }).notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `userStepIdx` → `oes_user_step_idx` | `index("oes_user_step_idx").on(t.userId, t.step)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userStepIdx` | `index` | `oes_user_step_idx` | `userId, step` |

## `conversationLogs`

**Source:** `drizzle/schema.ts:1496` — variable `conversationLogs`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `sessionId` → `sessionId` | `varchar("sessionId", { length: 64 }).notNull()` | Yes | No | No | — |
| `userId` → `userId` | `int("userId")` | No | No | No | — |
| `userTier` → `userTier` | `mysqlEnum("userTier", ["free", "core", "premium", "founding", "anonymous"]).default("anonymous").notNull()` | Yes | No | No | — |
| `module` → `module` | `varchar("module", { length: 64 })` | No | No | No | — |
| `pagePath` → `pagePath` | `varchar("pagePath", { length: 255 })` | No | No | No | — |
| `symbolsMentioned` → `symbolsMentioned` | `text("symbolsMentioned")` | No | No | No | — |
| `topics` → `topics` | `text("topics")` | No | No | No | — |
| `messageCount` → `messageCount` | `int("messageCount").default(0).notNull()` | Yes | No | No | — |
| `upgradedAfter` → `upgradedAfter` | `boolean("upgradedAfter").default(false).notNull()` | Yes | No | No | — |
| `upgradedToTier` → `upgradedToTier` | `varchar("upgradedToTier", { length: 32 })` | No | No | No | — |
| `avgConfidenceScore` → `avgConfidenceScore` | `double("avgConfidenceScore")` | No | No | No | — |
| `avgResponseTimeMs` → `avgResponseTimeMs` | `double("avgResponseTimeMs")` | No | No | No | — |
| `hasQualityFlag` → `hasQualityFlag` | `boolean("hasQualityFlag").default(false).notNull()` | Yes | No | No | — |
| `retentionExpiresAt` → `retentionExpiresAt` | `timestamp("retentionExpiresAt")` | No | No | No | — |
| `startedAt` → `startedAt` | `timestamp("startedAt").defaultNow().notNull()` | Yes | No | No | — |
| `endedAt` → `endedAt` | `timestamp("endedAt")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `sessionIdx` → `cl_session_idx` | `index("cl_session_idx").on(t.sessionId)` | No | No | No | — |
| `userIdx` → `cl_user_idx` | `index("cl_user_idx").on(t.userId)` | No | No | No | — |
| `startedIdx` → `cl_started_idx` | `index("cl_started_idx").on(t.startedAt)` | No | No | No | — |
| `tierIdx` → `cl_tier_idx` | `index("cl_tier_idx").on(t.userTier)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `sessionIdx` | `index` | `cl_session_idx` | `sessionId` |
| `userIdx` | `index` | `cl_user_idx` | `userId` |
| `startedIdx` | `index` | `cl_started_idx` | `startedAt` |
| `tierIdx` | `index` | `cl_tier_idx` | `userTier` |

## `conversationMessages`

**Source:** `drizzle/schema.ts:1541` — variable `conversationMessages`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `conversationId` → `conversationId` | `int("conversationId").notNull().references(() => conversationLogs.id, { onDelete: "cascade" })` | Yes | No | No | `conversationLogs.id` |
| `role` → `role` | `mysqlEnum("role", ["user", "assistant"]).notNull()` | Yes | No | No | — |
| `content` → `content` | `text("content").notNull()` | Yes | No | No | — |
| `responseTimeMs` → `responseTimeMs` | `int("responseTimeMs")` | No | No | No | — |
| `confidenceScore` → `confidenceScore` | `double("confidenceScore")` | No | No | No | — |
| `hasFollowUp` → `hasFollowUp` | `boolean("hasFollowUp").default(false).notNull()` | Yes | No | No | — |
| `topicClusterKey` → `topicClusterKey` | `varchar("topicClusterKey", { length: 64 })` | No | No | No | — |
| `symbolsMentioned` → `symbolsMentioned` | `varchar("symbolsMentioned", { length: 255 })` | No | No | No | — |
| `qualityFlag` → `qualityFlag` | `mysqlEnum("qualityFlag", ["hallucination", "low_confidence", "error", "unanswered", "off_topic"])` | No | No | No | — |
| `userRating` → `userRating` | `tinyint("userRating")` | No | No | No | — |
| `timestamp` → `timestamp` | `timestamp("timestamp").defaultNow().notNull()` | Yes | No | No | — |
| `convIdx` → `cm_conv_idx` | `index("cm_conv_idx").on(t.conversationId)` | No | No | No | — |
| `topicIdx` → `cm_topic_idx` | `index("cm_topic_idx").on(t.topicClusterKey)` | No | No | No | — |
| `timeIdx` → `cm_time_idx` | `index("cm_time_idx").on(t.timestamp)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `convIdx` | `index` | `cm_conv_idx` | `conversationId` |
| `topicIdx` | `index` | `cm_topic_idx` | `topicClusterKey` |
| `timeIdx` | `index` | `cm_time_idx` | `timestamp` |

## `topicClusters`

**Source:** `drizzle/schema.ts:1575` — variable `topicClusters`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `clusterKey` → `clusterKey` | `varchar("clusterKey", { length: 128 }).notNull().unique()` | Yes | No | Yes | — |
| `label` → `label` | `varchar("label", { length: 128 }).notNull()` | Yes | No | No | — |
| `exampleQuestions` → `exampleQuestions` | `text("exampleQuestions")` | No | No | No | — |
| `count` → `count` | `int("count").default(0).notNull()` | Yes | No | No | — |
| `trend7d` → `trend7d` | `int("trend7d").default(0).notNull()` | Yes | No | No | — |
| `avgConfidence` → `avgConfidence` | `double("avgConfidence")` | No | No | No | — |
| `isUnanswered` → `isUnanswered` | `boolean("isUnanswered").default(false).notNull()` | Yes | No | No | — |
| `hasHighFollowUp` → `hasHighFollowUp` | `boolean("hasHighFollowUp").default(false).notNull()` | Yes | No | No | — |
| `lastSeenAt` → `lastSeenAt` | `timestamp("lastSeenAt").defaultNow().notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `keyIdx` → `tc_key_idx` | `index("tc_key_idx").on(t.clusterKey)` | No | No | No | — |
| `countIdx` → `tc_count_idx` | `index("tc_count_idx").on(t.count)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `keyIdx` | `index` | `tc_key_idx` | `clusterKey` |
| `countIdx` | `index` | `tc_count_idx` | `count` |

## `featureRequests`

**Source:** `drizzle/schema.ts:1606` — variable `featureRequests`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `requestText` → `requestText` | `text("requestText").notNull()` | Yes | No | No | — |
| `normalizedText` → `normalizedText` | `varchar("normalizedText", { length: 255 }).notNull()` | Yes | No | No | — |
| `count` → `count` | `int("count").default(1).notNull()` | Yes | No | No | — |
| `priorityScore` → `priorityScore` | `double("priorityScore").default(0).notNull()` | Yes | No | No | — |
| `status` → `status` | `mysqlEnum("status", ["new", "under_review", "planned", "in_progress", "shipped", "wont_do"]).default("new").notNull()` | Yes | No | No | — |
| `category` → `category` | `varchar("category", { length: 64 })` | No | No | No | — |
| `firstSeenAt` → `firstSeenAt` | `timestamp("firstSeenAt").defaultNow().notNull()` | Yes | No | No | — |
| `lastSeenAt` → `lastSeenAt` | `timestamp("lastSeenAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `priorityIdx` → `fr_priority_idx` | `index("fr_priority_idx").on(t.priorityScore)` | No | No | No | — |
| `statusIdx` → `fr_status_idx` | `index("fr_status_idx").on(t.status)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `priorityIdx` | `index` | `fr_priority_idx` | `priorityScore` |
| `statusIdx` | `index` | `fr_status_idx` | `status` |

## `conversationRetentionPolicy`

**Source:** `drizzle/schema.ts:1634` — variable `conversationRetentionPolicy`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `retentionDays` → `retentionDays` | `int("retentionDays").default(90).notNull()` | Yes | No | No | — |
| `anonymizeOnExpiry` → `anonymizeOnExpiry` | `boolean("anonymizeOnExpiry").default(true).notNull()` | Yes | No | No | — |
| `loggingEnabled` → `loggingEnabled` | `boolean("loggingEnabled").default(true).notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `updatedBy` → `updatedBy` | `int("updatedBy")` | No | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `seismographReadings`

**Source:** `drizzle/schema.ts:1653` — variable `seismographReadings`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `readingDate` → `readingDate` | `varchar("readingDate", { length: 10 }).notNull().unique()` | Yes | No | Yes | — |
| `pressureScore` → `pressureScore` | `int("pressureScore").notNull()` | Yes | No | No | — |
| `stressLevel` → `stressLevel` | `varchar("stressLevel", { length: 20 }).notNull()` | Yes | No | No | — |
| `regime` → `regime` | `varchar("regime", { length: 80 }).notNull()` | Yes | No | No | — |
| `subScoresJson` → `subScoresJson` | `text("subScoresJson").notNull()` | Yes | No | No | — |
| `bullProbability` → `bullProbability` | `int("bullProbability")` | No | No | No | — |
| `crashProbability` → `crashProbability` | `int("crashProbability")` | No | No | No | — |
| `direction` → `direction` | `varchar("direction", { length: 10 }).notNull().default("stable")` | Yes | No | No | — |
| `deltaFromPrior` → `deltaFromPrior` | `int("deltaFromPrior").notNull().default(0)` | Yes | No | No | — |
| `streakDays` → `streakDays` | `int("streakDays").notNull().default(0)` | Yes | No | No | — |
| `historicalPercentile` → `historicalPercentile` | `int("historicalPercentile")` | No | No | No | — |
| `pressureDriversJson` → `pressureDriversJson` | `text("pressureDriversJson").notNull().default("[]")` | Yes | No | No | — |
| `activeAlertsJson` → `activeAlertsJson` | `text("activeAlertsJson").notNull().default("[]")` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `dateIdx` → `seismo_readings_date_idx` | `index("seismo_readings_date_idx").on(t.readingDate)` | No | No | No | — |
| `scoreIdx` → `seismo_readings_score_idx` | `index("seismo_readings_score_idx").on(t.pressureScore)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `dateIdx` | `index` | `seismo_readings_date_idx` | `readingDate` |
| `scoreIdx` | `index` | `seismo_readings_score_idx` | `pressureScore` |

## `seismographPatterns`

**Source:** `drizzle/schema.ts:1681` — variable `seismographPatterns`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `detectedAt` → `detectedAt` | `varchar("detectedAt", { length: 10 }).notNull()` | Yes | No | No | — |
| `patternType` → `patternType` | `varchar("patternType", { length: 60 }).notNull()` | Yes | No | No | — |
| `patternName` → `patternName` | `varchar("patternName", { length: 120 }).notNull()` | Yes | No | No | — |
| `patternDescription` → `patternDescription` | `text("patternDescription").notNull()` | Yes | No | No | — |
| `confidence` → `confidence` | `int("confidence").notNull()` | Yes | No | No | — |
| `frequency` → `frequency` | `varchar("frequency", { length: 20 }).notNull()` | Yes | No | No | — |
| `historicalCount` → `historicalCount` | `int("historicalCount").notNull().default(0)` | Yes | No | No | — |
| `analogMatchesJson` → `analogMatchesJson` | `text("analogMatchesJson").notNull().default("[]")` | Yes | No | No | — |
| `outcomeDistributionJson` → `outcomeDistributionJson` | `text("outcomeDistributionJson").notNull().default("{}")` | Yes | No | No | — |
| `invalidationConditions` → `invalidationConditions` | `text("invalidationConditions")` | No | No | No | — |
| `isActive` → `isActive` | `boolean("isActive").notNull().default(true)` | Yes | No | No | — |
| `resolvedAt` → `resolvedAt` | `varchar("resolvedAt", { length: 10 })` | No | No | No | — |
| `actualOutcome` → `actualOutcome` | `varchar("actualOutcome", { length: 20 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `detectedIdx` → `seismo_patterns_detected_idx` | `index("seismo_patterns_detected_idx").on(t.detectedAt)` | No | No | No | — |
| `typeIdx` → `seismo_patterns_type_idx` | `index("seismo_patterns_type_idx").on(t.patternType)` | No | No | No | — |
| `activeIdx` → `seismo_patterns_active_idx` | `index("seismo_patterns_active_idx").on(t.isActive)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `detectedIdx` | `index` | `seismo_patterns_detected_idx` | `detectedAt` |
| `typeIdx` | `index` | `seismo_patterns_type_idx` | `patternType` |
| `activeIdx` | `index` | `seismo_patterns_active_idx` | `isActive` |

## `seismographTransitions`

**Source:** `drizzle/schema.ts:1710` — variable `seismographTransitions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `transitionDate` → `transitionDate` | `varchar("transitionDate", { length: 10 }).notNull()` | Yes | No | No | — |
| `fromRegime` → `fromRegime` | `varchar("fromRegime", { length: 80 }).notNull()` | Yes | No | No | — |
| `toRegime` → `toRegime` | `varchar("toRegime", { length: 80 }).notNull()` | Yes | No | No | — |
| `pressureAtTransition` → `pressureAtTransition` | `int("pressureAtTransition").notNull()` | Yes | No | No | — |
| `confidence` → `confidence` | `int("confidence").notNull()` | Yes | No | No | — |
| `priorRegimeDuration` → `priorRegimeDuration` | `int("priorRegimeDuration").notNull().default(0)` | Yes | No | No | — |
| `explanation` → `explanation` | `text("explanation")` | No | No | No | — |
| `driversJson` → `driversJson` | `text("driversJson").notNull().default("[]")` | Yes | No | No | — |
| `historicalBaseRate` → `historicalBaseRate` | `int("historicalBaseRate")` | No | No | No | — |
| `confirmed` → `confirmed` | `boolean("confirmed")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `dateIdx` → `seismo_transitions_date_idx` | `index("seismo_transitions_date_idx").on(t.transitionDate)` | No | No | No | — |
| `fromRegimeIdx` → `seismo_transitions_from_idx` | `index("seismo_transitions_from_idx").on(t.fromRegime)` | No | No | No | — |
| `toRegimeIdx` → `seismo_transitions_to_idx` | `index("seismo_transitions_to_idx").on(t.toRegime)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `dateIdx` | `index` | `seismo_transitions_date_idx` | `transitionDate` |
| `fromRegimeIdx` | `index` | `seismo_transitions_from_idx` | `fromRegime` |
| `toRegimeIdx` | `index` | `seismo_transitions_to_idx` | `toRegime` |

## `marketMemory`

**Source:** `drizzle/schema.ts:1736` — variable `marketMemory`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `memoryKey` → `memoryKey` | `varchar("memoryKey", { length: 120 }).notNull().unique()` | Yes | No | Yes | — |
| `memoryValue` → `memoryValue` | `text("memoryValue").notNull()` | Yes | No | No | — |
| `description` → `description` | `varchar("description", { length: 255 })` | No | No | No | — |
| `writtenBy` → `writtenBy` | `varchar("writtenBy", { length: 60 })` | No | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `keyIdx` → `market_memory_key_idx` | `index("market_memory_key_idx").on(t.memoryKey)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `keyIdx` | `index` | `market_memory_key_idx` | `memoryKey` |

## `promoCampaigns`

**Source:** `drizzle/schema.ts:1755` — variable `promoCampaigns`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `code` → `code` | `varchar("code", { length: 50 }).notNull().unique()` | Yes | No | Yes | — |
| `description` → `description` | `varchar("description", { length: 255 })` | No | No | No | — |
| `trialTier` → `trialTier` | `mysqlEnum("trialTier", ["free", "core", "premium", "founding"]).default("premium").notNull()` | Yes | No | No | — |
| `trialDays` → `trialDays` | `int("trialDays").default(30).notNull()` | Yes | No | No | — |
| `maxRedemptions` → `maxRedemptions` | `int("maxRedemptions").default(100).notNull()` | Yes | No | No | — |
| `redemptionCount` → `redemptionCount` | `int("redemptionCount").default(0).notNull()` | Yes | No | No | — |
| `active` → `active` | `boolean("active").default(true).notNull()` | Yes | No | No | — |
| `source` → `source` | `varchar("source", { length: 100 })` | No | No | No | — |
| `milestones` → `milestones` | `varchar("milestones", { length: 100 }).default("75,90,100")` | No | No | No | — |
| `milestonesNotified` → `milestonesNotified` | `text("milestonesNotified").default("[]")` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |

**Indexes / constraints declared in the table callback**

- None declared beyond per-column primary-key or unique constraints.

## `promoRedemptions`

**Source:** `drizzle/schema.ts:1787` — variable `promoRedemptions`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `campaignId` → `campaignId` | `int("campaignId").notNull().references(() => promoCampaigns.id)` | Yes | No | No | `promoCampaigns.id` |
| `userId` → `userId` | `int("userId").notNull().references(() => users.id, { onDelete: "cascade" })` | Yes | No | No | `users.id` |
| `redemptionNumber` → `redemptionNumber` | `int("redemptionNumber").notNull()` | Yes | No | No | — |
| `email` → `email` | `varchar("email", { length: 320 }).notNull()` | Yes | No | No | — |
| `name` → `name` | `varchar("name", { length: 200 })` | No | No | No | — |
| `activatedAt` → `activatedAt` | `timestamp("activatedAt").defaultNow().notNull()` | Yes | No | No | — |
| `trialExpiresAt` → `trialExpiresAt` | `timestamp("trialExpiresAt").notNull()` | Yes | No | No | — |
| `engaged` → `engaged` | `boolean("engaged").default(false).notNull()` | Yes | No | No | — |
| `converted` → `converted` | `boolean("converted").default(false).notNull()` | Yes | No | No | — |
| `stripeSubscriptionId` → `stripeSubscriptionId` | `varchar("stripeSubscriptionId", { length: 64 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `campaignIdx` → `promoRedemptions_campaignId_idx` | `index("promoRedemptions_campaignId_idx").on(t.campaignId)` | No | No | No | — |
| `userIdx` → `promoRedemptions_userId_idx` | `index("promoRedemptions_userId_idx").on(t.userId)` | No | No | No | — |
| `emailIdx` → `promoRedemptions_email_idx` | `index("promoRedemptions_email_idx").on(t.email)` | No | No | No | — |
| `userCampaignUniq` → `promoRedemptions_userId_campaignId_uniq` | `uniqueIndex("promoRedemptions_userId_campaignId_uniq").on(t.userId, t.campaignId)` | No | No | No | — |
| `emailCampaignUniq` → `promoRedemptions_email_campaignId_uniq` | `uniqueIndex("promoRedemptions_email_campaignId_uniq").on(t.email, t.campaignId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `campaignIdx` | `index` | `promoRedemptions_campaignId_idx` | `campaignId` |
| `userIdx` | `index` | `promoRedemptions_userId_idx` | `userId` |
| `emailIdx` | `index` | `promoRedemptions_email_idx` | `email` |
| `userCampaignUniq` | `uniqueIndex` | `promoRedemptions_userId_campaignId_uniq` | `userId, campaignId` |
| `emailCampaignUniq` | `uniqueIndex` | `promoRedemptions_email_campaignId_uniq` | `email, campaignId` |

## `gsc_tokens`

**Source:** `drizzle/schema.ts:1821` — variable `gscTokens`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull()` | Yes | No | No | — |
| `accessToken` → `accessToken` | `text("accessToken").notNull()` | Yes | No | No | — |
| `refreshToken` → `refreshToken` | `text("refreshToken")` | No | No | No | — |
| `expiryDate` → `expiryDate` | `bigint("expiryDate", { mode: "number" })` | No | No | No | — |
| `siteUrl` → `siteUrl` | `varchar("siteUrl", { length: 512 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `updatedAt` → `updatedAt` | `timestamp("updatedAt").defaultNow().onUpdateNow().notNull()` | Yes | No | No | — |
| `userIdx` → `gscTokens_userId_uniq` | `uniqueIndex("gscTokens_userId_uniq").on(t.userId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdx` | `uniqueIndex` | `gscTokens_userId_uniq` | `userId` |

## `stripeWebhookEvents`

**Source:** `drizzle/schema.ts:1837` — variable `stripeWebhookEvents`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `eventId` → `eventId` | `varchar("eventId", { length: 128 }).notNull()` | Yes | No | No | — |
| `eventType` → `eventType` | `varchar("eventType", { length: 128 }).notNull()` | Yes | No | No | — |
| `processedAt` → `processedAt` | `timestamp("processedAt").defaultNow().notNull()` | Yes | No | No | — |
| `eventIdUniq` → `stripeWebhookEvents_eventId_uniq` | `uniqueIndex("stripeWebhookEvents_eventId_uniq").on(t.eventId)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `eventIdUniq` | `uniqueIndex` | `stripeWebhookEvents_eventId_uniq` | `eventId` |

## `entitlementAuditLog`

**Source:** `drizzle/schema.ts:1849` — variable `entitlementAuditLog`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `userId` → `userId` | `int("userId").notNull()` | Yes | No | No | — |
| `fromTier` → `fromTier` | `varchar("fromTier", { length: 32 })` | No | No | No | — |
| `toTier` → `toTier` | `varchar("toTier", { length: 32 }).notNull()` | Yes | No | No | — |
| `reason` → `reason` | `varchar("reason", { length: 128 }).notNull()` | Yes | No | No | — |
| `stripeEventId` → `stripeEventId` | `varchar("stripeEventId", { length: 128 })` | No | No | No | — |
| `stripeCustomerId` → `stripeCustomerId` | `varchar("stripeCustomerId", { length: 64 })` | No | No | No | — |
| `stripeSubscriptionId` → `stripeSubscriptionId` | `varchar("stripeSubscriptionId", { length: 64 })` | No | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `userIdx` → `entitlementAuditLog_userId_idx` | `index("entitlementAuditLog_userId_idx").on(t.userId)` | No | No | No | — |
| `createdAtIdx` → `entitlementAuditLog_createdAt_idx` | `index("entitlementAuditLog_createdAt_idx").on(t.createdAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `userIdx` | `index` | `entitlementAuditLog_userId_idx` | `userId` |
| `createdAtIdx` | `index` | `entitlementAuditLog_createdAt_idx` | `createdAt` |

## `shadowModelReadings`

**Source:** `drizzle/schema.ts:1867` — variable `shadowModelReadings`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `readingAt` → `readingAt` | `timestamp("readingAt").defaultNow().notNull()` | Yes | No | No | — |
| `v1Pressure` → `v1Pressure` | `int("v1Pressure").notNull()` | Yes | No | No | — |
| `v3hPressure` → `v3hPressure` | `int("v3hPressure").notNull()` | Yes | No | No | — |
| `scoreDiff` → `scoreDiff` | `int("scoreDiff").notNull()` | Yes | No | No | — |
| `absScoreDiff` → `absScoreDiff` | `int("absScoreDiff").notNull()` | Yes | No | No | — |
| `v1Regime` → `v1Regime` | `varchar("v1Regime", { length: 50 }).notNull()` | Yes | No | No | — |
| `v3hRegime` → `v3hRegime` | `varchar("v3hRegime", { length: 50 }).notNull()` | Yes | No | No | — |
| `regimeAgreement` → `regimeAgreement` | `boolean("regimeAgreement").notNull().default(true)` | Yes | No | No | — |
| `v3hLiquidityScore` → `v3hLiquidityScore` | `int("v3hLiquidityScore")` | No | No | No | — |
| `v3hCreditScore` → `v3hCreditScore` | `int("v3hCreditScore")` | No | No | No | — |
| `v3hVolatilityScore` → `v3hVolatilityScore` | `int("v3hVolatilityScore")` | No | No | No | — |
| `v3hMacroScore` → `v3hMacroScore` | `int("v3hMacroScore")` | No | No | No | — |
| `v3hBreadthScore` → `v3hBreadthScore` | `int("v3hBreadthScore")` | No | No | No | — |
| `v3hAiBubbleScore` → `v3hAiBubbleScore` | `int("v3hAiBubbleScore")` | No | No | No | — |
| `v3hStlfsiScore` → `v3hStlfsiScore` | `int("v3hStlfsiScore")` | No | No | No | — |
| `stlfsiRaw` → `stlfsiRaw` | `decimal("stlfsiRaw", { precision: 8, scale: 4 })` | No | No | No | — |
| `stlfsiZ` → `stlfsiZ` | `decimal("stlfsiZ", { precision: 8, scale: 4 })` | No | No | No | — |
| `flagDivergence5` → `flagDivergence5` | `boolean("flagDivergence5").notNull().default(false)` | Yes | No | No | — |
| `flagDivergence10` → `flagDivergence10` | `boolean("flagDivergence10").notNull().default(false)` | Yes | No | No | — |
| `flagRegimeDisagreement` → `flagRegimeDisagreement` | `boolean("flagRegimeDisagreement").notNull().default(false)` | Yes | No | No | — |
| `flagStlfsiSpike` → `flagStlfsiSpike` | `boolean("flagStlfsiSpike").notNull().default(false)` | Yes | No | No | — |
| `flagStaleStlfsi` → `flagStaleStlfsi` | `boolean("flagStaleStlfsi").notNull().default(false)` | Yes | No | No | — |
| `flagFallback` → `flagFallback` | `boolean("flagFallback").notNull().default(false)` | Yes | No | No | — |
| `engineVersion` → `engineVersion` | `varchar("engineVersion", { length: 20 }).default("v3h-1.0.0")` | No | No | No | — |
| `readingAtIdx` → `shadowModelReadings_readingAt_idx` | `index("shadowModelReadings_readingAt_idx").on(t.readingAt)` | No | No | No | — |
| `divergenceIdx` → `shadowModelReadings_divergence_idx` | `index("shadowModelReadings_divergence_idx").on(t.flagDivergence10)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `readingAtIdx` | `index` | `shadowModelReadings_readingAt_idx` | `readingAt` |
| `divergenceIdx` | `index` | `shadowModelReadings_divergence_idx` | `flagDivergence10` |

## `shadowForwardOutcomes`

**Source:** `drizzle/schema.ts:1900` — variable `shadowForwardOutcomes`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `shadowReadingId` → `shadowReadingId` | `int("shadowReadingId").notNull().references(() => shadowModelReadings.id, { onDelete: "cascade" })` | Yes | No | No | `shadowModelReadings.id` |
| `horizon` → `horizon` | `mysqlEnum("horizon", ["1d", "5d", "20d"]).notNull()` | Yes | No | No | — |
| `dueAt` → `dueAt` | `timestamp("dueAt").notNull()` | Yes | No | No | — |
| `collectedAt` → `collectedAt` | `timestamp("collectedAt")` | No | No | No | — |
| `sp500ReturnPct` → `sp500ReturnPct` | `decimal("sp500ReturnPct", { precision: 8, scale: 4 })` | No | No | No | — |
| `nasdaqReturnPct` → `nasdaqReturnPct` | `decimal("nasdaqReturnPct", { precision: 8, scale: 4 })` | No | No | No | — |
| `vixAtOutcome` → `vixAtOutcome` | `decimal("vixAtOutcome", { precision: 6, scale: 2 })` | No | No | No | — |
| `stressEventOccurred` → `stressEventOccurred` | `boolean("stressEventOccurred").default(false)` | No | No | No | — |
| `notes` → `notes` | `text("notes")` | No | No | No | — |
| `shadowReadingIdx` → `shadowForwardOutcomes_shadowReadingId_idx` | `index("shadowForwardOutcomes_shadowReadingId_idx").on(t.shadowReadingId)` | No | No | No | — |
| `dueAtIdx` → `shadowForwardOutcomes_dueAt_idx` | `index("shadowForwardOutcomes_dueAt_idx").on(t.dueAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `shadowReadingIdx` | `index` | `shadowForwardOutcomes_shadowReadingId_idx` | `shadowReadingId` |
| `dueAtIdx` | `index` | `shadowForwardOutcomes_dueAt_idx` | `dueAt` |

## `shadowStressAnnotations`

**Source:** `drizzle/schema.ts:1918` — variable `shadowStressAnnotations`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `eventAt` → `eventAt` | `timestamp("eventAt").notNull()` | Yes | No | No | — |
| `eventType` → `eventType` | `varchar("eventType", { length: 50 }).notNull()` | Yes | No | No | — |
| `title` → `title` | `varchar("title", { length: 200 }).notNull()` | Yes | No | No | — |
| `description` → `description` | `text("description")` | No | No | No | — |
| `severity` → `severity` | `mysqlEnum("severity", ["low", "moderate", "high", "critical"]).notNull()` | Yes | No | No | — |
| `v1AtEvent` → `v1AtEvent` | `int("v1AtEvent")` | No | No | No | — |
| `v3hAtEvent` → `v3hAtEvent` | `int("v3hAtEvent")` | No | No | No | — |
| `v1RegimeAtEvent` → `v1RegimeAtEvent` | `varchar("v1RegimeAtEvent", { length: 50 })` | No | No | No | — |
| `v3hRegimeAtEvent` → `v3hRegimeAtEvent` | `varchar("v3hRegimeAtEvent", { length: 50 })` | No | No | No | — |
| `createdBy` → `createdBy` | `int("createdBy").notNull()` | Yes | No | No | — |
| `createdAt` → `createdAt` | `timestamp("createdAt").defaultNow().notNull()` | Yes | No | No | — |
| `eventAtIdx` → `shadowStressAnnotations_eventAt_idx` | `index("shadowStressAnnotations_eventAt_idx").on(t.eventAt)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `eventAtIdx` | `index` | `shadowStressAnnotations_eventAt_idx` | `eventAt` |

## `shadowDailySummaries`

**Source:** `drizzle/schema.ts:1937` — variable `shadowDailySummaries`.

| Field (source) | Column expression | Required | PK | Unique | Foreign key |
|---|---|---:|---:|---:|---|
| `id` → `id` | `int("id").autoincrement().primaryKey()` | No | Yes | No | — |
| `summaryDate` → `summaryDate` | `varchar("summaryDate", { length: 10 }).notNull().unique()` | Yes | No | Yes | — |
| `v1Pressure` → `v1Pressure` | `int("v1Pressure").notNull()` | Yes | No | No | — |
| `v3hPressure` → `v3hPressure` | `int("v3hPressure").notNull()` | Yes | No | No | — |
| `scoreDiff` → `scoreDiff` | `int("scoreDiff").notNull()` | Yes | No | No | — |
| `v1Regime` → `v1Regime` | `varchar("v1Regime", { length: 50 })` | No | No | No | — |
| `v3hRegime` → `v3hRegime` | `varchar("v3hRegime", { length: 50 })` | No | No | No | — |
| `regimeAgreement` → `regimeAgreement` | `boolean("regimeAgreement")` | No | No | No | — |
| `stlfsiRaw` → `stlfsiRaw` | `decimal("stlfsiRaw", { precision: 8, scale: 4 })` | No | No | No | — |
| `stlfsiZ` → `stlfsiZ` | `decimal("stlfsiZ", { precision: 8, scale: 4 })` | No | No | No | — |
| `stlfsiContribution` → `stlfsiContribution` | `int("stlfsiContribution")` | No | No | No | — |
| `largestComponentChange` → `largestComponentChange` | `varchar("largestComponentChange", { length: 200 })` | No | No | No | — |
| `fallbackUsed` → `fallbackUsed` | `boolean("fallbackUsed").default(false)` | No | No | No | — |
| `anomalousFlag` → `anomalousFlag` | `boolean("anomalousFlag").default(false)` | No | No | No | — |
| `reviewRequired` → `reviewRequired` | `boolean("reviewRequired").default(false)` | No | No | No | — |
| `readingCount` → `readingCount` | `int("readingCount").notNull().default(0)` | Yes | No | No | — |
| `generatedAt` → `generatedAt` | `timestamp("generatedAt").defaultNow().notNull()` | Yes | No | No | — |
| `summaryDateIdx` → `shadowDailySummaries_summaryDate_idx` | `index("shadowDailySummaries_summaryDate_idx").on(t.summaryDate)` | No | No | No | — |

**Indexes / constraints declared in the table callback**

| Key | Type | Database name | Fields |
|---|---|---|---|
| `summaryDateIdx` | `index` | `shadowDailySummaries_summaryDate_idx` | `summaryDate` |

## Migration Chain

The archive includes the migration chain under `drizzle/`. Apply migrations in ascending numeric filename order. Verify the database migration ledger after application. Do not assume this document substitutes for the migration SQL.

