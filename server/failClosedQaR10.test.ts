import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { stripProbabilityPercentClaims } from "./stripProbabilityClaims";

// QA r10 (#60 at 464694c): ASHA answers carry no model-invented probability
// numbers (James's standing rule), and leftover recession / crash "probability"
// copy in #60-owned files reads as risk context. Display only; no scoring input.
(globalThis as any).React = React;

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const engine: { output: any } = { output: {} };
vi.mock("@/contexts/EngineContext", () => ({ useEngine: () => ({ output: engine.output, marketMode: "live", isLoading: false, lastUpdated: null }) }));

const EVENT = String.raw`(?:market[- ])?(?:crash|recession|default|bear[- ]market|bull[- ]market|bull\/bear|correction|crisis|alt[- ]season)`;
const OFFER = new RegExp(String.raw`\b${EVENT}[- ]probabilit|\bprobabilit(?:y|ies) of (?:an? )?(?:market )?(?:recession|crash|default|bear market|correction|crisis|alt season|significant market)`, "i");
const ADJ = String.raw`(?:(?:calibrated|validated|published|fitted)\s+)*`;
const DISCLAIMER = new RegExp(String.raw`\b(?:does not (?:offer|publish)|not) an? ${ADJ}(?:${EVENT}[- ])?probabilit(?:y|ies)\b`, "gi");
const offersProbability = (line: string) =>
  line.replace(/\/[a-z0-9/-]*probability[a-z0-9-]*/gi, "").split(/(?<=[.!?:;])\s+/).some(sentence => OFFER.test(sentence.replace(DISCLAIMER, " ")));

describe("QA r10 — Blocker 6: ASHA answer prompt and schema carry no probability numbers", () => {
  const router = read("server/routers/smartDiscovery.ts");
  const promptAndSchema = router.slice(0, router.indexOf("export const ANSWER_PROSE_FIELDS"));

  it("prompt, schema and required list have no bull / bear / verdict probability fields", () => {
    for (const field of ["bullProbability", "bearProbability", "neutralProbability", "finalVerdictProbability"]) {
      expect(promptAndSchema, field).not.toContain(field);
    }
    expect(promptAndSchema).not.toMatch(/probability\.(?:bull|bear|neutral)\}%/);
    expect(promptAndSchema).not.toMatch(/Bull probability: \d/i);
    expect(promptAndSchema).not.toMatch(/highest probability scenario|probability-based/i);
    expect(promptAndSchema).toContain("BULL / BEAR BALANCE");
    expect(promptAndSchema).toContain("FAULTLINE does not offer a crash probability");
    expect(promptAndSchema).toContain("Scenario weights: uncalibrated (not offered as probabilities)");
    expect(promptAndSchema).toContain("never state a probability");
    expect(router).toContain("raw = withoutModelProbabilities(integrityValidation.normalizedOutput);");
  });

  it("withoutModelProbabilities drops probability fields and strips probability-% prose", async () => {
    const { withoutModelProbabilities } = await import("./routers/smartDiscovery");
    const out = withoutModelProbabilities({
      bullProbability: 64, bearProbability: 36, neutralProbability: 0, finalVerdictProbability: 71,
      finalVerdict: "HOLD", finalVerdictConfidence: 62,
      executiveSummary: "Credit spreads are widening. Crash probability is 18%.",
      bullCase: "Bull probability: 64%. Earnings hold up.",
      bearKeyDrivers: ["There is a 36% probability of a bear market.", "HY spreads widening"],
      collectiveReading: { summary: "Recession odds of 40% are rising. Liquidity is tight.", strongestReason: "Curve inversion" },
    }) as any;
    for (const k of ["bullProbability", "bearProbability", "neutralProbability", "finalVerdictProbability"]) expect(out, k).not.toHaveProperty(k);
    expect(out.finalVerdict).toBe("HOLD");
    expect(out.finalVerdictConfidence).toBe(62);
    expect(out.executiveSummary).toBe("Credit spreads are widening.");
    expect(out.bullCase).toBe("Earnings hold up.");
    expect(out.bearKeyDrivers).toEqual(["HY spreads widening"]);
    expect(out.collectiveReading.summary).toBe("Liquidity is tight.");
    expect(out.collectiveReading.strongestReason).toBe("Curve inversion");
    expect(JSON.stringify(out)).not.toMatch(/\d+(?:\.\d+)?\s*%/);
  });

  it("stripProbabilityPercentClaims is the prose gate the answer path uses", () => {
    expect(stripProbabilityPercentClaims("Crash probability is 18%. Spreads widened.")).toBe("Spreads widened.");
  });
});

