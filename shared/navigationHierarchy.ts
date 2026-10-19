import { CANONICAL_DESTINATIONS, CANONICAL_DESTINATION_BY_ID } from "./routeRegistry";

/**
 * The customer-facing FAULTLINE navigation hierarchy.
 *
 * This is intentionally presentation-agnostic: client surfaces choose their own
 * Lucide icon component from `icon`, while this module owns labels, paths,
 * search terms, hierarchy, and route-aware active state rules in one place.
 */
export type NavigationIconName =
  | "activity"
  | "brain"
  | "network"
  | "telescope"
  | "bell"
  | "crosshair"
  | "gauge"
  | "bar-chart"
  | "history"
  | "rotate"
  | "newspaper"
  | "radio"
  | "bitcoin"
  | "sparkles"
  | "target"
  | "search"
  | "trending-up"
  | "briefcase"
  | "book-open"
  | "file-text"
  | "user"
  | "help"
  | "graduation-cap"
  | "map"
  | "shield"
  | "users"
  | "settings"
  | "message-square"
  | "zap"
  | "globe"
  | "flask";

export type NavigationMatch = "exact" | "prefix";

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly description: string;
  readonly icon: NavigationIconName;
  /** Existing Five Questions accent for presentation surfaces. */
  readonly accent?: string;
  readonly keywords: readonly string[];
  /** Exact avoids assigning a primary question to an unrelated deep route. */
  readonly match?: NavigationMatch;
  /** Use when a destination includes a query string but route state is path-based. */
  readonly activePath?: string;
}

export interface NavigationSection {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: "primary" | "expandable" | "direct" | "more" | "admin";
  readonly items: readonly NavigationItem[];
}

const primaryItems: readonly NavigationItem[] = CANONICAL_DESTINATIONS.map(destination => ({
  id: destination.id,
  label: destination.label,
  path: destination.path,
  description: destination.question,
  icon: destination.icon as NavigationIconName,
  accent: destination.accent,
  keywords: destination.searchKeywords,
  // Deep dashboards are their own navigation items; do not light NOW for /app/now/deep.
  match: "exact",
}));

const intelligenceItems: readonly NavigationItem[] = [
  {
    id: "seismograph-deep",
    label: "Seismograph Deep Dashboard",
    path: `${CANONICAL_DESTINATION_BY_ID.now.path}/deep`,
    description: "Visual systemic-pressure dashboard and market synthesis.",
    icon: "activity",
    keywords: ["seismograph", "deep dashboard", "market state", "pressure"],
    match: "exact",
  },
  {
    id: "pressure-index",
    label: "Pressure Index",
    path: "/app/pressure",
    description: "Systemic pressure index with domain-level breakdowns.",
    icon: "gauge",
    keywords: ["pressure", "risk", "stress", "index"],
    match: "prefix",
  },
  {
    id: "global-markets",
    label: "Global Markets",
    path: "/app/markets",
    description: "Cross-market dashboard for global conditions.",
    icon: "bar-chart",
    keywords: ["markets", "global", "macro", "dashboard"],
    match: "exact",
  },
  {
    id: "historical-analogs",
    label: "Historical Analogs",
    path: "/app/historical-analogs",
    description: "Compare current conditions with historical market analogs.",
    icon: "history",
    keywords: ["analogs", "history", "historical"],
    match: "exact",
  },
  {
    id: "time-machine",
    label: "Time Machine",
    path: "/app/time-machine",
    description: "Explore prior market regimes and historical readings.",
    icon: "history",
    keywords: ["time machine", "history", "regimes"],
    match: "exact",
  },
  {
    id: "simulate-pressure",
    label: "Simulate Pressure",
    path: "/app/simulate-pressure",
    description: "Model how macro shocks affect systemic pressure.",
    icon: "rotate",
    keywords: ["simulate", "pressure", "stress test", "scenario"],
    match: "exact",
  },
];

