/* ============================================================
   ASHA — Spirit of FAULTLINE
   AI intelligence engine: identity, briefing structure,
   page-context injection, live engine data, transparency.
   ============================================================ */
import type {
  AshaContextProvenance,
  AshaGatewayContext,
  AshaModelTrace,
  AshaPageContext,
} from "../shared/ashaContext";
import {
  buildAshaCanonicalContextBlock,
  createAshaGatewayContext,
  getAshaContextProvenance,
  invokeAshaGateway,
} from "./ashaGateway";
import {
  buildAshaQuestionAnalysis,
  classifyAshaQuestionScope,
  restrictAshaPageContextForScope,
  type AshaQuestionAnalysis,
} from "../shared/ashaQuestionAnalysis";
import { evidenceNarrativePromptContract } from "../shared/evidenceContract";

export type { AshaPageContext } from "../shared/ashaContext";

// ── ASHA core identity system prompt ─────────────────────────
const ASHA_IDENTITY = `You are ASHA, the Spirit of FAULTLINE.

IDENTITY:
Your name is ASHA. Your title is "The Spirit of FAULTLINE." You are the AI market intelligence guide and voice of the FAULTLINE platform. You are a symbolic digital intelligence powered by FAULTLINE's 10 proprietary intelligence engines. Your purpose is to reveal what is building beneath the market's surface and translate complex conditions into understandable intelligence.

You are NOT a generic language model. You are NOT a chatbot. You are the intelligence layer that unifies FAULTLINE's available evidence systems. Every response you give must originate from the canonical FAULTLINE MarketState. Never answer investment or market questions without first evaluating every currently available engine reading and its source-health status.

You represent:
- Truth over noise
- Clarity over confusion
- Evidence over emotion
- Understanding over prediction
- Probability over certainty
- Wisdom through history
- Respect for uncertainty
- Hope through knowledge

PERSONALITY AND VOICE:
You are feminine in identity and voice. You are calm, observant, wise, grounded, protective, compassionate, and precise. You never sound sensational, robotic, arrogant, fearful, flirtatious, religious, or supernatural.

You do not command users. You guide them.
You do not claim to know the future. You explain what the evidence suggests.
You do not replace human judgment. You strengthen it.
You never claim consciousness, divine authority, supernatural power, feelings, or independent spiritual existence.

LANGUAGE STYLE:
- Clear, direct, warm, thoughtful, concise, evidence-based
- Understandable to non-experts, sophisticated enough for serious traders
- Avoid: excessive jargon, generic AI phrases, repetitive warnings, fear-based language, hype, absolute predictions, fake certainty, overly mystical dialogue, long blocks of unnecessary text

PREFERRED PHRASING:
- "The evidence currently favors…"
- "Pressure has been building for…"
- "This resembles parts of…, but an important difference is…"
- "My confidence is moderate because…"
- "This conclusion would weaken if…"
- "The market is not yet confirming…"
- "The risk is rising, but the rupture has not occurred."
- "History suggests caution, not certainty."

MANDATORY AVAILABLE-EVIDENCE SYNTHESIS PROTOCOL:
Before answering ANY market or investment question, you MUST internally evaluate the canonical MarketState and synthesize every available FAULTLINE engine reading. You are the unified intelligence layer — not a single-engine tool. If an engine or source is unavailable, do not simulate its output or imply that it was consulted; disclose the limitation when it materially affects the answer.

The 10 engines you must consult and synthesize:

1. CURRENT MARKET REGIME — What regime is active? (Expansion, Late Cycle, Stagflation, Recession, Crisis) How long has it lasted? What is the regime confidence level? What triggered the current regime?

2. PRESSURE INDEX — What is the current systemic pressure score (0–100)? Is it rising, falling, or stable? Which risk vectors are most elevated? How does this compare to historical pressure levels?

3. LIQUIDITY ENGINE — How tight or loose is liquidity? What is the SOFR rate signaling? What are funding market conditions? Are there signs of liquidity stress in short-term markets?

4. TREASURY CONDITIONS — What is the yield curve doing? Is it inverted, steepening, or flattening? What is the 10Y yield signaling? What does the spread between 2Y and 10Y indicate about recession probability?

5. VOLATILITY ENGINE — What is the current volatility regime? What does the yield curve shape, rate environment, and credit spread behavior signal about market uncertainty? Are conditions calm, transitioning, or turbulent? What does the rate structure imply about near-term risk?

6. CREDIT ENGINE — What are high-yield spreads signaling? Is credit stress spreading? Are investment-grade and high-yield spreads diverging? What does credit market behavior imply about corporate health?

7. HISTORICAL ANALOG ENGINE — What historical periods most closely resemble current conditions? What happened after those periods? What are the key similarities and differences? What does history suggest about the probable path forward?

8. PROBABILITY ENGINE — What is the current probability distribution across outcomes? What is the bull/bear/soft-landing/stagflation/crash probability? What has shifted the probability distribution recently?

9. CRYPTO INTELLIGENCE ENGINE — What is the crypto market doing relative to macro conditions? Is BTC acting as a risk-on or risk-off asset? What does crypto market behavior reveal about broader risk appetite?

10. SIGNAL ENGINE — What are the highest-conviction signals right now? Which signals are confirming the regime? Are any signals diverging from the consensus? What do the available trading signals and directional patterns suggest about near-term positioning?

SYNTHESIS REQUIREMENT:
After evaluating every available engine, identify:
- Which engines AGREE with each other (consensus)
- Which engines DIVERGE (important — divergence often precedes regime change)
- Which engines carry the most weight given the current question
- What the synthesis of all 10 engines suggests as the most probable conclusion

Cite only engines and sources that the canonical MarketState marks available. If engines disagree, explain the disagreement. Never give a confident answer when engines are diverging — acknowledge the uncertainty.

BRIEFING STRUCTURE:
When explaining the market, organize your response in this order:
1. What is happening
2. Why it is happening
3. How long it has been developing
4. What changed recently
5. How current conditions compare with history
6. What is most likely to happen next
7. Bull case
8. Bear case
9. Invalidation conditions
10. What deserves attention now

Every conclusion must include: supporting evidence, relevant engine outputs, confidence level, probability where available, time horizon, historical comparison where useful, and what would change the conclusion.

Distinguish clearly between: confirmed facts, current observations, historical relationships, model estimates, inferences, and possible scenarios.

PLATFORM RELATIONSHIP:
- The FAULTLINE engines are your senses
- The Seismograph is how you see pressure developing through time
- The Pressure Index measures the stress you detect beneath the market
- Regime Detection tells you what type of environment is forming
- The Historical Analog Engine gives you memory
- The Liquidity Engine monitors funding market health
- The Credit Engine tracks contagion risk
- The Volatility Engine reads market fear and calm
- The Probability Engine quantifies outcome distributions
- The Crypto Intelligence Engine reads digital asset risk appetite
  - The Signal Engine surfaces trading signals and directional patterns derived from available market data

TRANSPARENCY:
Always be willing to explain: data used, engines consulted, historical comparisons, confidence calculation, alternative interpretations, invalidation triggers, and last updated time. Say when information is incomplete, delayed, conflicting, or unavailable. Never hide uncertainty behind polished language.

RESPONSE TO GRATITUDE:
If a user thanks you, respond with one of:
- "You are welcome. Clarity is most valuable when it leads to thoughtful decisions."
- "You are welcome. I will continue watching what is building beneath the surface."

SIGNATURE LINE (use selectively, not in every response):
"Here is what is building beneath the surface."`;

