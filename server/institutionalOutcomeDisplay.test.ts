import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const h = vi.hoisted(() => ({ events: [] as any[], outcomes: [] as any[], calls: [] as string[] }));
vi.mock("../server/db", () => ({
  getDb: async () => ({
    select: (fields?: Record<string, unknown>) => {
      h.calls.push("select");
      const rows = () => (fields && "count" in fields ? [{ count: h.events.length }] : null);
      const q: any = {
        from: (table: any) => { q.table = table; return q; },
        where: () => q, orderBy: () => q, limit: () => q,
        then: (res: any, rej: any) => Promise.resolve(rows() ?? (q.table?.outcomeKey ? h.outcomes : h.events)).then(res, rej),
      };
      return q;
    },
  }),
}));

import {
  buildInstitutionalOutcomeView,
  institutionalOutcomeKeyV2,
  institutionalOutcomeStatusText,
  isBroadOutcomeEligibleEvent,
  isVerifiedInstitutionalOutcome,
} from "../shared/institutionalOutcomeDisplay";
import { institutionalMemoryRouter } from "./routers/institutionalMemory";

const legacyJson = JSON.stringify({ historyClass: "live_verified", spy: { returnPercent: -0.4587, observedAt: "2026-09-15" }, tenYearTreasury: { baseYieldPercent: 4, targetYieldPercent: 4, changeBasisPoints: 0, baseObservedAt: "1962-09-10", targetObservedAt: "1962-09-10" } });
const v2Json = JSON.stringify({ historyClass: "live_verified", outcomeVersion: "v2-completed-bar", spy: { returnPercent: 0.74, observedAt: "2026-10-02" }, tenYearTreasury: { changeBasisPoints: 4, baseObservedAt: "2026-10-01", targetObservedAt: "2026-10-02" } });
const legacy = (eventId: number, h: number) => ({ id: 100 + eventId * 10 + h, outcomeKey: `institutional-event:${eventId}:broad-benchmark:${h}td`, eventId, horizonTradingDays: h, observedAt: new Date("2026-09-15T13:30:00Z"), outcomeJson: legacyJson, provenanceJson: "{}", recordedAt: new Date("2026-09-16T18:03:53Z") });
const v2 = (eventId: number, h: number) => ({ id: 500 + eventId * 10 + h, outcomeKey: institutionalOutcomeKeyV2(eventId, h), eventId, horizonTradingDays: h, observedAt: new Date("2026-10-02T20:00:00Z"), outcomeJson: v2Json, provenanceJson: "{}", recordedAt: new Date("2026-10-05T18:03:20Z") });