const tradingItems: readonly NavigationItem[] = [
  {
    id: "top-opportunities-smart-discovery",
    label: "Top Opportunities / Smart Discovery",
    path: "/app/discover",
    description: "The existing Smart Discovery workspace, including its Top Opportunities capability.",
    icon: "sparkles",
    keywords: ["top opportunities", "opportunities", "smart discovery", "discover", "research", "ideas"],
    match: "exact",
  },
  {
    id: "signals",
    label: "Signals",
    path: "/app/signals",
    description: "Multi-symbol signal and momentum dashboard.",
    icon: "radio",
    keywords: ["signals", "momentum", "trading"],
    match: "prefix",
  },
  {
    id: "crypto-signals",
    label: "Crypto Signals",
    path: "/app/crypto-signals",
    description: "Crypto-specific signals and market conditions.",
    icon: "bitcoin",
    keywords: ["crypto", "signals", "digital assets"],
    match: "exact",
  },
  {
    id: "decision-engine",
    label: "Decision Engine",
    path: "/app/decision-engine",
    description: "Structured trade evaluation and risk-aware decision support.",
    icon: "crosshair",
    keywords: ["decision", "preflight", "risk reward", "trade plan"],
    match: "exact",
  },
  {
    id: "day-trade-intelligence",
    label: "Day Trade Intelligence",
    path: "/app/day-trade-intelligence",
    description: "Intraday market context and symbol-specific setups.",
    icon: "target",
    keywords: ["day trade", "intraday", "setup"],
    match: "prefix",
  },
  {
    id: "symbol-intelligence",
    label: "Symbol Intelligence",
    path: "/app/symbol-intelligence",
    description: "Deep analysis for a stock, ETF, or crypto asset.",
    icon: "search",
    keywords: ["symbol", "ticker", "asset", "analysis"],
    match: "exact",
  },
  {
    id: "signal-outlook",
    label: "Signal Outlook",
    path: "/app/signal-outlook",
    description: "Signal outlook and scenario analysis.",
    icon: "telescope",
    keywords: ["signal outlook", "scenarios", "outlook"],
    match: "exact",
  },
  {
    id: "rising-stars",
    label: "Rising Stars",
    path: "/app/rising-stars",
    description: "Discover emerging symbols and follow their intelligence.",
    icon: "trending-up",
    keywords: ["rising stars", "discover", "symbols"],
    match: "prefix",
  },
  {
    id: "market-movers",
    label: "Market Movers",
    path: "/app/market-movers",
    description: "Review notable moves, volume, and momentum leaders.",
    icon: "trending-up",
    keywords: ["movers", "volume", "momentum"],
    match: "exact",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    path: "/app/portfolio",
    description: "Review portfolio risk and regime exposure.",
    icon: "briefcase",
    keywords: ["portfolio", "risk", "positions"],
    match: "exact",
  },
  {
    id: "trade-journal",
    label: "Trade Journal",
    path: "/app/trade-journal",
    description: "Log and review trades in the existing journal.",
    icon: "book-open",
    keywords: ["journal", "trades", "review"],
    match: "exact",
  },
  {
    id: "decision-ledger",
    label: "Decision Ledger",
    path: "/app/decision-ledger",
    description: "Track and review investment decisions.",
    icon: "file-text",
    keywords: ["ledger", "decisions", "review"],
    match: "exact",
  },
];

const dailyBriefItems: readonly NavigationItem[] = [
  {
    id: "daily-brief",
    label: "DAILY BRIEF",
    path: "/daily-brief",
    description: "Current briefings; historical briefings and the intelligence library remain linked from the archive.",
    icon: "newspaper",
    keywords: ["daily brief", "briefing", "archive", "reports"],
    match: "prefix",
  },
];

const moreItems: readonly NavigationItem[] = [
  {
    id: "account",
    label: "Account",
    path: "/app/account",
    description: "Account and subscription settings.",
    icon: "user",
    keywords: ["account", "settings", "subscription"],
    match: "exact",
  },
  {
    id: "reading-history",
    label: "Reading History",
    path: "/app/reading-history",
    description: "Previously read FAULTLINE content.",
    icon: "history",
    keywords: ["reading", "history", "saved"],
    match: "exact",
  },
  {
    id: "platform-guide",
    label: "Platform Guide",
    path: "/app/guide",
    description: "How to use FAULTLINE.",
    icon: "help",
    keywords: ["guide", "help", "getting started"],
    match: "exact",
  },
  {
    id: "glossary",
    label: "Glossary",
    path: "/app/glossary",
    description: "Definitions for FAULTLINE terms.",
    icon: "graduation-cap",
    keywords: ["glossary", "definitions", "terms"],
    match: "exact",
  },
  {
    id: "methodology",
    label: "Methodology",
    path: "/methodology",
    description: "How FAULTLINE intelligence is built and scored.",
    icon: "file-text",
    keywords: ["methodology", "model", "evidence"],
    match: "exact",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    path: "/app/roadmap",
    description: "Product roadmap and planned work.",
    icon: "map",
    keywords: ["roadmap", "product", "plans"],
    match: "exact",
  },
];