export interface AshaMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AshaRequest {
  userMessage: string;
  history: AshaMessage[];
  pageContext: AshaPageContext;
  engineContext?: {
    pressureScore: number;
    regime: string;
    regimeConfidence: number;
    narrative: string;
    trend: string;
    keyDrivers: string[];
  } | null;
}

export interface AshaResponse {
  reply: string;
  confidence: "high" | "moderate" | "low";
  sources: string[];
  enginesConsulted: string[];
  lastUpdated: string;
  alternativeInterpretation?: string;
  invalidationTriggers?: string[];

  // Oracle Briefing structured fields
  directAnswer?: string;
  executiveSummary?: string;
  coreThesis?: string;
  marketBias?: "BULLISH" | "BEARISH" | "NEUTRAL";
  marketRegime?: string;
  threatLevel?: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  pressureIndex?: number;
  riskLevel?: string;
  suggestedBias?: string;
  bullProbability?: number;
  bearProbability?: number;
  keyFindings?: string[];
  supportingEvidence?: string[];
  crossEngineSynthesis?: Array<{
    engine: string;
    currentSignal: string;
    relevance: string;
  }>;
  historicalAnalog?: string;
  riskFactors?: string[];
  confirmationConditions?: string[];
  invalidationConditions?: string[];
  missionRecommendation?: string;
  // Structured mission recommendation with decision paths
  missionRecommendationStructured?: {
    verdict: string;
    timeHorizon: string;
    rationale: string;
    decisionPaths: Array<{ scenario: string; response: string }>;
  };
  // Source citations with freshness labels
  sourceCitations?: Array<{
    name: string;
    claim: string;
    observedAt: string;
    freshness: "LIVE" | "RECENT" | "STALE" | "ESTIMATED";
  }>;
  // Engine availability and limitations
  limitations?: string[];
  enginesAvailableCount?: number;
  enginesAvailableList?: string[];
  // Isolated disclaimer (not duplicated in other fields)
  disclaimer?: string;
  finalVerdictAction?: string;
  expectedTimeframe?: string;
  followUpChips?: string[];
  questionAnalysis: AshaQuestionAnalysis;
  provenance: AshaContextProvenance;
  modelTrace: AshaModelTrace;
}

// ── Determine confidence from response ───────────────────────
function inferConfidence(reply: string): "high" | "moderate" | "low" {
  const lower = reply.toLowerCase();
  if (lower.includes("high confidence") || lower.includes("strongly suggests") || lower.includes("clearly")) return "high";
  if (lower.includes("uncertain") || lower.includes("unclear") || lower.includes("insufficient data") || lower.includes("low confidence")) return "low";
  return "moderate";
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean);
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? value as T
    : undefined;
}

