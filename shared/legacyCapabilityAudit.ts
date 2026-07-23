export type CapabilityClassification =
  | "redundant"
  | "preserve_unique"
  | "preserve_deep_or_expert";

export interface LegacyCapabilityAuditEntry {
  page: string;
  legacyPath: string | null;
  classification: CapabilityClassification;
  destination: string;
  mountPath?: string;
  source: "recovered" | "manual";
}

/**
 * Stage 4 capability ledger.
 *
 * Thirty-three rows are the recovered successful audit results. The only
 * three failed rows—Pressure, Scores, and TradePreflight—were classified by
 * direct source inspection. This is the authoritative code-level record; the
 * audit must not be rerun to reconstruct these decisions.
 */
export const LEGACY_CAPABILITY_AUDIT: readonly LegacyCapabilityAuditEntry[] = [
  { page: "Pressure", legacyPath: "/app/pressure", classification: "preserve_deep_or_expert", destination: "/app/pressure", mountPath: "/app/pressure", source: "manual" },
  { page: "Scores", legacyPath: "/app/scores", classification: "preserve_deep_or_expert", destination: "/app/pressure?tab=scores", source: "manual" },
  { page: "Charts", legacyPath: "/app/charts", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "Scenarios", legacyPath: "/app/scenarios", classification: "redundant", destination: "/app/outlook/deep", source: "recovered" },
  { page: "Alerts", legacyPath: "/app/alerts", classification: "preserve_unique", destination: "/app/alerts", mountPath: "/app/alerts", source: "recovered" },
  { page: "HistoricalAnalogs", legacyPath: "/app/analogs", classification: "preserve_deep_or_expert", destination: "/app/historical-analogs", mountPath: "/app/historical-analogs", source: "recovered" },
  { page: "SimulatePressure", legacyPath: "/app/simulate", classification: "preserve_unique", destination: "/app/simulate-pressure", mountPath: "/app/simulate-pressure", source: "recovered" },
  { page: "DailyReport", legacyPath: "/app/report", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "Watchlist", legacyPath: "/app/watchlist", classification: "preserve_unique", destination: "/app/watchlist", mountPath: "/app/watchlist", source: "recovered" },
  { page: "Signals", legacyPath: "/app/signals", classification: "preserve_unique", destination: "/app/signals", mountPath: "/app/signals", source: "recovered" },
  { page: "DiagnosticAI", legacyPath: "/app/diagnostic", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "Portfolio", legacyPath: "/app/portfolio", classification: "preserve_unique", destination: "/app/portfolio", mountPath: "/app/portfolio", source: "recovered" },
  { page: "CryptoIntelligence", legacyPath: null, classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "CryptoSearch", legacyPath: "/app/crypto-search", classification: "preserve_unique", destination: "/app/crypto-search", mountPath: "/app/crypto-search", source: "recovered" },
  { page: "CryptoWatchlist", legacyPath: "/app/crypto-watchlist", classification: "preserve_unique", destination: "/app/crypto-watchlist", mountPath: "/app/crypto-watchlist", source: "recovered" },
  { page: "AftershockEngine", legacyPath: "/app/aftershock", classification: "redundant", destination: "/app/outlook/deep", source: "recovered" },
  { page: "CryptoSignals", legacyPath: "/app/crypto-signals", classification: "preserve_unique", destination: "/app/crypto-signals", mountPath: "/app/crypto-signals", source: "recovered" },
  { page: "AltRotation", legacyPath: "/app/alt-rotation", classification: "redundant", destination: "/app/why/deep", source: "recovered" },
  { page: "TradePreflight", legacyPath: "/app/trade-preflight", classification: "preserve_deep_or_expert", destination: "/app/decision-engine#trade-preflight", source: "manual" },
  { page: "SituationRoom", legacyPath: "/app/situation-room", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "PreFlight", legacyPath: "/app/pre-flight", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "InsiderIntelligence", legacyPath: "/app/insider-intelligence", classification: "redundant", destination: "/app/watch/deep", source: "recovered" },
  { page: "StockHeatmap", legacyPath: "/app/stock-heatmap", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "SimPortfolio", legacyPath: "/app/sim-portfolio", classification: "preserve_unique", destination: "/app/sim-portfolio", mountPath: "/app/sim-portfolio", source: "recovered" },
  { page: "SocialIntelligence", legacyPath: "/app/social-intelligence", classification: "redundant", destination: "/app/watch/deep", source: "recovered" },
  { page: "TradeJournal", legacyPath: "/app/trade-journal", classification: "preserve_unique", destination: "/app/trade-journal", mountPath: "/app/trade-journal", source: "recovered" },
  { page: "Opportunities", legacyPath: "/app/opportunities", classification: "redundant", destination: "/app/act/deep", source: "recovered" },
  { page: "IntelligenceValidation", legacyPath: "/app/intelligence-validation", classification: "preserve_deep_or_expert", destination: "/app/validation", mountPath: "/app/validation", source: "recovered" },
  { page: "CryptoHub", legacyPath: "/app/crypto", classification: "preserve_unique", destination: "/app/crypto", mountPath: "/app/crypto", source: "recovered" },
  { page: "MarketCommandCenter", legacyPath: "/app/command", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "DecisionLedger", legacyPath: "/app/decision-ledger", classification: "preserve_unique", destination: "/app/decision-ledger", mountPath: "/app/decision-ledger", source: "recovered" },
  { page: "SeismographIntelligence", legacyPath: "/app/seismograph-legacy", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "SeismographicDash", legacyPath: "/app/seismograph", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "IntelligenceHub", legacyPath: "/app/intelligence-hub", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "MarketIntelligence", legacyPath: "/app/market-intelligence", classification: "redundant", destination: "/app/now/deep", source: "recovered" },
  { page: "CryptoRegimeDashboard", legacyPath: "/app/crypto-regime", classification: "redundant", destination: "/app/outlook/deep", source: "recovered" },
] as const;

export const RECOVERED_CAPABILITY_AUDIT = LEGACY_CAPABILITY_AUDIT.filter(entry => entry.source === "recovered");
export const MANUAL_CAPABILITY_AUDIT = LEGACY_CAPABILITY_AUDIT.filter(entry => entry.source === "manual");
export const PRESERVED_CAPABILITY_PATHS = LEGACY_CAPABILITY_AUDIT.flatMap(entry => entry.mountPath ? [entry.mountPath] : []);

