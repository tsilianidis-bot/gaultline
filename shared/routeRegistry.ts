export type CanonicalDestinationId = "now" | "why" | "outlook" | "watch" | "act";
export type RouteIconKey = "activity" | "network" | "telescope" | "bell" | "crosshair" | "message" | "search" | "help" | "user" | "gauge" | "brain" | "target";
export type RouteAccess = "authenticated" | "public" | "owner";
export type RouteSurface = "primary" | "utility" | "expert";
export type PersistentUtilityId = "asha" | "search" | "alerts" | "help" | "account";
export type ExpertWorkspaceId = "pressure" | "signal-outlook" | "decision-engine" | "day-trade-intelligence" | "symbol-intelligence" | "smart-discovery";

export interface CanonicalDestination {
  id: CanonicalDestinationId;
  label: string;
  shortLabel: string;
  question: string;
  path: `/app/${CanonicalDestinationId}`;
  icon: RouteIconKey;
  accent: string;
  analyticsId: string;
  searchKeywords: readonly string[];
  defaultView: string;
  views: readonly string[];
  access: "authenticated";
  surface: "primary";
  requiresAuth: true;
}

export const CANONICAL_DESTINATIONS: readonly CanonicalDestination[] = [
  { id: "now", label: "NOW", shortLabel: "NOW", question: "What is happening right now?", path: "/app/now", icon: "activity", accent: "#00E5FF", analyticsId: "destination_now", searchKeywords: ["now", "market state", "seismograph", "pressure", "markets"], defaultView: "brief", views: ["brief", "markets", "pressure", "confidence"], access: "authenticated", surface: "primary", requiresAuth: true },
  { id: "why", label: "WHY", shortLabel: "WHY", question: "Why is it happening?", path: "/app/why", icon: "network", accent: "#FFAA00", analyticsId: "destination_why", searchKeywords: ["why", "drivers", "transmission", "positioning", "history"], defaultView: "drivers", views: ["drivers", "transmission", "positioning", "history"], access: "authenticated", surface: "primary", requiresAuth: true },
  { id: "outlook", label: "OUTLOOK", shortLabel: "OUTLOOK", question: "What is most likely next?", path: "/app/outlook", icon: "telescope", accent: "#A78BFA", analyticsId: "destination_outlook", searchKeywords: ["outlook", "probabilities", "scenarios", "transition", "recovery"], defaultView: "probabilities", views: ["probabilities", "scenarios", "transition", "aftershock-recovery"], access: "authenticated", surface: "primary", requiresAuth: true },
  { id: "watch", label: "WATCH", shortLabel: "WATCH", question: "What should I keep watching?", path: "/app/watch", icon: "bell", accent: "#F97316", analyticsId: "destination_watch", searchKeywords: ["watch", "signals", "alerts", "watchlists", "portfolio"], defaultView: "signals", views: ["signals", "alerts", "watchlists", "portfolio"], access: "authenticated", surface: "primary", requiresAuth: true },
  { id: "act", label: "ACT", shortLabel: "ACT", question: "How should I respond?", path: "/app/act", icon: "crosshair", accent: "#00FF88", analyticsId: "destination_act", searchKeywords: ["act", "opportunities", "analyze", "decide", "journal"], defaultView: "opportunities", views: ["opportunities", "analyze", "decide", "journal"], access: "authenticated", surface: "primary", requiresAuth: true },
] as const;

export interface PersistentUtility { id: PersistentUtilityId; label: string; icon: RouteIconKey; kind: "route" | "action"; path?: string; analyticsId: string; searchKeywords: readonly string[]; access: "authenticated"; surface: "utility"; }
export const PERSISTENT_UTILITIES: readonly PersistentUtility[] = [
  { id: "asha", label: "ASHA", icon: "message", kind: "route", path: "/app/asha", analyticsId: "utility_asha", searchKeywords: ["asha", "ask", "advisor", "conversation"], access: "authenticated", surface: "utility" },
  { id: "search", label: "Search", icon: "search", kind: "action", analyticsId: "utility_search", searchKeywords: ["search", "command", "symbol"], access: "authenticated", surface: "utility" },
  { id: "alerts", label: "Alerts", icon: "bell", kind: "route", path: "/app/watch?view=alerts", analyticsId: "utility_alerts", searchKeywords: ["alerts", "thresholds"], access: "authenticated", surface: "utility" },
  { id: "help", label: "Help", icon: "help", kind: "route", path: "/app/guide", analyticsId: "utility_help", searchKeywords: ["help", "guide", "methodology"], access: "authenticated", surface: "utility" },
  { id: "account", label: "Account", icon: "user", kind: "route", path: "/app/account", analyticsId: "utility_account", searchKeywords: ["account", "billing", "subscription"], access: "authenticated", surface: "utility" },
] as const;

