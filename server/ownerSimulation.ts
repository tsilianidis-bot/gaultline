// ============================================================
// FAULTLINE — Owner Simulation Engine
// server/ownerSimulation.ts
//
// Private admin-only $100K → $1M virtual trading cockpit.
// Uses live FAULTLINE readings to surface ranked opportunities.
// All data is simulation/research only — NOT financial advice.
// ============================================================
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  ownerSimulationAccounts, ownerSimulationPositions, ownerSimulationTrades,
  ownerSimulationDailySnapshots, ownerSimulationObjectives,
  InsertOwnerSimulationAccount, InsertOwnerSimulationPosition,
  InsertOwnerSimulationTrade, InsertOwnerSimulationDailySnapshot,
  InsertOwnerSimulationObjective,
  OwnerSimulationAccount, OwnerSimulationPosition,
  OwnerSimulationTrade, OwnerSimulationObjective, OwnerSimulationDailySnapshot,
} from "../drizzle/schema";
import { calculateFaultlinePressure, FaultlinePressureOutput } from "./pressure/engine";
import { computeTradingSignal, TradingSignalsInput } from "./tradingSignals";
import { getQuote } from "./yahooProxy";
import { invokeLLM } from "./_core/llm";
import { log } from "./logger";

// ── Constants ─────────────────────────────────────────────────
const CG_BASE = "https://api.coingecko.com/api/v3";
const STARTING_CAPITAL = 100000;
const TARGET_VALUE = 1000000;

// ── Objective types ───────────────────────────────────────────
export const OBJECTIVE_TYPES = [
  { id: "short_swing",       label: "Short-Term Swing Trade",     description: "1–5 day momentum plays with tight stops" },
  { id: "long_position",     label: "Long-Term Position Build",   description: "2–12 month conviction holds" },
  { id: "crypto_momentum",   label: "Crypto Momentum Trade",      description: "Crypto rotation and momentum breakouts" },
  { id: "defensive",         label: "Defensive / Capital Preservation", description: "Protect capital in uncertain regimes" },
  { id: "ai_tech_momentum",  label: "AI / Tech Momentum",         description: "High-growth AI and tech sector exposure" },
  { id: "custom",            label: "Custom Objective",           description: "Define your own parameters" },
] as const;

export type ObjectiveType = typeof OBJECTIVE_TYPES[number]["id"];

// ── Opportunity types ─────────────────────────────────────────
export type OpportunityDirection = "LONG" | "AVOID" | "WATCH" | "TRIM" | "DEFENSIVE";
export type DataFreshness = "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE";

export interface TradeOpportunity {
  id: string;                    // unique key for this opportunity
  ticker: string;
  name: string;
  sector: string;
  assetType: "stock" | "crypto";
  direction: OpportunityDirection;
  // Price data
  currentPrice: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  dataFreshness: DataFreshness;
  // Trade levels
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  targetOne: number;
  targetTwo: number;
  // Risk metrics
  riskRewardRatio: number;
  suggestedPositionSizePct: number;   // % of account
  suggestedPositionSizeUsd: number;   // in dollars
  riskAmountUsd: number;              // max loss if stop hit
  // Scoring
  faultlineConfidence: number;        // 0–100
  compositeScore: number;             // 0–100 overall ranking score
  momentumScore: number;
  macroFit: number;
  // Objective fit
  objectiveFit: boolean;
  objectiveFitReason: string;
  // AI rationale
  whyNow: string;
  invalidation: string;
  keyRisks: string[];
  // Labels
  labels: string[];                   // e.g. ["AI Bubble Exposure", "Momentum Breakout"]
  // Meta
  fetchedAt: number;
}

