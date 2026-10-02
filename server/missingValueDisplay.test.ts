import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MISSING_VALUE_TEXT,
  canonicalScoreText,
  finiteOrNull,
  pointsDeltaText,
  score100Value,
  similarityText,
} from "../client/src/lib/displayFallbacks";

// James's rule: a missing value shows Unavailable or "—", never 0.
const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("missing-value display helpers", () => {
  it("a missing pressure renders an em dash with no digit", () => {
    for (const missing of [null, undefined, Number.NaN, Infinity, "42"]) {
      const text = canonicalScoreText(missing);
      expect(text).toBe(MISSING_VALUE_TEXT);
      expect(text).not.toMatch(/\d/);
    }
    expect(canonicalScoreText(0)).toBe("0/100");
    expect(canonicalScoreText(37.25)).toBe("37.3/100");
  });

  it("a missing similarity is null and renders an em dash", () => {
    for (const missing of [null, undefined, Number.NaN]) {
      expect(finiteOrNull(missing)).toBeNull();
      expect(similarityText(missing)).toBe(MISSING_VALUE_TEXT);
      expect(similarityText(missing)).not.toMatch(/\d/);
    }
    expect(similarityText(91.4)).toBe("91%");
  });
});

describe("Act pressure has no 0 fallback", () => {
  const act = read("client/src/pages/Act.tsx");
  it("keeps a missing pressureIndex null and renders it through the dash helper", () => {
    expect(act).not.toMatch(/pressureIndex\s*\?\?\s*0/);
    expect(act).toMatch(/const pressure = finiteOrNull\(canonicalState\.pressureIndex\)/);
    expect(act).toContain("{canonicalScoreText(pressure)}");
    expect(act).not.toMatch(/formatCanonicalScore\(pressure\)/);
  });
});

describe("Dashboard (routed at /app/now/deep) has no similarity 0 or /10 score", () => {
  const dashboard = read("client/src/pages/Dashboard.tsx");
  it("is a routed page", () => {
    expect(read("client/src/App.tsx")).toMatch(/<Route path=\{NOW_DEEP_PATH\} component=\{Dashboard\} \/>/);
  });
  it("never falls back to similarity 0 and renders no raw similarity", () => {
    expect(dashboard).not.toMatch(/similarity\s*\?\?\s*0/);
    expect(dashboard).not.toMatch(/\{analogs?(\[0\])?\.similarity\}%/);
    expect(dashboard).not.toMatch(/\$\{(topAnalog|analog|analogs\[0\])\??\.similarity\}%/);
  });
  it("shows no 0–10 score suffix", () => {
    expect(dashboard).not.toMatch(/toFixed\(1\)\}\/10\b/);
    expect(dashboard).not.toMatch(/\/10(?!\d)/);
  });
});

// Engine composite/domain scores and deltas are 0–10 internally. Display is the
// canonical 0–100 scale (×10, display only), deltas in "pts", missing → "—".
describe("0–10 engine deltas and scores display on the canonical /100 scale", () => {
  it("a 0–10 delta of 0.3 shows 3 pts", () => {
    expect(pointsDeltaText(0.3)).toBe("+3 pts");
    expect(pointsDeltaText(0.3)).toContain("3 pts");
    expect(pointsDeltaText(-0.25)).toBe("-2.5 pts");
    expect(pointsDeltaText(0)).toBe("0 pts");
    expect(pointsDeltaText(-0)).toBe("0 pts");
  });
  it("a null / NaN / missing delta shows an em dash", () => {
    for (const missing of [null, undefined, Number.NaN]) {
      expect(pointsDeltaText(missing)).toBe(MISSING_VALUE_TEXT);
    }
  });
  it("a 0–10 score of 3.3 shows 33 (on /100); missing shows an em dash", () => {
    expect(score100Value(3.3)).toBe("33");
    expect(score100Value(null)).toBe(MISSING_VALUE_TEXT);
    expect(score100Value(Number.NaN)).toBe(MISSING_VALUE_TEXT);
  });

  // Rendered on /app/now/deep (Dashboard + its Pulse/Intelligence modes + the
  // crypto section + engine driver text), plus DailyReport (unrouted).
  const surfaces = [
    "client/src/pages/Dashboard.tsx",
    "client/src/components/dashboard/IntelligenceMode.tsx",
    "client/src/components/dashboard/PulseMode.tsx",
    "client/src/components/HomeCryptoSection.tsx",
    "client/src/lib/engine.ts",
    "client/src/pages/DailyReport.tsx",
  ];
  // A "/10" or "/ 10.0" score suffix after an interpolation, a tag or a digit.
  const slashTen = /(\}|>|\d)\s?\/\s?10(\.0)?(?![\d%])/;
  for (const file of surfaces) {
    it(`${file} renders no X/10 score text and no raw 0–10 delta`, () => {
      const src = read(file);
      expect(src).not.toMatch(slashTen);
      expect(src).not.toMatch(/\.score\.toFixed\(/);
      expect(src).not.toMatch(/delta\.toFixed\(/);
    });
  }
  it("Dashboard DELTA / DIRECTION / LARGEST ROTATION / change items render pts via the helper", () => {
    const dashboard = read("client/src/pages/Dashboard.tsx");
    expect(dashboard).toContain("{ label: 'DELTA', value: pointsDeltaText(overall.delta), color }");
    expect(dashboard).toContain("`Δ ${pointsDeltaText(overall.delta)} vs baseline`");
    expect(dashboard).toContain("`Δ ${pointsDeltaText(biggestShift.delta)} vs baseline`");
    expect(dashboard).toContain("{pointsDeltaText(delta)}");
    expect(dashboard).not.toMatch(/% since last reading/);
  });
  it("the macro regime header in IntelligenceMode is on /100", () => {
    const im = read("client/src/components/dashboard/IntelligenceMode.tsx");
    expect(im).toContain("{score100Value(overall.score)}");
    expect(im).not.toContain("/ 10.0");
  });
});
