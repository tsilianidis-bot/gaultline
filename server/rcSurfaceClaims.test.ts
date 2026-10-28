import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BANNED = /\b(?:STRONG BUY|BUY|SELL|HOLD)\b|crash probability|\bRISK[-\s]?ON\b|\bRISK[-\s]?OFF\b|REDUCE EXPOSURE|INCREASE EXPOSURE|\bACCUMULATE\b|\bAVOID\b|\bOVERWEIGHT\b|\bUNDERWEIGHT\b|\bENTRY\b|\bSTOP\b|\bTARGET\b/i;

const ROOTS = [
  "client/src/pages/mobile/MobileSignals.tsx",
  "client/src/pages/mobile/MobileCrypto.tsx",
  "client/src/pages/CryptoSignals.tsx",
  "client/src/components/sectorRotation/SectorRotationModule.tsx",
  "client/src/pages/SmartDiscovery.tsx",
  "client/src/pages/IntelligenceHub.tsx",
  "client/src/pages/Opportunities.tsx",
  "client/src/components/OpportunityDiscoveryPanel.tsx",
  "client/src/components/DashboardSearchPanels.tsx",
  "client/src/pages/SituationRoom.tsx",
  "client/src/components/PortfolioCommandCenter.tsx",
  "client/src/pages/SimPortfolio.tsx",
  "client/src/pages/OwnerSimulation.tsx",
  "client/src/pages/ValidationLab.tsx",
  "client/src/pages/Dashboard.tsx",
  "client/src/pages/seo/MarketCrashIndicator.tsx",
  "client/src/pages/seo/CreditMarketStress.tsx",
  "client/src/pages/seo/MarketRegimeTracker.tsx",
  "client/src/pages/seo/vs/VsBloomberg.tsx",
  "client/src/pages/PublicSharedReport.tsx",
  "client/src/pages/Signals.tsx",
  "client/src/pages/seo/TSLASignal.tsx",
  "client/src/pages/seo/AMDSignal.tsx",
  "client/src/pages/SignalOutlookCenter.tsx",
  "client/src/pages/UniversalSymbolIntelligence.tsx",
  "client/src/pages/MarketCommandCenter.tsx",
  "client/src/pages/Scenarios.tsx",
  "client/src/pages/DailyReport.tsx",
  "client/src/pages/TradePreflight.tsx",
  "client/src/pages/Act.tsx",
  "client/src/pages/Portfolio.tsx",
  "client/src/pages/DayTradeIntelligence.tsx",
  "client/src/pages/Markets.tsx",
  "client/src/pages/SeismographIntelligence.tsx",
  "client/src/components/NarrativeLoader.tsx",
  "server/tradePreflight.ts",
  "server/routers.ts",
  "client/src/pages/mobile/MobileRotation.tsx",
  "client/src/pages/mobile/MobileBrief.tsx",
  "client/src/pages/SeismographicDash.tsx",
  "client/src/pages/Press.tsx",
  "client/src/pages/Guide.tsx",
  "client/src/components/landing/thesis/thesisContent.ts",
  "server/decisionLight.ts",
  "server/fmos/engines/marketWeather.ts",
  "server/crossMarketEngine.ts",
  "server/simPortfolioJournal.ts",
  "server/xPostGenerator.ts",
  "server/ownerSimulation.ts",
  "server/cryptoSignals.ts",
  "server/cryptoEngine.ts",
  "server/signalOutlook.ts",
  "server/positionGuidance.ts",
  "server/chatbotEngine.ts",
  "server/cryptoIntelligence.ts",
  "server/cryptoRegimeEngine.ts",
  "server/diagnosticAI.ts",
  "server/simPortfolioEngine.ts",
  "server/fmos/engines/decision.ts",
  "server/historicalIntelligenceEngine.ts",
  "server/ashaEngine.ts",
];

