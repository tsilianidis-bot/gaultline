import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANALYTICAL_LEGACY_ALIASES,
  CANONICAL_DESTINATIONS,
  EXPERT_WORKSPACES,
  PERSISTENT_UTILITY_BY_ID,
} from "../shared/routeRegistry";
import {
  CANONICAL_DEEP_VIEW_PATHS,
  PRESERVED_UNIQUE_APP_PATHS,
  classifyAppRoute,
} from "../shared/routeConsolidation";

const appSource = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf8");
const explicitAppRoutes = [...appSource.matchAll(/<Route\s+path="(\/app[^" ]*)"/g)].map(match => match[1]);

describe("codebase-driven route consolidation", () => {
  it("classifies every explicit protected app route", () => {
    expect(explicitAppRoutes.length).toBeGreaterThan(20);
    expect(explicitAppRoutes.filter(route => classifyAppRoute(route) === "unknown")).toEqual([]);
  });

  it("keeps the five canonical destinations and their five deep views", () => {
    expect(CANONICAL_DESTINATIONS.map(route => classifyAppRoute(route.path))).toEqual(Array(5).fill("canonical"));
    expect(CANONICAL_DEEP_VIEW_PATHS.map(classifyAppRoute)).toEqual(Array(5).fill("deep-view"));
  });

  it("keeps every expert workspace and required utility", () => {
    expect(EXPERT_WORKSPACES.map(route => classifyAppRoute(route.path))).toEqual(Array(6).fill("expert"));
    expect(classifyAppRoute(PERSISTENT_UTILITY_BY_ID.asha.path!)).toBe("utility");
    expect(classifyAppRoute(PERSISTENT_UTILITY_BY_ID.alerts.path!)).toBe("utility");
    expect(classifyAppRoute(PERSISTENT_UTILITY_BY_ID.help.path!)).toBe("utility");
    expect(classifyAppRoute(PERSISTENT_UTILITY_BY_ID.account.path!)).toBe("utility");
  });

  it("keeps every declared unique protected route mounted", () => {
    PRESERVED_UNIQUE_APP_PATHS.forEach(route => expect(explicitAppRoutes).toContain(route));
  });

  it("removes duplicate analytical mounts while retaining registry aliases", () => {
    Object.keys(ANALYTICAL_LEGACY_ALIASES)
      .filter(route => route.startsWith("/app/"))
      .forEach(route => expect(explicitAppRoutes).not.toContain(route));
    expect(appSource).not.toMatch(/component=\{(?:Alerts|HistoricalAnalogs|DailyReport|Signals|Portfolio|AftershockEngine|SeismographicDash|MarketIntelligence|CryptoRegimeDashboard|SocialIntelligence|InsiderIntelligence|TradeJournal|StockHeatmap|SimPortfolio)\}/);
  });

  it("redirects public and demo compatibility routes directly to registry-owned destinations", () => {
    expect(appSource).toContain('to={CANONICAL_DESTINATION_BY_ID.now.path}');
    expect(appSource).toContain('to={EXPERT_WORKSPACE_BY_ID["smart-discovery"].path}');
    expect(appSource).not.toMatch(/<Redirect to="\/app\/(?:dashboard|signals|diagnostic|opportunities|crypto|watchlist|portfolio|report)"/);
  });
});