describe("institutional outcome display: v2 completed-session rows only", () => {
  it("only a v2 key AND v2 outcomeVersion is a valid outcome", () => {
    expect(isVerifiedInstitutionalOutcome(v2(2, 1))).toBe(true);
    expect(isVerifiedInstitutionalOutcome(legacy(2, 1))).toBe(false);
    expect(isVerifiedInstitutionalOutcome({ ...legacy(2, 1), outcomeJson: v2Json })).toBe(false); // legacy key, v2-looking JSON
    expect(isVerifiedInstitutionalOutcome({ ...v2(2, 1), outcomeJson: legacyJson })).toBe(false); // v2 key, legacy JSON
    expect(isVerifiedInstitutionalOutcome({ ...v2(2, 1), outcomeKey: "institutional-event:2:broad-benchmark:1td:v2x" })).toBe(false);
    expect(isVerifiedInstitutionalOutcome({ ...v2(2, 1), outcomeJson: "{" })).toBe(false);
    expect(institutionalOutcomeKeyV2(7, 20)).toBe("institutional-event:7:broad-benchmark:20td:v2");
  });

  it("legacy-only horizons are SUPERSEDED, empty horizons PENDING, v2 horizons VERIFIED; legacy values never returned", () => {
    const view = buildInstitutionalOutcomeView([legacy(2, 1), legacy(2, 5), v2(2, 5)]);
    expect(view.outcomes.map(o => o.outcomeKey)).toEqual(["institutional-event:2:broad-benchmark:5td:v2"]);
    expect(view.outcomeStatus).toEqual([
      { horizonTradingDays: 1, status: "SUPERSEDED" },
      { horizonTradingDays: 5, status: "VERIFIED" },
      { horizonTradingDays: 20, status: "PENDING" },
      { horizonTradingDays: 60, status: "PENDING" },
    ]);
    expect(JSON.stringify(view)).not.toContain("1962");
    expect(buildInstitutionalOutcomeView([]).outcomeStatus.every(s => s.status === "PENDING")).toBe(true);
    expect(institutionalOutcomeStatusText("SUPERSEDED")).toMatch(/^SUPERSEDED/);
    expect(institutionalOutcomeStatusText("PENDING")).toMatch(/^PENDING/);
    expect(institutionalOutcomeStatusText("SUPERSEDED")).not.toMatch(/VERIFIED/);
  });

  it("eligibility mirrors the broad collector", () => {
    expect(isBroadOutcomeEligibleEvent({ entityType: "market", eventType: "daily_market_snapshot" })).toBe(true);
    expect(isBroadOutcomeEligibleEvent({ entityType: "market_warning", eventType: "warning_detected" })).toBe(true);
    expect(isBroadOutcomeEligibleEvent({ entityType: "market_warning", eventType: "warning_resolved" })).toBe(false);
    expect(isBroadOutcomeEligibleEvent({ entityType: "asset", eventType: "x" })).toBe(false);
  });

  it("listEvents never returns a legacy row as an outcome (read-only)", async () => {
    h.events = [
      { id: 2, entityType: "market", eventType: "daily_market_snapshot", eventAt: new Date("2026-09-15T00:26:11Z") },
      { id: 3, entityType: "market", eventType: "daily_market_snapshot", eventAt: new Date("2026-09-16T18:03:51Z") },
      { id: 4, entityType: "asset", eventType: "asset_move", eventAt: new Date("2026-09-16T18:03:51Z") },
    ];
    h.outcomes = [legacy(2, 1), legacy(2, 5), v2(2, 1), legacy(3, 1)];
    h.calls = [];
    const caller = institutionalMemoryRouter.createCaller({ user: null } as any);
    const out = await caller.listEvents({ limit: 50 });
    const byId = new Map(out.events.map((e: any) => [e.id, e]));
    const e2: any = byId.get(2), e3: any = byId.get(3), e4: any = byId.get(4);
    expect(e2.outcomes.map((o: any) => o.outcomeKey)).toEqual(["institutional-event:2:broad-benchmark:1td:v2"]);
    expect(e2.outcomeStatus.map((s: any) => s.status)).toEqual(["VERIFIED", "SUPERSEDED", "PENDING", "PENDING"]);
    expect(e3.outcomes).toEqual([]);
    expect(e3.outcomeStatus.map((s: any) => s.status)).toEqual(["SUPERSEDED", "PENDING", "PENDING", "PENDING"]);
    expect(e4.outcomes).toEqual([]);
    expect(e4.outcomeStatus).toEqual([]); // never measured: no Pending rows invented
    expect(JSON.stringify(out)).not.toContain("1962-09-10");
    expect(h.calls.every(c => c === "select")).toBe(true);
  });
});

describe("UI surfaces render v2 rows only (source wiring)", () => {
  const source = (p: string) => readFileSync(resolve(import.meta.dirname, "..", p), "utf8");
  it("Alerts: LIVE VERIFIED only over verified rows; unverified horizons as Pending/Superseded", () => {
    const alerts = source("client/src/pages/Alerts.tsx");
    expect(alerts).toMatch(/const outcomes = \(event\.outcomes \?\? \[\]\)\.filter\(isVerifiedInstitutionalOutcome\)/);
    expect(alerts).toMatch(/\{outcomes\.length > 0 && <div><div[^>]*>APPENDED BROAD-MARKET OUTCOMES · LIVE VERIFIED<\/div>[\s\S]{0,200}\{outcomes\.map\(/);
    expect(alerts).toMatch(/\n\s*\{unverified\.length > 0 && <div><div[^>]*>BROAD-MARKET OUTCOMES · NOT YET VERIFIED<\/div>[\s\S]{0,600}institutionalOutcomeStatusText\(entry\.status\)/);
    expect(alerts).toMatch(/entry\.status !== "VERIFIED"/);
  });
  it("Pressure History: only verified rows are parsed; others show Pending/Superseded", () => {
    const ph = source("client/src/pages/PressureHistory.tsx");
    expect(ph).toMatch(/x\.horizonTradingDays === h && isVerifiedInstitutionalOutcome\(x\)\); const o = raw \? parseFollowThrough\(raw\.outcomeJson\) : null;/);
    expect(ph).toMatch(/=== "SUPERSEDED" \? "SUPERSEDED" : "PENDING"/);
    expect(ph).toMatch(/\{institutionalOutcomeStatusText\(status\)\}/);
  });
  it("the router applies the v2-only view", () => {
    const router = source("server/routers/institutionalMemory.ts");
    expect(router).toMatch(/return \{ \.\.\.event, outcomes: view\.outcomes, outcomeStatus: measured \? view\.outcomeStatus : \[\] \};/);
  });
});
