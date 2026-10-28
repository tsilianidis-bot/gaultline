import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BANNED = /\b(?:STRONG BUY|BUY|SELL|HOLD)\b|crash probability|\bRISK[-\s]?ON\b|\bRISK[-\s]?OFF\b|REDUCE EXPOSURE|INCREASE EXPOSURE|\bACCUMULATE\b|\bAVOID\b|\bOVERWEIGHT\b|\bUNDERWEIGHT\b|\bENTRY\b|\bSTOP\b|\bTARGET\b/i;

const FILES = [
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
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");
}

/**
 * Comment-stripped copy. Quoted text is preserved. Code identifiers
 * (.target, SVG stop, the Lucide Target icon, and unquoted entry variables)
 * are removed before the posture check. Route-only lines are skipped.
 */
function scrubCodeKeepQuotes(line: string): string {
  const masks: string[] = [];
  const masked = line.replace(/`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) => {
    masks.push(match);
    return `\u0000${masks.length - 1}\u0000`;
  });
  const scrubbed = masked
    .replace(/\.target\b/g, "")
    .replace(/<\/?stop\b/gi, "")
    .replace(/\bTarget\b/g, "")
    .replace(/\bentry\./gi, ".")
    .replace(/\(entry\)/gi, "()")
    .replace(/\bconst entry\b/gi, "const row")
    .replace(/\bentry\s*=>/gi, "row =>")
    .replace(/\btarget\s*=/gi, "=");
  return scrubbed
    .replace(/\u0000(\d+)\u0000/g, (_, index) => masks[Number(index)])
    .replace(/["'`]\/[^"'`]*["'`]/g, '""');
}

function visibleCopy(source: string): string {
  return stripComments(source)
    .split("\n")
    .filter(line => !/^\s*["'`]?\/[A-Za-z0-9\-._/~]*["'`]?,?\s*$/.test(line))
    .map(scrubCodeKeepQuotes)
    .join("\n");
}

function learnFiles(): string[] {
  const dir = "client/src/pages/seo/learn";
  return readdirSync(dir)
    .filter(name => name.endsWith(".tsx"))
    .map(name => join(dir, name));
}

describe("release-candidate surfaces do not print trade directives or crash-probability text", () => {
  for (const file of [...FILES, ...learnFiles()]) {
    it(file, () => {
      expect(statSync(file).isFile()).toBe(true);
      const hits = visibleCopy(readFileSync(file, "utf8"))
        .split("\n")
        .flatMap((line, index) => (BANNED.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : []));
      expect(hits).toEqual([]);
    });
  }
});
