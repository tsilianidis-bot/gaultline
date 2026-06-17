// ============================================================
// FAULTLINE — Calculated Price Levels Engine
// server/priceLevels.ts
//
// RULES:
//   • All levels are derived from real market data (OHLC bars)
//   • No LLM-invented values — math only
//   • If insufficient data, return null (never fabricate)
//   • Calculations: ATR, Pivot Points, SMA, Bollinger Bands,
//     Previous Highs/Lows, Trend Structure, Volatility Bands
// ============================================================

export interface PriceLevel {
  price: number;
  pctFromCurrent: number;  // % distance from current price (negative = below)
  method: string;          // e.g. "Pivot S1", "SMA-50", "52-Week Low"
  description: string;     // one-line explanation
}

export interface SupportResistanceLevels {
  support1: PriceLevel | null;
  support2: PriceLevel | null;
  support3: PriceLevel | null;
  resistance1: PriceLevel | null;
  resistance2: PriceLevel | null;
  resistance3: PriceLevel | null;
}

export interface TradeFrameworkLevels {
  entryZone: PriceLevel | null;
  riskZone: PriceLevel | null;       // stop-loss / invalidation of trade
  profitTarget1: PriceLevel | null;  // 1:1 R/R
  profitTarget2: PriceLevel | null;  // 2:1 R/R
  stretchTarget: PriceLevel | null;  // 3:1 R/R or major resistance
  invalidationLevel: PriceLevel | null; // structural invalidation
}

export interface TimeframeSpecificLevels {
  // Day trade (intraday)
  day: {
    intradaySupport: PriceLevel | null;
    intradayResistance: PriceLevel | null;
    dayTradeTarget1: PriceLevel | null;
    dayTradeTarget2: PriceLevel | null;
    intradayInvalidation: PriceLevel | null;
  };
  // Short-term (1–5 days)
  short: {
    nearTermSupport: PriceLevel | null;
    nearTermResistance: PriceLevel | null;
    target1: PriceLevel | null;
    target2: PriceLevel | null;
    riskLevel: PriceLevel | null;
  };
  // Swing trade (1–6 weeks)
  swing: {
    swingSupport: PriceLevel | null;
    swingResistance: PriceLevel | null;
    swingTarget1: PriceLevel | null;
    swingTarget2: PriceLevel | null;
    swingInvalidation: PriceLevel | null;
  };
  // Long-term (3–12 months)
  long: {
    longTermSupportZone: PriceLevel | null;
    longTermResistanceZone: PriceLevel | null;
    longTermTargetLow: PriceLevel | null;
    longTermTargetHigh: PriceLevel | null;
    longTermInvalidation: PriceLevel | null;
  };
}

export interface CalculatedLevels {
  available: boolean;
  insufficientDataReason: string | null;
  currentPrice: number | null;
  atr: number | null;           // Average True Range (14-period)
  atrPct: number | null;        // ATR as % of price
  pivotPoint: number | null;    // Classic daily pivot
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  supportResistance: SupportResistanceLevels;
  tradeFramework: TradeFrameworkLevels;
  timeframeSpecific: TimeframeSpecificLevels;
  dataQuality: "full" | "partial" | "minimal"; // how many bars were available
  barsUsed: number;
}

// ── Bar type (compatible with DailyBar from tradingSignals.ts) ─
export interface OHLCBar {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

// ── Helpers ───────────────────────────────────────────────────

function pct(price: number, ref: number): number {
  return parseFloat(((price - ref) / ref * 100).toFixed(2));
}

function fmt(n: number): number {
  // Smart formatting: 4dp for sub-$1 assets, 2dp otherwise
  return n < 1 ? parseFloat(n.toFixed(4)) : parseFloat(n.toFixed(2));
}

function makeLevel(price: number, current: number, method: string, description: string): PriceLevel {
  return {
    price: fmt(price),
    pctFromCurrent: pct(price, current),
    method,
    description,
  };
}

// ── ATR (14-period Wilder's) ──────────────────────────────────

function computeATR(bars: OHLCBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const recent = bars.slice(-(period + 1));
  const trValues: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const high = recent[i].high;
    const low = recent[i].low;
    const prevClose = recent[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trValues.push(tr);
  }
  // Wilder's smoothing
  let atr = trValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return atr;
}

// ── SMA ───────────────────────────────────────────────────────

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

// ── Bollinger Bands (20-period, 2 std dev) ────────────────────

function computeBollinger(closes: number[]): { upper: number; lower: number; mid: number } | null {
  const period = 20;
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mid + 2 * std, lower: mid - 2 * std, mid };
}

