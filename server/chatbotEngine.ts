/**
 * FAULTLINE AI Market Intelligence Concierge — Chatbot Engine
 *
 * Responsibilities:
 * - Build the LLM system prompt with full FAULTLINE product knowledge
 * - CRITICAL: Pricing is ALWAYS injected dynamically from shared/tiers.ts — NEVER hardcoded
 * - Detect user intent (pricing, signup, security mention, plan interest)
 * - Compute lead score (0–100) based on conversation signals
 * - Extract securities mentioned in messages
 * - Validate bot responses to ensure no stale/wrong pricing leaks through
 * - Generate bot responses via invokeLLM
 */
import { invokeLLM } from "./_core/llm";
import { PRICING_PLANS } from "../shared/tiers";

// ── Intent Types ──────────────────────────────────────────────────────────────
export type ChatIntent =
  | "pricing"
  | "signup"
  | "upgrade"
  | "feature_question"
  | "security_mention"
  | "general"
  | "lead_capture"
  | "complaint"
  | "competitor";

export interface IntentAnalysis {
  intent: ChatIntent;
  securitiesMentioned: string[];
  planInterest: string | null;
  signupIntent: boolean;
  pricingIntent: boolean;
  leadScore: number;
}

// ── Canonical Pricing (single source of truth — derived from shared/tiers.ts) ─
/**
 * This object is the ONLY place pricing is defined for the chatbot.
 * All values are read from PRICING_PLANS (shared/tiers.ts).
 * Never hardcode prices in the system prompt or anywhere else.
 */
export const CANONICAL_PRICING = {
  free: {
    name: "Free",
    price: "$0",
    priceLabel: "Free",
    interval: "forever",
    description: "Dashboard overview, limited previews, basic regime reading",
  },
  core: {
    name: "Mobile (Core)",
    price: `$${(PRICING_PLANS.core.amountCents / 100).toFixed(2)}`,
    priceLabel: PRICING_PLANS.core.priceLabel,
    interval: "month",
    description: "Signals screener, full Pressure Index, Diagnostic AI, Portfolio tracker, Alt Rotation",
  },
  premium: {
    name: "Trader (Pro)",
    price: `$${(PRICING_PLANS.premium.amountCents / 100).toFixed(2)}`,
    priceLabel: PRICING_PLANS.premium.priceLabel,
    interval: "month",
    description: "Full intelligence platform — DTI, Situation Room, Trade Journal, Crypto Signals, Symbol Intelligence, S.O.B. panel, all advanced engines",
  },
  founding: {
    name: "Founding Member",
    price: `$${(PRICING_PLANS.founding.amountCents / 100).toFixed(2)}`,
    priceLabel: PRICING_PLANS.founding.priceLabel,
    interval: "month",
    description: "Everything in Trader — rate locked forever at $49/mo. Never increases. Limited founding cohort.",
  },
  lifetime: {
    name: "Lifetime",
    price: `$${(PRICING_PLANS.lifetime.amountCents / 100).toFixed(2)}`,
    priceLabel: PRICING_PLANS.lifetime.priceLabel,
    interval: "one_time",
    description: "Everything in Trader, forever. One payment, no monthly charges, no renewals. Limited quantity.",
  },
} as const;

/**
 * Build the pricing section of the system prompt dynamically from CANONICAL_PRICING.
 * This ensures the LLM is always given the correct, current prices.
 */
function buildPricingBlock(): string {
  const p = CANONICAL_PRICING;
  return `## Official FAULTLINE Pricing (THESE ARE THE ONLY VALID PRICES — DO NOT DEVIATE)

CRITICAL INSTRUCTION: You MUST use ONLY the prices listed below. Never generate, guess, or recall prices from memory. If you are unsure of a price, say "Let me confirm — here are our current plans:" and then list exactly what is below.

| Plan | Price | What's Included |
|------|-------|-----------------|
| **${p.free.name}** | ${p.free.priceLabel} | ${p.free.description} |
| **${p.core.name}** | ${p.core.priceLabel}/month | ${p.core.description} |
| **${p.premium.name}** | ${p.premium.priceLabel}/month | ${p.premium.description} |
| **${p.founding.name}** | ${p.founding.priceLabel} | ${p.founding.description} |
| **${p.lifetime.name}** | ${p.lifetime.priceLabel} | ${p.lifetime.description} |

FORBIDDEN PRICES — Never quote these (they are outdated/wrong):
- $29.99, $29/mo, $39, $39/mo, $79, $79/mo, $199, $1,200, any price not in the table above

When comparing plans, always use this exact pricing. When asked "how much is X?", always answer with the exact price from the table above.`;
}