// ── Stock candidates ──────────────────────────────────────────
const STOCK_UNIVERSE = [
  { ticker: "NVDA", name: "NVIDIA Corporation",       sector: "Technology" },
  { ticker: "TSLA", name: "Tesla Inc.",                sector: "Consumer Discretionary" },
  { ticker: "META", name: "Meta Platforms Inc.",       sector: "Communication Services" },
  { ticker: "PLTR", name: "Palantir Technologies",     sector: "Technology" },
  { ticker: "AMD",  name: "Advanced Micro Devices",    sector: "Technology" },
  { ticker: "MSTR", name: "MicroStrategy Inc.",        sector: "Technology" },
  { ticker: "COIN", name: "Coinbase Global Inc.",      sector: "Financials" },
  { ticker: "SMCI", name: "Super Micro Computer",      sector: "Technology" },
  { ticker: "IONQ", name: "IonQ Inc.",                 sector: "Technology" },
  { ticker: "RKLB", name: "Rocket Lab USA",            sector: "Industrials" },
  { ticker: "SOUN", name: "SoundHound AI",             sector: "Technology" },
  { ticker: "RGTI", name: "Rigetti Computing",         sector: "Technology" },
  { ticker: "QUBT", name: "Quantum Computing Inc.",    sector: "Technology" },
  { ticker: "LUNR", name: "Intuitive Machines",        sector: "Industrials" },
  { ticker: "ACHR", name: "Archer Aviation",           sector: "Industrials" },
  { ticker: "SPY",  name: "S&P 500 ETF",               sector: "ETF" },
  { ticker: "QQQ",  name: "Nasdaq 100 ETF",            sector: "ETF" },
  { ticker: "AAPL", name: "Apple Inc.",                sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corporation",     sector: "Technology" },
  { ticker: "AMZN", name: "Amazon.com Inc.",           sector: "Consumer Discretionary" },
];

const CRYPTO_UNIVERSE = [
  { ticker: "BTC",  coinId: "bitcoin",              name: "Bitcoin",     sector: "Layer 1" },
  { ticker: "ETH",  coinId: "ethereum",             name: "Ethereum",    sector: "Layer 1" },
  { ticker: "SOL",  coinId: "solana",               name: "Solana",      sector: "Layer 1" },
  { ticker: "AVAX", coinId: "avalanche-2",          name: "Avalanche",   sector: "Layer 1" },
  { ticker: "LINK", coinId: "chainlink",            name: "Chainlink",   sector: "Oracle" },
  { ticker: "ARB",  coinId: "arbitrum",             name: "Arbitrum",    sector: "Layer 2" },
  { ticker: "INJ",  coinId: "injective-protocol",  name: "Injective",   sector: "DeFi" },
];

// ── DB helpers ────────────────────────────────────────────────
export async function getOrCreateOwnerAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(ownerSimulationAccounts)
    .where(eq(ownerSimulationAccounts.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  // Create new account
  const today = new Date().toISOString().slice(0, 10);
  const result = await db.insert(ownerSimulationAccounts).values({
    userId,
    startingCapital: STARTING_CAPITAL.toString(),
    currentCash: STARTING_CAPITAL.toString(),
    currentValue: STARTING_CAPITAL.toString(),
    targetValue: TARGET_VALUE.toString(),
    startedAt: today,
  });
  const okPacket = result[0] as unknown as { insertId: number };
  const newRows = await db.select().from(ownerSimulationAccounts)
    .where(eq(ownerSimulationAccounts.id, okPacket.insertId)).limit(1);
  return newRows[0];
}

export async function getOwnerPositions(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ownerSimulationPositions)
    .where(and(eq(ownerSimulationPositions.accountId, accountId), eq(ownerSimulationPositions.status, "open")))
    .orderBy(desc(ownerSimulationPositions.openedAt));
}

export async function getOwnerTrades(accountId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ownerSimulationTrades)
    .where(eq(ownerSimulationTrades.accountId, accountId))
    .orderBy(desc(ownerSimulationTrades.createdAt))
    .limit(limit);
}

export async function getOwnerObjective(accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ownerSimulationObjectives)
    .where(eq(ownerSimulationObjectives.accountId, accountId))
    .orderBy(desc(ownerSimulationObjectives.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function setOwnerObjective(data: Omit<InsertOwnerSimulationObjective, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ownerSimulationObjectives).values(data);
  const okPacket = result[0] as unknown as { insertId: number };
  return okPacket.insertId;
}

export async function getDailySnapshots(accountId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ownerSimulationDailySnapshots)
    .where(eq(ownerSimulationDailySnapshots.accountId, accountId))
    .orderBy(desc(ownerSimulationDailySnapshots.date))
    .limit(limit);
}

export async function upsertDailySnapshot(data: Omit<InsertOwnerSimulationDailySnapshot, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(ownerSimulationDailySnapshots).values(data).onDuplicateKeyUpdate({
    set: {
      endValue: data.endValue,
      dailyPnl: data.dailyPnl,
      dailyReturnPct: data.dailyReturnPct,
      bestTrade: data.bestTrade,
      worstTrade: data.worstTrade,
      aiSummary: data.aiSummary,
      tradesCount: data.tradesCount,
    },
  });
}

