/**
 * QA delta gate (d4ecd85): with marketState.current failing but canonical OK,
 * the browser engine runs on DEFAULT_INDICATORS demo inputs. Its narrative
 * ("Systemic risk composite at 45/100 — MODERATE regime", "Banking System
 * Stress (59/100)…") is withheld: "Synthesis unavailable", no WATCH list.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_INDICATORS, computeEngine } from "../client/src/lib/engine";
import { SYNTHESIS_UNAVAILABLE, selectBrowserMarketOutput, withholdFallbackNarrative } from "../client/src/lib/marketStateProjection";

describe("deterministic-fallback narrative is withheld at the shared projection", () => {
  it("no MarketState → Synthesis unavailable, no key risks, no demo numbers", () => {
    const raw = computeEngine(DEFAULT_INDICATORS);
    expect(raw.narrative.summary).toMatch(/Systemic risk composite at \d+\/100/); // what used to be shown
    const result = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(result.mode).toBe("deterministic-fallback");
    expect(result.output.narrative).toEqual({ regimeAssessment: SYNTHESIS_UNAVAILABLE, summary: SYNTHESIS_UNAVAILABLE, keyRisks: [] });
    expect(JSON.stringify(result.output.narrative)).not.toMatch(/\d/);
    expect(SYNTHESIS_UNAVAILABLE).toBe("Synthesis unavailable");
  });

  it("explicit simulation keeps its own (labelled) narrative; only the narrative is withheld otherwise", () => {
    const sim = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: { vix: 55 } });
    expect(sim.mode).toBe("simulation");
    expect(sim.output.narrative.summary).toMatch(/Systemic risk composite/);
    const raw = computeEngine(DEFAULT_INDICATORS);
    const { narrative: _n, ...rest } = withholdFallbackNarrative(raw);
    const { narrative: _r, ...rawRest } = raw;
    expect(rest).toEqual(rawRest);
  });
});

describe("MarketContextStrip without MarketState", () => {
  const strip = readFileSync(resolve(process.cwd(), "client/src/components/MarketContextStrip.tsx"), "utf8");
  it("shows Synthesis unavailable and hides the WATCH list", () => {
    expect(strip).toContain("const synthesisAvailable = marketState != null;");
    expect(strip).toMatch(/const synthesis = !synthesisAvailable\s+\? SYNTHESIS_UNAVAILABLE/);
    expect(strip).toContain("{synthesisAvailable && narrative.keyRisks && narrative.keyRisks.length > 0 && (");
  });
  it("shows no demo-input verdict, sublabel or pressure number", () => {
    expect(strip).toContain('const verdictLabel = marketState ? getVerdictLabel(overall.riskLevel) : "UNAVAILABLE";');
    expect(strip).toContain("{marketState && <span");
    expect(strip).not.toContain("overall.score * 10");
    expect(strip).toMatch(/\? formatCanonicalScore\(canonicalPressure\)\s+: "UNAVAILABLE";/);
  });
});
