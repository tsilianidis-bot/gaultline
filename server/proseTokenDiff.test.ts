import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";
import { neutralizeChannelText } from "../shared/clientVocabulary";

const BASELINE = "3eef438e1ca7ce06c093400039d53439d61b642d";
const require = createRequire(import.meta.url);

const CI_TOKENS = [
  "STRONG BUY",
  "BUY NOW",
  "STRONG SELL",
  "STRONG REDUCE",
  "ADD GRADUALLY",
  "PASS OVER",
  "ACCUMULATE",
  "ACQUIRE",
  "OVERWEIGHT",
  "UNDERWEIGHT",
  "BUY",
  "SELL",
];

const CAPS_ONLY = ["REDUCE", "AVOID", "HOLD", "ADD", "KEEP", "WAIT"];

function sentenceCase(token: string): string {
  return token.split(" ").map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}

function wrap(token: string): string[] {
  return [
    token,
    `We ${token} costs`,
    `Please ${token} now`,
    `**${token}**`,
    `[${token}](url)`,
    `${token} NVDA`,
    `${token} $NVDA`,
    `Top 5 stocks to ${token}`,
    `Analysts rate it ${token}`,
  ];
}

function matrix(): string[] {
  const out: string[] = [];
  for (const token of CI_TOKENS.concat(CAPS_ONLY)) {
    for (const form of [token, token.toLowerCase(), sentenceCase(token)]) {
      out.push(...wrap(form));
    }
  }
  out.push(
    "Sell now",
    "Buy the dip",
    "Strong Buy",
    "Top 5 stocks to buy",
    "Analysts rate it Buy",
    "**Sell**",
    "[Buy](url)",
    "We reduce costs",
    "How to reduce stress",
    "Reduce the position",
    "We avoid crowds",
    "Avoid the draft",
    "Avoid NVDA",
    "Avoid $NVDA",
    "avoid NVDA",
    "We hold the line",
    "Hold the line",
    "Please HOLD",
    "ADD a note",
    "KEEP going",
    "WAIT here",
  );
  return out;
}

function extractStrings(source: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const quote = source[index];
    if (quote !== "\"" && quote !== "'" && quote !== "`") continue;
    let cursor = index + 1;
    let value = "";
    let skip = false;
    while (cursor < source.length) {
      const char = source[cursor] ?? "";
      if (char === "\\") {
        const next = source[cursor + 1] ?? "";
        const mapped: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", "\"": "\"", "`": "`" };
        value += mapped[next] ?? next;
        cursor += 2;
        continue;
      }
      if (quote === "`" && char === "$" && source[cursor + 1] === "{") {
        skip = true;
        break;
      }
      if (char === quote) {
        cursor += 1;
        break;
      }
      value += char;
      cursor += 1;
      if (value.length > 20000) {
        skip = true;
        break;
      }
    }
    if (!skip && value.length > 0) out.push(value);
    index = cursor - 1;
  }
  return out;
}

function testCorpus(): string[] {
  const files = execFileSync("git", ["ls-files", "*.test.ts", "*.test.tsx"], { encoding: "utf8" })
    .split("\n")
    .map(file => file.trim())
    .filter(Boolean);
  const seen = new Set<string>(matrix());
  for (const file of files) {
    for (const value of extractStrings(readFileSync(file, "utf8"))) seen.add(value);
  }
  return [...seen];
}

/** Remove only the spans whose case rules differ from 3eef438. */
function freezeSix(text: string): string {
  return text
    .replace(/\bADD\b(?!\s+GRADUALLY)/g, "ZZZ")
    .replace(/\b(?:HOLD|KEEP|WAIT)\b/g, "ZZZ")
    .replace(/(?<![Ss][Tt][Rr][Oo][Nn][Gg] )\b(?:reduce|Reduce)\b/g, "zzz")
    .replace(/\bavoid\b/g, "zzz")
    .replace(/\bAvoid\b(?!\s+(?:\$[A-Z]{1,5}(?:\.[A-Z])?|[A-Z]{1,5}(?:\.[A-Z])?)\b)/g, "zzz");
}

function loadBaseline(): (text: string) => string {
  const source = execFileSync("git", ["show", `${BASELINE}:shared/clientVocabulary.ts`], { encoding: "utf8" });
  const bundled = esbuild.buildSync({
    stdin: { contents: source, loader: "ts", sourcefile: "clientVocabulary.ts" },
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
  });
  const dir = mkdtempSync(join(tmpdir(), "prose-3eef438-"));
  const file = join(dir, "old.cjs");
  writeFileSync(file, bundled.outputFiles[0]?.text ?? "");
  const loaded = require(file) as { neutralizeChannelText: (text: string) => string };
  return loaded.neutralizeChannelText;
}

describe("prose diff against 3eef438", () => {
  it("differs only for REDUCE, AVOID, HOLD, ADD, KEEP, and WAIT", () => {
    const baseline = loadBaseline();
    const generated = new Set(matrix());
    const corpus = testCorpus();
    let diffs = 0;
    let testDiffs = 0;
    const byToken: Record<string, number> = { REDUCE: 0, AVOID: 0, HOLD: 0, ADD: 0, KEEP: 0, WAIT: 0 };
    const unexplained: string[] = [];
    for (const sample of corpus) {
      const before = baseline(sample);
      const after = neutralizeChannelText(sample);
      const frozen = freezeSix(sample);
      expect(baseline(frozen)).toBe(neutralizeChannelText(frozen));
      if (before === after) continue;
      diffs += 1;
      if (!generated.has(sample)) testDiffs += 1;
      if (frozen === sample) unexplained.push(sample.slice(0, 180));
      if (/(?<![Ss][Tt][Rr][Oo][Nn][Gg] )\b(?:reduce|Reduce)\b/.test(sample)) byToken.REDUCE += 1;
      if (/\bavoid\b/.test(sample) || /\bAvoid\b(?!\s+(?:\$[A-Z]{1,5}(?:\.[A-Z])?|[A-Z]{1,5}(?:\.[A-Z])?)\b)/.test(sample)) byToken.AVOID += 1;
      if (/\bHOLD\b/.test(sample)) byToken.HOLD += 1;
      if (/\bADD\b(?!\s+GRADUALLY)/.test(sample)) byToken.ADD += 1;
      if (/\bKEEP\b/.test(sample)) byToken.KEEP += 1;
      if (/\bWAIT\b/.test(sample)) byToken.WAIT += 1;
    }
    expect(unexplained).toEqual([]);
    expect(diffs).toBeGreaterThan(0);
    console.log(`prose diff against 3eef438: ${diffs} of ${corpus.length} corpus strings (${testDiffs} from test literals); ${JSON.stringify(byToken)}`);
  });
});
