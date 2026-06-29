/**
 * FAULTLINE RSS Feed
 *
 * GET /api/rss.xml — Returns an RSS 2.0 feed of the latest published intelligence content.
 * Includes daily briefs, weekly reviews, monthly reports, and evergreen articles.
 *
 * The feed is generated on-the-fly from the database (no caching needed at this scale).
 */

import type { Request, Response } from "express";
import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { organicContent } from "../drizzle/schema";

const SITE_URL = "https://getfaultline.live";
const FEED_TITLE = "FAULTLINE Intelligence — Daily Market Briefings";
const FEED_DESCRIPTION =
  "Institutional-grade daily market intelligence briefs, weekly reviews, and macro analysis powered by the FAULTLINE Market Operating System.";
const FEED_LANGUAGE = "en-us";
const FEED_COPYRIGHT = `Copyright ${new Date().getFullYear()} FAULTLINE`;
const FEED_TTL = "60"; // minutes

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRfc822(date: Date | string | null | undefined): string {
  if (!date) return new Date().toUTCString();
  return new Date(date).toUTCString();
}

function contentTypeToCategory(contentType: string): string {
  const map: Record<string, string> = {
    daily_market_brief: "Daily Intelligence",
    weekly_market_outlook: "Weekly Intelligence",
    market_regime_report: "Monthly Intelligence",
    historical_analog_report: "Historical Analysis",
    volatility_report: "Volatility Analysis",
    liquidity_report: "Liquidity Analysis",
    pressure_index_report: "Pressure Index",
    federal_reserve_watch: "Federal Reserve",
    ai_sector_outlook: "AI Sector",
    crypto_market_outlook: "Crypto Intelligence",
  };
  return map[contentType] ?? "Market Intelligence";
}

export async function handleRssFeed(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) {
      res.status(503).set("Content-Type", "application/rss+xml").send("<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>FAULTLINE</title></channel></rss>");
      return;
    }

    // Fetch the 50 most recently published items
    const items = await db.select({
      id: organicContent.id,
      contentType: organicContent.contentType,
      slug: organicContent.slug,
      title: organicContent.title,
      metaDescription: organicContent.metaDescription,
      content: organicContent.content,
      regime: organicContent.regime,
      pressureScore: organicContent.pressureScore,
      publishedAt: organicContent.publishedAt,
      createdAt: organicContent.createdAt,
    })
      .from(organicContent)
      .where(eq(organicContent.status, "published"))
      .orderBy(desc(organicContent.publishedAt))
      .limit(50);

    const lastBuildDate = items.length > 0
      ? formatRfc822(items[0].publishedAt ?? items[0].createdAt)
      : formatRfc822(new Date());

    const rssItems = items.map(item => {
      const url = `${SITE_URL}/intelligence/${item.slug}`;
      const category = contentTypeToCategory(item.contentType);
      const description = item.metaDescription
        ? escapeXml(item.metaDescription)
        : escapeXml((item.content ?? "").slice(0, 200).replace(/[#*`]/g, "").trim() + "…");

      // Build a brief content excerpt (first 500 chars, stripped of markdown)
      const excerpt = (item.content ?? "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\n{2,}/g, " ")
        .trim()
        .slice(0, 500);

      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${description}</description>
      <content:encoded><![CDATA[${excerpt}… <a href="${url}">Read the full brief →</a>]]></content:encoded>
      <category>${escapeXml(category)}</category>
      <pubDate>${formatRfc822(item.publishedAt ?? item.createdAt)}</pubDate>
      ${item.regime ? `<faultline:regime>${escapeXml(item.regime)}</faultline:regime>` : ""}
      ${item.pressureScore !== null ? `<faultline:pressureScore>${item.pressureScore}</faultline:pressureScore>` : ""}
    </item>`;
    }).join("\n");

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:faultline="https://getfaultline.live/rss-namespace">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>${FEED_LANGUAGE}</language>
    <copyright>${escapeXml(FEED_COPYRIGHT)}</copyright>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>${FEED_TTL}</ttl>
    <atom:link href="${SITE_URL}/api/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/logo.png</url>
      <title>${escapeXml(FEED_TITLE)}</title>
      <link>${SITE_URL}</link>
    </image>
${rssItems}
  </channel>
</rss>`;

    res
      .set("Content-Type", "application/rss+xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=1800") // 30-minute cache
      .send(feed);
  } catch (err) {
    console.error("[RSS] Feed generation error:", err);
    res.status(500).set("Content-Type", "application/rss+xml").send(
      "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>FAULTLINE — Error</title></channel></rss>"
    );
  }
}
