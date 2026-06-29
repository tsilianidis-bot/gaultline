/**
 * FAULTLINE Autonomous Intelligence Publishing System
 *
 * Handles three scheduled publishing pipelines:
 *   POST /api/scheduled/daily-brief    — every weekday at 07:00 UTC
 *   POST /api/scheduled/weekly-review  — every Sunday at 08:00 UTC
 *   POST /api/scheduled/monthly-report — 1st of each month at 09:00 UTC
 *
 * Pipeline for each run:
 *   1. Collect live FMOS engine data
 *   2. Check data availability (guard against fabrication)
 *   3. Check for duplicate (same type, same day)
 *   4. Generate content via LLM using real data
 *   5. Validate (word count, structure, SEO metadata, no placeholder text)
 *   6. Publish (confidence ≥ threshold) or save as draft
 *   7. Update daily_brief_schedule stats
 *   8. Notify users by subscription tier
 *   9. Notify owner
 */

import type { Request, Response } from "express";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  organicContent,
  dailyBriefSchedule,
  users,
} from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { sendEmail } from "./email";
import { calculateFaultlinePressure, type FaultlinePressureOutput } from "./pressure/engine";
import { getDiagnosticReport, type DiagnosticReport } from "./diagnosticAI";

// ── Types ─────────────────────────────────────────────────────────────────────

type PublishType = "daily_brief" | "weekly_review" | "monthly_report";

interface EngineSnapshot {
  pressureScore: number;
  regime: string;
  stressLevel: string;
  crashProbability: number | null;
  bullProbability: number | null;
  topDrivers: string[];
  dataAvailable: boolean;
  missingFields: string[];
}

interface PublishResult {
  ok: boolean;
  status: "published" | "draft" | "skipped" | "error";
  slug?: string;
  id?: number;
  reason?: string;
  wordCount?: number;
  qualityScore?: number;
}

// ── Internal link map ─────────────────────────────────────────────────────────

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
  { text: "Ask FAULTLINE Intelligence", href: "/app/discover" },
];

// ── Config per publish type ───────────────────────────────────────────────────

const PUBLISH_CONFIG: Record<PublishType, {
  label: string;
  category: string;
  slugPrefix: string;
  minWords: number;
  minConfidence: number;
  sections: string[];
}> = {
  daily_brief: {
    label: "Daily Intelligence Brief",
    category: "Daily Intelligence",
    slugPrefix: "daily-brief",
    minWords: 1000,
    minConfidence: 65,
    sections: [
      "Executive Summary",
      "Pressure Index™ Reading",
      "Bull vs Crash Probability",
      "Current Market Regime",
      "What Changed Today",
      "Macro Analysis",
      "Liquidity Analysis",
      "Volatility Analysis",
      "Equity Signals",
      "Crypto Signals",
      "Sector Rotation",
      "AI Sector Update",
      "Treasury Update",
      "Credit Market Update",
      "Major Risks",
      "Opportunities",
      "Upcoming Events",
      "Bottom Line",
    ],
  },
  weekly_review: {
    label: "Weekly Intelligence Review",
    category: "Weekly Intelligence",
    slugPrefix: "weekly-review",
    minWords: 1400,
    minConfidence: 60,
    sections: [
      "Executive Summary",
      "Weekly Pressure Trend",
      "Bull vs Crash Changes",
      "Best Signals This Week",
      "Worst Signals This Week",
      "Sector Rotation",
      "Crypto Rotation",
      "Biggest Macro Events",
      "Regime Changes",
      "Market Outlook",
      "Lessons Learned",
    ],
  },
  monthly_report: {
    label: "Monthly Market Intelligence Report",
    category: "Monthly Intelligence",
    slugPrefix: "monthly-report",
    minWords: 2000,
    minConfidence: 55,
    sections: [
      "Executive Summary",
      "Pressure Index History",
      "Regime Evolution",
      "Liquidity Changes",
      "Volatility Changes",
      "AI Sector Performance",
      "Crypto Review",
      "Track Record Summary",
      "Best Performing Signals",
      "Biggest Misses",
      "Upcoming Risks",
    ],
  },
};

// ── Engine data collector ─────────────────────────────────────────────────────

