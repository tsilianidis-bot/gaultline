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
import { fetchFredBulk } from "../../fredClient";
import {
  PRESSURE_FRED_SERIES,
  resolveVerifiedInputs,
  type FaultlinePressureOutput,
  type PressureInputProvenance,
} from "../../pressure/engine";

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
  /** Data freshness. `unavailable` is never populated with substitute FRED values. */
  dataSource: "live" | "unavailable";
  /** Timestamp of data fetch */
  fetchedAt: string;
  /** Verified Pressure computation timestamp backing this macro snapshot. */
  macroAsOf: string | null;
  /** Canonical source attribution; null means no verified source snapshot exists. */
  source: "FRED" | null;
  /** Provider attribution is present only for a verified FRED snapshot. */
  provider: "FRED" | null;
  /** Observation date for each normalized input, preserving FRED publication lag. */
  observationDates: Record<string, string | null>;
  /** Reason inputs were withheld rather than defaulted. */
  unavailableReason?: string;
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

const FMOS_MACRO_INPUT_IDS = ["hySpread", "tsy10y", "tsy2y", "sofr", "fedFunds", "cpi", "ppi", "unemployment"] as const;

function unavailableMacroData(reason: string, fetchedAt = new Date().toISOString()): FMOSMacroData {
  const observationDates = Object.fromEntries(FMOS_MACRO_INPUT_IDS.map(id => [id, null]));
  return {
    hySpreadBps: null,
    tsy10y: null,
    tsy2y: null,
    yieldCurveSpread: null,
    sofr: null,
    fedFunds: null,
    cpiYoY: null,
    ppiYoY: null,
    unemployment: null,
    dataSource: "unavailable",
    fetchedAt,
    macroAsOf: null,
    source: null,
    provider: null,
    observationDates,
    unavailableReason: reason,
  };
}

/**
 * Normalize a complete, verified FRED input provenance set. This intentionally
 * has no per-field defaults: a partial FRED reading is unavailable as a whole.
 */
function macroFromVerifiedInputs(inputs: PressureInputProvenance[], fetchedAt: string): FMOSMacroData {
  const byId = new Map(inputs.map(input => [input.inputId, input]));
  const verified = FMOS_MACRO_INPUT_IDS.map(id => byId.get(id));
  if (
    !isFiniteIsoTimestamp(fetchedAt) ||
    verified.some(input => !input || input.status !== "verified" || input.value === null || !Number.isFinite(input.value) || !isFiniteIsoDate(input.observationDate))
  ) {
    return unavailableMacroData("Required FRED macro inputs were not all verified", fetchedAt);
  }

  const value = (id: typeof FMOS_MACRO_INPUT_IDS[number]) => byId.get(id)!.value as number;
  const observationDates = Object.fromEntries(FMOS_MACRO_INPUT_IDS.map(id => [id, byId.get(id)?.observationDate ?? null]));
  const tsy10y = value("tsy10y");
  const tsy2y = value("tsy2y");
  return {
    hySpreadBps: value("hySpread"),
    tsy10y,
    tsy2y,
    yieldCurveSpread: Math.round((tsy10y - tsy2y) * 100),
    sofr: value("sofr"),
    fedFunds: value("fedFunds"),
    cpiYoY: value("cpi"),
    ppiYoY: value("ppi"),
    unemployment: value("unemployment"),
    dataSource: "live",
    fetchedAt,
    macroAsOf: fetchedAt,
    source: "FRED",
    provider: "FRED",
    observationDates,
  };
}