export interface ExpertWorkspace { id: ExpertWorkspaceId; label: string; path: string; owner: CanonicalDestinationId | "asha"; ownerView: string; icon: RouteIconKey; analyticsId: string; searchKeywords: readonly string[]; access: "authenticated"; surface: "expert"; }
export const EXPERT_WORKSPACES: readonly ExpertWorkspace[] = [
  { id: "pressure", label: "Pressure Engine", path: "/app/pressure", owner: "now", ownerView: "pressure", icon: "gauge", analyticsId: "expert_pressure", searchKeywords: ["pressure", "stress", "seismograph", "risk"], access: "authenticated", surface: "expert" },
  { id: "signal-outlook", label: "Signal Outlook Center", path: "/app/signal-outlook", owner: "outlook", ownerView: "probabilities", icon: "telescope", analyticsId: "expert_signal_outlook", searchKeywords: ["signal outlook", "probability", "scenario", "transition"], access: "authenticated", surface: "expert" },
  { id: "decision-engine", label: "Decision Engine", path: "/app/decision-engine", owner: "act", ownerView: "decide", icon: "crosshair", analyticsId: "expert_decision_engine", searchKeywords: ["decision", "pre-flight", "respond", "scenario"], access: "authenticated", surface: "expert" },
  { id: "day-trade-intelligence", label: "Day Trade Intelligence", path: "/app/day-trade-intelligence", owner: "act", ownerView: "decide", icon: "target", analyticsId: "expert_day_trade", searchKeywords: ["day trade", "intraday", "setup", "entry"], access: "authenticated", surface: "expert" },
  { id: "symbol-intelligence", label: "Universal Symbol Intelligence", path: "/app/symbol-intelligence", owner: "act", ownerView: "analyze", icon: "target", analyticsId: "expert_symbol_intelligence", searchKeywords: ["symbol", "asset", "ticker", "analyze"], access: "authenticated", surface: "expert" },
  { id: "smart-discovery", label: "Smart Discovery", path: "/app/discover", owner: "asha", ownerView: "workspace", icon: "brain", analyticsId: "expert_smart_discovery", searchKeywords: ["discover", "search", "asha", "research"], access: "authenticated", surface: "expert" },
] as const;

export const ANALYTICAL_LEGACY_ALIASES: Readonly<Record<string, string>> = {
  "/app/aftershock": "/app/outlook?view=aftershock-recovery", "/app/alerts": "/app/watch?view=alerts", "/app/alt-rotation": "/app/why?view=transmission", "/app/charts": "/app/act?view=analyze", "/app/crypto": "/app/now?view=markets", "/app/crypto-regime": "/app/outlook?view=transition", "/app/crypto-search": "/app/act?view=analyze", "/app/crypto-signals": "/app/watch", "/app/crypto-watchlist": "/app/watch?view=watchlists", "/app/report": "/app/now", "/app/dashboard": "/app/now", "/app/decision-ledger": "/app/act?view=journal", "/app/diagnostic": "/app/now?view=confidence", "/app/analogs": "/app/why?view=history", "/app/insider-intelligence": "/app/why?view=positioning", "/app/intelligence-hub": "/app/now", "/app/intelligence-validation": "/app/act?view=journal", "/app/command": "/app/now", "/app/market-intelligence": "/app/now", "/app/opportunities": "/app/act", "/app/portfolio": "/app/watch?view=portfolio", "/app/pre-flight": "/app/act?view=decide", "/app/scenarios": "/app/outlook?view=scenarios", "/app/scores": "/app/now?view=pressure", "/app/seismograph": "/app/now?view=pressure", "/app/signals": "/app/watch", "/app/sim-portfolio": "/app/watch?view=portfolio", "/app/simulate": "/app/act?view=decide", "/app/situation-room": "/app/act?view=decide", "/app/social-intelligence": "/app/why?view=positioning", "/app/stock-heatmap": "/app/now?view=markets", "/app/todays-story": "/app/now", "/app/trade-journal": "/app/act?view=journal", "/app/trade-preflight": "/app/act?view=decide", "/app/watchlist": "/app/watch?view=watchlists", "/app/ai-watch": "/app/watch", "/app/ask-asha": "/app/asha", "/mobile/brief": "/app/now", "/mobile/crypto": "/app/now?view=markets", "/mobile/rotation": "/app/why?view=transmission", "/mobile/signals": "/app/watch", "/mobile/watchlist": "/app/watch?view=watchlists",
};

export const CANONICAL_DESTINATION_BY_ID = Object.fromEntries(CANONICAL_DESTINATIONS.map(item => [item.id, item])) as Record<CanonicalDestinationId, CanonicalDestination>;
export const PERSISTENT_UTILITY_BY_ID = Object.fromEntries(PERSISTENT_UTILITIES.map(item => [item.id, item])) as Record<PersistentUtilityId, PersistentUtility>;
export const EXPERT_WORKSPACE_BY_ID = Object.fromEntries(EXPERT_WORKSPACES.map(item => [item.id, item])) as Record<ExpertWorkspaceId, ExpertWorkspace>;
export function stripRouteContext(route: string): string { return route.split(/[?#]/, 1)[0] || "/"; }
export function preserveRouteContext(target: string, currentSearch = "", currentHash = ""): string {
  const [targetPath, targetQuery = ""] = target.split("?");
  const merged = new URLSearchParams(currentSearch.replace(/^\?/, ""));
  new URLSearchParams(targetQuery).forEach((value, key) => merged.set(key, value));
  const query = merged.toString();
  return `${targetPath}${query ? `?${query}` : ""}${currentHash || ""}`;
}
export function getLegacyAliasTarget(pathname: string): string | undefined { return ANALYTICAL_LEGACY_ALIASES[stripRouteContext(pathname)]; }
export function resolveCanonicalDestination(pathname: string): CanonicalDestination | undefined {
  const clean = stripRouteContext(pathname);
  const direct = CANONICAL_DESTINATIONS.find(item => item.path === clean);
  if (direct) return direct;
  const expert = EXPERT_WORKSPACES.find(item => item.path === clean);
  if (expert && expert.owner !== "asha") return CANONICAL_DESTINATION_BY_ID[expert.owner];
  const target = getLegacyAliasTarget(clean);
  return target ? CANONICAL_DESTINATIONS.find(item => stripRouteContext(target) === item.path) : undefined;
}