async function collectEngineData(): Promise<EngineSnapshot> {
  const missingFields: string[] = [];
  let pressureScore: number | null = null;
  let regime: string | null = null;
  let stressLevel: string | null = null;
  let crashProbability: number | null = null;
  let bullProbability: number | null = null;
  const topDrivers: string[] = [];

  try {
    const pressure = await calculateFaultlinePressure();
    pressureScore = pressure.overallPressure ?? null;
    regime = pressure.regime ?? null;
    stressLevel = pressure.level ?? null;
    topDrivers.push(...(pressure.alerts ?? []).slice(0, 5).map(a => a.title));
  } catch (err) {
    console.warn("[AutoPublish] Pressure engine unavailable:", err);
    missingFields.push("pressureScore", "regime", "stressLevel");
  }

  try {
    const diag = await getDiagnosticReport("today");
    crashProbability = (diag as DiagnosticReport).crashRisk?.score ?? null;
    bullProbability = (diag as DiagnosticReport).bullContinuation?.score ?? null;
  } catch (err) {
    console.warn("[AutoPublish] Diagnostic engine unavailable:", err);
    missingFields.push("crashProbability", "bullProbability");
  }

  const dataAvailable = pressureScore !== null && regime !== null;

  return {
    pressureScore: pressureScore ?? 50,
    regime: regime ?? "Unknown",
    stressLevel: stressLevel ?? "Unknown",
    crashProbability,
    bullProbability,
    topDrivers,
    dataAvailable,
    missingFields,
  };
}

// ── Duplicate checker ─────────────────────────────────────────────────────────

async function checkDuplicate(slugPrefix: string, dateStr: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const slug = `${slugPrefix}-${dateStr}`;
  const existing = await db.select({ id: organicContent.id })
    .from(organicContent)
    .where(eq(organicContent.slug, slug))
    .limit(1);

  return existing.length > 0;
}

// ── Quality validator ─────────────────────────────────────────────────────────

interface ValidationResult {
  passed: boolean;
  score: number;
  reason?: string;
}

function validateContent(
  content: string,
  title: string,
  description: string,
  minWords: number,
  requiredSections: string[]
): ValidationResult {
  const words = content.split(/\s+/).filter(Boolean).length;

  if (words < minWords) {
    return { passed: false, score: 20, reason: `thin-content: ${words} words (min ${minWords})` };
  }
  if (title.length < 10 || title.length > 300) {
    return { passed: false, score: 30, reason: "title-invalid-length" };
  }
  if (description.length < 50 || description.length > 200) {
    return { passed: false, score: 30, reason: "description-invalid-length" };
  }

  // Check for placeholder text that indicates fabrication
  const placeholderPatterns = [
    /\[INSERT/i, /\[PLACEHOLDER/i, /\[TODO/i, /\[DATA UNAVAILABLE/i,
    /lorem ipsum/i, /EXAMPLE DATA/i, /FABRICATED/i
  ];
  for (const pattern of placeholderPatterns) {
    if (pattern.test(content)) {
      return { passed: false, score: 0, reason: "fabricated-or-placeholder-content" };
    }
  }

  // Check for required structural elements
  const hasH2 = /^##\s/m.test(content);
  const hasFaq = /FAQ|frequently asked/i.test(content);
  const hasInternalLink = /\[.*?\]\(\/.*?\)/.test(content);

  // Check that at least 60% of required sections are present
  const sectionsFound = requiredSections.filter(s =>
    content.toLowerCase().includes(s.toLowerCase().replace(/™/g, ""))
  ).length;
  const sectionCoverage = sectionsFound / requiredSections.length;

  let score = 50;
  if (hasH2) score += 10;
  if (hasFaq) score += 10;
  if (hasInternalLink) score += 10;
  score += Math.round(sectionCoverage * 20);

  if (sectionCoverage < 0.5) {
    return { passed: false, score, reason: `missing-sections: only ${sectionsFound}/${requiredSections.length} found` };
  }

  return { passed: true, score };
}

// ── Schema markup builder ─────────────────────────────────────────────────────

function buildSchema(title: string, description: string, slug: string, publishedAt: string, category: string) {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": description,
      "url": `https://getfaultline.live/intelligence/${slug}`,
      "datePublished": publishedAt,
      "dateModified": publishedAt,
      "articleSection": category,
      "publisher": {
        "@type": "Organization",
        "name": "FAULTLINE",
        "url": "https://getfaultline.live",
        "logo": { "@type": "ImageObject", "url": "https://getfaultline.live/logo.png" }
      },
      "author": {
        "@type": "Organization",
        "name": "FAULTLINE Intelligence Engine",
        "url": "https://getfaultline.live"
      }
    }
  ]);
}

// ── Notification dispatcher ───────────────────────────────────────────────────

async function notifyUsersByTier(
  title: string,
  slug: string,
  category: string
): Promise<{ notified: number; emailed: number }> {
  const db = await getDb();
  if (!db) return { notified: 0, emailed: 0 };

  let notified = 0;
  let emailed = 0;
  const articleUrl = `https://getfaultline.live/intelligence/${slug}`;

  try {
    // Get all users with email for pro/founding tiers
    const eligibleUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      accessTier: users.accessTier,
    })
      .from(users)
      .where(
        sql`${users.accessTier} IN ('core', 'premium', 'founding')`
      )
      .limit(500);

    for (const user of eligibleUsers) {
      const tier = user.accessTier;

      // Pro and Founding: send email
      if ((tier === "premium" || tier === "founding") && user.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: `New ${category}: ${title}`,
            html: buildBriefEmailHtml({
              name: user.name ?? "Investor",
              title,
              category,
              articleUrl,
              tier,
            }),
          });
          emailed++;
        } catch (err) {
          console.warn(`[AutoPublish] Email failed for user ${user.id}:`, err);
        }
      }

      notified++;
    }
  } catch (err) {
    console.warn("[AutoPublish] Notification dispatch error:", err);
  }

  return { notified, emailed };
}

