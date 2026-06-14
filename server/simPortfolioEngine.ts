// ============================================================
// FAULTLINE — Simulated Portfolio Engine
// server/simPortfolioEngine.ts
//
// Drives the $10K → $1M simulated portfolio.
// Every trade decision is documented with 9 rationale dimensions:
//   1. FAULTLINE Pressure Score + Regime
//   2. Domain Scores (credit/AI/treasury/recession/liquidity)
//   3. Technical Indicators (RSI, MACD, SMA crossover)
//   4. Volume Confirmation
//   5. Asymmetry Ratio (upside/downside)
//   6. Catalyst (why NOW)
//   7. Risk Factors
//   8. Invalidation Condition
//   9. Position Sizing Rationale
// ============================================================

import { calculateFaultlinePressure, FaultlinePressureOutput } from "./pressure/engine";
import { getQuote, YahooQuote } from "./yahooProxy";
import { computeTradingSignal, TradingSignalResult, TradingSignalsInput } from "./tradingSignals";
import { invokeLLM } from "./_core/llm";
import { log } from "./logger";

const CG_BASE = "https://api.coingecko.com/api/v3";

// ── Types ─────────────────────────────────────────────────────

export interface SimTradeRationale {
  // Dimension 1: FAULTLINE Pressure
  pressureScore: number;
  pressureRegime: string;
  pressureLevel: string;
  pressureNarrative: string;

  // Dimension 2: Domain Scores
  domainScores: {
    credit: number;
    aiBubble: number;
    treasury: number;
    recession: number;
    liquidity: number;
    volatility: number;
  };
  domainNarrative: string;

  // Dimension 3: Technical Indicators
  rsi: number;
  rsiLabel: string;
  macdSignal: string;
  smaSignal: string;
  trend: string;
  technicalNarrative: string;

  // Dimension 4: Volume Confirmation
  volumeSignal: string;
  volumeNarrative: string;

  // Dimension 5: Asymmetry
  asymmetryRatio: number;
  upsideTarget: number;
  downsideRisk: number;
  upsidePct: number;
  downsidePct: number;
  asymmetryNarrative: string;

  // Dimension 6: Catalyst
  catalyst: string;

  // Dimension 7: Risk Factors
  riskFactors: string[];

  // Dimension 8: Invalidation
  invalidation: string;

  // Dimension 9: Position Sizing
  positionSizePct: number;       // % of account allocated
  positionSizeRationale: string;

  // AI-generated full narrative
  fullNarrative: string;         // multi-paragraph AI explanation
  actionSummary: string;         // 1-sentence summary for trade log
}

export interface SimPositionDecision {
  ticker: string;
  name: string;
  assetType: "stock" | "crypto";
  action: "BUY" | "SELL" | "HOLD" | "WATCH";
  price: number;
  quantity: number;
  totalValue: number;
  rationale: SimTradeRationale;
  signal: string;
  confidence: number;
}

export interface CryptoQuote {
  ticker: string;       // e.g. "BTC"
  coinId: string;       // CoinGecko ID
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
}

// ── Candidate tickers ─────────────────────────────────────────

export const STOCK_CANDIDATES = [
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary" },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Communication Services" },
  { ticker: "PLTR", name: "Palantir Technologies", sector: "Technology" },
  { ticker: "AMD",  name: "Advanced Micro Devices", sector: "Technology" },
  { ticker: "MSTR", name: "MicroStrategy Inc.", sector: "Technology" },
  { ticker: "COIN", name: "Coinbase Global Inc.", sector: "Financials" },
  { ticker: "SMCI", name: "Super Micro Computer", sector: "Technology" },
  { ticker: "IONQ", name: "IonQ Inc.", sector: "Technology" },
  { ticker: "RKLB", name: "Rocket Lab USA", sector: "Industrials" },
  { ticker: "SOUN", name: "SoundHound AI", sector: "Technology" },
  { ticker: "RGTI", name: "Rigetti Computing", sector: "Technology" },
  { ticker: "QUBT", name: "Quantum Computing Inc.", sector: "Technology" },
  { ticker: "LUNR", name: "Intuitive Machines", sector: "Industrials" },
  { ticker: "ACHR", name: "Archer Aviation", sector: "Industrials" },
];

