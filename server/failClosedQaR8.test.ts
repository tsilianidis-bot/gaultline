import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EngineOutput } from "../client/src/lib/engine";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { buildEngineSnapshot, findDomainByFamily } from "../client/src/lib/engineSnapshot";
import { PRESSURE_BANDS } from "../client/src/lib/pressureSnapshot";
import { computeOverallConfidence } from "./routers/dailyBrief";
import { computeEvolution } from "./seismographUnified";
import { classifyTrendDirection } from "./historicalContextEngine";

// QA r8 (#60 at cac333e): display-only, fail-closed fixes. No engine/formula change.
(globalThis as any).React = React;

const engineState: { output: EngineOutput | null } = { output: null };
vi.mock("@/lib/trpc", () => ({
  trpc: { marketState: { canonicalCurrent: { useQuery: () => ({ data: { ok: true } }) } } },
}));
vi.mock("@/contexts/EngineContext", () => ({
  useEngine: () => ({ output: engineState.output, indicators: DEFAULT_INDICATORS }),
}));

const { FaultlineInterpretation, interpretationTrend } = await import("../client/src/components/dashboard/FaultlineInterpretation");
const { MomentumArrow } = await import("../client/src/pages/Scores");
const ScoreRing = (await import("../client/src/components/ScoreRing")).default;

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const marketState = JSON.parse(read("server/__fixtures__/prod-2026-10-01/market-state-current.json"));
const canonical = () => selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
const fallback503 = () => selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function renderInterpretation(output: EngineOutput): string {
  engineState.output = output;
  return text(renderToStaticMarkup(createElement(FaultlineInterpretation)));
}
/** The deterministic engine output with the five trend domains forced to a known delta. */
function withKnownDeltas(delta: number): EngineOutput {
  const out = structuredClone(fallback503().output) as EngineOutput;
  const ids = ["treasury-debt", "recession", "liquidity", "banking", "credit-stress"];
  out.domains = out.domains.filter(d => !ids.includes(d.id)).concat(
    ids.map(id => ({ ...out.domains[0], id, label: id, score: 3, delta, deltaAvailable: true })),
  );
  return out;
}

describe("FaultlineInterpretation: an unknown delta is Unavailable, never Stable/Neutral", () => {
  it("helper: missing / NaN / ±Infinity / flagged → unavailable; known flat → stable", () => {
    expect(interpretationTrend(undefined)).toBe("unavailable");
    expect(interpretationTrend(null)).toBe("unavailable");
    expect(interpretationTrend({})).toBe("unavailable");
    expect(interpretationTrend({ delta: Number.NaN })).toBe("unavailable");
    expect(interpretationTrend({ delta: Number.POSITIVE_INFINITY })).toBe("unavailable");
    expect(interpretationTrend({ delta: 0, deltaAvailable: false })).toBe("unavailable");
    expect(interpretationTrend({ delta: 0 })).toBe("stable");
    expect(interpretationTrend({ delta: 0.15 })).toBe("stable");
    expect(interpretationTrend({ delta: -0.2 })).toBe("easing");
    expect(interpretationTrend({ delta: 0.2 })).toBe("building");
  });
  it("canonical render (domains are canonical-N-…, deltas flagged): liquidity chip and trend copy say Unavailable", () => {
    const html = renderInterpretation(canonical().output);
    expect(html).toContain("Liquidity trend: Unavailable");
    expect(html).not.toMatch(/Liquidity (Neutral|Stable|Easing|Tightening)/);
    expect(html).toContain("Domain trends versus the prior reading are unavailable");
    expect(html).not.toContain("No domain is showing an easing trend");
    expect(html).not.toContain("Risk conditions are broadly contained");
  });
  it("a flagged delta on a matching engine id is still Unavailable (deltaAvailable: false)", () => {
    const out = withKnownDeltas(0);
    out.domains = out.domains.map(d => ({ ...d, deltaAvailable: false }));
    const html = renderInterpretation(out);
    expect(html).toContain("Liquidity trend: Unavailable");
    expect(html).not.toMatch(/Liquidity (Neutral|Stable)/);
  });
  it("a known flat delta reads Stable (and only then)", () => {
    const html = renderInterpretation(withKnownDeltas(0));
    expect(html).toContain("Liquidity Stable");
    expect(html).not.toContain("Liquidity trend: Unavailable");
    expect(html).toContain("No domain is showing an easing trend");
    expect(renderInterpretation(withKnownDeltas(-0.5))).toContain("Liquidity Easing");
    expect(renderInterpretation(withKnownDeltas(0.5))).toContain("Liquidity Tightening");
  });
  it("source: no `?.delta ?? 0` fallback, no Neutral liquidity label", () => {
    const s = read("client/src/components/dashboard/FaultlineInterpretation.tsx");
    expect(s).not.toMatch(/\?\.delta \?\? 0/);
    expect(s).not.toMatch(/: "Neutral"/);
    expect(s).toContain('import { availableDelta } from "@/lib/displayFallbacks";');
  });
});

