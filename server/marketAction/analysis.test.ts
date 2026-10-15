import { describe, expect, it } from "vitest";
import { MARKET_ACTION_METHOD_VERSION, type MarketActionReading, type MarketActionSnapshot } from "../../shared/marketAction";
import { detectMarketAction, highestPriorityEvent } from "./analysis";

const observedAt = "2026-10-15T14:00:00.000Z";
const reading = (id: string, label: string, changePercent: number | null): MarketActionReading => ({
  id,
  label,
  value: changePercent === null ? null : 100,
  changePercent,
  observedAt: changePercent === null ? null : observedAt,
  provider: "test source",
  freshness: changePercent === null ? "unavailable" : "delayed",
  unavailableReason: changePercent === null ? "unavailable" : null,
});

function snapshot(readings: MarketActionReading[], capturedAt = observedAt): MarketActionSnapshot {
  return {
    kind: "market-action-snapshot",
    methodVersion: MARKET_ACTION_METHOD_VERSION,
    capturedAt,
    calculationAt: capturedAt,
    latestObservedAt: observedAt,
    coverage: [],
    readings,
    events: [],
    sourceNote: "test",
  };
}

describe("Market Action material-condition detector", () => {
  it("does not call a single equity decline broad market stress", () => {
    const current = snapshot([
      reading("SPY", "SPY", -2.2),
      reading("QQQ", "QQQ", -0.2),
      reading("IWM", "IWM", 0.1),
    ]);
    expect(detectMarketAction(current, null).some(event => event.kind === "broad_equity_selloff")).toBe(false);
  });

  it("records broad weakness only with sufficient independent major-equity coverage", () => {
    const current = snapshot([
      reading("SPY", "SPY", -2.1),
      reading("QQQ", "QQQ", -1.8),
      reading("IWM", "IWM", -0.6),
    ]);
    const events = detectMarketAction(current, null);
    const event = events.find(candidate => candidate.kind === "broad_equity_selloff");
    expect(event).toMatchObject({ severity: "low", direction: "deteriorating" });
    expect(event?.evidence).toEqual(expect.arrayContaining(["SPY -2.10%", "QQQ -1.80%"]));
    expect(event?.inference).toContain("not evidence of a specific cause");
  });

  it("marks source gaps unavailable rather than manufacturing a calm reading", () => {
    const current = snapshot([
      reading("SPY", "SPY", null),
      reading("QQQ", "QQQ", null),
      reading("IWM", "IWM", null),
      reading("VIX", "VIX", null),
    ]);
    expect(detectMarketAction(current, null)).toEqual([]);
  });

  it("detects acceleration only from two verified snapshots", () => {
    const prior = snapshot([
      reading("SPY", "SPY", -0.4),
      reading("QQQ", "QQQ", -0.3),
      reading("IWM", "IWM", -0.2),
    ], "2026-10-15T13:45:00.000Z");
    const current = snapshot([
      reading("SPY", "SPY", -1.5),
      reading("QQQ", "QQQ", -1.4),
      reading("IWM", "IWM", -1.3),
    ]);
    const event = detectMarketAction(current, prior).find(candidate => candidate.kind === "accelerating_equity_loss");
    expect(event?.evidence).toContain("Prior average major-equity move -0.30%.");
    expect(event?.evidence).toContain("Current average major-equity move -1.40%.");
  });

  it("ranks a cross-market condition above its component conditions", () => {
    const current = snapshot([
      reading("SPY", "SPY", -2.3),
      reading("QQQ", "QQQ", -2.1),
      reading("IWM", "IWM", -1.8),
      reading("VIX", "VIX", 12),
      reading("BTC", "BTC", -6),
    ]);
    const event = highestPriorityEvent(detectMarketAction(current, null));
    expect(event?.kind).toBe("cross_market_stress");
    expect(event?.inference).toContain("not a causal explanation");
  });
});
