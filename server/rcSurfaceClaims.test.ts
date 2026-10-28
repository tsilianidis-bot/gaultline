import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getUserTier: async () => "core" as const };
});
import { laborRatesUnavailableMessage } from "../shared/nowInterpretationCopy";
import { observedDirectionSentence } from "../shared/surfaceClaims";
import { presentCryptoSignal, computeCryptoSignal } from "./cryptoSignals";
import { computeDecision } from "./fmos/engines/decision";
import { buildSectorRotationReading, classifyAction, classifyQuadrant } from "./sectorRotation/calc";
import { omitTradeAction } from "./signalConfidenceBoundary";
import { strategyText } from "./stockRegimeEngine";
import { guardNamedClientFields, neutralConditionLabel, normalizeClientFieldName } from "../shared/clientVocabulary";
import { renderRssFeed } from "./rssFeed";
import { assemblePolygonBarQuote } from "./signalsProxy";
import { buildDay1PressureEmail, buildDay2UpgradeEmail, buildDay3FoundingEmail, buildWelcomeEmail } from "./email";

const NAMED_TRADE_FIELDS = new Set([
  "action", "actionbias", "actionclass", "actiontype", "class", "finalverdictaction",
  "proposedaction", "recommendationaction", "signalaction", "tradeaction", "verdictaction",
]);

function namedTradeClassLeaks(value: unknown, path: string[] = []): string[] {
  if (value == null || typeof value !== "object") return [];
  if (value instanceof Date || value instanceof Map || value instanceof Set || value instanceof URL || value instanceof Error || Buffer.isBuffer(value)) return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => namedTradeClassLeaks(item, [...path, String(index)]));
  const leaks: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string" && NAMED_TRADE_FIELDS.has(normalizeClientFieldName(key))) {
      const label = neutralConditionLabel(child);
      if (label !== child && label !== child.trim()) leaks.push(`${[...path, key].join(".")}=${child}`);
    } else if (child != null && typeof child === "object") {
      leaks.push(...namedTradeClassLeaks(child, [...path, key]));
    }
  }
  return leaks;
}

const BANNED = /\b(?:STRONG BUY|BUY|SELL|HOLD)\b|crash probability|\bRISK[-\s]?ON\b|\bRISK[-\s]?OFF\b|REDUCE EXPOSURE|INCREASE EXPOSURE|\bACCUMULATE\b|\bAVOID\b|\bOVERWEIGHT\b|\bUNDERWEIGHT\b|over-weight|\bENTRY\b|\bSTOP\b|\bTARGET\b|\badd to position\b|\badd exposure\b|\bavoid new positions\b|\btake profits\b|\bscale out\b|\bde-risk\b|(?<![\w.])trim\b(?!\s*\()|(?:\d+(?:\.\d+)?%\s+)?(?:odds|percent|probability|chance) of(?: a)? (?:crash|correction|recession)|\b(?:reduce|cut|lower) (?:leverage|exposure|risk exposure|position size)\b|\bincrease cash allocation\b|\bfavor defensive\b|\bprioriti[sz]e capital preservation\b|\braise (?:reserves|cash)\b|\blighten up\b|\bgo (?:long|short)\b|\bsit in cash\b|\bbuying opportunity\b|\brisk appetite on\b|\d+(?:\.\d+)?%\s+likelihood of a drawdown|(?:\d+(?:\.\d+)?%\s+)?chance of(?: a)? drawdown|crash risk is \d|recession probability \d|bull probability \d/i;
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
  "client/src/pages/seo/StockSignalPage.tsx",
  "server/decisionLight.ts",
  "server/fmos/engines/marketWeather.ts",
  "server/crossMarketEngine.ts",
  "server/simPortfolioJournal.ts",
  "server/xPostGenerator.ts",
  "server/xPoster.ts",
  "server/scheduledXPost.ts",
  "server/scheduledDripEmail.ts",
  "server/email.ts",
  "server/rssFeed.ts",
  "server/signalsProxy.ts",
  "server/scheduledBlog.ts",
  "server/soroBlogFeed.ts",
  "server/fmos/engines/aiInterpretation.ts",
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
  "server/xPoster.ts",
  "server/scheduledXPost.ts",
  "server/scheduledDripEmail.ts",
  "server/email.ts",
  "server/rssFeed.ts",
  "server/signalsProxy.ts",
  "server/scheduledBlog.ts",
  "server/soroBlogFeed.ts",
  "server/fmos/engines/aiInterpretation.ts",
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
  // Denylist source. Customer payloads are scanned from procedure output, not by rewriting this file.
  "shared/clientVocabulary.ts",
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
  return restored.replace(/\u0001(\d+)\u0001/g, (_mark, index) => restore(jsxText[Number(index)] ?? "", masks));
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

function decodeNumericList(args: string): string {
  const chars = args.split(",").map(part => {
    const raw = part.trim();
    const value = /^0x/i.test(raw) ? Number.parseInt(raw, 16) : Number(raw);
    return Number.isFinite(value) ? String.fromCodePoint(value) : "";
  }).join("");
  return `"${chars}"`;
}

function quotedParts(inner: string): string {
  return [...inner.matchAll(/["']([^"']*)["']/g)].map(match => match[1] ?? "").join("");
}

function decodePercentRuns(source: string): string {
  let text = source;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/(?:%(?:25)?[0-9a-fA-F]{2}){2,}/g, (run) => {
      try {
        return decodeURIComponent(run.replace(/%25/gi, "%"));
      } catch {
        return run;
      }
    });
  }
  return text.replace(/decodeURIComponent\(\s*["']([^"']+)["']\s*\)/g, (_all, encoded: string) => {
    try {
      return `"${decodeURIComponent(encoded)}"`;
    } catch {
      return _all;
    }
  });
}

