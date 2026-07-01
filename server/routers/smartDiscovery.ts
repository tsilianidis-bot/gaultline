/**
 * FAULTLINE — Smart Discovery™ Backend
 * server/routers/smartDiscovery.ts
 *
 * Ask Intelligence V2.0
 *   One Question In → One Institutional Answer Out
 *   Evidence first. Opinion second. Explain the WHY.
 *   Every recommendation answers: What? Why? Evidence? What changes it?
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { runFMOSPipelineFast } from "../fmos/pipeline";
import { getQuickOutlook } from "../signalOutlook";
import { invokeLLM } from "../_core/llm";
import { resolveIntent, detectQuestionIntent, QuestionIntent } from "../intentResolver";
import { getDb } from "../db";
import { decisionLedger, DecisionLedgerEntry } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getQuote } from "../yahooProxy";
import { getCoinMarketData } from "../coingeckoProxy";
import { scanOpportunities } from "../ownerSimulation";

// ── LLM timeout helper ───────────────────────────────────────
// Wraps any promise with a 55-second timeout so the user gets a friendly
// error instead of staring at a spinner until Cloud Run kills the request.
async function withLLMTimeout<T>(p: Promise<T>): Promise<T> {
  const TIMEOUT_MS = 55_000;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TRPCError({
      code: "TIMEOUT",
      message: "FAULTLINE analysis timed out. Market data services may be slow — please try again.",
    })), TIMEOUT_MS);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ── Types ─────────────────────────────────────────────────────

export interface EvidenceScore {
  category: string;
  score: number;        // 0–100
  signal: "bullish" | "bearish" | "neutral";
  explanation: string;  // one-line
}

export interface FaultlineAnswer {
  // Core verdict
  verdict: "STRONG BUY" | "BUY" | "ACCUMULATE" | "WAIT" | "HOLD" | "REDUCE" | "STRONG REDUCE" | "SELL" | "HIGH RISK" | "LOW CONVICTION" | "MACRO ANSWER";
  verdictColor: "green" | "yellow" | "red" | "blue";
  opportunityScore: number;       // 0–100
  confidence: number;             // 0–100
  confidenceLabel: string;        // "HIGH" | "MODERATE" | "LOW"
  confidenceReasons: string[];    // 3-5 specific reasons for the confidence level

  // Context
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  queryType: "security" | "macro" | "opportunity" | "portfolio" | "general";
  questionIntent: QuestionIntent;  // The specific type of question asked
  currentRegime: string;
  regimeColor: "green" | "yellow" | "red";
  dataFreshness: string;

  // ── DIRECT ANSWER BLOCK ─────────────────────────────────────────────────
  // These fields answer the EXACT question asked. They are shown FIRST before
  // any broader analysis. Populated based on questionIntent.

  // Downside fields (questionIntent === "downside")
  downsideBaseZone: string | null;       // e.g. "$280–$310"
  downsideBearTarget: string | null;     // e.g. "$220–$240"
  downsideExtremeTarget: string | null;  // e.g. "$150–$180"
  downsideMostLikely: string | null;     // One sentence: most probable outcome
  downsideTriggers: string[];            // What triggers each level
  downsideInvalidation: string | null;   // What would prevent the downside

  // Upside fields (questionIntent === "upside" | "target_price")
  upsideBaseTarget: string | null;       // e.g. "$450–$480"
  upsideBullTarget: string | null;       // e.g. "$550–$600"
  upsideExtremeTarget: string | null;    // e.g. "$700+"
  upsideMostLikely: string | null;       // One sentence: most probable outcome
  upsideCatalysts: string[];             // What triggers each level
  upsideInvalidation: string | null;     // What would prevent the upside

  // Buy/Sell/Wait verdict (questionIntent === "buy_verdict" | "sell_verdict" | "wait_verdict")
  actionVerdict: "BUY NOW" | "ACCUMULATE" | "WAIT" | "SELL" | "REDUCE" | "HOLD" | null;
  actionVerdictReason: string | null;    // One sentence: why this verdict
  actionVerdictConditions: string[];     // Conditions that would change the verdict

  // Entry zone (questionIntent === "entry_zone")
  entryZoneIdeal: string | null;         // e.g. "$290–$310"
  entryZoneAggressive: string | null;    // e.g. "$320–$335" (for momentum buyers)
  entryZoneConservative: string | null;  // e.g. "$260–$280" (wait for pullback)
  entryZoneStop: string | null;          // Stop loss for the entry
  entryZoneTarget: string | null;        // First profit target from entry
  entryZoneRR: string | null;            // Risk:reward ratio

  // Exit zone (questionIntent === "exit_zone")
  exitZonePrimary: string | null;        // First profit target
  exitZoneSecondary: string | null;      // Second profit target
  exitZoneFull: string | null;           // Full exit / stop out level
  exitZoneReason: string | null;         // Why these levels

  // Invalidation (questionIntent === "invalidation")
  invalidationPrice: string | null;      // Specific price level
  invalidationConditions: string[];      // Conditions that break the thesis
  invalidationWhatHappens: string | null; // What to do if invalidated

  // Risk assessment (questionIntent === "risk_assessment")
  riskRating: "LOW" | "MODERATE" | "HIGH" | "EXTREME" | null;
  riskSummary: string | null;            // One sentence: overall risk assessment
  riskFactors: string[];                 // 3-5 specific risk factors
  riskRewardRatio: string | null;        // e.g. "1:3"
  maxDrawdownEstimate: string | null;    // e.g. "-35% in bear case"

  // Primary Driver (Section 5)
  primaryDriver: string;          // One sentence — the single most important factor

  // The answer
  executiveSummary: string;       // 2 sentences — the strategist's opening statement
  whyThisVerdict: string;         // The reasoning chain

  // Bull / Bear with probabilities (Sections 7-8)
  bullCase: string;
  bullProbability: number;        // 0–100
  bullKeyDrivers: string[];       // 2-3 items
  bearCase: string;
  bearProbability: number;        // 0–100
  bearKeyDrivers: string[];       // 2-3 items

  catalysts: string[];
  threats: string[];

  // Evidence Engine (Section 6) — 14 categories
  evidenceScores: EvidenceScore[];

  // Why Not Buy/Sell (Section 10) — populated when verdict is WAIT/HOLD
  whyNotBuy: string[] | null;
  whyNotSell: string[] | null;

  // What Changes Our View (Section 11)
  watchCatalysts: string[];       // 4-6 specific catalysts that would change the recommendation

  // Levels (null for macro questions)
  support: string | null;
  resistance: string | null;
  entryZone: string | null;
  profitTargets: string[];
  stopLevel: string | null;
  invalidation: string;
  expectedTimeframe: string;

  // Action
  suggestedAction: string;
  positionSizeGuidance: string | null;
  whatChangesThesis: string;

  // Deep-dive links (shown AFTER the answer)
  deepDiveLinks: Array<{
    label: string;
    path: string;
    description: string;
  }>;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  ticker?: string | null;
  timestamp: number;
}

// ── Intent resolution delegated to server/intentResolver.ts ─────────────

// ── Sanitize NaN/Infinity ─────────────────────────────────────

/**
 * Recursively sanitize a value so it is safe to serialize via superjson:
 * - undefined → null (JSON.stringify silently drops undefined, causing superjson metadata mismatch)
 * - NaN / Infinity → 0
 * - All nested objects and arrays are recursively sanitized
 */
