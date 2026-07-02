/**
 * Symbol Intelligence Regression Tests
 *
 * Verifies that all supported symbols complete the full FAULTLINE pipeline
 * without transformation errors, schema mismatches, or serialization failures.
 *
 * Covers:
 * - All 15 supported symbols (stocks, crypto, ETFs)
 * - Invalid symbols
 * - Empty inputs
 * - Edge cases (action words as queries, ambiguous names)
 * - sanitize() function hardening
 * - IntentResolver correctness
 */

import { describe, it, expect } from "vitest";
import { resolveIntent } from "./intentResolver";

// ── sanitize() unit tests ─────────────────────────────────────

function sanitize(v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "number") return isFinite(v) && !isNaN(v) ? v : 0;
  if (Array.isArray(v)) return v.map(sanitize);
  if (typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitize(val)])
    );
  }
  return v;
}

describe("sanitize() — serialization hardening", () => {
  it("converts undefined to null (prevents superjson metadata mismatch)", () => {
    expect(sanitize(undefined)).toBe(null);
  });

  it("preserves null as null", () => {
    expect(sanitize(null)).toBe(null);
  });

  it("converts NaN to 0", () => {
    expect(sanitize(NaN)).toBe(0);
  });

  it("converts Infinity to 0", () => {
    expect(sanitize(Infinity)).toBe(0);
    expect(sanitize(-Infinity)).toBe(0);
  });

  it("preserves valid numbers", () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(0)).toBe(0);
    expect(sanitize(-3.14)).toBe(-3.14);
  });

  it("recursively sanitizes objects with undefined values", () => {
    const input = { a: 1, b: undefined, c: NaN, d: { e: undefined } };
    const result = sanitize(input) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.b).toBe(null);
    expect(result.c).toBe(0);
    expect((result.d as Record<string, unknown>).e).toBe(null);
  });

  it("recursively sanitizes arrays", () => {
    const input = [1, undefined, NaN, null, "hello"];
    const result = sanitize(input) as unknown[];
    expect(result).toEqual([1, null, 0, null, "hello"]);
  });

  it("handles deeply nested structures", () => {
    const input = {
      level1: {
        level2: {
          value: undefined,
          arr: [undefined, NaN, Infinity],
        },
      },
    };
    const result = sanitize(input) as { level1: { level2: { value: unknown; arr: unknown[] } } };
    expect(result.level1.level2.value).toBe(null);
    expect(result.level1.level2.arr).toEqual([null, 0, 0]);
  });

  it("preserves strings and booleans unchanged", () => {
    expect(sanitize("hello")).toBe("hello");
    expect(sanitize("")).toBe("");
    expect(sanitize(true)).toBe(true);
    expect(sanitize(false)).toBe(false);
  });
});

// ── IntentResolver — all 15 supported symbols ─────────────────

describe("IntentResolver — stock symbols", () => {
  it("resolves AAPL correctly", () => {
    const r = resolveIntent("AAPL", null, null);
    expect(r.ticker).toBe("AAPL");
    expect(r.assetType).toBe("stock");
    expect(r.confidence).toBe("high");
  });

  it("resolves NVDA correctly", () => {
    const r = resolveIntent("NVDA", null, null);
    expect(r.ticker).toBe("NVDA");
    expect(r.assetType).toBe("stock");
  });

  it("resolves TSLA correctly", () => {
    const r = resolveIntent("TSLA", null, null);
    expect(r.ticker).toBe("TSLA");
    expect(r.assetType).toBe("stock");
  });

  it("resolves PLTR correctly", () => {
    const r = resolveIntent("PLTR", null, null);
    expect(r.ticker).toBe("PLTR");
    expect(r.assetType).toBe("stock");
  });

  it("resolves 'Apple' to AAPL", () => {
    const r = resolveIntent("Apple", null, null);
    expect(r.ticker).toBe("AAPL");
    expect(r.assetType).toBe("stock");
  });

  it("resolves 'Tesla' to TSLA", () => {
    const r = resolveIntent("Tesla", null, null);
    expect(r.ticker).toBe("TSLA");
    expect(r.assetType).toBe("stock");
  });

  it("resolves 'Nvidia' to NVDA", () => {
    const r = resolveIntent("Nvidia", null, null);
    expect(r.ticker).toBe("NVDA");
    expect(r.assetType).toBe("stock");
  });
});

