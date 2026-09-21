/**
 * FRED series list reused from FAULTLINE's existing provider registry.
 * Keep in sync with quant/systemic-regime/config.py.
 */
export const FRED_SERIES = [
  { id: "BAMLH0A0HYM2", limit: 10000, sortOrder: "desc" as const },
  { id: "BAMLC0A0CM", limit: 10000, sortOrder: "desc" as const },
  { id: "NFCI", limit: 5000, sortOrder: "desc" as const },
  { id: "DGS10", limit: 10000, sortOrder: "desc" as const },
  { id: "DGS2", limit: 10000, sortOrder: "desc" as const },
  { id: "T10Y2Y", limit: 10000, sortOrder: "desc" as const },
  { id: "SOFR", limit: 5000, sortOrder: "desc" as const },
  { id: "STLFSI4", limit: 5000, sortOrder: "desc" as const },
  { id: "VIXCLS", limit: 10000, sortOrder: "desc" as const },
  { id: "SP500", limit: 10000, sortOrder: "desc" as const },
] as const;