function sanitize(v: unknown): unknown {
  if (v === undefined) return null;  // ← KEY FIX: undefined becomes null, not dropped
  if (v === null) return null;
  if (typeof v === "number") return isFinite(v) && !isNaN(v) ? v : 0;
  if (Array.isArray(v)) return v.map(sanitize);
  if (typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitize(val)])
    );
  }
  return v;
}

// ── Build deep-dive links ─────────────────────────────────────

function buildDeepDiveLinks(ticker: string | null, assetType: "stock" | "crypto" | null, queryType: string) {
  const links = [];
  const params = ticker ? `?symbol=${ticker}&type=${assetType ?? "stock"}&autorun=1` : "";

  if (ticker) {
    links.push({ label: "Full Decision Engine", path: `/app/decision-engine${params}`, description: "Complete institutional analysis with all intelligence panels" });
    links.push({ label: "Symbol Intelligence", path: `/app/symbol-intelligence${params}`, description: "Technical setup, risk analysis, and AI insights" });
    links.push({ label: "Signal Outlook", path: `/app/signal-outlook${ticker ? `?symbol=${ticker}&type=${assetType ?? "stock"}` : ""}`, description: "Signal scoring and regime analysis" });
  }
  links.push({ label: "Opportunity Radar", path: "/app/opportunities", description: "Top-ranked opportunities by conviction score" });
  links.push({ label: "Market Stress", path: "/app/pressure", description: "Macro risk and pressure indicators" });
  links.push({ label: "Decision Ledger", path: "/app/decision-ledger", description: "Track recommendation history and accuracy" });
  if (queryType === "portfolio") {
    links.push({ label: "Portfolio Command", path: "/app/portfolio", description: "Portfolio tracking and institutional guidance" });
  }
  return links;
}

// ── Main orchestrator ─────────────────────────────────────────

