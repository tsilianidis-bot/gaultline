import { describe, expect, it } from "vitest";
import { router, publicProcedure, adminProcedure } from "./_core/trpc";
import {
  ledgerScoreDirection,
  neutralizeClientPayload,
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
    expect(ledgerScoreDirection({ verdict: "REDUCE" })).toBe(-1);
    expect(ledgerScoreDirection({ verdict: "ACCUMULATE" })).toBe(1);
  });

  it("rewrites a customer procedure payload and leaves admin procedures raw", async () => {
    const app = router({
      customer: publicProcedure.query(() => ({
        finalVerdictAction: "ACQUIRE",
        class: "OVERWEIGHT",
        direction: "Avoid",
        verdict: "STRONG REDUCE",
        action: "BUY",
        internalDirection: "positive",
      })),
      ownerOnly: adminProcedure.query(() => ({ verdict: "BUY" })),
    });
    const customer = await app.createCaller({ req: {} as never, res: {} as never, user: { role: "admin" } } as never).customer();
    expect(customer.finalVerdictAction).toBe("Upper-side condition");
    expect(customer.class).toBe("Upper-side condition");
    expect(customer.direction).toBe("Lower-side condition");
    expect(customer.verdict).toBe("Lower-side condition");
    expect(customer.action).toBe("Upper-side condition");
    expect(customer.internalDirection).toBe("positive");
    expect(JSON.stringify(customer)).not.toMatch(/\b(?:ACQUIRE|OVERWEIGHT|AVOID|STRONG REDUCE|BUY)\b/);
    const raw = neutralizeClientPayload({ action: { class: "UNDERWEIGHT" } });
    expect(raw.action.class).toBe("Lower-side condition");
    await expect(app.createCaller({ req: {} as never, res: {} as never, user: { role: "user" } } as never).ownerOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
