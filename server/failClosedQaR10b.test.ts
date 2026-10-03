import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

// QA r10 (gate r9 on 464694c, blockers B1–B4, B6 and the confirm list):
// withheld claim values never leave the server on any public route; X posts,
// Trade Preflight, Signal Outlook and ASHA prompts carry no invented
// probability. Display / prompt / response-boundary only; no scoring change.

const llm = vi.hoisted(() => ({ calls: [] as any[], reply: null as string | null, fail: false }));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (req: any) => {
    llm.calls.push(req);
    if (llm.fail) throw new Error("llm offline (test)");
    return { choices: [{ message: { content: llm.reply ?? "" } }] };
  }),
}));
vi.mock("./ownerSimulation", () => ({ scanOpportunities: vi.fn().mockResolvedValue([]) }));

import { assembleCanonicalMarketState, type CanonicalMarketStateSource } from "./marketStateService";
import { buildCanonicalProbabilityContract, overlayAssembledSeismographOutput, overlayUnifiedSeismographIntelligence, withholdUndisplayedClaimValues } from "./probabilityContract";
import { buildCanonicalIntelligenceState, toClientCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { generateXPosts, withoutPostProbabilities } from "./xPostGenerator";
import { runTradePreflightSimulation } from "./tradePreflight";
import { isProbabilityPercentClaim, stripProbabilityPercentClaims } from "./stripProbabilityClaims";
import { computeQuickInterpretation } from "./fmos/engines/aiInterpretation";
import type { FaultlinePressureOutput } from "./pressure/engine";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const canonicalOct1 = JSON.parse(read("server/__fixtures__/prod-2026-10-01/canonical-current.json"));
const contract = buildCanonicalProbabilityContract({
  stateId: canonicalOct1.stateId, generatedAt: canonicalOct1.generatedAt, modelVersion: canonicalOct1.modelVersion,
  scenarioOutputs: canonicalOct1.scenarioOutputs, staleInputs: [], unavailableInputs: [], fallbackInputs: [], coherenceStatus: "COHERENT",
});
const claimValues = (node: unknown): string[] => JSON.stringify(node).match(/"value":[^,}\]]+/g) ?? [];
const nonNullClaimValues = (node: unknown) => {
  const out: unknown[] = [];
  const walk = (n: any) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    if (typeof n.claimId === "string" && "value" in n && n.value !== null) out.push(`${n.claimId}=${n.value}`);
    Object.values(n).forEach(walk);
  };
  walk(node);
  return out;
};
const PROB_PCT = /\b(?:probabilit(?:y|ies)|odds|chances?|likelihood)\b[^.\n]{0,40}\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%[^.\n]{0,40}\b(?:probabilit(?:y|ies)|odds|chances?|bull|bear|crash|recession)\b|\b(?:bull|bear|crash|recession)\b[^.\n]{0,30}\d+(?:\.\d+)?\s*%/i;

