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
      document.title = `${BASE_TITLE} — Market Risk Intelligence Platform`;
    };
  }, [title, description, canonical]);
}

// ── Per-route SEO configs ─────────────────────────────────────

export const PAGE_SEO = {
  home: {
    title: BASE_TITLE,
    description:
      "FAULTLINE delivers institutional-grade macroeconomic risk intelligence. Monitor systemic market pressure, stock signals, crypto intelligence, and AI-powered macro analytics in real time. See the fault lines before markets break.",
    canonical: "/",
  },
  pressure: {
    title: "FAULTLINE Pressure Index™ — Real-Time Systemic Market Pressure Monitor",
    description:
      "Track the FAULTLINE Pressure Index™ live. Monitor systemic market stress, credit spreads, liquidity conditions, volatility regimes, and macro pressure across equity, bond, and credit markets. Know when the system is under stress.",
    canonical: "/pressure",
  },
  signals: {
    title: "Stock Signals — Momentum, Macro-Regime & Risk-Classified Trading Intelligence",
    description:
      "FAULTLINE Stock Signals Engine: momentum breakouts, macro beneficiaries, AI bubble exposure, liquidity-sensitive names, and recession-defensive classifications. Institutional-grade stock intelligence for serious traders and investors.",
    canonical: "/signals",
  },
  scores: {
    title: "Risk Scores — Proprietary Asset Risk & Macro Vulnerability Ratings",
    description:
      "FAULTLINE proprietary risk scores for stocks, ETFs, and macro assets. Quantified vulnerability ratings, regime alignment scores, and systemic exposure metrics. Know your real risk before the market does.",
    canonical: "/scores",
  },
  charts: {
    title: "Macro Charts — Market Regime & Systemic Risk Visualization",
    description:
      "Interactive macro regime charts, systemic pressure visualization, credit spread analysis, and market risk analytics. FAULTLINE intelligence dashboard — see the full macro picture in one view.",
    canonical: "/charts",
  },
  aiWatch: {
    title: "AI Watch — AI Sector Concentration Risk & Bubble Monitor",
    description:
      "Monitor AI sector concentration risk, bubble exposure, and systemic fragility in AI-driven equities. Track $214B+ in AI capex commitments and mega-cap concentration levels. FAULTLINE AI Watch intelligence module.",
    canonical: "/ai-watch",
  },
  scenarios: {
    title: "Scenario Analysis — Market Crash Probability & Macro Stress Simulations",
    description:
      "Simulate macro stress scenarios: market crash probability, recession pathways, credit contagion cascades, and systemic risk events. FAULTLINE Scenario Engine — model the fault lines before they rupture.",
    canonical: "/scenarios",
  },
  alerts: {
    title: "Real-Time Market Alerts — Risk & Regime Change Notifications",
    description:
      "Real-time market risk alerts, regime change notifications, and systemic pressure triggers. FAULTLINE premium alert system — be notified when macro conditions shift before the crowd reacts.",
    canonical: "/alerts",
  },
  analogs: {
    title: "Historical Analogs — Market Crash Pattern Recognition Engine",
    description:
      "FAULTLINE Historical Analog Engine: identify current market conditions against historical crash patterns, bear markets, and macro stress episodes. 2000 dot-com, 2008 GFC, 2020 COVID — pattern-matched to today.",
    canonical: "/analogs",
  },
  watchlist: {
    title: "Watchlist — Personalized Asset Risk & Signal Monitoring",
    description:
      "Track your personalized asset watchlist with FAULTLINE risk scores, signal labels, and macro regime alignment. Real-time monitoring for the assets that matter to your portfolio.",
    canonical: "/watchlist",
  },
  crypto: {
    title: "Crypto Intelligence — Digital Asset Risk, Signals & Macro Analysis",
    description:
      "FAULTLINE Crypto Intelligence: BTC dominance, altcoin risk, systemic crypto pressure, contagion risk, and digital asset macro alignment. Institutional-grade crypto analytics for serious digital asset investors.",
    canonical: "/crypto",
  },
  cryptoSearch: {
    title: "Crypto Search — Digital Asset Intelligence & Signal Analysis",
    description:
      "Search and analyze any digital asset with FAULTLINE's crypto intelligence engine. Risk scores, signal labels, momentum analysis, and macro regime context for thousands of digital assets.",
    canonical: "/crypto-search",
  },
  cryptoWatchlist: {
    title: "Crypto Watchlist — Track Digital Asset Risk & Signals",
    description:
      "Monitor your crypto watchlist with FAULTLINE signal labels, risk scores, and comparative analysis. Institutional-grade digital asset tracking with real-time macro regime context.",
    canonical: "/crypto-watchlist",
  },
  cryptoSignals: {
    title: "Crypto Signals — Macro-Aligned Digital Asset Trading Intelligence",
    description:
      "FAULTLINE Crypto Signals: momentum, liquidity, and macro-regime-aligned trading signals for digital assets. Know which crypto assets are positioned for the current macro environment.",
    canonical: "/crypto-signals",
  },
  aftershock: {
    title: "Aftershock Engine™ — Market Contagion & Cascade Risk Detection",
    description:
      "The FAULTLINE Aftershock Engine™ detects market contagion, sector cascade risk, and systemic aftershock patterns following primary market ruptures. See how stress spreads through the financial system in real time.",
    canonical: "/aftershock",
  },
  portfolio: {
    title: "Portfolio Monitor — Real-Time P&L, Risk Intelligence & Position Guidance",
    description:
      "FAULTLINE Portfolio Monitor: real-time P&L tracking, AI-powered position guidance, macro risk alignment, and systemic exposure analysis. Know your portfolio's true risk in the current macro regime.",
    canonical: "/portfolio",
  },
  report: {
    title: "Daily Intelligence Report — Institutional Macro Market Briefing",
    description:
      "FAULTLINE Daily Intelligence Report: institutional macro briefing covering market regime, systemic pressure readings, key risk events, and forward-looking analytics. Your daily edge in macro markets.",
    canonical: "/report",
  },
  guide: {
    title: "Platform Guide — How to Use FAULTLINE Macro Risk Intelligence",
    description:
      "Learn how to use FAULTLINE's macroeconomic risk intelligence platform. Comprehensive guide to the Pressure Index™, Aftershock Engine™, stock signals, crypto intelligence, and analytics modules.",
    canonical: "/guide",
  },
  account: {
    title: "My Account — FAULTLINE Access & Founding Member Management",
    description:
      "Manage your FAULTLINE account, access tier, and founding member status. Upgrade to premium intelligence and unlock the full platform at founding rates — $49/month locked for life.",
    canonical: "/account",
  },
} as const;
