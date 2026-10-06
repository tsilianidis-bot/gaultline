import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import {
  PRESSURE_BANDS,
  pressureBand,
  pressureRegimeLabel,
  pressureShortLabel,
} from "../shared/pressureBands";

(globalThis as { React?: typeof React }).React = React;

const ROOT = join(import.meta.dirname, "..");

const BOUNDARIES: Array<[number, string, string]> = [
  [0, "LOW", "LOW RISK"],
  [24, "LOW", "LOW RISK"],
  [25, "MODERATE", "MODERATE RISK"],
  [44, "MODERATE", "MODERATE RISK"],
  [45, "ELEVATED", "ELEVATED RISK"],
  [64, "ELEVATED", "ELEVATED RISK"],
  [65, "HIGH STRESS", "HIGH STRESS"],
  [79, "HIGH STRESS", "HIGH STRESS"],
  [80, "SYSTEMIC CRISIS", "SYSTEMIC CRISIS"],
  [100, "SYSTEMIC CRISIS", "SYSTEMIC CRISIS"],
];

describe("canonical pressure bands", () => {
  it("exposes James's inclusive ranges", () => {
    expect(PRESSURE_BANDS.map((b) => [b.min, b.max, b.shortLabel, b.regime])).toEqual([
      [0, 24, "LOW", "LOW RISK"],
      [25, 44, "MODERATE", "MODERATE RISK"],
      [45, 64, "ELEVATED", "ELEVATED RISK"],
      [65, 79, "HIGH STRESS", "HIGH STRESS"],
      [80, 100, "SYSTEMIC CRISIS", "SYSTEMIC CRISIS"],
    ]);
  });

  it.each(BOUNDARIES)("score %i → short=%s regime=%s", (score, shortLabel, regime) => {
    expect(pressureShortLabel(score)).toBe(shortLabel);
    expect(pressureRegimeLabel(score)).toBe(regime);
    expect(pressureBand(score).shortLabel).toBe(shortLabel);
  });

  it("maps live PI=34 to MODERATE everywhere in the canonical helpers", () => {
    expect(pressureShortLabel(34)).toBe("MODERATE");
    expect(pressureRegimeLabel(34)).toBe("MODERATE RISK");
    expect(pressureBand(34).id).toBe("moderate");
    for (const wrong of ["LOW", "ELEVATED", "HIGH STRESS", "SYSTEMIC CRISIS", "MINIMAL", "CRITICAL"]) {
      expect(pressureShortLabel(34)).not.toBe(wrong);
    }
  });
});

describe("NOW primary gauge renders MODERATE for PI=34", () => {
  it("PressureInstrument gauge label is MODERATE (not LOW)", async () => {
    const { PressureInstrument } = await import("../client/src/pages/Now.tsx");
    const html = renderToStaticMarkup(
      createElement(PressureInstrument, {
        score: 34,
        accent: "#FFD700",
        regime: "MODERATE RISK",
        direction: "Stable",
        historicalPercentile: 83,
        lastUpdated: null,
        phase: 7,
        scoreChange: null,
      }),
    );
    expect(html).toContain("MODERATE");
    expect(html).not.toMatch(/>\s*LOW\s*</);
    expect(html).not.toContain(">LOW<");
    // Badge / narrative contract: regime text remains MODERATE RISK when provided.
    expect(html).toContain("34");
  });
});

describe("no independent score→band mappings outside shared/pressureBands.ts", () => {
  const ALLOWLIST = new Set([
    "shared/pressureBands.ts",
    // Thin re-exports / adapters over the canonical module:
    "shared/pressureScale.ts",
    "client/src/lib/pressureSnapshot.ts",
    // Engine scoring classifyRegime — display must use pressureBand; leave thresholds
    // as documentation of stored labels (must match canonical; asserted below).
    "server/pressure/engine.ts",
    "server/pressure/championBaseline.ts",
    "server/pressure/shadowEngine.ts", // research shadow labels; not customer-facing
    "server/preFlight.ts", // Pre-Flight removed from customer experience (#67)
    // Diagnostic AI uses a separate diagnostic scale (not PI regime badges).
    "server/diagnosticAI.ts",
    "server/fmos/utils.ts", // classifyDiagnosticLabel only; classifyRegimeLabel re-exports canonical
    // Tests themselves:
    "server/pressureBands.test.ts",
    "server/pressureSnapshot.test.ts",
    "server/pressureScaleLabels.test.ts",
  ]);

  const PATTERN =
    /(?:function\s+(?:pressureLabel|getPressureLabel|briefingPressureLabel|pressureDisplayBand|classifyRegimeLabel|scoreToLevel)\s*\(|(?:score|pressure|overall|p)\s*>=\s*(?:20|24|25|30|40|45|55|60|65|70|75|80|85)\s*\)\s*return\s*["'](?:LOW|MODERATE|ELEVATED|HIGH|CRITICAL|SYSTEMIC|MINIMAL|STABLE))/;

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist" || name === "build" || name === ".git") continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".spec.ts")) out.push(full);
    }
    return out;
  }

  it("fails if a new independent PI band mapping appears outside the canonical file", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (ALLOWLIST.has(rel)) continue;
      if (rel.startsWith("server/__fixtures__/")) continue;
      const src = readFileSync(file, "utf8");
      // Skip clearly non-PI helpers (crypto sub-scores, checklist completion, etc.)
      if (!/pressure|regime|Pressure Index|risk band|MODERATE RISK|LOW RISK/i.test(src) && !/pressureLabel|getPressureLabel|briefingPressureLabel/.test(src)) {
        continue;
      }
      if (PATTERN.test(src)) {
        // Ignore files that import and delegate to pressureBands / pressureShortLabel / pressureRegimeLabel / pressureBand(
        if (
          /from ["']@shared\/pressureBands["']/.test(src) ||
          /from ["']\.\.\/shared\/pressureBands["']/.test(src) ||
          /from ["']\.\/pressureBands["']/.test(src) ||
          /from ["']\.\.\/\.\.\/shared\/pressureBands["']/.test(src)
        ) {
          // Still flag if they keep a hard-coded score>= cascade returning band labels
          const withoutImports = src.replace(/^import .+$/gm, "");
          if (
            /(?:score|pressure|overall|p)\s*>=\s*(?:20|24|25|40|45|55|60|65|70|75|80|85)\s*\)\s*return\s*["'](?:LOW|MODERATE|ELEVATED|HIGH|CRITICAL|SYSTEMIC|MINIMAL|STABLE)/.test(
              withoutImports,
            )
          ) {
            offenders.push(rel);
          }
          continue;
        }
        offenders.push(rel);
      }
    }
    expect(offenders, `Independent band mappings:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("engine stored-label thresholds still match the canonical display bands", () => {
    const engine = readFileSync(join(ROOT, "server/pressure/engine.ts"), "utf8");
    expect(engine).toMatch(/pressure >= 80[\s\S]*?SYSTEMIC CRISIS/);
    expect(engine).toMatch(/pressure >= 65[\s\S]*?HIGH STRESS/);
    expect(engine).toMatch(/pressure >= 45[\s\S]*?ELEVATED RISK/);
    expect(engine).toMatch(/pressure >= 25[\s\S]*?MODERATE RISK/);
  });
});