/** NFKD then NFKC, strip format characters, and decode the escapes the scan has to see. */
export function normalizeClaimText(source: string): string {
  let text = source
    .replace(/String\.fromCharCode\.call\(\s*[^,]+,([^)]*)\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/String\.fromCodePoint\.call\(\s*[^,]+,([^)]*)\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/String\.fromCharCode\.apply\(\s*[^,]+,\s*\[([^\]]*)\]\s*\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/String\.fromCodePoint\.apply\(\s*[^,]+,\s*\[([^\]]*)\]\s*\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/Reflect\.apply\(\s*String\.fromCharCode\s*,\s*[^,]+,\s*\[([^\]]*)\]\s*\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_all, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_all, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_all, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\([0-7]{3})/g, (_all, oct: string) => String.fromCharCode(Number.parseInt(oct, 8)))
    .replace(/&#x([0-9a-fA-F]+);?/gi, (_all, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_all, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/String\.fromCodePoint\(([^)]*)\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/String\.fromCharCode\(([^)]*)\)/g, (_all, args: string) => decodeNumericList(args))
    .replace(/atob\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g, (_all, b64: string) => {
      try { return `"${Buffer.from(b64, "base64").toString("utf8")}"`; } catch { return _all; }
    })
    .replace(/Buffer\.from\(\s*["']([A-Za-z0-9+/=]+)["']\s*,\s*["']base64["']\s*\)/g, (_all, b64: string) => {
      try { return `"${Buffer.from(b64, "base64").toString("utf8")}"`; } catch { return _all; }
    })
    .replace(/Buffer\.from\(\s*\[([^\]]*)\]\s*\)/g, (_all, args: string) => decodeNumericList(args));
  text = decodePercentRuns(text);
  const joinInner = String.raw`\[((?:["'][^"']*["']\s*,\s*)*["'][^"']*["'])\]`;
  text = text.replace(new RegExp(`${joinInner}\\.join\\(\\s*(?:["'\`]["'\`]|\\\`\\s*\\\`)?\\s*\\)`, "g"), (_all, inner: string) => `"${quotedParts(inner)}"`);
  text = text.replace(new RegExp(`${joinInner}\\.join\\([^)]*\\)\\.replace\\(\\s*\\/[^/]+\\/g?\\s*,\\s*["']["']\\s*\\)`, "g"), (_all, inner: string) => `"${quotedParts(inner)}"`);
  text = text.replace(new RegExp(`${joinInner}\\.reduce\\(\\s*\\(?\\s*\\w+\\s*,\\s*\\w+\\s*\\)?\\s*=>\\s*\\w+\\s*\\+\\s*\\w+\\s*,\\s*["']["']\\s*\\)`, "g"), (_all, inner: string) => `"${quotedParts(inner)}"`);
  text = text.replace(/(["'])([^"']+)\1\.split\(\s*["'][^"']*["']\s*\)\.join\(\s*(?:["'`]["'`]|`\s*`)?\s*\)/g, (_all, _quote: string, inner: string) => `"${inner.replace(/[^A-Za-z]/g, "")}"`);
  let concatenated = text;
  let previous = "";
  const concatCall = /(["'])((?:\\.|(?!\1).)*)\1\.concat\(([^)]*)\)/g;
  while (concatenated !== previous) {
    previous = concatenated;
    concatenated = concatenated.replace(concatCall, (_all, quote: string, left: string, args: string) => `${quote}${left}${quotedParts(args)}${quote}`);
  }
  concatenated = concatenated.replace(/\{['"]{2}\}/g, "");
  previous = "";
  const pair = /(["'])((?:\\.|(?!\1).)*)\1\s*\+\s*(["'])((?:\\.|(?!\3).)*)\3/g;
  while (concatenated !== previous) {
    previous = concatenated;
    concatenated = concatenated.replace(pair, (_all, quote: string, left: string, _quote: string, right: string) => `${quote}${left}${right}${quote}`);
  }
  return concatenated.normalize("NFKD").normalize("NFKC").replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u3164\uFEFF\uFFA0]/g, "");
}

function decodeRenderedTricks(source: string): string {
  return normalizeClaimText(source);
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
  for (const name of readdirSync("client/src/pages/seo")) {
    if (name.endsWith("Signal.tsx") || name === "StockSignalPage.tsx") seen.add(join("client/src/pages/seo", name));
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
    expect(claimHits('<b>{"BUY"}</b>').length).toBeGreaterThan(0);
    expect(claimHits('<span>{ok ? "BUY" : "SELL"}</span>').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "BU" + "Y";').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = String.fromCharCode(66, 85, 89);").length).toBeGreaterThan(0);
    expect(claimHits("const hidden = String.fromCodePoint(66, 85, 89);").length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "\\u{42}\\u{55}\\u{59}";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "\\x42\\x55\\x59";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "&#66;&#85;&#89;";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "&#x42;&#x55;&#x59;";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B\\u200BUY";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "ＢＵＹ";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = ["B","U","Y"].join("");').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = ['BU','Y'].join('');").length).toBeGreaterThan(0);
    expect(claimHits('const note = "12% chance of a drawdown";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "\\u0042UY";').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = `Se{''}ll`;").length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "%42%55%59";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "%2542%2555%2559";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = decodeURIComponent("%42%55%59");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "\\102\\125\\131";').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = String.fromCharCode.call(null, 66, 85, 89);").length).toBeGreaterThan(0);
    expect(claimHits("const hidden = String.fromCodePoint.call(null, 66, 85, 89);").length).toBeGreaterThan(0);
    expect(claimHits("const hidden = String.fromCharCode.apply(null, [66, 85, 89]);").length).toBeGreaterThan(0);
    expect(claimHits("const hidden = Reflect.apply(String.fromCharCode, null, [66, 85, 89]);").length).toBeGreaterThan(0);
    expect(claimHits('const hidden = atob("QlVZ");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = Buffer.from("QlVZ", "base64");').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = Buffer.from([66, 85, 89]);").length).toBeGreaterThan(0);
    expect(claimHits('const hidden = ["B","U","Y"].join();').length).toBeGreaterThan(0);
    expect(claimHits("const hidden = ['B','U','Y'].join(``);").length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B".concat("U", "Y");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B".concat("U").concat("Y");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = ["B","U","Y"].reduce((a, c) => a + c, "");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B-U-Y".split("-").join("");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = ["B","U","Y"].join("-").replace(/-/g, "");').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B\\u200E\\u200FUY";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B\\u202A\\u202EUY";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B\\u2066UY";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "B\\u180EUY";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "&#66&#85&#89";').length).toBeGreaterThan(0);
    expect(claimHits('const hidden = "\\uFB00".normalize("NFKD");').length).toBe(0);
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
    expect(claimHits('const note = "reduce risk exposure";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "reduce position size";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "increase cash allocation";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "favor defensive";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "prioritize capital preservation";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "de-risk the book";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "scale out";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "add exposure";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "over-weight equities";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "41% likelihood of a drawdown";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "Crash risk is 12%";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "Recession probability 30%";').length).toBeGreaterThan(0);
    expect(claimHits('const note = "Bull probability 60%";').length).toBeGreaterThan(0);
  });

  it("does not hide a buy or sell verdict factory in the detector module", () => {
    const src = readFileSync("shared/surfaceClaims.ts", "utf8");
    const factory = src.slice(src.indexOf("const TRADE_CLASS"), src.indexOf("export function tradeClass"));
    expect(factory).not.toMatch(/STRONG BUY|ACCUMULATE|AVOID|TRIM|REDUCE/);
    expect(src).not.toMatch(/return\s+["']STRONG BUY["']/);
  });

  it("scans real procedure and route outputs from fixture inputs", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 1, role: "user", isQaSession: false, openId: "fixture", email: "fixture@example.com", name: "Fixture", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    } as never);
    const signals = await caller.signals.getTradingSignals({
      tickers: [{
        ticker: "NVDA",
        price: 120,
        open: 118,
        high: 124,
        low: 116,
        changePercent: 1.8,
        volumeMillions: 45,
        avgVolume: 30,
        sparkline: [-0.5, 0.2, 0.8, 1.4, 2.1],
        relativeStrength: 72,
      }],
      regime: { label: "MODERATE RISK", score: 5 },
    });
    const bars = Array.from({ length: 20 }, (_, index) => ({
      timestamp: 1_700_000_000_000 + index * 86_400_000,
      open: 100 + index,
      high: 102 + index,
      low: 99 + index,
      close: 101 + index,
    }));
    const crypto = presentCryptoSignal(computeCryptoSignal({
      market: {
        symbol: "BTC",
        name: "Bitcoin",
        id: "bitcoin",
        currentPrice: 70000,
        marketCap: 1_400_000_000_000,
        totalVolume: 35_000_000_000,
        high24h: 71000,
        low24h: 69000,
        priceChangePercent24h: 2,
        priceChangePercent7d: 5,
        priceChangePercent30d: 10,
        ath: 73750,
        athChangePercent: -5,
        sparkline7d: Array.from({ length: 48 }, (_, index) => 65000 + index * 100),
      } as never,
      ohlcBars: bars,
      btcDominance: 54,
      regime: { label: "Neutral", score: 5 },
    }));
    const below = classifyAction({ quadrant: "LOSING_MOMENTUM", relReturn20dPct: 0, breadthPct: 40, arrow: "DOWN" });
    const lagging = classifyAction({ quadrant: "LAGGING", relReturn20dPct: -3, breadthPct: 20, arrow: "DOWN" });
    const sector = buildSectorRotationReading({
      now: Date.parse("2026-10-02T22:00:00.000Z"),
      canonical: { stateId: null, stateHash: null, stateGeneratedAt: null, runId: null, regime: null, pressureIndex: 42 },
      charts: {},
      fred: {},
      universe: { status: "UNAVAILABLE", name: "fixture", source: "fixture", asOf: null, members: [], reason: "fixture" },
      stockCharts: {},
      news: { status: "UNAVAILABLE", reason: "fixture", items: [] },
    });
    const quote = assemblePolygonBarQuote({ c: 101.25, o: 100, v: 1_500_000 }, 100);
    const rss = renderRssFeed([{
      slug: "pressure-brief",
      title: "Pressure Index is 42/100",
      contentType: "daily_market_brief",
      metaDescription: "Regime label is mixed. No position change is published.",
      content: "The latest completed reading is 42/100.",
      regime: "MODERATE RISK",
      pressureScore: 42,
      publishedAt: new Date("2026-10-28T00:00:00.000Z"),
      createdAt: new Date("2026-10-28T00:00:00.000Z"),
    }]);
    const heldTitle = renderRssFeed([{
      slug: "ticker-hold",
      title: "HOLD",
      contentType: "daily_market_brief",
      metaDescription: null,
      content: "Ticker note.",
      regime: null,
      pressureScore: null,
      publishedAt: null,
      createdAt: new Date("2026-10-28T00:00:00.000Z"),
    }]);
    const emails = [
      buildWelcomeEmail({ name: "Ada", email: "ada@example.com", siteUrl: "https://example.test" }),
      buildDay1PressureEmail({ name: "Ada", email: "ada@example.com", siteUrl: "https://example.test" }),
      buildDay2UpgradeEmail({ name: "Ada", email: "ada@example.com", siteUrl: "https://example.test" }),
      buildDay3FoundingEmail({ name: "Ada", email: "ada@example.com", siteUrl: "https://example.test" }),
    ].map(message => `${message.subject}\n${message.html}`).join("\n");
    const decision = computeDecision(
      { overallPressure: 72, vectors: [], regime: "HIGH STRESS", alerts: [], dataSource: "live", level: "High" } as never,
      { currentRegime: "HIGH STRESS", confidence: 40, stability: 30, transitionRisk: 20, mostLikelyNextRegime: "HIGH STRESS", transitionProbability30d: 10, alternativeScenarios: [] } as never,
      { bull: 20, bear: 60, primaryDriver: "credit vector", bullEvidence: ["credit vector is elevated"], bearEvidence: ["pressure is elevated"], invalidationConditions: [] } as never,
      { score: 55, label: "Moderate" } as never,
      { score: 70 } as never,
    );
    const outputs = guardNamedClientFields({
      signals,
      crypto,
      decision,
      stockRegime: strategyText("Bear Market", 80),
      sector,
      sectorConditions: [
        { conditionId: below.conditionId },
        { conditionId: lagging.conditionId },
      ],
      now: laborRatesUnavailableMessage(),
      quote,
      quadrant: classifyQuadrant(1.1, 0.2),
    });
    expect(below.conditionId).not.toBe(lagging.conditionId);
    expect(heldTitle).toContain("<title>HOLD</title>");
    const json = JSON.stringify(outputs);
    expect(namedTradeClassLeaks(outputs)).toEqual([]);
    expect(claimHits(json)).toEqual([]);
    expect(claimHits(rss)).toEqual([]);
    expect(claimHits(emails)).toEqual([]);
    expect(json).not.toMatch(/reduce risk exposure|reduce position size|increase cash allocation|prioritize capital preservation/i);
    expect(signals[0]).not.toHaveProperty("action");
    expect(crypto).not.toHaveProperty("action");
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
