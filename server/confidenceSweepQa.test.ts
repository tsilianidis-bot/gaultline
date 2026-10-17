import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// QA confidence sweep (#60): Opportunity Discovery "confidence" (score × 0.85 +
// pressure band) and the owner optimal-action LLM self-rating are never shown
// as a %. The server withholds the discovery value (signalOutlook.test.ts).
const root = path.resolve(import.meta.dirname, "..");
const code = (rel: string) => readFileSync(path.join(root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("discovery confidence is Not established", () => {
  for (const f of ["client/src/components/OpportunityDiscoveryPanel.tsx", "client/src/pages/Opportunities.tsx"]) {
    it(f, () => {
      const src = code(f);
      expect(src).not.toMatch(/item\??\.confidenceLevel(?!\?:)|item\s*\[\s*["'`]confidence/);
      expect(src).not.toMatch(/onfidence\w*\s*\}\s*%|onfidence\w*\}%`/);
      const n = (src.match(/data-confidence-status="not-established"[^>]*>\{CONFIDENCE_NOT_ESTABLISHED\}/g) ?? []).length;
      expect(n).toBe(f.endsWith("Opportunities.tsx") ? 2 : 1);
    });
  }
  it("server source withholds it", () => {
    const src = code("server/signalOutlook.ts");
    expect(src).toMatch(/\n\s*confidenceLevel: null,\n/);
    expect(src).not.toMatch(/confidenceLevel:\s*Math/);
  });
});

describe("owner optimal-action LLM confidence", () => {
  it("no % and no confidence-driven bar", () => {
    const src = code("client/src/pages/OwnerSimulation.tsx");
    expect(src).not.toMatch(/optimalAction\??\.confidence|optimalAction\s*\[\s*["'`]conf/);
    expect(src).toMatch(/>CONFIDENCE<\/div>\s*<div data-confidence-status="not-established"[^>]*>\{CONFIDENCE_NOT_ESTABLISHED\}<\/div>/);
  });
});

// ── Launch fix-up: remaining customer-visible confidence / probability values ──
const notEst = (src: string) => (src.match(/data-(?:confidence|probability)-status="not-established"/g) ?? []).length;

describe("SEO signal pages: LLM confidenceScore withheld", () => {
  it("public router nulls confidenceScore (getSignalPage + listSignalPages)", () => {
    const src = code("server/routers/organicContent.ts");
    expect(src).toContain("return page ? { ...page, confidenceScore: null } : null;");
    expect(src).toContain("return rows.map(row => ({ ...row, confidenceScore: null }));");
    expect(src).not.toMatch(/return page \?\? null;/);
  });
  for (const f of ["client/src/pages/seo/DynamicStockPage.tsx", "client/src/pages/seo/DynamicCryptoPage.tsx"]) {
    it(f, () => {
      const src = code(f);
      expect(src).not.toMatch(/confidenceScore/);
      expect(src).not.toMatch(/%\s*confidence/i);
    });
  }
});

describe("heuristic confidence / probability shown as Not established", () => {
  it("day-trade scanner: no CONF number, no PROB %, no confidence reasoning", () => {
    const src = code("client/src/pages/DayTradeIntelligence.tsx");
    expect(src).not.toMatch(/\{(?:ds|s)\.confidence\}/);
    expect(src).not.toMatch(/probabilityRating\}%|\$\{s\.probabilityRating\}/);
    expect(src).not.toMatch(/\{ds\.confidenceReasoning\}/);
    expect(notEst(src)).toBe(3);
    expect(src).toContain('{ label: "PROB",    value: "Not established", color: "#94A3B8" },');
  });
  it("day-trade detail", () => {
    const src = code("client/src/pages/DayTradeDetail.tsx");
    expect(src).toContain('["CONFIDENCE", "Not established", "#94A3B8"]');
    expect(src).not.toMatch(/report\??\.confidence/);
  });
  it("symbol intelligence", () => {
    const src = code("client/src/pages/UniversalSymbolIntelligence.tsx");
    expect(src).not.toMatch(/\{report\.confidence\}|\$\{report\.confidence\}|report\.confidence\s*>=|\{report\.confidenceReasoning\}/);
    expect(src).toContain('{ label: "Confidence", value: "Not established", color: "#94A3B8" },');
    expect(notEst(src)).toBe(2);
  });
  it("seismograph narrative banner pattern confidence", () => {
    const src = code("client/src/components/SeismographNarrativeBanner.tsx");
    expect(src).not.toMatch(/p\.confidence/);
    expect(src).toContain('<span data-confidence-status="not-established">confidence not established</span>');
  });
  it("WATCH active patterns", () => {
    const src = code("client/src/pages/Watch.tsx");
    expect(src).not.toMatch(/pattern\.confidence/);
    expect(src).not.toContain("explicit confidence");
    expect(src).toContain('data-confidence-status="not-established">Confidence not established</div>');
  });
  it("aftershock probability", () => {
    const src = code("client/src/pages/AftershockEngine.tsx");
    expect(src).not.toMatch(/signal\.probability\}%/);
    expect(notEst(src)).toBe(1);
  });
  it("PLATO intelligence center message confidenceScore", () => {
    const src = code("client/src/pages/AshaIntelligenceCenter.tsx");
    expect(src).not.toMatch(/msg\.confidenceScore/);
    expect(src).not.toMatch(/%\s*confidence/);
    expect(src).toMatch(/\{msg\.role === "assistant" && \(\s*<span data-confidence-status="not-established"[^>]*>Confidence not established<\/span>/);
  });
  it("recovery confidence gauge + badge", () => {
    const src = code("client/src/components/RecoveryStatus.tsx");
    const gauge = src.slice(src.indexOf("function ConfidenceGauge"), src.indexOf("function AftershockRiskBadge"));
    expect(gauge.length).toBeGreaterThan(100);
    expect(gauge).not.toMatch(/\{score\}|\$\{score\}/);
    expect(src).not.toMatch(/\{confidence\}\/100|\{confidence\}/);
    const badge = src.slice(src.indexOf("export function RecoveryStatusBadge"));
    expect(badge).not.toMatch(/\{confidence|\$\{confidence|not established/);
    expect(notEst(src)).toBe(1);
  });
  it("risk scores: no fixed ±5 band presented as a confidence interval", () => {
    const src = code("client/src/pages/Scores.tsx");
    expect(src).not.toMatch(/confLow|confHigh|Confidence interval|confidence intervals/i);
  });
});

describe("launch fix-up r2: QA gate A/G items", () => {
  it("OracleBriefing never renders a response-confidence %", () => {
    const src = code("client/src/components/OracleBriefing.tsx");
    expect(src).not.toMatch(/data\.confidence/);
    expect(src).not.toMatch(/onfidence[^\n]{0,40}\}%/);
    expect(src).toContain("Response confidence: Not established");
    expect(src).toContain('{ label: "RESPONSE CONFIDENCE", value: "Not established", color: "#E2E8F0" },');
    expect(notEst(src)).toBe(1);
  });
  it("Outlook: no confidence bar", () => {
    const src = code("client/src/pages/Outlook.tsx");
    expect(src).not.toMatch(/width: `\$\{[^`]*probabilityDistribution\.confidence/);
    expect(src).not.toMatch(/probabilityDistribution\.confidence\s*:/);
  });
  it("owner WHY NOW text withholds embedded confidence figures", () => {
    const src = code("client/src/pages/OwnerSimulation.tsx");
    expect(src).toContain("{withholdConfidenceFigures(result.whyNow)}");
    expect(src).toContain("{withholdConfidenceFigures(opp.whyNow)}");
    expect(src).not.toMatch(/\{(?:result|opp)\.whyNow\}/);
  });
  it("day-trade reason text withholds embedded confidence figures", () => {
    const dtd = code("client/src/pages/DayTradeDetail.tsx");
    expect(dtd).toContain("withholdConfidenceFigures(report?.noTradeReason ?? report?.whyTradeExists");
    const dti = code("client/src/pages/DayTradeIntelligence.tsx");
    expect(dti).toContain("withholdConfidenceFigures((s as NoTradeResult).noTradeReason)");
    expect(dti).toContain("withholdConfidenceFigures(ds.whyTradeExists ?? ds.reasonForRecommendation)");
    const usi = code("client/src/pages/UniversalSymbolIntelligence.tsx");
    expect(usi).not.toMatch(/\{report\.(?:noTradeReason|whyTradeExists)\}|\{report\.noTradeReason \?\?/);
    expect((usi.match(/withholdConfidenceFigures\(report\.(?:noTradeReason|whyTradeExists)\)/g) ?? []).length).toBe(4);
  });
});
