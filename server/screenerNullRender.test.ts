import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BtcDominanceReadout,
  MomentumLeaderReadout,
  rankMomentumSignals,
} from "../client/src/pages/CryptoSignals.tsx";

describe("screener null dominance and momentum", () => {
  it("renders Unavailable when BTC dominance is missing", () => {
    const header = renderToStaticMarkup(createElement(BtcDominanceReadout, { btcDominance: null }));
    const footer = renderToStaticMarkup(createElement(BtcDominanceReadout, { btcDominance: undefined as unknown as null }));
    expect(header).toContain("Unavailable");
    expect(footer).toContain("Unavailable");
    expect(header).not.toContain("NaN");
    const present = renderToStaticMarkup(createElement(BtcDominanceReadout, { btcDominance: 54.26 }));
    expect(present).toContain("54.3%");
  });

  it("ranks only finite momentum and labels a missing leader Unavailable", () => {
    const rows = [
      { symbol: "NULL1", technicals: { momentumScore: null } },
      { symbol: "LOW", technicals: { momentumScore: 10 } },
      { symbol: "HIGH", technicals: { momentumScore: 80 } },
      { symbol: "NAN", technicals: { momentumScore: Number.NaN } },
    ];
    const mixed = rankMomentumSignals(rows);
    expect(mixed.leader?.symbol).toBe("HIGH");
    expect(mixed.ranked.map(row => row.symbol)).toEqual(["HIGH", "LOW"]);
    expect(mixed.unavailable.map(row => row.symbol)).toEqual(["NULL1", "NAN"]);
    const none = rankMomentumSignals([
      { symbol: "A", technicals: { momentumScore: null } },
      { symbol: "B", technicals: { momentumScore: null } },
    ]);
    expect(none.leader).toBeNull();
    expect(none.ranked).toEqual([]);
    expect(none.unavailable.map(row => row.symbol)).toEqual(["A", "B"]);
    const missing = renderToStaticMarkup(createElement(MomentumLeaderReadout, { signal: none.leader }));
    expect(missing).toContain("Unavailable");
    expect(missing).not.toContain(">A<");
    const leader = renderToStaticMarkup(createElement(MomentumLeaderReadout, { signal: mixed.leader }));
    expect(leader).toContain("HIGH");
  });

  it("does not format screener dominance or rank null momentum with -Infinity", () => {
    const source = readFileSync(new URL("../client/src/pages/CryptoSignals.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("btcDominance.toFixed");
    expect(source).not.toContain("NEGATIVE_INFINITY");
    const consumers = [
      "../client/src/pages/mobile/MobileSignals.tsx",
      "../client/src/pages/CryptoSearch.tsx",
      "../client/src/components/HomeCryptoSection.tsx",
    ];
    for (const file of consumers) {
      const text = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(text, file).not.toContain("btcDominance.toFixed");
    }
  });
});