function buildBriefEmailHtml(opts: {
  name: string;
  title: string;
  category: string;
  articleUrl: string;
  tier: string;
}): string {
  const { name, title, category, articleUrl, tier } = opts;
  const tierLabel = tier === "founding" ? "Founding Member" : tier === "premium" ? "Pro Member" : "Core Member";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-family:'Rajdhani',Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:0.12em;color:#00D4FF;margin-bottom:8px;">
      FAULT<span style="color:#E2E8F0;">LINE</span>
    </div>
    <div style="font-size:11px;color:#64748B;letter-spacing:0.1em;margin-bottom:32px;">INSTITUTIONAL MARKET INTELLIGENCE</div>
    <div style="background:#0A1520;border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:32px;margin-bottom:24px;">
      <div style="font-size:11px;color:#00D4FF;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">${category}</div>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#E2E8F0;line-height:1.3;">${title}</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#94A3B8;line-height:1.6;">
        Hi ${name}, your latest FAULTLINE intelligence brief is ready. This report is powered by live market data from the FAULTLINE engine — not AI speculation.
      </p>
      <a href="${articleUrl}" style="display:inline-block;background:#00D4FF;color:#050A0F;font-weight:700;font-size:14px;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:0.05em;">
        READ FULL BRIEF →
      </a>
    </div>
    <div style="font-size:11px;color:#334155;text-align:center;">
      ${tierLabel} · <a href="https://getfaultline.live/app/profile" style="color:#334155;">Manage preferences</a>
    </div>
  </div>
</body>
</html>`;
}

// ── Schedule stats updater ────────────────────────────────────────────────────

async function updateScheduleStats(
  status: "success" | "draft" | "skipped" | "error",
  slug: string | null,
  error: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const [existing] = await db.select({ id: dailyBriefSchedule.id })
      .from(dailyBriefSchedule)
      .limit(1);

    if (existing) {
      if (status === "success") {
        await db.update(dailyBriefSchedule).set({
          lastRunAt: new Date(), lastRunStatus: status, lastRunSlug: slug ?? null, lastRunError: error ?? null,
          totalPublished: sql`${dailyBriefSchedule.totalPublished} + 1`,
        }).where(eq(dailyBriefSchedule.id, existing.id));
      } else if (status === "draft") {
        await db.update(dailyBriefSchedule).set({
          lastRunAt: new Date(), lastRunStatus: status, lastRunSlug: slug ?? null, lastRunError: error ?? null,
          totalDrafts: sql`${dailyBriefSchedule.totalDrafts} + 1`,
        }).where(eq(dailyBriefSchedule.id, existing.id));
      } else if (status === "skipped") {
        await db.update(dailyBriefSchedule).set({
          lastRunAt: new Date(), lastRunStatus: status, lastRunSlug: slug ?? null, lastRunError: error ?? null,
          totalSkipped: sql`${dailyBriefSchedule.totalSkipped} + 1`,
        }).where(eq(dailyBriefSchedule.id, existing.id));
      } else {
        await db.update(dailyBriefSchedule).set({
          lastRunAt: new Date(), lastRunStatus: status, lastRunSlug: slug ?? null, lastRunError: error ?? null,
        }).where(eq(dailyBriefSchedule.id, existing.id));
      }
    } else {
      // Create initial schedule record
      await db.insert(dailyBriefSchedule).values({
        cronExpression: "0 0 7 * * *",
        isActive: true,
        confidenceThreshold: 70,
        minWordCount: 600,
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunSlug: slug ?? null,
        lastRunError: error ?? null,
        totalPublished: status === "success" ? 1 : 0,
        totalDrafts: status === "draft" ? 1 : 0,
        totalSkipped: status === "skipped" ? 1 : 0,
      });
    }
  } catch (err) {
    console.warn("[AutoPublish] Failed to update schedule stats:", err);
  }
}

// ── Core publishing function ──────────────────────────────────────────────────

async function runPublishingPipeline(
  publishType: PublishType,
  engineData: EngineSnapshot,
  confidenceThreshold: number
): Promise<PublishResult> {
  const db = await getDb();
  if (!db) return { ok: false, status: "error", reason: "database unavailable" };

  const config = PUBLISH_CONFIG[publishType];
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const slug = `${config.slugPrefix}-${dateStr}`;

  // ── Step 1: Data availability guard ──────────────────────────────────────
  if (!engineData.dataAvailable) {
    console.warn(`[AutoPublish] Insufficient data for ${publishType} — missing: ${engineData.missingFields.join(", ")}`);
    return { ok: true, status: "draft", reason: `data-unavailable: ${engineData.missingFields.join(", ")}` };
  }

  // ── Step 2: Duplicate check ───────────────────────────────────────────────
  const isDuplicate = await checkDuplicate(config.slugPrefix, dateStr);
  if (isDuplicate) {
    console.log(`[AutoPublish] Skipping ${publishType} — already published today (${slug})`);
    return { ok: true, status: "skipped", slug, reason: "duplicate" };
  }

  // ── Step 3: Build context string ─────────────────────────────────────────
  const ctx = [
    `FAULTLINE Pressure Index™: ${engineData.pressureScore}/100`,
    `Market Regime: ${engineData.regime}`,
    `Stress Level: ${engineData.stressLevel}`,
    engineData.crashProbability !== null ? `Crash Probability: ${engineData.crashProbability}%` : null,
    engineData.bullProbability !== null ? `Bull Continuation Probability: ${engineData.bullProbability}%` : null,
    engineData.topDrivers.length > 0 ? `Top Drivers: ${engineData.topDrivers.join(", ")}` : null,
    `Date: ${dateStr}`,
  ].filter(Boolean).join(". ");

  const linkSuggestions = INTERNAL_LINKS.slice(0, 6).map(l => `[${l.text}](${l.href})`).join(", ");

  const systemPrompt = `You are the FAULTLINE Intelligence Engine — an institutional-grade market analysis system. You write authoritative, data-driven market intelligence for sophisticated investors. Your content is grounded in the provided FAULTLINE engine data only. Never fabricate statistics, prices, or market data not provided. Write in third person. Use markdown with H2 and H3 headings. Do not use placeholder text like [INSERT DATA HERE].`;

  const sectionList = config.sections.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const contentPrompts: Record<PublishType, string> = {
    daily_brief: `Write a Daily Intelligence Brief for ${dateStr} using ONLY the following real FAULTLINE engine data:

${ctx}

Structure the brief with these ${config.sections.length} sections:
${sectionList}

Include a FAQ section with 4 questions at the end. Naturally embed these internal links: ${linkSuggestions}.

CRITICAL: Base all analysis on the provided data. Do not invent price levels, percentages, or statistics not given above. If a data point is unavailable, acknowledge it briefly and move on. Minimum ${config.minWords} words.`,

    weekly_review: `Write a Weekly Intelligence Review for the week ending ${dateStr} using ONLY the following FAULTLINE engine data:

${ctx}

Structure the review with these ${config.sections.length} sections:
${sectionList}

Include a FAQ section with 4 questions at the end. Naturally embed these internal links: ${linkSuggestions}.

CRITICAL: Base all analysis on the provided data. Do not invent statistics. Minimum ${config.minWords} words.`,

    monthly_report: `Write a Monthly Market Intelligence Report for ${now.toLocaleString("en-US", { month: "long", year: "numeric" })} using ONLY the following FAULTLINE engine data:

${ctx}

Structure the report with these ${config.sections.length} sections:
${sectionList}

Include a FAQ section with 5 questions at the end. Naturally embed these internal links: ${linkSuggestions}.

CRITICAL: Base all analysis on the provided data. Do not invent statistics. Minimum ${config.minWords} words.`,
  };

  // ── Step 4: Generate SEO metadata ────────────────────────────────────────
  let title = `${config.label} — ${dateStr}`;
  let metaDescription = `FAULTLINE ${config.label} for ${dateStr}. Institutional market intelligence powered by live FAULTLINE engine data.`;

  try {
    const metaResponse = await invokeLLM({
      messages: [
        { role: "system", content: "Generate SEO-optimized titles and meta descriptions for market intelligence articles. Return JSON only." },
        { role: "user", content: `Generate a title (max 65 chars) and meta description (max 155 chars) for a FAULTLINE ${config.label} dated ${dateStr}. Context: ${ctx}. Return JSON: {"title": "...", "metaDescription": "..."}` }
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
    const metaParsed = JSON.parse(metaResponse.choices[0].message.content as string);
    title = metaParsed.title || title;
    metaDescription = metaParsed.metaDescription || metaDescription;
  } catch { /* use defaults */ }

  // ── Step 5: Generate full content ─────────────────────────────────────────
  const contentResponse = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentPrompts[publishType] }
    ]
  });

  const rawContent = contentResponse.choices[0].message.content as string;
  const wordCount = rawContent.split(/\s+/).filter(Boolean).length;

  // ── Step 6: Validate ──────────────────────────────────────────────────────
  const validation = validateContent(rawContent, title, metaDescription, config.minWords, config.sections);

  // ── Step 7: Determine publish vs draft ────────────────────────────────────
  const shouldPublish = validation.passed && validation.score >= confidenceThreshold;
  const status = shouldPublish ? "published" : "draft";

  // ── Step 8: Build schema markup ───────────────────────────────────────────
  const publishedAt = now.toISOString();
  const schemaJson = buildSchema(title, metaDescription, slug, publishedAt, config.category);
  const internalLinksJson = JSON.stringify(INTERNAL_LINKS.slice(0, 6));

  // ── Step 9: Insert into database ──────────────────────────────────────────
  await db.insert(organicContent).values({
    contentType: publishType === "daily_brief" ? "daily_market_brief" : publishType === "weekly_review" ? "weekly_market_outlook" : "market_regime_report",
    slug,
    title,
    metaDescription,
    content: rawContent,
    schemaJson,
    internalLinksJson,
    featuredImagePrompt: `Professional financial data visualization for "${title}". Dark background, glowing FAULTLINE data charts, institutional market intelligence aesthetic. Cinematic lighting.`,
    status,
    qualityScore: validation.score,
    wordCount,
    rejectionReason: validation.reason ?? null,
    pressureScore: engineData.pressureScore,
    regime: engineData.regime,
    publishedAt: shouldPublish ? now : null,
  });

  const [inserted] = await db.select({ id: organicContent.id })
    .from(organicContent)
    .where(eq(organicContent.slug, slug))
    .limit(1);

  console.log(`[AutoPublish] ${status}: "${title}" (${wordCount} words, score: ${validation.score}) → /intelligence/${slug}`);

  return {
    ok: true,
    status: shouldPublish ? "published" : "draft",
    slug,
    id: inserted?.id,
    wordCount,
    qualityScore: validation.score,
    reason: validation.reason,
  };
}

// ── HTTP Handlers ─────────────────────────────────────────────────────────────

/**
 * POST /api/scheduled/daily-brief
 * Called by Heartbeat cron every weekday at 07:00 UTC
 */
export async function handleDailyBrief(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "cron or admin only" });
    }

    console.log("[AutoPublish] Starting daily brief pipeline…");

    const engineData = await collectEngineData();

    if (!engineData.dataAvailable) {
      console.warn("[AutoPublish] Daily brief postponed — engine data unavailable");
      await updateScheduleStats("draft", null, `data-unavailable: ${engineData.missingFields.join(", ")}`);
      await notifyOwner({
        title: "⚠️ Daily Brief Postponed",
        content: `The daily brief was saved as a draft because required engine data was unavailable. Missing: ${engineData.missingFields.join(", ")}. Review and publish manually from the Publishing Dashboard.`,
      });
      return res.json({ ok: true, status: "draft", reason: "engine-data-unavailable" });
    }

    const result = await runPublishingPipeline("daily_brief", engineData, 65);

    await updateScheduleStats(
      result.status === "published" ? "success" : result.status === "skipped" ? "skipped" : "draft",
      result.slug ?? null,
      result.reason ?? null
    );

    if (result.status === "published" && result.slug) {
      const { notified, emailed } = await notifyUsersByTier(
        result.slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        result.slug,
        "Daily Intelligence Brief"
      );

      await notifyOwner({
        title: "✅ Daily Brief Published",
        content: `Today's Daily Intelligence Brief has been published.\n\nSlug: /intelligence/${result.slug}\nWord count: ${result.wordCount}\nQuality score: ${result.qualityScore}/100\nUsers notified: ${notified}\nEmails sent: ${emailed}\n\nPressure Index™: ${engineData.pressureScore}/100 | Regime: ${engineData.regime}`,
      });
    } else if (result.status === "draft") {
      await notifyOwner({
        title: "📋 Daily Brief Saved as Draft",
        content: `Today's Daily Intelligence Brief did not meet the confidence threshold and was saved as a draft.\n\nReason: ${result.reason ?? "quality-threshold"}\nQuality score: ${result.qualityScore ?? 0}/100\n\nReview and publish manually from the Publishing Dashboard at /app/admin/publishing.`,
      });
    }

    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AutoPublish] Daily brief error:", message);
    await updateScheduleStats("error", null, message).catch(() => {});
    await notifyOwner({
      title: "❌ Daily Brief Failed",
      content: `The automated daily brief pipeline failed with an error:\n\n${message}\n\nCheck server logs for details.`,
    }).catch(() => {});
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/scheduled/weekly-review
 * Called by Heartbeat cron every Sunday at 08:00 UTC
 */
