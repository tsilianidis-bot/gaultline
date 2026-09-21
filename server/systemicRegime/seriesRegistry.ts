/**
 * FRED series list reused from FAULTLINE's existing provider registry.
 * Keep in sync with quant/systemic-regime/config.py.
 */
export const FRED_SERIES = [
  { id: "BAMLH0A0HYM2", limit: 10000 },
  { id: "BAMLC0A0CM", limit: 10000 },
  { id: "NFCI", limit: 5000 },
  { id: "DGS10", limit: 10000 },
  { id: "DGS2", limit: 10000 },
  { id: "T10Y2Y", limit: 10000 },
  { id: "SOFR", limit: 5000 },
  { id: "STLFSI4", limit: 5000 },
  { id: "VIXCLS", limit: 10000 },
  { id: "SP500", limit: 10000 },
] as const;