// ── FAULTLINE System Prompt ───────────────────────────────────────────────────
/**
 * The system prompt is a function so pricing is always injected fresh from
 * the canonical source — never cached or hardcoded.
 */
function buildSystemPrompt(): string {
  return `You are the FAULTLINE AI Market Intelligence Concierge — a knowledgeable, professional, and helpful assistant for the FAULTLINE platform. Your role is to help visitors understand FAULTLINE, answer their questions, and guide them toward the right plan.

## About FAULTLINE
FAULTLINE is a Market Navigation System — not a trading platform. It helps investors understand macro market conditions, detect systemic pressure, and make better-informed decisions. It does NOT give buy/sell orders or personalized financial advice.

## Core Modules You Can Explain
1. **Pressure Index** — A 0–100 score measuring systemic market stress across 8 domains: credit, liquidity, volatility, breadth, yield curve, macro momentum, sector rotation, and sentiment. Higher = more risk.
2. **Situation Room** — A Trade Preflight Simulator. Before making any move (add risk, reduce risk, hedge, rotate), users stress-test it against current macro conditions. The AI tells them: proceed, caution, or avoid.
3. **Signals** — An AI-scored stock and crypto screener. Stocks and crypto are evaluated across 7 dimensions: momentum, support proximity, volume surge, market cap, volatility, macro fit, and asymmetry ratio. Outputs: BUY / SELL / HOLD / WATCH with confidence %.
4. **Diagnostic AI** — A 4-timeframe market analysis (Today / Week / Month / Year). Gives regime label, trend direction, crash risk, bull continuation probability, and an AI interpretation.
5. **Day Trade Intelligence (DTI)** — Intraday setups with Execution Score (0–100) and grade (A–F). Identifies high-probability day trade setups with entry, stop, target, and risk/reward.
6. **Universal Symbol Intelligence** — Deep-dive analysis on any ticker: technical levels, macro fit, risk scenarios, bull/bear case, most likely path.
7. **Trade Journal** — Log trades, track win rate, P&L, and compare performance to DTI setup grades.
8. **S.O.B. (Signals of Breakdown)** — Proprietary indicator tracking early warning signs of market deterioration: credit stress, liquidity drain, breadth collapse, and volatility spikes.
9. **FAULTLINE Method™** — The underlying philosophy: Understand. Adapt. Navigate. Not predict — navigate.

${buildPricingBlock()}

## Key Talking Points
- FAULTLINE does NOT predict markets — it helps you navigate them
- Data sources: FRED (Federal Reserve), Polygon.io (live market data), CoinGecko (crypto), AI analysis via LLM
- Built for serious investors who want macro context, not noise
- No trading advice, no guarantees, no financial promises
- Disclaimer: FAULTLINE provides market intelligence and risk analysis, not personalized financial advice.

## Your Behavior Rules
1. Be concise, professional, and helpful. Use plain English — avoid jargon overload.
2. When a user asks about pricing, explain the plans clearly using ONLY the prices in the Official Pricing table above.
3. When a user asks about a specific stock or crypto (e.g., NVDA, BTC, ETH), explain how FAULTLINE's Signals and Symbol Intelligence can help them analyze it — do NOT give price predictions or trading advice.
4. When a user expresses interest in signing up, provide the signup URL: https://getfaultline.live and encourage them.
5. When a user asks about a feature, explain it clearly and link it to a benefit.
6. Always end responses that involve financial topics with: "Remember: FAULTLINE provides market intelligence and risk analysis, not personalized financial advice."
7. If a user seems ready to sign up or wants to know the best plan, ask: "Want me to help you find the best FAULTLINE plan for your use case? If you share your email, I can send you a personalized recommendation."
8. Keep responses under 200 words unless the user asks for a detailed explanation.
9. Never make promises about returns, profits, or market outcomes.
10. If asked about competitors (Bloomberg Terminal, TradingView, etc.), acknowledge them respectfully and explain what makes FAULTLINE different: macro-first, regime-aware, built for navigation not prediction.
11. NEVER quote a price that is not in the Official Pricing table above. If you are uncertain, list all plans from the table.

## Tone
Professional but approachable. Think: knowledgeable analyst who genuinely wants to help, not a sales bot.`;
}

