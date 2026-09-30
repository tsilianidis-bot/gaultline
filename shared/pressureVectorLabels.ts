/**
 * Customer-facing display text for the six Pressure Index vectors.
 *
 * Display text only. The vector ids (keys) are internal identifiers used by
 * the engine, the canonical state, the database and the APIs, and must stay
 * unchanged. Labels name what each vector actually computes in
 * server/pressure/engine.ts:
 *
 *  - "volatility-regime" reads the 10Y–2Y Treasury spread and the 10Y level
 *    (DGS10, DGS2). It does not read VIX or realized volatility.
 *  - "market-breadth" reads unemployment and the 10Y yield (UNRATE, DGS10).
 *    It is not an advance/decline or participation measure.
 *  - "ai-bubble" uses a static AI-concentration reference value (~32.4% of the
 *    S&P 500, scored as a fixed 65), adjusted by the live 10Y yield and HY
 *    spread. The baseline is not a live measurement.
 */

export interface PressureVectorDisplay {
  /** Full display label */
  label: string;
  /** Compact uppercase label for dense visualizations */
  shortLabel: string;
  /** One-sentence description of the actual inputs */
  description: string;
}

export const PRESSURE_VECTOR_DISPLAY: Readonly<Record<string, PressureVectorDisplay>> = {
  "liquidity-stress": {
    label: "Liquidity Stress",
    shortLabel: "LIQUIDITY",
    description: "Credit market liquidity measured via HY spreads and short-term funding rates",
  },
  "credit-contagion": {
    label: "Credit Contagion Risk",
    shortLabel: "CREDIT",
    description: "Risk of credit stress spreading across sectors via spread widening and rate pressure",
  },
  "volatility-regime": {
    label: "Yield Curve (10Y–2Y) & 10Y Level",
    shortLabel: "YIELD CURVE",
    description: "10Y–2Y Treasury curve shape blended with the 10Y yield level. Does not read VIX or realized volatility.",
  },
  "macro-sensitivity": {
    label: "Macro Sensitivity",
    shortLabel: "MACRO",
    description: "Inflation and Fed policy stance creating headwinds for risk assets",
  },
  "market-breadth": {
    label: "Labor & Rates (Unemployment, 10Y)",
    shortLabel: "LABOR/RATES",
    description: "Unemployment rate blended with the 10Y Treasury yield. Not an advance/decline or market-participation breadth measure.",
  },
  "ai-bubble": {
    label: "AI / Speculation (Static Baseline)",
    shortLabel: "AI BASELINE",
    description: "Static reference value for AI mega-cap concentration (~32.4% of the S&P 500; not a live measurement), adjusted by the live 10Y yield and HY spread.",
  },
};

/** Input id of the static AI-concentration baseline in the live input-quality manifest. */
export const AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID = "ai_concentration_static_baseline";

/** Display label for a Pressure Index vector id; falls back to the supplied name or the id. */
export function pressureVectorLabel(id: string, fallback?: string | null): string {
  return PRESSURE_VECTOR_DISPLAY[id]?.label ?? fallback ?? id;
}

/** Compact display label for a Pressure Index vector id. */
export function pressureVectorShortLabel(id: string, fallback?: string | null): string {
  return PRESSURE_VECTOR_DISPLAY[id]?.shortLabel ?? fallback ?? id.toUpperCase();
}
