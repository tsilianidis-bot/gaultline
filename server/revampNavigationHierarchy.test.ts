import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const navSource = readFileSync(resolve(projectRoot, "client/src/components/LeftNavDrawer.tsx"), "utf8");

function navGroupsBlock(): string {
  const start = navSource.indexOf("const NAV_GROUPS: NavGroup[] = [");
  const end = navSource.indexOf("const ADMIN_ITEMS: NavItem[] = [");
  if (start < 0 || end < 0 || end <= start) throw new Error("NAV_GROUPS block not found");
  return navSource.slice(start, end);
}

describe("revamp navigation hierarchy", () => {
  const groups = navGroupsBlock();

  it("keeps the Five Questions primary and separates intelligence, market tools, and research", () => {
    expect(groups).toContain('label: "THE FIVE QUESTIONS"');
    expect(groups).toContain('label: "INTELLIGENCE"');
    expect(groups).toContain('label: "MARKET TOOLS"');
    expect(groups).toContain('label: "RESEARCH LAB"');
  });

  it("preserves the trading-tool subscription inventory", () => {
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
      expect(groups, label).toContain(`label: "${label}"`);
    }
  });

  it("removes redundant destinations from primary customer navigation without deleting routes", () => {
    for (const label of [
      "Historical Briefings",
      "Reading History",
      "Signal Outlook Center",
      "Decision Engine",
      "Smart Discovery",
      "Pressure Engine",
      "Glossary",
      "Roadmap",
    ]) {
      expect(groups, label).not.toContain(`label: "${label}"`);
    }
  });
});