export const CRYPTO_CANDIDATES = [
  { ticker: "BTC",  coinId: "bitcoin",       name: "Bitcoin" },
  { ticker: "ETH",  coinId: "ethereum",      name: "Ethereum" },
  { ticker: "SOL",  coinId: "solana",        name: "Solana" },
  { ticker: "AVAX", coinId: "avalanche-2",   name: "Avalanche" },
  { ticker: "LINK", coinId: "chainlink",     name: "Chainlink" },
  { ticker: "ARB",  coinId: "arbitrum",      name: "Arbitrum" },
  { ticker: "INJ",  coinId: "injective-protocol", name: "Injective" },
];

// ── CoinGecko fetch ───────────────────────────────────────────

async function fetchCryptoQuotes(coinIds: string[], apiKey?: string): Promise<Record<string, {
  usd?: number; usd_24h_change?: number; usd_24h_vol?: number;
  usd_market_cap?: number; usd_24h_high?: number; usd_24h_low?: number;
}>> {
  const ids = coinIds.join(",");
  const url = `${CG_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    return res.json() as Promise<Record<string, { usd?: number; usd_24h_change?: number; usd_24h_vol?: number; usd_market_cap?: number }>>;
  } catch (err) {
    log.warn("[SimPortfolio] CoinGecko fetch failed", { err: err as Error });
    return {};
  }
}

// ── Domain score extractor ────────────────────────────────────

function extractDomainScores(pressure: FaultlinePressureOutput) {
  const find = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 50;
  return {
    credit:    find("credit-stress"),
    aiBubble:  find("ai-bubble"),
    treasury:  find("treasury-yield"),
    recession: find("recession-risk"),
    liquidity: find("liquidity-stress"),
    volatility: find("volatility-regime"),
  };
}

// ── Position sizing logic ─────────────────────────────────────

function calcPositionSize(
  pressure: FaultlinePressureOutput,
  conviction: "HIGH" | "MODERATE" | "SPECULATIVE",
  asymmetryRatio: number,
): { pct: number; rationale: string } {
  const p = pressure.overallPressure;

  // Base sizing by conviction
  let base = conviction === "HIGH" ? 0.25 : conviction === "MODERATE" ? 0.15 : 0.08;

  // Reduce in high-stress regimes
  if (p >= 65) base *= 0.5;
  else if (p >= 45) base *= 0.75;

  // Boost for very high asymmetry
  if (asymmetryRatio >= 5) base = Math.min(base * 1.2, 0.30);

  const pct = Math.round(base * 100);
  const rationale = `Position sized at ${pct}% of account capital. ` +
    `Conviction level: ${conviction}. ` +
    `FAULTLINE pressure at ${p}/100 (${pressure.regime}) — ` +
    (p >= 65 ? "elevated risk environment demands reduced exposure to preserve capital." :
     p >= 45 ? "moderate stress warrants conservative sizing." :
     "low-stress regime supports standard position sizing.") +
    (asymmetryRatio >= 5 ? ` Asymmetry ratio of ${asymmetryRatio}:1 justifies slightly larger allocation.` : "");
  return { pct, rationale };
}

// ── Asymmetry calculator ──────────────────────────────────────

function calcAsymmetry(
  price: number,
  signal: TradingSignalResult,
  changePercent: number,
): { ratio: number; upsideTarget: number; downsideRisk: number; upsidePct: number; downsidePct: number } {
  const support = signal.priceLevels.support;
  const resistance = signal.priceLevels.resistance;
  const stop = signal.priceLevels.stopLoss ?? (price * 0.92);

  const upsidePct  = resistance > price ? ((resistance - price) / price) * 100 : 12;
  const downsidePct = price > stop ? ((price - stop) / price) * 100 : 8;
  const ratio = downsidePct > 0 ? Math.round((upsidePct / downsidePct) * 10) / 10 : 1.5;

  return {
    ratio,
    upsideTarget: Math.round(resistance * 100) / 100,
    downsideRisk: Math.round(stop * 100) / 100,
    upsidePct: Math.round(upsidePct * 10) / 10,
    downsidePct: Math.round(downsidePct * 10) / 10,
  };
}

// ── LLM full narrative generator ─────────────────────────────

async function generateFullNarrative(
  action: "BUY" | "SELL" | "HOLD",
  ticker: string,
  name: string,
  assetType: "stock" | "crypto",
  price: number,
  changePercent: number,
  pressure: FaultlinePressureOutput,
  domains: ReturnType<typeof extractDomainScores>,
  signal: TradingSignalResult,
  asym: ReturnType<typeof calcAsymmetry>,
  sizing: ReturnType<typeof calcPositionSize>,
): Promise<{ fullNarrative: string; catalyst: string; riskFactors: string[]; invalidation: string; actionSummary: string }> {
  const domainStr = Object.entries(domains)
    .map(([k, v]) => `${k}: ${v}/100`)
    .join(", ");

  const prompt = `You are FAULTLINE's portfolio intelligence engine. Generate a comprehensive trade rationale for this ${action} decision.

TRADE: ${action} ${ticker} (${name}) — ${assetType.toUpperCase()}
Current Price: $${price.toFixed(2)} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today)

