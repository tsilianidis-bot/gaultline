/**
 * seoMeta.ts — Server-side per-page metadata injection
 *
 * Replaces the generic index.html metadata with page-specific
 * title, description, OG, Twitter, and canonical tags BEFORE
 * the HTML is sent to the browser. This ensures every public
 * SEO page returns unique metadata without requiring JavaScript.
 *
 * Used by both setupVite (dev) and serveStatic (prod) catch-alls.
 */

import { getBlogPosts } from "./db";
import { getSoroArticles } from "./soroBlogFeed";
import { PUBLIC_DISCLAIMER } from "../shared/publicDisclaimer";

const BASE_URL = "https://getfaultline.live";
const DEFAULT_OG_IMAGE = "https://getfaultline.live/og-image.jpg";

export interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
  /** Absolute canonical URL override (defaults to BASE_URL + path without query). */
  canonicalUrl?: string;
  /** Replaces the template's robots directive when set (e.g. "noindex, follow"). */
  robots?: string;
}

// ── Per-page metadata map ──────────────────────────────────────────────────
// Keys are exact URL paths. Dynamic routes use prefix matching (see getPageMeta).
const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "FAULTLINE | Structural Market Intelligence",
    description: "FAULTLINE reads high-yield credit, SOFR, the Treasury curve, macro conditions, equities, and crypto to show where systemic pressure is building.",
  },
  "/blog": {
    title: "FAULTLINE Blog — Market Intelligence & Macro Analysis",
    description: "In-depth market intelligence, macro analysis, and risk commentary from the FAULTLINE team. Stay ahead of systemic risk with daily insights.",
  },
  "/analysis": {
    title: "Market Analysis — FAULTLINE Intelligence Reports",
    description: "Deep-dive market analysis and macro intelligence reports from FAULTLINE. Understand systemic risk, regime shifts, and market structure.",
  },
  "/intelligence": {
    title: "Intelligence Feed — FAULTLINE Daily Market Briefings",
    description: "Intelligence feed with daily market briefings, regime updates, and systemic risk alerts from FAULTLINE.",
  },
  "/intel-archive": {
    title: "Intelligence Archive — FAULTLINE Historical Market Records",
    description: "Archive of FAULTLINE intelligence records, regime readings, and stored market pressure history, each with its as-of date.",
  },

  "/pressure-index": {
    title: "FAULTLINE Pressure Index: Systemic Market Risk Score",
    description: "The FAULTLINE Pressure Index™ combines credit spreads, funding rates, the Treasury yield curve, inflation, unemployment, and a static AI-concentration baseline into a single systemic risk score (0–100).",
  },
  "/signals": {
    title: "Stock Signals — Macro-Regime Intelligence | FAULTLINE",
    description: "AI-powered stock signals classified by macro regime. FAULTLINE identifies momentum, risk, and opportunity across equities using systemic pressure data.",
  },
  "/crypto-signals": {
    title: "Crypto Signals — Macro-Aligned Digital Asset Intelligence | FAULTLINE",
    description: "Crypto signals aligned with macro regime. FAULTLINE tracks Bitcoin, Ethereum, and altcoin risk using systemic pressure, liquidity, and regime data.",
  },
  "/stock-market-risk-dashboard": {
    title: "Stock Market Risk Today | FAULTLINE",
    description: "Stock market risk intelligence for understanding systemic pressure, market regimes, credit conditions, rates, and volatility context.",
  },
  "/crypto-market-risk-dashboard": {
    title: "Crypto Market Risk Dashboard — Digital Asset Risk | FAULTLINE",
    description: "Crypto market risk dashboard tracking Bitcoin dominance, altcoin risk, liquidity conditions, and systemic pressure for digital assets.",
  },
  "/situation-room": {
    title: "Situation Room — Pre-Trade Stress Test | FAULTLINE",
    description: "Simulate a portfolio move against current macro conditions. FAULTLINE's Situation Room stress-tests a trade idea against the latest published pressure reading before you act.",
  },
  "/analogs": {
    title: "Historical Market Analogs — Crash Pattern Matching | FAULTLINE",
    description: "FAULTLINE's Historical Analog Engine ranks how closely today's pressure-vector profile resembles reference profiles of past stress episodes. Resemblance, not a forecast.",
  },
  "/ai-bubble-risk-tracker": {
    title: "AI Bubble Risk Monitor | FAULTLINE",
    description: "AI bubble risk intelligence for assessing concentration, valuation pressure, and systemic exposure across the AI equity complex.",
  },
  "/diagnostic-ai": {
    title: "FAULTLINE Diagnostic AI™ — Multi-Timeframe Market Intelligence",
    description: "FAULTLINE Diagnostic AI™ delivers multi-timeframe market intelligence across Today, Week, Month, and Year horizons. Understand pressure, regime, and risk in one view.",
  },
  // ── SEO Flagship Pages ────────────────────────────────────────────────────
  "/market-crash-probability-2026": {
    title: "Market Crash Probability | FAULTLINE",
    description: "Market crash probability context using systemic market stress, credit conditions, volatility, liquidity, and market-regime evidence.",
    ogType: "article",
  },
  "/market-crash-indicator": {
    title: "Market Crash Indicator — Systemic Risk Score | FAULTLINE",
    description: "The FAULTLINE Market Crash Indicator reads the six-vector Pressure Index — credit spreads, funding rates, the Treasury curve, inflation, unemployment, and a static AI-concentration baseline — to show when systemic pressure is building. It is not a calibrated crash probability.",
    ogType: "article",
  },
  "/recession-probability": {
    title: "Recession Probability | FAULTLINE",
    description: "Recession probability intelligence using yield curves, credit conditions, leading indicators, policy context, and market-regime evidence.",
    ogType: "article",
  },
  "/alt-season-indicator": {
    title: "Alt Season Indicator — Is Alt Season Here? | FAULTLINE",
    description: "Track alt season probability as new data is published. FAULTLINE's Alt Season Indicator monitors Bitcoin dominance, altcoin momentum, and liquidity rotation signals.",
    ogType: "article",
  },
  "/bitcoin-risk-dashboard": {
    title: "Bitcoin Risk Indicator | FAULTLINE",
    description: "Bitcoin risk intelligence for understanding macro regime, liquidity conditions, market structure, and systemic pressure affecting BTC.",
    ogType: "article",
  },
  "/ethereum-risk-dashboard": {
    title: "Ethereum Risk Dashboard — ETH Risk Score & Analysis | FAULTLINE",
    description: "Ethereum risk dashboard tracking ETH macro regime, ETH/BTC context, liquidity conditions, and systemic risk score from CoinGecko market data and the Pressure Index.",
    ogType: "article",
  },
  "/federal-reserve-tracker": {
    title: "Federal Reserve Tracker — Fed Policy Impact on Markets | FAULTLINE",
    description: "Track Federal Reserve policy as new data is published. FAULTLINE reads the federal funds rate, SOFR, Treasury yields, and credit spreads from FRED, and their impact on systemic pressure across equities and crypto.",
    ogType: "article",
  },
  "/liquidity-monitor": {
    title: "Liquidity Monitor — Market Liquidity Conditions | FAULTLINE",
    description: "Market liquidity monitor built on high-yield credit spreads and SOFR funding rates from FRED — the Liquidity Stress vector of the FAULTLINE Pressure Index.",
    ogType: "article",
  },
  "/volatility-dashboard": {
    title: "Volatility Dashboard — VIX Regime & Market Volatility | FAULTLINE",
    description: "Volatility context from delayed VIX quotes and the daily VIX close used by FAULTLINE's separate systemic-regime model. The Pressure Index itself does not read VIX.",
    ogType: "article",
  },
  "/ai-stocks-dashboard": {
    title: "AI Stocks Dashboard — AI Sector Risk & Signals | FAULTLINE",
    description: "Track AI sector stocks with regularly refreshed data. FAULTLINE's AI Stocks Dashboard monitors NVDA, MSFT, GOOGL, META, and the full AI complex for concentration and bubble risk.",
    ogType: "article",
  },
  "/ai-stock-signals": {
    title: "AI Stock Signals — Macro-Aligned AI Investing Intelligence | FAULTLINE",
    description: "AI-powered stock signals for AI sector investing. FAULTLINE identifies momentum, risk, and regime alignment across NVDA, PLTR, MSFT, and the AI complex.",
    ogType: "article",
  },
  "/crypto-signals-intelligence": {
    title: "Crypto Signals Intelligence — AI Crypto Analysis | FAULTLINE",
    description: "AI-powered crypto signals intelligence. FAULTLINE tracks Bitcoin, Ethereum, Solana, and altcoins using macro regime, liquidity, and systemic risk data.",
    ogType: "article",
  },
  "/market-regime-tracker": {
    title: "Market Regime Tracker | FAULTLINE",
    description: "Market regime intelligence for understanding evolving risk conditions, structural pressure, and the evidence shaping today’s market environment.",
    ogType: "article",
  },
  // ── Stock signal pages ────────────────────────────────────────────────────
  "/stock/nvda": {
    title: "NVDA Signal — NVIDIA AI Risk Score & Analysis | FAULTLINE",
    description: "NVIDIA (NVDA) signal analysis. FAULTLINE tracks NVDA macro regime fit, AI bubble exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  "/stock/pltr": {
    title: "PLTR Signal — Palantir Risk Score & Analysis | FAULTLINE",
    description: "Palantir (PLTR) signal analysis. FAULTLINE tracks PLTR macro regime fit, AI exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  "/stock/tsla": {
    title: "TSLA Signal — Tesla Risk Score & Analysis | FAULTLINE",
    description: "Tesla (TSLA) signal analysis. FAULTLINE tracks TSLA macro regime fit, momentum score, volatility risk, and key price levels.",
    ogType: "article",
  },
  "/stock/meta": {
    title: "META Signal — Meta Platforms Risk & Analysis | FAULTLINE",
    description: "Meta Platforms (META) signal analysis. FAULTLINE tracks META macro regime fit, AI exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  "/stock/amd": {
    title: "AMD Signal — AMD AI Chip Risk & Analysis | FAULTLINE",
    description: "AMD signal analysis. FAULTLINE tracks AMD macro regime fit, AI chip exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  // ── Crypto signal pages ───────────────────────────────────────────────────
  "/crypto/tao": {
    title: "TAO Signal — Bittensor Risk Score & Analysis | FAULTLINE",
    description: "Bittensor (TAO) signal analysis. FAULTLINE tracks TAO macro regime fit, AI network risk, momentum score, and key price levels.",
    ogType: "article",
  },
  // ── Static pages ──────────────────────────────────────────────────────────
  "/methodology": {
    title: "Methodology | FAULTLINE Systemic Risk",
    description: "How the Faultline Pressure Index is calculated, which series it uses, and what the score does not mean.",
  },
  "/contact": {
    title: "Contact FAULTLINE — Get in Touch",
    description: "Contact the FAULTLINE team. Questions about the platform, partnerships, or press inquiries.",
  },
  "/legal": {
    title: "Legal — Terms, Disclaimers & Privacy | FAULTLINE",
    description: `FAULTLINE legal terms, disclaimers, and privacy policy. ${PUBLIC_DISCLAIMER}`,
  },
  "/about": {
    title: "About FAULTLINE — Why I Built This Platform",
    description: "FAULTLINE was built to help investors recognize when the market environment has changed enough that protecting capital deserves as much attention as pursuing opportunity. Read the founder letter.",
  },
  "/trust": {
    title: "FAULTLINE Trust Center — Methodology, Data & Disclaimers",
    description: "FAULTLINE Trust Center: full methodology documentation, data sources, disclaimers, FAQ, privacy policy, and security information. Transparent by design.",
  },
  "/press": {
    title: "FAULTLINE Press — Media Kit & Coverage",
    description: "FAULTLINE press resources, media kit, and coverage. Contact the FAULTLINE team for media inquiries, interviews, and partnership opportunities.",
  },
  "/pricing": {
    title: "FAULTLINE Access — Free Account; Paid Plans Not on Sale",
    description: "The public Pressure Index and methodology are free to read without an account. Signed-in access starts with a free account. Paid plans are not on sale.",
  },
  "/intelligence-library": {
    title: "Intelligence Library — FAULTLINE Research & Analysis",
    description: "FAULTLINE Intelligence Library: deep-dive research, macro analysis, and market intelligence reports for self-directed investors.",
  },
  "/daily-brief": {
    title: "Daily Intelligence Brief — FAULTLINE Market Briefings",
    description: "FAULTLINE Daily Intelligence Brief: market briefings, regime updates, and systemic risk alerts built from FRED and market data. No briefs have been published yet; each brief will show its as-of date.",
  },
  "/track-record": {
    title: "Track Record | FAULTLINE — Historical Pressure Index 2000–Present",
    description: "FAULTLINE archived retrospective Pressure Index reconstruction from 2000. See how the stored reconstruction scored the 2008 GFC (82/CRITICAL), COVID crash (72/HIGH RISK), and dot-com bust. Retrospective only — not live predictions and not an independently validated backtest.",
  },
};

