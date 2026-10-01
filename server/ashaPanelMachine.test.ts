import { describe, expect, it } from "vitest";
import { reduceAshaAskFailure } from "../shared/ashaPanelMachine";
import { toAshaGatewayHistory } from "../shared/ashaLimits";
import { ashaAskInputSchema } from "./ashaAskInput";

function history(count: number, content = "A prior turn.") {
  return Array.from({ length: count }, (_, index) => ({
    role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `${content} ${index}`,
  }));
}

describe("PLATO ask failure state", () => {
  it("keeps a 429 on the unavailable panel with retry and never returns to summon", () => {
    const failure = reduceAshaAskFailure({ data: { code: "TOO_MANY_REQUESTS" } });
    expect(failure.panelState).toBe("unavailable");
    expect(failure.panelState).not.toBe("summon");
    expect(failure.kind).toBe("rate_limit");
    expect(failure.title).toBe("PLATO is temporarily unavailable");
    expect(failure.showRetry).toBe(true);
    expect(failure.showSignIn).toBe(false);
  });

  it("keeps a provider 5xx on the unavailable panel and never returns to summon", () => {
    const failure = reduceAshaAskFailure({ data: { code: "INTERNAL_SERVER_ERROR" } });
    expect(failure.panelState).toBe("unavailable");
    expect(failure.kind).toBe("unavailable");
    expect(failure.showRetry).toBe(true);
    expect(failure.title).toBe("PLATO is temporarily unavailable");
  });

  it("asks the user to sign in when the ask is unauthorized", () => {
    const failure = reduceAshaAskFailure({ data: { code: "UNAUTHORIZED" } });
    expect(failure.panelState).toBe("unavailable");
    expect(failure.showSignIn).toBe(true);
    expect(failure.showRetry).toBe(true);
  });
});

describe("PLATO conversation limits", () => {
  it("accepts a conversation longer than the old 20/24 boundary", () => {
    const messages = history(32);
    expect(toAshaGatewayHistory(messages)).toHaveLength(32);
    const parsed = ashaAskInputSchema.parse({
      userMessage: "What changed after thirty turns?",
      history: messages,
      pageContext: { page: "/app/now" },
    });
    expect(parsed.history).toHaveLength(32);
    expect(parsed.history[31].content).toContain("31");
  });

  it("keeps the newest turns when the thread exceeds the shared cap and bounds each message", () => {
    const messages = history(45);
    messages[44] = { role: "assistant", content: "x".repeat(9000) };
    const gatewayHistory = toAshaGatewayHistory(messages);
    expect(gatewayHistory).toHaveLength(40);
    expect(gatewayHistory[0].content).toContain("5");
    expect(gatewayHistory.at(-1)?.content).toHaveLength(8000);
    expect(ashaAskInputSchema.safeParse({
      userMessage: "Still here?",
      history: gatewayHistory,
      pageContext: { page: "/app/now" },
    }).success).toBe(true);
  });

  it("rejects a history entry that exceeds the content guard", () => {
    const parsed = ashaAskInputSchema.safeParse({
      userMessage: "What changed?",
      history: [{ role: "assistant", content: "y".repeat(8001) }],
      pageContext: { page: "/app/now" },
    });
    expect(parsed.success).toBe(false);
  });
});