/**
 * Contextual-only links retained in /app/tools. They do not become broad
 * sidebar or command-palette entries, preserving Watch and feature-gated
 * utility boundaries while keeping existing destinations reachable.
 */
export const TOOLS_HOME_CONTEXTUAL_SECTION: NavigationSection = {
  id: "contextual-access",
  label: "CONTEXTUAL ACCESS",
  kind: "more",
  items: [
    { id: "watchlist", label: "Watchlist", path: "/app/watchlist", description: "Monitor saved symbols and intelligence.", icon: "bell", keywords: ["watchlist", "monitor", "saved"], match: "exact" },
    { id: "alerts", label: "Alerts", path: "/app/alerts", description: "Configure existing thresholds and notifications.", icon: "bell", keywords: ["alerts", "thresholds", "notifications"], match: "exact" },
    { id: "crypto-intelligence", label: "Crypto Intelligence", path: "/app/crypto", description: "Crypto market intelligence workspace.", icon: "bitcoin", keywords: ["crypto", "digital assets"], match: "exact" },
    { id: "crypto-search", label: "Crypto Search", path: "/app/crypto-search", description: "Search and analyze a crypto asset.", icon: "search", keywords: ["crypto", "search", "asset"], match: "exact" },
    { id: "crypto-watchlist", label: "Crypto Watchlist", path: "/app/crypto-watchlist", description: "Monitor crypto positions with the existing watchlist.", icon: "bell", keywords: ["crypto", "watchlist"], match: "exact" },
    { id: "early-warning", label: "Early Warning", path: "/app/early-warning", description: "Pressure-related early warning detail.", icon: "gauge", keywords: ["early warning", "pressure", "risk"], match: "exact" },
    { id: "pressure-history", label: "Pressure History", path: "/app/pressure-history", description: "Historical Pressure Index detail.", icon: "history", keywords: ["pressure", "history"], match: "exact" },
    { id: "track-record", label: "Track Record", path: "/app/track-record", description: "Existing signal-performance record.", icon: "file-text", keywords: ["track record", "performance"], match: "exact" },
    { id: "intelligence-validation", label: "Intelligence Validation", path: "/app/validation", description: "Existing intelligence-validation workspace.", icon: "shield", keywords: ["validation", "intelligence"], match: "exact" },
    { id: "validation-lab", label: "Validation Lab", path: "/app/validation-lab", description: "Existing advanced validation workspace.", icon: "flask", keywords: ["validation", "lab"], match: "exact" },
    { id: "social-intelligence", label: "Social Intelligence", path: "/app/social-intelligence", description: "Existing social intelligence workspace.", icon: "message-square", keywords: ["social", "intelligence"], match: "exact" },
    { id: "insider-intelligence", label: "Insider Intelligence", path: "/app/insider-intelligence", description: "Existing insider intelligence workspace.", icon: "search", keywords: ["insider", "intelligence"], match: "exact" },
  ],
};

