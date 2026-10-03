import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// QA Signals confidence (B14): the trading-signal "confidence" is a formula,
// min(95, 55 + |score| × 5) (server/tradingSignals.ts), not a calibrated value.
// /app/signals shows "Not established": no %, no bar, no colour band, no
// average, no static catalog confidence, and no confidence in new share
// snapshots. Signal action / strength / levels are unchanged.
const src = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Signals.tsx"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Signals.tsx renders no signal confidence figure", () => {
  it("no `{…confidence}%` text and no confidence-driven width or colour", () => {
    expect(code).not.toMatch(/onfidence\w*\s*\}\s*%/);
    expect(code).not.toMatch(/width:\s*`\$\{[^}]*onfidence[^}]*\}%`/);
    expect(code).not.toMatch(/onfidence\w*\s*(?:>=|<=|>|<)\s*\d/);
    expect(code).not.toMatch(/\bavgConf\b|AVG CONFIDENCE/);
  });
  it("the CONFIDENCE row reads Not established and ignores the value", () => {
    const body = code.slice(code.indexOf("function ConfidenceBar("), code.indexOf("function RegimeAlignmentBadge("));
    expect(body).toContain("{SIGNAL_CONFIDENCE_NOT_ESTABLISHED}");
    expect(body.slice(body.indexOf("return ("))).not.toMatch(/_props|(?<![-\w])confidence\b/);
    expect(code).toContain("const SIGNAL_CONFIDENCE_NOT_ESTABLISHED = 'Not established';");
    expect(code).toContain("<ConfidenceBar action={tradingSignal.action} />");
    expect(code).toContain("CONFIDENCE: <span style={{ color: '#94A3B8' }}>{SIGNAL_CONFIDENCE_NOT_ESTABLISHED}</span>");
  });
  it("the static catalog confidence (hard-coded 88 / 76 / 70) is not rendered", () => {
    expect(code).not.toMatch(/\bstock\??\.confidence\b|\bstock\s*\[\s*["'`]confidence/);
    expect(code).not.toMatch(/\[\s*["'`]conf/i);
    expect(code).not.toMatch(/\bstock\b(?:\s+as\s+\w+\))?\??\.confidence/);
    const notes = code.slice(code.indexOf("CATALOG NOTES"), code.indexOf("{stock.macroAlignment && ("));
    expect(notes).toContain("OPP SCORE");
    expect(notes).not.toMatch(/CONFIDENCE/i);
  });
  it("the share snapshot has the exact signal keys, no confidence", () => {
    const start = code.indexOf('reportType="stock_intelligence"');
    const at = code.indexOf("signals: tradingSignalsData.slice(0, 20).map(s => ({", start);
    const block = code.slice(at, code.indexOf("}))", at));
    const keys = block.split("\n").slice(1).map(l => l.trim()).filter(Boolean).map(l => l.split(":")[0]);
    expect(keys).toEqual(["ticker", "action", "actionLabel", "assetClass", "strength", "entryZone", "stopLoss", "targetPrice"]);
    expect(block).not.toMatch(/confidence|\[[^\]]*\]\s*:|\.\.\./i);
  });
});
