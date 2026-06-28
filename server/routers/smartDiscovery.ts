/**
 * FAULTLINE — Smart Discovery™ Backend
 * server/routers/smartDiscovery.ts
 *
 * The FAULTLINE Constitution:
 *   One Question In → One Institutional Answer Out
 *   Verdict before data. Explain WHY. Show opportunity. Show risk.
 *
 * This router orchestrates all intelligence engines and returns
 * a single unified institutional response. The engines are invisible.
 * Only FAULTLINE exists.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { runFMOSPipelineFast } from "../fmos/pipeline";
import { getQuickOutlook } from "../signalOutlook";
import { invokeLLM } from "../_core/llm";
import { resolveIntent } from "../intentResolver";

// ── Types ─────────────────────────────────────────────────────

export interface FaultlineAnswer {
  // Core verdict
  verdict: "STRONG BUY" | "BUY" | "WAIT" | "HOLD" | "REDUCE" | "STRONG REDUCE" | "AVOID" | "MACRO ANSWER";
  verdictColor: "green" | "yellow" | "red" | "blue";
  opportunityScore: number;       // 0–100
  confidence: number;             // 0–100
  confidenceLabel: string;        // "HIGH" | "MODERATE" | "LOW"

  // Context
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  queryType: "security" | "macro" | "opportunity" | "portfolio" | "general";
  currentRegime: string;
  regimeColor: "green" | "yellow" | "red";
  dataFreshness: string;

  // The answer
  executiveSummary: string;       // 2-3 sentences — the strategist's opening statement
  whyThisVerdict: string;         // The reasoning chain
  bullCase: string;
  bearCase: string;
  catalysts: string[];
  threats: string[];

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

  const systemPrompt = `You are FAULTLINE — an elite institutional market intelligence system.
You are a Chief Investment Strategist, NOT a chatbot.

TONE RULES (strict):
- Be direct. Lead with the verdict. Never bury the conclusion.
- executiveSummary: EXACTLY 2 sentences. First sentence = verdict + primary reason. Second sentence = key risk.
- whyThisVerdict: EXACTLY 3 sentences. Each sentence = one distinct signal/reason.
- bullCase / bearCase: EXACTLY 2 sentences each.
- catalysts / threats: EXACTLY 3 items each. One clause per item. No sub-bullets.
- suggestedAction: ONE sentence. Start with a verb. Include a specific price or condition if possible.
- invalidation: ONE sentence. Start with "Thesis fails if..."
- whatChangesThesis: ONE sentence.
- Never use the word "navigate", "landscape", "nuanced", "holistic", or "multifaceted".
- Never start a sentence with "It is important to note that".

Current Market Regime: ${regimeLabel} (Pressure Score: ${pressureScore}/10)
${fmos ? `Action Bias: ${fmos.decision.actionBias}\nDecision: ${fmos.decision.verdict} (conviction: ${fmos.decision.conviction}%)\nBull Probability: ${fmos.probability.bull}%\nBear Probability: ${fmos.probability.bear}%\nConfidence: ${fmos.confidence.label} (${fmos.confidence.score}/100)\nTransition Risk: ${fmos.transition.transitionProbability}%` : ""}
${outlookSummary}`;

  const userPrompt = `${conversationContext}
User question: "${query}"
${ticker ? `Security in focus: ${ticker} (${assetType})` : ""}

Respond with a JSON object matching this exact schema:
{
  "verdict": "STRONG BUY" | "BUY" | "WAIT" | "HOLD" | "REDUCE" | "STRONG REDUCE" | "AVOID" | "MACRO ANSWER",
  "verdictColor": "green" | "yellow" | "red" | "blue",
  "opportunityScore": number (0-100),
  "confidence": number (0-100),
  "confidenceLabel": "HIGH" | "MODERATE" | "LOW",
  "currentRegime": string (one sentence describing the current market regime),
  "dataFreshness": string (e.g. "Live — updated 2 min ago"),
  "executiveSummary": string (2-3 sentences — the strategist's opening statement, written like a CIO briefing a portfolio manager),
  "whyThisVerdict": string (the reasoning chain — what signals, what regime context, what institutional behavior supports this verdict),
  "bullCase": string (the strongest argument FOR this security/thesis),
  "bearCase": string (the strongest argument AGAINST — be honest),
  "catalysts": string[] (3-5 specific near-term catalysts),
  "threats": string[] (3-5 specific near-term threats),
  "support": string | null (key support level, null for macro questions),
  "resistance": string | null (key resistance level, null for macro questions),
  "entryZone": string | null (ideal entry zone, null for macro questions),
  "profitTargets": string[] (1-3 specific price targets, empty for macro),
  "stopLevel": string | null (stop loss level, null for macro questions),
  "invalidation": string (what specific development would invalidate this thesis),
  "expectedTimeframe": string (e.g. "2-4 weeks", "1-3 months"),
  "suggestedAction": string (one clear, specific action sentence),
  "positionSizeGuidance": string | null (e.g. "2-3% of portfolio" or null if not applicable),
  "whatChangesThesis": string (what specific data, event, or price action would change this recommendation)
}

Write like a Chief Investment Strategist briefing an institutional client. Be specific. Be direct. Explain the WHY. Never be vague.`;

  const llmResponse = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "faultline_answer",
        strict: true,
        schema: {
          type: "object",
          properties: {
            verdict: { type: "string" },
            verdictColor: { type: "string" },
            opportunityScore: { type: "number" },
            confidence: { type: "number" },
            confidenceLabel: { type: "string" },
            currentRegime: { type: "string" },
            dataFreshness: { type: "string" },
            executiveSummary: { type: "string" },
            whyThisVerdict: { type: "string" },
            bullCase: { type: "string" },
            bearCase: { type: "string" },
            catalysts: { type: "array", items: { type: "string" } },
            threats: { type: "array", items: { type: "string" } },
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
          },
          required: [
            "verdict","verdictColor","opportunityScore","confidence","confidenceLabel",
            "currentRegime","dataFreshness","executiveSummary","whyThisVerdict",
            "bullCase","bearCase","catalysts","threats",
            "support","resistance","entryZone","profitTargets","stopLevel",
            "invalidation","expectedTimeframe","suggestedAction","positionSizeGuidance","whatChangesThesis"
          ],
          additionalProperties: false,
        },
      },
    },
  });

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
    regimeColor,
    deepDiveLinks: buildDeepDiveLinks(ticker, assetType, queryType),
  }) as FaultlineAnswer;
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
      const answer = await orchestrateAnswer(
        input.query,
        input.conversationHistory as ConversationMessage[],
        input.contextTicker ?? null,
        input.contextAssetType ?? null,
      );
      return answer;
    }),
});
