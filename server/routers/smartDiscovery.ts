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
import { router, publicProcedure } from "../_core/trpc";
import { calculateFaultlinePressure } from "../pressure/engine";
import { getQuickOutlook } from "../signalOutlook";
import { getDiagnosticReport } from "../diagnosticAI";
import { invokeLLM } from "../_core/llm";

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

// ── Intent classifier ─────────────────────────────────────────

const CRYPTO_TICKERS = new Set([
  "BTC","ETH","SOL","BNB","XRP","DOGE","LINK","TAO","ONDO","ADA",
  "AVAX","DOT","MATIC","ATOM","LTC","UNI","AAVE","COMP","MKR","SNX",
  "NEAR","FTM","ALGO","HBAR","ICP","VET","EOS","TRX","XLM","ETC",
]);

function extractTicker(query: string): { ticker: string | null; assetType: "stock" | "crypto" | null } {
  const SKIP = new Set(["I","A","IS","IN","IT","AT","TO","DO","BE","MY","OR","VS","AI","US","UK","EU","IF","OR","AND","THE","FOR","NOW","BUY","SELL","HOLD","WAIT","RISK"]);
  const matches = query.match(/\b([A-Z]{1,6})\b/g);
  const ticker = matches?.find(t => !SKIP.has(t) && t.length >= 2) ?? null;
  const assetType = ticker ? (CRYPTO_TICKERS.has(ticker) ? "crypto" : "stock") : null;
  return { ticker, assetType };
}

function classifyQueryType(query: string, ticker: string | null): "security" | "macro" | "opportunity" | "portfolio" | "general" {
  const q = query.toLowerCase();
  if (ticker) return "security";
  if (q.includes("opportunit") || q.includes("swing trade") || q.includes("best trade") || q.includes("what to buy")) return "opportunity";
  if (q.includes("portfolio") || q.includes("position") || q.includes("holding")) return "portfolio";
  if (q.includes("market") || q.includes("macro") || q.includes("economy") || q.includes("crash") || q.includes("risk") || q.includes("regime")) return "macro";
  return "general";
}

// ── Sanitize NaN/Infinity ─────────────────────────────────────

function sanitize(v: unknown): unknown {
  if (typeof v === "number") return isFinite(v) && !isNaN(v) ? v : 0;
  if (v === null || v === undefined) return v;
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

  // 1. Extract intent
  const { ticker: rawTicker, assetType: rawAssetType } = extractTicker(query.toUpperCase());
  const ticker = rawTicker ?? contextTicker;
  const assetType = rawAssetType ?? contextAssetType;
  const queryType = classifyQueryType(query, ticker);

  // 2. Fetch live market data in parallel
  const [pressure, quickOutlook, diagnostic] = await Promise.allSettled([
    calculateFaultlinePressure(),
    ticker ? getQuickOutlook(ticker, assetType ?? "stock") : Promise.resolve(null),
    getDiagnosticReport("week"),
  ]);

  const pressureData = pressure.status === "fulfilled" ? pressure.value : null;
  const outlookData = quickOutlook.status === "fulfilled" ? quickOutlook.value : null;
  const diagnosticData = diagnostic.status === "fulfilled" ? diagnostic.value : null;

  // 3. Build context for LLM
  const regimeLabel = pressureData?.regime ?? diagnosticData?.regimeLabel ?? "UNCERTAIN";
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

  const systemPrompt = `You are FAULTLINE — an elite institutional market intelligence system. You synthesize live market data, macro regime analysis, and proprietary signal scoring into one clear, confident recommendation.

You are NOT a chatbot. You are NOT a search engine. You are a Chief Investment Strategist.

Your tone: Confident. Measured. Institutional. Never sensational. Never generic. Never overly certain.

Always explain both the opportunity AND the risk.

Current Market Regime: ${regimeLabel} (Pressure Score: ${pressureScore}/10)
${diagnosticData ? `Action Bias: ${diagnosticData.actionBias}\nKey Risk Drivers: ${diagnosticData.keyRiskDrivers?.join(", ") ?? "none"}` : ""}
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

  const raw = JSON.parse(llmResponse.choices[0].message.content as string);

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
