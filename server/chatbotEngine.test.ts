/**
 * Tests for FAULTLINE AI Chatbot Engine
 * Covers: intent detection, lead scoring, aggregation, pricing validation
 */
import { describe, it, expect } from "vitest";
import { detectIntent, aggregateLeadScore, validatePricing, CANONICAL_PRICING, PRICE_NOT_ON_SALE_ANSWER, isPlanPriceQuestion } from "./chatbotEngine";

// ── CANONICAL_PRICING tests ───────────────────────────────────────────────────
describe("CANONICAL_PRICING (single source of truth)", () => {
  it("publishes one canonical $99/month Intelligence membership", () => {
    expect(Object.keys(CANONICAL_PRICING)).toEqual(["premium"]);
    expect(CANONICAL_PRICING.premium.name).toBe("FAULTLINE Intelligence");
    expect(CANONICAL_PRICING.premium.priceLabel).toBe("$99/month");
    expect(CANONICAL_PRICING.premium.price).toBe("$99.00");
    expect(CANONICAL_PRICING.premium.interval).toBe("month");
  });

  it("No plan costs $29.99 (legacy price must not exist)", () => {
    const allPrices = Object.values(CANONICAL_PRICING).map(p => p.price);
    expect(allPrices).not.toContain("$29.99");
  });

  it("No plan costs $39 (legacy price must not exist)", () => {
    const allPrices = Object.values(CANONICAL_PRICING).map(p => p.price);
    expect(allPrices.some(p => p.startsWith("$39"))).toBe(false);
  });

  it("No plan costs $79 (legacy price must not exist)", () => {
    const allPrices = Object.values(CANONICAL_PRICING).map(p => p.price);
    expect(allPrices.some(p => p.startsWith("$79"))).toBe(false);
  });
});

// ── validatePricing tests ─────────────────────────────────────────────────────
describe("validatePricing", () => {
  it("rejects a quoted Trader price while paid plans are not on sale", () => {
    expect(validatePricing("The Trader plan is $59/mo.")).toBe(false);
  });

  it("accepts the approved Intelligence price while checkout stays closed", () => {
    expect(validatePricing("FAULTLINE Intelligence is $99/month.")).toBe(true);
  });

  it("rejects a quoted Founding price while paid plans are not on sale", () => {
    expect(validatePricing("Founding Member is $49/mo locked while active.")).toBe(false);
  });

  it("accepts the not-on-sale answer", () => {
    expect(validatePricing(PRICE_NOT_ON_SALE_ANSWER)).toBe(true);
    expect(PRICE_NOT_ON_SALE_ANSWER).toContain("Membership checkout is not open yet.");
  });

  it("rejects a response containing retired public lifetime pricing", () => {
    expect(validatePricing("Lifetime access is $299 one-time.")).toBe(false);
  });

  it("accepts a response with no prices at all", () => {
    expect(validatePricing("FAULTLINE is a market navigation system.")).toBe(true);
  });

  it("rejects a response containing legacy $29.99", () => {
    expect(validatePricing("The Premium plan is $29.99/month.")).toBe(false);
  });

  it("rejects a response containing legacy $39", () => {
    expect(validatePricing("Our Analyst plan is $39/month.")).toBe(false);
  });

  it("rejects a response containing legacy $79", () => {
    expect(validatePricing("The Operator plan is $79/mo.")).toBe(false);
  });

  it("rejects a response containing legacy $199", () => {
    expect(validatePricing("Founding Access is $199 one-time.")).toBe(false);
  });

  it("rejects a response containing legacy $1,200", () => {
    expect(validatePricing("Annual plan is $1,200/year.")).toBe(false);
  });

  it("is idempotent — can be called multiple times on same string", () => {
    const response = "The Premium plan is $29.99/month.";
    expect(validatePricing(response)).toBe(false);
    expect(validatePricing(response)).toBe(false);
    expect(validatePricing(response)).toBe(false);
  });

  it("rejects a full plan comparison that quotes prices", () => {
    const response = `Here are the FAULTLINE plans:
• Founding Member — $49/mo locked while active: Founding rate
• Trader — $59/mo: Primary investor experience
• Power — $99/mo: Full professional toolset`;
    expect(validatePricing(response)).toBe(false);
  });
});

describe("isPlanPriceQuestion (answered with the not-on-sale reply)", () => {
  for (const q of ["How much does it cost?", "What is your pricing?", "How do I upgrade?", "What's the founding rate?", "Can I buy Power?"]) {
    it(`treats "${q}" as a price question`, () => expect(isPlanPriceQuestion(q)).toBe(true));
  }
  for (const q of ["What is the Pressure Index?", "Explain the yield curve", "hello"]) {
    it(`does not treat "${q}" as a price question`, () => expect(isPlanPriceQuestion(q)).toBe(false));
  }
});

