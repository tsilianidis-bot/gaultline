// ============================================================
// FMOS Engine 1 — Data Acquisition Engine
// (server/fmos/engines/dataAcquisition.ts)
//
// Collects and normalizes data from all market sources into
// a common internal structure. This is the entry point for
// all data flowing into the FMOS pipeline.
//
// Data Sources:
//   - FRED (macroeconomic indicators)
//   - Polygon.io (equities, ETFs, options)
//   - CoinGecko (crypto)
//   - Yahoo Finance (portfolio quotes)
//   - Social intelligence (sentiment)
//
// All data is normalized to FMOSMarketData before being
// consumed by downstream engines.
// ============================================================

import { clamp } from "../utils";

// ── Normalized Market Data Types ──────────────────────────────

export interface FMOSMacroData {
  /** High-yield credit spread in basis points */
  hySpreadBps: number | null;
  /** 10-year Treasury yield (%) */
  tsy10y: number | null;
  /** 2-year Treasury yield (%) */
  tsy2y: number | null;
  /** Yield curve spread (10Y - 2Y) in basis points */
  yieldCurveSpread: number | null;
  /** SOFR rate (%) */
  sofr: number | null;
  /** Fed Funds rate (%) */
  fedFunds: number | null;
  /** CPI year-over-year change (%) */
  cpiYoY: number | null;
  /** PPI year-over-year change (%) */
  ppiYoY: number | null;
  /** Unemployment rate (%) */
  unemployment: number | null;
  /** Data freshness */
  dataSource: "live" | "fallback";
  /** Timestamp of data fetch */
  fetchedAt: string;
}

export interface FMOSEquityData {
  /** Ticker symbol */
  symbol: string;
  /** Current price */
  price: number | null;
  /** Daily change % */
  changePercent: number | null;
  /** Volume */
  volume: number | null;
  /** Market cap */
  marketCap: number | null;
  /** Sector */
  sector: string | null;
  /** 5-day sparkline */
  sparkline: number[];
  /** Data freshness */
  dataSource: "live" | "stale" | "fallback";
}

export interface FMOSCryptoData {
  /** Coin symbol (e.g., BTC) */
  symbol: string;
  /** Current price in USD */
  priceUsd: number | null;
  /** 24h change % */
  change24h: number | null;
  /** Market cap */
  marketCap: number | null;
  /** 24h volume */
  volume24h: number | null;
  /** Market dominance % (BTC/ETH only) */
  dominance: number | null;
}

export interface FMOSMarketData {
  /** Macroeconomic indicators */
  macro: FMOSMacroData;
  /** Equity data (if symbol-specific analysis) */
  equity?: FMOSEquityData;
  /** Crypto data (if crypto analysis) */
  crypto?: FMOSCryptoData;
  /** Timestamp */
  timestamp: string;
  /** Whether all critical data sources are available */
  complete: boolean;
  /** Any data acquisition errors */
  errors: string[];
}

// ── Data Acquisition Functions ────────────────────────────────

/**
 * Fetch and normalize macroeconomic data from FRED.
 * This wraps the existing FRED bulk endpoint used by calculateFaultlinePressure().
 */
