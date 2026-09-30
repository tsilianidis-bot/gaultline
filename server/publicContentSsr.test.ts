import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  blogRobots,
  contentToBlocks,
  isPublicBlogPost,
  isPublicDailyBrief,
  matchPublicContentRoute,
  renderPublicContentPage,
  renderSpaPage,
  summarizeBriefSnapshot,
  type Lookup,
  type PublicBlogPost,
  type PublicContentLoaders,
  type PublicDailyBrief,
} from "./publicContentSsr";
import { SORO_BLOG_EMBED_SRC, extractSoroArticlesLiteral, parseSoroEmbedArticles, type SoroArticle } from "./soroBlogFeed";

const root = process.cwd();
const template = readFileSync(resolve(root, "client/index.html"), "utf8");
const HOMEPAGE_H1 = "See the fault before the break.";
const NOW = new Date("2026-09-30T12:00:00.000Z");

// ── In-memory fixtures (test data only; not production records) ────────────
function blogPost(overrides: Partial<PublicBlogPost> = {}): PublicBlogPost {
  return {
    slug: "fixture-liquidity-evergreen",
    title: "Fixture: Reading Funding Stress",
    subtitle: "Fixture subtitle about SOFR and repo spreads.",
    content: "## Why funding matters\n\nFixture paragraph one about **repo** markets.\n\n- First point\n- Second point\n\nFixture paragraph two.",
    author: "FAULTLINE",
    category: "Macro Intelligence",
    tags: "liquidity,funding",
    published: 1,
    publishedAt: new Date("2026-08-01T13:30:00.000Z"),
    contentClass: "evergreen",
    metaTitle: "Fixture Funding Stress Guide",
    metaDescription: "Fixture meta description for the funding stress article.",
    createdAt: new Date("2026-07-30T10:00:00.000Z"),
    updatedAt: new Date("2026-08-02T09:00:00.000Z"),
    ...overrides,
  };
}

function dailyBrief(overrides: Partial<PublicDailyBrief> = {}): PublicDailyBrief {
  return {
    slug: "daily-brief-fixture-2026-09-29",
    contentType: "daily_market_brief",
    title: "Fixture Daily Brief: Credit Pressure Builds",
    metaDescription: "Fixture brief description with credit and funding context.",
    content: "<h2>Executive Summary</h2><p>Fixture brief body &amp; context.</p><ul><li>Fixture bullet</li></ul>",
    internalLinksJson: JSON.stringify([{ text: "Pressure Index", url: "/pressure-index" }, { text: "Evil", url: "javascript:alert(1)" }]),
    status: "published",
    pressureScore: 57,
    regime: "ELEVATED",
    wordCount: 1200,
    publishedAt: new Date("2026-09-29T11:05:00.000Z"),
    createdAt: new Date("2026-09-29T11:00:00.000Z"),
    updatedAt: new Date("2026-09-29T11:06:00.000Z"),
    briefSnapshot: summarizeBriefSnapshot({
      snapshotId: "snap1234abcd5678",
      generatedAt: new Date("2026-09-29T10:58:00.000Z"),
      tradingDate: "2026-09-28",
      originatingStateId: null,
      inputFreshnessJson: JSON.stringify([
        { key: "hy_oas", source: "FRED", asOf: Date.parse("2026-09-26T00:00:00Z"), freshness: "fresh" },
        { key: "sofr", source: "FRED", asOf: Date.parse("2026-09-20T00:00:00Z"), freshness: "stale" },
      ]),
      validationJson: JSON.stringify({ errors: [] }),
    }),
    ...overrides,
  };
}

const soroArticle: SoroArticle = {
  id: "f40e622f-ffa6-4dfc-a00c-04a11008cc7e",
  slug: "how-to-measure-market-liquidity",
  title: "How to Measure Market Liquidity Before It Vanishes",
  excerpt: "Learn how to measure market liquidity using spreads, depth, turnover, funding, and stress signals.",
  isoDate: "2026-08-27T09:36:31.124+00:00",
  image: "https://example.supabase.co/storage/v1/object/public/featured-images/fixture.webp",
};

