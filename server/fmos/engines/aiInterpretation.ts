// ============================================================
// FMOS Engine 11 — AI Interpretation Engine
// (server/fmos/engines/aiInterpretation.ts)
//
// Generates human-readable narrative explanations for all
// FMOS engine outputs. Uses the LLM to produce contextual,
// educational, and actionable market commentary.
//
// This engine wraps the existing invokeLLM() helper and
// provides structured prompts that produce consistent,
// high-quality market narratives.
//
// Inputs:
//   - All upstream engine outputs (partial FMOSUniversalOutput)
//
// Output: FMOSAIInterpretation
// ============================================================

import { invokeLLM } from "../../_core/llm";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type {
  FMOSRegimeOutput,
  FMOSProbabilityDistribution,
  FMOSConfidenceOutput,
  FMOSDecisionOutput,
  FMOSHistoricalAnalog,
  FMOSMarketDNA,
  FMOSAIInterpretation,
} from "../types";

// ── Fallback Interpretation ───────────────────────────────────

function buildFallbackInterpretation(
  pressure: FaultlinePressureOutput,
  regime: FMOSRegimeOutput,
  probability: FMOSProbabilityDistribution,
  decision: FMOSDecisionOutput
): FMOSAIInterpretation {
  const p = pressure.overallPressure;
  const getVec = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 30;

  const topVector = pressure.vectors.reduce(
    (max, v) => v.score > max.score ? v : max,
    pressure.vectors[0] ?? { id: "unknown", score: 0, label: "Unknown", trend: "stable" as const }
  );

  return {
    headline: `${regime.currentRegime} — ${probability.bull > probability.bear ? "Bullish" : "Bearish"} bias with ${decision.conviction}% conviction`,
    whyNow: `Systemic pressure at ${p}/100 with ${topVector.label} as the primary driver. ${regime.description}`,
    supportingEvidence: probability.bullEvidence.slice(0, 2).join(". "),
    contradictingEvidence: probability.bearEvidence.slice(0, 2).join(". "),
    historicalContext: `Current conditions most closely resemble historical periods of ${regime.currentRegime.toLowerCase()} with similar pressure profiles.`,
    portfolioImplications: decision.positionSizing,
    watchFor: decision.invalidationConditions,
    educationalNote: `The FAULTLINE Pressure Index measures systemic market stress across ${pressure.vectors.length} risk vectors. A reading of ${p}/100 indicates ${p < 40 ? "low" : p < 65 ? "moderate" : "high"} systemic risk.`,
  };
}

// ── LLM Prompt Builder ────────────────────────────────────────

function buildInterpretationPrompt(
  pressure: FaultlinePressureOutput,
  regime: FMOSRegimeOutput,
  probability: FMOSProbabilityDistribution,
  confidence: FMOSConfidenceOutput,
  decision: FMOSDecisionOutput,
  topAnalog: FMOSHistoricalAnalog,
  dna: FMOSMarketDNA,
  symbol?: string
): string {
  const p = pressure.overallPressure;
  const topVectors = pressure.vectors
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(v => `${v.label}: ${v.score}/100 (${v.trend})`)
    .join(", ");

  const symbolContext = symbol ? ` for ${symbol.toUpperCase()}` : " (market-wide)";

  return `You are FAULTLINE, an institutional-grade market intelligence system. Generate a concise, professional market interpretation${symbolContext}.

## Current FMOS Engine Outputs

**Pressure Index:** ${p}/100
**Regime:** ${regime.currentRegime} (confidence: ${regime.confidence}%, stability: ${regime.stability}%)
**Transition Risk:** ${regime.transitionRisk}% (30-day transition probability: ${regime.transitionProbability30d}%)
**Market DNA:** ${dna.currentDNA} (${dna.confidence}% confidence)

**Top Risk Vectors:** ${topVectors}

**Probability Distribution:** Bull ${probability.bull}% / Neutral ${probability.neutral}% / Bear ${probability.bear}%
**Primary Driver:** ${probability.primaryDriver}

**Decision:** ${decision.verdict} (conviction: ${decision.conviction}%)
**Action Bias:** ${decision.actionBias}

**Confidence:** ${confidence.label} (${confidence.score}/100)
${confidence.contradictions.length > 0 ? `**Contradictions:** ${confidence.contradictions.join("; ")}` : ""}

**Closest Historical Analog:** ${topAnalog.label} (${topAnalog.similarity}% similarity)
${topAnalog.outcome ? `Historical outcome: ${topAnalog.outcome}` : ""}

## Required Output (JSON)

Respond with ONLY a JSON object matching this exact schema:
{
  "headline": "One sentence capturing the key market message (max 100 chars)",
  "whyNow": "Why this signal matters right now — what changed or is changing (2-3 sentences)",
  "supportingEvidence": "Key evidence supporting the primary thesis (2-3 sentences)",
  "contradictingEvidence": "Key evidence contradicting the primary thesis (1-2 sentences)",
  "historicalContext": "How this compares to the ${topAnalog.label} analog and what it means (2-3 sentences)",
  "portfolioImplications": "Specific portfolio actions implied by this analysis (2-3 sentences)",
  "watchFor": ["3-4 specific things to monitor that would change the thesis"],
  "educationalNote": "Plain-English explanation for less experienced investors (1-2 sentences)"
}`;
}

