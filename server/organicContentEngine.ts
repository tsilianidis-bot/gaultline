import { eq, desc, and, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { organicContent, signalPages } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";

// ── Supported content types ──────────────────────────────────────────────────
export type ContentType =
  | "daily_market_brief"
  | "weekly_market_outlook"
  | "crypto_market_outlook"
  | "ai_sector_outlook"
  | "federal_reserve_watch"
  | "liquidity_report"
  | "volatility_report"
  | "pressure_index_report"
  | "market_regime_report"
  | "historical_analog_report";

// ── Tracked symbols ──────────────────────────────────────────────────────────
export const TRACKED_STOCKS = [
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "PLTR", name: "Palantir Technologies" },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "AMD",  name: "Advanced Micro Devices" },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "ARM",  name: "Arm Holdings" },
  { symbol: "SMCI", name: "Super Micro Computer" },
];

export const TRACKED_CRYPTO = [
  { symbol: "BTC",    name: "Bitcoin" },
  { symbol: "ETH",    name: "Ethereum" },
  { symbol: "SOL",    name: "Solana" },
  { symbol: "TAO",    name: "Bittensor" },
  { symbol: "SUI",    name: "Sui" },
  { symbol: "RENDER", name: "Render Network" },
  { symbol: "NEAR",   name: "NEAR Protocol" },
  { symbol: "ONDO",   name: "Ondo Finance" },
  { symbol: "PYTH",   name: "Pyth Network" },
  { symbol: "LINK",   name: "Chainlink" },
];

// ── Internal link map ────────────────────────────────────────────────────────
const INTERNAL_LINKS = [
  { text: "FAULTLINE Market Crash Probability", href: "/market-crash-probability-2026" },
  { text: "Recession Probability Tracker", href: "/recession-probability" },
  { text: "Federal Reserve Tracker", href: "/federal-reserve-tracker" },
  { text: "Liquidity Monitor", href: "/liquidity-monitor" },
  { text: "Volatility Dashboard", href: "/volatility-dashboard" },
  { text: "Alt Season Indicator", href: "/alt-season-indicator" },
  { text: "Bitcoin Risk Dashboard", href: "/bitcoin-risk-dashboard" },
  { text: "AI Bubble Monitor", href: "/ai-bubble-risk-tracker" },
  { text: "Market Regime Tracker", href: "/market-regime-tracker" },
  { text: "AI Stocks Dashboard", href: "/ai-stocks-dashboard" },
  { text: "Ethereum Risk Dashboard", href: "/ethereum-risk-dashboard" },
  { text: "Crypto Signals Intelligence", href: "/crypto-signals-intelligence" },
];

// ── Content type config ──────────────────────────────────────────────────────
const CONTENT_CONFIG: Record<ContentType, {
  label: string;
  category: string;
  slugPrefix: string;
  minWords: number;
  frequency: "daily" | "weekly";
}> = {
  daily_market_brief:        { label: "Daily Market Brief",         category: "Market Intelligence",  slugPrefix: "market-brief",        minWords: 800,  frequency: "daily"  },
  weekly_market_outlook:     { label: "Weekly Market Outlook",      category: "Market Intelligence",  slugPrefix: "market-outlook",      minWords: 1200, frequency: "weekly" },
  crypto_market_outlook:     { label: "Crypto Market Outlook",      category: "Crypto Intelligence",  slugPrefix: "crypto-outlook",      minWords: 1000, frequency: "weekly" },
  ai_sector_outlook:         { label: "AI Sector Outlook",          category: "AI & Technology",      slugPrefix: "ai-sector",           minWords: 1000, frequency: "weekly" },
  federal_reserve_watch:     { label: "Federal Reserve Watch",      category: "Macro Intelligence",   slugPrefix: "fed-watch",           minWords: 900,  frequency: "weekly" },
  liquidity_report:          { label: "Liquidity Report",           category: "Macro Intelligence",   slugPrefix: "liquidity-report",    minWords: 900,  frequency: "weekly" },
  volatility_report:         { label: "Volatility Report",          category: "Risk Intelligence",    slugPrefix: "volatility-report",   minWords: 900,  frequency: "weekly" },
  pressure_index_report:     { label: "Pressure Index Report",      category: "Risk Intelligence",    slugPrefix: "pressure-report",     minWords: 800,  frequency: "daily"  },
  market_regime_report:      { label: "Market Regime Report",       category: "Market Intelligence",  slugPrefix: "regime-report",       minWords: 900,  frequency: "weekly" },
  historical_analog_report:  { label: "Historical Analog Report",   category: "Macro Intelligence",   slugPrefix: "historical-analog",   minWords: 1200, frequency: "weekly" },
};

