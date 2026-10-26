import { eq, and, desc, count, sql, like, or, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertPosition, users, positions, cryptoWatchlist, InsertCryptoWatchlistItem, foundingAccessRequests, InsertFoundingAccessRequest, blogPosts, InsertBlogPost, xPostQueue, pressureHistory, mobileWatchlist, pressureRuns, InsertPressureRun, featureFlags, simPortfolioAccounts, simPortfolioPositions, simPortfolioTrades, simPortfolioJournal, InsertSimPortfolioAccount, InsertSimPortfolioPosition, InsertSimPortfolioTrade, InsertSimPortfolioJournalEntry, sharedReports, InsertSharedReport, mobileUsage, dayTradeWatchlist, InsertDayTradeWatchlistItem, tradeJournal, InsertTradeJournalEntry, chatbotSessions, chatbotMessages, chatbotLeads, InsertChatbotSession, InsertChatbotMessage, InsertChatbotLead, ChatbotSession, dayTradeSnapshot, pipelineHealthLog, onboardingEmailSequence } from "../drizzle/schema";
import { ENV } from './_core/env';
import { log } from './logger';

let _db: ReturnType<typeof drizzle> | null = null;

/** Drops the cached connection so an isolated test can use its own database. */
export function closeDbForTests(): void {
  _db = null;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      log.warn("[Database] Failed to connect", { err: error as Error });
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    log.error("[Database] Failed to upsert user", { err: error as Error });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Portfolio position helpers ────────────────────────────────────

export async function getPositionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(positions).where(eq(positions.userId, userId)).limit(500);
}

export async function addPosition(data: Omit<InsertPosition, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(positions).values(data);
  return result;
}

export async function updatePosition(
  id: number,
  userId: number,
  data: Partial<Pick<InsertPosition, 'ticker' | 'name' | 'shares' | 'costBasis' | 'assetType' | 'notes' | 'openedAt'>>
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(positions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(positions.id, id), eq(positions.userId, userId)));
}

export async function deletePosition(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(positions)
    .where(and(eq(positions.id, id), eq(positions.userId, userId)));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.createdAt).limit(1000);
}

export async function getPositionById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(positions)
    .where(and(eq(positions.id, id), eq(positions.userId, userId)))
    .limit(1);
  return result[0] ?? undefined;
}

// ── Crypto Watchlist helpers ─────────────────────────────────────────

export async function getCryptoWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWatchlist)
    .where(eq(cryptoWatchlist.userId, userId))
    .orderBy(cryptoWatchlist.addedAt).limit(200);
}

export async function addCryptoWatchlistItem(
  data: Omit<InsertCryptoWatchlistItem, 'id' | 'addedAt'>
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Prevent duplicates silently
  const existing = await db.select({ id: cryptoWatchlist.id })
    .from(cryptoWatchlist)
    .where(and(
      eq(cryptoWatchlist.userId, data.userId),
      eq(cryptoWatchlist.symbol, data.symbol.toUpperCase())
    ))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const result = await db.insert(cryptoWatchlist).values({
    ...data,
    symbol: data.symbol.toUpperCase(),
  });
  // mysql2 returns OkPacket array; first element has insertId
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? null;
}

export async function removeCryptoWatchlistItem(userId: number, symbol: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(cryptoWatchlist)
    .where(and(
      eq(cryptoWatchlist.userId, userId),
      eq(cryptoWatchlist.symbol, symbol.toUpperCase())
    ));
}

export async function isCryptoWatchlisted(userId: number, symbol: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: cryptoWatchlist.id })
    .from(cryptoWatchlist)
    .where(and(
      eq(cryptoWatchlist.userId, userId),
      eq(cryptoWatchlist.symbol, symbol.toUpperCase())
    ))
    .limit(1);
  return result.length > 0;
}

// ── User lookup helpers ───────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Access Tier helpers ─────────────────────────────────────────────

/**
 * Lifetime buyers stay entitled even if a subscription webhook wrote accessTier
 * to free. Founding is the paid tier those gates already accept.
 */
export function tierForEntitlement(
  accessTier: string | null | undefined,
  lifetimeAccess: boolean | null | undefined,
): 'free' | 'core' | 'premium' | 'founding' {
  if (lifetimeAccess) return 'founding';
  if (accessTier === 'core' || accessTier === 'premium' || accessTier === 'founding') return accessTier;
  return 'free';
}

export async function getUserTier(userId: number): Promise<'free' | 'core' | 'premium' | 'founding'> {
  const db = await getDb();
  if (!db) return 'free';
  const result = await db.select({ accessTier: users.accessTier, lifetimeAccess: users.lifetimeAccess })
    .from(users).where(eq(users.id, userId)).limit(1);
  return tierForEntitlement(result[0]?.accessTier, result[0]?.lifetimeAccess);
}

export async function setUserTier(
  userId: number,
  tier: 'free' | 'core' | 'premium' | 'founding'
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users)
    .set({ accessTier: tier, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// Alias used by OAuth auto-grant flow
export const updateUserTier = setUserTier;

/**
 * Delete a user and all their associated data.
 * Removes positions, watchlists, and the user row itself.
 * Does NOT delete blog posts (they remain attributed to the user ID).
 */
export async function deleteUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Delete user-owned data first (no FK cascade in schema)
  await db.delete(positions).where(eq(positions.userId, userId));
  await db.delete(cryptoWatchlist).where(eq(cryptoWatchlist.userId, userId));
  await db.delete(mobileWatchlist).where(eq(mobileWatchlist.userId, userId));
  // Delete the user row
  await db.delete(users).where(eq(users.id, userId));
}

export async function hasApprovedFoundingRequest(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: foundingAccessRequests.id })
    .from(foundingAccessRequests)
    .where(
      and(
        eq(foundingAccessRequests.email, email.toLowerCase().trim()),
        eq(foundingAccessRequests.status, 'approved')
      )
    )
    .limit(1);
  return result.length > 0;
}

// ── Founding Access Request helpers ───────────────────────────────

export async function createFoundingRequest(
  data: Omit<InsertFoundingAccessRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<{ id: number; duplicate: false } | { duplicate: true }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Prevent duplicate submissions for the same email address
  const normalizedEmail = data.email.toLowerCase().trim();
  const existing = await db
    .select({ id: foundingAccessRequests.id })
    .from(foundingAccessRequests)
    .where(eq(foundingAccessRequests.email, normalizedEmail))
    .limit(1);
  if (existing.length > 0) return { duplicate: true };
  const result = await db.insert(foundingAccessRequests).values({
    ...data,
    email: normalizedEmail,
    status: 'pending',
  });
  const okPacket = result[0] as unknown as { insertId: number };
  return { id: okPacket?.insertId ?? 0, duplicate: false };
}

export async function getFoundingRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(foundingAccessRequests)
    .orderBy(desc(foundingAccessRequests.createdAt)).limit(500);
}

export async function updateFoundingRequestStatus(
  id: number,
  status: 'pending' | 'approved' | 'rejected'
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(foundingAccessRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(foundingAccessRequests.id, id));
}

