import { describe, expect, it } from "vitest";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  CLIENT_PAYLOAD_MAX_DEPTH,
  guardNamedClientFields,
  ledgerScoreDirection,
  neutralConditionLabel,
} from "../shared/clientVocabulary";

describe("client vocabulary", () => {
  it("maps STRONG REDUCE and the ASHA words to condition labels", () => {
    expect(neutralConditionLabel("STRONG REDUCE")).toBe("Lower-side condition");
    expect(neutralConditionLabel("ACQUIRE")).toBe("Upper-side condition");
    expect(neutralConditionLabel("ADD GRADUALLY")).toBe("Upper-side condition");
    expect(neutralConditionLabel("KEEP")).toBe("Mixed condition");
    expect(neutralConditionLabel("REDUCE")).toBe("Lower-side condition");
    expect(neutralConditionLabel("PASS OVER")).toBe("Condition not established");
    expect(neutralConditionLabel("OVERWEIGHT")).toBe("Upper-side condition");
    expect(neutralConditionLabel("UNDERWEIGHT")).toBe("Lower-side condition");
    expect(neutralConditionLabel("WAIT")).toBe("Mixed condition");
    expect(neutralConditionLabel("Avoid")).toBe("Lower-side condition");
  });

  it("scores a neutral ledger sentence from the stored direction, not the sentence", () => {
    const sentence = "Pressure Index is 42/100. Regime label is mixed.";
    expect(ledgerScoreDirection({ verdict: sentence })).toBe(0);
    expect(ledgerScoreDirection({ verdict: sentence, recommendationType: "negative" })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: sentence, internalDirection: "positive" })).toBe(1);
    expect(ledgerScoreDirection({ verdict: "ACCUMULATE" })).toBe(1);
  });

  it("scores REDUCE as -1 because the lower-side set includes it", () => {
    expect(ledgerScoreDirection({ verdict: "REDUCE" })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: "REDUCE", recommendationType: null })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: "STRONG REDUCE" })).toBe(-1);
  });

  it("drops named trade-class fields and leaves every other value untouched", async () => {
    const clean = { symbol: "HOLD", notes: "A note", timeframe: "Watch" };
    expect(guardNamedClientFields(clean)).toBe(clean);

    const app = router({
      customer: publicProcedure.query(() => ({
        symbol: "HOLD",
        notes: "HOLD",
        title: "SELL",
        id: "WAIT",
        side: "BUY",
        status: "WATCH",
        moveType: "WAIT",
        timeframe: "HOLD",
        action: "BUY",
        " Final Verdict Action ": "ACQUIRE",
        final_verdict_action: "ADD GRADUALLY",
        class: "OVERWEIGHT",
        direction: "WATCH",
        verdict: "WAIT",
        internalDirection: "positive",
      })),
      ownerSim: router({
        getOpportunities: protectedProcedure.query(() => ({ direction: "WATCH", action: "BUY", symbol: "HOLD" })),
      }),
      ownerOnly: adminProcedure.query(() => ({ verdict: "BUY", action: "SELL" })),
    });
    const caller = app.createCaller({ req: {} as never, res: {} as never, user: { role: "admin", id: 1 } } as never);
    const customer = await caller.customer();
    expect(customer.symbol).toBe("HOLD");
    expect(customer.notes).toBe("HOLD");
    expect(customer.title).toBe("SELL");
    expect(customer.id).toBe("WAIT");
    expect(customer.side).toBe("BUY");
    expect(customer.status).toBe("WATCH");
    expect(customer.moveType).toBe("WAIT");
    expect(customer.timeframe).toBe("HOLD");
    expect(customer.direction).toBe("WATCH");
    expect(customer.verdict).toBe("WAIT");
    expect(customer.internalDirection).toBe("positive");
    expect(customer).not.toHaveProperty("action");
    expect(customer).not.toHaveProperty(" Final Verdict Action ");
    expect(customer).not.toHaveProperty("final_verdict_action");
    expect(customer).not.toHaveProperty("class");

    const simulation = await caller.ownerSim.getOpportunities();
    expect(simulation).toEqual({ direction: "WATCH", action: "BUY", symbol: "HOLD" });

    const nested = guardNamedClientFields({
      action: { class: "UNDERWEIGHT", conditionId: "return-at-or-below-benchmark" },
      other: { class: "AVOID", conditionId: "lagging-confirmed-down" },
    });
    expect(nested.action).not.toHaveProperty("class");
    expect(nested.other).not.toHaveProperty("class");
    expect(nested.action.conditionId).toBe("return-at-or-below-benchmark");
    expect(nested.other.conditionId).toBe("lagging-confirmed-down");
    expect(nested.action.conditionId).not.toBe(nested.other.conditionId);

    await expect(app.createCaller({ req: {} as never, res: {} as never, user: { role: "user" } } as never).ownerOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await caller.ownerOnly();
    expect(admin).toEqual({ verdict: "BUY", action: "SELL" });
  });

  it("passes Map, Set, Buffer, URL, Error, and Date through intact", () => {
    const date = new Date("2026-10-28T00:00:00.000Z");
    const map = new Map<string, string>([["symbol", "HOLD"]]);
    const set = new Set<string>(["BUY"]);
    const buffer = Buffer.from("HOLD");
    const url = new URL("https://example.com/HOLD");
    const error = new Error("BUY");
    const payload = { date, map, set, buffer, url, error, symbol: "HOLD", notes: "BUY" };
    const guarded = guardNamedClientFields(payload);
    expect(guarded).toBe(payload);
    expect(guarded.date).toBe(date);
    expect(guarded.map).toBe(map);
    expect(guarded.set).toBe(set);
    expect(guarded.buffer).toBe(buffer);
    expect(guarded.url).toBe(url);
    expect(guarded.error).toBe(error);
    expect(guarded.symbol).toBe("HOLD");
    expect(guarded.notes).toBe("BUY");
    expect(map.get("symbol")).toBe("HOLD");
    expect(Array.from(set)).toEqual(["BUY"]);
    expect(buffer.toString()).toBe("HOLD");
  });

  it("stops on a cycle and does not walk past the depth limit", () => {
    const box: { name: string; self?: unknown; action?: string } = { name: "loop", action: "HOLD" };
    box.self = box;
    const guarded = guardNamedClientFields(box);
    expect(guarded.name).toBe("loop");
    expect(guarded).not.toHaveProperty("action");
    expect(guarded.self).toBeTruthy();

    let deep: { child?: unknown; action?: string } = { action: "BUY" };
    for (let index = 0; index < CLIENT_PAYLOAD_MAX_DEPTH + 3; index += 1) deep = { child: deep };
    const walked = guardNamedClientFields(deep);
    expect(walked).toBe(deep);
    let cursor: { child?: unknown; action?: string } = walked;
    for (let index = 0; index < CLIENT_PAYLOAD_MAX_DEPTH + 3; index += 1) cursor = cursor.child as typeof cursor;
    expect(cursor.action).toBe("BUY");
  });
});