describe("QA r10 — Blocker 6: SmartDiscovery renders contract text, never ?? 50", () => {
  const page = read("client/src/pages/SmartDiscovery.tsx");

  it("no defaulted or model probability numbers in the page source", () => {
    expect(page).not.toMatch(/Probability\s*\?\?\s*50/);
    expect(page).not.toMatch(/finalVerdictProbability|bearProbability|neutralProbability/);
    expect(page).not.toMatch(/answer\.bullProbability|a\.bullProbability|\.bullProbability\s*\?\?/);
    expect(page).not.toContain("InlineProbBar");
    expect(page).toContain('{ label: "PROBABILITY", value: PROBABILITY_DISPLAY_TEXT.NOT_OFFERED');
    expect(page.match(/<ContractScenarioStrip/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page).toContain('engineProbabilityText(output, "crashProbability")');
  });

  it("ContractScenarioStrip shows the canonical contract text, 'Not offered' for crash", async () => {
    const { ContractScenarioStrip } = await import("../client/src/pages/SmartDiscovery");
    engine.output = {
      bullProbability: 50, crashProbability: 50,
      probabilityDisplay: {
        bullProbability: { state: "UNCALIBRATED", text: "Uncalibrated", percent: null },
        crashProbability: { state: "NOT_OFFERED", text: "Not offered", percent: null },
      },
    };
    const html = text(renderToStaticMarkup(React.createElement(ContractScenarioStrip)));
    expect(html).toContain("BULL SCENARIO Uncalibrated");
    expect(html).toContain("CRASH RISK Not offered");
    expect(html).not.toMatch(/\d+\s*%|\b50\b/);
    engine.output = {};
    const missing = text(renderToStaticMarkup(React.createElement(ContractScenarioStrip, { compact: true })));
    expect(missing).toContain("BULL SCENARIO Unavailable");
    expect(missing).toContain("CRASH RISK Unavailable");
    expect(missing).not.toMatch(/\d+\s*%|\b50\b/);
  });
});

describe("QA r10 — leftover recession / crash probability copy in #60-owned files", () => {
  it("ShareCard labels crash / recession as risk with the contract value text", () => {
    const share = read("client/src/components/ShareCard.tsx");
    expect(share).toContain("`Crash risk: ${pText('crashProbability')}`");
    expect(share).toContain("`Recession risk: ${pText('recessionProbability')}`");
    expect(share).toContain("{ label: 'Recession risk', value: pText('recessionProbability')");
    expect(share).not.toMatch(/Crash Probability|Recession Probability/);
  });

  it("deep-inversion alert reads as a recession warning sign, not a probability", async () => {
    const { THRESHOLD_RULES } = await import("../client/src/lib/regimeAlerts");
    const messages = THRESHOLD_RULES.map(r => r.message(-60));
    const inversion = messages.find(m => m.includes("deep inversion"));
    expect(inversion).toContain("historically a recession warning sign");
    for (const m of messages) {
      expect(m).not.toMatch(/recession probability elevated/i);
      expect(offersProbability(m), m).toBe(false);
    }
  });

  it("seedEvergreen recession article is recession-risk context with the disclaimer", () => {
    const seed = read("scripts/seedEvergreen.mjs");
    expect(seed).not.toMatch(/Recession Probability score/i);
    expect(seed).not.toMatch(/from 0% to 100%/);
    expect(seed).not.toMatch(/above 50%|above 75%|exceeds 50%|exceeds 75%/i);
    expect(seed).toContain("does not offer a recession probability");
    expect(seed).not.toContain("high probability of regime transition");
    expect(seed).not.toContain("probability of a regime change");
  });

  it("r16 detector finds no non-disclaimer offer in the r10 files", () => {
    for (const rel of [
      "client/src/components/ShareCard.tsx",
      "client/src/lib/regimeAlerts.ts",
      "client/src/pages/SmartDiscovery.tsx",
      "server/routers/smartDiscovery.ts",
      "scripts/seedEvergreen.mjs",
    ]) {
      const hits = read(rel).split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => offersProbability(l));
      expect(hits.map(([n, l]) => `${rel}:${n}: ${l.trim().slice(0, 120)}`)).toEqual([]);
    }
  });
});
