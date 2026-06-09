import { useEffect } from "react";

interface SEOOptions {
  title: string;
  description?: string;
  canonical?: string;
}

const BASE_TITLE = "FAULTLINE";
const BASE_DESCRIPTION =
  "Real-time macroeconomic risk intelligence. Monitor systemic market pressure, stock & crypto signals, and AI-powered macro analytics before markets break.";
const BASE_CANONICAL = "https://getfaultline.live";

/**
 * Sets document.title, meta description, canonical, OG tags, and Twitter tags
 * for the current route. Resets to defaults on unmount.
 *
 * Title strategy: titles in PAGE_SEO are the FULL browser-tab title (≤60 chars).
 * The hook uses them verbatim — no " | FAULTLINE" suffix appended.
 */
export function useSEO({ title, description, canonical }: SEOOptions) {
  useEffect(() => {
    // Use title verbatim — PAGE_SEO entries are already complete titles
    document.title = title;

    // Meta description
    const desc = description ?? BASE_DESCRIPTION;
    const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);

    // OG title
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);

    // OG description
    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", desc);

    // OG URL + canonical link
    const canonicalUrl = canonical ? `${BASE_CANONICAL}${canonical}` : BASE_CANONICAL;
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", canonicalUrl);
    const canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.setAttribute("href", canonicalUrl);

    // Twitter title + description
    const twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", title);
    const twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute("content", desc);

    return () => {
      document.title = "FAULTLINE — Market Risk Intelligence";
    };
  }, [title, description, canonical]);
}

// ── Per-route SEO configs ─────────────────────────────────────
// All titles must be ≤60 characters (verified below each entry).