FAULTLINE MACRO CONTEXT:
- Pressure Index: ${pressure.overallPressure}/100
- Regime: ${pressure.regime} (${pressure.level})
- Top Alert: ${pressure.alerts[0]?.title ?? "None"}
- Historical Analog: ${pressure.topAnalog.label} (${pressure.topAnalog.similarity}% similarity)

DOMAIN SCORES (higher = more stress):
${domainStr}

TECHNICAL ANALYSIS:
- RSI: ${signal.technicals.rsiEstimate.toFixed(1)} (${signal.technicals.rsiLabel})
- MACD: ${signal.technicals.macd?.signal ?? "Neutral"}
- SMA: ${signal.technicals.smaSignal}
- Trend: ${signal.technicals.trend}
- Volume: ${signal.technicals.volumeSignal}
- Signal Confidence: ${signal.confidence}/100
- Regime Alignment: ${signal.regimeAlignment}

ASYMMETRY:
- Upside Target: $${asym.upsideTarget} (+${asym.upsidePct}%)
- Downside Risk: $${asym.downsideRisk} (-${asym.downsidePct}%)
- Asymmetry Ratio: ${asym.ratio}:1

POSITION SIZING: ${sizing.pct}% of account

Respond with a JSON object with these exact fields:
{
  "fullNarrative": "3-4 paragraph detailed explanation of why this ${action} decision was made, referencing specific FAULTLINE readings, technical levels, and macro context. Be specific and analytical — this is the permanent record proving the model works.",
  "catalyst": "1-2 sentence specific catalyst or trigger for this trade right now",
  "riskFactors": ["risk 1", "risk 2", "risk 3"],
  "invalidation": "1 sentence describing exactly what would invalidate this thesis and trigger a reversal",
  "actionSummary": "1 crisp sentence for the trade log (e.g. 'Bought NVDA at $890 — AI infrastructure demand accelerating, FAULTLINE pressure at 28/100 supports risk-on positioning')"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's portfolio intelligence engine. Generate precise, data-driven trade rationale. Always reference specific numbers from the provided data." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "trade_rationale",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fullNarrative: { type: "string" },
              catalyst:      { type: "string" },
              riskFactors:   { type: "array", items: { type: "string" } },
              invalidation:  { type: "string" },
              actionSummary: { type: "string" },
            },
            required: ["fullNarrative", "catalyst", "riskFactors", "invalidation", "actionSummary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content as string;
    const parsed = JSON.parse(content);
    return {
      fullNarrative: parsed.fullNarrative ?? "",
      catalyst:      parsed.catalyst ?? "",
      riskFactors:   parsed.riskFactors ?? [],
      invalidation:  parsed.invalidation ?? "",
      actionSummary: parsed.actionSummary ?? `${action} ${ticker} at $${price.toFixed(2)}`,
    };
  } catch (err) {
    log.warn("[SimPortfolio] LLM rationale generation failed", { err: err as Error });
    return {
      fullNarrative: `${action} ${ticker} at $${price.toFixed(2)}. FAULTLINE pressure: ${pressure.overallPressure}/100 (${pressure.regime}). RSI: ${signal.technicals.rsiEstimate.toFixed(1)}, MACD: ${signal.technicals.macd?.signal ?? "N/A"}, Asymmetry: ${asym.ratio}:1.`,
      catalyst: `${signal.technicals.trend} momentum with ${signal.technicals.volumeSignal.toLowerCase()} volume confirmation.`,
      riskFactors: ["Market regime shift", "Technical breakdown below support", "Macro deterioration"],
      invalidation: `Price closes below $${asym.downsideRisk} or FAULTLINE pressure exceeds 65/100.`,
      actionSummary: `${action} ${ticker} at $${price.toFixed(2)} — ${signal.rationale}`,
    };
  }
}