// ── Classic Pivot Points (using last completed bar) ───────────

function computePivots(bar: OHLCBar): {
  pp: number; r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
} {
  const { high: H, low: L, close: C } = bar;
  const pp = (H + L + C) / 3;
  const r1 = 2 * pp - L;
  const r2 = pp + (H - L);
  const r3 = H + 2 * (pp - L);
  const s1 = 2 * pp - H;
  const s2 = pp - (H - L);
  const s3 = L - 2 * (H - pp);
  return { pp, r1, r2, r3, s1, s2, s3 };
}

// ── Rolling highs/lows ────────────────────────────────────────

function rollingHigh(bars: OHLCBar[], n: number): number {
  return Math.max(...bars.slice(-n).map(b => b.high));
}

function rollingLow(bars: OHLCBar[], n: number): number {
  return Math.min(...bars.slice(-n).map(b => b.low));
}

// ── Main calculation function ─────────────────────────────────

export function computeCalculatedLevels(
  bars: OHLCBar[],
  currentPrice: number,
  direction: "Bullish" | "Bearish" | "Neutral" | "Avoid",
  timeframe: "day" | "short" | "swing" | "long"
): CalculatedLevels {
  const EMPTY_TF: TimeframeSpecificLevels = {
    day: { intradaySupport: null, intradayResistance: null, dayTradeTarget1: null, dayTradeTarget2: null, intradayInvalidation: null },
    short: { nearTermSupport: null, nearTermResistance: null, target1: null, target2: null, riskLevel: null },
    swing: { swingSupport: null, swingResistance: null, swingTarget1: null, swingTarget2: null, swingInvalidation: null },
    long: { longTermSupportZone: null, longTermResistanceZone: null, longTermTargetLow: null, longTermTargetHigh: null, longTermInvalidation: null },
  };
  const EMPTY_SR: SupportResistanceLevels = {
    support1: null, support2: null, support3: null,
    resistance1: null, resistance2: null, resistance3: null,
  };
  const EMPTY_TF_LEVELS: TradeFrameworkLevels = {
    entryZone: null, riskZone: null, profitTarget1: null,
    profitTarget2: null, stretchTarget: null, invalidationLevel: null,
  };

  if (!bars || bars.length < 5 || currentPrice <= 0) {
    return {
      available: false,
      insufficientDataReason: bars.length < 5
        ? `Only ${bars.length} daily bars available (minimum 5 required)`
        : "Current price unavailable",
      currentPrice: currentPrice > 0 ? currentPrice : null,
      atr: null, atrPct: null, pivotPoint: null,
      sma20: null, sma50: null, sma200: null,
      bollingerUpper: null, bollingerLower: null,
      weekHigh52: null, weekLow52: null,
      supportResistance: EMPTY_SR,
      tradeFramework: EMPTY_TF_LEVELS,
      timeframeSpecific: EMPTY_TF,
      dataQuality: "minimal",
      barsUsed: bars.length,
    };
  }

  const closes = bars.map(b => b.close);
  const n = bars.length;

  // ── Core indicators ──────────────────────────────────────────
  const atr = computeATR(bars, 14);
  const atrPct = atr ? parseFloat((atr / currentPrice * 100).toFixed(2)) : null;
  const lastBar = bars[n - 1];
  const prevBar = n >= 2 ? bars[n - 2] : lastBar;
  const pivots = computePivots(prevBar); // use previous session's bar for pivot
  const sma20 = computeSMA(closes, 20);
  const sma50 = computeSMA(closes, 50);
  const sma200 = computeSMA(closes, 200);
  const boll = computeBollinger(closes);

  // Rolling highs/lows
  const high5 = rollingHigh(bars, Math.min(5, n));
  const low5 = rollingLow(bars, Math.min(5, n));
  const high20 = rollingHigh(bars, Math.min(20, n));
  const low20 = rollingLow(bars, Math.min(20, n));
  const high52 = rollingHigh(bars, Math.min(252, n));
  const low52 = rollingLow(bars, Math.min(252, n));

  // Data quality
  const dataQuality: CalculatedLevels["dataQuality"] =
    n >= 200 ? "full" : n >= 50 ? "partial" : "minimal";

  // ── Support levels (below current price) ─────────────────────
  // Gather candidate support levels, filter to those below current price, pick 3 closest
  const supportCandidates: PriceLevel[] = [];
  const addSupport = (price: number, method: string, desc: string) => {
    if (price > 0 && price < currentPrice * 0.999) {
      supportCandidates.push(makeLevel(price, currentPrice, method, desc));
    }
  };

  addSupport(pivots.s1, "Pivot S1", "Classic pivot support 1 — first intraday support zone");
  addSupport(pivots.s2, "Pivot S2", "Classic pivot support 2 — secondary support zone");
  addSupport(pivots.s3, "Pivot S3", "Classic pivot support 3 — deep support zone");
  if (sma20) addSupport(sma20, "SMA-20", "20-day simple moving average — short-term trend support");
  if (sma50) addSupport(sma50, "SMA-50", "50-day simple moving average — medium-term trend support");
  if (sma200) addSupport(sma200, "SMA-200", "200-day simple moving average — long-term trend support");
  if (boll) addSupport(boll.lower, "Bollinger Lower", "Lower Bollinger Band (2σ) — statistical support boundary");
  addSupport(low5, "5-Day Low", "Lowest price over the last 5 sessions — recent swing low");
  addSupport(low20, "20-Day Low", "Lowest price over the last 20 sessions — near-term structure low");
  if (n >= 50) addSupport(rollingLow(bars, Math.min(50, n)), "50-Day Low", "50-session low — medium-term support floor");
  if (n >= 100) addSupport(low52, "52-Week Low", "52-week low — major long-term support level");

  // Sort by price descending (closest support first)
  supportCandidates.sort((a, b) => b.price - a.price);
  // Deduplicate: skip levels within 0.5% of each other
  const deduped = (arr: PriceLevel[], threshold = 0.005): PriceLevel[] => {
    const result: PriceLevel[] = [];
    for (const lvl of arr) {
      if (!result.length || Math.abs(lvl.price - result[result.length - 1].price) / result[result.length - 1].price > threshold) {
        result.push(lvl);
      }
    }
    return result;
  };
  const supports = deduped(supportCandidates);

  // ── Resistance levels (above current price) ───────────────────
  const resistanceCandidates: PriceLevel[] = [];
  const addResistance = (price: number, method: string, desc: string) => {
    if (price > 0 && price > currentPrice * 1.001) {
      resistanceCandidates.push(makeLevel(price, currentPrice, method, desc));
    }
  };

  addResistance(pivots.r1, "Pivot R1", "Classic pivot resistance 1 — first intraday resistance zone");
  addResistance(pivots.r2, "Pivot R2", "Classic pivot resistance 2 — secondary resistance zone");
  addResistance(pivots.r3, "Pivot R3", "Classic pivot resistance 3 — strong resistance ceiling");
  if (sma20 && sma20 > currentPrice) addResistance(sma20, "SMA-20", "20-day SMA acting as overhead resistance");
  if (sma50 && sma50 > currentPrice) addResistance(sma50, "SMA-50", "50-day SMA acting as medium-term resistance");
  if (sma200 && sma200 > currentPrice) addResistance(sma200, "SMA-200", "200-day SMA acting as long-term resistance");
  if (boll) addResistance(boll.upper, "Bollinger Upper", "Upper Bollinger Band (2σ) — statistical resistance boundary");
  addResistance(high5, "5-Day High", "Highest price over the last 5 sessions — recent swing high");
  addResistance(high20, "20-Day High", "Highest price over the last 20 sessions — near-term resistance");
  if (n >= 50) addResistance(rollingHigh(bars, Math.min(50, n)), "50-Day High", "50-session high — medium-term resistance ceiling");
  if (n >= 100) addResistance(high52, "52-Week High", "52-week high — major long-term resistance level");

  // Sort by price ascending (closest resistance first)
  resistanceCandidates.sort((a, b) => a.price - b.price);
  const resistances = deduped(resistanceCandidates);

  const supportResistance: SupportResistanceLevels = {
    support1: supports[0] ?? null,
    support2: supports[1] ?? null,
    support3: supports[2] ?? null,
    resistance1: resistances[0] ?? null,
    resistance2: resistances[1] ?? null,
    resistance3: resistances[2] ?? null,
  };

  // ── Trade Framework Levels ────────────────────────────────────
  // Entry: current price (or nearest support for bullish, nearest resistance for bearish)
  const isBull = direction === "Bullish" || direction === "Neutral";
  const effectiveAtr = atr ?? currentPrice * 0.02; // 2% fallback if ATR unavailable

  let entryZone: PriceLevel | null = null;
  let riskZone: PriceLevel | null = null;
  let profitTarget1: PriceLevel | null = null;
  let profitTarget2: PriceLevel | null = null;
  let stretchTarget: PriceLevel | null = null;
  let invalidationLevel: PriceLevel | null = null;

  if (isBull) {
    // Entry: current price (or just above nearest support)
    const entryPrice = supports[0]
      ? Math.max(currentPrice, supports[0].price * 1.002)
      : currentPrice;
    entryZone = makeLevel(fmt(entryPrice), currentPrice, "Current Price", "Entry zone at current market price");

    // Risk: below nearest support, or 1× ATR below entry
    const riskPrice = supports[0]
      ? fmt(supports[0].price - effectiveAtr * 0.5)
      : fmt(currentPrice - effectiveAtr * 1.0);
    riskZone = makeLevel(riskPrice, currentPrice, "Support − 0.5× ATR", "Stop-loss zone below nearest support level");

    // Risk amount
    const risk = entryPrice - riskPrice;

    // TP1: 1:1 R/R or nearest resistance
    const tp1Calc = entryPrice + risk;
    const tp1Price = resistances[0] ? Math.min(tp1Calc, resistances[0].price) : tp1Calc;
    profitTarget1 = makeLevel(fmt(tp1Price), currentPrice, resistances[0] ? "Resistance 1" : "1:1 R/R", "First profit target — 1:1 risk/reward ratio");

    // TP2: 2:1 R/R or second resistance
    const tp2Calc = entryPrice + risk * 2;
    const tp2Price = resistances[1] ? Math.min(tp2Calc, resistances[1].price) : tp2Calc;
    profitTarget2 = makeLevel(fmt(tp2Price), currentPrice, resistances[1] ? "Resistance 2" : "2:1 R/R", "Second profit target — 2:1 risk/reward ratio");

    // Stretch: 3:1 R/R or 52-week high area
    const stretchCalc = entryPrice + risk * 3;
    const stretchPrice = high52 > currentPrice ? Math.min(stretchCalc, high52 * 0.99) : stretchCalc;
    stretchTarget = makeLevel(fmt(stretchPrice), currentPrice, high52 > currentPrice ? "Near 52-Week High" : "3:1 R/R", "Stretch target — maximum upside scenario");

    // Invalidation: below swing low or 2× ATR below entry
    const invalidPrice = supports[2]
      ? fmt(supports[2].price - effectiveAtr * 0.5)
      : fmt(currentPrice - effectiveAtr * 2);
    invalidationLevel = makeLevel(invalidPrice, currentPrice, supports[2] ? "Below Support 3" : "2× ATR Below Entry", "Structural invalidation — thesis is wrong if price reaches here");
  } else {
    // Bearish setup: entry at current price, stops above resistance, TPs below support
    entryZone = makeLevel(fmt(currentPrice), currentPrice, "Current Price", "Short entry zone at current market price");

    const riskPrice = resistances[0]
      ? fmt(resistances[0].price + effectiveAtr * 0.5)
      : fmt(currentPrice + effectiveAtr * 1.0);
    riskZone = makeLevel(riskPrice, currentPrice, "Resistance + 0.5× ATR", "Stop-loss zone above nearest resistance level");

    const risk = riskPrice - currentPrice;

    const tp1Price = supports[0] ? Math.max(currentPrice - risk, supports[0].price) : fmt(currentPrice - risk);
    profitTarget1 = makeLevel(fmt(tp1Price), currentPrice, supports[0] ? "Support 1" : "1:1 R/R", "First short target — 1:1 risk/reward ratio");

    const tp2Price = supports[1] ? Math.max(currentPrice - risk * 2, supports[1].price) : fmt(currentPrice - risk * 2);
    profitTarget2 = makeLevel(fmt(tp2Price), currentPrice, supports[1] ? "Support 2" : "2:1 R/R", "Second short target — 2:1 risk/reward ratio");

    const stretchPrice = supports[2] ? Math.min(currentPrice - risk * 3, supports[2].price) : fmt(currentPrice - risk * 3);
    stretchTarget = makeLevel(fmt(stretchPrice), currentPrice, supports[2] ? "Support 3" : "3:1 R/R", "Stretch short target — maximum downside scenario");

    const invalidPrice = resistances[2]
      ? fmt(resistances[2].price + effectiveAtr * 0.5)
      : fmt(currentPrice + effectiveAtr * 2);
    invalidationLevel = makeLevel(invalidPrice, currentPrice, resistances[2] ? "Above Resistance 3" : "2× ATR Above Entry", "Structural invalidation — short thesis fails if price reaches here");
  }

  const tradeFramework: TradeFrameworkLevels = {
    entryZone, riskZone, profitTarget1, profitTarget2, stretchTarget, invalidationLevel,
  };

  // ── Timeframe-Specific Levels ─────────────────────────────────

  // Day trade (intraday): pivot-based, tight ATR
  const dayATR = effectiveAtr;
  const dayTF: TimeframeSpecificLevels["day"] = {
    intradaySupport: makeLevel(fmt(pivots.s1), currentPrice, "Pivot S1", "Intraday pivot support — first level to watch on pullbacks"),
    intradayResistance: makeLevel(fmt(pivots.r1), currentPrice, "Pivot R1", "Intraday pivot resistance — first level to watch on rallies"),
    dayTradeTarget1: isBull
      ? makeLevel(fmt(Math.min(pivots.r1, currentPrice + dayATR * 0.75)), currentPrice, "Pivot R1 / 0.75× ATR", "Day trade target 1 — first intraday resistance zone")
      : makeLevel(fmt(Math.max(pivots.s1, currentPrice - dayATR * 0.75)), currentPrice, "Pivot S1 / 0.75× ATR", "Day trade target 1 — first intraday support zone"),
    dayTradeTarget2: isBull
      ? makeLevel(fmt(Math.min(pivots.r2, currentPrice + dayATR * 1.5)), currentPrice, "Pivot R2 / 1.5× ATR", "Day trade target 2 — second intraday resistance zone")
      : makeLevel(fmt(Math.max(pivots.s2, currentPrice - dayATR * 1.5)), currentPrice, "Pivot S2 / 1.5× ATR", "Day trade target 2 — second intraday support zone"),
    intradayInvalidation: isBull
      ? makeLevel(fmt(pivots.s2), currentPrice, "Pivot S2", "Day trade invalidation — close below S2 negates bullish intraday bias")
      : makeLevel(fmt(pivots.r2), currentPrice, "Pivot R2", "Day trade invalidation — close above R2 negates bearish intraday bias"),
  };

  // Short-term (1–5 days): 5-day structure + ATR
  const shortATR = effectiveAtr * 1.5;
  const shortTF: TimeframeSpecificLevels["short"] = {
    nearTermSupport: supports[0] ?? makeLevel(fmt(currentPrice - shortATR), currentPrice, "1.5× ATR Below", "Near-term support estimated from ATR"),
    nearTermResistance: resistances[0] ?? makeLevel(fmt(currentPrice + shortATR), currentPrice, "1.5× ATR Above", "Near-term resistance estimated from ATR"),
    target1: isBull
      ? (resistances[0] ?? makeLevel(fmt(currentPrice + shortATR), currentPrice, "1.5× ATR", "Short-term target 1"))
      : (supports[0] ?? makeLevel(fmt(currentPrice - shortATR), currentPrice, "1.5× ATR", "Short-term target 1")),
    target2: isBull
      ? (resistances[1] ?? makeLevel(fmt(currentPrice + shortATR * 2), currentPrice, "3× ATR", "Short-term target 2"))
      : (supports[1] ?? makeLevel(fmt(currentPrice - shortATR * 2), currentPrice, "3× ATR", "Short-term target 2")),
    riskLevel: isBull
      ? (supports[0] ? makeLevel(fmt(supports[0].price - effectiveAtr * 0.5), currentPrice, "Below Support 1", "Short-term stop-loss below nearest support") : makeLevel(fmt(currentPrice - shortATR), currentPrice, "1.5× ATR Below", "Short-term stop-loss"))
      : (resistances[0] ? makeLevel(fmt(resistances[0].price + effectiveAtr * 0.5), currentPrice, "Above Resistance 1", "Short-term stop-loss above nearest resistance") : makeLevel(fmt(currentPrice + shortATR), currentPrice, "1.5× ATR Above", "Short-term stop-loss")),
  };

  // Swing (1–6 weeks): 20-day structure + SMA
  const swingATR = effectiveAtr * 2.5;
  const swingSupport = supports[1] ?? (sma20 && sma20 < currentPrice ? makeLevel(fmt(sma20), currentPrice, "SMA-20", "20-day moving average swing support") : null) ?? makeLevel(fmt(low20), currentPrice, "20-Day Low", "20-session low as swing support");
  const swingResistance = resistances[1] ?? (sma50 && sma50 > currentPrice ? makeLevel(fmt(sma50), currentPrice, "SMA-50", "50-day moving average swing resistance") : null) ?? makeLevel(fmt(high20), currentPrice, "20-Day High", "20-session high as swing resistance");
  const swingTF: TimeframeSpecificLevels["swing"] = {
    swingSupport,
    swingResistance,
    swingTarget1: isBull
      ? (resistances[1] ?? makeLevel(fmt(currentPrice + swingATR), currentPrice, "2.5× ATR", "Swing target 1"))
      : (supports[1] ?? makeLevel(fmt(currentPrice - swingATR), currentPrice, "2.5× ATR", "Swing target 1")),
    swingTarget2: isBull
      ? (resistances[2] ?? makeLevel(fmt(currentPrice + swingATR * 2), currentPrice, "5× ATR", "Swing target 2"))
      : (supports[2] ?? makeLevel(fmt(currentPrice - swingATR * 2), currentPrice, "5× ATR", "Swing target 2")),
    swingInvalidation: isBull
      ? (supports[2] ? makeLevel(fmt(supports[2].price - effectiveAtr), currentPrice, "Below Support 3", "Swing invalidation — structure breakdown") : makeLevel(fmt(currentPrice - swingATR * 1.5), currentPrice, "3.75× ATR Below", "Swing invalidation level"))
      : (resistances[2] ? makeLevel(fmt(resistances[2].price + effectiveAtr), currentPrice, "Above Resistance 3", "Swing invalidation — structure breakdown") : makeLevel(fmt(currentPrice + swingATR * 1.5), currentPrice, "3.75× ATR Above", "Swing invalidation level")),
  };

  // Long-term (3–12 months): 52-week structure + SMA-200
  const ltSupportZone = sma200 && sma200 < currentPrice
    ? makeLevel(fmt(sma200), currentPrice, "SMA-200", "200-day moving average — major long-term support")
    : makeLevel(fmt(low52), currentPrice, "52-Week Low", "52-week low — long-term support floor");
  const ltResistanceZone = sma200 && sma200 > currentPrice
    ? makeLevel(fmt(sma200), currentPrice, "SMA-200", "200-day moving average — major long-term resistance")
    : makeLevel(fmt(high52), currentPrice, "52-Week High", "52-week high — long-term resistance ceiling");
  const ltATR = effectiveAtr * 8;
  const longTF: TimeframeSpecificLevels["long"] = {
    longTermSupportZone: ltSupportZone,
    longTermResistanceZone: ltResistanceZone,
    longTermTargetLow: isBull
      ? makeLevel(fmt(currentPrice + ltATR * 0.75), currentPrice, "8× ATR (Conservative)", "Long-term conservative target — 6-month upside estimate")
      : makeLevel(fmt(currentPrice - ltATR * 0.75), currentPrice, "8× ATR (Conservative)", "Long-term conservative target — 6-month downside estimate"),
    longTermTargetHigh: isBull
      ? makeLevel(fmt(Math.min(high52 * 1.1, currentPrice + ltATR * 1.5)), currentPrice, "Near 52-Week High Extension", "Long-term optimistic target — 12-month upside estimate")
      : makeLevel(fmt(Math.max(low52 * 0.9, currentPrice - ltATR * 1.5)), currentPrice, "Near 52-Week Low Extension", "Long-term optimistic target — 12-month downside estimate"),
    longTermInvalidation: isBull
      ? makeLevel(fmt(Math.max(low52, currentPrice - ltATR)), currentPrice, "52-Week Low Area", "Long-term invalidation — thesis fails below this structural level")
      : makeLevel(fmt(Math.min(high52, currentPrice + ltATR)), currentPrice, "52-Week High Area", "Long-term invalidation — short thesis fails above this structural level"),
  };

  return {
    available: true,
    insufficientDataReason: null,
    currentPrice: fmt(currentPrice),
    atr: atr ? parseFloat(atr.toFixed(currentPrice < 1 ? 4 : 2)) : null,
    atrPct,
    pivotPoint: fmt(pivots.pp),
    sma20: sma20 ? fmt(sma20) : null,
    sma50: sma50 ? fmt(sma50) : null,
    sma200: sma200 ? fmt(sma200) : null,
    bollingerUpper: boll ? fmt(boll.upper) : null,
    bollingerLower: boll ? fmt(boll.lower) : null,
    weekHigh52: fmt(high52),
    weekLow52: fmt(low52),
    supportResistance,
    tradeFramework,
    timeframeSpecific: { day: dayTF, short: shortTF, swing: swingTF, long: longTF },
    dataQuality,
    barsUsed: n,
  };
}