function source(overrides: Partial<CanonicalMarketStateSource> = {}): CanonicalMarketStateSource {
  return {
    currentScore: 68,
    currentRegime: "Elevated Risk",
    currentStressLevel: "High",
    currentDirection: "Deteriorating",
    currentPercentile: 82,
    dataFreshness: "live",
    lastUpdated: "2026-07-23T12:00:00.000Z",
    providerProvenance: {
      fred: {
        status: "live",
        detail: "FRED macro and credit observations (latest published releases) contributed through the pressure engine.",
        asOf: Date.parse("2026-07-23T12:00:00.000Z"),
      },
    },
    todayStory: "Credit and liquidity conditions are tightening together.",
    keyDevelopments: ["Credit spreads widened"],
    whyThisScore: "Three high-weight evidence families are stressed.",
    whyThisRegime: "Pressure is above the historical high-risk threshold.",
    probabilities: {
      bull: 18,
      neutral: 29,
      bear: 53,
      confidence: 78,
      primaryDriver: "Credit stress",
      evidenceBasis: "Four normalized evidence families",
      historicalBasis: "317 monthly observations",
    },
    evidenceFamilies: [{
      name: "Credit",
      signal: "stressed",
      strength: 82,
      currentValue: "Widening",
      historicalContext: "Above the 80th percentile",
      trend: "deteriorating",
      whyItMatters: "Credit leads broader risk appetite.",
    }],
    evidenceConsensus: "strong",
    topAnalog: {
      period: "2018-12",
      label: "Q4 2018 selloff",
      similarity: 84,
      score: 67,
      regime: "High Risk",
      description: "Comparable tightening episode",
      outcome3m: "Fed pivot",
      outcome6m: "Recovery",
      outcome12m: "Expansion",
      avgReturn3m: 9,
      avgReturn6m: 14,
      avgReturn12m: 22,
      durationMonths: 3,
      peakPressure: 71,
      resolution: "Policy conditions eased",
    },
    analogSummary: "The closest episodes resolved after financial conditions eased.",
    transitionProbabilities: {
      remainInRegime: 52,
      transitionToElevated: 8,
      transitionToLow: 12,
      transitionToCrisis: 28,
      confidence: 74,
      historicalBasis: "Comparable high-risk regimes",
      currentEvidence: ["Credit deterioration"],
    },
    evolution: {
      sevenDayTrend: "Pressure rising",
      thirtyDayTrend: "Deteriorating",
      ninetyDayTrend: "Building",
      yearTrend: "Above average",
      accelerating: true,
      buildingPressure: true,
      whatChanged: ["Credit weakened"],
      whatToWatch: ["Funding spreads"],
      invalidationConditions: ["Credit spreads normalize"],
      sparkline90d: [],
    },
    memory: {
      observationCount: 317,
      datasetSpan: "2000-present",
      currentStreakDescription: "Three months above elevated threshold",
      longestStreak: 11,
      regimeHistory: [],
      keyThresholdsCrossed: [],
      lastMajorShift: "2026-05",
      historicalStats: {
        avgPressure: 46,
        maxPressure: 92,
        minPressure: 12,
        criticalMonths: 8,
        highRiskMonths: 31,
        elevatedMonths: 78,
        moderateMonths: 124,
        lowMonths: 76,
      },
    },
    regimeProbabilities5way: {
      bull: 10,
      softLanding: 24,
      stagflation: 31,
      recession: 27,
      crash: 8,
    },
    developingConditions: [{
      title: "Credit transmission",
      description: "Funding pressure is spreading.",
      engines: ["Credit"],
      evidence: "Spreads widened for three weeks.",
      severity: "High",
      durationDescription: "Building for 21 days",
      trend: "building",
      expectedImpact: "Lower risk tolerance",
    }],
    marketNarrative: {
      whatIsHappening: "Cross-asset pressure is elevated.",
      whyIsItHappening: "Liquidity and credit are tightening.",
      whatHasChanged: "Credit weakened this month.",
      whatIsBuildingBeneathSurface: "Funding stress is broadening.",
      highestProbabilityPath: "pressure remains elevated until liquidity improves.",
      whatWouldInvalidate: "A sustained normalization in credit and liquidity.",
    },
    activePatterns: [{
      name: "Credit-led tightening",
      description: "Credit is weakening ahead of equities.",
      confidence: 79,
      daysActive: 21,
      historicalFrequency: "14 prior episodes",
      outcomeDistribution: { bullish: 15, sideways: 35, correction: 50 },
      avgReturn1m: -2,
      avgReturn3m: -4,
      avgReturn6m: 2,
      invalidationConditions: "Spreads reverse below the 60th percentile",
      analogs: ["2018-12"],
    }],
    ...overrides,
  };
}

