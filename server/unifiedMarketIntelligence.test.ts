/* ============================================================
   Unified Market Intelligence System — Tests
   Tests for MarketContextStrip and MarketSynthesisPanel logic.
   These tests cover:
   - SynthesisContext type coverage (all 11 context values)
   - getSynthesis output correctness per context + risk level
   - getVerdictLabel mapping
   - EXCLUDED_PATHS guard logic
   - Dominant probability calculation
   ============================================================ */
import { describe, it, expect } from "vitest";

// ── Replicated pure logic from MarketSynthesisPanel ─────────────────────────

type SynthesisContext =
  | "pressure"
  | "signals"
  | "signal-outlook"
  | "opportunities"
  | "dashboard"
  | "daily-brief"
  | "diagnostic"
  | "crypto"
  | "situation"
  | "portfolio"
  | "premarket";

function getSynthesis(
  context: SynthesisContext,
  riskLevel: string,
  regimeLabel: string,
  bullProb: number,
  crashProb: number,
  keyRisks: string[],
  pageInsight?: string,
): { headline: string; body: string; nextLabel: string; nextPath: string } {
  const isStressed = riskLevel === "high" || riskLevel === "critical";
  const isCalm = riskLevel === "low" || riskLevel === "moderate";
  const regime = regimeLabel;

  const syntheses: Record<SynthesisContext, { headline: string; body: string; nextLabel: string; nextPath: string }> = {
    pressure: {
      headline: isStressed
        ? `Elevated systemic pressure detected — ${regime}`
        : `Market stress is contained — ${regime}`,
      body: isStressed
        ? `The Pressure Index is signaling elevated systemic risk. ${pageInsight ? pageInsight + " " : ""}With ${crashProb}% crash probability and ${bullProb}% bull probability, the environment favors defensive positioning and smaller position sizes. Focus on quality and liquidity.`
        : `Current pressure readings are within manageable bounds. ${pageInsight ? pageInsight + " " : ""}With ${bullProb}% bull probability, the environment supports selective risk-taking. Look for high-conviction setups with strong catalyst support.`,
      nextLabel: "Find opportunities that fit this environment →",
      nextPath: "/app/opportunities",
    },
    signals: {
      headline: isStressed
        ? `Signals must be filtered through elevated market stress`
        : `Market conditions support signal follow-through`,
      body: isStressed
        ? `Current regime: ${regime}. ${pageInsight ? pageInsight + " " : ""}In elevated stress environments, signals with strong institutional backing and clear catalysts have higher follow-through rates. Avoid signals that rely on broad market momentum.`
        : `Current regime: ${regime}. ${pageInsight ? pageInsight + " " : ""}In this environment, momentum signals and breakout setups tend to perform well. Signals aligned with the dominant sector rotation have the highest probability of success.`,
      nextLabel: "See the full signal outlook →",
      nextPath: "/app/signal-outlook",
    },
    "signal-outlook": {
      headline: `${regime} — here is what the signal landscape means`,
      body: isStressed
        ? `Signal quality degrades in high-stress regimes. ${pageInsight ? pageInsight + " " : ""}Prioritize signals with multiple confirming factors: institutional flow, catalyst support, and technical structure alignment. Avoid chasing momentum without confirmation.`
        : `Signal quality is elevated in the current regime. ${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports trend-following signals. Look for sector leaders with clean technical structures and institutional accumulation.`,
      nextLabel: "Identify the best opportunities now →",
      nextPath: "/app/opportunities",
    },
    opportunities: {
      headline: `Opportunities must be evaluated in the context of ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In the current ${regime} environment, the highest-probability opportunities are in defensive sectors, volatility plays, and assets with strong institutional backing. Avoid high-beta momentum plays without strong catalyst support.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports growth and momentum opportunities. Focus on assets with strong earnings momentum, institutional accumulation, and clear technical breakout setups.`,
      nextLabel: "Ask FAULTLINE about a specific opportunity →",
      nextPath: "/app/discover",
    },
    dashboard: {
      headline: `Today's market: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}Bull probability: ${bullProb}%. Crash probability: ${crashProb}%. ${keyRisks.length > 0 ? `Primary risk: ${keyRisks[0]}.` : ""} ${isStressed ? "Maintain defensive positioning and monitor risk levels closely." : "Conditions support selective risk-taking with disciplined position sizing."}`,
      nextLabel: "See today's opportunities →",
      nextPath: "/app/opportunities",
    },
    "daily-brief": {
      headline: `Today's briefing in context: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The current ${regime} environment shapes how today's news and events should be interpreted. ${isStressed ? "In elevated stress, negative catalysts have amplified impact. Stay defensive." : `With ${bullProb}% bull probability, positive catalysts are more likely to drive sustained moves.`}`,
      nextLabel: "Ask FAULTLINE about today's market →",
      nextPath: "/app/discover",
    },
    diagnostic: {
      headline: `AI Diagnostic results in context: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The diagnostic output should be interpreted within the current ${regime} environment. ${isStressed ? `With ${crashProb}% crash probability, diagnostic warnings carry higher urgency. Act on critical signals.` : `The ${bullProb}% bull probability environment means diagnostic alerts are more likely to resolve positively.`}`,
      nextLabel: "See the full pressure analysis →",
      nextPath: "/app/pressure",
    },
    crypto: {
      headline: isStressed
        ? `Crypto faces elevated macro headwinds — ${regime}`
        : `Macro environment is supportive for crypto — ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In ${regime} environments, crypto typically experiences amplified volatility and correlation with risk assets. Bitcoin dominance tends to rise as capital rotates to quality. Monitor BTC as the leading indicator.`
        : `${pageInsight ? pageInsight + " " : ""}The current macro environment supports risk assets including crypto. ${bullProb}% bull probability suggests institutional appetite is present. Look for breakout setups in leading assets with strong on-chain fundamentals.`,
      nextLabel: "Ask FAULTLINE about crypto opportunities →",
      nextPath: "/app/discover",
    },
    situation: {
      headline: `Situational awareness: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The market is currently in a ${regime} environment with ${bullProb}% bull and ${crashProb}% crash probability. ${keyRisks.length > 0 ? `Key risk: ${keyRisks[0]}.` : ""} Use this context to frame every decision you make today.`,
      nextLabel: "Understand what this means →",
      nextPath: "/app/signal-outlook",
    },
    portfolio: {
      headline: isStressed
        ? `Portfolio risk elevated — ${regime} environment`
        : `Portfolio conditions favorable — ${regime} environment`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In the current ${regime} environment, review position sizes and ensure adequate hedging. ${crashProb}% crash probability warrants defensive adjustments. Prioritize capital preservation.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports holding quality positions. Review your portfolio for alignment with the current sector rotation and consider adding to highest-conviction positions.`,
      nextLabel: "Monitor your alerts →",
      nextPath: "/app/alerts",
    },
    premarket: {
      headline: isStressed
        ? `Premarket setups face elevated macro headwinds — ${regime}`
        : `Macro environment supports premarket momentum — ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In ${regime} conditions, premarket gaps have higher fade probability. Focus on setups with strong catalysts and institutional backing. Avoid chasing gap-ups without confirmation at the open.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports gap-and-go setups. Premarket movers with strong catalysts and high relative volume have elevated follow-through probability in this regime.`,
      nextLabel: "See today's opportunities →",
      nextPath: "/app/opportunities",
    },
  };

  return syntheses[context] ?? syntheses.dashboard;
}

// ── Replicated pure logic from MarketContextStrip ────────────────────────────

const EXCLUDED_PATHS = [
  "/app/dashboard",
  "/app/command-center",
];

function getVerdictLabel(riskLevel: string): string {
  const map: Record<string, string> = {
    low: "BULLISH",
    moderate: "SELECTIVE",
    elevated: "CAUTIOUS",
    high: "DEFENSIVE",
    critical: "CRISIS MODE",
  };
  return map[riskLevel] ?? "NEUTRAL";
}

function getDominantOutcome(probs: Array<{ label: string; value: number; color: string }>) {
  return probs.reduce((a, b) => a.value > b.value ? a : b);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("MarketSynthesisPanel — getSynthesis()", () => {
  const BASE = {
    riskLevel: "moderate",
    regimeLabel: "Late Cycle Expansion",
    bullProb: 55,
    crashProb: 12,
    keyRisks: ["Credit spread widening", "Fed hawkishness"],
  };

  it("returns correct headline for 'pressure' context in calm regime", () => {
    const result = getSynthesis("pressure", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Market stress is contained");
    expect(result.headline).toContain(BASE.regimeLabel);
    expect(result.nextPath).toBe("/app/opportunities");
  });

  it("returns stressed headline for 'pressure' context in critical regime", () => {
    const result = getSynthesis("pressure", "critical", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Elevated systemic pressure detected");
    expect(result.body).toContain("defensive positioning");
  });

  it("returns correct headline for 'signals' context in calm regime", () => {
    const result = getSynthesis("signals", "low", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toBe("Market conditions support signal follow-through");
    expect(result.nextPath).toBe("/app/signal-outlook");
  });

  it("returns stressed headline for 'signals' context in high regime", () => {
    const result = getSynthesis("signals", "high", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toBe("Signals must be filtered through elevated market stress");
    expect(result.body).toContain("institutional backing");
  });

  it("returns correct headline for 'signal-outlook' context", () => {
    const result = getSynthesis("signal-outlook", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain(BASE.regimeLabel);
    expect(result.headline).toContain("signal landscape");
    expect(result.nextPath).toBe("/app/opportunities");
  });

  it("returns correct headline for 'opportunities' context", () => {
    const result = getSynthesis("opportunities", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Opportunities must be evaluated");
    expect(result.headline).toContain(BASE.regimeLabel);
    expect(result.nextPath).toBe("/app/discover");
  });

  it("returns correct headline for 'dashboard' context with key risk", () => {
    const result = getSynthesis("dashboard", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Today's market");
    expect(result.body).toContain("Credit spread widening");
    expect(result.nextPath).toBe("/app/opportunities");
  });

  it("returns correct headline for 'daily-brief' context", () => {
    const result = getSynthesis("daily-brief", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Today's briefing in context");
    expect(result.headline).toContain(BASE.regimeLabel);
    expect(result.nextPath).toBe("/app/discover");
  });

  it("returns correct headline for 'diagnostic' context", () => {
    const result = getSynthesis("diagnostic", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("AI Diagnostic results in context");
    expect(result.nextPath).toBe("/app/pressure");
  });

  it("returns correct headline for 'crypto' context in calm regime", () => {
    const result = getSynthesis("crypto", "low", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Macro environment is supportive for crypto");
    expect(result.nextPath).toBe("/app/discover");
  });

  it("returns stressed headline for 'crypto' context in critical regime", () => {
    const result = getSynthesis("crypto", "critical", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Crypto faces elevated macro headwinds");
    expect(result.body).toContain("Bitcoin dominance");
  });

  it("returns correct headline for 'situation' context with key risk", () => {
    const result = getSynthesis("situation", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toBe(`Situational awareness: ${BASE.regimeLabel}`);
    expect(result.body).toContain("Key risk: Credit spread widening");
    expect(result.nextPath).toBe("/app/signal-outlook");
  });

  it("returns correct headline for 'portfolio' context in calm regime", () => {
    const result = getSynthesis("portfolio", "low", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Portfolio conditions favorable");
    expect(result.nextPath).toBe("/app/alerts");
  });

  it("returns stressed headline for 'portfolio' context in high regime", () => {
    const result = getSynthesis("portfolio", "high", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Portfolio risk elevated");
    expect(result.body).toContain("capital preservation");
  });

  it("returns correct headline for 'premarket' context in calm regime", () => {
    const result = getSynthesis("premarket", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Macro environment supports premarket momentum");
    expect(result.nextPath).toBe("/app/opportunities");
  });

  it("returns stressed headline for 'premarket' context in critical regime", () => {
    const result = getSynthesis("premarket", "critical", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.headline).toContain("Premarket setups face elevated macro headwinds");
    expect(result.body).toContain("fade probability");
  });

  it("injects pageInsight into body when provided", () => {
    const insight = "3 signals triggered today";
    const result = getSynthesis("signals", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks, insight);
    expect(result.body).toContain(insight);
  });

  it("body does not contain 'undefined' when pageInsight is omitted", () => {
    const result = getSynthesis("signals", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, BASE.keyRisks);
    expect(result.body).not.toContain("undefined");
  });

  it("situation context body is empty of key risk text when keyRisks is empty", () => {
    const result = getSynthesis("situation", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, []);
    expect(result.body).not.toContain("Key risk:");
  });

  it("dashboard body includes primary risk when keyRisks is non-empty", () => {
    const result = getSynthesis("dashboard", "moderate", BASE.regimeLabel, BASE.bullProb, BASE.crashProb, ["Liquidity crunch"]);
    expect(result.body).toContain("Primary risk: Liquidity crunch");
  });

  it("all 11 contexts return an object with headline, body, nextLabel, nextPath", () => {
    const contexts: SynthesisContext[] = [
      "pressure", "signals", "signal-outlook", "opportunities", "dashboard",
      "daily-brief", "diagnostic", "crypto", "situation", "portfolio", "premarket",
    ];
    for (const ctx of contexts) {
      const result = getSynthesis(ctx, "moderate", "Test Regime", 50, 15, []);
      expect(result).toHaveProperty("headline");
      expect(result).toHaveProperty("body");
      expect(result).toHaveProperty("nextLabel");
      expect(result).toHaveProperty("nextPath");
      expect(typeof result.headline).toBe("string");
      expect(result.headline.length).toBeGreaterThan(0);
    }
  });
});

describe("MarketContextStrip — getVerdictLabel()", () => {
  it("maps 'low' to BULLISH", () => {
    expect(getVerdictLabel("low")).toBe("BULLISH");
  });

  it("maps 'moderate' to SELECTIVE", () => {
    expect(getVerdictLabel("moderate")).toBe("SELECTIVE");
  });

  it("maps 'elevated' to CAUTIOUS", () => {
    expect(getVerdictLabel("elevated")).toBe("CAUTIOUS");
  });

  it("maps 'high' to DEFENSIVE", () => {
    expect(getVerdictLabel("high")).toBe("DEFENSIVE");
  });

  it("maps 'critical' to CRISIS MODE", () => {
    expect(getVerdictLabel("critical")).toBe("CRISIS MODE");
  });

  it("returns NEUTRAL for unknown risk level", () => {
    expect(getVerdictLabel("unknown")).toBe("NEUTRAL");
    expect(getVerdictLabel("")).toBe("NEUTRAL");
  });
});

describe("MarketContextStrip — EXCLUDED_PATHS", () => {
  it("excludes /app/dashboard", () => {
    expect(EXCLUDED_PATHS.some(p => "/app/dashboard" === p || "/app/dashboard".startsWith(p + "/"))).toBe(true);
  });

  it("excludes /app/command-center", () => {
    expect(EXCLUDED_PATHS.some(p => "/app/command-center" === p || "/app/command-center".startsWith(p + "/"))).toBe(true);
  });

  it("does NOT exclude /app/signals", () => {
    expect(EXCLUDED_PATHS.some(p => "/app/signals" === p || "/app/signals".startsWith(p + "/"))).toBe(false);
  });

  it("does NOT exclude /app/pressure", () => {
    expect(EXCLUDED_PATHS.some(p => "/app/pressure" === p || "/app/pressure".startsWith(p + "/"))).toBe(false);
  });

  it("does NOT exclude /app/opportunities", () => {
    expect(EXCLUDED_PATHS.some(p => "/app/opportunities" === p || "/app/opportunities".startsWith(p + "/"))).toBe(false);
  });

  it("does NOT exclude /app/discover", () => {
    expect(EXCLUDED_PATHS.some(p => "/app/discover" === p || "/app/discover".startsWith(p + "/"))).toBe(false);
  });
});

describe("MarketContextStrip — getDominantOutcome()", () => {
  const probs = [
    { label: "BULL", value: 55, color: "#10B981" },
    { label: "SOFT LAND", value: 20, color: "#00D4FF" },
    { label: "STAGFLATION", value: 10, color: "#F59E0B" },
    { label: "RECESSION", value: 8, color: "#EF4444" },
    { label: "CRASH", value: 7, color: "#DC2626" },
  ];

  it("returns the outcome with the highest probability", () => {
    const dominant = getDominantOutcome(probs);
    expect(dominant.label).toBe("BULL");
    expect(dominant.value).toBe(55);
  });

  it("returns CRASH when crash probability is highest", () => {
    const stressedProbs = [
      { label: "BULL", value: 10, color: "#10B981" },
      { label: "SOFT LAND", value: 15, color: "#00D4FF" },
      { label: "STAGFLATION", value: 20, color: "#F59E0B" },
      { label: "RECESSION", value: 25, color: "#EF4444" },
      { label: "CRASH", value: 30, color: "#DC2626" },
    ];
    const dominant = getDominantOutcome(stressedProbs);
    expect(dominant.label).toBe("CRASH");
    expect(dominant.value).toBe(30);
  });

  it("returns STAGFLATION when stagflation probability is highest", () => {
    const stagProbs = [
      { label: "BULL", value: 15, color: "#10B981" },
      { label: "SOFT LAND", value: 10, color: "#00D4FF" },
      { label: "STAGFLATION", value: 45, color: "#F59E0B" },
      { label: "RECESSION", value: 20, color: "#EF4444" },
      { label: "CRASH", value: 10, color: "#DC2626" },
    ];
    const dominant = getDominantOutcome(stagProbs);
    expect(dominant.label).toBe("STAGFLATION");
  });
});

describe("Unified Market Intelligence System — integration coverage", () => {
  it("all SynthesisContext values are covered by getSynthesis", () => {
    const allContexts: SynthesisContext[] = [
      "pressure", "signals", "signal-outlook", "opportunities", "dashboard",
      "daily-brief", "diagnostic", "crypto", "situation", "portfolio", "premarket",
    ];
    expect(allContexts).toHaveLength(11);
    for (const ctx of allContexts) {
      const result = getSynthesis(ctx, "elevated", "Mixed Regime", 40, 25, ["Sovereign debt stress"]);
      expect(result.nextPath).toMatch(/^\/app\//);
      expect(result.nextLabel.length).toBeGreaterThan(5);
    }
  });

  it("stressed contexts use defensive language", () => {
    const stressedContexts: SynthesisContext[] = ["pressure", "signals", "crypto", "portfolio", "premarket"];
    for (const ctx of stressedContexts) {
      const result = getSynthesis(ctx, "critical", "Crisis Regime", 10, 65, ["Systemic failure risk"]);
      // Headline should reflect stress
      const stressWords = ["elevated", "headwinds", "risk", "stress", "filtered"];
      const hasStressWord = stressWords.some(w => result.headline.toLowerCase().includes(w));
      expect(hasStressWord, `Context '${ctx}' headline should contain stress language`).toBe(true);
    }
  });

  it("calm contexts use opportunity language", () => {
    const calmContexts: SynthesisContext[] = ["pressure", "signals", "crypto", "portfolio", "premarket"];
    for (const ctx of calmContexts) {
      const result = getSynthesis(ctx, "low", "Bull Market", 75, 5, []);
      const positiveWords = ["supportive", "support", "favorable", "momentum", "contained"];
      const hasPositiveWord = positiveWords.some(w => result.headline.toLowerCase().includes(w) || result.body.toLowerCase().includes(w));
      expect(hasPositiveWord, `Context '${ctx}' should contain positive language in calm regime`).toBe(true);
    }
  });

  it("nextPath values are valid app routes", () => {
    const validRoutes = ["/app/opportunities", "/app/signal-outlook", "/app/discover", "/app/pressure", "/app/alerts"];
    const allContexts: SynthesisContext[] = [
      "pressure", "signals", "signal-outlook", "opportunities", "dashboard",
      "daily-brief", "diagnostic", "crypto", "situation", "portfolio", "premarket",
    ];
    for (const ctx of allContexts) {
      const result = getSynthesis(ctx, "moderate", "Test Regime", 50, 15, []);
      expect(validRoutes).toContain(result.nextPath);
    }
  });
});
