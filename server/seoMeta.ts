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

const BASE_URL = "https://getfaultline.live";
const DEFAULT_OG_IMAGE = "https://getfaultline.live/og-image.jpg";

interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
}

// ── Per-page metadata map ──────────────────────────────────────────────────
// Keys are exact URL paths. Dynamic routes use prefix matching (see getPageMeta).
const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "FAULTLINE: Real-time Market Risk Intelligence & Analytics",
    description: "Monitor systemic market pressure, stock & crypto signals, and AI-powered macro analytics with FAULTLINE. Get real-time risk intelligence before markets break.",
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
    description: "Real-time intelligence feed with daily market briefings, regime updates, and systemic risk alerts from FAULTLINE.",
  },
  "/intel-archive": {
    title: "Intelligence Archive — FAULTLINE Historical Market Records",
    description: "Complete archive of FAULTLINE intelligence records, regime readings, and market pressure history. Full transparency and track record.",
  },

  "/pressure-index": {
    title: "FAULTLINE Pressure Index™ — Live Systemic Market Risk Score",
    description: "The FAULTLINE Pressure Index™ aggregates volatility, credit spreads, liquidity, and breadth into a single real-time systemic risk score (0–100).",
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
    title: "Stock Market Risk Dashboard — Live Systemic Risk | FAULTLINE",
    description: "Real-time stock market risk dashboard tracking systemic pressure, credit spreads, volatility regime, and equity breadth deterioration.",
  },
  "/crypto-market-risk-dashboard": {
    title: "Crypto Market Risk Dashboard — Digital Asset Risk | FAULTLINE",
    description: "Real-time crypto market risk dashboard tracking Bitcoin dominance, altcoin risk, liquidity conditions, and systemic pressure for digital assets.",
  },
  "/situation-room": {
    title: "Situation Room — Pre-Trade Stress Test | FAULTLINE",
    description: "Simulate any portfolio move against live macro conditions. FAULTLINE's Situation Room stress-tests your trades before you execute them.",
  },
  "/analogs": {
    title: "Historical Market Analogs — Crash Pattern Matching | FAULTLINE",
    description: "FAULTLINE's Historical Analog Engine matches current market conditions to historical crash patterns. Identify which past crises today's setup most resembles.",
  },
  "/ai-bubble-risk-tracker": {
    title: "AI Bubble Risk Tracker — AI Concentration & Valuation Risk | FAULTLINE",
    description: "Track AI sector bubble risk in real time. FAULTLINE monitors AI concentration, valuation multiples, and systemic exposure across NVDA, MSFT, GOOGL, and the AI complex.",
  },
  "/diagnostic-ai": {
    title: "FAULTLINE Diagnostic AI™ — Multi-Timeframe Market Intelligence",
    description: "FAULTLINE Diagnostic AI™ delivers multi-timeframe market intelligence across Today, Week, Month, and Year horizons. Understand pressure, regime, and risk in one view.",
  },
  // ── SEO Flagship Pages ────────────────────────────────────────────────────
  "/market-crash-probability-2026": {
    title: "Market Crash Probability 2026 — Real-Time Risk | FAULTLINE",
    description: "Track real-time 2026 market crash probability using credit spreads, VIX regime, yield curve inversion, and AI concentration risk. Updated daily by FAULTLINE.",
    ogType: "article",
  },
  "/market-crash-indicator": {
    title: "Market Crash Indicator — Live Systemic Risk Score | FAULTLINE",
    description: "The FAULTLINE Market Crash Indicator aggregates 12 systemic risk signals into a real-time crash probability score. Know when risk is building before markets break.",
    ogType: "article",
  },
  "/recession-probability": {
    title: "Recession Probability Indicator — Live US Recession Risk | FAULTLINE",
    description: "Real-time US recession probability tracking yield curve inversion, credit spreads, leading indicators, and Fed policy. FAULTLINE's recession risk dashboard.",
    ogType: "article",
  },
  "/alt-season-indicator": {
    title: "Alt Season Indicator — Is Alt Season Here? | FAULTLINE",
    description: "Track alt season probability in real time. FAULTLINE's Alt Season Indicator monitors Bitcoin dominance, altcoin momentum, and liquidity rotation signals.",
    ogType: "article",
  },
  "/bitcoin-risk-dashboard": {
    title: "Bitcoin Risk Dashboard — BTC Risk Score & Analysis | FAULTLINE",
    description: "Real-time Bitcoin risk dashboard tracking BTC macro regime, on-chain signals, liquidity conditions, and systemic risk score. Know when Bitcoin risk is elevated.",
    ogType: "article",
  },
  "/ethereum-risk-dashboard": {
    title: "Ethereum Risk Dashboard — ETH Risk Score & Analysis | FAULTLINE",
    description: "Real-time Ethereum risk dashboard tracking ETH macro regime, network activity, liquidity conditions, and systemic risk score. FAULTLINE ETH intelligence.",
    ogType: "article",
  },
  "/federal-reserve-tracker": {
    title: "Federal Reserve Tracker — Fed Policy Impact on Markets | FAULTLINE",
    description: "Track Federal Reserve policy in real time. FAULTLINE monitors Fed funds rate, balance sheet, forward guidance, and market impact across equities and crypto.",
    ogType: "article",
  },
  "/liquidity-monitor": {
    title: "Liquidity Monitor — Real-Time Market Liquidity Conditions | FAULTLINE",
    description: "Real-time market liquidity monitor tracking Fed balance sheet, repo markets, credit conditions, and global liquidity flows. FAULTLINE liquidity intelligence.",
    ogType: "article",
  },
  "/volatility-dashboard": {
    title: "Volatility Dashboard — VIX Regime & Market Volatility | FAULTLINE",
    description: "Real-time volatility dashboard tracking VIX regime, implied volatility, term structure, and volatility risk premium. FAULTLINE volatility intelligence.",
    ogType: "article",
  },
  "/ai-stocks-dashboard": {
    title: "AI Stocks Dashboard — AI Sector Risk & Signals | FAULTLINE",
    description: "Track AI sector stocks in real time. FAULTLINE's AI Stocks Dashboard monitors NVDA, MSFT, GOOGL, META, and the full AI complex for concentration and bubble risk.",
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
    title: "Market Regime Tracker — Bull, Bear & Crash Regime | FAULTLINE",
    description: "Real-time market regime tracker classifying current conditions as Bull, Bear, Crash, or Recovery. FAULTLINE's regime engine drives all signals and risk scores.",
    ogType: "article",
  },
  // ── Stock signal pages ────────────────────────────────────────────────────
  "/stock/nvda": {
    title: "NVDA Signal — NVIDIA AI Risk Score & Analysis | FAULTLINE",
    description: "Real-time NVIDIA (NVDA) signal analysis. FAULTLINE tracks NVDA macro regime fit, AI bubble exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  "/stock/pltr": {
    title: "PLTR Signal — Palantir Risk Score & Analysis | FAULTLINE",
    description: "Real-time Palantir (PLTR) signal analysis. FAULTLINE tracks PLTR macro regime fit, AI exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  "/stock/tsla": {
    title: "TSLA Signal — Tesla Risk Score & Analysis | FAULTLINE",
    description: "Real-time Tesla (TSLA) signal analysis. FAULTLINE tracks TSLA macro regime fit, momentum score, volatility risk, and key price levels.",
    ogType: "article",
  },
  "/stock/meta": {
    title: "META Signal — Meta Platforms Risk & Analysis | FAULTLINE",
    description: "Real-time Meta Platforms (META) signal analysis. FAULTLINE tracks META macro regime fit, AI exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  "/stock/amd": {
    title: "AMD Signal — AMD AI Chip Risk & Analysis | FAULTLINE",
    description: "Real-time AMD signal analysis. FAULTLINE tracks AMD macro regime fit, AI chip exposure, momentum score, and key price levels.",
    ogType: "article",
  },
  // ── Crypto signal pages ───────────────────────────────────────────────────
  "/crypto/tao": {
    title: "TAO Signal — Bittensor Risk Score & Analysis | FAULTLINE",
    description: "Real-time Bittensor (TAO) signal analysis. FAULTLINE tracks TAO macro regime fit, AI network risk, momentum score, and key price levels.",
    ogType: "article",
  },
  // ── Static pages ──────────────────────────────────────────────────────────
  "/methodology": {
    title: "Methodology — How FAULTLINE Works | FAULTLINE",
    description: "FAULTLINE's methodology: how the Pressure Index™, regime engine, and signal classification system work. Full transparency on our analytical framework.",
  },
  "/contact": {
    title: "Contact FAULTLINE — Get in Touch",
    description: "Contact the FAULTLINE team. Questions about the platform, partnerships, or press inquiries.",
  },
  "/legal": {
    title: "Legal — Terms, Disclaimers & Privacy | FAULTLINE",
    description: "FAULTLINE legal terms, disclaimers, and privacy policy. Not financial advice — for informational purposes only.",
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
    title: "FAULTLINE Pricing — Free, Pro & Founding Member Plans",
    description: "FAULTLINE pricing plans: Free access to the Pressure Index, Pro at $59/month for full intelligence, and Founding Lifetime membership at $299 one-time. Limited founding cohort.",
  },
  "/intelligence-library": {
    title: "Intelligence Library — FAULTLINE Research & Analysis",
    description: "FAULTLINE Intelligence Library: deep-dive research, macro analysis, and market intelligence reports. Institutional-quality research for self-directed investors.",
  },
  "/daily-brief": {
    title: "Daily Intelligence Brief — FAULTLINE Market Briefings",
    description: "FAULTLINE Daily Intelligence Brief: real-time market briefings, regime updates, and systemic risk alerts. Published daily from live FRED and market data.",
  },
  "/track-record": {
    title: "Track Record | FAULTLINE — Historical Pressure Index 2000–Present",
    description: "FAULTLINE retrospective Pressure Index from 2000 to present. See how the indicators scored the 2008 GFC (82/CRITICAL), COVID crash (72/HIGH RISK), and dot-com bust. Retrospective analysis only — not live predictions.",
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
      description: `Real-time ${sym} signal analysis. FAULTLINE tracks ${sym} macro regime fit, momentum score, volatility risk, and key price levels.`,
      ogType: "article",
    };
  }

  // Dynamic crypto pages: /crypto/:symbol
  const cryptoMatch = cleanPath.match(/^\/crypto\/([a-zA-Z0-9]{1,10})$/);
  if (cryptoMatch) {
    const sym = cryptoMatch[1].toUpperCase();
    return {
      title: `${sym} Signal — Crypto Risk Score & Analysis | FAULTLINE`,
      description: `Real-time ${sym} signal analysis. FAULTLINE tracks ${sym} macro regime fit, liquidity conditions, momentum score, and key price levels.`,
      ogType: "article",
    };
  }

  // Blog post pages: /blog/:slug
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