// ── Build full rationale object ───────────────────────────────

async function buildRationale(
  action: "BUY" | "SELL" | "HOLD",
  ticker: string,
  name: string,
  assetType: "stock" | "crypto",
  price: number,
  changePercent: number,
  pressure: FaultlinePressureOutput,
  signal: TradingSignalResult,
  conviction: "HIGH" | "MODERATE" | "SPECULATIVE",
): Promise<SimTradeRationale> {
  const domains = extractDomainScores(pressure);
  const asym = calcAsymmetry(price, signal, changePercent);
  const sizing = calcPositionSize(pressure, conviction, asym.ratio);
  const llm = await generateFullNarrative(action, ticker, name, assetType, price, changePercent, pressure, domains, signal, asym, sizing);

  // Domain narrative
  const topDomain = Object.entries(domains).sort((a, b) => b[1] - a[1])[0];
  const domainNarrative = `The highest domain stress is ${topDomain[0]} at ${topDomain[1]}/100. ` +
    `Credit stress (${domains.credit}/100) and liquidity (${domains.liquidity}/100) are the primary macro risk factors. ` +
    `AI bubble risk (${domains.aiBubble}/100) ${domains.aiBubble >= 60 ? "is elevated — tech concentration risk is real" : "remains contained"}.`;

  // Technical narrative
  const techNarrative = `RSI at ${signal.technicals.rsiEstimate.toFixed(1)} is ${signal.technicals.rsiLabel.toLowerCase()}. ` +
    `MACD histogram is ${signal.technicals.macd ? (signal.technicals.macd.histogram > 0 ? "positive (bullish momentum)" : "negative (bearish momentum)") : "unavailable"}. ` +
    `SMA alignment: ${signal.technicals.smaSignal}. Overall trend: ${signal.technicals.trend}.`;

  // Volume narrative
  const volNarrative = signal.technicals.volumeSignal === "Surge"
    ? "Volume is surging — institutional participation is confirming the move. This is a high-conviction signal."
    : signal.technicals.volumeSignal === "Low"
    ? "Volume is below average — the move lacks institutional confirmation. Treat with caution."
    : "Volume is at normal levels — no unusual institutional activity detected.";

  // Asymmetry narrative
  const asymNarrative = `Risk/reward asymmetry of ${asym.ratio}:1. ` +
    `Upside target: $${asym.upsideTarget} (+${asym.upsidePct}%). ` +
    `Downside stop: $${asym.downsideRisk} (-${asym.downsidePct}%). ` +
    (asym.ratio >= 3 ? "This is a favorable setup — reward significantly outweighs risk." :
     asym.ratio >= 2 ? "Acceptable asymmetry — risk is manageable relative to potential reward." :
     "Asymmetry is below ideal threshold — position size reduced accordingly.");

  return {
    pressureScore: pressure.overallPressure,
    pressureRegime: pressure.regime,
    pressureLevel: pressure.level,
    pressureNarrative: `FAULTLINE Pressure Index at ${pressure.overallPressure}/100 — regime classified as "${pressure.regime}". ` +
      `Closest historical analog: ${pressure.topAnalog.label} (${pressure.topAnalog.similarity}% similarity). ` +
      (pressure.overallPressure >= 65 ? "Elevated systemic risk warrants defensive positioning and reduced exposure." :
       pressure.overallPressure >= 45 ? "Moderate stress — selective risk-taking is appropriate with tight stops." :
       "Low stress environment supports risk-on positioning with standard sizing."),
    domainScores: domains,
    domainNarrative,
    rsi: signal.technicals.rsiEstimate,
    rsiLabel: signal.technicals.rsiLabel,
    macdSignal: signal.technicals.macd?.signal ?? "Neutral",
    smaSignal: signal.technicals.smaSignal,
    trend: signal.technicals.trend,
    technicalNarrative: techNarrative,
    volumeSignal: signal.technicals.volumeSignal,
    volumeNarrative: volNarrative,
    asymmetryRatio: asym.ratio,
    upsideTarget: asym.upsideTarget,
    downsideRisk: asym.downsideRisk,
    upsidePct: asym.upsidePct,
    downsidePct: asym.downsidePct,
    asymmetryNarrative: asymNarrative,
    catalyst: llm.catalyst,
    riskFactors: llm.riskFactors,
    invalidation: llm.invalidation,
    positionSizePct: sizing.pct,
    positionSizeRationale: sizing.rationale,
    fullNarrative: llm.fullNarrative,
    actionSummary: llm.actionSummary,
  };
}