function loaders(opts: {
  blog?: Record<string, PublicBlogPost>;
  briefs?: Record<string, PublicDailyBrief>;
  soro?: SoroArticle[] | null;
  blogStatus?: Lookup<PublicBlogPost>["status"];
  briefStatus?: Lookup<PublicDailyBrief>["status"];
} = {}): PublicContentLoaders {
  return {
    async loadBlogPost(slug) {
      if (opts.blogStatus === "error" || opts.blogStatus === "db_unconfigured") return { status: opts.blogStatus };
      const record = opts.blog?.[slug];
      return record ? { status: "found", record } : { status: "not_found" };
    },
    async loadDailyBrief(slug) {
      if (opts.briefStatus === "error" || opts.briefStatus === "db_unconfigured") return { status: opts.briefStatus };
      const record = opts.briefs?.[slug];
      return record ? { status: "found", record } : { status: "not_found" };
    },
    async loadSoroArticles() {
      return opts.soro === undefined ? [soroArticle] : opts.soro;
    },
    now: () => NOW,
  };
}

// ── Head parsing helpers ────────────────────────────────────────────────────
function head(html: string) {
  const h = html.split("</head>")[0];
  const attr = (re: RegExp) => h.match(re)?.[1];
  return {
    title: attr(/<title>([^<]*)<\/title>/),
    description: attr(/<meta name="description" content="([^"]*)"/),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/),
    robots: [...h.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]),
    ogTitle: attr(/<meta property="og:title" content="([^"]*)"/),
    ogDescription: attr(/<meta property="og:description" content="([^"]*)"/),
    ogUrl: attr(/<meta property="og:url" content="([^"]*)"/),
    ogType: attr(/<meta property="og:type" content="([^"]*)"/),
    ogImage: attr(/<meta property="og:image" content="([^"]*)"/),
    twitterTitle: attr(/<meta name="twitter:title" content="([^"]*)"/),
    twitterDescription: attr(/<meta name="twitter:description" content="([^"]*)"/),
    publishedTime: attr(/<meta property="article:published_time" content="([^"]*)"/),
  };
}

