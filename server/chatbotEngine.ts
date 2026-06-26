/**
 * FAULTLINE AI Market Intelligence Concierge — Chatbot Engine
 *
 * Responsibilities:
 * - Build the LLM system prompt with full FAULTLINE product knowledge
 * - Detect user intent (pricing, signup, security mention, plan interest)
 * - Compute lead score (0–100) based on conversation signals
 * - Extract securities mentioned in messages
 * - Generate bot responses via invokeLLM
 */
import { invokeLLM } from "./_core/llm";

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

// ── FAULTLINE System Prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the FAULTLINE AI Market Intelligence Concierge — a knowledgeable, professional, and helpful assistant for the FAULTLINE platform. Your role is to help visitors understand FAULTLINE, answer their questions, and guide them toward the right plan.

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

## Pricing Plans
- **Free** — Dashboard overview, limited previews, basic regime reading
- **Core** — $9.99/month — Signals screener, full Pressure Index, Diagnostic AI (basic)
- **Premium** — $29.99/month — Everything in Core + DTI, Situation Room, Trade Journal, Crypto Signals, Symbol Intelligence, S.O.B. panel
- **Founding Access** — $299 one-time (limited spots) — Lifetime Premium access, founding member badge, early feature access, direct line to the team

## Key Talking Points
- FAULTLINE does NOT predict markets — it helps you navigate them
- Data sources: FRED (Federal Reserve), Polygon.io (live market data), CoinGecko (crypto), AI analysis via LLM
- Built for serious investors who want macro context, not noise
- No trading advice, no guarantees, no financial promises
- Disclaimer: FAULTLINE provides market intelligence and risk analysis, not personalized financial advice.

## Your Behavior Rules
1. Be concise, professional, and helpful. Use plain English — avoid jargon overload.
2. When a user asks about pricing, explain the plans clearly and suggest the best fit based on their use case.
3. When a user asks about a specific stock or crypto (e.g., NVDA, BTC, ETH), explain how FAULTLINE's Signals and Symbol Intelligence can help them analyze it — do NOT give price predictions or trading advice.
4. When a user expresses interest in signing up, provide the signup URL: https://getfaultline.live and encourage them.
5. When a user asks about a feature, explain it clearly and link it to a benefit.
6. Always end responses that involve financial topics with: "Remember: FAULTLINE provides market intelligence and risk analysis, not personalized financial advice."
7. If a user seems ready to sign up or wants to know the best plan, ask: "Want me to help you find the best FAULTLINE plan for your use case? If you share your email, I can send you a personalized recommendation."
8. Keep responses under 200 words unless the user asks for a detailed explanation.
9. Never make promises about returns, profits, or market outcomes.
10. If asked about competitors (Bloomberg Terminal, TradingView, etc.), acknowledge them respectfully and explain what makes FAULTLINE different: macro-first, regime-aware, built for navigation not prediction.

## Tone
Professional but approachable. Think: knowledgeable analyst who genuinely wants to help, not a sales bot.`;

// ── Intent Detection ──────────────────────────────────────────────────────────
const PRICING_KEYWORDS = ["price", "pricing", "cost", "how much", "plan", "plans", "subscription", "pay", "paid", "free", "premium", "core", "founding", "upgrade", "tier", "monthly", "annual", "$"];
const SIGNUP_KEYWORDS = ["sign up", "signup", "register", "join", "get started", "create account", "start", "try", "access"];
const UPGRADE_KEYWORDS = ["upgrade", "premium", "founding", "paid plan", "unlock", "full access"];
const SECURITY_PATTERN = /\b([A-Z]{1,5})\b|bitcoin|ethereum|btc|eth|nvda|aapl|tsla|spy|qqq|meta|pltr|sol|tao/gi;
const PLAN_KEYWORDS: Record<string, string> = {
  free: "free",
  core: "core",
  premium: "premium",
  founding: "founding",
  lifetime: "founding",
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
  if (planInterest === "founding") leadScore += 20;
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

export async function generateBotResponse(
  history: ChatMessage[],
  newUserMessage: string,
): Promise<string> {
  // Build message array for LLM
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
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
      return content.trim();
    }
    return "I'm having trouble responding right now. Please try again in a moment, or email us at tsilianidis@gmail.com.";
  } catch (err) {
    console.error("[ChatbotEngine] LLM error:", err);
    return "I'm experiencing a temporary issue. Please try again shortly, or reach us at tsilianidis@gmail.com.";
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
