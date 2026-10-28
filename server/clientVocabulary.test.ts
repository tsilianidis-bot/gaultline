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
    expect(neutralizeChannelText("BUY.de BUY.fr BUY.xyz report.BUY.pdf")).toBe("BUY.de BUY.fr BUY.xyz report.BUY.pdf");
    expect(neutralizeChannelText("BUY.com")).toBe("BUY.com");
    expect(neutralizeChannelText("BUY.now")).toBe("Upper-side condition.now");
    expect(neutralizeChannelText("SELL.today")).toBe("Lower-side condition.today");
    expect(neutralizeChannelText("AVOID.it")).toBe("Lower-side condition.it");
    expect(neutralizeChannelText("BUY.NVDA")).toBe("Upper-side condition.NVDA");
    expect(neutralizeChannelText("STRONG BUY.Now")).toBe("Upper-side condition.Now");
    expect(neutralizeChannelText("REDUCE.now")).toBe("Lower-side condition.now");
    expect(neutralizeChannelText("BUY.2026")).toBe("Upper-side condition.2026");
    expect(neutralizeChannelText("the.BUY.sign")).toBe("the.Upper-side condition.sign");
    expect(neutralizeChannelText("BUY.Sell")).toBe("Upper-side condition.Lower-side condition");
    expect(neutralizeChannelText("Contact SELL@x.io.")).toBe("Contact SELL@x.io.");
    const urls = Array.from({ length: 11 }, (_, index) => `https://cdn.example/${index}/BUY`);
    const restored = neutralizeChannelText(urls.join(" "));
    for (const url of urls) expect(restored).toContain(url);
    expect(text).not.toMatch(/Upper-side condition-Rite|Upper-side condition\.com|\$Upper-side|#Upper-side/);
  });

  it("leaves lowercase and sentence-case English unchanged and still neutralizes all-caps trade tokens", () => {
    const unchanged = [
      "We reduce costs",
      "How to reduce stress",
      "We avoid crowds",
      "Avoid the draft",
      "Avoid leverage",
      "We hold the line",
      "Hold the line",
      "Please add a note",
      "Add a note",
      "We keep going",
      "Keep going",
      "Please wait here",
      "Wait here",
      "avoid NVDA",
    ];
    for (const sentence of unchanged) {
      expect(neutralizeChannelText(sentence)).toBe(sentence);
    }
    expect(neutralizeChannelText("REDUCE")).toBe("Lower-side condition");
    expect(neutralizeChannelText("We REDUCE costs")).toBe("We Lower-side condition costs");
    expect(neutralizeChannelText("AVOID")).toBe("Lower-side condition");
    expect(neutralizeChannelText("HOLD")).toBe("Mixed condition");
    expect(neutralizeChannelText("ADD")).toBe("Upper-side condition");
    expect(neutralizeChannelText("KEEP")).toBe("Mixed condition");
    expect(neutralizeChannelText("WAIT")).toBe("Mixed condition");
    expect(neutralizeChannelText("BUY")).toBe("Upper-side condition");
    expect(neutralizeChannelText("SELL")).toBe("Lower-side condition");
    expect(neutralizeChannelText("ADD GRADUALLY")).toBe("Upper-side condition");
    expect(neutralizeChannelText("Please HOLD")).toBe("Please Mixed condition");
    expect(neutralizeChannelText("ADD a note")).toBe("Upper-side condition a note");
    expect(neutralizeChannelText("KEEP going")).toBe("Mixed condition going");
    expect(neutralizeChannelText("WAIT here")).toBe("Mixed condition here");
    expect(neutralizeChannelText("Avoid NVDA")).toBe("Lower-side condition NVDA");
    expect(neutralizeChannelText("Avoid $NVDA")).toBe("Lower-side condition $NVDA");
    expect(neutralizeChannelText("Avoid BRK.B")).toBe("Lower-side condition BRK.B");
  });

  it("neutralizes directive reduce and avoid phrases and leaves bare English", () => {
    expect(neutralizeChannelText("Reduce exposure")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Reduce your position")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Reduce the position")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Avoid this stock")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Why you should avoid this stock")).toBe("Why you should Lower-side condition");
    expect(neutralizeChannelText("We reduce costs")).toBe("We reduce costs");
    expect(neutralizeChannelText("Avoid leverage")).toBe("Avoid leverage");
    expect(neutralizeChannelText("avoid these shares")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Avoid buying")).toBe("Lower-side condition");
    expect(neutralizeChannelText("do not avoid chasing")).toBe("do not Lower-side condition");
    expect(neutralizeChannelText("Reduce exposure to equities")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Reduce exposure to NVDA")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Reduce exposure to $NVDA")).toBe("Lower-side condition");
    expect(neutralizeChannelText("Reduce exposure to the market")).toBe("Lower-side condition");
    expect(neutralizeChannelText("to reduce the risk of fraud")).toBe("to reduce the risk of fraud");
    expect(neutralizeChannelText("reduce your risk of heart disease")).toBe("reduce your risk of heart disease");
    expect(neutralizeChannelText("reduce exposure to sunlight")).toBe("reduce exposure to sunlight");
    expect(neutralizeChannelText("avoid the stock market crash")).toBe("avoid the stock market crash");
    expect(neutralizeChannelText("Avoid the sector rotation trap")).toBe("Avoid the sector rotation trap");
    expect(neutralizeChannelText("avoid the shares of the company")).toBe("avoid the shares of the company");
  });

  it("does not treat stoplisted English words or acronyms as tickers after Avoid", () => {
    const stopped = ["THE", "AND", "OR", "TO", "IN", "IT", "A", "I", "ALL", "FOMO", "CEO", "LLM", "AI", "US", "UK", "EM", "HY", "CPI", "GDP", "FED", "U.S.", "U.S"];
    for (const word of stopped) {
      expect(neutralizeChannelText(`Avoid ${word}`)).toBe(`Avoid ${word}`);
    }
    expect(neutralizeChannelText("Avoid $AI")).toBe("Avoid $AI");
    expect(neutralizeChannelText("Avoid NVDA")).toBe("Lower-side condition NVDA");
    expect(neutralizeChannelText("Avoid $NVDA")).toBe("Lower-side condition $NVDA");
  });

  it("neutralizes case-insensitive buy and sell prose", () => {
    expect(neutralizeChannelText("Sell now")).toBe("Lower-side condition now");
    expect(neutralizeChannelText("Buy the dip")).toBe("Upper-side condition the dip");
    expect(neutralizeChannelText("Strong Buy")).toBe("Upper-side condition");
    expect(neutralizeChannelText("Top 5 stocks to buy")).toBe("Top 5 stocks to Upper-side condition");
    expect(neutralizeChannelText("Analysts rate it Buy")).toBe("Analysts rate it Upper-side condition");
    expect(neutralizeChannelText("**Sell**")).toBe("**Lower-side condition**");
    expect(neutralizeChannelText("[Buy](url)")).toBe("[Upper-side condition](url)");
    expect(neutralizeChannelText("Buy the close")).toBe("Upper-side condition the close");
    expect(neutralizeChannelText("Sell the close")).toBe("Lower-side condition the close");
    expect(neutralizeChannelText("Strong buy the rumor")).toBe("Upper-side condition the rumor");
    expect(neutralizeChannelText("We buy groceries")).toBe("We Upper-side condition groceries");
    expect(neutralizeChannelText("We sell tickets")).toBe("We Lower-side condition tickets");
    expect(neutralizeChannelText("Add gradually to the list")).toBe("Upper-side condition to the list");
    expect(neutralizeChannelText("Analysts say accumulate")).toBe("Analysts say Upper-side condition");
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

  it("stops a 5000-level payload without throwing or nulling", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let node: { child?: unknown; marker: string } = { marker: "leaf" };
    for (let index = 0; index < 5000; index += 1) node = { child: node, marker: "wrap" };
    const root = { action: "BUY", child: node };
    let guarded: { action?: string; child?: typeof node } | undefined;
    expect(() => {
      guarded = guardNamedClientFields(root);
    }).not.toThrow();
    expect(guarded?.action).toBe("Upper-side condition");
    let cursor: { child?: unknown; marker?: string } | undefined = guarded?.child;
    for (let index = 0; index < 5000; index += 1) {
      expect(cursor).not.toBeNull();
      expect(cursor).toBeTruthy();
      cursor = cursor?.child as typeof cursor;
    }
    expect(cursor).toMatchObject({ marker: "leaf" });
    expect(warn.mock.calls.some(call => String(call[0]).includes("depth"))).toBe(true);
    warn.mockRestore();
  });

  it("masks long pathological strings in under 50ms", () => {
    const bytes = 200 * 1024;
    const samples = [
      "a".repeat(bytes),
      "a.".repeat(bytes / 2),
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".repeat(Math.ceil(bytes / 64)).slice(0, bytes),
    ];
    for (const sample of samples) {
      const started = performance.now();
      neutralizeChannelText(sample);
      expect(performance.now() - started).toBeLessThan(50);
    }
  });
});