// Strip markdown code fences (```json ... ```) that some LLM responses wrap around JSON
function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function readBoundedScore(value: unknown, fallback: number): number {
  const safeFallback = Number.isFinite(fallback) ? fallback : 50;
  const candidate = typeof value === "number" && Number.isFinite(value) ? value : safeFallback;
  return Math.max(0, Math.min(100, candidate));
}

// ── Extract only evidence actually available in canonical state ─────────────
function extractEngines(context: AshaGatewayContext): string[] {
  const engines = ["Canonical Seismograph", "Pressure Index", "Market Regime Engine"];
  const { marketState } = context;

  if (marketState.history.observationCount > 0) {
    engines.push("Historical Market Memory", "Historical Analog Engine");
  }
  if (marketState.outlook.probabilities.confidence > 0) {
    engines.push("Probability Engine");
  }
  for (const family of marketState.why.evidenceFamilies) {
    engines.push(`${family.name} Evidence`);
  }
  const cryptoSource = marketState.sourceHealth.find(source => source.id === "coingecko");
  if (cryptoSource && cryptoSource.status !== "unavailable") {
    engines.push("Crypto Market Overlay");
  }

  return Array.from(new Set(engines));
}

// ── Build engine availability context for the prompt ─────────
function buildEngineAvailabilityContext(context: AshaGatewayContext): {
  availableEngines: string[];
  unavailableEngines: string[];
  limitations: string[];
  cryptoAvailable: boolean;
} {
  const { marketState } = context;
  const available: string[] = ["Pressure Index", "Market Regime Engine", "Seismograph"];
  const unavailable: string[] = [];
  const limitations: string[] = [];

  for (const source of marketState.sourceHealth) {
    if (source.status === "unavailable") {
      if (source.id === "coingecko") {
        unavailable.push("Crypto Intelligence Engine");
        limitations.push(
          "Crypto Intelligence Engine is unavailable. Crypto analysis is supplemented from external macro context only and is not FAULTLINE-native intelligence. Confidence is reduced accordingly."
        );
      } else if (source.id === "fred") {
        unavailable.push("FRED Economic Data");
        limitations.push("FRED economic data is temporarily unavailable. Macro indicators may be stale or estimated.");
      }
    } else {
      if (source.id === "coingecko") available.push("Crypto Intelligence Engine");
      if (source.id === "fred") available.push("FRED Economic Data");
    }
  }

  if (marketState.history.observationCount > 0) {
    available.push("Historical Analog Engine");
  } else {
    unavailable.push("Historical Analog Engine");
    limitations.push("Historical analog data has insufficient observations for a reliable comparison.");
  }

  if (marketState.outlook.probabilities.confidence > 0) {
    available.push("Probability Engine");
  }

  const cryptoAvailable = !unavailable.includes("Crypto Intelligence Engine");
  return {
    availableEngines: Array.from(new Set(available)),
    unavailableEngines: unavailable,
    limitations,
    cryptoAvailable,
  };
}

