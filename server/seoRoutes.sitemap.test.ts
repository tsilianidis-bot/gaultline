import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the database and the Soro feed (no network, no DB).
const evergreenPosts = [
  { slug: "fixture-evergreen", publishedAt: new Date("2026-08-01T13:30:00Z"), contentClass: "evergreen" },
];
const dailyBriefRows = [
  { slug: "daily-brief-fixture-2026-09-29", publishedAt: new Date("2026-09-29T11:05:00Z") },
];
let lastBriefWhere: unknown = null;

vi.mock("./db", () => ({
  getEvergreenPosts: vi.fn(async () => evergreenPosts),
  getDb: vi.fn(async () => {
    const chain: any = {
      select: () => chain,
      from: () => chain,
      where: (w: unknown) => { lastBriefWhere = w; return chain; },
      orderBy: () => chain,
      limit: async () => dailyBriefRows,
    };
    return chain;
  }),
}));

vi.mock("./soroBlogFeed", () => ({
  getSoroArticles: vi.fn(async () => [
    { id: "1", slug: "how-to-measure-market-liquidity", title: "t", excerpt: "e", isoDate: "2026-08-27T09:36:31.124+00:00" },
  ]),
}));

import { registerSEORoutes } from "./seoRoutes";
import { getEvergreenPosts } from "./db";

async function fetchSitemap(): Promise<string> {
  const handlers: Record<string, (req: unknown, res: unknown) => unknown> = {};
  registerSEORoutes({ get: (path: string, h: any) => { handlers[path] = h; } } as any);
  let body = "";
  const res = { setHeader: () => res, send: (b: string) => { body = b; return res; } };
  await handlers["/sitemap.xml"]({}, res);
  return body;
}

describe("sitemap consistency with server-rendered article pages", () => {
  beforeEach(() => { lastBriefWhere = null; });

  it("lists evergreen posts, published Daily Briefs and Soro articles with their canonical URLs", async () => {
    const xml = await fetchSitemap();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toContain("https://getfaultline.live/blog");
    expect(locs).toContain("https://getfaultline.live/daily-brief");
    expect(locs).toContain("https://getfaultline.live/blog/fixture-evergreen");
    expect(locs).toContain("https://getfaultline.live/daily-brief/daily-brief-fixture-2026-09-29");
    expect(locs).toContain("https://getfaultline.live/blog?post=how-to-measure-market-liquidity");
    expect(xml).toContain("<lastmod>2026-09-29</lastmod>");
    expect(new Set(locs).size).toBe(locs.length);
    // intel_record posts are noindex,follow and must stay out of the sitemap:
    expect(getEvergreenPosts).toHaveBeenCalled();
    expect(lastBriefWhere).not.toBeNull();
  });
});