/**
 * Resolve metadata for a given URL path.
 * Falls back to homepage metadata for unknown routes.
 */
export function getPageMeta(urlPath: string): PageMeta {
  // Exact match
  if (PAGE_META[urlPath]) return PAGE_META[urlPath];

  // Strip query string
  const cleanPath = urlPath.split("?")[0].split("#")[0];
  if (PAGE_META[cleanPath]) return PAGE_META[cleanPath];

  // Dynamic stock pages: /stock/:symbol
  const stockMatch = cleanPath.match(/^\/stock\/([a-zA-Z0-9]{1,10})$/);
  if (stockMatch) {
    const sym = stockMatch[1].toUpperCase();
    return {
      title: `${sym} Signal — Stock Risk Score & Analysis | FAULTLINE`,
      description: `${sym} signal analysis. FAULTLINE tracks ${sym} macro regime fit, momentum score, volatility risk, and key price levels.`,
      ogType: "article",
    };
  }

  // Dynamic crypto pages: /crypto/:symbol
  const cryptoMatch = cleanPath.match(/^\/crypto\/([a-zA-Z0-9]{1,10})$/);
  if (cryptoMatch) {
    const sym = cryptoMatch[1].toUpperCase();
    return {
      title: `${sym} Signal — Crypto Risk Score & Analysis | FAULTLINE`,
      description: `${sym} signal analysis. FAULTLINE tracks ${sym} macro regime fit, liquidity conditions, momentum score, and key price levels.`,
      ogType: "article",
    };
  }

  // Blog post pages: /blog/:slug — generic fallback only. Published posts are
  // rendered with their own metadata by server/publicContentSsr.ts.
  if (cleanPath.startsWith("/blog/")) {
    return {
      title: "FAULTLINE Blog — Market Intelligence & Macro Analysis",
      description: "In-depth market intelligence, macro analysis, and risk commentary from the FAULTLINE team.",
      ogType: "article",
    };
  }

  // Default: homepage metadata
  return PAGE_META["/"];
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Async version: adds crawlable content for the blog index and track record.
 * Individual published articles (/blog/:slug, /daily-brief/:slug, /blog?post=:slug)
 * are rendered by server/publicContentSsr.ts before this fallback runs.
 */
export async function injectPageMetaAsync(html: string, urlPath: string): Promise<string> {
  const cleanPath = urlPath.split("?")[0].split("#")[0];

  // Blog index: inject article list (DB posts + published Soro feed) as noscript content for crawlers
  if (cleanPath === "/blog") {
    try {
      const [posts, soroArticles] = await Promise.all([
        getBlogPosts({ publishedOnly: true, limit: 20 }).catch(() => []),
        getSoroArticles().catch(() => null),
      ]);
      let result = injectPageMeta(html, urlPath);
      const articleLinks = [
        ...(soroArticles ?? []).map(a => {
          const excerpt = a.excerpt.slice(0, 160);
          return `<article><h2><a href="${BASE_URL}/blog?post=${encodeURIComponent(a.slug)}">${escapeText(a.title)}</a></h2>${excerpt ? `<p>${escapeText(excerpt)}</p>` : ""}<time datetime="${escapeText(a.isoDate)}">${new Date(a.isoDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })}</time></article>`;
        }),
        ...posts.map(p => {
          const excerpt = (p.subtitle ?? "").slice(0, 160);
          const date = p.publishedAt ?? p.createdAt;
          return `<article><h2><a href="${BASE_URL}/blog/${encodeURIComponent(p.slug)}">${escapeText(p.title)}</a></h2>${excerpt ? `<p>${escapeText(excerpt)}</p>` : ""}<time datetime="${date ? new Date(date).toISOString() : ""}">${new Date(date ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })}</time></article>`;
        }),
      ];
      if (articleLinks.length > 0) {
        const noscriptBlock = `<noscript><section aria-label="FAULTLINE Intelligence Briefings"><h1>FAULTLINE Intelligence Briefings</h1><p>Macro commentary, market risk analysis, and systemic pressure updates.</p>${articleLinks.join("\n")}</section></noscript>`;
        result = result.replace("</body>", () => `${noscriptBlock}</body>`);
      }
      return result;
    } catch { /* fall through */ }
  }

  // Track Record: inject retrospective historical data as noscript for crawlers
  if (cleanPath === "/track-record") {
    let result = injectPageMeta(html, urlPath);
    const trackRecordNoscript = `<noscript><section aria-label="FAULTLINE Track Record — Historical Pressure Index">
<h1>FAULTLINE Track Record — Historical Pressure Index 2000–Present</h1>
<p><strong>RETROSPECTIVE RECONSTRUCTION ONLY.</strong> The following scores come from an archived historical batch built from FRED macroeconomic data and calibrated against known historical stress episodes. These readings were not generated live at the time. The batch formula was not versioned, the current live formula does not reproduce it, and it has not been independently validated as a predictive backtest.</p>
<h2>Reconstructed Crisis Periods</h2>
<ul>
<li><strong>2000–2002 Dot-com Bust:</strong> Retrospective analysis shows HIGH RISK readings from Sep 2001 through Feb 2003 — 18 consecutive months. Credit contagion and liquidity stress spiked as tech valuations collapsed and post-9/11 uncertainty froze capital markets. S&amp;P 500 fell ~49% over 30 months.</li>
<li><strong>October 2008 Lehman Collapse:</strong> Retrospective analysis shows CRITICAL (82/100) in October 2008 — the month Lehman Brothers collapsed. Baa credit spreads hit 5.53% (HY proxy ~11.45%), with CRITICAL readings sustained for 8 consecutive months through May 2009. S&amp;P 500 fell ~57% peak-to-trough.</li>
<li><strong>2010–2012 Eurozone Crisis:</strong> Elevated unemployment (9–10%) and persistent credit stress kept the model in HIGH RISK territory through much of 2010–2012, capturing the eurozone sovereign debt contagion that threatened global financial stability.</li>
<li><strong>March 2020 COVID Crash:</strong> Retrospective analysis shows HIGH RISK in March 2020 as credit spreads spiked and unemployment surged to 14.8% by April. The rapid Fed response (QE, rate cuts to zero) compressed spreads quickly, limiting the duration of the HIGH RISK reading. S&amp;P 500 fell ~34% in 33 days.</li>
<li><strong>2022 Fed Rate Shock:</strong> Retrospective analysis shows ELEVATED RISK as the Fed raised rates from 0% to 5.25% in 18 months — the fastest tightening cycle since 1980. S&amp;P 500 fell ~25%, Nasdaq ~35%.</li>
</ul>
<h2>Methodology</h2>
<p>The current FAULTLINE Pressure Index™ is a composite of six weighted vectors: Liquidity Stress (20%), Credit Contagion (20%), Macro Sensitivity (20%), Yield Curve (10Y–2Y) &amp; 10Y Level (15%), AI / Speculation — a static concentration baseline adjusted by rates and credit (15%), and Labor &amp; Rates — unemployment and the 10Y yield (10%). Each vector is scored 0–100. The archived historical batch also applied a crisis amplifier whose formula was not preserved.</p>
<p>Regime thresholds: below 25 LOW RISK, 25–44 MODERATE RISK, 45–64 ELEVATED RISK, 65–79 HIGH STRESS, 80+ SYSTEMIC CRISIS.</p>
<h2>Important Limitations</h2>
<p>This is a retrospective reconstruction. FAULTLINE did not exist during the 2000, 2008, or 2020 crises. These scores use revised historical data rather than point-in-time vintages and do not show what the current live methodology would have produced at the time. Past readings do not guarantee future accuracy. Not investment advice.</p>
</section></noscript>`;
    result = result.replace("</body>", () => `${trackRecordNoscript}</body>`);
    return result;
  }

  return injectPageMeta(html, urlPath);
}

export function injectPageMeta(html: string, urlPath: string, overrideMeta?: PageMeta): string {
  const meta = overrideMeta ?? getPageMeta(urlPath);
  const canonicalUrl = meta.canonicalUrl ?? `${BASE_URL}${urlPath === "/" ? "" : urlPath.split("?")[0]}`;
  const ogImage = escapeText(meta.ogImage || DEFAULT_OG_IMAGE);
  const ogType = meta.ogType || "website";

  // Escape HTML entities in title/description (including quotes: they land in attributes)
  const safeTitle = escapeText(meta.title);
  const safeDesc = escapeText(meta.description);
  const safeCanonical = canonicalUrl.replace(/&/g, "&amp;").replace(/"/g, "%22");

  let result = html;
  // Function replacers: record-supplied text must never be interpreted as `$&`-style patterns.
  const set = (pattern: RegExp, replacement: string) => {
    result = result.replace(pattern, () => replacement);
  };

  // Replace <title>
  set(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);

  // Replace meta description
  set(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${safeDesc}"`);

  // Per-page robots directive (e.g. noindex for intel records and 404s)
  if (meta.robots) {
    set(/<meta name="robots" content="[^"]*"/, `<meta name="robots" content="${escapeText(meta.robots)}"`);
  }

  // Add noindex for authenticated app routes
  const isAppRoute = urlPath.startsWith("/app/") || urlPath === "/app";
  if (isAppRoute) {
    // Insert noindex meta after the canonical link
    set(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="${safeCanonical}"><meta name="robots" content="noindex,follow"`
    );
  } else {
    // Replace canonical
    set(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${safeCanonical}"`);
  }

  // Open Graph
  set(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${safeTitle}"`);
  set(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${safeDesc}"`);
  set(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${safeCanonical}"`);
  set(/<meta property="og:type" content="[^"]*"/, `<meta property="og:type" content="${ogType}"`);
  set(/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${ogImage}"`);

  // Twitter
  set(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${safeTitle}"`);
  set(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${safeDesc}"`);
  set(/<meta name="twitter:image" content="[^"]*"/, `<meta name="twitter:image" content="${ogImage}"`);

  return result;
}
