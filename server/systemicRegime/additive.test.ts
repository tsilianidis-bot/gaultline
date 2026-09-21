import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "../..", relativePath), "utf8");
}

describe("Systemic Regime Engine remains additive", () => {
  it("does not change Champion Pressure Index weights", () => {
    const engine = source("server/pressure/engine.ts");
    expect(engine).toContain("weight: 0.20");
    expect(engine).toContain("weight: 0.15");
    expect(engine).toContain("weight: 0.10");
    expect(engine).toMatch(/liquidity-stress[\s\S]*weight: 0\.20/);
    expect(engine).toContain("MUST NOT be added here");
    const projection = source("server/canonicalPressureProjection.ts");
    expect(projection).toContain('"liquidity-stress": 0.20');
    expect(projection).toContain('"market-breadth": 0.10');
    expect(projection).not.toContain("systemic-regime");
  });

  it("never fits or retrains inside tRPC request handlers", () => {
    const router = source("server/routers/systemicRegime.ts");
    expect(router).toContain("getLatestSystemicRegimeReading");
    expect(router).not.toContain("runSystemicRegimeTrainJob");
    expect(router).not.toContain("fit_hmm");
    expect(router).not.toContain("GaussianHMM");
    const scheduled = source("server/systemicRegime/scheduled.ts");
    expect(scheduled).toContain("inference.py");
    expect(scheduled).toContain("train.py");
  });

  it("does not market PCA as Dynamic PCA or the HMM as AI", () => {
    const readme = source("quant/systemic-regime/README.md");
    expect(readme).toContain("StandardScaler + PCA");
    expect(readme).toContain("Not AI");
    expect(readme).toContain("This is **not** Dynamic PCA.");
    const pca = source("quant/systemic-regime/systemic_pca.py");
    expect(pca).toContain("This is NOT Dynamic PCA");
  });

  it("does not treat packaged OOS research as live inference", () => {
    const reader = source("server/systemicRegime/reader.ts");
    expect(reader).toContain('historyClass === "OOS_RESEARCH" ? loadPackagedResearchHistory(limit) : []');
    expect(reader).toContain('if (rows.length === 0 && historyClass === "OOS_RESEARCH")');
  });

  it("NOW reads persisted systemic regime without writing Pressure", () => {
    const now = source("client/src/pages/Now.tsx");
    expect(now).toContain("trpc.systemicRegime.current");
    expect(now).toContain("SystemicRegimeModule");
    expect(now).not.toContain("pressureIndex = systemicRegime");
    expect(now).not.toContain("canonicalState.pressureIndex =");
  });
});
