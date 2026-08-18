import type { AshaPageContext } from "./ashaContext";
import type { CanonicalMarketState } from "./marketState";

export type AshaQuestionScope = "MARKET" | "TICKER" | "MARKET_TICKER_RELATIONSHIP";
export type AshaProbabilityAvailability = "CALIBRATED" | "NOT_CALIBRATED";

export interface AshaQuestionAnalysis {
  analysisScope: AshaQuestionScope;
  eventDefinition: string;
  timeHorizon: string | null;
  probability: number | null;
  complementaryProbability: number | null;
  confidence: number;
  riskLevel: string;
  evidence: string[];
  bullishDrivers: string[];
  bearishDrivers: string[];
  historicalAnalogs: Array<{ label: string; similarity: number; interpretation: string }>;
  invalidationConditions: string[];
  escalationTriggers: string[];
  probabilityProvenance: {
    availability: AshaProbabilityAvailability;
    source: string;
    explanation: string;
  };
}

const TICKER_CONTEXT_KEY = /(ticker|symbol|company|asset|fundamental|technical|price|support|resistance|stop|target|catalyst|leap|position)/i;
const RELATIONSHIP_PATTERN = /\b(what happens? to|impact on|affect(?:s|ed)?|exposed|exposure|if (?:the )?market|if pressure|if systemic|relationship)\b/i;
const MARKET_PATTERN = /\b(market|broad[- ]market|s&p|spx|correction|drawdown|sell[- ]?off|pressure index|systemic|regime|liquidity|credit|breadth|volatility)\b/i;

function stringsFromContext(value: unknown, depth = 0): string[] {
  if (depth > 2 || value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(item => stringsFromContext(item, depth + 1));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(item => stringsFromContext(item, depth + 1));
  return [];
}

function tickerTokens(page: AshaPageContext): string[] {
  const additional = page.additionalContext ?? {};
  return Object.entries(additional)
    .filter(([key]) => TICKER_CONTEXT_KEY.test(key))
    .flatMap(([, value]) => stringsFromContext(value))
    .flatMap(value => value.split(/[^A-Za-z0-9.&-]+/))
    .map(value => value.trim())
    .filter(value => value.length >= 2 && value.length <= 32)
    .map(value => value.toLowerCase());
}

export function classifyAshaQuestionScope(question: string, page: AshaPageContext): AshaQuestionScope {
  const normalized = question.toLowerCase();
  const mentionsActiveTicker = tickerTokens(page).some(token => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(question));
  const hasTickerShape = /\b[A-Z]{1,5}\b/.test(question) && !MARKET_PATTERN.test(question);

  if ((mentionsActiveTicker || hasTickerShape) && (RELATIONSHIP_PATTERN.test(question) || MARKET_PATTERN.test(question))) {
    return "MARKET_TICKER_RELATIONSHIP";
  }
  if (mentionsActiveTicker || hasTickerShape) return "TICKER";
  return "MARKET";
}

export function restrictAshaPageContextForScope(page: AshaPageContext, scope: AshaQuestionScope): AshaPageContext {
  if (scope !== "MARKET") return page;
  const sanitizedAdditional = Object.fromEntries(
    Object.entries(page.additionalContext ?? {}).filter(([key]) => !TICKER_CONTEXT_KEY.test(key)),
  );

  return {
    ...page,
    additionalContext: Object.keys(sanitizedAdditional).length ? sanitizedAdditional : undefined,
  };
}

function eventDefinition(question: string): string {
  const normalized = question.toLowerCase();
  if (/\b(large|10%|10 percent)\b/.test(normalized) && /\b(correction|drawdown|decline|sell[- ]?off)\b/.test(normalized)) {
    return ">10% broad-market correction";
  }
  if (/pressure index/.test(normalized)) return "Pressure Index regime escalation";
  return "Current broad-market directional assessment";
}

function requestedHorizon(question: string): string | null {
  if (/\b6\s*(?:-|–|to)\s*8\s*weeks?\b/i.test(question)) return "6–8 weeks";
  return null;
}

function riskLevel(score: number): string {
  if (score >= 75) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}

export function buildAshaQuestionAnalysis(
  question: string,
  page: AshaPageContext,
  marketState: CanonicalMarketState,
): AshaQuestionAnalysis {
  const analysisScope = classifyAshaQuestionScope(question, page);
  const definition = eventDefinition(question);
  const timeHorizon = requestedHorizon(question);
  const isExactCorrectionEvent = definition === ">10% broad-market correction";
  const families = marketState.why?.evidenceFamilies ?? [];
  const bullishDrivers = families.filter(f => f.signal === "bullish" || f.signal === "recovering").map(f => `${f.name}: ${f.currentValue}`).slice(0, 4);
  const bearishDrivers = families.filter(f => f.signal === "bearish" || f.signal === "stressed").map(f => `${f.name}: ${f.currentValue}`).slice(0, 4);
  const historicalAnalogs = marketState.outlook.topAnalog
    ? [{
      label: marketState.outlook.topAnalog.label,
      similarity: marketState.outlook.topAnalog.similarity,
      interpretation: "Similarity measures current regime resemblance; it is not a forecast probability.",
    }]
    : [];

  // The canonical engine publishes broad bull/neutral/bear scenario weights and
  // 30–60 day regime transition rates. It does not publish a drawdown-calibrated
  // >10% correction probability for a 6–8 week window, so an exact percentage
  // must remain unavailable instead of being inferred from generated prose.
  const probability = isExactCorrectionEvent ? null : marketState.outlook.probabilities.bear;
  const availability: AshaProbabilityAvailability = probability === null ? "NOT_CALIBRATED" : "CALIBRATED";

  return {
    analysisScope,
    eventDefinition: definition,
    timeHorizon,
    probability,
    complementaryProbability: probability === null ? null : Math.max(0, 100 - probability),
    confidence: marketState.outlook.probabilities.confidence,
    riskLevel: riskLevel(marketState.now.pressureScore),
    evidence: [
      marketState.outlook?.probabilities?.evidenceBasis,
      marketState.outlook?.probabilities?.historicalBasis,
      ...(marketState.now?.topDrivers ?? []).slice(0, 3),
    ].filter(Boolean),
    bullishDrivers,
    bearishDrivers,
    historicalAnalogs,
    invalidationConditions: (marketState.outlook?.invalidationConditions ?? []).slice(0, 4),
    escalationTriggers: (marketState.outlook?.transitionProbabilities?.currentEvidence ?? []).slice(0, 4),
    probabilityProvenance: probability === null
      ? {
        availability,
        source: "Canonical FAULTLINE Probability Engine",
        explanation: "No calibrated >10% broad-market correction probability exists for the requested 6–8 week window; the system will not substitute a generic bear-scenario weight.",
      }
      : {
        availability,
        source: "Canonical FAULTLINE Probability Engine",
        explanation: `${marketState.outlook.probabilities.evidenceBasis} ${marketState.outlook.probabilities.historicalBasis}`,
      },
  };
}