function isFiniteIsoTimestamp(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isFiniteIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Guard for downstream engines that must not classify or score from a partial
 * macro object. Both numeric inputs and FRED source/as-of provenance are
 * required, preventing a caller from relabelling hand-filled values as live.
 */
export function hasVerifiedFmosMacroInputs(macro: FMOSMacroData): boolean {
  const values = [
    macro.hySpreadBps,
    macro.tsy10y,
    macro.tsy2y,
    macro.yieldCurveSpread,
    macro.sofr,
    macro.fedFunds,
    macro.cpiYoY,
    macro.ppiYoY,
    macro.unemployment,
  ];
  return macro.dataSource === "live"
    && macro.provider === "FRED"
    && macro.source === "FRED"
    && isFiniteIsoTimestamp(macro.macroAsOf)
    && values.every(Number.isFinite)
    && FMOS_MACRO_INPUT_IDS.every(inputId => isFiniteIsoDate(macro.observationDates[inputId]));
}

/**
 * Reuse the one verified FRED snapshot already consumed by the Pressure Engine.
 * A stale or otherwise non-verified pressure result cannot be re-labelled as
 * fresh macro evidence, so its FMOS macro fields are explicitly unavailable.
 */
export function adaptVerifiedPressureToFmosMacro(pressure: FaultlinePressureOutput): FMOSMacroData {
  const verification = pressure.verification;
  if (verification?.status !== "verified") {
    return unavailableMacroData(
      verification?.problems.join("; ") || "Pressure verification is not a current verified FRED snapshot",
      verification?.computedAt ?? pressure.lastUpdated ?? new Date().toISOString(),
    );
  }
  return macroFromVerifiedInputs(verification.inputs, verification.computedAt);
}

/**
 * Fetch a real FRED snapshot only for standalone acquisition consumers. The
 * pipeline itself calls `adaptVerifiedPressureToFmosMacro` so it does not race
 * a second macro observation against the Pressure Engine's verified snapshot.
 */
export async function fetchMacroData(_baseUrl = "http://localhost:3000"): Promise<FMOSMacroData> {
  try {
    const bulk = await fetchFredBulk(PRESSURE_FRED_SERIES);
    const resolved = resolveVerifiedInputs(bulk.results, new Date());
    if (!resolved.ok) return unavailableMacroData(resolved.problems.join("; "));
    return macroFromVerifiedInputs(resolved.provenance, new Date().toISOString());
  } catch (error) {
    return unavailableMacroData(`FRED fetch failed: ${error instanceof Error ? error.message : String(error)}`);
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

  // Always fetch macro data. Unavailable means fields remain null; no FRED
  // substitute values are permitted at this boundary.
  const macro = await fetchMacroData(baseUrl);
  if (macro.dataSource === "unavailable") {
    errors.push(`FRED macro data unavailable${macro.unavailableReason ? `: ${macro.unavailableReason}` : ""}`);
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
export function deriveLiquidityScore(macro: FMOSMacroData): number | null {
  if (macro.hySpreadBps === null || macro.yieldCurveSpread === null) return null;
  const hyScore = clamp(Math.round((macro.hySpreadBps - 200) / 6), 0, 100);
  const curveScore = clamp(Math.round((-macro.yieldCurveSpread - 0) / 2), 0, 100);
  return clamp(Math.round(hyScore * 0.6 + curveScore * 0.4));
}

/**
 * Derive a credit contagion score (0–100) from macro data.
 * Higher = more credit stress.
 */
export function deriveCreditScore(macro: FMOSMacroData): number | null {
  if (macro.hySpreadBps === null) return null;
  return clamp(Math.round((macro.hySpreadBps - 200) / 6), 0, 100);
}

/**
 * Derive a macro sensitivity score (0–100) from macro data.
 * Higher = more macro headwinds.
 */
export function deriveMacroScore(macro: FMOSMacroData): number | null {
  if (macro.cpiYoY === null || macro.unemployment === null) return null;
  const inflationScore = clamp(Math.round((macro.cpiYoY - 2) * 15), 0, 100);
  const unemploymentScore = clamp(Math.round((macro.unemployment - 3.5) * 20), 0, 100);
  return clamp(Math.round(inflationScore * 0.6 + unemploymentScore * 0.4));
}
