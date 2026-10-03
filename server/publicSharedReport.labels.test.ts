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
beforeAll(async () => {
  ({ SNAPSHOT_KEY_LABELS, SnapshotRenderer, snapshotKeyLabel } = await import("../client/src/pages/PublicSharedReport"));
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
