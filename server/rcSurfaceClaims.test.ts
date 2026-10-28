import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BANNED = /\b(?:STRONG BUY|BUY|SELL|HOLD)\b|crash probability/i;

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
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");
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
      const hits = stripComments(readFileSync(file, "utf8"))
        .split("\n")
        .flatMap((line, index) => (BANNED.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : []));
      expect(hits).toEqual([]);
    });
  }
});
