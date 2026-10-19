import { describe, expect, it } from "vitest";
import { PRESSURE_VECTOR_DISPLAY, pressureVectorLabel } from "@shared/pressureVectorLabels";
import {
  DOMAIN_LABELS,
  createUnavailableCore,
} from "../client/src/components/intelligence-core-visual/adapter";
import type { DomainId } from "../client/src/components/intelligence-core-visual/types";

const DOMAIN_VECTOR = {
  liquidity: "liquidity-stress",
  credit: "credit-contagion",
  volatility: "volatility-regime",
  macro: "macro-sensitivity",
  breadth: "market-breadth",
  ai: "ai-bubble",
} as const satisfies Record<DomainId, keyof typeof PRESSURE_VECTOR_DISPLAY>;

describe("six-node labels follow the canonical Pressure vector display", () => {
  it("names every node from PRESSURE_VECTOR_DISPLAY", () => {
    const model = createUnavailableCore("No admitted canonical payload.");
    for (const domain of model.domains) {
      const vectorId = DOMAIN_VECTOR[domain.id];
      expect(DOMAIN_LABELS[domain.id]).toBe(PRESSURE_VECTOR_DISPLAY[vectorId].label);
      expect(domain.label).toBe(pressureVectorLabel(vectorId));
    }
    expect(DOMAIN_LABELS.volatility).toBe("Yield Curve (10Y–2Y) & 10Y Level");
    expect(DOMAIN_LABELS.volatility).not.toBe("Volatility Regime");
    expect(DOMAIN_LABELS.breadth).toBe("Labor & Rates (Unemployment, 10Y)");
    expect(DOMAIN_LABELS.breadth).not.toBe("Market Breadth");
    expect(DOMAIN_LABELS.credit).toBe("Credit Contagion Risk");
    expect(DOMAIN_LABELS.ai).toBe("AI / Speculation (Static Baseline)");
  });

  it("does not describe the empty yield-curve or labor nodes as volatility or market breadth", () => {
    const model = createUnavailableCore("No admitted canonical payload.");
    const yieldCurve = model.domains.find(domain => domain.id === "volatility");
    const labor = model.domains.find(domain => domain.id === "breadth");
    expect(yieldCurve?.significance).toMatch(/10Y–2Y/);
    expect(yieldCurve?.significance).not.toMatch(/Volatility Regime/);
    expect(yieldCurve?.significance).not.toMatch(/volatility-regime conditions/);
    expect(labor?.significance).toMatch(/Unemployment/);
    expect(labor?.significance).not.toMatch(/Market Breadth/);
    expect(labor?.significance).not.toMatch(/market participation and breadth/);
  });
});