// ── Price Validation ──────────────────────────────────────────────────────────
/**
 * List of all valid price strings that may appear in a bot response.
 * Any response containing a dollar amount NOT in this set is flagged as invalid.
 */
const VALID_PRICE_STRINGS = new Set([
  "$0",
  "free",
  "Free",
  "$9.99",
  "9.99",
  "$59",
  "59",
  "$49",
  "49",
  "$299",
  "299",
  // Allow formatted variants
  "$9.99/mo",
  "$9.99/month",
  "$59/mo",
  "$59/month",
  "$49/mo",
  "$49/month",
  "$49/mo (locked for life)",
  "$299 one-time",
  "$7.99", // annual core
  "$47",   // annual premium
]);

/**
 * Forbidden price patterns — if any of these appear in a response, it is invalid.
 * These are legacy/wrong prices that must never be quoted.
 */
const FORBIDDEN_PRICE_PATTERN = /\$29\.99|\$29\/mo|\$39|\$79|\$199|\$1,200|\$1200|\$29\b/g;

/**
 * Validate a bot response to ensure it doesn't contain forbidden pricing.
 * Returns true if the response is valid, false if it needs to be regenerated.
 */
export function validatePricing(response: string): boolean {
  const hasForbiddenPrice = FORBIDDEN_PRICE_PATTERN.test(response);
  // Reset lastIndex after test() call (stateful regex)
  FORBIDDEN_PRICE_PATTERN.lastIndex = 0;
  return !hasForbiddenPrice;
}

// ── Intent Detection ──────────────────────────────────────────────────────────
const PRICING_KEYWORDS = ["price", "pricing", "cost", "how much", "plan", "plans", "subscription", "pay", "paid", "free", "premium", "core", "founding", "upgrade", "tier", "monthly", "annual", "$", "mobile", "trader", "lifetime"];
const SIGNUP_KEYWORDS = ["sign up", "signup", "register", "join", "get started", "create account", "start", "try", "access"];
const UPGRADE_KEYWORDS = ["upgrade", "premium", "founding", "paid plan", "unlock", "full access", "trader", "lifetime"];
const SECURITY_PATTERN = /\b([A-Z]{1,5})\b|bitcoin|ethereum|btc|eth|nvda|aapl|tsla|spy|qqq|meta|pltr|sol|tao/gi;
const PLAN_KEYWORDS: Record<string, string> = {
  free: "free",
  mobile: "core",
  core: "core",
  trader: "premium",
  premium: "premium",
  founding: "founding",
  lifetime: "lifetime",
};

export function detectIntent(message: string): IntentAnalysis {
  const lower = message.toLowerCase();

  const pricingIntent = PRICING_KEYWORDS.some(k => lower.includes(k));
  const signupIntent = SIGNUP_KEYWORDS.some(k => lower.includes(k));
  const upgradeIntent = UPGRADE_KEYWORDS.some(k => lower.includes(k));

  // Extract securities
  const secMatches = message.match(SECURITY_PATTERN) ?? [];
  const securitiesMentioned = Array.from(new Set(secMatches.map(s => s.toUpperCase()))).slice(0, 10);
  const hasSecurityMention = securitiesMentioned.length > 0;

  // Detect plan interest
  let planInterest: string | null = null;
  for (const [kw, plan] of Object.entries(PLAN_KEYWORDS)) {
    if (lower.includes(kw)) { planInterest = plan; break; }
  }

  // Determine primary intent
  let intent: ChatIntent = "general";
  if (pricingIntent) intent = "pricing";
  else if (upgradeIntent) intent = "upgrade";
  else if (signupIntent) intent = "signup";
  else if (hasSecurityMention) intent = "security_mention";
  else if (lower.includes("complaint") || lower.includes("broken") || lower.includes("not working")) intent = "complaint";
  else if (lower.includes("tradingview") || lower.includes("bloomberg") || lower.includes("competitor")) intent = "competitor";
  else if (lower.includes("feature") || lower.includes("how") || lower.includes("what")) intent = "feature_question";

  // Lead score computation
  let leadScore = 0;
  if (pricingIntent) leadScore += 30;
  if (signupIntent) leadScore += 25;
  if (upgradeIntent) leadScore += 35;
  if (hasSecurityMention) leadScore += 10;
  if (planInterest === "founding" || planInterest === "lifetime") leadScore += 20;
  else if (planInterest === "premium") leadScore += 15;
  else if (planInterest === "core") leadScore += 10;
  leadScore = Math.min(100, leadScore);

  return {
    intent,
    securitiesMentioned,
    planInterest,
    signupIntent,
    pricingIntent,
    leadScore,
  };
}

