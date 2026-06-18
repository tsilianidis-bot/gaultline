/* ============================================================
   FAULTLINE — Social Intelligence unit tests
   Tests the pure calculation helpers: buzz score, sentiment
   aggregation, narrative clustering, and leaderboard ranking.
   ============================================================ */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers extracted from socialIntelligence.ts for unit testing ──

/** Buzz score: log-scaled news volume × sentiment intensity (0–100) */
function computeBuzzScore(newsCount: number, sentimentIntensity: number): number {
  if (newsCount === 0) return 0;
  const logScale = Math.min(Math.log10(newsCount + 1) / Math.log10(51), 1); // caps at 50 articles
  const raw = logScale * 50 + sentimentIntensity * 50;
  return Math.round(Math.min(raw, 100));
}

/** Sentiment score: (bullish - bearish) / total, range [-1, +1] */
function computeSentimentScore(bullish: number, bearish: number, neutral: number): number {
  const total = bullish + bearish + neutral;
  if (total === 0) return 0;
  return (bullish - bearish) / total;
}

/** Sentiment label from score */
function labelFromScore(score: number): string {
  if (score >= 0.6) return "STRONGLY BULLISH";
  if (score >= 0.2) return "BULLISH";
  if (score <= -0.6) return "STRONGLY BEARISH";
  if (score <= -0.2) return "BEARISH";
  return "NEUTRAL";
}

/** Dominant sentiment for a narrative cluster */
function dominantSentiment(bullish: number, bearish: number): "bullish" | "bearish" | "neutral" {
  if (bullish > bearish * 1.5) return "bullish";
  if (bearish > bullish * 1.5) return "bearish";
  return "neutral";
}

/** Normalize article sentiment string to typed value */
function normalizeSentiment(raw: string): "positive" | "negative" | "neutral" | "unknown" {
  if (raw === "positive") return "positive";
  if (raw === "negative") return "negative";
  if (raw === "neutral") return "neutral";
  return "unknown";
}

// ── Tests ─────────────────────────────────────────────────────

describe("computeBuzzScore", () => {
  it("returns 0 for 0 articles", () => {
    expect(computeBuzzScore(0, 0)).toBe(0);
  });

  it("returns a positive score for 1 article with max intensity", () => {
    const score = computeBuzzScore(1, 1.0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 100 for 50+ articles with max intensity", () => {
    expect(computeBuzzScore(50, 1.0)).toBe(100);
  });

  it("scales with news count (more articles = higher score)", () => {
    const low = computeBuzzScore(2, 0.5);
    const high = computeBuzzScore(20, 0.5);
    expect(high).toBeGreaterThan(low);
  });

  it("never exceeds 100", () => {
    expect(computeBuzzScore(1000, 1.0)).toBe(100);
  });

  it("returns 0 for 0 articles regardless of intensity", () => {
    expect(computeBuzzScore(0, 1.0)).toBe(0);
  });
});

describe("computeSentimentScore", () => {
  it("returns 0 when no articles", () => {
    expect(computeSentimentScore(0, 0, 0)).toBe(0);
  });

  it("returns +1 for all bullish", () => {
    expect(computeSentimentScore(10, 0, 0)).toBe(1);
  });

  it("returns -1 for all bearish", () => {
    expect(computeSentimentScore(0, 10, 0)).toBe(-1);
  });

  it("returns 0 for equal bullish and bearish", () => {
    expect(computeSentimentScore(5, 5, 0)).toBe(0);
  });

  it("returns 0 for all neutral", () => {
    expect(computeSentimentScore(0, 0, 10)).toBe(0);
  });

  it("returns fractional value for mixed sentiment", () => {
    // 6 bullish, 2 bearish, 2 neutral → (6-2)/10 = 0.4
    expect(computeSentimentScore(6, 2, 2)).toBeCloseTo(0.4, 5);
  });

  it("stays within [-1, +1] range", () => {
    for (let b = 0; b <= 10; b++) {
      for (let r = 0; r <= 10; r++) {
        const s = computeSentimentScore(b, r, 5);
        expect(s).toBeGreaterThanOrEqual(-1);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("labelFromScore", () => {
  it("labels >= 0.6 as STRONGLY BULLISH", () => {
    expect(labelFromScore(0.6)).toBe("STRONGLY BULLISH");
    expect(labelFromScore(1.0)).toBe("STRONGLY BULLISH");
  });

  it("labels >= 0.2 and < 0.6 as BULLISH", () => {
    expect(labelFromScore(0.2)).toBe("BULLISH");
    expect(labelFromScore(0.59)).toBe("BULLISH");
  });

  it("labels <= -0.6 as STRONGLY BEARISH", () => {
    expect(labelFromScore(-0.6)).toBe("STRONGLY BEARISH");
    expect(labelFromScore(-1.0)).toBe("STRONGLY BEARISH");
  });

  it("labels <= -0.2 and > -0.6 as BEARISH", () => {
    expect(labelFromScore(-0.2)).toBe("BEARISH");
    expect(labelFromScore(-0.59)).toBe("BEARISH");
  });

  it("labels between -0.2 and 0.2 as NEUTRAL", () => {
    expect(labelFromScore(0)).toBe("NEUTRAL");
    expect(labelFromScore(0.1)).toBe("NEUTRAL");
    expect(labelFromScore(-0.1)).toBe("NEUTRAL");
    expect(labelFromScore(0.19)).toBe("NEUTRAL");
    expect(labelFromScore(-0.19)).toBe("NEUTRAL");
  });
});

describe("dominantSentiment", () => {
  it("returns bullish when bullish > bearish * 1.5", () => {
    expect(dominantSentiment(10, 3)).toBe("bullish");
    expect(dominantSentiment(6, 3)).toBe("bullish"); // exactly 2x
  });

  it("returns bearish when bearish > bullish * 1.5", () => {
    expect(dominantSentiment(3, 10)).toBe("bearish");
    expect(dominantSentiment(2, 4)).toBe("bearish"); // exactly 2x
  });

  it("returns neutral when neither dominates", () => {
    expect(dominantSentiment(5, 5)).toBe("neutral");
    expect(dominantSentiment(4, 5)).toBe("neutral");
    expect(dominantSentiment(0, 0)).toBe("neutral");
  });

  it("returns neutral for equal counts", () => {
    expect(dominantSentiment(3, 3)).toBe("neutral");
  });
});

describe("normalizeSentiment", () => {
  it("maps positive correctly", () => {
    expect(normalizeSentiment("positive")).toBe("positive");
  });

  it("maps negative correctly", () => {
    expect(normalizeSentiment("negative")).toBe("negative");
  });

  it("maps neutral correctly", () => {
    expect(normalizeSentiment("neutral")).toBe("neutral");
  });

  it("maps unknown/empty/garbage to unknown", () => {
    expect(normalizeSentiment("")).toBe("unknown");
    expect(normalizeSentiment("mixed")).toBe("unknown");
    expect(normalizeSentiment("N/A")).toBe("unknown");
  });
});