export async function handleWeeklyReview(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "cron or admin only" });
    }

    console.log("[AutoPublish] Starting weekly review pipeline…");

    const engineData = await collectEngineData();
    const result = await runPublishingPipeline("weekly_review", engineData, 60);

    if (result.status === "published" && result.slug) {
      await notifyUsersByTier(
        result.slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        result.slug,
        "Weekly Intelligence Review"
      );
      await notifyOwner({
        title: "✅ Weekly Review Published",
        content: `Weekly Intelligence Review published.\nSlug: /intelligence/${result.slug}\nWord count: ${result.wordCount}\nQuality score: ${result.qualityScore}/100`,
      });
    } else if (result.status === "draft") {
      await notifyOwner({
        title: "📋 Weekly Review Saved as Draft",
        content: `Weekly Review saved as draft. Reason: ${result.reason ?? "quality-threshold"}. Review at /app/admin/publishing.`,
      });
    }

    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AutoPublish] Weekly review error:", message);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/scheduled/monthly-report
 * Called by Heartbeat cron on the 1st of each month at 09:00 UTC
 */
export async function handleMonthlyReport(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && user.role !== "admin") {
      return res.status(403).json({ error: "cron or admin only" });
    }

    console.log("[AutoPublish] Starting monthly report pipeline…");

    const engineData = await collectEngineData();
    const result = await runPublishingPipeline("monthly_report", engineData, 55);

    if (result.status === "published" && result.slug) {
      await notifyUsersByTier(
        result.slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        result.slug,
        "Monthly Market Intelligence Report"
      );
      await notifyOwner({
        title: "✅ Monthly Report Published",
        content: `Monthly Market Intelligence Report published.\nSlug: /intelligence/${result.slug}\nWord count: ${result.wordCount}\nQuality score: ${result.qualityScore}/100`,
      });
    } else if (result.status === "draft") {
      await notifyOwner({
        title: "📋 Monthly Report Saved as Draft",
        content: `Monthly Report saved as draft. Reason: ${result.reason ?? "quality-threshold"}. Review at /app/admin/publishing.`,
      });
    }

    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AutoPublish] Monthly report error:", message);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/scheduled/daily-brief/manual
 * Admin-only manual trigger for any publish type
 */