// ── Generate Bot Response ─────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

/**
 * Fallback pricing response used when LLM validation fails.
 * Always reads from CANONICAL_PRICING — never hardcoded.
 */
function buildFallbackPricingResponse(): string {
  const p = CANONICAL_PRICING;
  return `Here are the current FAULTLINE plans:

• **${p.free.name}** — ${p.free.priceLabel}: ${p.free.description}
• **${p.core.name}** — ${p.core.priceLabel}/month: ${p.core.description}
• **${p.premium.name}** — ${p.premium.priceLabel}/month: ${p.premium.description}
• **${p.founding.name}** — ${p.founding.priceLabel}: ${p.founding.description}
• **${p.lifetime.name}** — ${p.lifetime.priceLabel}: ${p.lifetime.description}

Visit https://getfaultline.live to get started. Remember: FAULTLINE provides market intelligence and risk analysis, not personalized financial advice.`;
}

export interface LiveMarketContext {
  regimeLabel?: string;
  pressureScore?: number;
  pressureLevel?: string;
  crashProbability?: number;
  bullProbability?: number;
  currentPage?: string;
  // BTC cycle state
  btcCyclePhase?: string;
  btcCycleConfidence?: number;
  btcAccumulationAnalysis?: {
    directAnswer: string;
    confidenceLabel: string;
    keyEvidence: string[];
    bullCycleConfirmation: string[];
    invalidationSignals: string[];
    tradingBias: string;
  };
  // Cross-market regime data
  stockMarketRegime?: string;
  stockRiskLevel?: string;
  cryptoMarketRegime?: string;
  cryptoRiskLevel?: string;
  alignmentStatus?: string;
  alignmentScore?: number;
}

/**
 * Build a concise live-market context block to prepend to the system prompt.
 * This gives the LLM awareness of current conditions without overwhelming it.
 */
function buildLiveContextBlock(ctx: LiveMarketContext): string {
  const parts: string[] = [];
  if (ctx.regimeLabel) parts.push(`Current Market Regime: ${ctx.regimeLabel}`);
  if (ctx.pressureScore !== undefined) parts.push(`FAULTLINE Pressure Index: ${Math.round(ctx.pressureScore)}/100 (${ctx.pressureLevel ?? 'unknown'})`);
  if (ctx.crashProbability !== undefined) parts.push(`Crash Probability: ${Math.round(ctx.crashProbability)}%`);
  if (ctx.bullProbability !== undefined) parts.push(`Bull Continuation Probability: ${Math.round(ctx.bullProbability)}%`);
  if (ctx.currentPage) parts.push(`User is currently on: ${ctx.currentPage}`);

  // BTC cycle phase context
  if (ctx.btcCyclePhase) {
    parts.push(`Bitcoin Market Cycle Phase: ${ctx.btcCyclePhase} (${ctx.btcCycleConfidence ?? 0}% confidence)`);
  }

  // Cross-market regime context
  if (ctx.stockMarketRegime) {
    parts.push(`US Stock Market Regime: ${ctx.stockMarketRegime} (Risk: ${ctx.stockRiskLevel ?? 'unknown'})`);
  }
  if (ctx.cryptoMarketRegime) {
    parts.push(`Crypto Market Regime: ${ctx.cryptoMarketRegime} (Risk: ${ctx.cryptoRiskLevel ?? 'unknown'})`);
  }
  if (ctx.alignmentStatus) {
    parts.push(`Cross-Market Alignment: ${ctx.alignmentStatus} (Score: ${ctx.alignmentScore ?? 0}/100)`);
  }

  if (parts.length === 0) return '';

  let block = `\n\n## Live Market Context (as of right now — use this to give relevant, timely answers)\n${parts.join('\n')}\n\nWhen the user asks about current market conditions, risk levels, or what the platform is showing, reference the above data naturally.`;

  // If BTC is in accumulation phase, inject the full structured intelligence block
  if (ctx.btcCyclePhase === 'Bear Market → Accumulation Phase' && ctx.btcAccumulationAnalysis) {
    const a = ctx.btcAccumulationAnalysis;
    block += `\n\n## Bitcoin Cycle Intelligence — CRITICAL INSTRUCTIONS FOR BTC QUESTIONS
When any user asks about Bitcoin, BTC, or crypto market cycle, you MUST follow this exact response structure:

**STEP 1 — Direct Answer First (always lead with this):**
"${a.directAnswer}"

**STEP 2 — Confidence:** ${a.confidenceLabel} (${ctx.btcCycleConfidence ?? 0}%)

**STEP 3 — Key Evidence (cite 3–5 of these):**
${a.keyEvidence.map(e => `- ${e}`).join('\n')}

**STEP 4 — What would confirm a new bull cycle:**
${a.bullCycleConfirmation.map(c => `- ${c}`).join('\n')}

**STEP 5 — What would invalidate the accumulation thesis:**
${a.invalidationSignals.map(s => `- ${s}`).join('\n')}

**STEP 6 — Actionable Trading Bias:**
${a.tradingBias}

IMPORTANT: Never label BTC as simply "bull" or "bear" when in this phase. Always use the full label: "Bear Market → Accumulation Phase". Explain that a new bull cycle is NOT confirmed until price breaks major resistance with strong volume, improving liquidity, and sustained risk-on confirmation.`;
  }

  return block;
}