describe("QA r10 B1 — public routes withhold non-AVAILABLE claim values", () => {
  it("fixture contract carries the internal values (precondition)", () => {
    expect(nonNullClaimValues(contract).length).toBeGreaterThan(0);
    expect(JSON.stringify(contract)).toMatch(/"value":43\b/);
  });

  it("marketState.current: outlook.probabilityContract has no non-AVAILABLE value", () => {
    const state = assembleCanonicalMarketState(source(), { generatedAt: "2026-07-23T12:01:00.000Z", cacheStatus: "refreshed", cacheAgeMs: 0, probabilityContract: contract } as any);
    const pc = state.outlook.probabilityContract;
    expect(pc?.stateId).toBe(canonicalOct1.stateId);
    expect(pc?.scenarioSet.display.text).toBe(contract.scenarioSet.display.text);
    expect(nonNullClaimValues(pc)).toEqual([]);
    expect(JSON.stringify(pc)).not.toMatch(/"value":(43|14)\b/);
    // Internal contract untouched.
    expect(JSON.stringify(contract)).toMatch(/"value":43\b/);
  });

  it("seismograph.getAssembledOutput / getUnifiedIntelligence: returned contract has no non-AVAILABLE value", () => {
    const assembled = overlayAssembledSeismographOutput({ probabilities: { bull: 43, neutral: 43, bear: 14 }, forDashboard: { probabilities: { bull: 43, neutral: 43, bear: 14 } } }, contract);
    const unified = overlayUnifiedSeismographIntelligence({ probabilities: { bull: 33, neutral: 50, bear: 17 } }, contract);
    for (const out of [assembled, unified]) {
      expect(out.probabilityContract?.stateId).toBe(canonicalOct1.stateId);
      expect(nonNullClaimValues(out.probabilityContract)).toEqual([]);
      expect(JSON.stringify(out)).not.toMatch(/"value":(33|43|50|14|17|0\.36)/);
    }
    expect(overlayUnifiedSeismographIntelligence({}, null).probabilityContract).toBeNull();
  });

  it("an AVAILABLE claim keeps its value (withholding is display-state based)", () => {
    const node = { a: { claimId: "x", value: 12, display: { state: "AVAILABLE" } }, b: { claimId: "y", value: 33, display: { state: "UNCALIBRATED" } } };
    expect(withholdUndisplayedClaimValues(node)).toEqual({ a: { claimId: "x", value: 12, display: { state: "AVAILABLE" } }, b: { claimId: "y", value: null, display: { state: "UNCALIBRATED" } } });
  });

  it("marketState.evidenceCurrent: client projection, no 'Scenario component bull is …' claim", () => {
    const state = buildCanonicalIntelligenceState(canonicalOct1);
    const publicPacket = buildCanonicalEvidencePacket(toPublicCanonicalIntelligenceState(state));
    const clientPacket = buildCanonicalEvidencePacket(toClientCanonicalIntelligenceState(state));
    expect(JSON.stringify(publicPacket)).toContain("Scenario component bull is 43.");
    expect(JSON.stringify(clientPacket)).not.toMatch(/Scenario component|scenario_score/);
    const router = read("server/routers/marketState.ts");
    expect(router).toContain("return state ? buildCanonicalEvidencePacket(toClientCanonicalIntelligenceState(state)) : null;");
    expect(router).not.toContain("buildCanonicalEvidencePacket(toPublicCanonicalIntelligenceState(state))");
    expect(read("server/marketStateService.ts")).toContain("probabilityContract: withholdUndisplayedClaimValues(contract),");
  });
});

const pressure = {
  overallPressure: 62, regime: "Late-Cycle Stress", level: "elevated", dataSource: "live",
  vectors: [
    { id: "credit-contagion", label: "Credit Contagion", score: 70, level: "elevated", driver: "HY spreads widening" },
    { id: "liquidity-stress", label: "Liquidity Stress", score: 64, level: "elevated", driver: "Reserves draining" },
  ],
  alerts: [],
  topAnalog: { label: "2007 Q3", similarity: 71, description: "Credit stress before equities" },
} as unknown as FaultlinePressureOutput;

describe("QA r10 B2 — X posts carry no invented bull / crash probability", () => {
  beforeEach(() => { llm.calls.length = 0; llm.fail = false; llm.reply = null; });

  it("prompt has no P×0.6 / 100−P numbers and no 'always include … probability' instruction", async () => {
    llm.reply = JSON.stringify({ short: "s getfaultline.live", thread: "1/5 a", founder: "f", institutional: "i", breaking: "b" });
    await generateXPosts({ postType: "premarket", pressure });
    const prompt = llm.calls[0].messages.map((m: any) => m.content).join("\n");
    expect(prompt).not.toMatch(/BULL PROBABILITY|CRASH\/RISK-OFF PROBABILITY/);
    expect(prompt).not.toContain(`~${Math.round(pressure.overallPressure * 0.6)}%`);
    expect(prompt).not.toContain(`~${Math.round(100 - pressure.overallPressure)}%`);
    expect(prompt).not.toMatch(/bull probability, crash\/risk-off probability|bull\/crash probabilities|vectors and probabilities/);
    expect(prompt).toContain("FAULTLINE does not offer a crash probability, does not offer a recession probability");
    expect(prompt).toContain("NEVER state a probability");
    const src = read("server/xPostGenerator.ts");
    expect(src).not.toMatch(/overallPressure \* 0\.6|100 - pressure\.overallPressure/);
  });

  it("generated posts contain no probability % even when the model writes one; thread lines survive", async () => {
    llm.reply = JSON.stringify({
      short: "Credit stress is building. Crash probability is 37%. getfaultline.live",
      thread: "1/5 Pressure is 62/100.\n2/5 Breadth is narrowing.\n3/5 Bull probability: 38%.\n4/5 Watch HY spreads.\n5/5 Risk ELEVATED. There is a 40% chance of a correction. getfaultline.live",
      founder: "I see a 60% likelihood of risk-off. Upside of 15% is not the base case here. getfaultline.live",
      institutional: "Bear scenario at 55%. Liquidity stress at 64/100. getfaultline.live",
      breaking: "⚠️ FAULTLINE ALERT: recession odds 45%. Spreads gapped wider. getfaultline.live",
    });
    const posts = await generateXPosts({ postType: "closing", pressure });
    for (const [key, text] of Object.entries(posts)) {
      expect(PROB_PCT.test(text), `${key}: ${text}`).toBe(false);
      expect(text, key).toContain("getfaultline.live");
    }
    expect(posts.thread.split("\n").map(l => l.slice(0, 3))).toEqual(["1/5", "2/5", "4/5", "5/5"]);
    expect(posts.founder).toContain("Upside of 15% is not the base case here.");
    expect(posts.institutional).toBe("Liquidity stress at 64/100. getfaultline.live");
    expect(withoutPostProbabilities({ short: "Odds of 70% favor bulls.", thread: "", founder: "", institutional: "", breaking: "" }).short).toBe("");
  });
});