async function orchestrateAnswer(
  query: string,
  conversationHistory: ConversationMessage[],
  contextTicker: string | null,
  contextAssetType: "stock" | "crypto" | null,
): Promise<FaultlineAnswer> {

  // 1. Resolve intent using the robust IntentResolver
  const intent = resolveIntent(query, contextTicker, contextAssetType as "stock" | "crypto" | null);
  const ticker = intent.ticker;
  const assetType = intent.assetType === "crypto" ? "crypto" : intent.assetType === "stock" ? "stock" : null;
  const queryType = intent.queryType;

  // 1b. Detect the specific question intent (downside / upside / buy_verdict / etc.)
  const questionIntent: QuestionIntent = detectQuestionIntent(query);

  // 2. Fetch live market data via FMOS pipeline
  const [fmosResult, quickOutlook] = await Promise.allSettled([
    runFMOSPipelineFast({ symbol: ticker ?? undefined }),
    ticker ? getQuickOutlook(ticker, assetType ?? "stock") : Promise.resolve(null),
  ]);

  const fmos = fmosResult.status === "fulfilled" ? fmosResult.value : null;
  const pressureData = fmos?.pressure ?? null;
  const outlookData = quickOutlook.status === "fulfilled" ? quickOutlook.value : null;

  // 3. Build context for LLM
  const regimeLabel = fmos?.regime?.currentRegime ?? pressureData?.regime ?? "UNCERTAIN";
  const pressureScore = pressureData ? (pressureData.overallPressure / 10) : 5;
  const regimeColor: "green" | "yellow" | "red" = pressureScore <= 3 ? "green" : pressureScore <= 6 ? "yellow" : "red";

  // Extract FMOS evidence families for context
  const evidenceFamilies = fmos?.evidence?.families ?? [];
  const evidenceContext = evidenceFamilies.length > 0
    ? `\nEvidence Families:\n${evidenceFamilies.map(f => `  ${f.label}: ${f.signal} (strength: ${f.strength}/100)`).join("\n")}`
    : "";

  const outlookSummary = outlookData ? `
Symbol: ${ticker}
Direction: ${outlookData.direction}
Confidence: ${outlookData.confidence}%
Risk Level: ${outlookData.riskLevel}
Outlook Score: ${outlookData.outlookScore}
Data Status: ${outlookData.dataStatus}
` : "";

  const conversationContext = conversationHistory.length > 0
    ? `\nPrevious conversation:\n${conversationHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}\n`
    : "";

  // Build question-intent-specific instructions for the LLM
  const intentInstructions: Record<QuestionIntent, string> = {
    downside: `
QUESTION TYPE: DOWNSIDE ANALYSIS
The user is asking HOW LOW this asset can fall. You MUST answer this FIRST.
Populate these fields with SPECIFIC PRICE LEVELS (not conditions):
- downsideBaseZone: Most likely pullback zone (e.g. "$280–$310")
- downsideBearTarget: Bear case downside target (e.g. "$220–$240")
- downsideExtremeTarget: Crash/extreme scenario target (e.g. "$150–$180")
- downsideMostLikely: One sentence — the single most probable outcome
- downsideTriggers: What triggers each level (3 items)
- downsideInvalidation: What would prevent/invalidate the downside
Do NOT lead with generic bull/bear percentages. Lead with price levels.`,
    upside: `
QUESTION TYPE: UPSIDE ANALYSIS
The user is asking HOW HIGH this asset can go. You MUST answer this FIRST.
Populate these fields with SPECIFIC PRICE LEVELS:
- upsideBaseTarget: Base case upside target (e.g. "$450–$480")
- upsideBullTarget: Bull case target (e.g. "$550–$600")
- upsideExtremeTarget: Extreme/moonshot target (e.g. "$700+")
- upsideMostLikely: One sentence — the single most probable outcome
- upsideCatalysts: What triggers each level (3 items)
- upsideInvalidation: What would prevent/invalidate the upside`,
    buy_verdict: `
QUESTION TYPE: BUY VERDICT
The user is asking SHOULD I BUY. You MUST answer this FIRST with a clear verdict.
- actionVerdict: "BUY NOW" | "ACCUMULATE" | "WAIT" | "SELL" | "REDUCE" | "HOLD"
- actionVerdictReason: One sentence — the single most important reason for this verdict
- actionVerdictConditions: 3 conditions that would change the verdict
Do NOT bury the verdict in analysis. State it immediately.`,
    sell_verdict: `
QUESTION TYPE: SELL VERDICT
The user is asking SHOULD I SELL. You MUST answer this FIRST with a clear verdict.
- actionVerdict: "SELL" | "REDUCE" | "HOLD" | "WAIT" | "BUY NOW" | "ACCUMULATE"
- actionVerdictReason: One sentence — the single most important reason for this verdict
- actionVerdictConditions: 3 conditions that would change the verdict`,
    wait_verdict: `
QUESTION TYPE: WAIT/TIMING VERDICT
The user is asking IS NOW THE RIGHT TIME. You MUST answer this FIRST.
- actionVerdict: "BUY NOW" | "ACCUMULATE" | "WAIT" | "SELL" | "REDUCE" | "HOLD"
- actionVerdictReason: One sentence — the single most important reason for this timing verdict
- actionVerdictConditions: 3 conditions that would change the timing`,
    entry_zone: `
QUESTION TYPE: ENTRY ZONE
The user is asking WHERE TO ENTER. You MUST answer this FIRST with SPECIFIC PRICE LEVELS.
- entryZoneIdeal: Ideal entry zone (e.g. "$290–$310")
- entryZoneAggressive: Aggressive entry for momentum buyers (e.g. "$320–$335")
- entryZoneConservative: Conservative entry on pullback (e.g. "$260–$280")
- entryZoneStop: Stop loss level for the entry
- entryZoneTarget: First profit target from entry
- entryZoneRR: Risk:reward ratio (e.g. "1:3")`,
    exit_zone: `
QUESTION TYPE: EXIT ZONE / TAKE PROFIT
The user is asking WHERE TO EXIT. You MUST answer this FIRST with SPECIFIC PRICE LEVELS.
- exitZonePrimary: First profit target / partial exit
- exitZoneSecondary: Second profit target / full exit
- exitZoneFull: Full exit / stop out level
- exitZoneReason: One sentence — why these levels`,
    target_price: `
QUESTION TYPE: PRICE TARGET
The user is asking WHAT IS THE TARGET PRICE. You MUST answer this FIRST.
- upsideBaseTarget: Base case price target
- upsideBullTarget: Bull case price target
- upsideExtremeTarget: Extreme/moonshot target
- upsideMostLikely: One sentence — most probable outcome
- upsideCatalysts: What drives each target (3 items)
- upsideInvalidation: What invalidates the target`,
    invalidation: `
QUESTION TYPE: INVALIDATION PRICE
The user is asking WHAT PRICE BREAKS THE THESIS. You MUST answer this FIRST.
- invalidationPrice: The specific price level that invalidates the thesis (e.g. "$280")
- invalidationConditions: 3 specific conditions that would break the thesis
- invalidationWhatHappens: One sentence — what to do if the thesis is invalidated`,
    risk_assessment: `
QUESTION TYPE: RISK ASSESSMENT
The user is asking HOW RISKY THIS IS. You MUST answer this FIRST.
- riskRating: "LOW" | "MODERATE" | "HIGH" | "EXTREME"
- riskSummary: One sentence — the overall risk assessment
- riskFactors: 3-5 specific risk factors
- riskRewardRatio: Risk:reward ratio (e.g. "1:3")
- maxDrawdownEstimate: Maximum drawdown estimate (e.g. "-35% in bear case")`,
    compare: `
QUESTION TYPE: COMPARISON
The user is asking to COMPARE two or more assets. Lead with a clear winner/recommendation.
- actionVerdict: Which asset to prefer (use the ticker as the verdict)
- actionVerdictReason: One sentence — why this asset wins the comparison
- actionVerdictConditions: 3 conditions that would change the preference`,
    opportunity_ranking: `
QUESTION TYPE: OPPORTUNITY RANKING
The user wants the BEST OPPORTUNITIES. This will be handled by the ranking engine.
For the general answer fields, provide macro context only.`,
    general_analysis: `
QUESTION TYPE: GENERAL ANALYSIS
Provide a comprehensive institutional analysis. Lead with the verdict and primary driver.`,
  };

  const questionIntentInstruction = intentInstructions[questionIntent];

  const systemPrompt = `You are FAULTLINE — an elite institutional market intelligence system.
You are a Chief Investment Strategist, NOT a chatbot.
${questionIntentInstruction}

WRITING STYLE (strict):
- Evidence first. Opinion second.
- Lead with the verdict. Never bury the conclusion.
- Write like a CIO briefing an institutional investment committee.
- Never use: "navigate", "landscape", "nuanced", "holistic", "multifaceted", "could", "may", "possibly", "potentially"
- Never start with "It is important to note that"
- Use declarative statements: "Liquidity supports risk assets." not "Liquidity may support risk assets."

FIELD RULES:
- primaryDriver: ONE sentence. The single most important factor driving the recommendation.
- executiveSummary: EXACTLY 2 sentences. First = verdict + primary reason. Second = key risk.
- whyThisVerdict: EXACTLY 3 sentences. Each sentence = one distinct signal.
- bullCase / bearCase: EXACTLY 2 sentences each.
- bullKeyDrivers / bearKeyDrivers: EXACTLY 3 items each. One clause per item.
- catalysts / threats: EXACTLY 3 items each.
- confidenceReasons: EXACTLY 3-4 items explaining WHY the confidence is at this level.
- evidenceScores: EXACTLY 14 items covering all required categories. Each score 0-100, one-line explanation.
- whyNotBuy: If verdict is WAIT/HOLD, provide 3 specific reasons why BUY was rejected. Otherwise null.
- whyNotSell: If verdict is WAIT/HOLD, provide 3 specific reasons why SELL was rejected. Otherwise null.
- watchCatalysts: EXACTLY 4-5 specific events/data points that would change the recommendation.
- invalidation: ONE sentence starting with "Thesis fails if..."
- suggestedAction: ONE sentence starting with a verb.
- Dynamic invalidation only — never hardcode prices. Use conditions like "breaks below moving average", "ETF outflows exceed threshold", "credit spreads widen beyond X bps".
DISCLAIMER INSTRUCTION: All output is for informational and educational purposes only. Nothing constitutes financial advice or a solicitation to buy or sell any security.

Current Market Regime: ${regimeLabel} (Pressure Score: ${pressureScore}/10)
${fmos ? `Action Bias: ${fmos.decision.actionBias}\nFMOS Decision: ${fmos.decision.verdict} (conviction: ${fmos.decision.conviction}%)\nBull Probability: ${fmos.probability.bull}%\nBear Probability: ${fmos.probability.bear}%\nNeutral Probability: ${fmos.probability.neutral}%\nConfidence: ${fmos.confidence.label} (${fmos.confidence.score}/100)\nTransition Risk: ${fmos.transition.transitionProbability}%\nPrimary Driver: ${fmos.probability.primaryDriver}` : ""}
${evidenceContext}
${outlookSummary}`;

  const userPrompt = `${conversationContext}
User question: "${query}"
${ticker ? `Security in focus: ${ticker} (${assetType})` : ""}

Respond with a JSON object matching this exact schema. Every field is required.

The 14 evidenceScores categories MUST be exactly:
"Macro Environment", "Liquidity", "Momentum", "Volatility", "Market Breadth",
"Institutional Positioning", "Historical Analog", "Sentiment", "ETF Flows",
"Dollar Index", "Treasury Yields", "Credit Markets", "Stablecoin Growth", "On-chain Activity"

For non-crypto assets, set "Stablecoin Growth" and "On-chain Activity" to neutral with score 50 and note "Not applicable for this asset class."

JSON schema:
{
  "verdict": "STRONG BUY" | "BUY" | "ACCUMULATE" | "WAIT" | "HOLD" | "REDUCE" | "STRONG REDUCE" | "SELL" | "HIGH RISK" | "LOW CONVICTION" | "MACRO ANSWER",
  "verdictColor": "green" | "yellow" | "red" | "blue",
  "opportunityScore": number (0-100),
  "confidence": number (0-100),
  "confidenceLabel": "HIGH" | "MODERATE" | "LOW",
  "confidenceReasons": string[] (3-4 specific reasons for this confidence level),
  "currentRegime": string (one sentence describing the current market regime),
  "dataFreshness": string (e.g. "Live — updated 2 min ago"),
  "primaryDriver": string (one sentence — the single most important factor),
  "executiveSummary": string (2 sentences — CIO briefing style),
  "whyThisVerdict": string (3 sentences, each a distinct signal),
  "bullCase": string (2 sentences — strongest argument FOR),
  "bullProbability": number (0-100),
  "bullKeyDrivers": string[] (exactly 3 items),
  "bearCase": string (2 sentences — strongest argument AGAINST),
  "bearProbability": number (0-100),
  "bearKeyDrivers": string[] (exactly 3 items),
  "catalysts": string[] (exactly 3 near-term catalysts),
  "threats": string[] (exactly 3 near-term threats),
  "evidenceScores": Array of { "category": string, "score": number (0-100), "signal": "bullish"|"bearish"|"neutral", "explanation": string (one line) },
  "whyNotBuy": string[] | null (3 reasons BUY was rejected if WAIT/HOLD, else null),
  "whyNotSell": string[] | null (3 reasons SELL was rejected if WAIT/HOLD, else null),
  "watchCatalysts": string[] (4-5 specific events that would change the recommendation),
  "support": string | null,
  "resistance": string | null,
  "entryZone": string | null,
  "profitTargets": string[],
  "stopLevel": string | null,
  "invalidation": string (dynamic condition, starts with "Thesis fails if..."),
  "expectedTimeframe": string,
  "suggestedAction": string (one sentence starting with a verb),
  "positionSizeGuidance": string | null,
  "whatChangesThesis": string,

  // DIRECT ANSWER FIELDS — populate based on question type:
  "downsideBaseZone": string | null,
  "downsideBearTarget": string | null,
  "downsideExtremeTarget": string | null,
  "downsideMostLikely": string | null,
  "downsideTriggers": string[],
  "downsideInvalidation": string | null,
  "upsideBaseTarget": string | null,
  "upsideBullTarget": string | null,
  "upsideExtremeTarget": string | null,
  "upsideMostLikely": string | null,
  "upsideCatalysts": string[],
  "upsideInvalidation": string | null,
  "actionVerdict": "BUY NOW" | "ACCUMULATE" | "WAIT" | "SELL" | "REDUCE" | "HOLD" | null,
  "actionVerdictReason": string | null,
  "actionVerdictConditions": string[],
  "entryZoneIdeal": string | null,
  "entryZoneAggressive": string | null,
  "entryZoneConservative": string | null,
  "entryZoneStop": string | null,
  "entryZoneTarget": string | null,
  "entryZoneRR": string | null,
  "exitZonePrimary": string | null,
  "exitZoneSecondary": string | null,
  "exitZoneFull": string | null,
  "exitZoneReason": string | null,
  "invalidationPrice": string | null,
  "invalidationConditions": string[],
  "invalidationWhatHappens": string | null,
  "riskRating": "LOW" | "MODERATE" | "HIGH" | "EXTREME" | null,
  "riskSummary": string | null,
  "riskFactors": string[],
  "riskRewardRatio": string | null,
  "maxDrawdownEstimate": string | null
}`;

  const llmResponse = await withLLMTimeout(invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "faultline_answer_v2",
        strict: true,
        schema: {
          type: "object",
          properties: {
            verdict: { type: "string" },
            verdictColor: { type: "string" },
            opportunityScore: { type: "number" },
            confidence: { type: "number" },
            confidenceLabel: { type: "string" },
            confidenceReasons: { type: "array", items: { type: "string" } },
            currentRegime: { type: "string" },
            dataFreshness: { type: "string" },
            primaryDriver: { type: "string" },
            executiveSummary: { type: "string" },
            whyThisVerdict: { type: "string" },
            bullCase: { type: "string" },
            bullProbability: { type: "number" },
            bullKeyDrivers: { type: "array", items: { type: "string" } },
            bearCase: { type: "string" },
            bearProbability: { type: "number" },
            bearKeyDrivers: { type: "array", items: { type: "string" } },
            catalysts: { type: "array", items: { type: "string" } },
            threats: { type: "array", items: { type: "string" } },
            evidenceScores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  score: { type: "number" },
                  signal: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["category", "score", "signal", "explanation"],
                additionalProperties: false,
              },
            },
            whyNotBuy: { type: ["array", "null"], items: { type: "string" } },
            whyNotSell: { type: ["array", "null"], items: { type: "string" } },
            watchCatalysts: { type: "array", items: { type: "string" } },
            support: { type: ["string", "null"] },
            resistance: { type: ["string", "null"] },
            entryZone: { type: ["string", "null"] },
            profitTargets: { type: "array", items: { type: "string" } },
            stopLevel: { type: ["string", "null"] },
            invalidation: { type: "string" },
            expectedTimeframe: { type: "string" },
            suggestedAction: { type: "string" },
            positionSizeGuidance: { type: ["string", "null"] },
            whatChangesThesis: { type: "string" },
            // Direct answer fields
            downsideBaseZone: { type: ["string", "null"] },
            downsideBearTarget: { type: ["string", "null"] },
            downsideExtremeTarget: { type: ["string", "null"] },
            downsideMostLikely: { type: ["string", "null"] },
            downsideTriggers: { type: "array", items: { type: "string" } },
            downsideInvalidation: { type: ["string", "null"] },
            upsideBaseTarget: { type: ["string", "null"] },
            upsideBullTarget: { type: ["string", "null"] },
            upsideExtremeTarget: { type: ["string", "null"] },
            upsideMostLikely: { type: ["string", "null"] },
            upsideCatalysts: { type: "array", items: { type: "string" } },
            upsideInvalidation: { type: ["string", "null"] },
            actionVerdict: { type: ["string", "null"] },
            actionVerdictReason: { type: ["string", "null"] },
            actionVerdictConditions: { type: "array", items: { type: "string" } },
            entryZoneIdeal: { type: ["string", "null"] },
            entryZoneAggressive: { type: ["string", "null"] },
            entryZoneConservative: { type: ["string", "null"] },
            entryZoneStop: { type: ["string", "null"] },
            entryZoneTarget: { type: ["string", "null"] },
            entryZoneRR: { type: ["string", "null"] },
            exitZonePrimary: { type: ["string", "null"] },
            exitZoneSecondary: { type: ["string", "null"] },
            exitZoneFull: { type: ["string", "null"] },
            exitZoneReason: { type: ["string", "null"] },
            invalidationPrice: { type: ["string", "null"] },
            invalidationConditions: { type: "array", items: { type: "string" } },
            invalidationWhatHappens: { type: ["string", "null"] },
            riskRating: { type: ["string", "null"] },
            riskSummary: { type: ["string", "null"] },
            riskFactors: { type: "array", items: { type: "string" } },
            riskRewardRatio: { type: ["string", "null"] },
            maxDrawdownEstimate: { type: ["string", "null"] },
          },
          required: [
            "verdict","verdictColor","opportunityScore","confidence","confidenceLabel",
            "confidenceReasons","currentRegime","dataFreshness","primaryDriver",
            "executiveSummary","whyThisVerdict",
            "bullCase","bullProbability","bullKeyDrivers",
            "bearCase","bearProbability","bearKeyDrivers",
            "catalysts","threats","evidenceScores",
            "whyNotBuy","whyNotSell","watchCatalysts",
            "support","resistance","entryZone","profitTargets","stopLevel",
            "invalidation","expectedTimeframe","suggestedAction","positionSizeGuidance","whatChangesThesis",
            "downsideBaseZone","downsideBearTarget","downsideExtremeTarget","downsideMostLikely","downsideTriggers","downsideInvalidation",
            "upsideBaseTarget","upsideBullTarget","upsideExtremeTarget","upsideMostLikely","upsideCatalysts","upsideInvalidation",
            "actionVerdict","actionVerdictReason","actionVerdictConditions",
            "entryZoneIdeal","entryZoneAggressive","entryZoneConservative","entryZoneStop","entryZoneTarget","entryZoneRR",
            "exitZonePrimary","exitZoneSecondary","exitZoneFull","exitZoneReason",
            "invalidationPrice","invalidationConditions","invalidationWhatHappens",
            "riskRating","riskSummary","riskFactors","riskRewardRatio","maxDrawdownEstimate"
          ],
          additionalProperties: false,
        },
      },
    },
  }));

  // Safely parse LLM JSON — strip markdown fences if present, throw TRPCError on parse failure
  const rawContent = ((llmResponse.choices[0].message.content as string) ?? "").trim();
  const jsonContent = rawContent.startsWith("`")
    ? rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    : rawContent;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonContent);
  } catch (parseErr) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "FAULTLINE analysis engine returned an invalid response. Please try again.",
      cause: parseErr,
    });
  }

  return sanitize({
    ...raw,
    ticker,
    assetType,
    queryType,
    questionIntent,
    regimeColor,
    deepDiveLinks: buildDeepDiveLinks(ticker, assetType, queryType),
  }) as FaultlineAnswer;
}

