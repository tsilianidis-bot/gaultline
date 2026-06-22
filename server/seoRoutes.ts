/**
 * SEO Routes — sitemap.xml and robots.txt
 * Registered before the Vite/static catch-all in server/_core/index.ts
 *
 * Key changes vs original:
 * - sitemap.xml is now DYNAMIC: fetches published blog post slugs from DB
 *   and includes /blog/{slug} URLs so individual posts are crawlable
 * - robots.txt: /app/ is Disallowed (auth-gated), all public pages Allowed
 * - SEO landing pages included in sitemap
 */
import type { Express } from "express";
import { getEvergreenPosts } from "./db";

const BASE_URL = "https://getfaultline.live";

// Static public routes (always present)
const STATIC_ROUTES = [
  { path: "/",                              changefreq: "weekly",  priority: "1.0" },
  { path: "/blog",                          changefreq: "daily",   priority: "0.9" },
  { path: "/analysis",                       changefreq: "weekly",  priority: "0.9" },
  { path: "/intelligence",                   changefreq: "daily",   priority: "0.7" },
  { path: "/intel-archive",                  changefreq: "daily",   priority: "0.7" },
  { path: "/track-record",                  changefreq: "weekly",  priority: "0.9" },
  { path: "/pressure-index",                changefreq: "daily",   priority: "0.8" },
  { path: "/signals",                       changefreq: "daily",   priority: "0.8" },
  { path: "/crypto-signals",                changefreq: "daily",   priority: "0.8" },
  { path: "/stock-market-risk-dashboard",   changefreq: "daily",   priority: "0.8" },
  { path: "/crypto-market-risk-dashboard",  changefreq: "daily",   priority: "0.8" },
  { path: "/situation-room",                changefreq: "weekly",  priority: "0.7" },
  { path: "/analogs",                       changefreq: "weekly",  priority: "0.7" },
  { path: "/ai-bubble-risk-tracker",        changefreq: "daily",   priority: "0.7" },
  { path: "/diagnostic-ai",                 changefreq: "daily",   priority: "0.7" },
  { path: "/methodology",                   changefreq: "monthly", priority: "0.5" },
  { path: "/contact",                       changefreq: "yearly",  priority: "0.3" },
  { path: "/legal",                         changefreq: "yearly",  priority: "0.2" },
];

function buildUrl(path: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export function registerSEORoutes(app: Express): void {
  // ── robots.txt ──────────────────────────────────────────────
  // Served dynamically so it always matches the live server config.
  // The static client/public/robots.txt is a fallback only.
  app.get("/robots.txt", (_req, res) => {
    const content = [
      "User-agent: *",
      "# ── Public pages ──────────────────────────────────────",
      "Allow: /$",
      "Allow: /blog",
      "Allow: /blog/",
      "Allow: /track-record",
      "Allow: /pressure-index",
      "Allow: /legal",
      "Allow: /contact",
      "Allow: /methodology",
      "# ── Public SEO landing pages ───────────────────────────",
      "Allow: /signals",
      "Allow: /crypto-signals",
      "Allow: /situation-room",
      "Allow: /analogs",
      "Allow: /stock-market-risk-dashboard",
      "Allow: /crypto-market-risk-dashboard",
      "Allow: /ai-bubble-risk-tracker",
      "Allow: /diagnostic-ai",
      "# ── Auth-gated app pages — no crawl value ──────────────",
      "Disallow: /app/",
      "Disallow: /api/",
      "Disallow: /mobile/",
      "Disallow: /checkout/",
      "Disallow: /owner/",
      "",
      `Sitemap: ${BASE_URL}/sitemap.xml`,
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.send(content);
  });

  // ── sitemap.xml — DYNAMIC ────────────────────────────────────
  // Includes all static public routes PLUS every published blog post.
  // This ensures Googlebot discovers /blog/{slug} URLs directly from
  // the sitemap rather than relying on JavaScript rendering.
  app.get("/sitemap.xml", async (_req, res) => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Build static URL entries
    const staticEntries = STATIC_ROUTES.map(({ path, changefreq, priority }) =>
      buildUrl(path, today, changefreq, priority)
    );

    // Fetch ONLY evergreen posts for sitemap — intel_record posts are noindex,follow
    // and excluded from the sitemap to prevent crawl budget dilution.
    let blogEntries: string[] = [];
    try {
      const posts = await getEvergreenPosts(20);
      blogEntries = posts.map((post) => {
        const lastmod = post.publishedAt
          ? new Date(post.publishedAt).toISOString().split("T")[0]
          : today;
        return buildUrl(`/blog/${post.slug}`, lastmod, "monthly", "0.8");
      });
    } catch (err) {
      // Non-fatal: sitemap still works without blog posts
      console.error("[SEO] Failed to fetch evergreen posts for sitemap:", err);
    }

    const allEntries = [...staticEntries, ...blogEntries].join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allEntries}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // Cache for 1 hour — short enough to pick up new posts same day
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  });
}
