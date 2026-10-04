/**
 * Fix-up 7: the Signal Outlook "FAULTLINE Environment" panel showed "Normal Risk" (legacy
 * classifyRegimeLabel scale) at P=34 while every canonical surface showed "MODERATE RISK".
 * The panel now renders the canonical snapshot (canonicalState from outlook.getOutlook);
 * the server label/prompt use the canonical vocabulary (tested in signalOutlook.test.ts).
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { outlookEnvironmentDisplay } from "../client/src/lib/outlookEnvironmentDisplay";

describe("outlookEnvironmentDisplay — canonical snapshot, 'Unavailable' fallback", () => {
  it("renders the canonical pressure and regime", () => {
    expect(outlookEnvironmentDisplay({ pressureIndex: 34, regime: "MODERATE RISK" })).toEqual({
      pressureIndex: 34, pressureText: "34/100", badge: "PRESSURE 34", regimeText: "MODERATE RISK",
    });
  });
  it("falls back to Unavailable without a snapshot or with missing fields", () => {
    for (const c of [null, undefined, { pressureIndex: null, regime: null }, { pressureIndex: Number.NaN, regime: "  " }]) {
      expect(outlookEnvironmentDisplay(c as any)).toEqual({ pressureIndex: null, pressureText: "Unavailable", badge: "PRESSURE UNAVAILABLE", regimeText: "Unavailable" });
    }
    expect(outlookEnvironmentDisplay({ pressureIndex: 34, regime: null }).regimeText).toBe("Unavailable");
    expect(outlookEnvironmentDisplay({ pressureIndex: null, regime: "MODERATE RISK" }).pressureText).toBe("Unavailable");
  });
});

describe("SignalOutlookCenter environment panel reads canonicalState", () => {
  const src = fs.readFileSync(new URL("../client/src/pages/SignalOutlookCenter.tsx", import.meta.url), "utf8");
  const panel = src.slice(src.indexOf('title="FAULTLINE Environment"'), src.indexOf("{d.environment.environmentImpact}"));
  it("binds the badge, Pressure Index and Regime tiles to the canonical display", () => {
    expect(src).toContain("const env = outlookEnvironmentDisplay(d.canonicalState);");
    expect(panel).toContain("badge={env.badge}");
    expect(panel).toContain('{ label: "Pressure Index", value: env.pressureText,');
    expect(panel).toContain('{ label: "Regime", value: env.regimeText,');
    expect(panel).not.toMatch(/d\.environment\.(regimeLabel|pressureIndex)/);
  });
  it("server no longer labels the outlook regime with the legacy diagnostic scale", () => {
    const so = fs.readFileSync(new URL("./signalOutlook.ts", import.meta.url), "utf8");
    expect(so).not.toMatch(/classifyRegimeLabel\(/);
    expect(so).toContain("    regimeLabel: pressure.regime,");
  });
});