// ── Opportunity Ranking Types ───────────────────────────────

export interface RankedOpportunityItem {
  rank: number;
  ticker: string;
  name: string;
  sector: string;
  assetType: "stock" | "crypto";
  action: "BUY" | "ACCUMULATE" | "WATCH" | "AVOID";
  convictionScore: number;        // 0–100
  riskLevel: "Low" | "Medium" | "High" | "Extreme";
  primaryDriver: string;          // one sentence
  nearTermCatalyst: string;       // one sentence
  keyRisk: string;                // one sentence
  thesisSummary: string;          // 2 sentences
  entryZone: string | null;
  stopLevel: string | null;
  targetOne: string | null;
  riskRewardRatio: string | null;
  dataFreshness: string;
}

export interface SectorRating {
  sector: string;
  rating: 1 | 2 | 3 | 4 | 5;    // 1=Avoid, 5=Strong Buy
  bias: "bullish" | "bearish" | "neutral";
  reason: string;                 // one sentence
}

export interface OpportunityRankingAnswer {
  queryType: "opportunity";
  macroContext: string;           // 2-3 sentence macro backdrop
  regimeLabel: string;
  regimeColor: "green" | "yellow" | "red";
  topOpportunities: RankedOpportunityItem[];  // top 5-8
  avoidList: Array<{ ticker: string; name: string; reason: string; }>;
  sectorLeaderboard: SectorRating[];
  whyTheseRankHighest: string;    // 3-4 sentence narrative
  followUpChips: string[];        // 4-5 suggested follow-up questions
  dataFreshness: string;
  deepDiveLinks: Array<{ label: string; path: string; description: string; }>;
}

