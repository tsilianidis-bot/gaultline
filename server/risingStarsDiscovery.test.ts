import { describe, expect, it } from "vitest";
import { classifyListingAge, classifyMarketCap, deriveFaultlineThemes, deriveSector, isApprovedPublicCompany, matchesDiscoveryFilters } from "./risingStarsDiscovery";

describe("Rising Stars public-market discovery taxonomy", () => {
  it("uses one canonical dynamic market-cap taxonomy", () => {
    expect(classifyMarketCap(1_999_999_999)).toBe("small");
    expect(classifyMarketCap(2_000_000_000)).toBe("mid");
    expect(classifyMarketCap(10_000_000_000)).toBe("large");
    expect(classifyMarketCap(200_000_000_000)).toBe("mega");
    expect(classifyMarketCap(null)).toBeNull();
  });

  it("derives listing-age bands from public listing dates rather than company age", () => {
    const now = Date.parse("2026-08-15T00:00:00Z");
    expect(classifyListingAge("2026-03-01", now).category).toBe("under_1y");
    expect(classifyListingAge("2024-08-01", now).category).toBe("one_to_three_y");
    expect(classifyListingAge("2020-01-01", now).category).toBe("three_plus_y");
  });

  it("permits only active approved-exchange public companies", () => {
    expect(isApprovedPublicCompany({ exchangeCode: "XNAS", active: true })).toBe(true);
    expect(isApprovedPublicCompany({ exchangeCode: "OTC", active: true })).toBe(false);
    expect(isApprovedPublicCompany({ exchangeCode: "XNYS", active: false })).toBe(false);
  });

  it("derives themes only from source profile text", () => {
    expect(deriveFaultlineThemes({ industry: "Semiconductors", description: "Data center connectivity for artificial intelligence workloads" })).toEqual(expect.arrayContaining(["AI Infrastructure", "Semiconductors"]));
    expect(deriveFaultlineThemes({ industry: null, description: null })).toEqual([]);
  });

  it("maps a sector from profile text without a symbol-maintained classification list", () => {
    expect(deriveSector({ industry: "Aerospace and Defense", description: "Launch systems and satellite services" })).toBe("Industrials");
    expect(deriveSector({ industry: null, description: null })).toBeNull();
  });

  it("requires every selected discovery filter to match without inventing unavailable classifications", () => {
    const candidate = { marketCapCategory: "small" as const, listingAgeCategory: "one_to_three_y" as const, sector: "Technology", themes: ["AI Infrastructure"], isMagnificentSeven: false, momentumScore: 78, riskLevel: "MODERATE" as const };
    expect(matchesDiscoveryFilters(candidate, { category: "small", listingAge: "one_to_three_y", sector: "Technology", theme: "AI Infrastructure", characteristic: "momentum" })).toBe(true);
    expect(matchesDiscoveryFilters(candidate, { category: "small", listingAge: "under_1y", sector: "Technology" })).toBe(false);
    expect(matchesDiscoveryFilters({ ...candidate, marketCapCategory: null }, { category: "small" })).toBe(false);
  });

  it("keeps the Magnificent Seven as an explicit benchmark-group filter", () => {
    const candidate = { marketCapCategory: "mega" as const, listingAgeCategory: "three_plus_y" as const, sector: "Technology", themes: [], isMagnificentSeven: true, momentumScore: 50, riskLevel: "MODERATE" as const };
    expect(matchesDiscoveryFilters(candidate, { category: "mag7" })).toBe(true);
    expect(matchesDiscoveryFilters({ ...candidate, isMagnificentSeven: false }, { category: "mag7" })).toBe(false);
  });
});