/** Admin-only: callsites must explicitly pass an authenticated admin before rendering or searching these. */
export const ADMIN_NAVIGATION_SECTION: NavigationSection = {
  id: "owner-portal",
  label: "OWNER PORTAL",
  kind: "admin",
  items: [
    { id: "admin-portal", label: "Owner Portal", path: "/app/admin", description: "Owner administration portal.", icon: "shield", keywords: ["admin", "owner"], match: "exact" },
    { id: "admin-demo-tokens", label: "Demo Tokens", path: "/app/admin?tab=demo", description: "Owner demo-token controls.", icon: "zap", keywords: ["admin", "demo", "tokens"], match: "exact" },
    { id: "admin-users", label: "User Management", path: "/app/admin/users", description: "Manage user accounts.", icon: "users", keywords: ["admin", "users"], match: "exact" },
    { id: "admin-engineering", label: "Engineering Diagnostics", path: "/app/admin/engineering", description: "Engineering diagnostics.", icon: "flask", keywords: ["admin", "engineering"], match: "exact" },
    { id: "admin-blog", label: "Blog Manager", path: "/app/admin/blog", description: "Manage published content.", icon: "newspaper", keywords: ["admin", "blog"], match: "exact" },
    { id: "admin-publishing", label: "Publishing", path: "/app/admin/publishing", description: "Publishing operations.", icon: "file-text", keywords: ["admin", "publishing"], match: "exact" },
    { id: "admin-chat-inbox", label: "PLATO Intelligence", path: "/app/admin/chat-inbox", description: "PLATO conversation inbox.", icon: "message-square", keywords: ["admin", "plato", "inbox"], match: "exact" },
    { id: "x-posts", label: "X Posts", path: "/app/x-posts", description: "X post generation.", icon: "zap", keywords: ["admin", "x", "posts"], match: "exact" },
    { id: "x-post-queue", label: "Post Queue", path: "/app/x-post-queue", description: "Queued X posts.", icon: "settings", keywords: ["admin", "queue", "posts"], match: "exact" },
    { id: "seo-optimizer", label: "SEO Optimizer", path: "/app/seo-optimizer", description: "SEO tooling.", icon: "globe", keywords: ["admin", "seo"], match: "exact" },
    { id: "analytics", label: "Site Analytics", path: "/app/analytics", description: "Site analytics.", icon: "bar-chart", keywords: ["admin", "analytics"], match: "exact" },
    { id: "owner-simulation", label: "Owner Simulation", path: "/owner/simulation", description: "Owner-only simulation workspace.", icon: "target", keywords: ["admin", "owner", "simulation"], match: "exact" },
    { id: "conversation-intelligence", label: "Conversation Intelligence", path: "/app/admin/conversation-intelligence", description: "Conversation intelligence workspace.", icon: "message-square", keywords: ["admin", "conversation", "intelligence"], match: "exact" },
    { id: "fmos-health", label: "FMOS Health", path: "/app/fmos-health", description: "FMOS health dashboard.", icon: "activity", keywords: ["admin", "fmos", "health"], match: "exact" },
    { id: "intel-validation", label: "Intel Validation", path: "/app/validation", description: "Intelligence validation workspace.", icon: "bar-chart", keywords: ["admin", "validation"], match: "exact" },
    { id: "shadow-monitor", label: "Shadow Monitor", path: "/app/admin/shadow-monitor", description: "Owner shadow-monitor dashboard.", icon: "settings", keywords: ["admin", "shadow", "monitor"], match: "exact" },
  ],
};

export const NAVIGATION_HIERARCHY = {
  primary: {
    id: "five-questions",
    label: "THE FIVE QUESTIONS",
    description: "Market decision framework",
    kind: "primary",
    items: primaryItems,
  } satisfies NavigationSection,
  intelligence: {
    id: "intelligence-dashboards",
    label: "INTELLIGENCE DASHBOARDS",
    description: "Deep market intelligence and visual analysis",
    kind: "expandable",
    items: intelligenceItems,
  } satisfies NavigationSection,
  trading: {
    id: "trading-tools",
    label: "TRADING TOOLS",
    description: "Signals, opportunity discovery, and decision support",
    kind: "expandable",
    items: tradingItems,
  } satisfies NavigationSection,
  dailyBrief: {
    id: "daily-brief",
    label: "DAILY BRIEF",
    kind: "direct",
    items: dailyBriefItems,
  } satisfies NavigationSection,
  more: {
    id: "more",
    label: "MORE",
    description: "Account, reference, and low-frequency utilities",
    kind: "more",
    items: moreItems,
  } satisfies NavigationSection,
} as const;

export const CUSTOMER_NAVIGATION_SECTIONS: readonly NavigationSection[] = [
  NAVIGATION_HIERARCHY.primary,
  NAVIGATION_HIERARCHY.intelligence,
  NAVIGATION_HIERARCHY.trading,
  NAVIGATION_HIERARCHY.dailyBrief,
  NAVIGATION_HIERARCHY.more,
];

export const CUSTOMER_SEARCH_ITEMS: readonly NavigationItem[] = CUSTOMER_NAVIGATION_SECTIONS.flatMap(section => section.items);

export function getSearchNavigationItems(isAdmin: boolean): readonly NavigationItem[] {
  return isAdmin ? [...CUSTOMER_SEARCH_ITEMS, ...ADMIN_NAVIGATION_SECTION.items] : CUSTOMER_SEARCH_ITEMS;
}

function cleanRoute(value: string): string {
  const path = value.split(/[?#]/, 1)[0] || "/";
  return path.replace(/\/+$/, "") || "/";
}

/** Match only complete route segments, never an accidental string prefix. */
export function isNavigationItemActive(item: NavigationItem, location: string): boolean {
  const currentPath = cleanRoute(location);
  const itemPath = cleanRoute(item.activePath ?? item.path);
  if (item.match === "prefix") return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  return currentPath === itemPath;
}

export function sectionHasActiveItem(section: NavigationSection, location: string): boolean {
  return section.items.some(item => isNavigationItemActive(item, location));
}