export async function handleManualPublish(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "admin only" });
    }

    const { publishType, forcePublish } = req.body as {
      publishType?: PublishType;
      forcePublish?: boolean;
    };

    if (!publishType || !PUBLISH_CONFIG[publishType]) {
      return res.status(400).json({ error: "invalid publishType", valid: Object.keys(PUBLISH_CONFIG) });
    }

    const engineData = await collectEngineData();
    // For manual triggers, use a lower threshold (or 0 if forcePublish)
    const threshold = forcePublish ? 0 : 50;
    const result = await runPublishingPipeline(publishType, engineData, threshold);

    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AutoPublish] Manual publish error:", message);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/publishing/status
 * Returns current publishing pipeline status for the admin dashboard
 */
export async function handlePublishingStatus(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "admin only" });
    }

    const db = await getDb();
    if (!db) return res.json({ schedule: null, recentContent: [] });

    const [schedule] = await db.select()
      .from(dailyBriefSchedule)
      .limit(1);

    const recentContent = await db.select({
      id: organicContent.id,
      contentType: organicContent.contentType,
      slug: organicContent.slug,
      title: organicContent.title,
      status: organicContent.status,
      qualityScore: organicContent.qualityScore,
      wordCount: organicContent.wordCount,
      rejectionReason: organicContent.rejectionReason,
      publishedAt: organicContent.publishedAt,
      createdAt: organicContent.createdAt,
    })
      .from(organicContent)
      .where(
        sql`${organicContent.contentType} IN ('daily_market_brief', 'weekly_market_outlook', 'market_regime_report')`
      )
      .orderBy(desc(organicContent.createdAt))
      .limit(30);

    const draftQueue = recentContent.filter(c => c.status === "draft");
    const publishedHistory = recentContent.filter(c => c.status === "published");

    return res.json({
      schedule: schedule ?? null,
      draftQueue,
      publishedHistory,
      stats: {
        totalPublished: schedule?.totalPublished ?? 0,
        totalDrafts: schedule?.totalDrafts ?? 0,
        totalSkipped: schedule?.totalSkipped ?? 0,
        lastRunAt: schedule?.lastRunAt ?? null,
        lastRunStatus: schedule?.lastRunStatus ?? null,
        isActive: schedule?.isActive ?? false,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/publishing/toggle-active
 * Admin: pause or resume the automation
 */
export async function handleToggleActive(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "admin only" });
    }

    const { isActive } = req.body as { isActive: boolean };
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database unavailable" });

    const [existing] = await db.select({ id: dailyBriefSchedule.id })
      .from(dailyBriefSchedule)
      .limit(1);

    if (existing) {
      await db.update(dailyBriefSchedule)
        .set({ isActive })
        .where(eq(dailyBriefSchedule.id, existing.id));
    } else {
      await db.insert(dailyBriefSchedule).values({
        cronExpression: "0 0 7 * * *",
        isActive,
        confidenceThreshold: 70,
        minWordCount: 600,
      });
    }

    return res.json({ ok: true, isActive });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/publishing/publish-draft/:id
 * Admin: manually publish a draft article
 */
export async function handlePublishDraft(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "admin only" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "invalid id" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database unavailable" });

    await db.update(organicContent)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(organicContent.id, id));

    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