/**
 * Inject per-page metadata into the HTML template.
 * Replaces title, description, OG, Twitter, and canonical tags.
 */
import { getBlogPostBySlug, getBlogPosts } from "./db";

/**
 * Async version: resolves blog post metadata from DB for /blog/:slug routes.
 */
export async function injectPageMetaAsync(html: string, urlPath: string): Promise<string> {
  const cleanPath = urlPath.split("?")[0].split("#")[0];

  // Blog post: inject post-specific title/description from DB
  const blogSlugMatch = cleanPath.match(/^\/blog\/([^/]+)$/);
  if (blogSlugMatch) {
    try {
      const post = await getBlogPostBySlug(blogSlugMatch[1]);
      if (post && post.published) {
        const postTitle = (post as any).metaTitle ?? post.title;
        const postDesc = (post as any).metaDescription ?? post.subtitle ?? post.title;
        const postMeta: PageMeta = {
          title: `${postTitle} | FAULTLINE`,
          description: postDesc,
          ogType: "article",
        };
        // Also inject Article JSON-LD into the HTML
        let result = injectPageMeta(html, urlPath, postMeta);
        const canonicalUrl = `${BASE_URL}/blog/${blogSlugMatch[1]}`;
        const articleLd = {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "description": postDesc,
          "url": canonicalUrl,
          "author": { "@type": "Person", "name": post.author ?? "FAULTLINE" },
          "publisher": { "@type": "Organization", "name": "FAULTLINE", "url": BASE_URL },
          "datePublished": post.publishedAt ?? post.createdAt,
          "dateModified": post.updatedAt ?? post.publishedAt ?? post.createdAt,
        };
        const ldScript = `<script type="application/ld+json">${JSON.stringify(articleLd)}</script>`;
        result = result.replace("</head>", `${ldScript}</head>`);
        return result;
      }
    } catch { /* fall through to generic blog meta */ }
  }

  // Blog index: inject article list as noscript content for crawlers
  if (cleanPath === "/blog") {
    try {
      const posts = await getBlogPosts({ publishedOnly: true, limit: 20 });
      let result = injectPageMeta(html, urlPath);
      if (posts.length > 0) {
        const articleLinks = posts.map(p => {
          const excerpt = (p.subtitle ?? "").slice(0, 160);
          return `<article><h2><a href="${BASE_URL}/blog/${p.slug}">${p.title}</a></h2>${excerpt ? `<p>${excerpt}</p>` : ""}<time datetime="${p.publishedAt ?? p.createdAt}">${new Date(p.publishedAt ?? p.createdAt ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time></article>`;
        }).join("\n");
        const noscriptBlock = `<noscript><section aria-label="FAULTLINE Intelligence Briefings"><h1>FAULTLINE Intelligence Briefings</h1><p>Institutional macro commentary, market risk analysis, and systemic pressure updates.</p>${articleLinks}</section></noscript>`;
        result = result.replace("</body>", `${noscriptBlock}</body>`);
      }
      return result;
    } catch { /* fall through */ }
  }

  // Track Record: inject retrospective historical data as noscript for crawlers
  if (cleanPath === "/track-record") {
    let result = injectPageMeta(html, urlPath);
    const trackRecordNoscript = `<noscript><section aria-label="FAULTLINE Track Record — Historical Pressure Index">
<h1>FAULTLINE Track Record — Historical Pressure Index 2000–Present</h1>
<p><strong>RETROSPECTIVE ANALYSIS ONLY.</strong> The following scores were computed by applying the current FAULTLINE Pressure Index methodology to historical FRED macroeconomic data. These readings were not generated live at the time. They represent a retrospective audit of how the model would have scored historical conditions.</p>
<h2>Historical Validation Events</h2>
<ul>
<li><strong>2000–2002 Dot-com Bust:</strong> Retrospective analysis shows HIGH RISK readings from Sep 2001 through Feb 2003 — 18 consecutive months. Credit contagion and liquidity stress spiked as tech valuations collapsed and post-9/11 uncertainty froze capital markets. S&amp;P 500 fell ~49% over 30 months.</li>
<li><strong>October 2008 Lehman Collapse:</strong> Retrospective analysis shows CRITICAL (82/100) in October 2008 — the month Lehman Brothers collapsed. Baa credit spreads hit 5.53% (HY proxy ~11.45%), with CRITICAL readings sustained for 8 consecutive months through May 2009. S&amp;P 500 fell ~57% peak-to-trough.</li>
<li><strong>2010–2012 Eurozone Crisis:</strong> Elevated unemployment (9–10%) and persistent credit stress kept the model in HIGH RISK territory through much of 2010–2012, capturing the eurozone sovereign debt contagion that threatened global financial stability.</li>
<li><strong>March 2020 COVID Crash:</strong> Retrospective analysis shows HIGH RISK in March 2020 as credit spreads spiked and unemployment surged to 14.8% by April. The rapid Fed response (QE, rate cuts to zero) compressed spreads quickly, limiting the duration of the HIGH RISK reading. S&amp;P 500 fell ~34% in 33 days.</li>
<li><strong>2022 Fed Rate Shock:</strong> Retrospective analysis shows ELEVATED RISK as the Fed raised rates from 0% to 5.25% in 18 months — the fastest tightening cycle since 1980. S&amp;P 500 fell ~25%, Nasdaq ~35%.</li>
</ul>
<h2>Methodology</h2>
<p>The FAULTLINE Pressure Index™ is a composite of six weighted vectors: Liquidity Stress (20%), Credit Contagion (20%), Macro Sensitivity (20%), Volatility Regime (15%), AI Bubble Risk (15%), and Market Breadth (10%). Each vector is scored 0–100 using FRED macroeconomic data. The composite is a weighted average producing a final score of 0–100.</p>
<p>Regime thresholds: 0–25 MINIMAL RISK, 26–45 MODERATE RISK, 46–60 ELEVATED RISK, 61–75 HIGH RISK, 76–100 CRITICAL.</p>
<h2>Important Limitations</h2>
<p>This is retrospective analysis. FAULTLINE did not exist during the 2000, 2008, or 2020 crises. These scores represent what the current methodology would have produced using the data available at those times. Past performance of the methodology does not guarantee future accuracy. Not investment advice.</p>
</section></noscript>`;
    result = result.replace("</body>", `${trackRecordNoscript}</body>`);
    return result;
  }

  return injectPageMeta(html, urlPath);
}