// ── detectIntent tests ────────────────────────────────────────────────────────
describe("detectIntent", () => {
  it("detects pricing intent from 'how much does it cost'", () => {
    const result = detectIntent("how much does it cost?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'pricing plans'", () => {
    const result = detectIntent("What are your pricing plans?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'How much is Power?'", () => {
    const result = detectIntent("How much is Power?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'How much is Trader?'", () => {
    const result = detectIntent("How much is Trader?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'What does Founding cost?'", () => {
    const result = detectIntent("What does Founding cost?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'Is there a Power plan?'", () => {
    const result = detectIntent("Is there a Power plan?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'What is your pricing?'", () => {
    const result = detectIntent("What is your pricing?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'Compare all plans'", () => {
    const result = detectIntent("Compare all plans");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects pricing intent from 'Which plan should I choose?'", () => {
    const result = detectIntent("Which plan should I choose?");
    expect(result.pricingIntent).toBe(true);
    expect(result.intent).toBe("pricing");
  });

  it("detects signup intent from 'sign up'", () => {
    const result = detectIntent("I want to sign up");
    expect(result.signupIntent).toBe(true);
  });

  it("detects upgrade intent from 'unlock full access'", () => {
    const result = detectIntent("How do I unlock full access?");
    expect(result.intent).toBe("upgrade");
  });

  it("detects security mention for known tickers", () => {
    const result = detectIntent("Tell me about nvda");
    expect(result.intent).toBe("security_mention");
    expect(result.securitiesMentioned.some(s => s === "NVDA")).toBe(true);
  });

  it("detects bitcoin as security mention", () => {
    const result = detectIntent("Tell me about bitcoin");
    expect(result.intent).toBe("security_mention");
    expect(result.securitiesMentioned.some(s => s.toUpperCase().includes("BITCOIN"))).toBe(true);
  });

  it("detects plan interest for core", () => {
    const result = detectIntent("Tell me about the core plan");
    expect(result.planInterest).toBe("core");
  });

  it("does not map retired mobile plan terminology to a public tier", () => {
    const result = detectIntent("Tell me about the mobile plan");
    expect(result.planInterest).toBeNull();
  });

  it("detects plan interest for trader (maps to core)", () => {
    const result = detectIntent("Tell me about the trader plan");
    expect(result.planInterest).toBe("core");
  });

  it("detects plan interest for founding", () => {
    const result = detectIntent("I want the founding member plan");
    expect(result.planInterest).toBe("founding");
  });

  it("does not map retired lifetime terminology to a public tier", () => {
    const result = detectIntent("Is there a lifetime option?");
    expect(result.planInterest).toBeNull();
  });

  it("returns no pricing or signup intent for a pure greeting", () => {
    const result = detectIntent("Hi!");
    expect(result.pricingIntent).toBe(false);
    expect(result.signupIntent).toBe(false);
  });

  it("assigns higher lead score for pricing intent than greeting", () => {
    const pricing = detectIntent("how much does it cost?");
    const greeting = detectIntent("Hi!");
    expect(pricing.leadScore).toBeGreaterThan(greeting.leadScore);
  });

  it("lead score is between 0 and 100", () => {
    const result = detectIntent("I want to upgrade to founding and sign up now, how much does it cost?");
    expect(result.leadScore).toBeGreaterThanOrEqual(0);
    expect(result.leadScore).toBeLessThanOrEqual(100);
  });

  it("securitiesMentioned is an array", () => {
    const result = detectIntent("Hello");
    expect(Array.isArray(result.securitiesMentioned)).toBe(true);
  });

  it("pricing intent takes priority over signup intent", () => {
    const result = detectIntent("I want to start with a plan");
    expect(result.intent).toBe("pricing");
    expect(result.pricingIntent).toBe(true);
  });
});

// ── aggregateLeadScore tests ──────────────────────────────────────────────────
describe("aggregateLeadScore", () => {
  it("returns 0 for empty array", () => {
    expect(aggregateLeadScore([])).toBe(0);
  });

  it("caps score at 100", () => {
    const highIntentAnalyses = Array(10).fill(null).map(() =>
      detectIntent("I want to buy the founding plan right now, how much does it cost?")
    );
    const score = aggregateLeadScore(highIntentAnalyses);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("increases score with more intent signals", () => {
    const oneMessage = [detectIntent("how much does it cost?")];
    const manyMessages = [
      detectIntent("how much does it cost?"),
      detectIntent("I want to sign up"),
      detectIntent("Tell me about the founding plan"),
    ];
    const scoreOne = aggregateLeadScore(oneMessage);
    const scoreMany = aggregateLeadScore(manyMessages);
    expect(scoreMany).toBeGreaterThanOrEqual(scoreOne);
  });

  it("returns integer", () => {
    const analyses = [detectIntent("how much does it cost?")];
    const score = aggregateLeadScore(analyses);
    expect(Number.isInteger(score)).toBe(true);
  });

  it("single pricing message gives non-zero score", () => {
    const analyses = [detectIntent("how much does it cost?")];
    const score = aggregateLeadScore(analyses);
    expect(score).toBeGreaterThan(0);
  });
});
