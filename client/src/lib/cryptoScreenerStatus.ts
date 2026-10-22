export interface CryptoScreenerStatusInput {
  hasData: boolean;
  hasError: boolean;
  isFetching: boolean;
}

export interface CryptoScreenerStatus {
  label: string;
  color: string;
  available: boolean;
}

/**
 * Customer-facing source state. A provider name is never paired with LIVE
 * unless a separately verified live-data contract exists.
 */
export function cryptoScreenerStatus({ hasData, hasError, isFetching }: CryptoScreenerStatusInput): CryptoScreenerStatus {
  if (hasError) {
    return { label: "MARKET DATA UNAVAILABLE", color: "#FF2D55", available: false };
  }

  if (hasData) {
    return {
      label: isFetching ? "REFRESHING COINGECKO DATA" : "COINGECKO DATA AVAILABLE",
      color: isFetching ? "#FFD700" : "#00D4FF",
      available: true,
    };
  }

  return {
    label: isFetching ? "LOADING MARKET DATA" : "MARKET DATA UNAVAILABLE",
    color: isFetching ? "#FFD700" : "#64748B",
    available: false,
  };
}