const SERVER_PAYLOADS = new Set([
  "server/tradePreflight.ts",
  "server/decisionLight.ts",
  "server/fmos/engines/marketWeather.ts",
  "server/crossMarketEngine.ts",
  "server/simPortfolioJournal.ts",
  "server/xPostGenerator.ts",
  "server/ownerSimulation.ts",
  "server/cryptoSignals.ts",
  "server/cryptoEngine.ts",
  "server/signalOutlook.ts",
  "server/positionGuidance.ts",
  "server/chatbotEngine.ts",
  "server/cryptoIntelligence.ts",
  "server/cryptoRegimeEngine.ts",
  "server/diagnosticAI.ts",
  "server/simPortfolioEngine.ts",
  "server/fmos/engines/decision.ts",
  "server/historicalIntelligenceEngine.ts",
  "server/ashaEngine.ts",
]);

const SKIP_FILES = new Set([
  "shared/surfaceClaims.ts",
  // Stored class names. Screens render ACTION_LABEL, which does not use these tokens.
  "shared/sectorRotation.ts",
  "shared/decisionLight.ts",
  "shared/systemicRegime.ts",
  "shared/ashaQuestionAnalysis.ts",
  "shared/interpretationIntegrity.ts",
  "server/pressure/engine.ts",
  "server/pressure/fredFixtureEvidence.ts",
  "server/seismographUnified.ts",
]);

