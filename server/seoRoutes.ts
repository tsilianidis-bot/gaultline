/**
 * SEO Routes — sitemap.xml and robots.txt
 * Registered before the Vite/static catch-all in server/_core/index.ts
 */
import type { Express } from "express";

const BASE_URL = "https://getfaultline.live";

// All publicly indexable pages on getfaultline.live
const PUBLIC_ROUTES = [
  { path: "/",                changefreq: "weekly",  priority: "1.0" },
  { path: "/blog",            changefreq: "daily",   priority: "0.9" },
  { path: "/track-record",    changefreq: "weekly",  priority: "0.9" },
  { path: "/pressure-index",  changefreq: "daily",   priority: "0.8" },
  { path: "/legal",           changefreq: "yearly",  priority: "0.2" },
  { path: "/contact",          changefreq: "yearly",  priority: "0.3" },
];

export function registerSEORoutes(app: Express): void {
  // ── robots.txt ──────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    const content = [
      "User-agent: *",
      "Allow: /",
      "Allow: /blog",
      "Allow: /track-record",
      "Allow: /pressure-index",
      "Allow: /legal",
      "Allow: /contact",
      "",
      "# Block app-internal routes from indexing",
      "Disallow: /app/",
      "Disallow: /api/",
      "",
      `Sitemap: ${BASE_URL}/sitemap.xml`,
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.send(content);
  });

  // ── sitemap.xml ─────────────────────────────────────────────
  app.get("/sitemap.xml", (_req, res) => {
    const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const urlEntries = PUBLIC_ROUTES.map(
      ({ path, changefreq, priority }) => `  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // 1h
    res.send(xml);
  });
}