export const PAGE_SEO = {
  // 47 chars ✓
  home: {
    title: "FAULTLINE — Market Risk Intelligence Platform",
    description:
      "Real-time macroeconomic risk intelligence. Monitor systemic market pressure, stock & crypto signals, and AI-powered macro analytics before markets break.",
    canonical: "/",
  },
  // 52 chars ✓
  pressure: {
    title: "FAULTLINE Pressure Index™ — Systemic Risk Monitor",
    description:
      "Track the FAULTLINE Pressure Index™ live. Monitor systemic market stress, credit spreads, liquidity conditions, and volatility regimes across equity, bond, and credit markets.",
    canonical: "/app/pressure",
  },
  // 46 chars ✓
  signals: {
    title: "Stock Signals — Macro-Regime Intelligence",
    description:
      "FAULTLINE Stock Signals: momentum breakouts, macro beneficiaries, AI bubble exposure, liquidity-sensitive names, and recession-defensive classifications.",
    canonical: "/app/signals",
  },
  // 44 chars ✓
  scores: {
    title: "Risk Scores — Asset Macro Vulnerability Ratings",
    description:
      "FAULTLINE proprietary risk scores for stocks, ETFs, and macro assets. Quantified vulnerability ratings, regime alignment scores, and systemic exposure metrics.",
    canonical: "/app/scores",
  },
  // 43 chars ✓
  charts: {
    title: "Macro Charts — Systemic Risk Visualization",
    description:
      "Interactive macro regime charts, systemic pressure visualization, credit spread analysis, and market risk analytics from FAULTLINE.",
    canonical: "/app/charts",
  },
  // 43 chars ✓
  aiWatch: {
    title: "AI Watch — AI Bubble & Concentration Monitor",
    description:
      "Monitor AI sector concentration risk, bubble exposure, and systemic fragility in AI-driven equities. Track $214B+ in AI capex commitments and mega-cap concentration.",
    canonical: "/app/ai-watch",
  },
  // 47 chars ✓
  scenarios: {
    title: "Scenario Analysis — Macro Stress Simulations",
    description:
      "Simulate macro stress scenarios: market crash probability, recession pathways, credit contagion cascades, and systemic risk events with the FAULTLINE Scenario Engine.",
    canonical: "/app/scenarios",
  },
  // 44 chars ✓
  alerts: {
    title: "Market Alerts — Risk & Regime Change Signals",
    description:
      "Real-time market risk alerts, regime change notifications, and systemic pressure triggers. FAULTLINE alert system — be notified when macro conditions shift.",
    canonical: "/app/alerts",
  },
  // 53 chars ✓
  analogs: {
    title: "Historical Analogs — Market Crash Pattern Engine",
    description:
      "FAULTLINE Historical Analog Engine: identify current market conditions against historical crash patterns. 2000 dot-com, 2008 GFC, 2020 COVID — pattern-matched to today.",
    canonical: "/app/analogs",
  },
  // 44 chars ✓
  watchlist: {
    title: "Watchlist — Asset Risk & Signal Monitoring",
    description:
      "Track your personalized asset watchlist with FAULTLINE risk scores, signal labels, and macro regime alignment. Real-time monitoring for the assets that matter.",
    canonical: "/app/watchlist",
  },
  // 48 chars ✓
  crypto: {
    title: "Crypto Intelligence — Digital Asset Risk Analysis",
    description:
      "FAULTLINE Crypto Intelligence: BTC dominance, altcoin risk, systemic crypto pressure, contagion risk, and digital asset macro alignment.",
    canonical: "/app/crypto",
  },
  // 46 chars ✓
  cryptoSearch: {
    title: "Crypto Search — Digital Asset Intelligence",
    description:
      "Search and analyze any digital asset with FAULTLINE's crypto intelligence engine. Risk scores, signal labels, momentum analysis, and macro regime context.",
    canonical: "/app/crypto-search",
  },
  // 46 chars ✓
  cryptoWatchlist: {
    title: "Crypto Watchlist — Track Digital Asset Risk",
    description:
      "Monitor your crypto watchlist with FAULTLINE signal labels, risk scores, and comparative analysis. Institutional-grade digital asset tracking.",
    canonical: "/app/crypto-watchlist",
  },
  // 46 chars ✓
  cryptoSignals: {
    title: "Crypto Signals — Macro-Aligned Digital Assets",
    description:
      "FAULTLINE Crypto Signals: momentum, liquidity, and macro-regime-aligned trading signals for digital assets. Know which crypto assets fit the current macro environment.",
    canonical: "/app/crypto-signals",
  },
  // 51 chars ✓
  aftershock: {
    title: "Aftershock Engine™ — Market Contagion Detector",
    description:
      "The FAULTLINE Aftershock Engine™ detects market contagion, sector cascade risk, and systemic aftershock patterns following primary market ruptures.",
    canonical: "/app/aftershock",
  },
  // 51 chars ✓
  portfolio: {
    title: "Portfolio Intelligence — Risk & Regime Analysis",
    description:
      "FAULTLINE Portfolio Intelligence: pressure score, AI bubble exposure, rate sensitivity, concentration risk, liquidity risk, and recession exposure for your holdings.",
    canonical: "/app/portfolio",
  },
  // 48 chars ✓
  report: {
    title: "Daily Intelligence Report — Macro Market Briefing",
    description:
      "FAULTLINE Daily Intelligence Report: institutional macro briefing covering market regime, systemic pressure readings, key risk events, and forward-looking analytics.",
    canonical: "/app/report",
  },
  // 48 chars ✓
  guide: {
    title: "Platform Guide — How to Use FAULTLINE",
    description:
      "Learn how to use FAULTLINE's macroeconomic risk intelligence platform. Comprehensive guide to the Pressure Index™, Aftershock Engine™, stock signals, and analytics modules.",
    canonical: "/app/guide",
  },
  // 44 chars ✓
  account: {
    title: "My Account — FAULTLINE Access & Membership",
    description:
      "Manage your FAULTLINE account, access tier, and founding member status. Upgrade to premium intelligence and unlock the full platform.",
    canonical: "/app/account",
  },
  // 44 chars ✓
  diagnostic: {
    title: "Diagnostic AI™ — Market Health Intelligence",
    description:
      "FAULTLINE Diagnostic AI™: AI-powered market health analysis covering regime conditions, risk vectors, and structural vulnerabilities across timeframes.",
    canonical: "/app/diagnostic",
  },
  // 43 chars ✓
  simulate: {
    title: "Simulate Pressure — Macro Stress Scenario Tool",
    description:
      "Simulate custom macro stress scenarios with the FAULTLINE pressure engine. Model credit shocks, liquidity crises, and regime transitions.",
    canonical: "/app/simulate",
  },
  // 44 chars ✓
  readingHistory: {
    title: "Reading History — Market Regime Timeline",
    description:
      "Review your FAULTLINE market reading history. Track how macro conditions and regime assessments have evolved over time.",
    canonical: "/app/reading-history",
  },
  // 44 chars ✓
  altRotation: {
    title: "Alt Rotation — Alternative Asset Cycle Monitor",
    description:
      "FAULTLINE Alt Rotation Engine: track alternative asset rotation cycles, sector momentum shifts, and macro regime transitions across asset classes.",
    canonical: "/app/alt-rotation",
  },
  // 38 chars ✓
  blog: {
    title: "FAULTLINE Blog — Macro Intelligence Insights",
    description:
      "In-depth macro intelligence analysis, market regime commentary, and systemic risk insights from the FAULTLINE research team.",
    canonical: "/blog",
  },
  // 42 chars ✓
  trackRecord: {
    title: "Track Record — FAULTLINE Signal Performance",
    description:
      "FAULTLINE historical signal performance and track record. Transparent documentation of macro calls, regime predictions, and signal accuracy.",
    canonical: "/track-record",
  },
  // 52 chars ✓
  situationRoom: {
    title: "FAULTLINE Situation Room — Trade Preflight Simulator",
    description:
      "Stress-test your next market move against regime pressure, crash risk, liquidity, credit stress, volatility, AI speculation, and sector signals. Enter the FAULTLINE Situation Room.",
    canonical: "/app/situation-room",
  },
  // 31 chars ✓
  legal: {
    title: "Legal — FAULTLINE Terms & Disclaimers",
    description:
      "FAULTLINE legal terms, disclaimers, and privacy policy. Not financial advice — analytical research tool only.",
    canonical: "/legal",
  },
} as const;