export async function fetchMacroData(
  baseUrl = "http://localhost:3000"
): Promise<FMOSMacroData> {
  const FRED_SERIES = [
    { id: "BAMLH0A0HYM2", limit: 2 },
    { id: "DGS10", limit: 2 },
    { id: "DGS2", limit: 2 },
    { id: "SOFR", limit: 2 },
    { id: "CPIAUCSL", limit: 14 },
    { id: "PPIACO", limit: 14 },
    { id: "FEDFUNDS", limit: 2 },
    { id: "UNRATE", limit: 2 },
  ];

  const fallback: FMOSMacroData = {
    hySpreadBps: 350,
    tsy10y: 4.5,
    tsy2y: 4.8,
    yieldCurveSpread: -30,
    sofr: 5.3,
    fedFunds: 5.25,
    cpiYoY: 3.5,
    ppiYoY: 2.8,
    unemployment: 4.0,
    dataSource: "fallback",
    fetchedAt: new Date().toISOString(),
  };

  function latestValid(obs: { date: string; value: string }[]): number | null {
    for (const o of obs) {
      if (o.value !== "." && o.value !== "") {
        const n = parseFloat(o.value);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/api/fred/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series: FRED_SERIES }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return fallback;

    const bulk = await res.json() as {
      results: Record<string, { observations: { date: string; value: string }[] }>;
    };
    const r = bulk.results;

    const hyRaw = latestValid(r["BAMLH0A0HYM2"]?.observations ?? []);
    const hySpreadBps = hyRaw !== null ? (hyRaw > 20 ? hyRaw : hyRaw * 100) : null;
    const tsy10y = latestValid(r["DGS10"]?.observations ?? []);
    const tsy2y = latestValid(r["DGS2"]?.observations ?? []);
    const yieldCurveSpread = tsy10y !== null && tsy2y !== null
      ? Math.round((tsy10y - tsy2y) * 100)
      : null;

    // CPI YoY
    const cpiObs = r["CPIAUCSL"]?.observations ?? [];
    let cpiYoY: number | null = null;
    if (cpiObs.length >= 13) {
      const latest = latestValid(cpiObs.slice(0, 1));
      const yearAgo = latestValid(cpiObs.slice(12, 13));
      if (latest !== null && yearAgo !== null && yearAgo > 0) {
        cpiYoY = Math.round(((latest - yearAgo) / yearAgo) * 1000) / 10;
      }
    }

    // PPI YoY
    const ppiObs = r["PPIACO"]?.observations ?? [];
    let ppiYoY: number | null = null;
    if (ppiObs.length >= 13) {
      const latest = latestValid(ppiObs.slice(0, 1));
      const yearAgo = latestValid(ppiObs.slice(12, 13));
      if (latest !== null && yearAgo !== null && yearAgo > 0) {
        ppiYoY = Math.round(((latest - yearAgo) / yearAgo) * 1000) / 10;
      }
    }

    return {
      hySpreadBps,
      tsy10y,
      tsy2y,
      yieldCurveSpread,
      sofr: latestValid(r["SOFR"]?.observations ?? []),
      fedFunds: latestValid(r["FEDFUNDS"]?.observations ?? []),
      cpiYoY,
      ppiYoY,
      unemployment: latestValid(r["UNRATE"]?.observations ?? []),
      dataSource: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

/**
 * Fetch and normalize equity data for a specific symbol.
 * Wraps the existing Polygon.io proxy.
 */
export async function fetchEquityData(
  symbol: string,
  baseUrl = "http://localhost:3000"
): Promise<FMOSEquityData> {
  try {
    const res = await fetch(`${baseUrl}/api/signals/ticker/${symbol.toUpperCase()}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { symbol, price: null, changePercent: null, volume: null, marketCap: null, sector: null, sparkline: [], dataSource: "fallback" };
    }
    const data = await res.json() as {
      price?: number;
      changePercent?: number;
      volume?: number;
      marketCap?: number;
      sector?: string;
      sparkline?: number[];
      source?: string;
    };
    return {
      symbol,
      price: data.price ?? null,
      changePercent: data.changePercent ?? null,
      volume: data.volume ?? null,
      marketCap: data.marketCap ?? null,
      sector: data.sector ?? null,
      sparkline: data.sparkline ?? [],
      dataSource: data.source === "live" ? "live" : data.source === "stale" ? "stale" : "fallback",
    };
  } catch {
    return { symbol, price: null, changePercent: null, volume: null, marketCap: null, sector: null, sparkline: [], dataSource: "fallback" };
  }
}

/**
 * Assemble a complete FMOSMarketData object for the pipeline.
 */
export async function acquireMarketData(
  options: {
    symbol?: string;
    assetType?: "stock" | "crypto" | "etf" | "market";
    baseUrl?: string;
  } = {}
): Promise<FMOSMarketData> {
  const { symbol, assetType, baseUrl = "http://localhost:3000" } = options;
  const errors: string[] = [];

  // Always fetch macro data
  const macro = await fetchMacroData(baseUrl);
  if (macro.dataSource === "fallback") {
    errors.push("FRED macro data unavailable — using fallback values");
  }

  // Fetch equity data if symbol provided and it's a stock/ETF
  let equity: FMOSEquityData | undefined;
  if (symbol && (assetType === "stock" || assetType === "etf" || !assetType)) {
    equity = await fetchEquityData(symbol, baseUrl);
    if (equity.dataSource === "fallback") {
      errors.push(`Equity data for ${symbol} unavailable`);
    }
  }

  return {
    macro,
    equity,
    timestamp: new Date().toISOString(),
    complete: errors.length === 0,
    errors,
  };
}

// ── Score Derivation Helpers ──────────────────────────────────

/**
 * Derive a liquidity stress score (0–100) from macro data.
 * Higher = more stressed.
 */
export function deriveLiquidityScore(macro: FMOSMacroData): number {
  const hyScore = macro.hySpreadBps !== null
    ? clamp(Math.round((macro.hySpreadBps - 200) / 6), 0, 100)
    : 40;
  const curveScore = macro.yieldCurveSpread !== null
    ? clamp(Math.round((-macro.yieldCurveSpread - 0) / 2), 0, 100)
    : 30;
  return clamp(Math.round(hyScore * 0.6 + curveScore * 0.4));
}

/**
 * Derive a credit contagion score (0–100) from macro data.
 * Higher = more credit stress.
 */
export function deriveCreditScore(macro: FMOSMacroData): number {
  const hyScore = macro.hySpreadBps !== null
    ? clamp(Math.round((macro.hySpreadBps - 200) / 6), 0, 100)
    : 35;
  return hyScore;
}

/**
 * Derive a macro sensitivity score (0–100) from macro data.
 * Higher = more macro headwinds.
 */
export function deriveMacroScore(macro: FMOSMacroData): number {
  const inflationScore = macro.cpiYoY !== null
    ? clamp(Math.round((macro.cpiYoY - 2) * 15), 0, 100)
    : 30;
  const unemploymentScore = macro.unemployment !== null
    ? clamp(Math.round((macro.unemployment - 3.5) * 20), 0, 100)
    : 25;
  return clamp(Math.round(inflationScore * 0.6 + unemploymentScore * 0.4));
}