// ── Slug generator ───────────────────────────────────────────────────────────
function buildSlug(prefix: string, date: string): string {
  return `${prefix}-${date}`;
}

// ── Quality validator ────────────────────────────────────────────────────────
interface ValidationResult {
  passed: boolean;
  score: number;
  reason?: string;
}

function validateContent(content: string, title: string, description: string, minWords: number): ValidationResult {
  const words = content.split(/\s+/).filter(Boolean).length;
  if (words < minWords) {
    return { passed: false, score: 20, reason: `thin-content: ${words} words (min ${minWords})` };
  }
  if (title.length > 300) {
    return { passed: false, score: 40, reason: "title-too-long" };
  }
  if (description.length > 200) {
    return { passed: false, score: 40, reason: "description-too-long" };
  }
  // Check for required structural elements
  const hasH2 = /^##\s/m.test(content);
  const hasFaq = /FAQ|frequently asked/i.test(content);
  const hasInternalLink = /\[.*?\]\(\/.*?\)/.test(content);

  let score = 60;
  if (hasH2) score += 15;
  if (hasFaq) score += 15;
  if (hasInternalLink) score += 10;

  return { passed: true, score };
}

// ── Duplicate checker ────────────────────────────────────────────────────────
async function checkDuplicate(contentType: ContentType, todayStr: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await db.select({ id: organicContent.id })
    .from(organicContent)
    .where(
      and(
        eq(organicContent.contentType, contentType),
        gte(organicContent.createdAt, new Date(todayStr + "T00:00:00Z"))
      )
    )
    .limit(1);

  return existing.length > 0 ? existing[0].id : null;
}

// ── Schema markup builder ────────────────────────────────────────────────────
function buildSchema(title: string, description: string, slug: string, publishedAt: string, faqs?: Array<{ question: string; answer: string }>) {
  const schema: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": description,
      "url": `https://getfaultline.live/intelligence/${slug}`,
      "datePublished": publishedAt,
      "dateModified": publishedAt,
      "publisher": {
        "@type": "Organization",
        "name": "FAULTLINE",
        "url": "https://getfaultline.live"
      },
      "author": {
        "@type": "Organization",
        "name": "FAULTLINE Intelligence"
      }
    }
  ];

  if (faqs && faqs.length > 0) {
    schema.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(f => ({
        "@type": "Question",
        "name": f.question,
        "acceptedAnswer": { "@type": "Answer", "text": f.answer }
      }))
    });
  }

  return JSON.stringify(schema);
}