export async function getPlatformStats() {
  const db = await getDb();
  if (!db) return null;
  const [userRows, requestRows] = await Promise.all([
    db.select({
      total: count(),
      freeCount: sql<number>`SUM(CASE WHEN ${users.accessTier} = 'free' THEN 1 ELSE 0 END)`,
      coreCount: sql<number>`SUM(CASE WHEN ${users.accessTier} = 'core' THEN 1 ELSE 0 END)`,
      premiumCount: sql<number>`SUM(CASE WHEN ${users.accessTier} = 'premium' THEN 1 ELSE 0 END)`,
      foundingCount: sql<number>`SUM(CASE WHEN ${users.accessTier} = 'founding' THEN 1 ELSE 0 END)`,

    }).from(users),
    db.select({
      total: count(),
      pendingCount: sql<number>`SUM(CASE WHEN ${foundingAccessRequests.status} = 'pending' THEN 1 ELSE 0 END)`,
      approvedCount: sql<number>`SUM(CASE WHEN ${foundingAccessRequests.status} = 'approved' THEN 1 ELSE 0 END)`,
      rejectedCount: sql<number>`SUM(CASE WHEN ${foundingAccessRequests.status} = 'rejected' THEN 1 ELSE 0 END)`,
    }).from(foundingAccessRequests),
  ]);
  return {
    users: {
      total: Number(userRows[0]?.total ?? 0),
      free: Number(userRows[0]?.freeCount ?? 0),
      core: Number(userRows[0]?.coreCount ?? 0),
      premium: Number(userRows[0]?.premiumCount ?? 0),
      founding: Number(userRows[0]?.foundingCount ?? 0),
    },
    waitlist: {
      total: Number(requestRows[0]?.total ?? 0),
      pending: Number(requestRows[0]?.pendingCount ?? 0),
      approved: Number(requestRows[0]?.approvedCount ?? 0),
      rejected: Number(requestRows[0]?.rejectedCount ?? 0),
    },
  };
}

export async function getActivityFeed(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const [recentUsers, recentRequests] = await Promise.all([
    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      accessTier: users.accessTier,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(limit),
    db.select({
      id: foundingAccessRequests.id,
      name: foundingAccessRequests.name,
      email: foundingAccessRequests.email,
      status: foundingAccessRequests.status,
      createdAt: foundingAccessRequests.createdAt,
    }).from(foundingAccessRequests).orderBy(desc(foundingAccessRequests.createdAt)).limit(limit),
  ]);
  const feed = [
    ...recentUsers.map(u => ({ type: 'signup' as const, id: u.id, name: u.name, email: u.email, tier: u.accessTier, status: null as string | null, createdAt: u.createdAt })),
    ...recentRequests.map(r => ({ type: 'waitlist' as const, id: r.id, name: r.name, email: r.email, tier: null as string | null, status: r.status, createdAt: r.createdAt })),
  ];
  feed.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  return feed.slice(0, limit);
}

export async function getAllUsersWithTier() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accessTier: users.accessTier,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.createdAt).limit(1000);
}

// ── Statistics helpers ────────────────────────────────────────

export async function getSignupTimeSeries(days = 30) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    day: sql<string>`DATE(FROM_UNIXTIME(${users.createdAt} / 1000))`,
    count: count(),
  })
    .from(users)
    .where(sql`${users.createdAt} >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ${days} DAY)) * 1000`)
    .groupBy(sql`DATE(FROM_UNIXTIME(${users.createdAt} / 1000))`)
    .orderBy(sql`DATE(FROM_UNIXTIME(${users.createdAt} / 1000))`);
  return rows.map(r => ({ day: String(r.day), count: Number(r.count) }));
}

export async function getWaitlistTimeSeries(days = 30) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    day: sql<string>`DATE(FROM_UNIXTIME(${foundingAccessRequests.createdAt} / 1000))`,
    count: count(),
  })
    .from(foundingAccessRequests)
    .where(sql`${foundingAccessRequests.createdAt} >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ${days} DAY)) * 1000`)
    .groupBy(sql`DATE(FROM_UNIXTIME(${foundingAccessRequests.createdAt} / 1000))`)
    .orderBy(sql`DATE(FROM_UNIXTIME(${foundingAccessRequests.createdAt} / 1000))`);
  return rows.map(r => ({ day: String(r.day), count: Number(r.count) }));
}

export async function getConversionStats() {
  const db = await getDb();
  if (!db) return null;
  const [userRows, requestRows] = await Promise.all([
    db.select({ total: count(), tier: users.accessTier }).from(users).groupBy(users.accessTier),
    db.select({ total: count(), status: foundingAccessRequests.status }).from(foundingAccessRequests).groupBy(foundingAccessRequests.status),
  ]);
  const totalUsers = userRows.reduce((s, r) => s + Number(r.total), 0);
  const premiumUsers = userRows.filter(r => r.tier === 'premium' || r.tier === 'founding').reduce((s, r) => s + Number(r.total), 0);
  const totalRequests = requestRows.reduce((s, r) => s + Number(r.total), 0);
  const approvedRequests = requestRows.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.total), 0);
  const pendingRequests = requestRows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.total), 0);
  return {
    totalUsers,
    premiumUsers,
    freeUsers: totalUsers - premiumUsers,
    totalWaitlistRequests: totalRequests,
    approvedRequests,
    pendingRequests,
    conversionRate: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0,
    waitlistApprovalRate: totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0,
  };
}

// ── Stripe helpers ─────────────────────────────────────────────

export async function updateUserStripe(
  userId: number,
  data: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    accessTier?: 'free' | 'core' | 'premium' | 'founding';
    lifetimeAccess?: boolean;
    lifetimePurchasedAt?: Date | null;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Count users with lifetime access (for promotion window display). */
export async function getLifetimeMemberCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ cnt: count() })
    .from(users)
    .where(eq(users.lifetimeAccess, true));
  return Number(row?.cnt ?? 0);
}

export async function updateDashboardMode(
  userId: number,
  mode: 'pulse' | 'signals' | 'intelligence'
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users)
    .set({ dashboardMode: mode, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByStripeCustomerId(customerId: string): Promise<{ id: number; name: string | null; email: string | null; accessTier: string | null; lifetimeAccess: boolean } | null> {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, accessTier: users.accessTier, lifetimeAccess: users.lifetimeAccess })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return user ?? null;
}

// ── Blog Post helpers ──────────────────────────────────────────

export async function getBlogPosts(opts: { publishedOnly?: boolean; limit?: number; offset?: number; category?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const { publishedOnly = true, limit = 20, offset = 0, category } = opts;
  let query = db.select({
    id: blogPosts.id,
    slug: blogPosts.slug,
    title: blogPosts.title,
    subtitle: blogPosts.subtitle,
    author: blogPosts.author,
    category: blogPosts.category,
    tags: blogPosts.tags,
    published: blogPosts.published,
    publishedAt: blogPosts.publishedAt,
    contentClass: blogPosts.contentClass,
    metaTitle: blogPosts.metaTitle,
    metaDescription: blogPosts.metaDescription,
    readTimeMinutes: blogPosts.readTimeMinutes,
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
  }).from(blogPosts).$dynamic();

  const conditions = [];
  if (publishedOnly) conditions.push(eq(blogPosts.published, 1));
  if (category) conditions.push(eq(blogPosts.category, category));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;

  return query.orderBy(desc(blogPosts.publishedAt)).limit(limit).offset(offset);
}

/** Returns only published evergreen posts, ordered by publishedAt desc */
export async function getEvergreenPosts(limit = 6) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: blogPosts.id,
    slug: blogPosts.slug,
    title: blogPosts.title,
    subtitle: blogPosts.subtitle,
    author: blogPosts.author,
    category: blogPosts.category,
    tags: blogPosts.tags,
    published: blogPosts.published,
    publishedAt: blogPosts.publishedAt,
    contentClass: blogPosts.contentClass,
    metaTitle: blogPosts.metaTitle,
    metaDescription: blogPosts.metaDescription,
    readTimeMinutes: blogPosts.readTimeMinutes,
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
  })
  .from(blogPosts)
  .where(and(eq(blogPosts.published, 1), eq(blogPosts.contentClass, 'evergreen')))
  .orderBy(desc(blogPosts.publishedAt))
  .limit(limit);
}