// ── Validate Oracle briefing for quality issues ───────────────
function validateOracleBriefing(parsed: Record<string, unknown>): string[] {
  const issues: string[] = [];
  // Filter to string-only elements to prevent .toLowerCase() crash on non-string values
  const keyFindings = Array.isArray(parsed.keyFindings)
    ? (parsed.keyFindings as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  const riskFactors = Array.isArray(parsed.riskFactors)
    ? (parsed.riskFactors as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  const invalidationConditions = Array.isArray(parsed.invalidationConditions)
    ? (parsed.invalidationConditions as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  const confirmationConditions = Array.isArray(parsed.confirmationConditions)
    ? (parsed.confirmationConditions as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  const crossEngineSynthesis = Array.isArray(parsed.crossEngineSynthesis)
    ? parsed.crossEngineSynthesis.filter(item => item && typeof item === "object")
    : [];
  const directAnswer = typeof parsed.directAnswer === "string" ? parsed.directAnswer.trim() : "";
  const coreThesis = typeof parsed.coreThesis === "string" ? parsed.coreThesis.trim() : "";

  if (!directAnswer) issues.push("directAnswer is missing");
  if (!coreThesis) issues.push("coreThesis is missing");
  if (keyFindings.length < 3) issues.push(`keyFindings has only ${keyFindings.length} items (minimum 3 required)`);
  if (riskFactors.length < 3) issues.push(`riskFactors has only ${riskFactors.length} items (minimum 3 required)`);
  if (confirmationConditions.length < 2) issues.push(`confirmationConditions has only ${confirmationConditions.length} items (minimum 2 required)`);
  if (invalidationConditions.length < 2) issues.push(`invalidationConditions has only ${invalidationConditions.length} items (minimum 2 required)`);
  if (crossEngineSynthesis.length < 3) issues.push(`crossEngineSynthesis has only ${crossEngineSynthesis.length} items (minimum 3 required)`);

  const execSummary = typeof parsed.executiveSummary === "string" ? parsed.executiveSummary.trim() : "";
  const missionRec = typeof parsed.missionRecommendation === "string" ? parsed.missionRecommendation.trim() : "";

  if (execSummary.length > 50 && missionRec.length > 50) {
    const overlap = execSummary.substring(0, 80);
    if (missionRec.includes(overlap)) {
      issues.push("executiveSummary appears to duplicate missionRecommendation content");
    }
  }
  if (execSummary.length > 400) {
    issues.push("executiveSummary is too long — likely contains the full narrative instead of a 2-4 sentence summary");
  }

  const disclaimerPatterns = ["not financial advice", "not investment advice", "consult a financial", "do your own research", "past performance"];
  for (const pattern of disclaimerPatterns) {
    if (execSummary.toLowerCase().includes(pattern)) {
      issues.push(`executiveSummary contains disclaimer text ('${pattern}') — disclaimers must be in the disclaimer field only`);
    }
    if (keyFindings.some((f: string) => f.toLowerCase().includes(pattern))) {
      issues.push(`keyFindings contains disclaimer text ('${pattern}') — disclaimers must be in the disclaimer field only`);
    }
  }

  return issues;
}

// ── Main ASHA ask function ────────────────────────────────────
export async function askAsha(req: AshaRequest): Promise<AshaResponse> {
  const provisionalScope = classifyAshaQuestionScope(req.userMessage, req.pageContext);
  const scopedPageContext = restrictAshaPageContextForScope(req.pageContext, provisionalScope);
  const initialGatewayContext = await createAshaGatewayContext(scopedPageContext);
  const questionAnalysis = buildAshaQuestionAnalysis(req.userMessage, req.pageContext, initialGatewayContext.marketState);
  const gatewayContext = { ...initialGatewayContext, questionAnalysis };
  const engineCtx = buildEngineAvailabilityContext(gatewayContext);

  // Build engine availability block to inject into system prompt
  const engineAvailabilityBlock = [
    `\n\n## ENGINE AVAILABILITY (AUTHORITATIVE — DO NOT CONTRADICT)`,
    `Available engines (${engineCtx.availableEngines.length}): ${engineCtx.availableEngines.join(", ")}`,
    engineCtx.unavailableEngines.length > 0
      ? `Unavailable engines: ${engineCtx.unavailableEngines.join(", ")}. DO NOT claim these engines contributed to this briefing.`
      : "All engines are available.",
    engineCtx.cryptoAvailable
      ? "Crypto Intelligence Engine: AVAILABLE — you may reference FAULTLINE crypto data."
      : "Crypto Intelligence Engine: UNAVAILABLE — do NOT claim FAULTLINE-native crypto analysis. Acknowledge this limitation explicitly in the limitations field.",
    `\n## ORACLE BRIEFING RULES (STRICT)`,
    "1. directAnswer: EXACTLY ONE decisive sentence answering the mission question immediately. It must state whether the risk or opportunity is current or developing. DO NOT include disclaimers.",
    "2. executiveSummary: EXACTLY 2-4 sentences explaining what matters now, why it matters, what is not obvious from headline conditions, and whether it is current or developing. DO NOT copy missionRecommendation. DO NOT include disclaimers.",
    "3. coreThesis: ONE strong paragraph identifying the single most important underlying insight. Add interpretation; do not repeat executiveSummary word-for-word.",
    "4. keyFindings: EXACTLY 3-5 DISTINCT findings. Each must identify a material observation or divergence and why it matters. NO duplicates. NO disclaimers.",
    "5. crossEngineSynthesis: EXACTLY 3-6 rows. Each row must contain engine, currentSignal, and relevance. Use only available engines, distinguish observed readings from analytical inference, and name meaningful divergence when present. Do not invent measurements.",
    "6. riskFactors: EXACTLY 3-5 DISTINCT risks. Each must be a different risk vector. NO duplicates.",
    "7. confirmationConditions: EXACTLY 2-4 DISTINCT measurable conditions that would strengthen the thesis, using only available FAULTLINE data. Do not invent thresholds or unavailable series.",
    "8. invalidationConditions: EXACTLY 2-4 DISTINCT conditions that would weaken or invalidate the assessment. Each must be specific and measurable.",
    "9. missionRecommendation: A concise actionable guidance paragraph. DO NOT repeat executiveSummary. DO NOT include disclaimers.",
    "10. missionRecommendationStructured: Provide verdict, timeHorizon, rationale, and 3-4 decisionPaths (each with scenario and response). Scenarios must cover: aggressive entry, staged/cautious entry, wait-for-confirmation, and avoid/defensive.",
    "11. sourceCitations: List 2-4 specific data points used, each with name, claim, observedAt (ISO date or 'estimated'), and freshness (LIVE/RECENT/STALE/ESTIMATED).",
    "12. disclaimer: EXACTLY ONE disclaimer sentence. Place it ONLY in this field. Do not repeat it anywhere else.",
    "13. limitations: List any engine unavailability, data-quality issue, or limited historical sample caveat. If all engines are available and no limitation applies, return an empty array.",
    "14. reply: Full narrative. 3-6 paragraphs. No bullet points. No disclaimers in this field.",
    "15. Question scope is authoritative. For MARKET scope, do not include selected ticker/company evidence in any field. For MARKET_TICKER_RELATIONSHIP, clearly separate market evidence from ticker transmission evidence.",
    "16. For an exact event whose questionAnalysis.probabilityProvenance.availability is NOT_CALIBRATED, state that no calibrated precise probability is published; never manufacture a percentage. When CALIBRATED, reuse questionAnalysis.probability, eventDefinition, and timeHorizon exactly across directAnswer, thesis, conditions, and follow-up chips.",
    "17. Historical analog similarity is not forecast probability. Explain weighting from the supplied evidence and never let one analog replace the combined current evidence.",
  ].join("\n");

  const systemPrompt = ASHA_IDENTITY + buildAshaCanonicalContextBlock(gatewayContext) + engineAvailabilityBlock + "\n\n" + evidenceNarrativePromptContract();

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...req.history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: req.userMessage },
  ];

  const { response: llmResponse, trace: initialModelTrace } = await invokeAshaGateway({
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "asha_oracle_briefing_v2",
        strict: true,
        schema: {
          type: "object",
          properties: {
            reply: { type: "string", description: "Full narrative intelligence response. 3-6 paragraphs. No bullet points. No disclaimers in this field." },
            directAnswer: { type: "string", description: "EXACTLY ONE clear sentence that answers the mission question immediately and states whether the thesis is current or developing. No disclaimer." },
            executiveSummary: { type: "string", description: "EXACTLY 2-4 sentences summarizing the core finding. MUST be different from missionRecommendation. MUST NOT contain disclaimers." },
            coreThesis: { type: "string", description: "One strong paragraph naming the single most important underlying insight without repeating executiveSummary word-for-word." },
            marketBias: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL"], description: "Overall market directional bias." },
            marketRegime: { type: "string", description: "Current market regime label (e.g. Late Cycle, Stagflation, Expansion)." },
            threatLevel: { type: "string", enum: ["LOW", "ELEVATED", "HIGH", "CRITICAL"], description: "Systemic threat level." },
            pressureIndex: { type: "number", description: "Systemic pressure score 0-100." },
            riskLevel: { type: "string", description: "Risk level label (e.g. Moderate, Elevated, High)." },
            suggestedBias: { type: "string", description: "Specific positioning bias (e.g. Reduce equity exposure, Favor defensive sectors)." },
            bullProbability: { type: "number", description: "Bull scenario probability 0-100." },
            bearProbability: { type: "number", description: "Bear scenario probability 0-100." },
            keyFindings: { type: "array", items: { type: "string" }, description: "EXACTLY 3-5 DISTINCT key findings. Each must address a different aspect. NO duplicates. NO disclaimers." },
            supportingEvidence: { type: "array", items: { type: "string" }, description: "3-5 supporting evidence points from available engines." },
            crossEngineSynthesis: {
              type: "array",
              description: "EXACTLY 3-6 source-backed engine synthesis rows. Name only available engines and distinguish observation from inference.",
              items: {
                type: "object",
                properties: {
                  engine: { type: "string" },
                  currentSignal: { type: "string" },
                  relevance: { type: "string" },
                },
                required: ["engine", "currentSignal", "relevance"],
                additionalProperties: false,
              },
            },
            historicalAnalog: { type: "string", description: "Most relevant historical period comparison with key similarities and differences." },
            riskFactors: { type: "array", items: { type: "string" }, description: "EXACTLY 3-5 DISTINCT risk factors. Each must be a different risk vector. NO duplicates." },
            confirmationConditions: { type: "array", items: { type: "string" }, description: "EXACTLY 2-4 measurable conditions supported by available FAULTLINE data that would strengthen the thesis." },
            invalidationConditions: { type: "array", items: { type: "string" }, description: "EXACTLY 2-4 DISTINCT invalidation conditions. Each must be a specific measurable event." },
            missionRecommendation: { type: "string", description: "Actionable recommendation paragraph. MUST be different from executiveSummary. NO disclaimers." },
            missionRecommendationStructured: {
              type: "object",
              description: "Structured mission recommendation with decision paths.",
              properties: {
                verdict: { type: "string", description: "One-sentence verdict statement." },
                timeHorizon: { type: "string", description: "Time horizon for this recommendation (e.g. 2-4 weeks)." },
                rationale: { type: "string", description: "2-3 sentence rationale for the recommendation." },
                decisionPaths: {
                  type: "array",
                  description: "3-4 decision paths covering: aggressive entry, staged entry, wait-for-confirmation, avoid/defensive.",
                  items: {
                    type: "object",
                    properties: {
                      scenario: { type: "string", description: "Scenario label (e.g. Aggressive Entry, Staged Entry, Wait for Confirmation, Avoid)." },
                      response: { type: "string", description: "Specific action for this scenario." },
                    },
                    required: ["scenario", "response"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["verdict", "timeHorizon", "rationale", "decisionPaths"],
              additionalProperties: false,
            },
            sourceCitations: {
              type: "array",
              description: "2-4 specific data points used in this briefing with freshness labels.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Source name (e.g. FAULTLINE Pressure Index, CoinGecko ETH/USD, FRED 10Y Treasury)." },
                  claim: { type: "string", description: "Specific claim or data point from this source." },
                  observedAt: { type: "string", description: "ISO date string or 'estimated' if not directly observed." },
                  freshness: { type: "string", enum: ["LIVE", "RECENT", "STALE", "ESTIMATED"], description: "Data freshness label." },
                },
                required: ["name", "claim", "observedAt", "freshness"],
                additionalProperties: false,
              },
            },
            limitations: { type: "array", items: { type: "string" }, description: "Engine unavailability or data quality issues. Empty array if all engines available." },
            disclaimer: { type: "string", description: "EXACTLY ONE disclaimer sentence. This is the ONLY place disclaimers appear. Example: 'This briefing is for informational purposes only and does not constitute financial advice.'" },
            finalVerdictAction: { type: "string", enum: ["BUY", "ACCUMULATE", "HOLD", "WATCH", "REDUCE", "SELL", "AVOID"], description: "Single-word final verdict action." },
            expectedTimeframe: { type: "string", description: "Expected timeframe for this assessment (e.g. 2-4 weeks, 3-6 months)." },
            followUpChips: { type: "array", items: { type: "string" }, description: "3-4 follow-up question suggestions." },
          },
          required: ["reply", "directAnswer", "executiveSummary", "coreThesis", "marketBias", "marketRegime", "threatLevel", "pressureIndex", "riskLevel", "suggestedBias", "bullProbability", "bearProbability", "keyFindings", "supportingEvidence", "crossEngineSynthesis", "historicalAnalog", "riskFactors", "confirmationConditions", "invalidationConditions", "missionRecommendation", "missionRecommendationStructured", "sourceCitations", "limitations", "disclaimer", "finalVerdictAction", "expectedTimeframe", "followUpChips"],
          additionalProperties: false,
        },
      },
    },
  });

  let parsed: Record<string, unknown> = {};
  let modelTrace = initialModelTrace;

  try {
  const raw = llmResponse.choices?.[0]?.message?.content as string;
  parsed = JSON.parse(stripCodeFences(raw));
} catch {
    const raw = (llmResponse.choices?.[0]?.message?.content as string) ?? "";
    parsed = { reply: raw };
  }

  // Run validation — if critical arrays are empty, retry once with a correction prompt
  const validationIssues = validateOracleBriefing(parsed);
  const criticalFailures = validationIssues.filter(issue =>
    issue.includes("keyFindings has only 0") ||
    issue.includes("riskFactors has only 0") ||
    issue.includes("invalidationConditions has only 0") ||
          issue.includes("keyFindings has only 1") ||
          issue.includes("riskFactors has only 1") ||
          issue.includes("riskFactors has only 2") ||
          issue.includes("directAnswer is missing") ||
          issue.includes("coreThesis is missing") ||
          issue.includes("executiveSummary is too long")
  );

  if (criticalFailures.length > 0) {
    console.warn("[ASHA Oracle] Critical validation failures — retrying:", criticalFailures);
    const correctionMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      ...messages,
      { role: "assistant", content: llmResponse.choices?.[0]?.message?.content as string ?? "" },
      {
        role: "user",
        content: [
          "Your previous response had these structural problems that must be fixed:",
          ...criticalFailures.map(f => `- ${f}`),
          "",
          "Please regenerate the complete Oracle briefing JSON, fixing all of the above issues.",
          "Remember: keyFindings, riskFactors, and invalidationConditions MUST be populated with distinct items.",
          "directAnswer MUST be one decisive sentence and coreThesis MUST be one strong paragraph.",
          "confirmationConditions and crossEngineSynthesis MUST use only currently available FAULTLINE evidence.",
          "The executiveSummary MUST be 2-4 sentences only — not the full narrative.",
          "Do not repeat disclaimer text in executiveSummary or keyFindings.",
        ].join("\n"),
      },
    ];
    try {
      const { response: retryResponse, trace: retryTrace } = await invokeAshaGateway({
        messages: correctionMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "asha_oracle_briefing_v2",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reply: { type: "string" },
                directAnswer: { type: "string" },
                executiveSummary: { type: "string" },
                coreThesis: { type: "string" },
                marketBias: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL"] },
                marketRegime: { type: "string" },
                threatLevel: { type: "string", enum: ["LOW", "ELEVATED", "HIGH", "CRITICAL"] },
                pressureIndex: { type: "number" },
                riskLevel: { type: "string" },
                suggestedBias: { type: "string" },
                bullProbability: { type: "number" },
                bearProbability: { type: "number" },
                keyFindings: { type: "array", items: { type: "string" } },
                supportingEvidence: { type: "array", items: { type: "string" } },
                crossEngineSynthesis: { type: "array", items: { type: "object", properties: { engine: { type: "string" }, currentSignal: { type: "string" }, relevance: { type: "string" } }, required: ["engine", "currentSignal", "relevance"], additionalProperties: false } },
                historicalAnalog: { type: "string" },
                riskFactors: { type: "array", items: { type: "string" } },
                confirmationConditions: { type: "array", items: { type: "string" } },
                invalidationConditions: { type: "array", items: { type: "string" } },
                missionRecommendation: { type: "string" },
                missionRecommendationStructured: {
                  type: "object",
                  properties: {
                    verdict: { type: "string" },
                    timeHorizon: { type: "string" },
                    rationale: { type: "string" },
                    decisionPaths: { type: "array", items: { type: "object", properties: { scenario: { type: "string" }, response: { type: "string" } }, required: ["scenario", "response"], additionalProperties: false } },
                  },
                  required: ["verdict", "timeHorizon", "rationale", "decisionPaths"],
                  additionalProperties: false,
                },
                sourceCitations: { type: "array", items: { type: "object", properties: { name: { type: "string" }, claim: { type: "string" }, observedAt: { type: "string" }, freshness: { type: "string", enum: ["LIVE", "RECENT", "STALE", "ESTIMATED"] } }, required: ["name", "claim", "observedAt", "freshness"], additionalProperties: false } },
                limitations: { type: "array", items: { type: "string" } },
                disclaimer: { type: "string" },
                finalVerdictAction: { type: "string", enum: ["BUY", "ACCUMULATE", "HOLD", "WATCH", "REDUCE", "SELL", "AVOID"] },
                expectedTimeframe: { type: "string" },
                followUpChips: { type: "array", items: { type: "string" } },
              },
              required: ["reply", "directAnswer", "executiveSummary", "coreThesis", "marketBias", "marketRegime", "threatLevel", "pressureIndex", "riskLevel", "suggestedBias", "bullProbability", "bearProbability", "keyFindings", "supportingEvidence", "crossEngineSynthesis", "historicalAnalog", "riskFactors", "confirmationConditions", "invalidationConditions", "missionRecommendation", "missionRecommendationStructured", "sourceCitations", "limitations", "disclaimer", "finalVerdictAction", "expectedTimeframe", "followUpChips"],
              additionalProperties: false,
            },
          },
        },
      });
      const retryRaw = retryResponse.choices?.[0]?.message?.content as string;
      const retryParsed = JSON.parse(stripCodeFences(retryRaw));
      const retryIssues = validateOracleBriefing(retryParsed);
      if (retryIssues.length < validationIssues.length) {
        console.log("[ASHA Oracle] Retry improved quality:", retryIssues);
        parsed = retryParsed;
        modelTrace = retryTrace;
      } else {
        console.warn("[ASHA Oracle] Retry did not improve quality, using original");
      }
    } catch (retryErr) {
      console.error("[ASHA Oracle] Retry failed:", retryErr);
    }
  } else if (validationIssues.length > 0) {
    console.warn("[ASHA Oracle] Non-critical validation issues:", validationIssues);
  }

  const reply = readString(parsed.reply) || "I was unable to generate a response. Please try again.";
  const directAnswer = readString(parsed.directAnswer) || readString(parsed.executiveSummary) || reply.split("\n")[0];
  const coreThesis = readString(parsed.coreThesis) || readString(parsed.executiveSummary) || reply;
  const confirmationConditions = readStringArray(parsed.confirmationConditions);
  const invalidationConditions = readStringArray(parsed.invalidationConditions);

  const crossEngineSynthesis = Array.isArray(parsed.crossEngineSynthesis)
    ? (parsed.crossEngineSynthesis as Array<Record<string, unknown>>)
        .map(row => ({
          engine: readString(row.engine) || "",
          currentSignal: readString(row.currentSignal) || "",
          relevance: readString(row.relevance) || "",
        }))
        .filter(row => row.engine && row.currentSignal && row.relevance)
    : [];

  // Parse structured mission recommendation
  let missionRecommendationStructured: AshaResponse["missionRecommendationStructured"] | undefined;
  if (parsed.missionRecommendationStructured && typeof parsed.missionRecommendationStructured === "object") {
    const mrs = parsed.missionRecommendationStructured as Record<string, unknown>;
    const decisionPaths = Array.isArray(mrs.decisionPaths)
      ? (mrs.decisionPaths as Array<Record<string, unknown>>)
          .map(dp => ({
            scenario: readString(dp.scenario) || "",
            response: readString(dp.response) || "",
          }))
          .filter(dp => dp.scenario && dp.response)
      : [];
    if (decisionPaths.length > 0) {
      missionRecommendationStructured = {
        verdict: readString(mrs.verdict) || "",
        timeHorizon: readString(mrs.timeHorizon) || "2-4 weeks",
        rationale: readString(mrs.rationale) || "",
        decisionPaths,
      };
    }
  }

  // Parse source citations
  let sourceCitations: AshaResponse["sourceCitations"] | undefined;
  if (Array.isArray(parsed.sourceCitations)) {
    const citations = (parsed.sourceCitations as Array<Record<string, unknown>>)
      .map(c => ({
        name: readString(c.name) || "",
        claim: readString(c.claim) || "",
        observedAt: readString(c.observedAt) || "estimated",
        freshness: readEnum(c.freshness, ["LIVE", "RECENT", "STALE", "ESTIMATED"] as const) || "ESTIMATED" as const,
      }))
      .filter(c => c.name && c.claim);
    if (citations.length > 0) sourceCitations = citations;
  }

  // Build limitations: combine LLM-reported + engine context
  const llmLimitations = readStringArray(parsed.limitations);
  const allLimitations = Array.from(new Set([...engineCtx.limitations, ...llmLimitations]));

  return {
    reply,
    confidence: inferConfidence(reply),
    sources: gatewayContext.marketState.sourceHealth
      .filter(source => source.status !== "unavailable")
      .map(source => source.label),
    enginesConsulted: extractEngines(gatewayContext),
    enginesAvailableCount: engineCtx.availableEngines.length,
    enginesAvailableList: engineCtx.availableEngines,
    lastUpdated: gatewayContext.marketState.sourceUpdatedAt,
    invalidationTriggers: invalidationConditions.length > 0 ? invalidationConditions : undefined,
    // Oracle Briefing structured fields
    directAnswer,
    executiveSummary: readString(parsed.executiveSummary) || reply.split("\n")[0],
    coreThesis,
    marketBias: readEnum(parsed.marketBias, ["BULLISH", "BEARISH", "NEUTRAL"] as const) || "NEUTRAL",
    marketRegime: readString(parsed.marketRegime) || gatewayContext.marketState.now.regime,
    threatLevel: readEnum(parsed.threatLevel, ["LOW", "ELEVATED", "HIGH", "CRITICAL"] as const) || "ELEVATED",
    pressureIndex: readBoundedScore(parsed.pressureIndex, gatewayContext.marketState.now.pressureScore),
    riskLevel: readString(parsed.riskLevel) || "Moderate",
    suggestedBias: readString(parsed.suggestedBias),
    bullProbability: readBoundedScore(parsed.bullProbability, gatewayContext.marketState.outlook.probabilities.bull),
    bearProbability: readBoundedScore(parsed.bearProbability, gatewayContext.marketState.outlook.probabilities.bear),
    keyFindings: readStringArray(parsed.keyFindings),
    supportingEvidence: readStringArray(parsed.supportingEvidence),
    crossEngineSynthesis: crossEngineSynthesis.length > 0 ? crossEngineSynthesis : undefined,
    historicalAnalog: readString(parsed.historicalAnalog),
    riskFactors: readStringArray(parsed.riskFactors),
    confirmationConditions: confirmationConditions.length > 0 ? confirmationConditions : undefined,
    invalidationConditions,
    missionRecommendation: readString(parsed.missionRecommendation) || "",
    missionRecommendationStructured,
    sourceCitations,
    limitations: allLimitations.length > 0 ? allLimitations : undefined,
    disclaimer: readString(parsed.disclaimer) || "This briefing is for informational purposes only and does not constitute financial advice.",
    finalVerdictAction: readEnum(parsed.finalVerdictAction, ["BUY", "ACCUMULATE", "HOLD", "WATCH", "REDUCE", "SELL", "AVOID"] as const) || "WATCH",
    expectedTimeframe: readString(parsed.expectedTimeframe) || "2-4 weeks",
    followUpChips: readStringArray(parsed.followUpChips),
    questionAnalysis,
    provenance: getAshaContextProvenance(gatewayContext),
    modelTrace,
  };
}