// ── Stock decision engine ─────────────────────────────────────

export async function evaluateStockCandidate(
  ticker: string,
  name: string,
  pressure: FaultlinePressureOutput,
): Promise<SimPositionDecision | null> {
  try {
    const quote = await getQuote(ticker);
    if (!quote.price || quote.source === "error") return null;

    const signalInput: TradingSignalsInput = {
      ticker,
      price: quote.price,
      open: quote.open ?? quote.price,
      high: quote.high ?? quote.price * 1.02,
      low: quote.low ?? quote.price * 0.98,
      changePercent: quote.changePercent ?? 0,
      volumeMillions: (quote.volume ?? 0) / 1e6,
      avgVolume: (quote.volume ?? 0) / 1e6,
      sparkline: [],
      relativeStrength: 50,
    };

    const regime = { label: pressure.regime, score: pressure.overallPressure / 10 };
    const signal = computeTradingSignal(signalInput, regime);

    // Determine action based on signal + pressure
    let action: "BUY" | "SELL" | "HOLD" | "WATCH" = signal.action;
    let conviction: "HIGH" | "MODERATE" | "SPECULATIVE" = "MODERATE";

    if (signal.confidence >= 75 && signal.regimeAlignment === "Aligned") conviction = "HIGH";
    else if (signal.confidence < 45 || signal.regimeAlignment === "Counter-Trend") conviction = "SPECULATIVE";

    // In high-stress regimes, be more conservative
    if (pressure.overallPressure >= 65 && action === "BUY") action = "WATCH";

    if (action === "WATCH") return null; // Not actionable

    const rationale = await buildRationale(
      action as "BUY" | "SELL" | "HOLD",
      ticker, name, "stock",
      quote.price, quote.changePercent ?? 0,
      pressure, signal, conviction,
    );

    const accountValue = 10000; // $10K stocks account
    const positionValue = accountValue * (rationale.positionSizePct / 100);
    const quantity = Math.floor(positionValue / quote.price);

    return {
      ticker,
      name,
      assetType: "stock",
      action: action as "BUY" | "SELL" | "HOLD",
      price: quote.price,
      quantity,
      totalValue: quantity * quote.price,
      rationale,
      signal: signal.action,
      confidence: signal.confidence,
    };
  } catch (err) {
    log.warn(`[SimPortfolio] Failed to evaluate stock ${ticker}`, { err: err as Error });
    return null;
  }
}