/** Returns published intel_record posts with optional filters for the Intelligence Archive */
export async function getIntelRecords(opts: {
  limit?: number;
  offset?: number;
  regime?: string;
  dateFrom?: string;  // YYYY-MM-DD
  dateTo?: string;    // YYYY-MM-DD
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const { limit = 30, offset = 0, regime, dateFrom, dateTo } = opts;
  let query = db.select({
    id: blogPosts.id,
    slug: blogPosts.slug,
    title: blogPosts.title,
    subtitle: blogPosts.subtitle,
    author: blogPosts.author,
    category: blogPosts.category,
    tags: blogPosts.tags,
    published: blogPosts.published,
    publishedAt: blogPosts.publishedAt,
    contentClass: blogPosts.contentClass,
    metaTitle: blogPosts.metaTitle,
    metaDescription: blogPosts.metaDescription,
    readTimeMinutes: blogPosts.readTimeMinutes,
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
  }).from(blogPosts).$dynamic();

  const conditions = [
    eq(blogPosts.published, 1),
    eq(blogPosts.contentClass, 'intel_record'),
  ];
  if (regime) conditions.push(sql`LOWER(${blogPosts.category}) LIKE ${`%${regime.toLowerCase()}%`}`);
  if (dateFrom) conditions.push(sql`DATE(${blogPosts.publishedAt}) >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`DATE(${blogPosts.publishedAt}) <= ${dateTo}`);
  query = query.where(and(...conditions)) as typeof query;

  return query.orderBy(desc(blogPosts.publishedAt)).limit(limit).offset(offset);
}

export async function getBlogPostBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return result[0] ?? undefined;
}

export async function getBlogPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function createBlogPost(data: Omit<InsertBlogPost, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(blogPosts).values(data);
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? null;
}

export async function updateBlogPost(
  id: number,
  data: Partial<Omit<InsertBlogPost, 'id' | 'createdAt' | 'updatedAt'>>
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(blogPosts).set({ ...data, updatedAt: new Date() }).where(eq(blogPosts.id, id));
}

export async function deleteBlogPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

export async function getBlogCategories(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ category: blogPosts.category })
    .from(blogPosts)
    .where(eq(blogPosts.published, 1));
  return rows.map(r => r.category).filter(Boolean) as string[];
}

export async function incrementBlogPostViewCount(slug: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(blogPosts)
    .set({ viewCount: sql`viewCount + 1` })
    .where(eq(blogPosts.slug, slug));
}

// ── X Post Queue helpers ─────────────────────────────────────

export async function getXPostQueue(filters: {
  limit?: number;
  postType?: "premarket" | "midday" | "closing" | "breaking";
  status?: "pending" | "posted" | "failed" | "skipped";
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.postType) conditions.push(eq(xPostQueue.postType, filters.postType));
  if (filters.status) conditions.push(eq(xPostQueue.status, filters.status));

  return db
    .select()
    .from(xPostQueue)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(xPostQueue.createdAt))
    .limit(filters.limit ?? 50);
}

export async function getXPostQueueStats() {
  const db = await getDb();
  if (!db) return { total: 0, posted: 0, failed: 0, skipped: 0, lastPostedAt: null };

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      posted: sql<number>`sum(case when ${xPostQueue.status} = 'posted' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${xPostQueue.status} = 'failed' then 1 else 0 end)`,
      skipped: sql<number>`sum(case when ${xPostQueue.status} = 'skipped' then 1 else 0 end)`,
      lastPostedAt: sql<Date | null>`max(${xPostQueue.postedAt})`,
    })
    .from(xPostQueue);

  return {
    total: Number(stats?.total ?? 0),
    posted: Number(stats?.posted ?? 0),
    failed: Number(stats?.failed ?? 0),
    skipped: Number(stats?.skipped ?? 0),
    lastPostedAt: stats?.lastPostedAt ?? null,
  };
}

// ── Pressure History helpers ─────────────────────────────────

export async function getPressureHistory(opts: {
  startMonth?: string;
  endMonth?: string;
  limit?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const { startMonth, endMonth, limit } = opts;
  const conditions = [];
  if (startMonth) conditions.push(sql`${pressureHistory.month} >= ${startMonth}`);
  if (endMonth) conditions.push(sql`${pressureHistory.month} <= ${endMonth}`);
  let query = db.select().from(pressureHistory).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  query = query.orderBy(pressureHistory.month) as typeof query;
  if (limit) query = query.limit(limit) as typeof query;
  return query;
}

export function pressureHistoryStatsFromRow(stats: {
  totalMonths?: unknown;
  avgPressure?: unknown;
  maxPressure?: unknown;
  minPressure?: unknown;
  criticalMonths?: unknown;
  highRiskMonths?: unknown;
  elevatedMonths?: unknown;
  moderateMonths?: unknown;
  lowMonths?: unknown;
} | undefined) {
  const totalMonths = Number(stats?.totalMonths ?? 0);
  const metric = (value: unknown, round = false): number | null => {
    if (!Number.isFinite(totalMonths) || totalMonths <= 0) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return round ? Math.round(n) : n;
  };
  const count = (value: unknown) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    totalMonths: Number.isFinite(totalMonths) ? totalMonths : 0,
    avgPressure: metric(stats?.avgPressure, true),
    maxPressure: metric(stats?.maxPressure),
    minPressure: metric(stats?.minPressure),
    criticalMonths: count(stats?.criticalMonths),
    highRiskMonths: count(stats?.highRiskMonths),
    elevatedMonths: count(stats?.elevatedMonths),
    moderateMonths: count(stats?.moderateMonths),
    lowMonths: count(stats?.lowMonths),
  };
}

export async function getPressureHistoryStats() {
  const db = await getDb();
  if (!db) return null;
  const [stats] = await db.select({
    totalMonths: sql<number>`count(*)`,
    avgPressure: sql<number>`avg(${pressureHistory.overallPressure})`,
    maxPressure: sql<number>`max(${pressureHistory.overallPressure})`,
    minPressure: sql<number>`min(${pressureHistory.overallPressure})`,
    criticalMonths: sql<number>`sum(case when ${pressureHistory.regime} = 'CRITICAL' then 1 else 0 end)`,
    highRiskMonths: sql<number>`sum(case when ${pressureHistory.regime} = 'HIGH RISK' then 1 else 0 end)`,
    elevatedMonths: sql<number>`sum(case when ${pressureHistory.regime} = 'ELEVATED RISK' then 1 else 0 end)`,
    moderateMonths: sql<number>`sum(case when ${pressureHistory.regime} = 'MODERATE RISK' then 1 else 0 end)`,
    lowMonths: sql<number>`sum(case when ${pressureHistory.regime} = 'LOW RISK' then 1 else 0 end)`,
  }).from(pressureHistory);
  return pressureHistoryStatsFromRow(stats);
}

// ── Mobile Watchlist helpers ──────────────────────────────────

export async function getMobileWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mobileWatchlist)
    .where(eq(mobileWatchlist.userId, userId))
    .orderBy(mobileWatchlist.addedAt);
}

export async function addMobileWatchlistItem(
  userId: number,
  symbol: string,
  name: string,
  type: 'stock' | 'crypto'
): Promise<{ id: number; duplicate: false } | { duplicate: true }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select({ id: mobileWatchlist.id })
    .from(mobileWatchlist)
    .where(and(
      eq(mobileWatchlist.userId, userId),
      eq(mobileWatchlist.symbol, symbol.toUpperCase()),
      eq(mobileWatchlist.type, type)
    ))
    .limit(1);
  if (existing.length > 0) return { duplicate: true };
  const result = await db.insert(mobileWatchlist).values({
    userId,
    symbol: symbol.toUpperCase(),
    name,
    type,
  });
  const okPacket = result[0] as unknown as { insertId: number };
  return { id: okPacket?.insertId ?? 0, duplicate: false };
}

export async function removeMobileWatchlistItem(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(mobileWatchlist)
    .where(and(
      eq(mobileWatchlist.id, id),
      eq(mobileWatchlist.userId, userId)
    ));
}

// ── Pressure Engine Audit Trail ──────────────────────────────────────────────

/**
 * Insert a new pressure run audit record.
 * Called by the pressure router after every successful engine execution.
 * Fire-and-forget — never throws, logs on failure.
 */
export async function insertPressureRun(run: InsertPressureRun): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(pressureRuns).values(run);
  } catch (err) {
    log.warn("[Database] Failed to insert pressure run audit record", { err });
  }
}

/**
 * Retrieve the N most recent pressure run records for admin inspection.
 */
export async function getRecentPressureRuns(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pressureRuns).orderBy(desc(pressureRuns.computedAt)).limit(limit);
}

/**
 * Count total pressure runs in the audit table.
 */
export async function countPressureRuns(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count() }).from(pressureRuns);
  return result[0]?.total ?? 0;
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

/**
 * Get all feature flags. Returns an empty array if DB is unavailable.
 */
export async function getAllFeatureFlags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(featureFlags).orderBy(featureFlags.key);
}

/**
 * Get a single feature flag by key.
 * Returns true (enabled) as the safe default if DB is unavailable or key not found.
 */
export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return true; // safe default: features enabled when DB is down
    const rows = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    if (rows.length === 0) return true; // unknown flags default to enabled
    return rows[0]!.enabled === 1;
  } catch {
    return true; // safe default on error
  }
}

/**
 * Set a feature flag enabled/disabled. Admin-only — enforce at the router level.
 */
export async function setFeatureFlag(key: string, enabled: boolean, updatedBy?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(featureFlags)
    .set({ enabled: enabled ? 1 : 0, ...(updatedBy ? { updatedBy } : {}) })
    .where(eq(featureFlags.key, key));
}

// ── Sim Portfolio DB Helpers ($10K → $1M) ────────────────────────────────────

export async function getSimAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simPortfolioAccounts).orderBy(simPortfolioAccounts.accountType);
}

export async function upsertSimAccount(data: Omit<InsertSimPortfolioAccount, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(simPortfolioAccounts).values(data).onDuplicateKeyUpdate({
    set: { cashBalance: data.cashBalance, updatedAt: new Date() },
  });
}

export async function getSimOpenPositions(accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(simPortfolioPositions).where(
    accountId !== undefined
      ? and(eq(simPortfolioPositions.status, 'open'), eq(simPortfolioPositions.accountId, accountId))
      : eq(simPortfolioPositions.status, 'open')
  ).orderBy(desc(simPortfolioPositions.openedAt));
  return q;
}

export async function getAllSimPositions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simPortfolioPositions).orderBy(desc(simPortfolioPositions.openedAt));
}

export async function insertSimPosition(data: Omit<InsertSimPortfolioPosition, 'id' | 'openedAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(simPortfolioPositions).values(data);
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? 0;
}

export async function updateSimPosition(id: number, data: Partial<InsertSimPortfolioPosition>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(simPortfolioPositions).set({ ...data, updatedAt: new Date() }).where(eq(simPortfolioPositions.id, id));
}

export async function insertSimTrade(data: Omit<InsertSimPortfolioTrade, 'id' | 'executedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(simPortfolioTrades).values(data);
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? 0;
}

export async function getSimTrades(accountId?: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(simPortfolioTrades)
    .where(accountId !== undefined ? eq(simPortfolioTrades.accountId, accountId) : undefined)
    .orderBy(desc(simPortfolioTrades.executedAt))
    .limit(limit);
  return q;
}

export async function getSimJournalEntries(limit = 60) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simPortfolioJournal)
    .orderBy(desc(simPortfolioJournal.date))
    .limit(limit);
}

export async function getSimJournalByDate(date: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(simPortfolioJournal)
    .where(eq(simPortfolioJournal.date, date)).limit(1);
  return rows[0] ?? undefined;
}

export async function upsertSimJournalEntry(data: Omit<InsertSimPortfolioJournalEntry, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(simPortfolioJournal).values(data).onDuplicateKeyUpdate({
    set: {
      pressureScore: data.pressureScore,
      regime: data.regime,
      totalValue: data.totalValue,
      stocksValue: data.stocksValue,
      cryptoValue: data.cryptoValue,
      dailyPnl: data.dailyPnl,
      dailyPnlPct: data.dailyPnlPct,
      journalEntry: data.journalEntry,
      holdingsJson: data.holdingsJson,
      tradesJson: data.tradesJson,
      tradesMade: data.tradesMade,
    },
  });
}

// ── Shared Reports helpers ────────────────────────────────────────────

export async function createSharedReport(
  data: Omit<InsertSharedReport, 'id' | 'createdAt' | 'viewCount' | 'revoked'>
): Promise<{ id: number; publicShareId: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(sharedReports).values({
    ...data,
    viewCount: 0,
    revoked: 0,
  });
  const okPacket = result[0] as unknown as { insertId: number };
  return { id: okPacket?.insertId ?? 0, publicShareId: data.publicShareId };
}

export async function getSharedReportByPublicId(publicShareId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(sharedReports)
    .where(eq(sharedReports.publicShareId, publicShareId))
    .limit(1);
  return rows[0] ?? undefined;
}

export async function listSharedReportsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sharedReports)
    .where(eq(sharedReports.ownerUserId, userId))
    .orderBy(desc(sharedReports.createdAt));
}

export async function revokeSharedReport(id: number, ownerUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(sharedReports)
    .set({ revoked: 1 })
    .where(and(eq(sharedReports.id, id), eq(sharedReports.ownerUserId, ownerUserId)));
}

export async function incrementSharedReportViewCount(publicShareId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(sharedReports)
    .set({ viewCount: sql`${sharedReports.viewCount} + 1` })
    .where(eq(sharedReports.publicShareId, publicShareId));
}

// ── Mobile Usage Helpers ─────────────────────────────────────────────────────

/** Get today's usage row for a user (or undefined if none exists yet). */
export async function getMobileUsageToday(userId: number): Promise<typeof mobileUsage.$inferSelect | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const month = today.slice(0, 7); // YYYY-MM
  const rows = await db.select().from(mobileUsage)
    .where(and(eq(mobileUsage.userId, userId), eq(mobileUsage.usageDate, today)))
    .limit(1);
  if (rows[0]) return rows[0];
  // Upsert a fresh row for today
  await db.insert(mobileUsage).values({
    userId,
    usageDate: today,
    situationRoomMonth: month,
    stockSignalsViewed: 0,
    cryptoSignalsViewed: 0,
    signalOutlooksRun: 0,
    situationRoomCount: 0,
  }).onDuplicateKeyUpdate({ set: { updatedAt: sql`NOW()` } });
  const fresh = await db.select().from(mobileUsage)
    .where(and(eq(mobileUsage.userId, userId), eq(mobileUsage.usageDate, today)))
    .limit(1);
  return fresh[0];
}

/** Increment a daily counter for a user. Returns the new count. */
export async function incrementMobileUsage(
  userId: number,
  field: 'stockSignalsViewed' | 'cryptoSignalsViewed' | 'signalOutlooksRun'
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  await db.insert(mobileUsage).values({
    userId,
    usageDate: today,
    situationRoomMonth: month,
    stockSignalsViewed: field === 'stockSignalsViewed' ? 1 : 0,
    cryptoSignalsViewed: field === 'cryptoSignalsViewed' ? 1 : 0,
    signalOutlooksRun: field === 'signalOutlooksRun' ? 1 : 0,
    situationRoomCount: 0,
  }).onDuplicateKeyUpdate({
    set: { [field]: sql`${mobileUsage[field]} + 1`, updatedAt: sql`NOW()` }
  });
  const row = await getMobileUsageToday(userId);
  return row?.[field] ?? 0;
}

/** Increment the monthly Situation Room counter. Returns the new count. */
export async function incrementSituationRoomUsage(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  // Upsert today's row first
  await db.insert(mobileUsage).values({
    userId,
    usageDate: today,
    situationRoomMonth: month,
    stockSignalsViewed: 0,
    cryptoSignalsViewed: 0,
    signalOutlooksRun: 0,
    situationRoomCount: 1,
  }).onDuplicateKeyUpdate({
    set: {
      situationRoomCount: sql`${mobileUsage.situationRoomCount} + 1`,
      updatedAt: sql`NOW()`
    }
  });
  const row = await getMobileUsageToday(userId);
  return row?.situationRoomCount ?? 0;
}

/** Get total Situation Room simulations run this month across all days. */
export async function getSituationRoomMonthlyCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const month = new Date().toISOString().slice(0, 7);
  const rows = await db.select({ total: sql<number>`SUM(${mobileUsage.situationRoomCount})` })
    .from(mobileUsage)
    .where(and(eq(mobileUsage.userId, userId), eq(mobileUsage.situationRoomMonth, month)));
  return Number(rows[0]?.total ?? 0);
}

// ── Day Trade Watchlist helpers ───────────────────────────────

export async function getDayTradeWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dayTradeWatchlist)
    .where(eq(dayTradeWatchlist.userId, userId))
    .orderBy(desc(dayTradeWatchlist.addedAt));
}

export async function addDayTradeWatchlistItem(
  data: Omit<InsertDayTradeWatchlistItem, 'id' | 'addedAt'>
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select({ id: dayTradeWatchlist.id })
    .from(dayTradeWatchlist)
    .where(and(
      eq(dayTradeWatchlist.userId, data.userId),
      eq(dayTradeWatchlist.symbol, data.symbol.toUpperCase())
    ))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const result = await db.insert(dayTradeWatchlist).values({
    ...data,
    symbol: data.symbol.toUpperCase(),
  });
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? null;
}

export async function removeDayTradeWatchlistItem(userId: number, symbol: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(dayTradeWatchlist)
    .where(and(
      eq(dayTradeWatchlist.userId, userId),
      eq(dayTradeWatchlist.symbol, symbol.toUpperCase())
    ));
}

export async function isDayTradeWatchlisted(userId: number, symbol: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: dayTradeWatchlist.id })
    .from(dayTradeWatchlist)
    .where(and(
      eq(dayTradeWatchlist.userId, userId),
      eq(dayTradeWatchlist.symbol, symbol.toUpperCase())
    ))
    .limit(1);
  return result.length > 0;
}

// ── Trade Journal helpers ─────────────────────────────────────

export async function getTradeJournalEntries(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tradeJournal)
    .where(eq(tradeJournal.userId, userId))
    .orderBy(desc(tradeJournal.enteredAt))
    .limit(limit);
}

export async function insertTradeJournalEntry(
  data: Omit<InsertTradeJournalEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(tradeJournal).values(data);
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? 0;
}

export async function updateTradeJournalEntry(
  id: number,
  userId: number,
  updates: Partial<Omit<InsertTradeJournalEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(tradeJournal)
    .set(updates)
    .where(and(eq(tradeJournal.id, id), eq(tradeJournal.userId, userId)));
}

export async function deleteTradeJournalEntry(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(tradeJournal)
    .where(and(eq(tradeJournal.id, id), eq(tradeJournal.userId, userId)));
}

export async function getTradeJournalStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    total:      count(),
    wins:       sql<number>`SUM(CASE WHEN ${tradeJournal.outcome} = 'win' THEN 1 ELSE 0 END)`,
    losses:     sql<number>`SUM(CASE WHEN ${tradeJournal.outcome} = 'loss' THEN 1 ELSE 0 END)`,
    totalPnl:   sql<string>`SUM(CAST(${tradeJournal.realizedPnl} AS DECIMAL(18,4)))`,
    avgPnlPct:  sql<string>`AVG(CAST(${tradeJournal.pnlPercent} AS DECIMAL(8,4)))`,
  }).from(tradeJournal)
    .where(and(
      eq(tradeJournal.userId, userId),
      sql`${tradeJournal.outcome} != 'open'`
    ));
  const r = rows[0];
  if (!r) return null;
  const wins = Number(r.wins ?? 0);
  const losses = Number(r.losses ?? 0);
  const total = Number(r.total ?? 0);
  return {
    total,
    wins,
    losses,
    winRate: total > 0 ? Math.round((wins / (wins + losses || 1)) * 100) : 0,
    totalPnl: parseFloat(r.totalPnl ?? '0'),
    avgPnlPct: parseFloat(r.avgPnlPct ?? '0'),
  };
}

// ── Chatbot DB Helpers ────────────────────────────────────────────────────────

export async function createChatbotSession(data: InsertChatbotSession): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatbotSessions).values(data);
  return (result as any).insertId as number;
}

export async function updateChatbotSession(
  sessionId: number,
  data: Partial<InsertChatbotSession>,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(chatbotSessions).set(data).where(eq(chatbotSessions.id, sessionId));
}

export async function addChatbotMessage(data: InsertChatbotMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatbotMessages).values(data);
  // Increment message count on session
  await db
    .update(chatbotSessions)
    .set({ messageCount: sql`${chatbotSessions.messageCount} + 1` })
    .where(eq(chatbotSessions.id, data.sessionId));
  return (result as any).insertId as number;
}

export async function getChatbotMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatbotMessages)
    .where(eq(chatbotMessages.sessionId, sessionId))
    .orderBy(chatbotMessages.createdAt);
}

export async function createChatbotLead(data: InsertChatbotLead): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatbotLeads).values(data);
  // Update session email and conversion status
  await db
    .update(chatbotSessions)
    .set({ email: data.email, conversionStatus: "lead", planInterest: data.planInterest ?? undefined })
    .where(eq(chatbotSessions.id, data.sessionId));
  return (result as any).insertId as number;
}

export async function getChatbotSessions(opts: {
  filter?: "new_leads" | "pricing" | "security" | "high_intent" | "converted" | "needs_review" | "all";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { sessions: [], total: 0 };

  const { filter = "all", limit = 50, offset = 0 } = opts;

  let query = db.select().from(chatbotSessions);

  // Apply filter conditions
  if (filter === "new_leads") {
    query = query.where(and(eq(chatbotSessions.conversionStatus, "lead"), eq(chatbotSessions.reviewed, 0))) as typeof query;
  } else if (filter === "pricing") {
    query = query.where(eq(chatbotSessions.pricingIntent, 1)) as typeof query;
  } else if (filter === "security") {
    query = query.where(sql`${chatbotSessions.securitiesMentioned} IS NOT NULL AND ${chatbotSessions.securitiesMentioned} != ''`) as typeof query;
  } else if (filter === "high_intent") {
    query = query.where(sql`${chatbotSessions.leadScore} >= 50`) as typeof query;
  } else if (filter === "converted") {
    query = query.where(or(eq(chatbotSessions.conversionStatus, "signup"), eq(chatbotSessions.conversionStatus, "paid"))) as typeof query;
  } else if (filter === "needs_review") {
    query = query.where(and(eq(chatbotSessions.reviewed, 0), sql`${chatbotSessions.leadScore} >= 30`)) as typeof query;
  }

  const sessions = await query.orderBy(desc(chatbotSessions.createdAt)).limit(limit).offset(offset);
  const [countResult] = await db.select({ total: count() }).from(chatbotSessions);
  return { sessions, total: countResult?.total ?? 0 };
}

export async function getChatbotSessionWithMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.id, sessionId));
  if (!session) return null;
  const messages = await getChatbotMessages(sessionId);
  return { session, messages };
}

export async function markChatbotSessionReviewed(sessionId: number, reviewed: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(chatbotSessions).set({ reviewed: reviewed ? 1 : 0 }).where(eq(chatbotSessions.id, sessionId));
}

export async function addChatbotAdminNote(sessionId: number, note: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(chatbotSessions).set({ adminNote: note }).where(eq(chatbotSessions.id, sessionId));
}

export async function getChatbotLeads(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatbotLeads).orderBy(desc(chatbotLeads.createdAt)).limit(limit);
}

export async function getChatbotStats() {
  const db = await getDb();
  if (!db) return { total: 0, leads: 0, highIntent: 0, converted: 0, avgLeadScore: 0 };
  const [stats] = await db.select({
    total: count(),
    avgLeadScore: sql<number>`AVG(${chatbotSessions.leadScore})`,
  }).from(chatbotSessions);
  const [leads] = await db.select({ c: count() }).from(chatbotSessions).where(eq(chatbotSessions.conversionStatus, "lead"));
  const [highIntent] = await db.select({ c: count() }).from(chatbotSessions).where(sql`${chatbotSessions.leadScore} >= 50`);
  const [converted] = await db.select({ c: count() }).from(chatbotSessions).where(or(eq(chatbotSessions.conversionStatus, "signup"), eq(chatbotSessions.conversionStatus, "paid")));
  return {
    total: stats?.total ?? 0,
    leads: leads?.c ?? 0,
    highIntent: highIntent?.c ?? 0,
    converted: converted?.c ?? 0,
    avgLeadScore: Math.round(Number(stats?.avgLeadScore ?? 0)),
  };
}

// ── Day Trade Snapshot helpers ────────────────────────────────────────────────
// Persist the last successful scan result so the cascade can fall back to it.

export async function saveDayTradeSnapshot(cacheKey: string, payload: unknown): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const json = JSON.stringify(payload);
  await db.insert(dayTradeSnapshot)
    .values({ cacheKey, payload: json, capturedAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { payload: json, capturedAt: Date.now() } });
}

export async function loadDayTradeSnapshot(cacheKey: string): Promise<{ payload: unknown; capturedAt: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(dayTradeSnapshot)
    .where(eq(dayTradeSnapshot.cacheKey, cacheKey))
    .limit(1);
  if (!rows.length) return null;
  try {
    return { payload: JSON.parse(rows[0].payload), capturedAt: Number(rows[0].capturedAt) };
  } catch {
    return null;
  }
}

// ── Pipeline Health Log helpers ───────────────────────────────────────────────

export async function getPipelineHealthLogs(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pipelineHealthLog)
    .orderBy(desc(pipelineHealthLog.createdAt))
    .limit(limit);
}

export async function getPipelineHealthSummary() {
  const db = await getDb();
  if (!db) return [];
  // Per-provider: total failures, last failure, auto-recovered count, avg latency
  const rows = await db.select({
    provider: pipelineHealthLog.provider,
    total: count(),
    autoRecovered: sql<number>`SUM(CASE WHEN ${pipelineHealthLog.autoRecovered} = 1 THEN 1 ELSE 0 END)`,
    avgLatencyMs: sql<number>`AVG(${pipelineHealthLog.latencyMs})`,
    lastFailure: sql<Date>`MAX(${pipelineHealthLog.createdAt})`,
  })
    .from(pipelineHealthLog)
    .groupBy(pipelineHealthLog.provider)
    .orderBy(desc(sql`MAX(${pipelineHealthLog.createdAt})`));
  return rows;
}

// ── Ask Intelligence daily usage helpers ─────────────────────────────────────
/** Increment the daily Ask Intelligence question counter. Returns the new count. */
export async function incrementAskUsage(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  await db.insert(mobileUsage).values({
    userId,
    usageDate: today,
    situationRoomMonth: month,
    stockSignalsViewed: 0,
    cryptoSignalsViewed: 0,
    signalOutlooksRun: 0,
    situationRoomCount: 0,
    askQuestionsToday: 1,
  }).onDuplicateKeyUpdate({
    set: { askQuestionsToday: sql`${mobileUsage.askQuestionsToday} + 1`, updatedAt: sql`NOW()` }
  });
  const row = await getMobileUsageToday(userId);
  return row?.askQuestionsToday ?? 0;
}

/** Get today's Ask Intelligence question count for a user. Returns 0 if no row. */
export async function getAskUsageToday(userId: number): Promise<number> {
  const row = await getMobileUsageToday(userId);
  return row?.askQuestionsToday ?? 0;
}

// ── Onboarding Email Sequence helpers ─────────────────────────────────────────

/** Record that a drip email step was sent to a user. */
export async function recordOnboardingEmailSent(userId: number, step: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(onboardingEmailSequence).values({
    userId,
    step,
    sentAt: Date.now(),
  });
}

/** Check whether a specific drip step has already been sent to a user. */
export async function hasOnboardingEmailBeenSent(userId: number, step: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: onboardingEmailSequence.id })
    .from(onboardingEmailSequence)
    .where(and(
      eq(onboardingEmailSequence.userId, userId),
      eq(onboardingEmailSequence.step, step),
    ))
    .limit(1);
  return result.length > 0;
}

/**
 * Return all users who signed up more than `minAgeMs` milliseconds ago
 * and have NOT yet received drip step `step`.
 * Used by the heartbeat drip scheduler.
 */
export async function getUsersPendingDripStep(step: number, minAgeMs: number): Promise<Array<{ id: number; name: string | null; email: string | null; createdAt: Date; accessTier: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - minAgeMs);
  // Get all users created before the cutoff
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
    accessTier: users.accessTier,
  })
    .from(users)
    .where(and(
      sql`${users.createdAt} <= ${cutoff}`,
      sql`${users.email} IS NOT NULL`,
    ));
  if (allUsers.length === 0) return [];
  const acceptedRows = await db.select({ email: foundingAccessRequests.email })
    .from(foundingAccessRequests)
    .where(eq(foundingAccessRequests.status, "approved"));
  const acceptedEmails = new Set(
    acceptedRows.map(row => row.email.toLowerCase().trim()),
  );
  // Get user IDs that already received this step
  const sentRows = await db.select({ userId: onboardingEmailSequence.userId })
    .from(onboardingEmailSequence)
    .where(eq(onboardingEmailSequence.step, step));
  const sentSet = new Set(sentRows.map(r => r.userId));
  return allUsers.filter(user => (
    !sentSet.has(user.id)
    && Boolean(user.email)
    && acceptedEmails.has(user.email!.toLowerCase().trim())
  ));
}

// ── Stripe webhook idempotency ────────────────────────────────────────────────
import { randomBytes } from "node:crypto";
import { stripeWebhookEvents, entitlementAuditLog } from '../drizzle/schema';

/** True only for a MySQL unique-constraint violation, including a Drizzle-wrapped cause. */
function isDuplicateKeyError(error: unknown): boolean {
  const dbError = error as {
    code?: string;
    errno?: number;
    message?: string;
    cause?: { code?: string; errno?: number; message?: string };
  } | null | undefined;
  return (
    dbError?.code === 'ER_DUP_ENTRY' ||
    dbError?.errno === 1062 ||
    dbError?.cause?.code === 'ER_DUP_ENTRY' ||
    dbError?.cause?.errno === 1062 ||
    /Duplicate entry/i.test(`${dbError?.message ?? ''} ${dbError?.cause?.message ?? ''}`)
  );
}

/**
 * Claims are inserted as `pending:<eventType>` and rewritten to the bare event
 * type only after handling finishes. A failed release leaves the pending row in
 * place. A later delivery must reclaim that row instead of acknowledging it as
 * a finished duplicate, which would drop the event.
 *
 * The unfinished window stays above the Stripe client timeout so a delivery
 * that still owns the claim is not processed a second time. A failed release
 * leaves the pending row, and a later delivery reclaims it with a compare-and-swap.
 */
export const STRIPE_WEBHOOK_CLAIM_PREFIX = 'pending:';
export const STRIPE_WEBHOOK_PROCESSING_PREFIX = 'processing:';
/**
 * A second delivery may reclaim only after this age. Webhook reads are capped
 * at 8 calls of 8s with maxNetworkRetries 0 (64s), under this window.
 */
export const STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS = 90_000;
const STRIPE_ATTEMPT_ID_RE = /^[0-9a-f]{16}$/;

export class UnfinishedStripeWebhookClaimError extends Error {
  constructor(eventId: string) {
    super(`Stripe webhook claim ${eventId} is unfinished; retry shortly`);
    this.name = 'UnfinishedStripeWebhookClaimError';
  }
}

/** The attempt no longer owns the claim row. It must not write, seal, or release. */
export class StaleStripeWebhookClaimError extends Error {
  constructor(eventId: string) {
    super(`Stripe webhook claim ${eventId} is owned by a newer attempt`);
    this.name = 'StaleStripeWebhookClaimError';
  }
}

export type StripeWebhookAttempt = { attemptId: string };

export function newStripeAttemptId(): string {
  return randomBytes(8).toString('hex');
}

function unfinishedClaim(eventType: string | null | undefined): boolean {
  return Boolean(
    eventType?.startsWith(STRIPE_WEBHOOK_CLAIM_PREFIX) ||
    eventType?.startsWith(STRIPE_WEBHOOK_PROCESSING_PREFIX),
  );
}

export function storedClaimType(phase: 'pending' | 'processing', attemptId: string, eventType: string): string {
  const stored = `${phase}:${attemptId}:${eventType}`;
  if (stored.length > 128) throw new Error('Stripe webhook claim type exceeds 128 characters');
  return stored;
}

/** Split a claim row. Legacy rows are `pending:<eventType>` with no attempt id. */
export function parseStoredClaim(stored: string | null | undefined): {
  phase: 'pending' | 'processing' | 'done';
  attemptId: string | null;
  eventType: string;
} {
  if (!stored) return { phase: 'done', attemptId: null, eventType: '' };
  for (const phase of ['pending', 'processing'] as const) {
    const prefix = `${phase}:`;
    if (!stored.startsWith(prefix)) continue;
    const rest = stored.slice(prefix.length);
    const colon = rest.indexOf(':');
    const attemptId = colon === 16 ? rest.slice(0, colon) : '';
    if (STRIPE_ATTEMPT_ID_RE.test(attemptId)) {
      return { phase, attemptId, eventType: rest.slice(colon + 1) };
    }
    return { phase, attemptId: null, eventType: rest };
  }
  return { phase: 'done', attemptId: null, eventType: stored };
}

export function processingClaimType(eventType: string): string {
  const parsed = parseStoredClaim(eventType);
  if (parsed.attemptId && (parsed.phase === 'pending' || parsed.phase === 'processing')) {
    return storedClaimType('processing', parsed.attemptId, parsed.eventType);
  }
  if (eventType.startsWith(STRIPE_WEBHOOK_CLAIM_PREFIX)) {
    return `${STRIPE_WEBHOOK_PROCESSING_PREFIX}${eventType.slice(STRIPE_WEBHOOK_CLAIM_PREFIX.length)}`;
  }
  if (eventType.startsWith(STRIPE_WEBHOOK_PROCESSING_PREFIX)) return eventType;
  return `${STRIPE_WEBHOOK_PROCESSING_PREFIX}${eventType}`;
}

export function decideDuplicateStripeClaim(
  claim: { eventType?: string | null; processedAt?: Date | string | null } | null | undefined,
  nowMs: number,
): 'duplicate' | 'reclaim' | 'retry' {
  if (!unfinishedClaim(claim?.eventType)) {
    // Missing row or a claim already marked complete. A missing row is not a
    // finished event: the caller must retry rather than acknowledge it.
    return claim?.eventType ? 'duplicate' : 'retry';
  }
  const processedAtMs = claim?.processedAt instanceof Date
    ? claim.processedAt.getTime()
    : new Date(claim?.processedAt ?? '').getTime();
  if (!Number.isFinite(processedAtMs) || nowMs - processedAtMs < STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS) {
    return 'retry';
  }
  return 'reclaim';
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: number } | undefined;
    if (typeof header?.affectedRows === 'number') return header.affectedRows;
  }
  if (result && typeof result === 'object' && 'affectedRows' in result) {
    const rows = (result as { affectedRows?: unknown }).affectedRows;
    if (typeof rows === 'number') return rows;
  }
  return 0;
}

/**
 * Attempt to claim a Stripe event ID for idempotency.
 * Returns false only for a finished duplicate. An unfinished pending claim is
 * reclaimed (true) or rejected so the webhook returns 5xx and Stripe retries.
 */
export async function recordStripeWebhookEvent(eventId: string, eventType: string): Promise<StripeWebhookAttempt | null> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable: cannot claim Stripe webhook event');
  const attemptId = newStripeAttemptId();
  try {
    await db.insert(stripeWebhookEvents).values({
      eventId,
      eventType: storedClaimType('pending', attemptId, eventType),
    });
    return { attemptId };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        eventType: stripeWebhookEvents.eventType,
        processedAt: stripeWebhookEvents.processedAt,
      })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .limit(1)
      .for('update');
    const decision = decideDuplicateStripeClaim(existing, Date.now());
    if (decision === 'duplicate') return null;
    if (decision !== 'reclaim' || !existing?.eventType || !existing.processedAt) {
      throw new UnfinishedStripeWebhookClaimError(eventId);
    }
    const parsed = parseStoredClaim(existing.eventType);
    const bareType = parsed.eventType || eventType;
    const nextType = storedClaimType('processing', attemptId, bareType);
    const updated = await tx.update(stripeWebhookEvents)
      .set({ processedAt: new Date(), eventType: nextType })
      .where(and(
        eq(stripeWebhookEvents.eventId, eventId),
        eq(stripeWebhookEvents.eventType, existing.eventType),
        eq(stripeWebhookEvents.processedAt, existing.processedAt),
      ));
    if (affectedRows(updated) !== 1) throw new UnfinishedStripeWebhookClaimError(eventId);
    console.error(`[Stripe Webhook][BILLING-ALERT] Reclaiming unfinished claim ${eventId} after a failed release`);
    return { attemptId };
  });
}

/**
 * Mark a claimed event finished so a later delivery is a real duplicate.
 * Throws when the database is unavailable — a 2xx must not be sent until the
 * claim can no longer be mistaken for an unfinished release.
 */
function attemptOwnsClaim(stored: string | null | undefined, attemptId: string, eventType: string): boolean {
  const parsed = parseStoredClaim(stored);
  return parsed.attemptId === attemptId
    && parsed.eventType === eventType
    && (parsed.phase === 'pending' || parsed.phase === 'processing');
}

export async function completeStripeWebhookEvent(eventId: string, eventType: string, attemptId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable: cannot complete Stripe webhook event');
  const updated = await db.update(stripeWebhookEvents)
    .set({ eventType })
    .where(and(
      eq(stripeWebhookEvents.eventId, eventId),
      or(
        eq(stripeWebhookEvents.eventType, storedClaimType('pending', attemptId, eventType)),
        eq(stripeWebhookEvents.eventType, storedClaimType('processing', attemptId, eventType)),
      ),
    ));
  if (affectedRows(updated) === 1) return;
  const [row] = await db.select({ eventType: stripeWebhookEvents.eventType })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId))
    .limit(1);
  if (row?.eventType === eventType) return;
  if (row && !attemptOwnsClaim(row.eventType, attemptId, eventType)) {
    throw new StaleStripeWebhookClaimError(eventId);
  }
  throw new Error(`Stripe webhook claim ${eventId} was not retained`);
}

/**
 * Release only the row this attempt still owns. A newer attempt's claim is left
 * in place. Throws when this attempt no longer owns an unfinished row.
 */
export async function releaseStripeWebhookEvent(eventId: string, attemptId: string, eventType: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable: cannot release Stripe webhook event');
  const deleted = await db.delete(stripeWebhookEvents).where(and(
    eq(stripeWebhookEvents.eventId, eventId),
    or(
      eq(stripeWebhookEvents.eventType, storedClaimType('pending', attemptId, eventType)),
      eq(stripeWebhookEvents.eventType, storedClaimType('processing', attemptId, eventType)),
    ),
  ));
  if (affectedRows(deleted) === 1) return;
  const [row] = await db.select({ eventType: stripeWebhookEvents.eventType })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId))
    .limit(1);
  if (!row) return;
  if (row.eventType === eventType) return;
  throw new StaleStripeWebhookClaimError(eventId);
}

// ── Entitlement audit log ─────────────────────────────────────────────────────
export async function writeEntitlementAudit(params: {
  userId: number;
  fromTier: string | null | undefined;
  toTier: string;
  reason: string;
  stripeEventId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Webhook grants throw so a missing audit cannot be mistaken for "never applied". */
  strict?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (params.strict) throw new Error('Database unavailable: cannot write entitlement audit');
    return;
  }
  try {
    await db.insert(entitlementAuditLog).values({
      userId: params.userId,
      fromTier: params.fromTier ?? null,
      toTier: params.toTier,
      reason: params.reason,
      stripeEventId: params.stripeEventId ?? null,
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
    });
  } catch (err) {
    if (params.strict) throw err;
    console.warn('[EntitlementAudit] Failed to write audit entry:', err);
  }
}

export async function entitlementAuditExists(stripeEventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable: cannot read entitlement audit');
  const [row] = await db.select({ id: entitlementAuditLog.id })
    .from(entitlementAuditLog)
    .where(eq(entitlementAuditLog.stripeEventId, stripeEventId))
    .limit(1);
  return Boolean(row);
}

export type StripeEntitlementCommit = {
  eventId: string;
  eventType: string;
  attemptId: string;
  userId: number;
  /** Omitted on a revoke. A revoke uses revokeSubscriptionId instead of this patch. */
  patch?: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    accessTier?: 'free' | 'core' | 'premium' | 'founding';
    lifetimeAccess?: boolean;
    lifetimePurchasedAt?: Date | null;
  };
  /**
   * Conditional downgrade. The row changes only when lifetimeAccess is still
   * false and stripeSubscriptionId is still this subscription.
   */
  revokeSubscriptionId?: string;
  audit: {
    fromTier: string | null | undefined;
    toTier: string;
    reason: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
};

/**
 * User update, entitlement audit, and claim completion in one transaction.
 * The claim row is locked and the attempt id must still own it. A crash rolls
 * all three back. No new migration: the attempt id lives in eventType.
 */
export async function commitStripeEntitlement(
  params: StripeEntitlementCommit,
): Promise<'applied' | 'claim_lost' | 'revoke_skipped'> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable: cannot commit Stripe entitlement');
  return db.transaction(async (tx) => {
    const [claim] = await tx.select({ eventType: stripeWebhookEvents.eventType })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, params.eventId))
      .limit(1)
      .for('update');
    if (!attemptOwnsClaim(claim?.eventType, params.attemptId, params.eventType)) {
      return 'claim_lost';
    }
    if (params.revokeSubscriptionId) {
      const revoked = await tx.update(users)
        .set({ accessTier: 'free', stripeSubscriptionId: null, updatedAt: new Date() })
        .where(and(
          eq(users.id, params.userId),
          eq(users.lifetimeAccess, false),
          eq(users.stripeSubscriptionId, params.revokeSubscriptionId),
        ));
      if (affectedRows(revoked) !== 1) {
        await sealStripeClaim(tx, params.eventId, params.eventType, params.attemptId);
        return 'revoke_skipped';
      }
    } else {
      if (!params.patch) throw new Error('Stripe entitlement commit is missing a user patch');
      await tx.update(users)
        .set({ ...params.patch, updatedAt: new Date() })
        .where(eq(users.id, params.userId));
    }
    await tx.insert(entitlementAuditLog).values({
      userId: params.userId,
      fromTier: params.audit.fromTier ?? null,
      toTier: params.audit.toTier,
      reason: params.audit.reason,
      stripeEventId: params.eventId,
      stripeCustomerId: params.audit.stripeCustomerId ?? null,
      stripeSubscriptionId: params.audit.stripeSubscriptionId ?? null,
    });
    await sealStripeClaim(tx, params.eventId, params.eventType, params.attemptId);
    return 'applied';
  });
}

async function sealStripeClaim(
  tx: { update: (...args: any[]) => any },
  eventId: string,
  eventType: string,
  attemptId: string,
): Promise<void> {
  const updated = await tx.update(stripeWebhookEvents)
    .set({ eventType })
    .where(and(
      eq(stripeWebhookEvents.eventId, eventId),
      or(
        eq(stripeWebhookEvents.eventType, storedClaimType('pending', attemptId, eventType)),
        eq(stripeWebhookEvents.eventType, storedClaimType('processing', attemptId, eventType)),
      ),
    ));
  if (affectedRows(updated) !== 1) throw new StaleStripeWebhookClaimError(eventId);
}

export async function getEntitlementAuditHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(entitlementAuditLog)
    .where(eq(entitlementAuditLog.userId, userId))
    .orderBy(desc(entitlementAuditLog.createdAt))
    .limit(limit);
}
