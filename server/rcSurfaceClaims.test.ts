import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { observedDirectionSentence } from "../shared/surfaceClaims";
import { omitTradeAction } from "./signalConfidenceBoundary";

const BANNED = /\b(?:STRONG BUY|BUY|SELL|HOLD)\b|crash probability|\bRISK[-\s]?ON\b|\bRISK[-\s]?OFF\b|REDUCE EXPOSURE|INCREASE EXPOSURE|\bACCUMULATE\b|\bAVOID\b|\bOVERWEIGHT\b|\bUNDERWEIGHT\b|\bENTRY\b|\bSTOP\b|\bTARGET\b|\badd to position\b|\bavoid new positions\b|\btake profits\b|(?<![\w.])trim\b(?!\s*\()|(?:\d+(?:\.\d+)?%\s+)?(?:odds|percent|probability|chance) of(?: a)? (?:crash|correction|recession)|\b(?:reduce|cut|lower) (?:leverage|exposure)\b|\braise (?:reserves|cash)\b|\blighten up\b|\bgo (?:long|short)\b|\bsit in cash\b|\bbuying opportunity\b|\brisk appetite on\b/i;
const EXACT_PROTOCOL = "STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD|TRIM|ACCUMULATE|AVOID|REDUCE";

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
  "server/tradingSignals.ts",
  "server/scheduledSimPortfolio.ts",
  "server/insiderIntelligence.ts",
  "server/preFlight.ts",
  "client/src/components/ProductExperience.tsx",
];

function routedPageRoots(): string[] {
  const app = readFileSync("client/src/App.tsx", "utf8");
  const specs = new Set<string>();
  for (const match of app.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g)) specs.add(match[1] ?? "");
  for (const match of app.matchAll(/from\s+["'](\.\/(?:pages|components)[^"']+)["']/g)) specs.add(match[1] ?? "");
  const files: string[] = [];
  for (const spec of specs) {
    const resolved = resolveImport("client/src/App.tsx", spec);
    if (resolved) files.push(resolved);
  }
  return files;
}

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
  "server/tradingSignals.ts",
  "server/scheduledSimPortfolio.ts",
  "server/insiderIntelligence.ts",
  "server/preFlight.ts",
]);