describe("QA r10 B3 — Trade Preflight setup / adverse are /100 scores, not probabilities", () => {
  beforeEach(() => { llm.calls.length = 0; llm.reply = null; });
  const tpPressure = {
    overallPressure: 45,
    vectors: ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble", "fed-policy", "recession-risk"].map(id => ({ id, score: 40, label: id, riskLevel: "moderate" })),
    domains: [], regime: { label: "Transition", description: "Mixed." }, probability: { bullProbability: 50, crashProbability: 28 }, narrative: { headline: "h", summary: "s" },
  };

  it("LLM prompt and fallback narrative say score /100 and never 'probability' for them", async () => {
    llm.fail = true;
    const result = await runTradePreflightSimulation({ moveType: "add_risk", timeframe: "today" } as any, tpPressure as any);
    llm.fail = false;
    const prompt = llm.calls.flatMap((c: any) => c.messages.map((m: any) => m.content)).join("\n");
    expect(prompt).toContain(`- Favorable Setup score: ${result.favorableSetupProbability}/100 (heuristic score, not a likelihood)`);
    expect(prompt).toContain(`- Adverse Pressure score: ${result.adversePressureProbability}/100`);
    expect(prompt).not.toMatch(/Favorable Setup Probability|Adverse Pressure Probability/);
    const all = JSON.stringify(result);
    expect(all).toContain(`The favorable setup score is ${result.favorableSetupProbability}/100 and the adverse pressure score is ${result.adversePressureProbability}/100`);
    expect(all).not.toMatch(/[Ff]avorable setup probability|adverse pressure probability/);
  });

  it("TradePreflight.tsx renders them as '/100' score bars, never as %", () => {
    const page = read("client/src/pages/TradePreflight.tsx");
    expect(page).toContain('<ScoreBar value={result.favorableSetupProbability} color="#00FF88" label="Favorable Setup score" />');
    expect(page).toContain('<ScoreBar value={result.adversePressureProbability} color="#FF2D55" label="Adverse Pressure score" />');
    expect(page).toContain("color }}>{value}/100</span>");
    expect(page).not.toMatch(/<ProbBar|\{value\}%<\/span>/);
  });
});

describe("QA r10 B4 / B6 — Signal Outlook and ASHA prompts", () => {
  it("B4: no 'Transition Probability (stay in regime): N%' line", () => {
    const src = read("server/signalOutlook.ts");
    expect(src).not.toMatch(/Transition Probability \(stay in regime\)|transitionProbabilities\.remainInRegime\}%/);
    expect(src).toContain("- Regime transition: not offered as a probability (the transition claim is unavailable)");
  });
  it("B6: smartDiscovery prompts use the 0–100 Pressure Index and 'unavailable', no /10 and no default 5", () => {
    const src = read("server/routers/smartDiscovery.ts");
    expect(src).not.toMatch(/Pressure Score: \$\{pressureScore\}\/10|overallPressure \/ 10\) : 5/);
    expect(src.match(/\(Pressure Index: \$\{pressureIndex === null \? "unavailable" : `\$\{pressureIndex\}\/100`\}\)/g)).toHaveLength(2);
    expect(src.match(/const pressureIndex = pressureData && Number\.isFinite\(pressureData\.overallPressure\) \? pressureData\.overallPressure : null;/g)).toHaveLength(2);
    // Color bands unchanged (<=30 green, <=60 yellow), missing → yellow as before.
    expect(src.match(/pressureIndex === null \? "yellow" : pressureIndex <= 30 \? "green" : pressureIndex <= 60 \? "yellow" : "red"/g)).toHaveLength(2);
  });
});

