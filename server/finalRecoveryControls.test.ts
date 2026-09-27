import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasExactCronAuthorization } from "./_core/cronGuard";
import { hasApprovedSystemicRegimeIdentity } from "./systemicRegime/identity";

const root = resolve(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("final reconstruction controls", () => {
  it("accepts only an exact non-empty bearer cron authorization", () => {
    expect(hasExactCronAuthorization("Bearer exact-token", "exact-token")).toBe(true);
    expect(hasExactCronAuthorization("bearer exact-token", "exact-token")).toBe(false);
    expect(hasExactCronAuthorization("Bearer  exact-token", "exact-token")).toBe(false);
    expect(hasExactCronAuthorization("Bearer exact-token ", "exact-token")).toBe(false);
    expect(hasExactCronAuthorization("Bearer exact-token", "")).toBe(false);
  });

  it("makes Seismograph write operations admin-only and removes request-time training", () => {
    const seismograph = source("server/routers/seismograph.ts");
    const core = source("server/_core/index.ts");
    expect(seismograph).toMatch(/seedNow:\s*adminProcedure\.mutation/);
    expect(seismograph).toMatch(/backfillHistory:\s*adminProcedure\.mutation/);
    expect(seismograph).toMatch(/triggerPatternAnalysis:\s*adminProcedure\.mutation/);
    expect(core).not.toContain("/api/scheduled/systemic-regime-train");
    expect(core).not.toContain("handleScheduledSystemicRegimeTrain");
  });

  it("requires the exact approved two-state Systemic Regime identity", () => {
    expect(hasApprovedSystemicRegimeIdentity({
      modelVersion: "sre-hmm2-v1.0.0",
      modelType: "gaussian-hmm-2state",
      pcaMethod: "standard_scaler_pca",
      nStates: 2,
    })).toBe(true);
    expect(hasApprovedSystemicRegimeIdentity({
      modelVersion: "sre-hmm2-v1.0.0",
      modelType: "gaussian-hmm-3state",
      pcaMethod: "standard_scaler_pca",
      nStates: 3,
    })).toBe(false);
  });

  it("aligns every PWA entry surface and fails closed mobile signals", () => {
    const app = source("client/src/App.tsx");
    const layout = source("client/src/components/MobileLayout.tsx");
    const manifest = source("client/public/manifest.json");
    const worker = source("client/public/sw.js");
    const signals = source("client/src/pages/mobile/MobileSignals.tsx");
    expect(app).toContain('to="/mobile/pulse"');
    expect(layout).toContain('path: "/mobile/pulse"');
    expect(manifest).toContain('"start_url": "/mobile/pulse"');
    expect(worker).toContain('caches.match("/mobile/pulse")');
    expect(signals).toContain('if (!response.ok)');
    expect(signals).toContain("SIGNALS UNAVAILABLE");
  });

  it("records the one canonical final recovery migration", () => {
    const journal = JSON.parse(source("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries.filter(entry => entry.tag === "0072_final_recovery_controls")).toHaveLength(1);
    expect(journal.entries.at(-1)).toMatchObject({ idx: 72, tag: "0072_final_recovery_controls" });
    expect(source("drizzle/0072_final_recovery_controls.sql")).toContain("originatingRunId");
  });
});