// ── Orchestrate Opportunity Ranking ──────────────────────────
async function orchestrateOpportunityRanking(
  query: string,
  conversationHistory: ConversationMessage[],
): Promise<OpportunityRankingAnswer> {
  // 1. Get live FMOS regime context
  const fmosResult = await runFMOSPipelineFast({}).catch(() => null);
  const fmos = fmosResult ?? null;
  const pressureData = fmos?.pressure ?? null;
  const regimeLabel = fmos?.regime?.currentRegime ?? pressureData?.regime ?? "UNCERTAIN";
  const pressureScore = pressureData ? (pressureData.overallPressure / 10) : 5;
  const regimeColor: "green" | "yellow" | "red" = pressureScore <= 3 ? "green" : pressureScore <= 6 ? "yellow" : "red";

  // 2. Scan the full investment universe (top 30 by composite score)
  const rawOpportunities = await scanOpportunities(null, 100000, "both").catch(() => []);
  const topRaw = rawOpportunities.slice(0, 30);
  const avoidRaw = rawOpportunities.filter(o => o.direction === "AVOID").slice(0, 5);

  // 3. Build compact context for LLM
  const universeContext = topRaw.map((o, i) =>
    `${i + 1}. ${o.ticker} (${o.name}) — ${o.sector} — ${o.assetType} — Score: ${o.compositeScore}/100 — Direction: ${o.direction} — Macro Fit: ${o.macroFit}/100 — Momentum: ${o.momentumScore}/100 — R/R: ${o.riskRewardRatio.toFixed(1)} — Confidence: ${o.faultlineConfidence}% — Why: ${o.whyNow}`
  ).join("\n");

  const avoidContext = avoidRaw.map(o =>
    `${o.ticker} (${o.name}): ${o.invalidation}`
  ).join("\n");

  const conversationContext = conversationHistory.length > 0
    ? `\nPrevious conversation:\n${conversationHistory.slice(-4).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}\n`
    : "";

  const systemPrompt = `You are FAULTLINE — an elite institutional market intelligence system.
You are a Chief Investment Strategist presenting a ranked opportunity scan to an investment committee.

Current Market Regime: ${regimeLabel} (Pressure Score: ${pressureScore}/10)
${fmos ? `Bull Probability: ${fmos.probability.bull}% | Bear Probability: ${fmos.probability.bear}% | Primary Driver: ${fmos.probability.primaryDriver}` : ""}

WRITING STYLE:
- Lead with the highest-conviction ideas. Rank by institutional merit, not popularity.
- Every recommendation must be grounded in the current regime context.
- Be specific: name the catalyst, name the risk, name the entry zone.
- Never use: "navigate", "landscape", "nuanced", "could", "may", "possibly"
- Use declarative statements. Write like a CIO briefing an investment committee.

FIELD RULES:
- topOpportunities: Select the 5-8 highest-conviction ideas from the universe scan. Rank by conviction score descending.
- For each opportunity: primaryDriver = one sentence, nearTermCatalyst = one sentence, keyRisk = one sentence, thesisSummary = exactly 2 sentences.
- avoidList: 3-5 assets to avoid right now with a specific one-sentence reason each.
- sectorLeaderboard: Rate 8-10 sectors on a 1-5 scale (1=Avoid, 5=Strong Buy) with one-sentence reason.
- whyTheseRankHighest: 3-4 sentences explaining the macro logic behind the top-ranked opportunities.
- followUpChips: 4-5 natural follow-up questions the user might want to ask next.
DISCLAIMER INSTRUCTION: All output is for informational and educational purposes only. Nothing constitutes financial advice or a solicitation to buy or sell any security.`;

  const userPrompt = `${conversationContext}
User question: "${query}"

Universe scan results (sorted by composite score):
${universeContext}

Avoid candidates:
${avoidContext}

Respond with a JSON object matching this exact schema:
{
  "macroContext": string (2-3 sentences — current macro backdrop and what it means for opportunities),
  "topOpportunities": Array of {
    "rank": number,
    "ticker": string,
    "name": string,
    "sector": string,
    "assetType": "stock" | "crypto",
    "action": "BUY" | "ACCUMULATE" | "WATCH" | "AVOID",
    "convictionScore": number (0-100),
    "riskLevel": "Low" | "Medium" | "High" | "Extreme",
    "primaryDriver": string (one sentence),
    "nearTermCatalyst": string (one sentence),
    "keyRisk": string (one sentence),
    "thesisSummary": string (exactly 2 sentences),
    "entryZone": string | null,
    "stopLevel": string | null,
    "targetOne": string | null,
    "riskRewardRatio": string | null,
    "dataFreshness": string
  },
  "avoidList": Array of { "ticker": string, "name": string, "reason": string (one sentence) },
  "sectorLeaderboard": Array of { "sector": string, "rating": 1|2|3|4|5, "bias": "bullish"|"bearish"|"neutral", "reason": string },
  "whyTheseRankHighest": string (3-4 sentences),
  "followUpChips": string[] (4-5 follow-up questions)
}`;

  const llmResponse = await withLLMTimeout(invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "opportunity_ranking_v1",
        strict: true,
        schema: {
          type: "object",
          properties: {
            macroContext: { type: "string" },
            topOpportunities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rank: { type: "number" },
                  ticker: { type: "string" },
                  name: { type: "string" },
                  sector: { type: "string" },
                  assetType: { type: "string" },
                  action: { type: "string" },
                  convictionScore: { type: "number" },
                  riskLevel: { type: "string" },
                  primaryDriver: { type: "string" },
                  nearTermCatalyst: { type: "string" },
                  keyRisk: { type: "string" },
                  thesisSummary: { type: "string" },
                  entryZone: { type: ["string", "null"] },
                  stopLevel: { type: ["string", "null"] },
                  targetOne: { type: ["string", "null"] },
                  riskRewardRatio: { type: ["string", "null"] },
                  dataFreshness: { type: "string" },
                },
                required: ["rank","ticker","name","sector","assetType","action","convictionScore","riskLevel","primaryDriver","nearTermCatalyst","keyRisk","thesisSummary","entryZone","stopLevel","targetOne","riskRewardRatio","dataFreshness"],
                additionalProperties: false,
              },
            },
            avoidList: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ticker: { type: "string" },
                  name: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["ticker","name","reason"],
                additionalProperties: false,
              },
            },
            sectorLeaderboard: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sector: { type: "string" },
                  rating: { type: "number" },
                  bias: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["sector","rating","bias","reason"],
                additionalProperties: false,
              },
            },
            whyTheseRankHighest: { type: "string" },
            followUpChips: { type: "array", items: { type: "string" } },
          },
          required: ["macroContext","topOpportunities","avoidList","sectorLeaderboard","whyTheseRankHighest","followUpChips"],
          additionalProperties: false,
        },
      },
    },
  }));

  const rawContent = ((llmResponse.choices[0].message.content as string) ?? "").trim();
  const jsonContent = rawContent.startsWith("`")
    ? rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    : rawContent;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonContent);
  } catch (parseErr) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "FAULTLINE opportunity ranking engine returned an invalid response. Please try again.",
      cause: parseErr,
    });
  }

  const followUpChips = (raw.followUpChips as string[]) ?? [
    "What is the #1 opportunity right now?",
    "Show me the top crypto opportunities",
    "What sectors should I avoid?",
    "What are the highest conviction setups?",
  ];

  return sanitize({
    queryType: "opportunity" as const,
    macroContext: raw.macroContext,
    regimeLabel,
    regimeColor,
    topOpportunities: raw.topOpportunities,
    avoidList: raw.avoidList,
    sectorLeaderboard: raw.sectorLeaderboard,
    whyTheseRankHighest: raw.whyTheseRankHighest,
    followUpChips,
    dataFreshness: "Live — updated just now",
    deepDiveLinks: [
      { label: "Opportunity Radar", path: "/app/opportunities", description: "Full ranked opportunity scan with filters" },
      { label: "Ask Intelligence", path: "/app/ask", description: "Ask about any specific opportunity" },
      { label: "Market Stress", path: "/app/pressure", description: "Macro risk and pressure indicators" },
      { label: "Decision Ledger", path: "/app/decision-ledger", description: "Track recommendation history" },
    ],
  }) as OpportunityRankingAnswer;
}

