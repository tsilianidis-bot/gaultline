import { useEffect } from "react";

interface SEOOptions {
  title: string;
  description?: string;
  canonical?: string;
}

const BASE_TITLE = "FAULTLINE";
const BASE_DESCRIPTION =
  "FAULTLINE is an institutional-grade macroeconomic risk intelligence platform. Real-time systemic market pressure, stock signals, crypto intelligence, Aftershock Engine™, and AI-powered macro analytics.";
const BASE_CANONICAL = "https://getfaultline.live";

/**
 * Sets document.title and meta description for the current route.
 * Resets to defaults on unmount.
 */
export function useSEO({ title, description, canonical }: SEOOptions) {
  useEffect(() => {
    // Set title
    const fullTitle = title === BASE_TITLE
      ? `${BASE_TITLE} — Macroeconomic & Market Risk Intelligence Platform`
      : `${title} | ${BASE_TITLE}`;
    document.title = fullTitle;

    // Set meta description
    const desc = description ?? BASE_DESCRIPTION;
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    }

    // Set OG title
    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", fullTitle);

    // Set OG description
    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", desc);

    // Set OG URL / canonical
    const canonicalUrl = canonical ? `${BASE_CANONICAL}${canonical}` : BASE_CANONICAL;
    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", canonicalUrl);
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.setAttribute("href", canonicalUrl);

    // Set Twitter title/desc
    let twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", fullTitle);
    let twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute("content", desc);

    return () => {
      // Reset to defaults on unmount
      document.title = `${BASE_TITLE} — Macroeconomic & Market Risk Intelligence Platform`;
    };
  }, [title, description, canonical]);
}

// ── Per-route SEO configs ─────────────────────────────────────

export const PAGE_SEO = {
  home: {
    title: BASE_TITLE,
    description:
      "FAULTLINE delivers institutional-grade macroeconomic risk intelligence. Monitor systemic market pressure, stock signals, crypto intelligence, and AI-powered macro analytics in real time.",
    canonical: "/",
  },
  pressure: {
    title: "FAULTLINE Pressure Index™ — Systemic Market Pressure Monitor",
    description:
      "Track the FAULTLINE Pressure Index™ in real time. Monitor systemic market stress, credit spreads, volatility regimes, and macro pressure across equity, bond, and credit markets.",
    canonical: "/pressure",
  },
  signals: {
    title: "Stock Signals — Momentum & Macro-Regime Trading Intelligence",
    description:
      "FAULTLINE Stock Signals Engine: momentum breakouts, macro beneficiaries, AI bubble exposure, liquidity-sensitive names, and recession-defensive classifications. Institutional stock intelligence.",
    canonical: "/signals",
  },
  scores: {
    title: "Risk Scores — Asset Risk & Macro Vulnerability Ratings",
    description:
      "FAULTLINE proprietary risk scores for stocks, ETFs, and macro assets. Quantified vulnerability ratings, regime alignment, and systemic exposure metrics.",
    canonical: "/scores",
  },
  charts: {
    title: "Market Charts — Macro Regime & Risk Visualization",
    description:
      "Interactive macro regime charts, systemic pressure visualization, and market risk analytics. FAULTLINE cinematic intelligence dashboard.",
    canonical: "/charts",
  },
  aiWatch: {
    title: "AI Watch — AI Sector Concentration & Bubble Risk Monitor",
    description:
      "Monitor AI sector concentration risk, bubble exposure, and systemic fragility within AI-driven equities. FAULTLINE AI Watch intelligence module.",
    canonical: "/ai-watch",
  },
  scenarios: {
    title: "Scenario Analysis — Market Crash & Macro Stress Simulations",
    description:
      "Simulate macro stress scenarios: market crash probability, recession pathways, credit contagion, and systemic risk cascades. FAULTLINE Scenario Engine.",
    canonical: "/scenarios",
  },
  alerts: {
    title: "Real-Time Alerts — Market Risk & Regime Change Notifications",
    description:
      "Real-time market risk alerts, regime change notifications, and systemic pressure triggers. FAULTLINE premium alert system for institutional investors.",
    canonical: "/alerts",
  },
  analogs: {
    title: "Historical Analogs — Market Crash Pattern Recognition",
    description:
      "FAULTLINE Historical Analog Engine: identify current market conditions against historical crash patterns, bear markets, and macro stress episodes.",
    canonical: "/analogs",
  },
  watchlist: {
    title: "Watchlist — Personalized Asset Risk Monitoring",
    description:
      "Track your personalized asset watchlist with FAULTLINE risk scores, signal labels, and macro regime alignment. Premium institutional monitoring.",
    canonical: "/watchlist",
  },
  crypto: {
    title: "Crypto Intelligence — Digital Asset Risk & Market Analysis",
    description:
      "FAULTLINE Crypto Intelligence: BTC dominance, altcoin risk, systemic crypto pressure, contagion risk, and digital asset macro alignment. Institutional crypto analytics.",
    canonical: "/crypto",
  },
  cryptoSearch: {
    title: "Crypto Search — Digital Asset Intelligence & Signal Analysis",
    description:
      "Search and analyze any digital asset with FAULTLINE's crypto intelligence engine. Risk scores, signal labels, momentum analysis, and macro regime context.",
    canonical: "/crypto-search",
  },
  cryptoWatchlist: {
    title: "Crypto Watchlist — Track Digital Asset Risk & Signals",
    description:
      "Monitor your crypto watchlist with FAULTLINE signal labels, risk scores, and comparative analysis. Institutional-grade digital asset tracking.",
    canonical: "/crypto-watchlist",
  },
  cryptoSignals: {
    title: "Crypto Signals — Digital Asset Trading Intelligence",
    description:
      "FAULTLINE Crypto Signals: momentum, liquidity, and macro-regime-aligned trading signals for digital assets. Institutional crypto trading intelligence.",
    canonical: "/crypto-signals",
  },
  aftershock: {
    title: "Aftershock Engine™ — Market Contagion & Cascade Risk Detection",
    description:
      "The FAULTLINE Aftershock Engine™ detects market contagion, sector cascade risk, and systemic aftershock patterns following primary market ruptures.",
    canonical: "/aftershock",
  },
  portfolio: {
    title: "Portfolio Monitor — Real-Time P&L & Risk Intelligence",
    description:
      "FAULTLINE Portfolio Monitor: real-time P&L tracking, AI-powered position guidance, macro risk alignment, and systemic exposure analysis for your portfolio.",
    canonical: "/portfolio",
  },
  report: {
    title: "Daily Intelligence Report — Macro Market Briefing",
    description:
      "FAULTLINE Daily Intelligence Report: institutional macro briefing covering market regime, systemic pressure, key risk events, and forward-looking analytics.",
    canonical: "/report",
  },
  guide: {
    title: "Platform Guide — How to Use FAULTLINE Intelligence",
    description:
      "Learn how to use FAULTLINE's macroeconomic risk intelligence platform. Comprehensive guide to the Pressure Index™, Aftershock Engine™, signals, and analytics.",
    canonical: "/guide",
  },
  account: {
    title: "My Account — FAULTLINE Access & Tier Management",
    description:
      "Manage your FAULTLINE account, access tier, and founding access request. Upgrade to premium intelligence and unlock the full platform.",
    canonical: "/account",
  },
} as const;
