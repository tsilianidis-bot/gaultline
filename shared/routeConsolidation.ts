import {
  ANALYTICAL_LEGACY_ALIASES,
  CANONICAL_DESTINATIONS,
  EXPERT_WORKSPACES,
  PERSISTENT_UTILITIES,
  stripRouteContext,
} from "./routeRegistry";

export type RouteTreatment =
  | "canonical"
  | "deep-view"
  | "expert"
  | "utility"
  | "unique"
  | "legacy-alias"
  | "unknown";

export const CANONICAL_DEEP_VIEW_PATHS = [
  "/app/now/deep",
  "/app/why/deep",
  "/app/outlook/deep",
  "/app/watch/deep",
  "/app/act/deep",
] as const;

export const PRESERVED_UNIQUE_APP_PATHS = [
  "/app/historical-analogs",
  "/app/simulate-pressure",
  "/app/watchlist",
  "/app/signals",
  "/app/portfolio",
  "/app/crypto",
  "/app/crypto-search",
  "/app/crypto-watchlist",
  "/app/crypto-signals",
  "/app/sim-portfolio",
  "/app/trade-journal",
  "/app/validation",
  "/app/decision-ledger",
  "/app/roadmap",
  "/app/admin",
  "/app/admin/users",
  "/app/admin/engineering",
  "/app/admin/conversation-intelligence",
  "/app/admin/blog",
  "/app/admin/publishing",
  "/app/admin/chat-inbox",
  "/app/asha-intelligence",
  "/app/x-posts",
  "/app/x-post-queue",
  "/app/market-movers",
  "/app/glossary",
  "/app/blog/:slug",
  "/app/blog",
  "/app/track-record",
  "/app/reading-history",
  "/app/seo-optimizer",
  "/app/analytics",
  "/app/validation-lab",
  "/app/fmos-health",
] as const;

const canonicalPaths = new Set(CANONICAL_DESTINATIONS.map(route => route.path));
const deepPaths = new Set<string>(CANONICAL_DEEP_VIEW_PATHS);
const expertPaths = new Set(EXPERT_WORKSPACES.map(route => route.path));
const utilityTargets = new Set(
  PERSISTENT_UTILITIES.flatMap(route => route.path ? [route.path] : []),
);
const uniquePaths = new Set<string>(PRESERVED_UNIQUE_APP_PATHS);

export function classifyAppRoute(route: string): RouteTreatment {
  if (utilityTargets.has(route)) return "utility";
  const clean = stripRouteContext(route);
  if (canonicalPaths.has(clean as (typeof CANONICAL_DESTINATIONS)[number]["path"])) return "canonical";
  if (deepPaths.has(clean)) return "deep-view";
  if (expertPaths.has(clean)) return "expert";
  if (Object.hasOwn(ANALYTICAL_LEGACY_ALIASES, clean)) return "legacy-alias";
  if (clean === "/app" || uniquePaths.has(clean)) return "unique";
  return "unknown";
}