export async function generateBotResponse(
  history: ChatMessage[],
  newUserMessage: string,
  liveContext?: LiveMarketContext,
): Promise<string> {
  // Build system prompt fresh each time — pricing is always injected from canonical source
  const basePrompt = buildSystemPrompt();
  const systemPrompt = liveContext ? basePrompt + buildLiveContextBlock(liveContext) : basePrompt;

  // Build message array for LLM
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history (last 10 turns to stay within context)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add the new user message
  messages.push({ role: "user", content: newUserMessage });

  try {
    const response = await invokeLLM({ messages });
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      const trimmed = content.trim();

      // ── Price Validation ──────────────────────────────────────────────────
      // If the response contains any forbidden/legacy price, regenerate once
      // with an explicit correction instruction, then fall back to canonical response.
      if (!validatePricing(trimmed)) {
        console.warn("[ChatbotEngine] Response contained forbidden pricing — regenerating with correction prompt");

        const correctionMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
          ...messages.slice(1),
          {
            role: "system",
            content: `CORRECTION REQUIRED: Your previous response contained incorrect pricing. You MUST use ONLY these prices: Free=$0, Mobile=${CANONICAL_PRICING.core.priceLabel}/mo, Trader=${CANONICAL_PRICING.premium.priceLabel}/mo, Founding Member=${CANONICAL_PRICING.founding.priceLabel}, Lifetime=${CANONICAL_PRICING.lifetime.priceLabel}. Please restate your answer using only these prices.`,
          },
        ];

        try {
          const corrected = await invokeLLM({ messages: correctionMessages });
          const correctedContent = corrected?.choices?.[0]?.message?.content;
          if (typeof correctedContent === "string" && correctedContent.trim() && validatePricing(correctedContent.trim())) {
            return correctedContent.trim();
          }
        } catch {
          // Fall through to canonical fallback
        }

        // Final fallback: return canonical pricing response directly
        return buildFallbackPricingResponse();
      }

      return trimmed;
    }
    return "I'm having trouble responding right now. Please try again in a moment, or email us at jt@getfaultline.live.";
  } catch (err) {
    console.error("[ChatbotEngine] LLM error:", err);
    return "I'm experiencing a temporary issue. Please try again shortly, or reach us at jt@getfaultline.live.";
  }
}

// ── Lead Score Aggregator ─────────────────────────────────────────────────────
/**
 * Recompute the aggregate lead score across all messages in a session.
 * Takes the max of all individual message scores + bonuses for multi-signal sessions.
 */
export function aggregateLeadScore(analyses: IntentAnalysis[]): number {
  if (analyses.length === 0) return 0;
  const maxScore = Math.max(...analyses.map(a => a.leadScore));
  const hasPricing = analyses.some(a => a.pricingIntent);
  const hasSignup = analyses.some(a => a.signupIntent);
  const hasUpgrade = analyses.some(a => a.intent === "upgrade");
  let bonus = 0;
  if (hasPricing && hasSignup) bonus += 15;
  if (hasUpgrade) bonus += 10;
  return Math.min(100, maxScore + bonus);
}
