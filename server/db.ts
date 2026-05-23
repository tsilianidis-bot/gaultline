import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertPosition, users, positions, cryptoWatchlist, InsertCryptoWatchlistItem, foundingAccessRequests, InsertFoundingAccessRequest } from "../drizzle/schema";
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
): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(foundingAccessRequests).values({
    ...data,
    status: 'pending',
  });
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket?.insertId ?? null;
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