describe("QA r10 — uncalibrated % strings (FMOS, adapters, daily brief)", () => {
  const probability = { bull: 43, neutral: 43, bear: 14, primaryDriver: "Credit", bullEvidence: [], bearEvidence: [] } as any;
  it("FMOS quick interpretation headline and prompt carry no bull / bear %", () => {
    const quick = computeQuickInterpretation({ overallPressure: 33 } as any, { currentRegime: "MODERATE RISK" } as any, probability, { verdict: "HOLD", primaryReason: "r", positionSizing: "p" } as any);
    expect(quick.headline).toBe("MODERATE RISK — HOLD");
    const src = read("server/fmos/engines/aiInterpretation.ts");
    expect(src).not.toMatch(/Bull \$\{probability\.bull\}%|transitionProbability30d\}%|\$\{probability\.bull\}% bull/);
    expect(src).toContain("**Scenario weights:** uncalibrated (not offered as probabilities)");
  });
  it("FMOS decision reasons and the evidence adapter carry no bull / bear %", () => {
    const decision = read("server/fmos/engines/decision.ts");
    expect(decision).not.toMatch(/\$\{probability\.bull\}% bull/);
    const adapters = read("server/seismographAdapters.ts");
    expect(adapters).not.toMatch(/\$\{output\.probability\.bull\}% bull/);
    expect(adapters).toContain("humanReadable: `Scenario weights uncalibrated (not offered as probabilities) — ${output.probability.primaryDriver}`,");
  });
  it("daily brief change row is a bull scenario weight in pts, not 'Bull probability … %'", () => {
    const src = read("server/routers/dailyBrief.ts");
    expect(src).not.toMatch(/Bull probability \$\{bullDelta|bullDelta\.toFixed\(0\)\}%/);
    expect(src).toContain('label: `Bull scenario weight ${bullDelta > 0 ? "rose" : "fell"} (uncalibrated)`,');
    expect(src).toContain('delta: `${bullDelta > 0 ? "+" : ""}${bullDelta.toFixed(0)} pts`,');
  });
});

describe("QA r10 — stripProbabilityPercentClaims word branch and ordinary sizes", () => {
  it("likelihood / likely sentences with a % are stripped (word branch only)", () => {
    expect(isProbabilityPercentClaim("Rates are 70% likely to fall.")).toBe(true);
    expect(isProbabilityPercentClaim("The likelihood of a cut is 65%.")).toBe(true);
    expect(stripProbabilityPercentClaims("Spreads widened. Rates are 70% likely to fall.")).toBe("Spreads widened.");
  });
  it("ordinary move sizes are kept", () => {
    for (const s of ["A drawdown of 10% is typical.", "Upside of 15% to the prior high.", "Downside to support is 8%.", "CPI rose 3.2% year on year."]) {
      expect(isProbabilityPercentClaim(s), s).toBe(false);
      expect(stripProbabilityPercentClaims(s)).toBe(s);
    }
    expect(isProbabilityPercentClaim("Crash risk is 18%.")).toBe(true);
    expect(isProbabilityPercentClaim("The bear scenario sits at 36%.")).toBe(true);
  });
});

describe("QA r10 — confirm list copy in #60-owned files", () => {
  it("MarketPreflight, SeismographIntelligence, tradePreflight threats, OnboardingFlow example", () => {
    expect(read("client/src/components/MarketPreflight.tsx")).toContain('`Recession risk: ${engineProbabilityText(output, "recessionProbability")} (no governed recession model)`,');
    const seis = read("client/src/pages/SeismographIntelligence.tsx");
    expect(seis).not.toMatch(/(?:[Rr]ecession|[Cc]rash|[Bb]ull) probability \$\{pctOrNotOffered/);
    expect(seis).toContain("FAULTLINE does not offer a crash probability and does not offer a recession probability: no governed model produces one.");
    expect(read("server/tradePreflight.ts")).not.toContain("Recession probability increase");
    expect(read("client/src/components/OnboardingFlow.tsx")).toContain('{ label: "Pressure", value: "68/100", sub: "Example value, not live", color: "#FF9500" },');
  });
});

describe("QA r10 — MarketCrashProbability2026 body in r16 disclaimer form", () => {
  it(":30 says 'not a crash probability', not 'calibrated estimate of the probability'", () => {
    const page = read("client/src/pages/seo/MarketCrashProbability2026.tsx");
    expect(page).not.toContain("not a calibrated estimate of the probability");
    expect(page).toContain("The index is not a crash probability (FAULTLINE does not offer a crash probability), and it does not predict a date or direction.");
  });
});
