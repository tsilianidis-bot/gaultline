import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MISSING_VALUE_TEXT,
  canonicalScoreText,
  finiteOrNull,
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