// ── Main content generator ───────────────────────────────────────────────────
export async function generateOrganicContent(
  contentType: ContentType,
  contextData?: {
    pressureScore?: number;
    regime?: string;
    stressLevel?: string;
    crashProbability?: number;
    bullProbability?: number;
    topDrivers?: string[];
  }
): Promise<{ ok: boolean; id?: number; slug?: string; error?: string; skipped?: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false, error: "database unavailable" };

  const config = CONTENT_CONFIG[contentType];
  const todayStr = new Date().toISOString().split("T")[0];
  const slug = buildSlug(config.slugPrefix, todayStr);

  // Check for today's duplicate
  const duplicateId = await checkDuplicate(contentType, todayStr);
  if (duplicateId) {
    return { ok: true, skipped: true, id: duplicateId, slug };
  }

  // Check slug uniqueness
  const existingSlug = await db.select({ id: organicContent.id })
    .from(organicContent)
    .where(eq(organicContent.slug, slug))
    .limit(1);
  if (existingSlug.length > 0) {
    return { ok: true, skipped: true, id: existingSlug[0].id, slug };
  }

  // Build context string for LLM
  const ctx = contextData
    ? `Current FAULTLINE readings: Pressure Score ${contextData.pressureScore ?? "N/A"}/100, Regime: ${contextData.regime ?? "Unknown"}, Stress: ${contextData.stressLevel ?? "Unknown"}${contextData.crashProbability != null ? `, Crash Probability: ${contextData.crashProbability}%` : ""}${contextData.bullProbability != null ? `, Bull Probability: ${contextData.bullProbability}%` : ""}${contextData.topDrivers?.length ? `, Top Drivers: ${contextData.topDrivers.join(", ")}` : ""}.`
    : "";

  // Select relevant internal links (3-5 per article)
  const relevantLinks = INTERNAL_LINKS.slice(0, 5);
  const linkSuggestions = relevantLinks.map(l => `[${l.text}](${l.href})`).join(", ");

  const systemPrompt = `You are FAULTLINE Intelligence, a professional market analysis engine. You write authoritative, data-driven market intelligence content for sophisticated investors. Your content is factual, analytical, and avoids giving direct investment advice. Always write in third person. Never use phrases like "I think" or "you should". Use markdown formatting with H2 and H3 headings.`;

  const contentPrompts: Record<ContentType, string> = {
    daily_market_brief: `Write a Daily Market Brief for ${todayStr}. ${ctx} Include: (1) Market Overview with current conditions, (2) Key Risk Factors, (3) Sector Rotation signals, (4) Crypto market conditions, (5) What to Watch Today, (6) FAQ section with 3 questions. Include these internal links naturally in the text: ${linkSuggestions}. Minimum 800 words.`,
    weekly_market_outlook: `Write a Weekly Market Outlook for the week of ${todayStr}. ${ctx} Include: (1) Executive Summary, (2) Macro Environment, (3) Equity Market Analysis, (4) Risk Assessment, (5) Key Levels to Watch, (6) Scenarios for the week, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 1200 words.`,
    crypto_market_outlook: `Write a Crypto Market Outlook for ${todayStr}. ${ctx} Include: (1) Bitcoin Analysis, (2) Ethereum Analysis, (3) Altcoin Season Probability, (4) DeFi & Layer-2 Trends, (5) On-Chain Signals, (6) Key Levels, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 1000 words.`,
    ai_sector_outlook: `Write an AI Sector Outlook for ${todayStr}. ${ctx} Include: (1) AI Sector Overview, (2) NVIDIA & Semiconductor Analysis, (3) Software AI Plays (PLTR, MSFT, GOOGL), (4) AI Infrastructure Trends, (5) Risk Factors for AI Stocks, (6) Valuation Considerations, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 1000 words.`,
    federal_reserve_watch: `Write a Federal Reserve Watch report for ${todayStr}. ${ctx} Include: (1) Fed Policy Overview, (2) Interest Rate Outlook, (3) Inflation vs Employment Data, (4) Market Impact Analysis, (5) Liquidity Conditions, (6) What the Fed Signals Mean for Investors, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 900 words.`,
    liquidity_report: `Write a Liquidity Report for ${todayStr}. ${ctx} Include: (1) Global Liquidity Overview, (2) Fed Balance Sheet Analysis, (3) Credit Conditions, (4) Dollar Strength Impact, (5) Risk Asset Implications, (6) Liquidity Cycle Position, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 900 words.`,
    volatility_report: `Write a Volatility Report for ${todayStr}. ${ctx} Include: (1) VIX Analysis, (2) Options Market Signals, (3) Volatility Regime Assessment, (4) Historical Volatility vs Implied, (5) Sector Volatility Breakdown, (6) Risk Management Implications, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 900 words.`,
    pressure_index_report: `Write a FAULTLINE Pressure Index Report for ${todayStr}. ${ctx} Include: (1) Pressure Index Reading & Interpretation, (2) Component Breakdown, (3) Historical Context, (4) What This Reading Means, (5) Key Signals to Monitor, (6) FAQ section with 3 questions. Include these internal links: ${linkSuggestions}. Minimum 800 words.`,
    market_regime_report: `Write a Market Regime Report for ${todayStr}. ${ctx} Include: (1) Current Regime Classification, (2) Regime Characteristics, (3) Historical Regime Comparisons, (4) Asset Class Implications, (5) Regime Transition Signals, (6) Portfolio Positioning Considerations, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 900 words.`,
    historical_analog_report: `Write a Historical Analog Report for ${todayStr}. ${ctx} Include: (1) Current Market Analog Overview, (2) Historical Comparison Period, (3) Similarities and Differences, (4) What Happened Next in History, (5) Key Divergence Risks, (6) Lessons for Today, (7) FAQ section with 4 questions. Include these internal links: ${linkSuggestions}. Minimum 1200 words.`,
  };

  // Generate title and meta description
  const metaResponse = await invokeLLM({
    messages: [
      { role: "system", content: "You generate SEO-optimized titles and meta descriptions for market intelligence articles. Return JSON only." },
      { role: "user", content: `Generate a title (max 65 chars) and meta description (max 155 chars) for a ${config.label} dated ${todayStr}. ${ctx} Return JSON: {"title": "...", "metaDescription": "..."}` }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meta",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            metaDescription: { type: "string" }
          },
          required: ["title", "metaDescription"],
          additionalProperties: false
        }
      }
    }
  });

  let title = `${config.label} — ${todayStr}`;
  let metaDescription = `FAULTLINE ${config.label} for ${todayStr}. Market intelligence powered by real-time risk data.`;

  try {
    const metaParsed = JSON.parse(metaResponse.choices[0].message.content as string);
    title = metaParsed.title || title;
    metaDescription = metaParsed.metaDescription || metaDescription;
  } catch { /* use defaults */ }

  // Generate full content
  const contentResponse = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentPrompts[contentType] }
    ]
  });

  const rawContent = contentResponse.choices[0].message.content as string;

  // Validate quality
  const validation = validateContent(rawContent, title, metaDescription, config.minWords);
  const wordCount = rawContent.split(/\s+/).filter(Boolean).length;

  // Build schema markup
  const publishedAt = new Date().toISOString();
  const schemaJson = buildSchema(title, metaDescription, slug, publishedAt);

  // Build internal links JSON
  const internalLinksJson = JSON.stringify(relevantLinks);

  // Generate featured image prompt
  const imagePrompt = `Professional financial data visualization for "${title}". Dark background, glowing data charts, market indicators, risk gauges. FAULTLINE brand aesthetic. Cinematic lighting.`;

  // Insert into database
  const status = validation.passed ? "published" : "rejected";

  await db.insert(organicContent).values({
    contentType,
    slug,
    title,
    metaDescription,
    content: rawContent,
    schemaJson,
    internalLinksJson,
    featuredImagePrompt: imagePrompt,
    status,
    qualityScore: validation.score,
    wordCount,
    rejectionReason: validation.reason ?? null,
    pressureScore: contextData?.pressureScore ?? null,
    regime: contextData?.regime ?? null,
    publishedAt: validation.passed ? new Date() : null,
  });

  const inserted = await db.select({ id: organicContent.id })
    .from(organicContent)
    .where(eq(organicContent.slug, slug))
    .limit(1);

  console.log(`[OrganicContent] ${status}: "${title}" (${wordCount} words, score: ${validation.score}) → /intelligence/${slug}`);

  return {
    ok: true,
    id: inserted[0]?.id,
    slug,
    ...(status === "rejected" ? { error: validation.reason } : {})
  };
}

