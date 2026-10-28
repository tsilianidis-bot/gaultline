import { describe, expect, it, vi } from "vitest";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  CLIENT_PAYLOAD_MAX_DEPTH,
  CLIENT_PAYLOAD_MAX_NODES,
  guardNamedClientFields,
  ledgerScoreDirection,
  neutralizeChannelPayload,
  neutralizeChannelText,
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

  it("restores production substring scoring for stored verdicts", () => {
    expect(ledgerScoreDirection({ verdict: "The tape is bullish" })).toBe(1);
    expect(ledgerScoreDirection({ verdict: "bearish regime" })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: "a long pause" })).toBe(1);
    expect(ledgerScoreDirection({ verdict: "short interest rose" })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: "upside remains open" })).toBe(1);
    expect(ledgerScoreDirection({ verdict: "downside risk is the larger input" })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: "The tape is bullish", recommendationType: "negative" })).toBe(-1);
  });

  it("labels an unchanged assessment without calling it mixed", () => {
    expect(neutralConditionLabel("unchanged")).toBe("Unchanged");
    expect(neutralConditionLabel("UNCHANGED")).toBe("Unchanged");
    expect(guardNamedClientFields({ direction: "unchanged" }).direction).toBe("Unchanged");
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
    expect(customer.direction).toBe("Mixed condition");
    expect(customer.verdict).toBe("Mixed condition");
    expect(customer.action).toBe("Upper-side condition");
    expect(customer.internalDirection).toBe("positive");
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

  it("neutralizes a cycle and a named field past the depth cap", () => {
    const box: { name: string; self?: unknown; action?: string } = { name: "loop", action: "HOLD" };
    box.self = box;
    const guarded = guardNamedClientFields(box);
    expect(guarded.name).toBe("loop");
    expect(guarded.action).toBe("Mixed condition");
    expect(guarded.self).toBe(guarded);

    let deep: { child?: unknown; action?: string; verdict?: string } = { action: "BUY", verdict: "Avoid" };
    for (let index = 0; index < CLIENT_PAYLOAD_MAX_DEPTH + 3; index += 1) deep = { child: deep };
    const walked = guardNamedClientFields(deep);
    let cursor: { child?: unknown; action?: string; verdict?: string } = walked;
    for (let index = 0; index < CLIENT_PAYLOAD_MAX_DEPTH + 3; index += 1) cursor = cursor.child as typeof cursor;
    expect(cursor.action).toBe("Upper-side condition");
    expect(cursor.verdict).toBe("Lower-side condition");
  });

  it("neutralizes root, nested, and nested-array trade fields", () => {
    expect(guardNamedClientFields([{ action: "BUY" }])[0]?.action).toBe("Upper-side condition");
    expect(guardNamedClientFields({ rows: [{ action: "SELL" }] }).rows[0]?.action).toBe("Lower-side condition");
    expect(guardNamedClientFields([[{ action: "AVOID" }]])[0]?.[0]?.action).toBe("Lower-side condition");
    const feed = neutralizeChannelPayload([
      { title: "A BUY setup", link: "https://example.com/BUY", ticker: "HOLD", description: "Then BUY the close." },
    ]);
    expect(feed[0]?.title).toBe("A Upper-side condition setup");
    expect(feed[0]?.description).toContain("Upper-side condition");
    expect(feed[0]?.link).toBe("https://example.com/BUY");
    expect(feed[0]?.ticker).toBe("HOLD");
  });

  it("leaves cashtags, hashtags, URLs, emails, host names, and hyphenated compounds in prose", () => {
    const span = "\u00001\u0000";
    const prose = `Buy-Rite Inc filed at BUY.com. Watch $BUY and #BUY and mail desk@BUY.com. See https://example.com/BUY then BUY the close. Keep ${span}. Quote price.SELL and a.BUY.`;
    const text = neutralizeChannelText(prose);
    expect(text).toContain("Buy-Rite Inc");
    expect(text).toContain("BUY.com");
    expect(text).toContain("$BUY");
    expect(text).toContain("#BUY");
    expect(text).toContain("desk@BUY.com");
    expect(text).toContain("https://example.com/BUY");
    expect(text).toContain(span);
    expect(text).toContain("Upper-side condition the close");
    expect(text).toContain("price.Lower-side condition");
    expect(text).toContain("a.Upper-side condition");
    const urls = Array.from({ length: 11 }, (_, index) => `https://cdn.example/${index}/BUY`);
    const restored = neutralizeChannelText(urls.join(" "));
    for (const url of urls) expect(restored).toContain(url);
    expect(text).not.toMatch(/Upper-side condition-Rite|Upper-side condition\.com|\$Upper-side|#Upper-side/);
  });

  it("neutralizes an 8000-node list without a quadratic walk", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const nodes = Array.from({ length: CLIENT_PAYLOAD_MAX_NODES }, () => ({ action: "BUY" }));
    const started = performance.now();
    const guarded = guardNamedClientFields(nodes);
    const elapsed = performance.now() - started;
    warn.mockRestore();
    expect(guarded).toHaveLength(CLIENT_PAYLOAD_MAX_NODES);
    expect(guarded[0]?.action).toBe("Upper-side condition");
    expect(guarded[CLIENT_PAYLOAD_MAX_NODES - 1]?.action).toBe("Upper-side condition");
    expect(elapsed).toBeLessThan(500);
  });

  it("keeps a large clean payload deep-equal to its input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = Array.from({ length: 9000 }, (_, index) => ({ id: index, q: { p: index } }));
    const started = performance.now();
    const guarded = guardNamedClientFields(rows);
    const elapsed = performance.now() - started;
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(guarded).toEqual(rows);
    expect(guarded[5000]?.q).toEqual({ p: 5000 });
    expect(guarded[8999]?.q).not.toBeNull();
    expect(elapsed).toBeLessThan(500);
  });

  it("returns the neutralized array when a list refers back to itself", () => {
    const items: Array<{ title: string } | unknown[]> = [{ title: "A BUY setup" }];
    items.push(items);
    const out = neutralizeChannelPayload(items);
    expect(out[1]).toBe(out);
    expect((out[0] as { title: string }).title).toBe("A Upper-side condition setup");
    expect((out[1] as typeof out)[0]).toBe(out[0]);
  });
});