function jsonLdBlocks(html: string): Array<Record<string, unknown>> {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

function bodyFallback(html: string): string {
  const body = html.slice(html.search(/<body[\s>]/));
  return body.slice(0, body.indexOf('<div id="root"'));
}

async function render(url: string, l: PublicContentLoaders) {
  const page = await renderPublicContentPage(template, url, l);
  if (!page) throw new Error(`expected ${url} to be handled`);
  return page;
}

describe("route matching", () => {
  it("matches article, brief and Soro deep-link URLs and keeps original slugs", () => {
    expect(matchPublicContentRoute("/blog/my-post")).toEqual({ kind: "blog", slug: "my-post" });
    expect(matchPublicContentRoute("/blog/my-post/?utm_source=x")).toEqual({ kind: "blog", slug: "my-post" });
    expect(matchPublicContentRoute("/daily-brief/daily-brief-2026-09-29")).toEqual({ kind: "daily-brief", slug: "daily-brief-2026-09-29" });
    expect(matchPublicContentRoute("/daily-brief/Legacy_Slug%20X")).toEqual({ kind: "daily-brief", slug: "Legacy_Slug X" });
    expect(matchPublicContentRoute("/blog?post=how-to-measure-market-liquidity")).toEqual({ kind: "soro", slug: "how-to-measure-market-liquidity" });
    expect(matchPublicContentRoute("/blog/%E0%A4%A")).toMatchObject({ kind: "invalid", section: "blog" });
  });

  it("does not claim non-article routes", () => {
    for (const url of ["/", "/blog", "/daily-brief", "/pricing", "/blog/a/b", "/app/blog/x", "/intelligence-library/x"]) {
      expect(matchPublicContentRoute(url)).toBeNull();
    }
  });
});

describe("publication gates mirror the public tRPC safeguards", () => {
  it("only published blog posts whose publishedAt is not in the future are public", () => {
    expect(isPublicBlogPost({ published: 1, publishedAt: new Date("2026-09-01") }, NOW)).toBe(true);
    expect(isPublicBlogPost({ published: 1, publishedAt: null }, NOW)).toBe(true);
    expect(isPublicBlogPost({ published: 0, publishedAt: new Date("2026-09-01") }, NOW)).toBe(false);
    expect(isPublicBlogPost({ published: 0, publishedAt: new Date("2026-12-01") }, NOW)).toBe(false);
    expect(isPublicBlogPost({ published: 1, publishedAt: new Date("2026-12-01") }, NOW)).toBe(false);
  });

  it("only status=published briefs whose publishedAt is not in the future are public", () => {
    expect(isPublicDailyBrief({ status: "published", publishedAt: new Date("2026-09-29") }, NOW)).toBe(true);
    expect(isPublicDailyBrief({ status: "draft", publishedAt: null }, NOW)).toBe(false);
    expect(isPublicDailyBrief({ status: "rejected", publishedAt: new Date("2026-09-29") }, NOW)).toBe(false);
    expect(isPublicDailyBrief({ status: "published", publishedAt: new Date("2026-10-30") }, NOW)).toBe(false);
  });

  it("keeps BlogPost.tsx indexing distinctions per content class", () => {
    expect(blogRobots("evergreen")).toMatch(/^index, follow/);
    expect(blogRobots("intel_record")).toBe("noindex, follow");
    expect(blogRobots("test")).toBe("noindex, nofollow");
  });
});

describe("published blog post (/blog/:slug)", () => {
  it("serves its own title, description, canonical, OG/Twitter, JSON-LD and body", async () => {
    const post = blogPost();
    const page = await render(`/blog/${post.slug}`, loaders({ blog: { [post.slug]: post } }));
    expect(page.status).toBe(200);
    const h = head(page.html);
    expect(h.title).toBe("Fixture Funding Stress Guide | FAULTLINE");
    expect(h.description).toBe("Fixture meta description for the funding stress article.");
    expect(h.canonical).toBe(`https://getfaultline.live/blog/${post.slug}`);
    expect(h.ogUrl).toBe(h.canonical);
    expect(h.ogTitle).toBe(h.title);
    expect(h.ogDescription).toBe(h.description);
    expect(h.twitterTitle).toBe(h.title);
    expect(h.twitterDescription).toBe(h.description);
    expect(h.ogType).toBe("article");
    expect(h.robots).toEqual(["index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"]);
    expect(h.publishedTime).toBe("2026-08-01T13:30:00.000Z");

    const ld = jsonLdBlocks(page.html);
    const types = ld.map((b) => b["@type"]);
    expect(types).not.toContain("FAQPage");
    expect(types).not.toContain("SoftwareApplication");
    const article = ld.find((b) => b["@type"] === "Article")!;
    expect(article).toMatchObject({
      "@context": "https://schema.org",
      headline: post.title,
      url: `https://getfaultline.live/blog/${post.slug}`,
      datePublished: "2026-08-01T13:30:00.000Z",
      dateModified: "2026-08-02T09:00:00.000Z",
      articleSection: "Macro Intelligence",
    });
    expect(page.html).toContain('id="blog-post-ld"');

    const body = bodyFallback(page.html);
    expect(body).not.toContain(HOMEPAGE_H1);
    expect(body).toContain("<h1>Fixture: Reading Funding Stress</h1>");
    expect(body).toContain("<h2>Why funding matters</h2>");
    expect(body).toContain("Fixture paragraph one about repo markets.");
    expect(body).toContain("<li>Second point</li>");
    expect(body).toContain('<time datetime="2026-08-01T13:30:00.000Z">August 1, 2026</time>');
  });

  it("marks intel records noindex,follow and test posts noindex,nofollow with BlogPosting JSON-LD", async () => {
    const intel = blogPost({ slug: "fixture-intel", contentClass: "intel_record", metaTitle: null, metaDescription: null });
    const test = blogPost({ slug: "fixture-test", contentClass: "test" });
    const l = loaders({ blog: { [intel.slug]: intel, [test.slug]: test } });
    const intelPage = await render("/blog/fixture-intel", l);
    expect(intelPage.status).toBe(200);
    expect(head(intelPage.html).robots).toEqual(["noindex, follow"]);
    expect(head(intelPage.html).title).toBe("Fixture: Reading Funding Stress | FAULTLINE");
    expect(head(intelPage.html).description).toBe("Fixture subtitle about SOFR and repo spreads.");
    expect(jsonLdBlocks(intelPage.html).some((b) => b["@type"] === "BlogPosting")).toBe(true);
    const testPage = await render("/blog/fixture-test", l);
    expect(head(testPage.html).robots).toEqual(["noindex, nofollow"]);
  });

  it("escapes record text in attributes, body and JSON-LD", async () => {
    const hostile = blogPost({
      slug: "fixture-hostile",
      title: `Quotes "and" </script><script>alert(1)</script> $& $1`,
      metaTitle: null,
      metaDescription: `Desc with "quotes" & <b>tags</b> $'`,
      content: "<script>alert('x')</script><p>Safe text</p>",
    });
    const page = await render("/blog/fixture-hostile", loaders({ blog: { [hostile.slug]: hostile } }));
    expect(page.html).not.toContain("<script>alert");
    expect(page.html).not.toContain("alert('x')");
    const h = head(page.html);
    expect(h.title).toBe("Quotes &quot;and&quot; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; $&amp; $1 | FAULTLINE");
    expect(h.description).toBe("Desc with &quot;quotes&quot; &amp; &lt;b&gt;tags&lt;/b&gt; $'");
    const article = jsonLdBlocks(page.html).find((b) => b["@type"] === "Article")!;
    expect(article.headline).toBe(hostile.title);
    expect(bodyFallback(page.html)).toContain("<p>Safe text</p>");
  });
});

describe("unpublished and missing records never leak", () => {
  const SECRET = "UNPUBLISHED-SECRET-CONTENT";
  const draft = blogPost({ slug: "fixture-draft", published: 0, publishedAt: null, title: `Draft ${SECRET}`, content: SECRET, metaTitle: SECRET });
  const scheduled = blogPost({ slug: "fixture-scheduled", published: 0, publishedAt: new Date("2026-10-15T08:00:00Z"), title: `Scheduled ${SECRET}`, content: SECRET, metaTitle: SECRET });
  const futurePublished = blogPost({ slug: "fixture-future", published: 1, publishedAt: new Date("2026-10-15T08:00:00Z"), title: `Future ${SECRET}`, content: SECRET, metaTitle: SECRET });
  const draftBrief = dailyBrief({ slug: "brief-draft", status: "draft", title: `Brief ${SECRET}`, content: SECRET, metaDescription: SECRET });
  const rejectedBrief = dailyBrief({ slug: "brief-rejected", status: "rejected", title: `Brief ${SECRET}`, content: SECRET, metaDescription: SECRET });
  // Deliberately leaky loaders: the renderer must still refuse unpublished rows.
  const l = loaders({
    blog: { [draft.slug]: draft, [scheduled.slug]: scheduled, [futurePublished.slug]: futurePublished },
    briefs: { [draftBrief.slug]: draftBrief, [rejectedBrief.slug]: rejectedBrief },
  });

  for (const url of ["/blog/fixture-draft", "/blog/fixture-scheduled", "/blog/fixture-future", "/daily-brief/brief-draft", "/daily-brief/brief-rejected"]) {
    it(`${url} → 404 noindex without any record content`, async () => {
      const page = await render(url, l);
      expect(page.status).toBe(404);
      expect(page.headers["X-Robots-Tag"]).toBe("noindex");
      expect(page.html).not.toContain(SECRET);
      expect(head(page.html).robots).toEqual(["noindex, follow"]);
      expect(head(page.html).canonical).toBeUndefined();
    });
  }

  it("a missing slug returns a proper 404 with noindex, not the homepage", async () => {
    for (const url of ["/blog/does-not-exist", "/daily-brief/does-not-exist", "/blog/%E0%A4%A"]) {
      const page = await render(url, l);
      expect(page.status).toBe(404);
      const h = head(page.html);
      expect(h.robots).toEqual(["noindex, follow"]);
      expect(h.title).toMatch(/not found \| FAULTLINE$/);
      expect(h.title).not.toBe("FAULTLINE | Systemic Risk Intelligence for Financial Markets");
      expect(bodyFallback(page.html)).not.toContain(HOMEPAGE_H1);
      const types = jsonLdBlocks(page.html).map((b) => b["@type"]);
      expect(types).not.toContain("FAQPage");
      expect(types).not.toContain("Article");
    }
  });

  it("a database failure returns 503 + Retry-After (never a generic indexable shell)", async () => {
    const page = await render("/blog/any", loaders({ blogStatus: "error" }));
    expect(page.status).toBe(503);
    expect(page.headers["Retry-After"]).toBe("120");
    const brief = await render("/daily-brief/any", loaders({ briefStatus: "error" }));
    expect(brief.status).toBe(503);
  });

  it("with no database configured the legacy generic 200 behaviour is kept", async () => {
    expect(await renderPublicContentPage(template, "/blog/any", loaders({ blogStatus: "db_unconfigured" }))).toBeNull();
    const spa = await renderSpaPage(template, "/blog/any", loaders({ blogStatus: "db_unconfigured" }));
    expect(spa.status).toBe(200);
  });
});

describe("published Daily Brief (/daily-brief/:slug)", () => {
  it("serves its own metadata, Article JSON-LD and the evidence/freshness context", async () => {
    const brief = dailyBrief();
    const page = await render(`/daily-brief/${brief.slug}`, loaders({ briefs: { [brief.slug]: brief } }));
    expect(page.status).toBe(200);
    const h = head(page.html);
    expect(h.title).toBe("Fixture Daily Brief: Credit Pressure Builds | FAULTLINE Daily Brief");
    expect(h.description).toBe(brief.metaDescription);
    expect(h.canonical).toBe(`https://getfaultline.live/daily-brief/${brief.slug}`);
    expect(h.ogUrl).toBe(h.canonical);
    expect(h.ogType).toBe("article");
    expect(h.robots).toEqual(["index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"]);

    const article = jsonLdBlocks(page.html).find((b) => b["@type"] === "Article")!;
    expect(article).toMatchObject({
      headline: brief.title,
      description: brief.metaDescription,
      url: `https://getfaultline.live/daily-brief/${brief.slug}`,
      datePublished: "2026-09-29T11:05:00.000Z",
    });
    expect(JSON.stringify(article)).not.toContain("/intelligence/");

    const body = bodyFallback(page.html);
    expect(body).not.toContain(HOMEPAGE_H1);
    expect(body).toContain("<h1>Fixture Daily Brief: Credit Pressure Builds</h1>");
    expect(body).toContain("STALE SNAPSHOT");
    expect(body).toContain("Reading used for this brief:");
    expect(body).toContain("Snapshot snap1234 · This article reflects its saved FAULTLINE intelligence snapshot.");
    expect(body).toContain("<td>sofr</td><td>FRED</td>");
    expect(body).toContain("<td>stale</td>");
    expect(body).toContain("Pressure Index 57 / 100");
    expect(body).toContain("Fixture brief body &amp; context.");
    expect(body).toContain('href="https://getfaultline.live/pressure-index"');
    expect(body).not.toContain("javascript:");
  });

  it("labels legacy briefs without a snapshot as archived metadata", async () => {
    const legacy = dailyBrief({ slug: "legacy-brief", briefSnapshot: null });
    const page = await render("/daily-brief/legacy-brief", loaders({ briefs: { "legacy-brief": legacy } }));
    const body = bodyFallback(page.html);
    expect(body).toContain("Archived brief: this article predates FAULTLINE’s snapshot-binding controls.");
    expect(body).toContain("Archived metadata · PI 57 / 100");
  });
});

describe("Soro blog article (/blog?post=:slug)", () => {
  it("serves the Soro article's own metadata with its self-referencing canonical", async () => {
    const page = await render(`/blog?post=${soroArticle.slug}`, loaders());
    expect(page.status).toBe(200);
    const h = head(page.html);
    expect(h.title).toBe("How to Measure Market Liquidity Before It Vanishes | FAULTLINE");
    expect(h.description).toBe(soroArticle.excerpt);
    expect(h.canonical).toBe(`https://getfaultline.live/blog?post=${soroArticle.slug}`);
    expect(h.ogUrl).toBe(h.canonical);
    expect(h.ogImage).toBe(soroArticle.image);
    const posting = jsonLdBlocks(page.html).find((b) => b["@type"] === "BlogPosting")!;
    expect(posting).toMatchObject({ headline: soroArticle.title, datePublished: soroArticle.isoDate, url: h.canonical, image: soroArticle.image });
    expect(page.html).toContain('id="soro-blog-jsonld"');
    expect(bodyFallback(page.html)).toContain(`<h1>${soroArticle.title}</h1>`);
  });

  it("unknown or unreadable Soro posts fall back to the normal /blog page", async () => {
    expect(await renderPublicContentPage(template, "/blog?post=unknown-post", loaders())).toBeNull();
    expect(await renderPublicContentPage(template, `/blog?post=${soroArticle.slug}`, loaders({ soro: null }))).toBeNull();
  });

  it("the server reads the same embed the client mounts", () => {
    const blogPage = readFileSync(resolve(root, "client/src/pages/Blog.tsx"), "utf8");
    expect(blogPage).toContain(`const SORO_BLOG_EMBED_SRC = "${SORO_BLOG_EMBED_SRC}"`);
    expect(blogPage).toContain('<div id="soro-blog" />');
  });

  it("parses the loader's article list strictly and drops invalid, future or unsafe entries", () => {
    const list = [
      { ...soroArticle, content: null, date: "August 27, 2026", title: "Brackets ] and \"quotes\" [ inside" },
      { ...soroArticle, id: "2", slug: "Bad Slug!" },
      { ...soroArticle, id: "3", slug: "future-post", isoDate: "2027-01-01T00:00:00Z" },
      { ...soroArticle, id: "4", slug: "http-image", image: "http://insecure.example/x.png" },
    ];
    const source = `(function(){\n  var SORO_BLOG_TITLE = 'x';\n  var SORO_ARTICLES = ${JSON.stringify(list)};\n  var SORO_TOKEN = 't';\n})();`;
    expect(JSON.parse(extractSoroArticlesLiteral(source)!)).toHaveLength(4);
    const parsed = parseSoroEmbedArticles(source, NOW)!;
    expect(parsed.map((a) => a.slug)).toEqual([soroArticle.slug, "http-image"]);
    expect(parsed[0].title).toBe('Brackets ] and "quotes" [ inside');
    expect(parsed[1].image).toBeUndefined();
    expect(parseSoroEmbedArticles("var nothing = 1;")).toBeNull();
  });
});

describe("JSON-LD validity across rendered routes", () => {
  it("every ld+json block parses, carries a schema.org context, and there is exactly one article entity", async () => {
    const post = blogPost();
    const brief = dailyBrief();
    const l = loaders({ blog: { [post.slug]: post }, briefs: { [brief.slug]: brief } });
    for (const url of [`/blog/${post.slug}`, `/daily-brief/${brief.slug}`, `/blog?post=${soroArticle.slug}`]) {
      const page = await render(url, l);
      const blocks = jsonLdBlocks(page.html);
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) expect(b["@context"]).toBe("https://schema.org");
      const articles = blocks.filter((b) => ["Article", "NewsArticle", "BlogPosting"].includes(String(b["@type"])));
      expect(articles).toHaveLength(1);
      const a = articles[0];
      expect(typeof a.headline).toBe("string");
      expect(Number.isNaN(Date.parse(String(a.datePublished)))).toBe(false);
      expect(String(a.url)).toBe(head(page.html).canonical);
      // Organization and WebSite stay; the homepage FAQ/SoftwareApplication are removed.
      expect(blocks.map((b) => b["@type"])).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
    }
  });
});

describe("content conversion", () => {
  it("turns Markdown and HTML into text-only blocks", () => {
    expect(contentToBlocks("# Title\n\nSome [link](https://x.y) and `code`.\n\n1. one\n2. two")).toEqual([
      { tag: "h2", text: "Title" },
      { tag: "p", text: "Some link and code." },
      { tag: "ul", items: ["one", "two"] },
    ]);
    expect(contentToBlocks("<h3>Sub</h3><p>A &amp; B<br>C</p><style>x{}</style>")).toEqual([
      { tag: "h3", text: "Sub" },
      { tag: "p", text: "A & B C" },
    ]);
  });
});

describe("non-article routes keep existing behaviour", () => {
  it("delegates to the generic per-page metadata", async () => {
    const page = await renderSpaPage(template, "/pricing", loaders());
    expect(page.status).toBe(200);
    expect(head(page.html).title).toBe("FAULTLINE Pricing — Free, Trader, Power &amp; Founding Member Plans");
    expect(jsonLdBlocks(page.html).map((b) => b["@type"])).toContain("FAQPage");
  });
});
