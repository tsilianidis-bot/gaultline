import { describe, expect, it } from "vitest";
import { cryptoScreenerStatus } from "../client/src/lib/cryptoScreenerStatus";

describe("cryptoScreenerStatus", () => {
  it("never labels an errored or unavailable response as live", () => {
    expect(cryptoScreenerStatus({ hasData: false, hasError: true, isFetching: false }))
      .toEqual({ label: "MARKET DATA UNAVAILABLE", color: "#FF2D55", available: false });
    expect(cryptoScreenerStatus({ hasData: false, hasError: false, isFetching: false }))
      .toEqual({ label: "MARKET DATA UNAVAILABLE", color: "#64748B", available: false });
  });

  it("identifies a successful source response without asserting LIVE", () => {
    expect(cryptoScreenerStatus({ hasData: true, hasError: false, isFetching: false }))
      .toEqual({ label: "COINGECKO DATA AVAILABLE", color: "#00D4FF", available: true });
  });

  it("retains qualified data status while refreshing a prior successful response", () => {
    expect(cryptoScreenerStatus({ hasData: true, hasError: false, isFetching: true }))
      .toEqual({ label: "REFRESHING COINGECKO DATA", color: "#FFD700", available: true });
  });
});