// ── Crypto decision engine ────────────────────────────────────

export async function evaluateCryptoCandidate(
  ticker: string,
  coinId: string,
  name: string,
  cryptoQuote: CryptoQuote,
  pressure: FaultlinePressureOutput,
): Promise<SimPositionDecision | null> {
  try {
    const price = cryptoQuote.price;
    const changePercent = cryptoQuote.change24h;

    // Build a synthetic signal input from crypto data
    const signalInput: TradingSignalsInput = {
      ticker,
      price,
      open: price / (1 + changePercent / 100),
      high: cryptoQuote.high24h,
      low: cryptoQuote.low24h,
      changePercent,
      volumeMillions: cryptoQuote.volume24h / 1e6,
      avgVolume: cryptoQuote.volume24h / 1e6,
      sparkline: [],
      relativeStrength: 50,
    };

    const regime = { label: pressure.regime, score: pressure.overallPressure / 10 };
    const signal = computeTradingSignal(signalInput, regime);

    let action: "BUY" | "SELL" | "HOLD" | "WATCH" = signal.action;
    let conviction: "HIGH" | "MODERATE" | "SPECULATIVE" = "MODERATE";

    if (signal.confidence >= 75 && signal.regimeAlignment === "Aligned") conviction = "HIGH";
    else if (signal.confidence < 45 || signal.regimeAlignment === "Counter-Trend") conviction = "SPECULATIVE";

    // Crypto is higher risk — be more conservative in elevated regimes
    if (pressure.overallPressure >= 55 && action === "BUY") action = "WATCH";

    if (action === "WATCH") return null;

    const rationale = await buildRationale(
      action as "BUY" | "SELL" | "HOLD",
      ticker, name, "crypto",
      price, changePercent,
      pressure, signal, conviction,
    );

    const accountValue = 10000; // $10K crypto account
    const positionValue = accountValue * (rationale.positionSizePct / 100);
    const quantity = positionValue / price;

    return {
      ticker,
      name,
      assetType: "crypto",
      action: action as "BUY" | "SELL" | "HOLD",
      price,
      quantity: Math.round(quantity * 1e6) / 1e6,
      totalValue: quantity * price,
      rationale,
      signal: signal.action,
      confidence: signal.confidence,
    };
  } catch (err) {
    log.warn(`[SimPortfolio] Failed to evaluate crypto ${ticker}`, { err: err as Error });
    return null;
  }
}

// ── Portfolio valuation ───────────────────────────────────────

export interface SimPortfolioValuation {
  stocksValue: number;
  cryptoValue: number;
  totalValue: number;
  stocksCash: number;
  cryptoCash: number;
  positions: Array<{
    ticker: string;
    name: string;
    assetType: "stock" | "crypto";
    quantity: number;
    entryPrice: number;
    currentPrice: number | null;
    currentValue: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    entrySignal: string | null;
  }>;
}

