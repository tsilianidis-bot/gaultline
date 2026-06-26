/**
 * Tests for FAULTLINE AI Chatbot Engine
 * Covers: intent detection, lead scoring, aggregation, pricing validation
 */
import { describe, it, expect } from "vitest";
import { detectIntent, aggregateLeadScore, validatePricing, CANONICAL_PRICING } from "./chatbotEngine";

// ── CANONICAL_PRICING tests ───────────────────────────────────────────────────
describe("CANONICAL_PRICING (single source of truth)", () => {
  it("Free plan is $0", () => {
    expect(CANONICAL_PRICING.free.priceLabel).toBe("Free");
    expect(CANONICAL_PRICING.free.price).toBe("$0");
  });

  it("Mobile (Core) plan is $9.99/month", () => {
    expect(CANONICAL_PRICING.core.priceLabel).toBe("$9.99/mo");
    expect(CANONICAL_PRICING.core.price).toBe("$9.99");
    expect(CANONICAL_PRICING.core.interval).toBe("month");
  });

  it("Trader (Pro) plan is $59/month", () => {
    expect(CANONICAL_PRICING.premium.priceLabel).toBe("$59/mo");
    expect(CANONICAL_PRICING.premium.price).toBe("$59.00");
    expect(CANONICAL_PRICING.premium.interval).toBe("month");
  });

  it("Founding Member plan is $49/month locked for life", () => {
    expect(CANONICAL_PRICING.founding.priceLabel).toBe("$49/mo (locked for life)");
    expect(CANONICAL_PRICING.founding.price).toBe("$49.00");
    expect(CANONICAL_PRICING.founding.interval).toBe("month");
  });

  it("Lifetime plan is $299 one-time", () => {
    expect(CANONICAL_PRICING.lifetime.priceLabel).toBe("$299 one-time");
    expect(CANONICAL_PRICING.lifetime.price).toBe("$299.00");
    expect(CANONICAL_PRICING.lifetime.interval).toBe("one_time");
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
  it("accepts a response with correct Mobile price $9.99", () => {
    expect(validatePricing("The Mobile plan is $9.99/mo.")).toBe(true);
  });

  it("accepts a response with correct Trader price $59", () => {
    expect(validatePricing("The Trader plan is $59/mo.")).toBe(true);
  });

  it("accepts a response with correct Founding price $49", () => {
    expect(validatePricing("Founding Member is $49/mo locked for life.")).toBe(true);
  });

  it("accepts a response with correct Lifetime price $299", () => {
    expect(validatePricing("Lifetime access is $299 one-time.")).toBe(true);
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

  it("accepts a full plan comparison with correct prices", () => {
    const response = `Here are the FAULTLINE plans:
• Free — $0: Basic access
• Mobile — $9.99/mo: Signals, Pressure Index
• Trader — $59/mo: Full platform
• Founding Member — $49/mo locked for life: All features forever
• Lifetime — $299 one-time: One payment, all features`;
    expect(validatePricing(response)).toBe(true);
  });
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

  it("detects pricing intent from 'How much is Mobile?'", () => {
    const result = detectIntent("How much is Mobile?");
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

  it("detects pricing intent from 'Is there a Lifetime plan?'", () => {
    const result = detectIntent("Is there a Lifetime plan?");
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

  it("detects plan interest for mobile (maps to core)", () => {
    const result = detectIntent("Tell me about the mobile plan");
    expect(result.planInterest).toBe("core");
  });

  it("detects plan interest for trader (maps to premium)", () => {
    const result = detectIntent("Tell me about the trader plan");
    expect(result.planInterest).toBe("premium");
  });

  it("detects plan interest for founding", () => {
    const result = detectIntent("I want the founding member plan");
    expect(result.planInterest).toBe("founding");
  });

  it("detects plan interest for lifetime", () => {
    const result = detectIntent("Is there a lifetime option?");
    expect(result.planInterest).toBe("lifetime");
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