// ── Signal page generator ────────────────────────────────────────────────────
export async function generateSignalPage(
  symbol: string,
  assetType: "stock" | "crypto",
  name: string,
  contextData?: {
    pressureScore?: number;
    regime?: string;
    signalLabel?: string;
    lastPrice?: number;
    dailyChangePct?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, error: "database unavailable" };

  const ctx = contextData
    ? `Current market context: FAULTLINE Pressure Score ${contextData.pressureScore ?? "N/A"}/100, Regime: ${contextData.regime ?? "Unknown"}${contextData.signalLabel ? `, Signal: ${contextData.signalLabel}` : ""}${contextData.lastPrice ? `, Last Price: $${contextData.lastPrice}` : ""}${contextData.dailyChangePct != null ? `, Daily Change: ${contextData.dailyChangePct > 0 ? "+" : ""}${contextData.dailyChangePct}%` : ""}.`
    : "";

  const assetLabel = assetType === "stock" ? "stock" : "cryptocurrency";

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are FAULTLINE Intelligence, a professional market analysis engine. Generate structured signal analysis for a financial asset. Return JSON only." },
      { role: "user", content: `Generate signal page content for ${name} (${symbol}), a ${assetLabel}. ${ctx}
Return JSON with these fields:
- signalSummary: 2-3 sentence current signal summary
- bullishCase: 150-200 word bullish analysis
- bearishCase: 150-200 word bearish analysis  
- macroRisks: 150-200 word macro risk analysis
- technicalRisks: 100-150 word technical risk analysis
- catalystAnalysis: 150-200 word upcoming catalyst analysis
- confidenceScore: integer 0-100
- signalLabel: one of "BULLISH", "BEARISH", "NEUTRAL", "WATCH"
- faqs: array of 5 objects with "question" and "answer" fields` }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "signal_page",
        strict: true,
        schema: {
          type: "object",
          properties: {
            signalSummary: { type: "string" },
            bullishCase: { type: "string" },
            bearishCase: { type: "string" },
            macroRisks: { type: "string" },
            technicalRisks: { type: "string" },
            catalystAnalysis: { type: "string" },
            confidenceScore: { type: "integer" },
            signalLabel: { type: "string" },
            faqs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" }
                },
                required: ["question", "answer"],
                additionalProperties: false
              }
            }
          },
          required: ["signalSummary", "bullishCase", "bearishCase", "macroRisks", "technicalRisks", "catalystAnalysis", "confidenceScore", "signalLabel", "faqs"],
          additionalProperties: false
        }
      }
    }
  });

  interface SignalPageData {
    signalSummary: string;
    bullishCase: string;
    bearishCase: string;
    macroRisks: string;
    technicalRisks: string;
    catalystAnalysis: string;
    confidenceScore: number;
    faqs: Array<{ question: string; answer: string }>;
    signalLabel: string;
  }
  let data: SignalPageData;
  try {
    data = JSON.parse(response.choices[0].message.content as string) as SignalPageData;
  } catch {
    return { ok: false, error: 'LLM returned invalid JSON for signal page generation' };
  }

  await db.insert(signalPages).values({
    symbol: symbol.toUpperCase(),
    assetType,
    name,
    signalSummary: data.signalSummary,
    bullishCase: data.bullishCase,
    bearishCase: data.bearishCase,
    macroRisks: data.macroRisks,
    technicalRisks: data.technicalRisks,
    catalystAnalysis: data.catalystAnalysis,
    confidenceScore: data.confidenceScore,
    faqJson: JSON.stringify(data.faqs),
    signalLabel: data.signalLabel,
    lastPrice: contextData?.lastPrice ? String(contextData.lastPrice) : null,
    dailyChangePct: contextData?.dailyChangePct != null ? String(contextData.dailyChangePct) : null,
    pressureScore: contextData?.pressureScore ?? null,
    regime: contextData?.regime ?? null,
    lastUpdatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      signalSummary: data.signalSummary,
      bullishCase: data.bullishCase,
      bearishCase: data.bearishCase,
      macroRisks: data.macroRisks,
      technicalRisks: data.technicalRisks,
      catalystAnalysis: data.catalystAnalysis,
      confidenceScore: data.confidenceScore,
      faqJson: JSON.stringify(data.faqs),
      signalLabel: data.signalLabel,
      lastPrice: contextData?.lastPrice ? String(contextData.lastPrice) : null,
      dailyChangePct: contextData?.dailyChangePct != null ? String(contextData.dailyChangePct) : null,
      pressureScore: contextData?.pressureScore ?? null,
      regime: contextData?.regime ?? null,
      lastUpdatedAt: new Date(),
    }
  });

  console.log(`[SignalPage] Updated: ${symbol} (${assetType}) — ${data.signalLabel} ${data.confidenceScore}%`);
  return { ok: true };
}