export async function valuateSimPortfolio(
  openPositions: Array<{
    ticker: string;
    name: string | null;
    assetType: "stock" | "crypto";
    quantity: string;
    entryPrice: string;
    entrySignal: string | null;
    accountId: number;
  }>,
  stocksCash: number,
  cryptoCash: number,
): Promise<SimPortfolioValuation> {
  const stockTickers = openPositions.filter(p => p.assetType === "stock").map(p => p.ticker);
  const cryptoPositions = openPositions.filter(p => p.assetType === "crypto");

  // Fetch stock quotes
  const stockQuotes: Record<string, number | null> = {};
  await Promise.all(stockTickers.map(async (t) => {
    try {
      const q = await getQuote(t);
      stockQuotes[t] = q.price;
    } catch {
      stockQuotes[t] = null;
    }
  }));

  // Fetch crypto quotes
  const cryptoIds = cryptoPositions.map(p => {
    const candidate = CRYPTO_CANDIDATES.find(c => c.ticker === p.ticker);
    return candidate?.coinId ?? p.ticker.toLowerCase();
  });

  let cryptoPrices: Record<string, number | null> = {};
  if (cryptoIds.length > 0) {
    const apiKey = process.env.COINGECKO_API_KEY;
    const raw = await fetchCryptoQuotes(cryptoIds, apiKey);
    for (const pos of cryptoPositions) {
      const candidate = CRYPTO_CANDIDATES.find(c => c.ticker === pos.ticker);
      const coinId = candidate?.coinId ?? pos.ticker.toLowerCase();
      cryptoPrices[pos.ticker] = raw[coinId]?.usd ?? null;
    }
  }

  // Build position valuations
  const positions = openPositions.map(pos => {
    const qty = parseFloat(pos.quantity);
    const entry = parseFloat(pos.entryPrice);
    const current = pos.assetType === "stock" ? stockQuotes[pos.ticker] : cryptoPrices[pos.ticker];
    const currentValue = current !== null && current !== undefined ? qty * current : qty * entry;
    const unrealizedPnl = current !== null && current !== undefined ? (current - entry) * qty : 0;
    const unrealizedPnlPct = entry > 0 ? ((current ?? entry) - entry) / entry * 100 : 0;

    return {
      ticker: pos.ticker,
      name: pos.name ?? pos.ticker,
      assetType: pos.assetType,
      quantity: qty,
      entryPrice: entry,
      currentPrice: current ?? null,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPct: Math.round(unrealizedPnlPct * 100) / 100,
      entrySignal: pos.entrySignal,
    };
  });

  const stockPositionsValue = positions
    .filter(p => p.assetType === "stock")
    .reduce((sum, p) => sum + p.currentValue, 0);
  const cryptoPositionsValue = positions
    .filter(p => p.assetType === "crypto")
    .reduce((sum, p) => sum + p.currentValue, 0);

  return {
    stocksValue: stocksCash + stockPositionsValue,
    cryptoValue: cryptoCash + cryptoPositionsValue,
    totalValue: stocksCash + cryptoCash + stockPositionsValue + cryptoPositionsValue,
    stocksCash,
    cryptoCash,
    positions,
  };
}

// ── Run daily evaluation ──────────────────────────────────────

export async function runDailyEvaluation(): Promise<{
  pressure: FaultlinePressureOutput;
  stockDecisions: SimPositionDecision[];
  cryptoDecisions: SimPositionDecision[];
}> {
  const pressure = await calculateFaultlinePressure();

  // Evaluate stock candidates (limit to avoid rate limits)
  const stockResults = await Promise.allSettled(
    STOCK_CANDIDATES.slice(0, 8).map(s => evaluateStockCandidate(s.ticker, s.name, pressure))
  );
  const stockDecisions = stockResults
    .filter((r): r is PromiseFulfilledResult<SimPositionDecision | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((d): d is SimPositionDecision => d !== null);

  // Fetch crypto quotes in batch
  const apiKey = process.env.COINGECKO_API_KEY;
  const coinIds = CRYPTO_CANDIDATES.map(c => c.coinId);
  const cryptoRaw = await fetchCryptoQuotes(coinIds, apiKey);

  const cryptoDecisions: SimPositionDecision[] = [];
  for (const candidate of CRYPTO_CANDIDATES.slice(0, 5)) {
    const raw = cryptoRaw[candidate.coinId];
    if (!raw?.usd) continue;
    const quote: CryptoQuote = {
      ticker: candidate.ticker,
      coinId: candidate.coinId,
      name: candidate.name,
      price: raw.usd,
      change24h: raw.usd_24h_change ?? 0,
      volume24h: raw.usd_24h_vol ?? 0,
      marketCap: raw.usd_market_cap ?? 0,
      high24h: raw.usd * 1.02,
      low24h: raw.usd * 0.98,
    };
    const decision = await evaluateCryptoCandidate(candidate.ticker, candidate.coinId, candidate.name, quote, pressure);
    if (decision) cryptoDecisions.push(decision);
  }

  return { pressure, stockDecisions, cryptoDecisions };
}