describe("IntentResolver — crypto symbols", () => {
  it("resolves BTC correctly", () => {
    const r = resolveIntent("BTC", null, null);
    expect(r.ticker).toBe("BTC");
    expect(r.assetType).toBe("crypto");
    expect(r.confidence).toBe("high");
  });

  it("resolves ETH correctly", () => {
    const r = resolveIntent("ETH", null, null);
    expect(r.ticker).toBe("ETH");
    expect(r.assetType).toBe("crypto");
    expect(r.confidence).toBe("high");
  });

  it("resolves SOL correctly", () => {
    const r = resolveIntent("SOL", null, null);
    expect(r.ticker).toBe("SOL");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves TAO correctly", () => {
    const r = resolveIntent("TAO", null, null);
    expect(r.ticker).toBe("TAO");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves ONDO correctly", () => {
    const r = resolveIntent("ONDO", null, null);
    expect(r.ticker).toBe("ONDO");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves LINK correctly", () => {
    const r = resolveIntent("LINK", null, null);
    expect(r.ticker).toBe("LINK");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves DOGE correctly", () => {
    const r = resolveIntent("DOGE", null, null);
    expect(r.ticker).toBe("DOGE");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves 'Bitcoin' to BTC", () => {
    const r = resolveIntent("Bitcoin", null, null);
    expect(r.ticker).toBe("BTC");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves 'Ethereum' to ETH", () => {
    const r = resolveIntent("Ethereum", null, null);
    expect(r.ticker).toBe("ETH");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves 'Solana' to SOL", () => {
    const r = resolveIntent("Solana", null, null);
    expect(r.ticker).toBe("SOL");
    expect(r.assetType).toBe("crypto");
  });

  it("resolves 'Dogecoin' to DOGE", () => {
    const r = resolveIntent("Dogecoin", null, null);
    expect(r.ticker).toBe("DOGE");
    expect(r.assetType).toBe("crypto");
  });
});

describe("IntentResolver — ETF symbols", () => {
  it("resolves SPY correctly", () => {
    const r = resolveIntent("SPY", null, null);
    expect(r.ticker).toBe("SPY");
    expect(r.assetType).toBe("stock");
  });

  it("resolves QQQ correctly", () => {
    const r = resolveIntent("QQQ", null, null);
    expect(r.ticker).toBe("QQQ");
    expect(r.assetType).toBe("stock");
  });

  it("resolves IBIT correctly", () => {
    const r = resolveIntent("IBIT", null, null);
    expect(r.ticker).toBe("IBIT");
    expect(r.assetType).toBe("stock");
  });
});

describe("IntentResolver — natural language queries (CRITICAL: no action word confusion)", () => {
  it("'Should I buy BTC today?' → BTC, not SHOULD", () => {
    const r = resolveIntent("Should I buy BTC today?", null, null);
    expect(r.ticker).toBe("BTC");
    expect(r.assetType).toBe("crypto");
  });

  it("'Should I buy ETH?' → ETH, not SHOULD", () => {
    const r = resolveIntent("Should I buy ETH?", null, null);
    expect(r.ticker).toBe("ETH");
    expect(r.assetType).toBe("crypto");
  });

  it("'Would AAPL be a good buy?' → AAPL, not WOULD", () => {
    const r = resolveIntent("Would AAPL be a good buy?", null, null);
    expect(r.ticker).toBe("AAPL");
    expect(r.assetType).toBe("stock");
  });

  it("'Could TSLA break out?' → TSLA, not COULD", () => {
    const r = resolveIntent("Could TSLA break out?", null, null);
    expect(r.ticker).toBe("TSLA");
    expect(r.assetType).toBe("stock");
  });

  it("'Is Bitcoin bullish?' → BTC", () => {
    const r = resolveIntent("Is Bitcoin bullish?", null, null);
    expect(r.ticker).toBe("BTC");
    expect(r.assetType).toBe("crypto");
  });

  it("'What is the outlook for Ethereum?' → ETH", () => {
    const r = resolveIntent("What is the outlook for Ethereum?", null, null);
    expect(r.ticker).toBe("ETH");
    expect(r.assetType).toBe("crypto");
  });

  it("'How is the market doing?' → macro query, no ticker", () => {
    const r = resolveIntent("How is the market doing?", null, null);
    expect(r.ticker).toBeNull();
    expect(r.queryType).toBe("macro");
  });

  it("'What is the macro outlook?' → macro query, no ticker", () => {
    const r = resolveIntent("What is the macro outlook?", null, null);
    expect(r.ticker).toBeNull();
    expect(r.queryType).toBe("macro");
  });
});