// ── HTTP handlers for cron endpoints ────────────────────────────────────────

/**
 * POST /api/scheduled/generate-organic-content
 * Body: { contentType, pressureScore?, regime?, stressLevel?, crashProbability?, bullProbability?, topDrivers? }
 */
export async function handleGenerateOrganicContent(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "cron or admin only" });
    }

    const { contentType, pressureScore, regime, stressLevel, crashProbability, bullProbability, topDrivers } = req.body as {
      contentType?: ContentType;
      pressureScore?: number;
      regime?: string;
      stressLevel?: string;
      crashProbability?: number;
      bullProbability?: number;
      topDrivers?: string[];
    };

    if (!contentType || !CONTENT_CONFIG[contentType]) {
      return res.status(400).json({ error: "invalid contentType", valid: Object.keys(CONTENT_CONFIG) });
    }

    const result = await generateOrganicContent(contentType, {
      pressureScore, regime, stressLevel, crashProbability, bullProbability, topDrivers
    });

    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[OrganicContent] Error:", message);
    return res.status(500).json({ error: message });
  }
}

/**
 * POST /api/scheduled/refresh-signal-pages
 * Refreshes all tracked stock and crypto signal pages
 */
export async function handleRefreshSignalPages(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "cron or admin only" });
    }

    const { pressureScore, regime } = req.body as { pressureScore?: number; regime?: string };

    const results: Array<{ symbol: string; ok: boolean; error?: string }> = [];

    // Process stocks
    for (const stock of TRACKED_STOCKS) {
      try {
        const r = await generateSignalPage(stock.symbol, "stock", stock.name, { pressureScore, regime });
        results.push({ symbol: stock.symbol, ok: r.ok, error: r.error });
      } catch (e) {
        results.push({ symbol: stock.symbol, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Process crypto
    for (const crypto of TRACKED_CRYPTO) {
      try {
        const r = await generateSignalPage(crypto.symbol, "crypto", crypto.name, { pressureScore, regime });
        results.push({ symbol: crypto.symbol, ok: r.ok, error: r.error });
      } catch (e) {
        results.push({ symbol: crypto.symbol, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return res.json({ ok: true, succeeded, failed, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SignalPages] Error:", message);
    return res.status(500).json({ error: message });
  }
}