const SKIP_FILES = new Set([
  "shared/surfaceClaims.ts",
  // Stored class names. Screens render ACTION_LABEL, which does not use these tokens.
  "shared/sectorRotation.ts",
  "shared/decisionLight.ts",
  "shared/systemicRegime.ts",
  "shared/ashaQuestionAnalysis.ts",
  // Classifies the user's own question. It does not render these tokens.
  "client/src/lib/askIntentClassifier.ts",
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
  const jsxText: string[] = [];
  const protectedText = text.replace(/(?<!=)>([^<]*)</g, (_full, inner: string) => {
    const scrubbedInner = inner.replace(/\{[^{}]*\}/g, expr => expr
      .replace(/\b(?:entry|stop|target)\b/gi, "row")
      .replace(/\b(?:BUY|SELL|HOLD|AVOID)\b/g, "ROW"));
    jsxText.push(scrubbedInner);
    return `>\u0001${jsxText.length - 1}\u0001<`;
  });
  const scrubbed = protectedText
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
    .replace(/\b(?:BUY|SELL|HOLD|AVOID|TRIM)\b/g, "ROW")
    .replace(/\bhold\s*:/gi, "kept:")
    .replace(/\bentry is\b/g, "row is");
  const restored = restore(scrubbed, masks).replace(/["'`]\/[A-Za-z0-9\-._/~]*["'`]/g, '""');
  return restored.replace(/\u0001(\d+)\u0001/g, (_mark, index) => jsxText[Number(index)] ?? "");
}

/** Exact protocol quotes are exempt only inside a type union, an enum() list, or a comparison. */
export function exemptNonRenderedTokens(line: string): string {
  if (/^\s*(?:export\s+)?type\s+/.test(line)) {
    return line.replace(new RegExp(`(["'\`])(?:${EXACT_PROTOCOL})\\1`, "gi"), '""');
  }
  const exact = new RegExp(`(["'\`])(?:${EXACT_PROTOCOL})\\1`, "gi");
  return line.replace(exact, (match, _quote, offset, whole) => {
    const source = String(whole);
    const before = source.slice(0, offset);
    const after = source.slice(offset + match.length);
    if (/(?:===|!==|==|!=)\s*$/.test(before)) return '""';
    if (/\|\s*$/.test(before) || /^\s*\|/.test(after)) return '""';
    if (/\benum\s*\(\s*\[[^\]]*$/.test(before)) return '""';
    return match;
  });
}

function decodeRenderedTricks(source: string): string {
  const unicode = source.replace(/\\u([0-9a-fA-F]{4})/g, (_all, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return unicode.replace(/\{['"]{2}\}/g, "");
}

export function claimHits(source: string): string[] {
  return visibleCopy(decodeRenderedTricks(source))
    .split("\n")
    .map(line => line.replace(/\$\{[^}]*\}/g, ""))
    .map(line => line.replace(/\bentry(?=\s*=>|\s*\.|\s*\))/gi, "row").replace(/\.target\b/g, ""))
    .map(exemptNonRenderedTokens)
    .map(line => /does not (?:offer|publish|imply)|not a crash probability|no governed/i.test(line)
      ? line.replace(/crash probability/gi, "withheld event")
      : line)
    .flatMap((line, index) => (BANNED.test(line) ? [`${index + 1}: ${line.trim().slice(0, 220)}`] : []));
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
    expect(claimHits(sample).length).toBeGreaterThan(0);
  });

  it("scans JSX text instead of rewriting BUY/SELL/HOLD/AVOID to ROW", () => {
    expect(claimHits("<li>Unlimited stock signals (BUY/SELL/HOLD)</li>").length).toBeGreaterThan(0);
    expect(claimHits("<p>AVOID new risk</p>").length).toBeGreaterThan(0);
  });

  it("catches a rendered exact token and exempts type members and comparisons", () => {
    expect(claimHits('const label = "STRONG BUY";').length).toBeGreaterThan(0);
    expect(claimHits('type Action = "BUY" | "SELL" | "HOLD";')).toEqual([]);
    expect(claimHits('if (action === "BUY") return;')).toEqual([]);
    expect(claimHits('const label = "BUY";').length).toBeGreaterThan(0);
    expect(claimHits('return "SELL";').length).toBeGreaterThan(0);
    expect(claimHits('const shown = ok ? "BUY" : "SELL";').length).toBeGreaterThan(0);
    expect(claimHits('case "HOLD": return label;').length).toBeGreaterThan(0);
    expect(claimHits('{"BUY"}').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "\\u0042UY";').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = `Se{''}ll`;").length).toBeGreaterThan(0);
  });

  it("does not flag code property access", () => {
    expect(claimHits("onChange={event => setX(event.target.value)}")).toEqual([]);
    expect(claimHits("<div>{entry.symbol}</div>")).toEqual([]);
  });

  it("scans rendered text and the client signal payload", async () => {
    const payload = omitTradeAction({
      action: "BUY",
      actionLabel: "RSI(14) is 28 on the latest completed daily bars.",
      confidence: null,
    });
    const sold = omitTradeAction({
      action: "SELL",
      actionLabel: "RSI(14) is 74 on the latest completed daily bars.",
      confidence: null,
    });
    const json = JSON.stringify({ signals: [payload, sold] });
    expect(json).not.toMatch(/\b(?:BUY|SELL|HOLD)\b/);
    expect(payload).not.toHaveProperty("action");
    expect(payload.direction).toBe("positive");
    const [{ default: Stocks }, { default: Vol }, { default: Cycles }] = await Promise.all([
      import("../client/src/pages/seo/IsNowGoodTimeToBuyStocks"),
      import("../client/src/pages/seo/VolatilityDashboard"),
      import("../client/src/pages/seo/learn/LearnCryptoCycles"),
    ]);
    const html = [
      renderToStaticMarkup(createElement(Stocks)),
      renderToStaticMarkup(createElement(Vol)),
      renderToStaticMarkup(createElement(Cycles)),
      renderToStaticMarkup(createElement("section", null, observedDirectionSentence("BUY"), observedDirectionSentence("SELL"), payload.actionLabel)),
    ].join("\n");
    expect(html).not.toMatch(/\b(?:BUY|SELL|HOLD)\b|\bbuying opportunity\b|\btake profits\b|\braise cash\b|\badd to position\b/i);
  });

  it("catches directive phrases the old token list missed", () => {
    expect(claimHits('const href = "/avoid new positions";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "41% chance of a crash";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "Add to position on weakness";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "take profits on the rally";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "odds of a recession";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "reduce leverage";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "raise cash";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "lighten up";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "go short";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "sit in cash";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "buying opportunity";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "risk appetite on";').length).toBeGreaterThan(0);
  });

  const files = reachableFiles([...routedPageRoots(), ...ROOTS]);
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
    expect(files).toContain("client/src/pages/UserAccount.tsx");
    expect(files).toContain("client/src/pages/seo/NVDASignal.tsx");
    expect(files.some(file => file.startsWith("client/src/lib/"))).toBe(true);
    expect(files.some(file => file.startsWith("client/src/contexts/"))).toBe(true);
  });

  for (const file of files) {
    it(file, () => {
      const hits = claimHits(readFileSync(file, "utf8")).map(hit => `${file}:${hit}`);
      expect(hits).toEqual([]);
    });
  }
});