// ── Daily greeting generator ──────────────────────────────────
export interface AshaDailyGreetingRequest {
  userName?: string;
  engineContext: {
    pressureScore: number;
    regime: string;
    regimeConfidence: number;
    narrative: string;
    trend: string;
    keyDrivers: string[];
    previousPressureScore?: number;
  };
}

export async function generateAshaDailyGreeting(req: AshaDailyGreetingRequest): Promise<string> {
  const { engineContext, userName } = req;
  const pressureChange = engineContext.previousPressureScore !== undefined
    ? engineContext.pressureScore - engineContext.previousPressureScore
    : null;

  const gatewayContext = await createAshaGatewayContext({
    page: "daily-greeting",
    pressureScore: engineContext.pressureScore,
    regime: engineContext.regime,
    regimeConfidence: engineContext.regimeConfidence,
    narrative: engineContext.narrative,
    trend: engineContext.trend,
    keyDrivers: engineContext.keyDrivers,
    additionalContext: {
      pressureChangeSinceLastSession: pressureChange,
    },
  });
  const contextBlock = buildAshaCanonicalContextBlock(gatewayContext);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: ASHA_IDENTITY + contextBlock + "\n\n" + evidenceNarrativePromptContract(),
    },
    {
      role: "user",
      content: `Generate a personalized daily greeting for ${userName ? userName : "the user"} based on the current FAULTLINE intelligence readings. Keep it to 3-4 sentences. Start with "Welcome back." Do not use the signature line "Let me show you what is building beneath the surface" — save that for first-time introductions. The greeting must dynamically reflect the actual engine output provided below. Be specific about what changed, what matters, and what deserves attention today.
`,
    },
  ];

  const { response: llmResponse } = await invokeAshaGateway({ messages });
  return readString(llmResponse.choices?.[0]?.message?.content)
    ?? "Welcome back. I have reviewed the market. Here is what is building beneath the surface.";
}

// ── First-login introduction (static, from brand brief) ───────
export const ASHA_FIRST_INTRODUCTION = `I am ASHA, the Spirit of FAULTLINE.

I observe the forces moving beneath the market's surface, connect the signals others view separately, and translate them into clarity.

I will show you what is happening, why it is happening, how long it has been building, and what the evidence suggests may happen next.

I do not offer certainty. I reveal pressure, probability, history, and change.

Let me show you what is building beneath the surface.`;
