import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

// Server-side vitest uses the classic JSX runtime; the app bundle injects React.
// The page is imported dynamically so the global exists before its module graph evaluates.
(globalThis as any).React = React;
type PageModule = typeof import("../client/src/pages/PublicSharedReport");
let SNAPSHOT_KEY_LABELS: PageModule["SNAPSHOT_KEY_LABELS"];
let SnapshotRenderer: PageModule["SnapshotRenderer"];
let snapshotKeyLabel: PageModule["snapshotKeyLabel"];
let isHiddenSnapshotKey: PageModule["isHiddenSnapshotKey"];
beforeAll(async () => {
  ({ SNAPSHOT_KEY_LABELS, SnapshotRenderer, snapshotKeyLabel, isHiddenSnapshotKey } = await import("../client/src/pages/PublicSharedReport"));
});

// QA B11: /r/:publicShareId must not print raw snapshot keys for the favorable-setup / adverse-pressure scores,
// for reports saved before (old keys) or after (new keys) the #60 score-key rename.
const OLD_KEYS = ["favorableSetupProbability", "adversePressureProbability"];
const NEW_KEYS = ["favorableSetupScore", "adversePressureScore"];

describe("PublicSharedReport snapshot key labels (QA B11)", () => {
  it("maps old and new score keys to readable /100 score labels without the word probability", () => {
    for (const key of [...OLD_KEYS, ...NEW_KEYS]) {
      const label = snapshotKeyLabel(key);
      expect(label, key).toMatch(/^(Favorable setup|Adverse pressure) score \(\/100\)$/);
      expect(label, key).not.toMatch(/probabilit/i);
    }
    expect(snapshotKeyLabel("favorableSetupProbability")).toBe(snapshotKeyLabel("favorableSetupScore"));
    expect(snapshotKeyLabel("adversePressureProbability")).toBe(snapshotKeyLabel("adversePressureScore"));
    for (const label of Object.values(SNAPSHOT_KEY_LABELS)) expect(label).not.toMatch(/probabilit/i);
  });

  it("leaves other keys on the existing underscore-to-space rendering", () => {
    expect(snapshotKeyLabel("market_regime")).toBe("market regime");
    expect(snapshotKeyLabel("ticker")).toBe("ticker");
  });

  it("renders saved snapshots (old keys, top-level and nested) with labels, never the raw key or 'probability'", () => {
    const legacy = { favorableSetupProbability: 81, adversePressureProbability: 19, preflight: { favorableSetupProbability: 81, adversePressureProbability: 19, ticker: "NVDA" } };
    const renamed = { favorableSetupScore: 70, adversePressureScore: 30, preflight: { favorableSetupScore: 70, adversePressureScore: 30 } };
    for (const snapshot of [legacy, renamed]) {
      const html = renderToStaticMarkup(createElement(SnapshotRenderer, { snapshotJson: JSON.stringify(snapshot), reportType: "preflight" }));
      expect(html).toContain("Favorable setup score (/100)");
      expect(html).toContain("Adverse pressure score (/100)");
      expect(html).not.toMatch(/probabilit/i);
      for (const key of [...OLD_KEYS, ...NEW_KEYS]) expect(html).not.toContain(`>${key}<`);
    }
  });
});

// Shapes copied from the share buttons: Signals.tsx (stock signals snapshot) and CryptoSignals.tsx (crypto signals snapshot).
// Confidence values are distinctive so a leaked value is detectable in the markup.
const STOCK_SIGNALS_SNAPSHOT = {
  regime: "ELEVATED RISK",
  signalCount: 2,
  signals: [
    { ticker: "NVDA", action: "BUY", actionLabel: "Accumulation Zone", assetClass: "equity", strength: 4, confidence: 93, entryZone: "118-122", stopLoss: 109, targetPrice: 141 },
    { ticker: "TSLA", action: "HOLD", actionLabel: "Momentum Weakening", assetClass: "equity", strength: 2, confidence: 89, entryZone: null, stopLoss: null, targetPrice: null },
  ],
};
const CRYPTO_SIGNALS_SNAPSHOT = {
  regime: "MODERATE RISK",
  btcDominance: 56.2,
  totalMarketCap: 2310000000000,
  signals: [
    { symbol: "BTC", action: "BUY", actionLabel: "Momentum Confirmed", cryptoRegime: "RISK_ON", regimeConflict: false, confidence: 87 },
    { symbol: "SOL", action: "WATCH", actionLabel: "Avoid New Entry", cryptoRegime: "RISK_ON", regimeConflict: true, confidence: 97 },
  ],
};
const LEAKED_VALUES = [93, 89, 87, 97, 73, 61, 59, 67];
const render = (snapshot: unknown, reportType: string) =>
  renderToStaticMarkup(createElement(SnapshotRenderer, { snapshotJson: JSON.stringify(snapshot), reportType }));

describe("PublicSharedReport hides formula confidence and probability-like keys (QA B11 follow-up)", () => {
  it("hides confidence and any probability / odds / chance / *confidence key, but not the remapped scores", () => {
    for (const key of ["confidence", "Confidence", "signalConfidence", "regimeConfidence", "bullProbability", "crashProbabilities", "recessionOdds", "recoveryChance"])
      expect(isHiddenSnapshotKey(key), key).toBe(true);
    for (const key of ["favorableSetupProbability", "adversePressureProbability", "favorableSetupScore", "adversePressureScore", "ticker", "strength", "regime", "constructor"])
      expect(isHiddenSnapshotKey(key), key).toBe(false);
    expect(snapshotKeyLabel("constructor")).toBe("constructor");
  });

  for (const [name, snapshot, reportType] of [
    ["stock signals", STOCK_SIGNALS_SNAPSHOT, "stock_intelligence"],
    ["crypto signals", CRYPTO_SIGNALS_SNAPSHOT, "crypto_intelligence"],
  ] as const) {
    it(`a saved ${name} report prints no confidence label or value and no 'probability'`, () => {
      const html = render(snapshot, reportType);
      expect(html).not.toMatch(/confidence/i);
      expect(html).not.toMatch(/probabilit/i);
      for (const v of LEAKED_VALUES) expect(html, String(v)).not.toContain(`>${v}<`);
      // The rest of the signal still renders.
      expect(html).toContain(name === "stock signals" ? "NVDA" : "BTC");
      expect(html).toContain(name === "stock signals" ? "Accumulation Zone" : "Momentum Confirmed");
    });
  }

  it("with score keys and future probability-like keys mixed in, only the two /100 score labels survive", () => {
    const snapshot = {
      ...STOCK_SIGNALS_SNAPSHOT,
      confidence: 73,
      favorableSetupProbability: 81,
      adversePressureProbability: 19,
      bullProbability: 61,
      recessionOdds: 59,
      preflight: { favorableSetupScore: 70, adversePressureScore: 30, signalConfidence: 67, recoveryChance: 59 },
    };
    const html = render(snapshot, "market_preflight");
    expect(html.match(/Favorable setup score \(\/100\)/g)?.length).toBe(2);
    expect(html.match(/Adverse pressure score \(\/100\)/g)?.length).toBe(2);
    for (const v of [81, 19, 70, 30]) expect(html, String(v)).toContain(`>${v}<`);
    expect(html).not.toMatch(/confidence|probabilit|odds|chance/i);
    for (const v of LEAKED_VALUES) expect(html, String(v)).not.toContain(`>${v}<`);
  });
});