export function injectPageMeta(html: string, urlPath: string, overrideMeta?: PageMeta): string {
  const meta = overrideMeta ?? getPageMeta(urlPath);
  const canonicalUrl = `${BASE_URL}${urlPath === "/" ? "" : urlPath.split("?")[0]}`;
  const ogImage = meta.ogImage || DEFAULT_OG_IMAGE;
  const ogType = meta.ogType || "website";

  // Escape HTML entities in title/description
  const safeTitle = meta.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeDesc = meta.description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeCanonical = canonicalUrl.replace(/&/g, "&amp;");

  let result = html;

  // Replace <title>
  result = result.replace(
    /<title>[^<]*<\/title>/,
    `<title>${safeTitle}</title>`
  );

  // Replace meta description
  result = result.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${safeDesc}"`
  );

  // Add noindex for authenticated app routes
  const isAppRoute = urlPath.startsWith("/app/") || urlPath === "/app";
  if (isAppRoute) {
    // Insert noindex meta after the canonical link
    result = result.replace(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="${safeCanonical}"><meta name="robots" content="noindex,follow"`
    );
  } else {
    // Replace canonical
    result = result.replace(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="${safeCanonical}"`
    );
  }

  // Replace OG title
  result = result.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${safeTitle}"`
  );

  // Replace OG description
  result = result.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${safeDesc}"`
  );

  // Replace OG URL
  result = result.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${safeCanonical}"`
  );

  // Replace OG type
  result = result.replace(
    /<meta property="og:type" content="[^"]*"/,
    `<meta property="og:type" content="${ogType}"`
  );

  // Replace OG image
  result = result.replace(
    /<meta property="og:image" content="[^"]*"/,
    `<meta property="og:image" content="${ogImage}"`
  );

  // Replace Twitter title
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${safeTitle}"`
  );

  // Replace Twitter description
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${safeDesc}"`
  );

  // Replace Twitter image
  result = result.replace(
    /<meta name="twitter:image" content="[^"]*"/,
    `<meta name="twitter:image" content="${ogImage}"`
  );

  return result;
}
