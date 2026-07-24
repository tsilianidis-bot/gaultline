import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppMarketHeader, { type MarketTickerItem } from "../client/src/components/AppMarketHeader";

const items: MarketTickerItem[] = [
  { label: "Pressure Index", value: "67", direction: "up" },
  { label: "Liquidity", value: "Neutral", direction: "flat" },
];

describe("AppMarketHeader", () => {
  it("renders ticker values and directional glyphs", () => {
    const html = renderToStaticMarkup(createElement(AppMarketHeader, { items, isMobile: false }));

    expect(html).toContain("Pressure Index");
    expect(html).toContain("67");
    expect(html).toContain("▲");
    expect(html).toContain("—");
  });

  it("renders desktop regime intelligence", () => {
    const html = renderToStaticMarkup(createElement(AppMarketHeader, {
      items,
      isMobile: false,
      intelligence: {
        stockRegime: { regime: "Risk-Off", confidence: 78 },
        cryptoRegime: { regime: "Transition", confidence: 64 },
        alignmentStatus: "DIVERGENT",
        alignmentScore: 29,
      },
    }));

    expect(html).toContain("Risk-Off");
    expect(html).toContain("Transition");
    expect(html).toContain("DIVERGENT");
  });

  it("suppresses the regime strip on mobile", () => {
    const html = renderToStaticMarkup(createElement(AppMarketHeader, {
      items,
      isMobile: true,
      intelligence: { stockRegime: { regime: "Risk-Off", confidence: 78 } },
    }));

    expect(html).not.toContain("Risk-Off");
    expect(html).not.toContain("REGIME");
  });
});