// ── Crypto price fetch ────────────────────────────────────────
async function fetchCryptoPrices(coinIds: string[]): Promise<Record<string, {
  usd: number; usd_24h_change: number; usd_24h_vol: number; usd_market_cap: number;
}>> {
  const ids = coinIds.join(",");
  const url = `${CG_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    return res.json() as Promise<Record<string, { usd: number; usd_24h_change: number; usd_24h_vol: number; usd_market_cap: number }>>;
  } catch (err) {
    log.warn("[OwnerSim] CoinGecko fetch failed", { err: err as Error });
    return {};
  }
}

// ── Domain score extractor ────────────────────────────────────
function extractDomainScores(pressure: FaultlinePressureOutput) {
  const find = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 50;
  return {
    credit:     find("credit-stress"),
    aiBubble:   find("ai-bubble"),
    treasury:   find("treasury-yield"),
    recession:  find("recession-risk"),
    liquidity:  find("liquidity-stress"),
    volatility: find("volatility-regime"),
  };
}

// ── Objective-based scoring ───────────────────────────────────
function scoreObjectiveFit(
  objective: OwnerSimulationObjective | null,
  ticker: string,
  assetType: "stock" | "crypto",
  signal: ReturnType<typeof computeTradingSignal>,
  pressure: FaultlinePressureOutput,
): { fits: boolean; reason: string } {
  if (!objective) return { fits: true, reason: "No objective set — all opportunities shown" };
  const objType = objective.objectiveType as ObjectiveType;
  const assetPref = objective.assetPreference;

  // Asset preference filter
  if (assetPref === "stocks" && assetType === "crypto") return { fits: false, reason: "Objective set to stocks only" };
  if (assetPref === "crypto" && assetType === "stock") return { fits: false, reason: "Objective set to crypto only" };

  switch (objType) {
    case "short_swing":
      if (signal.technicals.rsiEstimate > 40 && signal.technicals.rsiEstimate < 70 && signal.technicals.trend === "Uptrend")
        return { fits: true, reason: "RSI in momentum zone with uptrend — ideal for swing entry" };
      return { fits: signal.confidence > 55, reason: signal.confidence > 55 ? "Moderate confidence swing setup" : "Low confidence for short-term swing" };
    case "long_position":
      if (pressure.overallPressure < 50 && signal.regimeAlignment === "Aligned")
        return { fits: true, reason: "Low-stress regime with regime alignment — suitable for long-term build" };
      return { fits: pressure.overallPressure < 65, reason: pressure.overallPressure < 65 ? "Acceptable pressure for position build" : "High pressure — wait for regime improvement" };
    case "crypto_momentum":
      if (assetType !== "crypto") return { fits: false, reason: "Crypto momentum objective — stocks excluded" };
      return { fits: signal.action === "BUY" && signal.confidence > 50, reason: signal.confidence > 50 ? "Crypto with buy signal" : "Weak crypto signal" };
    case "defensive":
      if (["SPY", "QQQ", "BTC", "ETH"].includes(ticker) && pressure.overallPressure < 60)
        return { fits: true, reason: "Core asset in moderate-stress regime — defensive hold" };
      return { fits: signal.technicals.trend !== "Downtrend" && pressure.overallPressure < 55, reason: "Acceptable for defensive positioning" };
    case "ai_tech_momentum":
      const aiTickers = ["NVDA", "AMD", "PLTR", "META", "MSFT", "IONQ", "SOUN", "RGTI", "QUBT"];
      if (!aiTickers.includes(ticker)) return { fits: false, reason: "Not in AI/tech universe for this objective" };
      return { fits: signal.action === "BUY" && signal.confidence > 55, reason: "AI/tech ticker with buy signal" };
    case "custom":
      return { fits: true, reason: "Custom objective — all opportunities shown" };
    default:
      return { fits: true, reason: "Objective fit evaluated" };
  }
}

// ── Position size calculator ──────────────────────────────────
function calcPositionSize(
  accountValue: number,
  price: number,
  stopLoss: number,
  objective: OwnerSimulationObjective | null,
  pressure: FaultlinePressureOutput,
): { pct: number; usd: number; riskUsd: number } {
  const maxPct = objective ? parseFloat(objective.maxPositionSizePct.toString()) : 10;
  const maxLoss = objective ? parseFloat(objective.maxLossPerTrade.toString()) : 2000;
  const riskMode = objective?.riskMode ?? "balanced";

  // Base size by risk mode
  let basePct = riskMode === "aggressive" ? 12 : riskMode === "defensive" ? 5 : 8;
  basePct = Math.min(basePct, maxPct);

  // Reduce in high-stress regimes
  if (pressure.overallPressure >= 65) basePct *= 0.6;
  else if (pressure.overallPressure >= 50) basePct *= 0.8;

  const posUsd = Math.min(accountValue * (basePct / 100), accountValue * (maxPct / 100));
  const stopPct = price > 0 && stopLoss > 0 ? Math.abs((price - stopLoss) / price) : 0.08;
  const riskUsd = Math.min(posUsd * stopPct, maxLoss);

  return {
    pct: Math.round(basePct * 10) / 10,
    usd: Math.round(posUsd * 100) / 100,
    riskUsd: Math.round(riskUsd * 100) / 100,
  };
}

// ── AI rationale generator ────────────────────────────────────
async function generateOpportunityRationale(
  ticker: string,
  name: string,
  assetType: "stock" | "crypto",
  direction: OpportunityDirection,
  price: number,
  changePercent: number,
  pressure: FaultlinePressureOutput,
  domains: ReturnType<typeof extractDomainScores>,
  signal: ReturnType<typeof computeTradingSignal>,
  objectiveLabel: string,
): Promise<{ whyNow: string; invalidation: string; keyRisks: string[]; labels: string[] }> {
  const domainStr = Object.entries(domains).map(([k, v]) => `${k}: ${v}/100`).join(", ");
  try {
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are FAULTLINE's real-time opportunity intelligence engine. Generate concise, specific trade rationale based on current market readings. This is for simulation/research only — not financial advice.",
        },
        {
          role: "user",
          content: `Generate opportunity rationale for:
ASSET: ${ticker} (${name}) — ${assetType.toUpperCase()}
DIRECTION: ${direction}
PRICE: $${price.toFixed(assetType === "crypto" && price < 1 ? 6 : 2)} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today)
OBJECTIVE: ${objectiveLabel}

FAULTLINE CONTEXT:
- Pressure Index: ${pressure.overallPressure}/100 (${pressure.regime})
- Regime Level: ${pressure.level}
- Top Alert: ${pressure.alerts[0]?.title ?? "None"}
- Historical Analog: ${pressure.topAnalog?.label ?? "N/A"}

DOMAIN SCORES (higher = more stress): ${domainStr}

TECHNICALS:
- RSI: ${signal.technicals.rsiEstimate.toFixed(1)} (${signal.technicals.rsiLabel})
- MACD: ${signal.technicals.macd?.signal ?? "Neutral"}
- SMA: ${signal.technicals.smaSignal}
- Trend: ${signal.technicals.trend}
- Volume: ${signal.technicals.volumeSignal}
- Signal: ${signal.action} (${signal.confidence}/100 confidence)
- Regime Alignment: ${signal.regimeAlignment}