describe("Scores.tsx (/app/pressure?tab=scores): unknown delta → '—', no STABLE +0.00 / | 0.0", () => {
  it("MomentumArrow: undefined / NaN → '—' with no direction label or number", () => {
    for (const delta of [undefined, Number.NaN]) {
      const html = text(renderToStaticMarkup(createElement(MomentumArrow, { delta })));
      expect(html.trim()).toBe("—");
      expect(html).not.toMatch(/STABLE|RISING|EASING|\d/);
    }
  });
  it("MomentumArrow: a known delta keeps its direction and value", () => {
    expect(text(renderToStaticMarkup(createElement(MomentumArrow, { delta: 0 })))).toMatch(/STABLE\s+\+0\.00/);
    expect(text(renderToStaticMarkup(createElement(MomentumArrow, { delta: 0.4 })))).toMatch(/RISING\s+\+0\.40/);
  });
  it("ScoreRing with delta undefined shows no 0.0", () => {
    const html = text(renderToStaticMarkup(createElement(ScoreRing, { score: 34, maxScore: 100, riskLevel: "moderate", label: "", delta: undefined, showLabel: false })));
    expect(html).not.toMatch(/0\.0/);
  });
  it("source: all four call sites read the delta through availableDelta", () => {
    const s = read("client/src/pages/Scores.tsx");
    expect(s).not.toMatch(/delta=\{(score|overall)\.delta/);
    expect(s).toContain("const scoreDelta = availableDelta(score);");
    expect(s).toContain("const overallDelta = availableDelta(overall);");
    expect(s).toContain("delta={scoreDelta === null ? undefined : scoreDelta * 10}");
    expect(s).toContain("delta={overallDelta === null ? undefined : overallDelta * 10}");
    expect(s).toContain("<MomentumArrow delta={scoreDelta ?? undefined} />");
    expect(s).toContain("<MomentumArrow delta={overallDelta ?? undefined} />");
  });
});

describe("SmartDiscovery snapshot: no demo regime under a 503", () => {
  it("regime label and quick-action prompt are gated on the canonical pressure", () => {
    const s = read("client/src/pages/SmartDiscovery.tsx");
    expect(s).toContain("const regimeLabel = pressureScore === null ? null : regime.label;");
    expect(s).toContain("{regimeLabel ?? 'Unavailable'}");
    expect(s).toContain("regimeLabel === null ? `The market regime is currently unavailable.");
    expect(s).not.toContain("onQuickAction(`What is the ${regime.label} regime");
    expect(s).not.toMatch(/>\{regime\.label\}</);
  });
});

describe("Domain lookup by family (canonical ids are canonical-N-…), formula unchanged", () => {
  it("canonical families match by id slug or exact name", () => {
    const { output } = canonical();
    expect(findDomainByFamily(output.domains, "liquidity")?.label).toBe("Liquidity Conditions");
    expect(findDomainByFamily(output.domains, "credit")?.label).toBe("Credit Markets");
    expect(findDomainByFamily([{ id: "x", label: "liquidity conditions" }], "liquidity")?.id).toBe("x");
    expect(findDomainByFamily([{ id: "canonical-2-credit-markets", label: "renamed" }], "credit")?.id).toBe("canonical-2-credit-markets");
  });
  it("engine ids still match; mixed or unrelated families do not", () => {
    expect(findDomainByFamily([{ id: "liquidity", label: "L" }], "liquidity")?.id).toBe("liquidity");
    expect(findDomainByFamily([{ id: "credit-stress", label: "C" }], "credit")?.id).toBe("credit-stress");
    expect(findDomainByFamily([{ id: "canonical-0-credit-and-liquidity", label: "Credit and Liquidity" }], "liquidity")).toBeUndefined();
    expect(findDomainByFamily([{ id: "canonical-0-credit-and-liquidity", label: "Credit and Liquidity" }], "credit")).toBeUndefined();
    expect(findDomainByFamily(undefined, "credit")).toBeUndefined();
  });
  it("missing liquidity / credit → null in the snapshot (Unavailable), never a default", () => {
    const { output, mode } = canonical();
    const stripped = { ...output, domains: output.domains.filter(d => !/liquidity|credit/i.test(d.label)) };
    const snap = buildEngineSnapshot(stripped, mode, 1)!;
    expect(snap.liquidity).toBeNull();
    expect(snap.credit).toBeNull();
    expect(computeOverallConfidence({ ...snap, bullProbability: 53 })).toBeNull();
  });
  it("fixture 33/67/50/53 still gives 61; confidence stays null when an input is withheld", () => {
    expect(computeOverallConfidence({ overallPressure: 33, breadth: 67, liquidity: 50, bullProbability: 53 })).toBe(61);
    const snap = buildEngineSnapshot(canonical().output, "canonical", 1)!;
    expect(snap.liquidity).toBe(83);
    expect(snap.bullProbability).toBeNull(); // withheld by the probability contract
    expect(computeOverallConfidence(snap)).toBeNull();
  });
  it("source: no engine-id-only lookups left in SmartDiscovery / engineSnapshot", () => {
    for (const f of ["client/src/pages/SmartDiscovery.tsx", "client/src/lib/engineSnapshot.ts"]) {
      expect(read(f)).not.toMatch(/d\.id === ['"](liquidity|credit-stress)['"]\)/);
    }
  });
});

describe("Seismograph unified evolution: no false '+0.0' on short monthly history, monthly labels", () => {
  const months = (n: number) => Array.from({ length: n }, (_, i) => ({
    month: `${2010 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    score: 30 + (i % 7) + i / 10, regime: ["Low", "Moderate", "Elevated"][i % 3],
    liquidity: 40, credit: 40, volatility: 40, macro: 40, breadth: 40,
  })) as any;
  it("12 months: 30- and 90-reading comparisons are Unavailable (insufficient history)", () => {
    const evo = computeEvolution(months(12));
    expect(evo.ninetyDayTrend).toBe("Unavailable (insufficient history)");
    expect(evo.thirtyDayTrend).toBe("Unavailable (insufficient history)");
    expect(evo.sevenDayTrend).toBe("Unavailable (insufficient history)");
    expect(JSON.stringify(evo)).not.toMatch(/\+0\.0|NaN|-day|\d+ days/);
    expect(evo.whatChanged.join(" ")).toContain("in the past 12 months");
  });
  it("full history: comparisons shown with month windows, never day labels", () => {
    const evo = computeEvolution(months(121));
    expect(evo.thirtyDayTrend).toMatch(/30-month average .*7-month average/);
    expect(evo.ninetyDayTrend).toMatch(/30-month vs 90-month average/);
    expect(JSON.stringify(evo)).not.toMatch(/-day|\d+ days/);
  });
  it("client labels match the monthly data", () => {
    const s = read("client/src/pages/SeismographIntelligence.tsx");
    expect(s).not.toMatch(/"(7|30|90)-DAY TREND"|90 DAYS/);
    expect(s).toContain('{ label: "30- VS 90-MONTH TREND", text: safeEvolution.ninetyDayTrend }');
  });
});

describe("Historical context trend: no 7d and no 30d reading → Unavailable, not Stable", () => {
  it("classification", () => {
    expect(classifyTrendDirection(null, null, null)).toBe("Unavailable");
    expect(classifyTrendDirection(Number.NaN, null, 4)).toBe("Unavailable");
    // Thresholds unchanged when at least one window is known.
    expect(classifyTrendDirection(0, 0, null)).toBe("Stable");
    expect(classifyTrendDirection(null, 10, null)).toBe("Building");
    expect(classifyTrendDirection(6, null, null)).toBe("Building");
    expect(classifyTrendDirection(16, null, null)).toBe("Rapidly Deteriorating");
    expect(classifyTrendDirection(null, -16, null)).toBe("Improving");
  });
});

describe("Copy", () => {
  it("Onboarding bands are the canonical PRESSURE_BANDS with the engine's regime names (QA r9)", () => {
    const o = read("client/src/components/Onboarding.tsx");
    const expected = PRESSURE_BANDS.map(b => `${b.range} ${b.regime}`).join(" · ");
    expect(expected).toBe("<25 LOW RISK · 25–44 MODERATE RISK · 45–64 ELEVATED RISK · 65–79 HIGH STRESS · 80+ SYSTEMIC CRISIS");
    expect(o).toContain(`detail: "${expected}",`);
    expect(o).not.toContain("30–50 = Moderate");
  });
  it("crash-probability copy passes #56's disclaimer-only rule on #60's two pages", () => {
    const offers = (line: string) => line.replace(/market-crash-probability-2026/g, "").split(/(?<=[.!?])\s+/)
      .some(s => /crash[- ]probabilit/i.test(s) && !/\b(?:not|no|neither|nor|never|does not offer|rather than)\b[^.]{0,120}crash[- ]probabilit/i.test(s));
    for (const f of ["client/src/pages/seo/MarketCrashProbability2026.tsx", "client/src/pages/PublicSituationRoom.tsx"]) {
      expect(read(f).split("\n").map((l, i) => (offers(l) ? `${f}:${i + 1}` : null)).filter(Boolean)).toEqual([]);
    }
    const p = read("client/src/pages/seo/MarketCrashProbability2026.tsx");
    expect(p).toContain('canonical: "/market-crash-probability-2026"');
    expect(p).toContain('question: "Does FAULTLINE publish a crash-risk forecast?"');
  });
});
