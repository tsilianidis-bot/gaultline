import { eq, and, desc, count, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertPosition, users, positions, cryptoWatchlist, InsertCryptoWatchlistItem, foundingAccessRequests, InsertFoundingAccessRequest, blogPosts, InsertBlogPost, xPostQueue } from "../drizzle/schema";
import { ENV } from './_core/env';
import { log } from './logger';

let _db: ReturnType<typeof drizzle> | null = null;

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
  return db.select().from(positions).where(eq(positions.userId, userId));
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
    .orderBy(users.createdAt);
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
    .orderBy(cryptoWatchlist.addedAt);
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

// ── Access Tier helpers ─────────────────────────────────────────────

export async function getUserTier(userId: number): Promise<'free' | 'premium' | 'founding'> {
  const db = await getDb();
  if (!db) return 'free';
  const result = await db.select({ accessTier: users.accessTier })
    .from(users).where(eq(users.id, userId)).limit(1);
  return result[0]?.accessTier ?? 'free';
}

export async function setUserTier(
  userId: number,
  tier: 'free' | 'premium' | 'founding'
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users)
    .set({ accessTier: tier, updatedAt: new Date() })
    .where(eq(users.id, userId));
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
    .orderBy(desc(foundingAccessRequests.createdAt));
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
    .orderBy(users.createdAt);
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
    accessTier?: 'free' | 'premium' | 'founding';
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByStripeCustomerId(customerId: string): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select({ id: users.id })
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
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
  }).from(blogPosts).$dynamic();

  const conditions = [];
  if (publishedOnly) conditions.push(eq(blogPosts.published, 1));
  if (category) conditions.push(eq(blogPosts.category, category));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;

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