Respond with JSON:
{
  "whyNow": "2-3 sentence specific explanation of why this opportunity exists right now, referencing FAULTLINE readings and technicals",
  "invalidation": "1 sentence: what would cancel this trade thesis",
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "labels": ["label1", "label2"]
}
Labels must be chosen from: ["AI Bubble Exposure", "Momentum Breakout", "Oversold Reversal", "Volume Surge", "Near-Support Coil", "Sector Rotation", "Macro Dislocation", "Defensive Play", "Crypto Momentum", "High Asymmetry", "Regime Aligned", "Counter-Trend Risk", "Liquidity Sensitive", "Recession Hedge"]`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "opportunity_rationale",
          strict: true,
          schema: {
            type: "object",
            properties: {
              whyNow:       { type: "string" },
              invalidation: { type: "string" },
              keyRisks:     { type: "array", items: { type: "string" } },
              labels:       { type: "array", items: { type: "string" } },
            },
            required: ["whyNow", "invalidation", "keyRisks", "labels"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = resp.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        whyNow:       parsed.whyNow ?? "FAULTLINE signal alignment detected.",
        invalidation: parsed.invalidation ?? "Break below stop-loss level.",
        keyRisks:     Array.isArray(parsed.keyRisks) ? parsed.keyRisks.slice(0, 3) : ["Market risk", "Regime shift", "Liquidity risk"],
        labels:       Array.isArray(parsed.labels) ? parsed.labels.slice(0, 3) : [],
      };
    }
  } catch (err) {
    log.warn(`[OwnerSim] LLM rationale failed for ${ticker}`, { err: err as Error });
  }
  return {
    whyNow: `${ticker} shows ${signal.action} signal with ${signal.confidence}/100 confidence under ${pressure.regime} regime.`,
    invalidation: `Break below stop-loss level invalidates the thesis.`,
    keyRisks: ["Market regime shift", "Liquidity deterioration", "Macro surprise"],
    labels: [signal.action === "BUY" ? "Momentum Breakout" : "Regime Aligned"],
  };
}

// ── Stock opportunity builder ─────────────────────────────────
async function buildStockOpportunity(
  ticker: string,
  name: string,
  sector: string,
  pressure: FaultlinePressureOutput,
  objective: OwnerSimulationObjective | null,
  accountValue: number,
): Promise<TradeOpportunity | null> {
  try {
    const quote = await getQuote(ticker);
    if (!quote.price || quote.source === "error") return null;

    const price = quote.price;
    const changePercent = quote.changePercent ?? 0;

    const signalInput: TradingSignalsInput = {
      ticker,
      price,
      open: quote.open ?? price,
      high: quote.high ?? price * 1.02,
      low: quote.low ?? price * 0.98,
      changePercent,
      volumeMillions: (quote.volume ?? 0) / 1e6,
      avgVolume: (quote.volume ?? 0) / 1e6,
      sparkline: [],
      relativeStrength: 50,
    };
    const regime = { label: pressure.regime, score: pressure.overallPressure / 10 };
    const signal = computeTradingSignal(signalInput, regime);
    const domains = extractDomainScores(pressure);

    // Determine direction
    let direction: OpportunityDirection = "WATCH";
    if (signal.action === "BUY" && signal.confidence >= 50) direction = "LONG";
    else if (signal.action === "SELL") direction = "AVOID";
    else if (pressure.overallPressure >= 70) direction = "DEFENSIVE";

    // Price levels
    const stopLoss = signal.priceLevels.stopLoss ?? price * 0.92;
    const targetOne = signal.priceLevels.resistance ?? price * 1.12;
    const targetTwo = targetOne * 1.08;
    const entryLow = price * 0.995;
    const entryHigh = price * 1.005;

    // R/R ratio
    const upside = targetOne - price;
    const downside = price - stopLoss;
    const rrRatio = downside > 0 ? Math.round((upside / downside) * 10) / 10 : 1.5;

    // Sizing
    const sizing = calcPositionSize(accountValue, price, stopLoss, objective, pressure);

    // Composite score
    const macroFit = Math.max(0, 100 - pressure.overallPressure + signal.confidence / 2);
    const compositeScore = Math.round(
      (signal.confidence * 0.35) +
      (macroFit * 0.25) +
      (Math.min(rrRatio * 15, 30) * 0.20) +
      ((direction === "LONG" ? 80 : direction === "WATCH" ? 50 : 20) * 0.20)
    );

    // Objective fit
    const objFit = scoreObjectiveFit(objective, ticker, "stock", signal, pressure);
    const objectiveLabel = objective ? OBJECTIVE_TYPES.find(o => o.id === objective.objectiveType)?.label ?? "Custom" : "No Objective";

    // AI rationale (only for LONG/WATCH directions)
    const rationale = await generateOpportunityRationale(
      ticker, name, "stock", direction, price, changePercent, pressure, domains, signal, objectiveLabel
    );

    const freshness: DataFreshness = quote.source === "yahoo" ? "LIVE" : quote.source === "polygon-prev" ? "DELAYED" : "STALE";

    return {
      id: `stock-${ticker}-${Date.now()}`,
      ticker,
      name,
      sector,
      assetType: "stock",
      direction,
      currentPrice: price,
      changePercent,
      volume: quote.volume ?? 0,
      marketCap: null,
      dataFreshness: freshness,
      entryZoneLow: Math.round(entryLow * 100) / 100,
      entryZoneHigh: Math.round(entryHigh * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      targetOne: Math.round(targetOne * 100) / 100,
      targetTwo: Math.round(targetTwo * 100) / 100,
      riskRewardRatio: rrRatio,
      suggestedPositionSizePct: sizing.pct,
      suggestedPositionSizeUsd: sizing.usd,
      riskAmountUsd: sizing.riskUsd,
      faultlineConfidence: signal.confidence,
      compositeScore,
      momentumScore: Math.round(signal.technicals.rsiEstimate),
      macroFit: Math.round(macroFit),
      objectiveFit: objFit.fits,
      objectiveFitReason: objFit.reason,
      whyNow: rationale.whyNow,
      invalidation: rationale.invalidation,
      keyRisks: rationale.keyRisks,
      labels: rationale.labels,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    log.warn(`[OwnerSim] Failed to build stock opportunity for ${ticker}`, { err: err as Error });
    return null;
  }
}

// ── Crypto opportunity builder ────────────────────────────────
async function buildCryptoOpportunity(
  ticker: string,
  coinId: string,
  name: string,
  rawPrice: { usd: number; usd_24h_change: number; usd_24h_vol: number; usd_market_cap: number } | undefined,
  pressure: FaultlinePressureOutput,
  objective: OwnerSimulationObjective | null,
  accountValue: number,
): Promise<TradeOpportunity | null> {
  if (!rawPrice?.usd) return null;
  try {
    const price = rawPrice.usd;
    const changePercent = rawPrice.usd_24h_change ?? 0;
    const volume = rawPrice.usd_24h_vol ?? 0;
    const marketCap = rawPrice.usd_market_cap ?? null;

    const signalInput: TradingSignalsInput = {
      ticker,
      price,
      open: price / (1 + changePercent / 100),
      high: price * 1.03,
      low: price * 0.97,
      changePercent,
      volumeMillions: volume / 1e6,
      avgVolume: volume / 1e6,
      sparkline: [],
      relativeStrength: 50,
    };
    const regime = { label: pressure.regime, score: pressure.overallPressure / 10 };
    const signal = computeTradingSignal(signalInput, regime);
    const domains = extractDomainScores(pressure);

    let direction: OpportunityDirection = "WATCH";
    if (signal.action === "BUY" && signal.confidence >= 50) direction = "LONG";
    else if (signal.action === "SELL") direction = "AVOID";
    else if (pressure.overallPressure >= 70) direction = "DEFENSIVE";

    const stopLoss = price * 0.88;
    const targetOne = price * 1.18;
    const targetTwo = price * 1.35;
    const entryLow = price * 0.99;
    const entryHigh = price * 1.01;

    const upside = targetOne - price;
    const downside = price - stopLoss;
    const rrRatio = downside > 0 ? Math.round((upside / downside) * 10) / 10 : 2.0;

    const sizing = calcPositionSize(accountValue, price, stopLoss, objective, pressure);
    const macroFit = Math.max(0, 100 - pressure.overallPressure + signal.confidence / 2);
    const compositeScore = Math.round(
      (signal.confidence * 0.35) +
      (macroFit * 0.25) +
      (Math.min(rrRatio * 15, 30) * 0.20) +
      ((direction === "LONG" ? 80 : direction === "WATCH" ? 50 : 20) * 0.20)
    );

    const objFit = scoreObjectiveFit(objective, ticker, "crypto", signal, pressure);
    const objectiveLabel = objective ? OBJECTIVE_TYPES.find(o => o.id === objective.objectiveType)?.label ?? "Custom" : "No Objective";

    const rationale = await generateOpportunityRationale(
      ticker, name, "crypto", direction, price, changePercent, pressure, domains, signal, objectiveLabel
    );

    return {
      id: `crypto-${ticker}-${Date.now()}`,
      ticker,
      name,
      sector: "Crypto",
      assetType: "crypto",
      direction,
      currentPrice: price,
      changePercent,
      volume,
      marketCap,
      dataFreshness: "LIVE",
      entryZoneLow: entryLow,
      entryZoneHigh: entryHigh,
      stopLoss,
      targetOne,
      targetTwo,
      riskRewardRatio: rrRatio,
      suggestedPositionSizePct: sizing.pct,
      suggestedPositionSizeUsd: sizing.usd,
      riskAmountUsd: sizing.riskUsd,
      faultlineConfidence: signal.confidence,
      compositeScore,
      momentumScore: Math.round(signal.technicals.rsiEstimate),
      macroFit: Math.round(macroFit),
      objectiveFit: objFit.fits,
      objectiveFitReason: objFit.reason,
      whyNow: rationale.whyNow,
      invalidation: rationale.invalidation,
      keyRisks: rationale.keyRisks,
      labels: rationale.labels,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    log.warn(`[OwnerSim] Failed to build crypto opportunity for ${ticker}`, { err: err as Error });
    return null;
  }
}

// ── Main opportunity scanner ──────────────────────────────────
export async function scanOpportunities(
  objective: OwnerSimulationObjective | null,
  accountValue: number,
  assetFilter: "stocks" | "crypto" | "both" = "both",
): Promise<TradeOpportunity[]> {
  const pressure = await calculateFaultlinePressure();
  const results: TradeOpportunity[] = [];

  // Stock scan
  if (assetFilter !== "crypto") {
    const stockPromises = STOCK_UNIVERSE.map(s =>
      buildStockOpportunity(s.ticker, s.name, s.sector, pressure, objective, accountValue)
    );
    const stockResults = await Promise.allSettled(stockPromises);
    for (const r of stockResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  // Crypto scan
  if (assetFilter !== "stocks") {
    const coinIds = CRYPTO_UNIVERSE.map(c => c.coinId);
    const cryptoPrices = await fetchCryptoPrices(coinIds);
    const cryptoPromises = CRYPTO_UNIVERSE.map(c =>
      buildCryptoOpportunity(c.ticker, c.coinId, c.name, cryptoPrices[c.coinId] as { usd: number; usd_24h_change: number; usd_24h_vol: number; usd_market_cap: number } | undefined, pressure, objective, accountValue)
    );
    const cryptoResults = await Promise.allSettled(cryptoPromises);
    for (const r of cryptoResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  // Sort by composite score descending, objective-fit first
  return results.sort((a, b) => {
    if (a.objectiveFit && !b.objectiveFit) return -1;
    if (!a.objectiveFit && b.objectiveFit) return 1;
    return b.compositeScore - a.compositeScore;
  });
}

// ── Trade execution helpers ───────────────────────────────────
export async function executeTrade(
  accountId: number,
  opportunity: TradeOpportunity,
  side: "BUY" | "SELL" | "TRIM" | "ADD",
  quantity: number,
  pressure: FaultlinePressureOutput,
  objective: OwnerSimulationObjective | null,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const price = opportunity.currentPrice;
  const notional = Math.round(price * quantity * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);

  // Get account
  const accounts = await db.select().from(ownerSimulationAccounts)
    .where(eq(ownerSimulationAccounts.id, accountId)).limit(1);
  const account = accounts[0];
  if (!account) throw new Error("Account not found");

  const cash = parseFloat(account.currentCash.toString());

  if (side === "BUY" || side === "ADD") {
    if (notional > cash) throw new Error(`Insufficient cash: need $${notional.toFixed(2)}, have $${cash.toFixed(2)}`);

    // Check risk limits
    const maxLoss = objective ? parseFloat(objective.maxLossPerTrade.toString()) : 2000;
    if (opportunity.riskAmountUsd > maxLoss) {
      throw new Error(`Trade exceeds max loss per trade ($${maxLoss}). Risk: $${opportunity.riskAmountUsd.toFixed(2)}`);
    }

    // Insert or update position
    const existingPositions = await db.select().from(ownerSimulationPositions)
      .where(and(
        eq(ownerSimulationPositions.accountId, accountId),
        eq(ownerSimulationPositions.symbol, opportunity.ticker),
        eq(ownerSimulationPositions.status, "open"),
      )).limit(1);

    let positionId: number;
    if (existingPositions[0] && side === "ADD") {
      const existing = existingPositions[0];
      const existingQty = parseFloat(existing.quantity.toString());
      const existingEntry = parseFloat(existing.averageEntry.toString());
      const newQty = existingQty + quantity;
      const newAvgEntry = (existingQty * existingEntry + quantity * price) / newQty;
      await db.update(ownerSimulationPositions).set({
        quantity: newQty.toString(),
        averageEntry: newAvgEntry.toString(),
        currentPrice: price.toString(),
        marketValue: (newQty * price).toString(),
        unrealizedPnl: ((price - newAvgEntry) * newQty).toString(),
        updatedAt: new Date(),
      }).where(eq(ownerSimulationPositions.id, existing.id));
      positionId = existing.id;
    } else {
      const posResult = await db.insert(ownerSimulationPositions).values({
        accountId,
        symbol: opportunity.ticker,
        name: opportunity.name,
        assetType: opportunity.assetType,
        quantity: quantity.toString(),
        averageEntry: price.toString(),
        currentPrice: price.toString(),
        marketValue: notional.toString(),
        unrealizedPnl: "0.00",
        stopLoss: opportunity.stopLoss.toString(),
        targetOne: opportunity.targetOne.toString(),
        targetTwo: opportunity.targetTwo.toString(),
        objective: objective?.objectiveType ?? null,
        pressureAtEntry: pressure.overallPressure,
        regimeAtEntry: pressure.regime,
        status: "open",
      });
      const okPacket = posResult[0] as unknown as { insertId: number };
      positionId = okPacket.insertId;
    }

    // Deduct cash
    await db.update(ownerSimulationAccounts).set({
      currentCash: (cash - notional).toString(),
      updatedAt: new Date(),
    }).where(eq(ownerSimulationAccounts.id, accountId));

    // Log trade
    await db.insert(ownerSimulationTrades).values({
      accountId,
      positionId,
      symbol: opportunity.ticker,
      assetType: opportunity.assetType,
      side,
      quantity: quantity.toString(),
      entryPrice: price.toString(),
      notionalValue: notional.toString(),
      stopLoss: opportunity.stopLoss.toString(),
      targetOne: opportunity.targetOne.toString(),
      targetTwo: opportunity.targetTwo.toString(),
      faultlineScoreAtEntry: pressure.overallPressure,
      pressureIndexAtEntry: pressure.overallPressure,
      regimeAtEntry: pressure.regime,
      bullBearAtEntry: pressure.level,
      objective: objective?.objectiveType ?? null,
      rationale: `${opportunity.whyNow} | Stop: $${opportunity.stopLoss.toFixed(2)} | T1: $${opportunity.targetOne.toFixed(2)}`,
      status: "open",
    });

    return { success: true, positionId, notional, cashAfter: cash - notional };
  }

  if (side === "SELL" || side === "TRIM") {
    const positions = await db.select().from(ownerSimulationPositions)
      .where(and(
        eq(ownerSimulationPositions.accountId, accountId),
        eq(ownerSimulationPositions.symbol, opportunity.ticker),
        eq(ownerSimulationPositions.status, "open"),
      )).limit(1);

    if (!positions[0]) throw new Error(`No open position found for ${opportunity.ticker}`);
    const pos = positions[0];
    const existingQty = parseFloat(pos.quantity.toString());
    const avgEntry = parseFloat(pos.averageEntry.toString());
    const sellQty = Math.min(quantity, existingQty);
    const realizedPnl = (price - avgEntry) * sellQty;
    const proceeds = price * sellQty;

    if (side === "SELL" || sellQty >= existingQty) {
      // Full close
      await db.update(ownerSimulationPositions).set({
        status: "closed",
        currentPrice: price.toString(),
        marketValue: "0",
        unrealizedPnl: "0",
        closedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(ownerSimulationPositions.id, pos.id));
    } else {
      // Partial trim
      const remainingQty = existingQty - sellQty;
      await db.update(ownerSimulationPositions).set({
        quantity: remainingQty.toString(),
        currentPrice: price.toString(),
        marketValue: (remainingQty * price).toString(),
        unrealizedPnl: ((price - avgEntry) * remainingQty).toString(),
        updatedAt: new Date(),
      }).where(eq(ownerSimulationPositions.id, pos.id));
    }

    // Add cash back
    await db.update(ownerSimulationAccounts).set({
      currentCash: (cash + proceeds).toString(),
      updatedAt: new Date(),
    }).where(eq(ownerSimulationAccounts.id, accountId));

    // Log trade
    await db.insert(ownerSimulationTrades).values({
      accountId,
      positionId: pos.id,
      symbol: opportunity.ticker,
      assetType: opportunity.assetType,
      side,
      quantity: sellQty.toString(),
      entryPrice: avgEntry.toString(),
      exitPrice: price.toString(),
      notionalValue: proceeds.toString(),
      realizedPnl: realizedPnl.toString(),
      faultlineScoreAtEntry: pressure.overallPressure,
      pressureIndexAtEntry: pressure.overallPressure,
      regimeAtEntry: pressure.regime,
      bullBearAtEntry: pressure.level,
      objective: objective?.objectiveType ?? null,
      rationale: `${side} at $${price.toFixed(2)} — Realized P&L: $${realizedPnl.toFixed(2)}`,
      status: "closed",
      closedAt: new Date(),
    });

    return { success: true, realizedPnl, proceeds, cashAfter: cash + proceeds };
  }

  throw new Error(`Unknown side: ${side}`);
}

// ── Mark-to-market portfolio valuation ───────────────────────
export async function markToMarket(accountId: number): Promise<{
  totalValue: number;
  cashBalance: number;
  positionsValue: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalPnlPct: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const accounts = await db.select().from(ownerSimulationAccounts)
    .where(eq(ownerSimulationAccounts.id, accountId)).limit(1);
  const account = accounts[0];
  if (!account) throw new Error("Account not found");

  const positions = await db.select().from(ownerSimulationPositions)
    .where(and(eq(ownerSimulationPositions.accountId, accountId), eq(ownerSimulationPositions.status, "open")));

  let positionsValue = 0;
  let unrealizedPnl = 0;

  // Fetch live prices for all open positions
  const stockTickers = positions.filter(p => p.assetType === "stock").map(p => p.symbol);
  const cryptoSymbols = positions.filter(p => p.assetType === "crypto").map(p => p.symbol);

  const stockPrices: Record<string, number> = {};
  for (const ticker of stockTickers) {
    try {
      const q = await getQuote(ticker);
      if (q.price) stockPrices[ticker] = q.price;
    } catch { /* skip */ }
  }

  let cryptoPrices: Record<string, number> = {};
  if (cryptoSymbols.length > 0) {
    const coinMap: Record<string, string> = {};
    for (const c of CRYPTO_UNIVERSE) coinMap[c.ticker] = c.coinId;
    const coinIds = cryptoSymbols.map(s => coinMap[s] ?? s.toLowerCase());
    const raw = await fetchCryptoPrices(coinIds);
    for (const c of CRYPTO_UNIVERSE) {
      if (raw[c.coinId]?.usd) cryptoPrices[c.ticker] = raw[c.coinId].usd;
    }
  }

  for (const pos of positions) {
    const livePrice = pos.assetType === "stock"
      ? stockPrices[pos.symbol]
      : cryptoPrices[pos.symbol];

    if (livePrice) {
      const qty = parseFloat(pos.quantity.toString());
      const avgEntry = parseFloat(pos.averageEntry.toString());
      const mv = livePrice * qty;
      const upnl = (livePrice - avgEntry) * qty;
      positionsValue += mv;
      unrealizedPnl += upnl;

      // Update position in DB
      await db.update(ownerSimulationPositions).set({
        currentPrice: livePrice.toString(),
        marketValue: mv.toString(),
        unrealizedPnl: upnl.toString(),
        updatedAt: new Date(),
      }).where(eq(ownerSimulationPositions.id, pos.id));
    } else {
      // Use last known value
      positionsValue += parseFloat(pos.marketValue?.toString() ?? "0");
      unrealizedPnl += parseFloat(pos.unrealizedPnl?.toString() ?? "0");
    }
  }

  const cashBalance = parseFloat(account.currentCash.toString());
  const totalValue = cashBalance + positionsValue;
  const startingCapital = parseFloat(account.startingCapital.toString());
  const totalPnl = totalValue - startingCapital;
  const totalPnlPct = (totalPnl / startingCapital) * 100;

  // Update account value
  await db.update(ownerSimulationAccounts).set({
    currentValue: totalValue.toString(),
    updatedAt: new Date(),
  }).where(eq(ownerSimulationAccounts.id, accountId));

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    positionsValue: Math.round(positionsValue * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalPnlPct: Math.round(totalPnlPct * 100) / 100,
  };
}

// ── Goal progress calculator ──────────────────────────────────
export function calcGoalProgress(currentValue: number, startingCapital = STARTING_CAPITAL, targetValue = TARGET_VALUE) {
  const milestones = [
    { label: "$125K", value: 125000 },
    { label: "$150K", value: 150000 },
    { label: "$200K", value: 200000 },
    { label: "$250K", value: 250000 },
    { label: "$500K", value: 500000 },
    { label: "$750K", value: 750000 },
    { label: "$1M",   value: 1000000 },
  ];

  const pctComplete = Math.min(((currentValue - startingCapital) / (targetValue - startingCapital)) * 100, 100);
  const dollarsRemaining = Math.max(targetValue - currentValue, 0);
  const multipleRemaining = currentValue > 0 ? targetValue / currentValue : 10;
  const totalPnl = currentValue - startingCapital;
  const totalPnlPct = (totalPnl / startingCapital) * 100;

  // Required daily returns to hit $1M
  const daysIn3mo = 63, daysIn6mo = 126, daysIn12mo = 252, daysIn24mo = 504;
  const dailyReturn = (months: number) => {
    const days = months === 3 ? daysIn3mo : months === 6 ? daysIn6mo : months === 12 ? daysIn12mo : daysIn24mo;
    return ((Math.pow(targetValue / currentValue, 1 / days) - 1) * 100);
  };

  const completedMilestones = milestones.map(m => ({ ...m, achieved: currentValue >= m.value }));
  const nextMilestone = completedMilestones.find(m => !m.achieved) ?? completedMilestones[completedMilestones.length - 1];

  return {
    startingCapital,
    targetValue,
    currentValue,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalPnlPct: Math.round(totalPnlPct * 100) / 100,
    pctComplete: Math.round(pctComplete * 100) / 100,
    dollarsRemaining: Math.round(dollarsRemaining * 100) / 100,
    multipleRemaining: Math.round(multipleRemaining * 100) / 100,
    milestones: completedMilestones,
    nextMilestone,
    requiredDailyReturn3mo: Math.round(dailyReturn(3) * 1000) / 1000,
    requiredDailyReturn6mo: Math.round(dailyReturn(6) * 1000) / 1000,
    requiredDailyReturn12mo: Math.round(dailyReturn(12) * 1000) / 1000,
    requiredDailyReturn24mo: Math.round(dailyReturn(24) * 1000) / 1000,
    status: currentValue >= targetValue ? "ACHIEVED" : currentValue > startingCapital * 1.05 ? "AHEAD" : currentValue < startingCapital * 0.97 ? "BEHIND" : "NEUTRAL",
  };
}

// ── AI daily journal generator ────────────────────────────────
export async function generateOwnerJournal(
  accountId: number,
  objective: OwnerSimulationObjective | null,
  todayTrades: OwnerSimulationTrade[],
  portfolioValue: number,
  pressure: FaultlinePressureOutput,
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const objectiveLabel = objective ? OBJECTIVE_TYPES.find(o => o.id === objective.objectiveType)?.label ?? "Custom" : "No Objective Set";
  const tradesSummary = todayTrades.length > 0
    ? todayTrades.map(t => `${t.side} ${t.symbol} qty=${t.quantity} @ $${t.entryPrice} (${t.status})`).join("; ")
    : "No trades today";

  try {
    const resp = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's simulation journal AI. Write a concise, analytical daily journal entry for the owner's simulation account. This is for research/educational purposes only." },
        {
          role: "user",
          content: `Generate today's simulation journal entry:
DATE: ${today}
OBJECTIVE: ${objectiveLabel}
PORTFOLIO VALUE: $${portfolioValue.toFixed(2)}
FAULTLINE REGIME: ${pressure.regime} (${pressure.overallPressure}/100)
TRADES TODAY: ${tradesSummary}

Write a JSON journal entry:
{
  "objectiveNotes": "1-2 sentences on how today's objective guided decisions",
  "tradesTaken": "summary of trades executed",
  "tradesSkipped": "what opportunities were passed and why",
  "marketRegime": "1-2 sentences on FAULTLINE regime today",
  "whatWorked": "what went well",
  "whatFailed": "what didn't work or was avoided",
  "bestSetup": "best opportunity seen today",
  "mistakeToAvoid": "key lesson for tomorrow",
  "aiSummary": "2-3 sentence overall day summary"
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "journal_entry",
          strict: true,
          schema: {
            type: "object",
            properties: {
              objectiveNotes: { type: "string" },
              tradesTaken:    { type: "string" },
              tradesSkipped:  { type: "string" },
              marketRegime:   { type: "string" },
              whatWorked:     { type: "string" },
              whatFailed:     { type: "string" },
              bestSetup:      { type: "string" },
              mistakeToAvoid: { type: "string" },
              aiSummary:      { type: "string" },
            },
            required: ["objectiveNotes", "tradesTaken", "tradesSkipped", "marketRegime", "whatWorked", "whatFailed", "bestSetup", "mistakeToAvoid", "aiSummary"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = resp.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const j = JSON.parse(content);
      return [
        `## Owner Simulation Journal — ${today}`,
        `**Objective:** ${objectiveLabel} | **Regime:** ${pressure.regime} (${pressure.overallPressure}/100)`,
        `**Portfolio Value:** $${portfolioValue.toFixed(2)}`,
        `### Objective Notes\n${j.objectiveNotes}`,
        `### Trades Taken\n${j.tradesTaken}`,
        `### Trades Skipped\n${j.tradesSkipped}`,
        `### Market Regime\n${j.marketRegime}`,
        `### What Worked\n${j.whatWorked}`,
        `### What Failed / Avoided\n${j.whatFailed}`,
        `### Best Setup Today\n${j.bestSetup}`,
        `### Lesson for Tomorrow\n${j.mistakeToAvoid}`,
        `### AI Summary\n${j.aiSummary}`,
        `\n*SIMULATION ONLY — NOT FINANCIAL ADVICE*`,
      ].join("\n\n");
    }
  } catch (err) {
    log.warn("[OwnerSim] Journal generation failed", { err: err as Error });
  }
  return `## Owner Simulation Journal — ${today}\n\n**Objective:** ${objectiveLabel}\n**Regime:** ${pressure.regime}\n\n${tradesSummary}\n\n*SIMULATION ONLY — NOT FINANCIAL ADVICE*`;
}

// Re-export types needed by routers
export type {
  OwnerSimulationAccount, OwnerSimulationPosition,
  OwnerSimulationTrade, OwnerSimulationObjective, OwnerSimulationDailySnapshot,
};
