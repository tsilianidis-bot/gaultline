/**
 * Tests for FAULTLINE AI Chatbot Engine
 * Covers: intent detection, lead scoring, aggregation
 */
import { describe, it, expect } from "vitest";
import { detectIntent, aggregateLeadScore } from "./chatbotEngine";

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

  it("detects signup intent from 'sign up'", () => {
    // Note: 'start' is in SIGNUP_KEYWORDS but 'free' is in PRICING_KEYWORDS
    // Use a message that only triggers signup
    const result = detectIntent("I want to sign up");
    // 'sign up' is signup but no pricing keyword → signup intent
    expect(result.signupIntent).toBe(true);
  });

  it("detects upgrade intent from 'unlock full access'", () => {
    // 'unlock' and 'full access' are upgrade keywords, no pricing keywords
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

  it("detects tsla as security mention", () => {
    const result = detectIntent("What about tsla?");
    expect(result.intent).toBe("security_mention");
  });

  it("detects plan interest for core", () => {
    // 'core' is in PLAN_KEYWORDS and also in PRICING_KEYWORDS
    const result = detectIntent("Tell me about the core plan");
    expect(result.planInterest).toBe("core");
  });

  it("detects plan interest for premium", () => {
    const result = detectIntent("Tell me about premium");
    expect(result.planInterest).toBe("premium");
  });

  it("detects plan interest for founding", () => {
    const result = detectIntent("I want the founding member plan");
    expect(result.planInterest).toBe("founding");
  });

  it("returns no pricing or signup intent for a pure greeting", () => {
    // 'Hi!' has no keywords at all
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
    // Both 'plan' (pricing) and 'start' (signup) are present — pricing wins
    const result = detectIntent("I want to start with a plan");
    expect(result.intent).toBe("pricing");
    expect(result.pricingIntent).toBe(true);
  });
});

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
