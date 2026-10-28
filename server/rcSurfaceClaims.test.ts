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
];

const SKIP_FILES = new Set([
  "shared/surfaceClaims.ts",
  // Stored class names. Screens render ACTION_LABEL, which does not use these tokens.
  "shared/sectorRotation.ts",
  "shared/decisionLight.ts",
  "shared/systemicRegime.ts",
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
 * Strings are masked before // comments are removed, so a URL such as
 * "https://x" does not swallow the rest of the line.
 */
export function visibleCopy(source: string): string {
  const { text, masks } = maskStrings(source);
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");
  return restore(stripped, masks)
    .split("\n")
    .filter(line => !/^\s*["'`]?\/[A-Za-z0-9\-._/~]*["'`]?,?\s*$/.test(line))
    .map(scrubCodeKeepQuotes)
    .join("\n");
}

function scrubCodeKeepQuotes(line: string): string {
  const { text, masks } = maskStrings(line);
  const scrubbed = text
    .replace(/\.target\b/g, "")
    .replace(/<\/?stop\b/gi, "")
    .replace(/\bTarget\b/g, "")
    .replace(/\bentry\./gi, ".")
    .replace(/\(entry\)/gi, "()")
    .replace(/\bconst entry\b/gi, "const row")
    .replace(/\bentry\s*=>/gi, "row =>")
    .replace(/\btarget\s*=/gi, "=")
    .replace(/\b(?:entry|stop|target)\b(?=\s*[,:)\]}=;])/gi, "row")
    .replace(/\bhold\s*:/gi, "kept:");
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
    if (file.startsWith("server/") && file !== "server/tradePreflight.ts" && !file.startsWith("server/routers/")) continue;
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

  const files = reachableFiles(ROOTS);
  it("follows routed imports past the old fixed list", () => {
    expect(files).toContain("client/src/components/AshaHeroSection.tsx");
    expect(files).toContain("client/src/components/dashboard/FaultlineInterpretation.tsx");
    expect(files).toContain("server/tradePreflight.ts");
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
