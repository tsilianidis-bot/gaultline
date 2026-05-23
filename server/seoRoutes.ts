/**
 * SEO Routes — sitemap.xml and robots.txt
 * Registered before the Vite/static catch-all in server/_core/index.ts
 */
import type { Express } from "express";

const BASE_URL = "https://getfaultline.live";

// Public routes included in the sitemap (premium/auth-gated pages excluded)
const PUBLIC_ROUTES = [
  { path: "/",               changefreq: "daily",   priority: "1.0" },
  { path: "/pressure",       changefreq: "hourly",  priority: "0.9" },
  { path: "/scores",         changefreq: "daily",   priority: "0.8" },
  { path: "/charts",         changefreq: "daily",   priority: "0.8" },
  { path: "/ai-watch",       changefreq: "daily",   priority: "0.8" },
  { path: "/scenarios",      changefreq: "weekly",  priority: "0.7" },
  { path: "/analogs",        changefreq: "weekly",  priority: "0.7" },
  { path: "/report",         changefreq: "daily",   priority: "0.8" },
  { path: "/guide",          changefreq: "monthly", priority: "0.6" },
];

// Premium/gated routes — excluded from sitemap, disallowed in robots.txt
const GATED_PATHS = [
  "/signals",
  "/aftershock",
  "/portfolio",
  "/crypto",
  "/crypto-search",
  "/crypto-watchlist",
  "/crypto-signals",
  "/alerts",
  "/watchlist",
  "/admin",
  "/account",
  "/diagnostic",
  "/simulate",
];

export function registerSEORoutes(app: Express): void {
  // ── robots.txt ──────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    const disallowLines = GATED_PATHS.map((p) => `Disallow: ${p}`).join("\n");
    const content = [
      "User-agent: *",
      "Allow: /",
      disallowLines,
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
      ({ path, changefreq, priority }) => `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    ).join("");

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
