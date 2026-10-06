import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ToolsHome.tsx"), "utf8");

describe("revamped Tools hub hierarchy", () => {
  it("keeps the Case File primary and organizes deeper workspaces into three layers", () => {
    expect(source).toContain("The Case File stays primary.");
    expect(source).toContain('label: "Intelligence"');
    expect(source).toContain('label: "Market Tools"');
    expect(source).toContain('label: "Research Lab"');
  });

  it("preserves the trading-tool subscription-value layer", () => {
    for (const label of [
      "Watchlist",
      "Alerts",
      "Symbol Intelligence",
      "Day Trade Intelligence",
      "Rising Stars",
      "Signals",
      "Crypto Hub",
      "Crypto Signals",
      "Trade Journal",
    ]) {
      expect(source, label).toContain(`label: "${label}"`);
    }
  });

  it("uses current canonical tool routes instead of the retired aliases previously exposed here", () => {
    expect(source).toContain('path: "/app/symbol-intelligence"');
    expect(source).toContain('path: "/app/day-trade-intelligence"');
    expect(source).toContain('path: "/app/crypto-signals"');
    expect(source).toContain('path: "/app/historical-analogs"');
    expect(source).not.toContain('path: "/app/analysis"');
    expect(source).not.toContain('path: "/app/day-trade"');
    expect(source).not.toContain('path: "/app/crypto/signals"');
  });
});