// ── Route opportunity queries ─────────────────────────────────
// Modify orchestrateAnswer to detect opportunity intent and delegate
async function orchestrateWithRouting(
  query: string,
  conversationHistory: ConversationMessage[],
  contextTicker: string | null,
  contextAssetType: "stock" | "crypto" | null,
): Promise<FaultlineAnswer | OpportunityRankingAnswer> {
  const intent = resolveIntent(query, contextTicker, contextAssetType);
  // Route broad opportunity queries to the ranking engine
  if (intent.queryType === "opportunity" && !intent.ticker) {
    return orchestrateOpportunityRanking(query, conversationHistory);
  }
  // All other queries go to the single-asset/macro answer engine
  return orchestrateAnswer(query, conversationHistory, contextTicker, contextAssetType);
}

// ── Router ────────────────────────────────────────────────────

export const smartDiscoveryRouter = router({
  /**
   * The primary FAULTLINE interface.
   * One question in → one institutional answer out.
   */
  ask: publicProcedure
    .input(z.object({
      query: z.string().min(1).max(500).trim(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        ticker: z.string().nullable().optional(),
        timestamp: z.number(),
      })).default([]),
      contextTicker: z.string().nullable().optional(),
      contextAssetType: z.enum(["stock", "crypto"]).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const answer = await orchestrateWithRouting(
        input.query,
        input.conversationHistory as ConversationMessage[],
        input.contextTicker ?? null,
        input.contextAssetType ?? null,
      );
      return answer;
    }),

  /**
   * Log a recommendation to the Decision Ledger.
   * Called automatically after each Ask response.
   */
  logRecommendation: protectedProcedure
    .input(z.object({
      ticker: z.string().nullable(),
      assetType: z.enum(["stock", "crypto"]).nullable(),
      verdict: z.string(),
      opportunityScore: z.number(),
      confidence: z.number(),
      primaryDriver: z.string(),
      expectedTimeframe: z.string(),
      queryType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: true };

      // Capture price at entry for later auto-evaluation
      let priceAtEntry: number | null = null;
      if (input.ticker && input.assetType) {
        try {
          if (input.assetType === "crypto") {
            const data = await getCoinMarketData(input.ticker);
            priceAtEntry = data?.currentPrice ?? null;
          } else {
            const quote = await getQuote(input.ticker);
            priceAtEntry = quote.price ?? null;
          }
        } catch {
          // Price fetch failure is non-fatal — entry still logged
        }
      }

      await db.insert(decisionLedger).values({
        userId: ctx.user.id,
        ticker: input.ticker,
        assetType: input.assetType,
        verdict: input.verdict,
        opportunityScore: input.opportunityScore,
        confidence: input.confidence,
        primaryDriver: input.primaryDriver,
        expectedTimeframe: input.expectedTimeframe,
        queryType: input.queryType,
        outcome: "pending",
        priceAtEntry,
      });
      return { success: true };
    }),

  /**
   * Get Decision Ledger entries for the current user.
   */
  getLedger: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const entries = await db
        .select()
        .from(decisionLedger)
        .where(eq(decisionLedger.userId, ctx.user.id))
        .orderBy(desc(decisionLedger.createdAt))
        .limit(input.limit);
      return entries;
    }),

  /**
   * Update the outcome of a Decision Ledger entry.
   */
  updateOutcome: protectedProcedure
    .input(z.object({
      id: z.number(),
      outcome: z.enum(["correct", "incorrect", "pending", "partially_correct", "still_active"]),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: true };
      await db
        .update(decisionLedger)
        .set({
          outcome: input.outcome,
          notes: input.notes ?? null,
          // Mark as user-driven (not auto-evaluated) when user manually sets outcome
          autoEvaluated: false,
          resolvedAt: input.outcome !== "pending" ? new Date() : null,
        })
        .where(eq(decisionLedger.id, input.id));
      return { success: true };
    }),

  /**
   * Get Decision Ledger stats (win rate, accuracy by asset class, etc.)
   */
  getLedgerStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, resolved: 0, pending: 0, correct: 0, incorrect: 0, winRate: null, byAsset: [], byVerdict: [] };
    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const resolved = entries.filter((e: DecisionLedgerEntry) => e.outcome !== "pending");
    const correct = resolved.filter((e: DecisionLedgerEntry) => e.outcome === "correct");
    const partiallyCorrect = resolved.filter((e: DecisionLedgerEntry) => e.outcome === "partially_correct");
    const stillActive = resolved.filter((e: DecisionLedgerEntry) => e.outcome === "still_active");
    // Win rate: correct = 1pt, partially_correct = 0.5pt, incorrect/still_active = 0pt
    const winPoints = correct.length + partiallyCorrect.length * 0.5;
    const winRate = resolved.length > 0 ? Math.round((winPoints / resolved.length) * 100) : null;

    // Accuracy by asset class
    const byAsset: Record<string, { correct: number; total: number }> = {};
    for (const e of resolved) {
      const key = e.assetType ?? "macro";
      if (!byAsset[key]) byAsset[key] = { correct: 0, total: 0 };
      byAsset[key].total++;
      if (e.outcome === "correct") byAsset[key].correct++;
    }

    // Accuracy by verdict
    const byVerdict: Record<string, { correct: number; total: number }> = {};
    for (const e of resolved) {
      const key = e.verdict;
      if (!byVerdict[key]) byVerdict[key] = { correct: 0, total: 0 };
      byVerdict[key].total++;
      if (e.outcome === "correct") byVerdict[key].correct++;
    }

    return {
      total: entries.length,
      resolved: resolved.length,
      pending: entries.filter((e: DecisionLedgerEntry) => e.outcome === "pending").length,
      correct: correct.length,
      partiallyCorrect: partiallyCorrect.length,
      stillActive: stillActive.length,
      incorrect: resolved.filter((e: DecisionLedgerEntry) => e.outcome === "incorrect").length,
      winRate,
      byAsset: Object.entries(byAsset).map(([asset, stats]) => ({
        asset,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        total: stats.total,
      })),
      byVerdict: Object.entries(byVerdict).map(([verdict, stats]) => ({
        verdict,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        total: stats.total,
      })),
    };
  }),
});