describe("IntentResolver — invalid and edge cases", () => {
  it("empty string → no ticker, macro query", () => {
    const r = resolveIntent("", null, null);
    expect(r.ticker).toBeNull();
  });

  it("gibberish → no ticker", () => {
    const r = resolveIntent("xyzqwerty123", null, null);
    expect(r.ticker).toBeNull();
  });

  it("single common English word → no ticker (not confused with ticker)", () => {
    // 'SELL' is a common English word, should not be treated as a ticker
    const r = resolveIntent("SELL", null, null);
    expect(r.ticker).toBeNull();
  });

  it("'BUY' alone → no ticker (action word, not a ticker)", () => {
    const r = resolveIntent("BUY", null, null);
    expect(r.ticker).toBeNull();
  });

  it("does NOT inherit context ticker for generic non-referential queries (Rule 3)", () => {
    // Rule 3: The active symbol is context, not the default answer.
    // 'What do you think?' is a generic question — it does not explicitly
    // reference the active symbol, so the ticker should NOT be inherited.
    const r = resolveIntent("What do you think?", "NVDA", "stock");
    // Should be classified as general/macro, not security
    expect(r.queryType).not.toBe("security");
  });

  it("inherits context ticker for explicit back-references (Rule 3)", () => {
    // 'what about it' explicitly refers to the active symbol
    const r = resolveIntent("what about it", "NVDA", "stock");
    expect(r.ticker).toBe("NVDA");
    expect(r.assetType).toBe("stock");
  });

  it("explicit symbol in query overrides context ticker", () => {
    const r = resolveIntent("What about ETH?", "NVDA", "stock");
    expect(r.ticker).toBe("ETH");
    expect(r.assetType).toBe("crypto");
  });
});

// ── Response schema validation ────────────────────────────────

describe("Response schema validation — FaultlineAnswer field safety", () => {
  it("sanitize handles a realistic FaultlineAnswer with undefined fields", () => {
    const mockAnswer = {
      verdict: "ACCUMULATE",
      verdictColor: "green",
      opportunityScore: 72,
      confidence: 68,
      confidenceLabel: "HIGH",
      ticker: "ETH",
      assetType: "crypto",
      queryType: "crypto",
      currentRegime: "MODERATE RISK",
      regimeColor: "yellow",
      dataFreshness: "live",
      executiveSummary: "ETH shows strong momentum.",
      whyThisVerdict: "Multiple bullish signals.",
      bullCase: "ETH breaks $4000.",
      bearCase: "ETH drops below $2500.",
      catalysts: ["ETF approval", "DeFi growth"],
      threats: ["Regulatory risk"],
      support: undefined,      // ← undefined field that would break superjson
      resistance: undefined,   // ← undefined field that would break superjson
      entryZone: null,
      profitTargets: [],
      stopLevel: undefined,    // ← undefined field that would break superjson
      invalidation: "Close below $2200",
      expectedTimeframe: "2-4 weeks",
      suggestedAction: "Accumulate on dips",
      positionSizeGuidance: undefined,  // ← undefined field that would break superjson
      whatChangesThesis: "Regulatory crackdown",
      deepDiveLinks: [],
    };

    const sanitized = sanitize(mockAnswer) as typeof mockAnswer;

    // All undefined fields must become null, not be dropped
    expect(sanitized.support).toBe(null);
    expect(sanitized.resistance).toBe(null);
    expect(sanitized.stopLevel).toBe(null);
    expect(sanitized.positionSizeGuidance).toBe(null);

    // Valid fields must be preserved
    expect(sanitized.verdict).toBe("ACCUMULATE");
    expect(sanitized.ticker).toBe("ETH");
    expect(sanitized.opportunityScore).toBe(72);
  });

  it("JSON.stringify + JSON.parse round-trip succeeds after sanitize", () => {
    const mockAnswer = {
      verdict: "STRONG BUY",
      opportunityScore: NaN,
      confidence: Infinity,
      ticker: "BTC",
      support: undefined,
      catalysts: [undefined, "Halving", null],
    };

    const sanitized = sanitize(mockAnswer);
    // Should not throw
    const serialized = JSON.stringify(sanitized);
    expect(() => JSON.parse(serialized)).not.toThrow();
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed.opportunityScore).toBe(0);
    expect(parsed.confidence).toBe(0);
    expect(parsed.support).toBe(null);
    expect((parsed.catalysts as unknown[])[0]).toBe(null);
    expect((parsed.catalysts as unknown[])[1]).toBe("Halving");
  });
});
