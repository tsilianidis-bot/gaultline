/**
 * Isolated integration trial for PR #117 (billing) and PR #118 (Pentagonal Thesis).
 * No live Stripe, no shared database, no checkout, no registration, no record writes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { CHECKOUT_ENABLED, OPEN_REGISTRATION } from "../shared/tiers";
import type { TrpcContext } from "./_core/context";
import { coreProcedure, protectedProcedure, router } from "./_core/trpc";
import { appRouter } from "./routers";
import { effectiveTier, getUserTier } from "./db";
import { thesisRecordWritesEnabled, maybeAppendThesisRecord } from "./pentagonalThesisRecord";
import { resetPentagonalThesisRateLimit } from "./routers/pentagonalThesis";
import {
  decideEntitlement,
  subscriptionInvoiceDecision,
  type SubscriptionView,
} from "./stripe/entitlementSync";
import { composeStockPentagonalThesis } from "./pentagonalThesisCompose";
import { buildPentagonalThesis, type PentagonalThesis } from "../shared/pentagonalThesis";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getUserTier: vi.fn(actual.getUserTier) };
});

vi.mock("./pentagonalThesisCompose", () => ({
  composeStockPentagonalThesis: vi.fn(async (symbol: string) => ({
    symbol,
    scope: "stock",
    headline: `shared:${symbol}`,
    persistence: { written: false, reason: "PENTAGONAL_THESIS_RECORD_WRITES is off" },
  })),
}));

const root = resolve(import.meta.dirname, "..");
const NOW = 1_800_000_000_000;
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_900_000_000;

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function ctx(userId: number | null, ip = "198.51.100.20"): TrpcContext {
  return {
    user: userId == null ? null : {
      id: userId,
      openId: `open-${userId}`,
      email: `user${userId}@example.com`,
      name: `User ${userId}`,
      loginMethod: "test",
      role: "user",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      lastSignedIn: new Date(0),
    },
    req: { ip, protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function subscription(overrides: Partial<SubscriptionView> = {}): SubscriptionView {
  return {
    id: "sub_live",
    status: "active",
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    latest_invoice: {
      id: "in_paid",
      status: "paid",
      amount_paid: 5900,
      total: 5900,
      created: PERIOD_START,
      period_start: PERIOD_START,
      status_transitions: { paid_at: PERIOD_START },
    },
    items: { data: [{ price: { id: "price_premium" }, current_period_start: PERIOD_START, current_period_end: PERIOD_END }] },
    ...overrides,
  };
}

function decide(overrides: Partial<Parameters<typeof decideEntitlement>[0]> = {}) {
  const sub = overrides.subscriptions?.[0] ?? subscription();
  return decideEntitlement({
    subscriptions: [sub],
    listIncomplete: false,
    markers: [],
    corroborated: overrides.corroborated === undefined ? sub : overrides.corroborated,
    storedLifetime: false,
    lifetimeVerified: false,
    lifetimePurchasedAt: null,
    resolveTier: priceId => priceId === "price_premium" ? "premium" : priceId === "price_founding" ? "founding" : priceId === "price_core" ? "core" : null,
    nowMs: NOW,
    ...overrides,
  });
}

const probe = router({
  authed: protectedProcedure.query(() => "authed"),
  gated: coreProcedure.query(() => "gated"),
});

describe("integration 117+118 shared surface", () => {
  it("keeps checkout, registration, and thesis record writes off", () => {
    expect(CHECKOUT_ENABLED).toBe(false);
    expect(OPEN_REGISTRATION).toBe(false);
    expect(thesisRecordWritesEnabled({ PENTAGONAL_THESIS_RECORD_WRITES: "" })).toBe(false);
    expect(thesisRecordWritesEnabled({ PENTAGONAL_THESIS_RECORD_WRITES: "true" })).toBe(true);
    expect(read(".env.example")).toContain("PENTAGONAL_THESIS_RECORD_WRITES=");
    expect(read(".env.example")).not.toMatch(/^PENTAGONAL_THESIS_RECORD_WRITES=true$/m);
    expect(read("server/_core/sdk.ts")).toContain('throw ForbiddenError("Membership registration is not open yet")');
  });

  it("registers billing and pentagonalThesis on the same app router", () => {
    expect(appRouter._def.procedures).toHaveProperty("billing.getPlans");
    expect(appRouter._def.procedures).toHaveProperty("pentagonalThesis.forSymbol");
    expect(appRouter._def.procedures).toHaveProperty("user.getAccessTier");
    expect(appRouter._def.procedures).toHaveProperty("signals.getSignalVisualDetail");
    const routers = read("server/routers.ts");
    expect(routers).toContain("billing: billingRouter");
    expect(routers).toContain("pentagonalThesis: pentagonalThesisRouter");
    expect(routers).toMatch(/getSignalVisualDetail:\s*coreProcedure/);
    expect(read("server/routers/index.ts")).toContain('export { pentagonalThesisRouter }');
    expect(read("server/routers/pentagonalThesis.ts")).toContain("forSymbol: publicProcedure");
    expect(read("server/routers/pentagonalThesis.ts")).not.toContain("ctx.user");
  });

  it("keeps the immutable journal tail and approved auth append in order", () => {
    const journal = JSON.parse(read("drizzle/meta/_journal.json")) as {
      entries: Array<{ idx: number; version: string; tag: string; when: number; breakpoints: boolean }>;
    };
    const immutable0072To0082 = [
      { idx: 72, version: "5", when: 1790544467081, tag: "0072_final_recovery_controls", breakpoints: true },
      { idx: 73, version: "5", when: 1791864000000, tag: "0073_pressure_v2_shadow", breakpoints: true },
      { idx: 74, version: "5", when: 1792100000000, tag: "0074_stripe_entitlement_resync", breakpoints: true },
      { idx: 75, version: "5", when: 1792200000000, tag: "0075_pentagonal_thesis_records", breakpoints: true },
      { idx: 76, version: "5", when: 1792300000000, tag: "0076_algorithm_outcome_fk_name", breakpoints: true },
      { idx: 77, version: "5", when: 1793241851962, tag: "0077_governed_research_immutability", breakpoints: true },
      { idx: 78, version: "5", when: 1793270956094, tag: "0078_payment_event_linkage", breakpoints: true },
      { idx: 79, version: "5", when: 1793270956095, tag: "0079_decision_outcome_provenance", breakpoints: true },
      { idx: 80, version: "5", when: 1793270956096, tag: "0080_publishing_delivery_claims", breakpoints: true },
      { idx: 81, version: "5", when: 1793270956097, tag: "0081_admin_audit_events", breakpoints: true },
      { idx: 82, version: "5", when: 1793270956098, tag: "0082_durable_alert_events", breakpoints: true },
    ];
    const approved0083 = {
      idx: 83,
      version: "5",
      when: 1793386577182,
      tag: "0083_auth_state_and_sessions",
      breakpoints: true,
    };
    expect(journal.entries.slice(72, 83)).toEqual(immutable0072To0082);
    expect(journal.entries.slice(72)).toEqual([...immutable0072To0082, approved0083]);
    expect(journal.entries).toHaveLength(84);
    expect(journal.entries.indexOf(journal.entries[83]!)).toBe(83);
    expect(journal.entries[83]).toEqual(approved0083);
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("pressureV2ShadowObservations");
    expect(schema).toContain("accessExpiresAt");
    expect(schema).toContain("entitlementRevision");
    expect(schema).toContain("stripeSubscriptionCancellations");
    expect(schema).toContain("pentagonalThesisRecords");
    expect(schema).toContain("pentagonalThesisOutcomeScores");
    expect(schema).toContain('export const oauthAuthorizationStates = mysqlTable("oauthAuthorizationStates"');
    expect(schema).toContain('index("oauthAuthorizationStates_expiresAt_idx").on(t.expiresAt)');
    expect(schema).toContain('export const authSessions = mysqlTable("authSessions"');
    expect(schema).toContain('index("authSessions_openId_expiresAt_idx").on(t.openId, t.expiresAt)');
    expect(schema).toContain('index("authSessions_expiresAt_idx").on(t.expiresAt)');
  });

  it("keeps both edits on the shared Watchlist page", () => {
    const page = read("client/src/pages/Watchlist.tsx");
    expect(page).toContain("PentagonalThesisNarrative");
    expect(page).toContain("trpc.user.getAccessTier.useQuery");
    expect(page).toContain("Observer cap follows effective tier");
    expect(page).not.toContain("(user as { accessTier?: string }).accessTier");
  });
});

describe("integration 117+118 authentication and entitlement", () => {
  beforeEach(() => {
    vi.mocked(getUserTier).mockReset();
  });

  it("requires auth on protected and core routes", async () => {
    const anon = probe.createCaller(ctx(null));
    await expect(anon.authed()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.gated()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(ctx(null)).user.getAccessTier()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(ctx(null)).signals.getSignalVisualDetail({ symbol: "AAPL" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("enforces effective tier for free, pro, founding, lifetime, and canceled users", async () => {
    const cases = [
      { name: "free", row: { accessTier: "free", lifetimeAccess: false, accessExpiresAt: null }, gated: false },
      { name: "pro", row: { accessTier: "premium", lifetimeAccess: false, accessExpiresAt: new Date(NOW + 86_400_000) }, gated: true },
      { name: "founding", row: { accessTier: "founding", lifetimeAccess: false, accessExpiresAt: null }, gated: true },
      { name: "lifetime", row: { accessTier: "free", lifetimeAccess: true, accessExpiresAt: new Date(0) }, gated: true },
      { name: "canceled", row: { accessTier: "premium", lifetimeAccess: false, accessExpiresAt: new Date(NOW - 1000) }, gated: false },
    ] as const;

    for (const entry of cases) {
      expect(effectiveTier({ ...entry.row, nowMs: NOW }), entry.name).toBe(
        entry.name === "lifetime" ? "founding" : entry.name === "pro" ? "premium" : entry.name === "canceled" ? "free" : entry.row.accessTier,
      );
      vi.mocked(getUserTier).mockImplementation(async () => effectiveTier({ ...entry.row, nowMs: NOW }));
      const caller = probe.createCaller(ctx(entry.name === "lifetime" ? 7 : 3));
      await expect(caller.authed()).resolves.toBe("authed");
      if (entry.gated) await expect(caller.gated()).resolves.toBe("gated");
      else await expect(caller.gated()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("grants a 100% coupon renewal and does not grant a canceled subscription", () => {
    const coupon = subscription({
      latest_invoice: {
        id: "in_coupon",
        status: "paid",
        amount_paid: 0,
        total: 0,
        created: PERIOD_START,
        period_start: PERIOD_START,
        status_transitions: { paid_at: PERIOD_START },
        discount: { coupon: { id: "coup_100" } },
      },
    });
    expect(subscriptionInvoiceDecision(coupon)).toEqual({ entitled: true, kind: "coupon" });
    const renewed = decide({ subscriptions: [coupon], corroborated: coupon });
    expect(renewed).toMatchObject({ action: "apply", accessTier: "premium", usesSubscription: true });

    const canceled = subscription({ status: "canceled" });
    expect(subscriptionInvoiceDecision(canceled)).toEqual({ entitled: false });
    const dropped = decide({
      subscriptions: [canceled],
      corroborated: null,
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 10, status: "canceled" }],
    });
    expect(dropped).toMatchObject({ action: "apply", accessTier: "free", usesSubscription: false, grantLifetime: false });
  });
});

describe("integration 117+118 thesis access", () => {
  beforeEach(() => {
    resetPentagonalThesisRateLimit();
    vi.mocked(composeStockPentagonalThesis).mockClear();
  });

  it("serves forSymbol without auth and rate-limits each caller separately", async () => {
    const first = appRouter.createCaller(ctx(null, "203.0.113.8"));
    const seen = await first.pentagonalThesis.forSymbol({ symbol: "aapl" });
    expect(seen).toMatchObject({ symbol: "AAPL", persistence: { written: false } });
    expect(composeStockPentagonalThesis).toHaveBeenCalledWith("AAPL");

    for (let i = 1; i < 60; i += 1) await first.pentagonalThesis.forSymbol({ symbol: "AAPL" });
    await expect(first.pentagonalThesis.forSymbol({ symbol: "AAPL" })).rejects.toBeInstanceOf(TRPCError);
    await expect(first.pentagonalThesis.forSymbol({ symbol: "AAPL" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    const other = appRouter.createCaller(ctx(null, "203.0.113.9"));
    await expect(other.pentagonalThesis.forSymbol({ symbol: "MSFT" })).resolves.toMatchObject({ symbol: "MSFT" });
  });

  it("keeps the gated signal surface behind the tier while the public thesis does not", async () => {
    vi.mocked(getUserTier).mockImplementation(async () => effectiveTier({ accessTier: "free", lifetimeAccess: false, accessExpiresAt: null }));
    await expect(appRouter.createCaller(ctx(4)).signals.getSignalVisualDetail({ symbol: "AAPL" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(ctx(4)).pentagonalThesis.forSymbol({ symbol: "AAPL" })).resolves.toMatchObject({ symbol: "AAPL" });

    vi.mocked(getUserTier).mockImplementation(async () => effectiveTier({ accessTier: "premium", lifetimeAccess: false, accessExpiresAt: null }));
    await expect(probe.createCaller(ctx(5)).gated()).resolves.toBe("gated");
    vi.mocked(getUserTier).mockImplementation(async () => effectiveTier({ accessTier: "free", lifetimeAccess: true, accessExpiresAt: new Date(0) }));
    await expect(probe.createCaller(ctx(8)).gated()).resolves.toBe("gated");
  });

  it("does not leak another user's data from the public thesis surface", async () => {
    const record = read("server/pentagonalThesisRecord.ts");
    expect(record).not.toContain("userId");
    expect(record).toContain("PENTAGONAL_THESIS_RECORD_WRITES is off");
    const thesis = buildPentagonalThesis({
      symbol: "AAPL",
      generatedAt: "2026-10-27T15:00:00.000Z",
      quote: null,
      bars: [],
      market: null,
      profile: null,
    });
    const status = await maybeAppendThesisRecord(thesis as PentagonalThesis, { PENTAGONAL_THESIS_RECORD_WRITES: "" });
    expect(status).toEqual({ written: false, reason: "PENTAGONAL_THESIS_RECORD_WRITES is off" });

    const left = await appRouter.createCaller(ctx(11, "192.0.2.11")).pentagonalThesis.forSymbol({ symbol: "nvda" });
    const right = await appRouter.createCaller(ctx(22, "192.0.2.22")).pentagonalThesis.forSymbol({ symbol: "NVDA" });
    expect(left).toEqual(right);
    expect(JSON.stringify(left)).not.toContain("11");
    expect(JSON.stringify(right)).not.toContain("22");
    expect(composeStockPentagonalThesis).toHaveBeenCalledWith("NVDA");
    expect(vi.mocked(composeStockPentagonalThesis).mock.calls.every(call => call.length === 1)).toBe(true);
  });
});
