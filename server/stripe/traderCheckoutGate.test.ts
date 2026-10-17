import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GATE_CHECKOUT_PLAN_ID } from "../../shared/tiers";

const gate = readFileSync("client/src/components/PremiumGate.tsx", "utf8");
const offer = readFileSync("client/src/components/MembershipOffer.tsx", "utf8");
const chatbot = readFileSync("server/chatbotEngine.ts", "utf8");

describe("Trader upgrade buttons cannot start a core checkout", () => {
  it("sends only the Intelligence plan id from both gate checkout buttons", () => {
    expect(GATE_CHECKOUT_PLAN_ID).toBe("premium");
    expect(gate).toContain("GATE_CHECKOUT_PLAN_ID");
    expect(gate).not.toMatch(/GATE_REQUIRED_TIER\[variant\] === ["']core["'] \? ["']core["']/);
    expect(gate).not.toContain("planId: 'core'");
    expect(gate).not.toContain('planId: "core"');
    expect(gate).toContain("data-checkout-blocked");
    expect(gate).toContain("useIntelligenceCheckout");
  });

  it("hides pricing buy buttons unless getPlans says the plan is available", () => {
    expect(offer).toContain("plan?.available");
    expect(offer).toContain("data-checkout-allowlist");
    expect(offer).toContain("data-checkout-coming-soon");
    expect(offer).not.toMatch(/Checkout opens soon/);
  });

  it("does not tell the chatbot that checkout opens soon", () => {
    expect(chatbot).not.toMatch(/checkout opens soon/i);
    expect(chatbot).toContain("New account registration is closed.");
  });
});