// ── Main AI Interpretation Engine Function ────────────────────

/**
 * Generate AI narrative interpretation of FMOS engine outputs.
 *
 * @param pressure    - Output from calculateFaultlinePressure()
 * @param regime      - Output from computeRegime()
 * @param probability - Output from computeProbability()
 * @param confidence  - Output from computeConfidence()
 * @param decision    - Output from computeDecision()
 * @param topAnalog   - Top historical analog
 * @param dna         - Market DNA
 * @param symbol      - Optional ticker symbol
 */
export async function computeAIInterpretation(
  pressure: FaultlinePressureOutput,
  regime: FMOSRegimeOutput,
  probability: FMOSProbabilityDistribution,
  confidence: FMOSConfidenceOutput,
  decision: FMOSDecisionOutput,
  topAnalog: FMOSHistoricalAnalog,
  dna: FMOSMarketDNA,
  symbol?: string
): Promise<FMOSAIInterpretation> {
  try {
    const prompt = buildInterpretationPrompt(
      pressure, regime, probability, confidence, decision, topAnalog, dna, symbol
    );

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are FAULTLINE, an institutional-grade market intelligence system. Respond only with valid JSON. No markdown, no explanation, no code blocks.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "fmos_interpretation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              whyNow: { type: "string" },
              supportingEvidence: { type: "string" },
              contradictingEvidence: { type: "string" },
              historicalContext: { type: "string" },
              portfolioImplications: { type: "string" },
              watchFor: { type: "array", items: { type: "string" } },
              educationalNote: { type: "string" },
            },
            required: [
              "headline", "whyNow", "supportingEvidence", "contradictingEvidence",
              "historicalContext", "portfolioImplications", "watchFor", "educationalNote"
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in LLM response");

    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as FMOSAIInterpretation;
    return parsed;
  } catch (err) {
    console.error("[FMOS AI Interpretation] LLM call failed:", err);
    return buildFallbackInterpretation(pressure, regime, probability, decision);
  }
}

/**
 * Generate a quick headline interpretation without full LLM call.
 * Used for performance-sensitive contexts.
 */
export function computeQuickInterpretation(
  pressure: FaultlinePressureOutput,
  regime: FMOSRegimeOutput,
  probability: FMOSProbabilityDistribution,
  decision: FMOSDecisionOutput
): Pick<FMOSAIInterpretation, "headline" | "whyNow" | "portfolioImplications"> {
  const p = pressure.overallPressure;

  const headline = `${regime.currentRegime} — ${decision.verdict} (${probability.bull}% bull / ${probability.bear}% bear)`;
  const whyNow = decision.primaryReason;
  const portfolioImplications = decision.positionSizing;

  return { headline, whyNow, portfolioImplications };
}