function maskStrings(source: string): { text: string; masks: string[] } {
  const masks: string[] = [];
  const text = source.replace(/`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) => {
    masks.push(match);
    return `\u0000${masks.length - 1}\u0000`;
  });
  return { text, masks };
}

function restore(text: string, masks: string[]): string {
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => masks[Number(index)] ?? "");
}

/**
 * One pass: comments are skipped before quotes are read, so an apostrophe
 * in a comment ("Today's") cannot hide the rest of the file, and "//" inside
 * a string ("https://x") cannot hide text later on the line.
 */
export function visibleCopy(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if ((c === "\"" || c === "`" || (c === "'" && singleQuoteStartsString(source, i)))) {
      const quote = c;
      out += c;
      i += 1;
      while (i < source.length) {
        const ch = source[i] ?? "";
        if (ch === "\\") {
          out += ch + (source[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (quote === "`" && ch === "$" && source[i + 1] === "{") {
          out += "${";
          i += 2;
          let depth = 1;
          while (i < source.length && depth > 0) {
            const inner = source[i] ?? "";
            if (inner === "{") depth += 1;
            else if (inner === "}") depth -= 1;
            out += inner;
            i += 1;
          }
          continue;
        }
        out += ch;
        i += 1;
        if (ch === quote) break;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out
    .split("\n")
    .filter(line => !/^\s*["'`]?\/[A-Za-z0-9\-._/~]*["'`]?,?\s*$/.test(line))
    .map(scrubCodeKeepQuotes)
    .join("\n");
}

function singleQuoteStartsString(source: string, index: number): boolean {
  let j = index - 1;
  while (j >= 0 && /\s/.test(source[j] ?? "")) j -= 1;
  if (j < 0) return true;
  return !/[A-Za-z0-9_]/.test(source[j] ?? "");
}

function scrubCodeKeepQuotes(line: string): string {
  const { text, masks } = maskStrings(line);
  const scrubbed = text
    .replace(/\.target\b/g, "")
    .replace(/\.\s*stop\b/g, "")
    .replace(/<\/?stop\b/gi, "")
    .replace(/\bTarget\b/g, "")
    .replace(/\bentry\./gi, ".")
    .replace(/\(entry\)/gi, "()")
    .replace(/\bconst entry\b/gi, "const row")
    .replace(/\bentry\s*=>/gi, "row =>")
    .replace(/\btarget\s*=/gi, "=")
    .replace(/\b(?:entry|stop|target)\b/gi, "row")
    .replace(/\b(?:BUY|SELL|HOLD|AVOID)\b/gi, "ROW")
    .replace(/\bhold\s*:/gi, "kept:")
    .replace(/\bentry is\b/g, "row is");
  return restore(scrubbed, masks).replace(/["'`]\/[^"'`]*["'`]/g, '""');
}

function repoPath(file: string): string {
  const absolute = resolve(file);
  const root = resolve(".");
  return absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : file;
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let base = specifier;
  if (specifier.startsWith("@/")) base = join("client/src", specifier.slice(2));
  else if (specifier.startsWith("@shared/")) base = join("shared", specifier.slice("@shared/".length));
  else if (specifier.startsWith(".")) base = resolve(join(fromFile, ".."), specifier);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  const found = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
  return found ? repoPath(found) : null;
}

function importedSpecifiers(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) found.push(match[1] ?? "");
  return found;
}

function reachableFiles(roots: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file) || !existsSync(file) || file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    if (SKIP_FILES.has(file) || file.startsWith("server/pressure/")) continue;
    if (file.startsWith("client/src/lib/") || file.startsWith("client/src/contexts/")) continue;
    if (file.startsWith("server/") && !SERVER_PAYLOADS.has(file) && !file.startsWith("server/routers/") && !file.startsWith("server/fmos/engines/")) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const specifier of importedSpecifiers(source)) {
      const next = resolveImport(file, specifier);
      if (!next) continue;
      const normalized = next.replace(/\\/g, "/");
      if (normalized.startsWith("client/src/") || normalized.startsWith("shared/") || normalized.startsWith("server/")) {
        queue.push(normalized);
      }
    }
  }
  for (const name of readdirSync("client/src/pages/seo/learn")) {
    if (name.endsWith(".tsx")) seen.add(join("client/src/pages/seo/learn", name));
  }
  for (const name of readdirSync("server/routers")) {
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) seen.add(join("server/routers", name));
  }
  return [...seen].sort();
}

describe("release-candidate surfaces do not print trade directives or crash-probability text", () => {
  it("keeps text that follows a URL on the same line", () => {
    const sample = 'const href = "https://x"; const label = "STRONG BUY";';
    const hits = visibleCopy(sample).split("\n").filter(line => BANNED.test(line));
    expect(hits.length).toBeGreaterThan(0);
  });

  it("keeps text that follows a comment containing an apostrophe", () => {
    const sample = "/* Today's Story */\nconst label = \"RISK-ON\";";
    const hits = visibleCopy(sample).split("\n").filter(line => BANNED.test(line));
    expect(hits.length).toBeGreaterThan(0);
  });

  const files = reachableFiles(ROOTS);
  it("follows routed imports past the old fixed list", () => {
    expect(files).toContain("client/src/components/AshaHeroSection.tsx");
    expect(files).toContain("client/src/components/dashboard/FaultlineInterpretation.tsx");
    expect(files).toContain("server/tradePreflight.ts");
    expect(files).toContain("client/src/pages/mobile/MobileRotation.tsx");
    expect(files).toContain("server/decisionLight.ts");
    expect(files).toContain("server/fmos/engines/marketWeather.ts");
    expect(files).toContain("server/crossMarketEngine.ts");
    expect(files).toContain("server/simPortfolioJournal.ts");
    expect(files).toContain("server/xPostGenerator.ts");
  });

  for (const file of files) {
    it(file, () => {
      const hits = visibleCopy(readFileSync(file, "utf8"))
        .split("\n")
        .map(line => line.replace(/\$\{[^}]*\}/g, ""))
        .map(line => line.replace(/(["'`])(?:STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD|TRIM|ACCUMULATE|AVOID|REDUCE)\1/gi, '""'))
        .flatMap((line, index) => (BANNED.test(line) ? [`${file}:${index + 1}: ${line.trim().slice(0, 220)}`] : []));
      expect(hits).toEqual([]);
    });
  }
});
