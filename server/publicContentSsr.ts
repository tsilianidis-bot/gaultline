/**
 * publicContentSsr.ts — server-rendered metadata and crawlable content for
 * published articles and Daily Briefs.
 *
 * Routes handled (everything else falls through to seoMeta.injectPageMetaAsync):
 *   /blog/:slug          blogPosts row, only when published = 1
 *   /daily-brief/:slug   organicContent row, only when status = "published"
 *   /blog?post=:slug     Soro embed article (public, published feed only)
 *
 * For a published record the SPA shell is returned with the record's own title,
 * description, canonical, Open Graph/Twitter tags, JSON-LD and a crawlable
 * <noscript> body (replacing the generic homepage fallback text).
 *
 * Publishing safeguards:
 *   - Queries filter on the published flag/status, and the renderer re-checks it
 *     (defense in depth). Drafts, rejected rows and scheduled rows (published = 0
 *     with a future publishedAt) are never rendered and return 404 + noindex,
 *     exactly like the public tRPC getBySlug procedures, which also return
 *     NOT_FOUND/null for them.
 *   - A published row whose publishedAt is still in the future is also treated as
 *     not yet public (404).
 *   - Blog indexing distinctions mirror client/src/pages/BlogPost.tsx:
 *     evergreen = index, intel_record = noindex,follow, test = noindex,nofollow.
 *   - A slug that does not exist returns 404 + noindex instead of the homepage.
 *   - If the database query fails, 503 + Retry-After is returned with the generic
 *     shell so a transient outage never gets indexed as generic content.
 */
import { and, eq } from "drizzle-orm";
import { blogPosts, dailyBriefSnapshots, organicContent } from "../drizzle/schema";
import type { BlogPost, OrganicContent } from "../drizzle/schema";
import { getDb } from "./db";
import { injectPageMeta, injectPageMetaAsync, type PageMeta } from "./seoMeta";
import { getSoroArticles, isSoroSlug, type SoroArticle } from "./soroBlogFeed";
import {
  PUBLIC_SITE_URL,
  buildDailyBriefStructuredData,
  dailyBriefCanonicalUrl,
  encodeSlugSegment,
  serializeJsonLd,
  toIsoDate,
} from "../shared/articleStructuredData";

const BASE_URL = PUBLIC_SITE_URL;
const MAX_SLUG_LENGTH = 220;
/** Allowed clock skew when deciding whether publishedAt is in the future. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_BODY_CHARS = 60_000;
const DEFAULT_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
/** Homepage-only structured data that must not describe an article page. */
const HOMEPAGE_ONLY_LD_TYPES = new Set(["SoftwareApplication", "FAQPage"]);

// ── Types ───────────────────────────────────────────────────────────────────

export type Lookup<T> =
  | { status: "found"; record: T }
  | { status: "not_found" }
  /** No DATABASE_URL (local dev/tests): keep the legacy generic behaviour. */
  | { status: "db_unconfigured" }
  /** The query failed: answer 503 so crawlers retry instead of indexing a shell. */
  | { status: "error" };

export interface BriefInputSummary {
  key: string;
  source: string | null;
  asOf: string | null;
  freshness: string | null;
}

export interface BriefSnapshotEvidence {
  snapshotId: string;
  generatedAt: string | null;
  tradingDate: string | null;
  isStale: boolean;
  canonicalOriginStatus: "linked" | "unavailable";
  /** null when the stored freshness payload could not be parsed. */
  inputs: BriefInputSummary[] | null;
}

export type PublicBlogPost = Pick<
  BlogPost,
  "slug" | "title" | "subtitle" | "content" | "author" | "category" | "tags" | "published" | "publishedAt"
  | "contentClass" | "metaTitle" | "metaDescription" | "createdAt" | "updatedAt"
>;

export type PublicDailyBrief = Pick<
  OrganicContent,
  "slug" | "contentType" | "title" | "metaDescription" | "content" | "internalLinksJson" | "status"
  | "pressureScore" | "regime" | "wordCount" | "publishedAt" | "createdAt" | "updatedAt"
> & { briefSnapshot: BriefSnapshotEvidence | null };

export interface PublicContentLoaders {
  loadBlogPost(slug: string): Promise<Lookup<PublicBlogPost>>;
  loadDailyBrief(slug: string): Promise<Lookup<PublicDailyBrief>>;
  loadSoroArticles(): Promise<SoroArticle[] | null>;
  now(): Date;
}

export interface RenderedPage {
  html: string;
  status: number;
  headers: Record<string, string>;
}

// ── Publication gates ───────────────────────────────────────────────────────

function isFuture(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t) && t > now.getTime() + FUTURE_SKEW_MS;
}

/** Same rule as blog.getBySlug (published === 1), plus "publishedAt not in the future". */
export function isPublicBlogPost(post: Pick<BlogPost, "published" | "publishedAt">, now: Date): boolean {
  return post.published === 1 && !isFuture(post.publishedAt, now);
}

/** Same rule as organicContent.getBySlug (status === "published"), plus "publishedAt not in the future". */
export function isPublicDailyBrief(item: Pick<OrganicContent, "status" | "publishedAt">, now: Date): boolean {
  return item.status === "published" && !isFuture(item.publishedAt, now);
}

/** Robots directive per blog content class, mirroring client/src/pages/BlogPost.tsx. */
export function blogRobots(contentClass: string | null | undefined): string {
  if (contentClass === "evergreen") return DEFAULT_ROBOTS;
  if (contentClass === "intel_record") return "noindex, follow";
  return "noindex, nofollow";
}

// ── Brief snapshot evidence ─────────────────────────────────────────────────

function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Shape a dailyBriefSnapshots row the same way organicContent.getBySlug does (isStale semantics). */
export function summarizeBriefSnapshot(snapshot: {
  snapshotId: string;
  generatedAt: Date | string | null;
  tradingDate: string | null;
  originatingStateId: string | null;
  inputFreshnessJson: string;
  validationJson: string;
}): BriefSnapshotEvidence {
  const freshnessRaw = safeJsonParse(snapshot.inputFreshnessJson);
  const validationRaw = safeJsonParse(snapshot.validationJson) as { errors?: unknown } | null | undefined;
  const inputs: BriefInputSummary[] | null = Array.isArray(freshnessRaw)
    ? freshnessRaw
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => ({
          key: typeof i.key === "string" ? i.key : "input",
          source: typeof i.source === "string" ? i.source : null,
          asOf: typeof i.asOf === "number" || typeof i.asOf === "string" ? (toIsoDate(i.asOf as number | string) ?? null) : null,
          freshness: typeof i.freshness === "string" ? i.freshness : null,
        }))
    : null;
  const validationErrors = Array.isArray(validationRaw?.errors) ? (validationRaw!.errors as unknown[]) : [];
  const isStale = (inputs ?? []).some((i) => i.freshness === "stale")
    || validationErrors.includes("canonical-snapshot-unexpectedly-stale");
  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: toIsoDate(snapshot.generatedAt) ?? null,
    tradingDate: snapshot.tradingDate ?? null,
    isStale,
    canonicalOriginStatus: snapshot.originatingStateId ? "linked" : "unavailable",
    inputs,
  };
}

// ── Default (database / Soro) loaders ───────────────────────────────────────

export const defaultPublicContentLoaders: PublicContentLoaders = {
  async loadBlogPost(slug) {
    const db = await getDb();
    if (!db) return { status: "db_unconfigured" };
    try {
      const [row] = await db.select().from(blogPosts)
        .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, 1)))
        .limit(1);
      return row ? { status: "found", record: row } : { status: "not_found" };
    } catch {
      return { status: "error" };
    }
  },
  async loadDailyBrief(slug) {
    const db = await getDb();
    if (!db) return { status: "db_unconfigured" };
    try {
      const [item] = await db.select().from(organicContent)
        .where(and(eq(organicContent.slug, slug), eq(organicContent.status, "published")))
        .limit(1);
      if (!item) return { status: "not_found" };
      let briefSnapshot: BriefSnapshotEvidence | null = null;
      if (item.briefSnapshotId) {
        const [snapshot] = await db.select({
          snapshotId: dailyBriefSnapshots.snapshotId,
          generatedAt: dailyBriefSnapshots.generatedAt,
          tradingDate: dailyBriefSnapshots.tradingDate,
          originatingStateId: dailyBriefSnapshots.originatingStateId,
          inputFreshnessJson: dailyBriefSnapshots.inputFreshnessJson,
          validationJson: dailyBriefSnapshots.validationJson,
        }).from(dailyBriefSnapshots)
          .where(eq(dailyBriefSnapshots.snapshotId, item.briefSnapshotId))
          .limit(1);
        if (snapshot) briefSnapshot = summarizeBriefSnapshot(snapshot);
      }
      return { status: "found", record: { ...item, briefSnapshot } };
    } catch {
      return { status: "error" };
    }
  },
  loadSoroArticles: () => getSoroArticles(),
  now: () => new Date(),
};

// ── HTML helpers ────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nonEmpty(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function formatDisplayDate(value: Date | string | null | undefined): string | null {
  const iso = toIsoDate(value);
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York",
  });
}

function timeTag(value: Date | string | null | undefined): string {
  const iso = toIsoDate(value);
  const label = formatDisplayDate(value);
  return iso && label ? `<time datetime="${iso}">${escapeHtml(label)}</time>` : "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d: string) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function safeFromCodePoint(cp: number): string {
  try {
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  } catch {
    return "";
  }
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type ContentBlock = { tag: "h2" | "h3" | "p" } & { text: string } | { tag: "ul"; items: string[] };

/**
 * Convert stored Markdown or HTML article content into plain, escaped-on-render
 * text blocks for the crawlable fallback. No markup from the record is emitted.
 */
export function contentToBlocks(content: string | null | undefined): ContentBlock[] {
  if (!content) return [];
  let text = content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<h[12][^>]*>/gi, "\n\n## ")
    .replace(/<h[3-6][^>]*>/gi, "\n\n### ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|section|article|ul|ol|blockquote|table|thead|tbody|tr|h[1-6]|pre|figure|header|footer)[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  text = decodeEntities(text).replace(/\r\n?/g, "\n");

  const blocks: ContentBlock[] = [];
  let total = 0;
  for (const rawBlock of text.split(/\n\s*\n/)) {
    const lines = rawBlock.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    let listItems: string[] = [];
    let paragraph: string[] = [];
    const flushParagraph = () => {
      const t = stripInlineMarkdown(paragraph.join(" ").replace(/^>\s?/, ""));
      if (t) blocks.push({ tag: "p", text: t });
      paragraph = [];
    };
    const flushList = () => {
      if (listItems.length) blocks.push({ tag: "ul", items: listItems });
      listItems = [];
    };
    for (const line of lines) {
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      const listItem = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (heading) {
        flushParagraph(); flushList();
        const t = stripInlineMarkdown(heading[2].replace(/#+\s*$/, ""));
        if (t) blocks.push({ tag: heading[1].length <= 2 ? "h2" : "h3", text: t });
      } else if (listItem) {
        flushParagraph();
        const t = stripInlineMarkdown(listItem[1]);
        if (t) listItems.push(t);
      } else if (/^[-*_]{3,}$/.test(line) || /^\|?[\s:-]+\|[\s|:-]*$/.test(line)) {
        continue; // horizontal rules and table separators carry no text
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph(); flushList();
    total = blocks.reduce((n, b) => n + ("text" in b ? b.text.length : b.items.join(" ").length), 0);
    if (total >= MAX_BODY_CHARS) break;
  }
  return blocks;
}

function renderBlocks(blocks: ContentBlock[]): string {
  return blocks.map((b) => {
    if (b.tag === "ul") return `<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    return `<${b.tag}>${escapeHtml(b.text)}</${b.tag}>`;
  }).join("\n");
}

/** First ~160 chars of the body as plain text (only used when a record has no description fields). */
function bodyExcerpt(content: string | null | undefined): string | undefined {
  const firstParagraph = contentToBlocks(content).find((b) => b.tag === "p");
  if (!firstParagraph || !("text" in firstParagraph)) return undefined;
  const t = firstParagraph.text;
  return t.length <= 160 ? t : `${t.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

/** Remove homepage-only JSON-LD (SoftwareApplication, FAQPage) from the <head>. */
export function stripHomepageOnlyStructuredData(html: string): string {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g, (block, body: string) => {
    try {
      const parsed = JSON.parse(body) as { "@type"?: unknown };
      return typeof parsed?.["@type"] === "string" && HOMEPAGE_ONLY_LD_TYPES.has(parsed["@type"]) ? "" : block;
    } catch {
      return block;
    }
  });
}

/** Replace the generic homepage <noscript> fallback in <body> with page-specific content. */
export function replaceBodyFallback(html: string, fallbackHtml: string): string {
  const block = `<noscript>${fallbackHtml}</noscript>`;
  const bodyIdx = html.search(/<body[\s>]/i);
  if (bodyIdx !== -1) {
    const open = html.indexOf("<noscript>", bodyIdx);
    const close = open === -1 ? -1 : html.indexOf("</noscript>", open);
    const rootIdx = html.indexOf('<div id="root"', bodyIdx);
    if (open !== -1 && close !== -1 && (rootIdx === -1 || open < rootIdx)) {
      return html.slice(0, open) + block + html.slice(close + "</noscript>".length);
    }
    if (rootIdx !== -1) return html.slice(0, rootIdx) + block + html.slice(rootIdx);
  }
  return html.replace("</body>", () => `${block}</body>`);
}

function insertIntoHead(html: string, fragment: string): string {
  return html.replace("</head>", () => `${fragment}</head>`);
}

function jsonLdScript(data: unknown, id?: string): string {
  return `<script type="application/ld+json"${id ? ` id="${id}"` : ""}>${serializeJsonLd(data)}</script>`;
}

function articleTimeMeta(publishedAt: unknown, modifiedAt: unknown): string {
  const published = toIsoDate(publishedAt as Date | string | null | undefined);
  const modified = toIsoDate(modifiedAt as Date | string | null | undefined);
  return [
    published ? `<meta property="article:published_time" content="${published}" />` : "",
    modified ? `<meta property="article:modified_time" content="${modified}" />` : "",
  ].join("");
}

function renderArticlePage(template: string, opts: {
  path: string;
  meta: PageMeta;
  jsonLd: unknown;
  jsonLdId?: string;
  publishedAt?: unknown;
  modifiedAt?: unknown;
  fallbackHtml: string;
}): string {
  let html = injectPageMeta(template, opts.path, opts.meta);
  html = stripHomepageOnlyStructuredData(html);
  html = insertIntoHead(html, articleTimeMeta(opts.publishedAt, opts.modifiedAt) + jsonLdScript(opts.jsonLd, opts.jsonLdId));
  return replaceBodyFallback(html, opts.fallbackHtml);
}

// ── Page renderers ──────────────────────────────────────────────────────────

/** Mirrors the JSON-LD built client-side in BlogPost.tsx (it replaces #blog-post-ld after hydration). */
export function buildBlogPostStructuredData(post: PublicBlogPost): Record<string, unknown> {
  const isEvergreen = post.contentClass === "evergreen";
  const canonicalUrl = `${BASE_URL}/blog/${encodeSlugSegment(post.slug)}`;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isEvergreen ? "Article" : "BlogPosting",
    "headline": post.title,
    "description": post.subtitle ?? post.title,
    "url": canonicalUrl,
    "author": { "@type": "Organization", "name": "FAULTLINE", "url": BASE_URL },
    "publisher": {
      "@type": "Organization",
      "name": "FAULTLINE",
      "url": BASE_URL,
      "logo": { "@type": "ImageObject", "url": `${BASE_URL}/favicon-32x32.png` },
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
  };
  const datePublished = toIsoDate(post.publishedAt);
  const dateModified = toIsoDate(post.updatedAt);
  if (datePublished) ld.datePublished = datePublished;
  if (dateModified) ld.dateModified = dateModified;
  if (post.category) ld.articleSection = post.category;
  if (post.tags) ld.keywords = post.tags;
  if (isEvergreen) {
    ld.wordCount = post.content.trim().split(/\s+/).length;
    ld.inLanguage = "en-US";
    ld.isPartOf = { "@type": "Blog", "@id": `${BASE_URL}/blog`, "name": "FAULTLINE Analysis", "url": `${BASE_URL}/blog` };
  }
  return ld;
}

export function renderBlogPostPage(template: string, post: PublicBlogPost): string {
  const path = `/blog/${encodeSlugSegment(post.slug)}`;
  const seoTitle = nonEmpty(post.metaTitle) ?? post.title;
  const description = nonEmpty(post.metaDescription) ?? nonEmpty(post.subtitle) ?? bodyExcerpt(post.content) ?? post.title;
  const byline = [
    post.author ? `By ${escapeHtml(post.author)}` : "",
    timeTag(post.publishedAt),
    post.category ? escapeHtml(post.category) : "",
  ].filter(Boolean).join(" · ");
  const fallbackHtml = `<article data-ssr="blog-post">
<p><a href="${BASE_URL}/">FAULTLINE</a> › <a href="${BASE_URL}/blog">Blog</a></p>
<h1>${escapeHtml(post.title)}</h1>
${post.subtitle ? `<p>${escapeHtml(post.subtitle)}</p>` : ""}
${byline ? `<p>${byline}</p>` : ""}
${renderBlocks(contentToBlocks(post.content))}
<p><a href="${BASE_URL}/blog">All FAULTLINE briefings</a></p>
</article>`;
  return renderArticlePage(template, {
    path,
    meta: {
      title: `${seoTitle} | FAULTLINE`,
      description,
      ogType: "article",
      robots: blogRobots(post.contentClass),
    },
    jsonLd: buildBlogPostStructuredData(post),
    jsonLdId: "blog-post-ld",
    publishedAt: post.publishedAt,
    modifiedAt: post.updatedAt,
    fallbackHtml,
  });
}

function parseInternalLinks(json: string | null | undefined): Array<{ text: string; url: string }> {
  const parsed = safeJsonParse(json);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((l): l is { text: string; url: string } =>
      !!l && typeof l === "object" && typeof (l as any).text === "string" && typeof (l as any).url === "string")
    .filter((l) => /^\/(?!\/)[^\s"'<>]*$/.test(l.url))
    .slice(0, 20);
}

export function renderDailyBriefPage(template: string, item: PublicDailyBrief): string {
  const path = `/daily-brief/${encodeSlugSegment(item.slug)}`;
  const description = nonEmpty(item.metaDescription)
    ?? "FAULTLINE Daily Intelligence Brief — structural macro analysis with explicit evidence and freshness context.";
  const snap = item.briefSnapshot;
  const facts: string[] = [];
  facts.push(`Published ${timeTag(item.publishedAt) || "date unavailable"}`);
  if (item.regime) facts.push(`Regime: ${escapeHtml(item.regime)}`);
  if (item.pressureScore != null) {
    facts.push(`${snap ? "Pressure Index" : "Archived metadata · PI"} ${escapeHtml(String(Math.round(item.pressureScore)))} / 100`);
  }
  let evidence = "";
  if (snap) {
    const inputsTable = snap.inputs && snap.inputs.length
      ? `<table><caption>Inputs used for this brief</caption><thead><tr><th>Input</th><th>Source</th><th>As of</th><th>Freshness</th></tr></thead><tbody>${
          snap.inputs.map((i) => `<tr><td>${escapeHtml(i.key)}</td><td>${escapeHtml(i.source ?? "—")}</td><td>${i.asOf ? `<time datetime="${i.asOf}">${escapeHtml(i.asOf)}</time>` : "—"}</td><td>${escapeHtml(i.freshness ?? "—")}</td></tr>`).join("")
        }</tbody></table>`
      : "";
    evidence = `<section data-ssr="brief-evidence" aria-label="Brief evidence and freshness">
${snap.isStale ? "<p><strong>STALE SNAPSHOT</strong></p>" : ""}
<p>Reading used for this brief: ${timeTag(snap.generatedAt) || "unavailable"}${snap.tradingDate ? ` · Trading date ${escapeHtml(snap.tradingDate)}` : ""}</p>
<p>Snapshot ${escapeHtml(snap.snapshotId.slice(0, 8))} · This article reflects its saved FAULTLINE intelligence snapshot. It does not silently replace that reading with later live values.</p>
${inputsTable}
</section>`;
  } else if (item.contentType === "daily_market_brief") {
    evidence = `<section data-ssr="brief-evidence"><p>Archived brief: this article predates FAULTLINE’s snapshot-binding controls. The displayed pressure metadata was saved with the publication record and may not be the same generation-time reading referenced inside the legacy article text.</p></section>`;
  }
  const links = parseInternalLinks(item.internalLinksJson);
  const fallbackHtml = `<article data-ssr="daily-brief">
<p><a href="${BASE_URL}/">FAULTLINE</a> › <a href="${BASE_URL}/daily-brief">Daily Briefs</a></p>
<p>Daily Intelligence Brief</p>
<h1>${escapeHtml(item.title)}</h1>
<p>${facts.join(" · ")}</p>
${evidence}
${item.metaDescription ? `<p>${escapeHtml(item.metaDescription)}</p>` : ""}
${renderBlocks(contentToBlocks(item.content))}
${links.length ? `<ul>${links.map((l) => `<li><a href="${BASE_URL}${escapeHtml(l.url)}">${escapeHtml(l.text)}</a></li>`).join("")}</ul>` : ""}
<p><a href="${BASE_URL}/daily-brief">All Daily Briefs</a></p>
</article>`;
  return renderArticlePage(template, {
    path,
    meta: {
      title: `${item.title} | FAULTLINE Daily Brief`,
      description,
      ogType: "article",
      canonicalUrl: dailyBriefCanonicalUrl(item.slug),
    },
    jsonLd: buildDailyBriefStructuredData(item),
    jsonLdId: "daily-brief-ld",
    publishedAt: item.publishedAt,
    modifiedAt: item.updatedAt,
    fallbackHtml,
  });
}

export function soroArticleCanonicalUrl(slug: string): string {
  return `${BASE_URL}/blog?post=${encodeURIComponent(slug)}`;
}

export function renderSoroArticlePage(template: string, article: SoroArticle): string {
  const canonicalUrl = soroArticleCanonicalUrl(article.slug);
  const description = nonEmpty(article.excerpt) ?? article.title;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": description,
    "datePublished": article.isoDate,
    "url": canonicalUrl,
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
    "publisher": { "@type": "Organization", "name": "FAULTLINE", "url": BASE_URL },
  };
  if (article.image) ld.image = article.image;
  const fallbackHtml = `<article data-ssr="soro-article">
<p><a href="${BASE_URL}/">FAULTLINE</a> › <a href="${BASE_URL}/blog">Blog</a></p>
<h1>${escapeHtml(article.title)}</h1>
<p>${timeTag(article.isoDate)}</p>
${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ""}
<p><a href="${BASE_URL}/blog">All FAULTLINE articles</a></p>
</article>`;
  return renderArticlePage(template, {
    path: "/blog",
    meta: {
      title: `${article.title} | FAULTLINE`,
      description,
      ogType: "article",
      ogImage: article.image,
      canonicalUrl,
    },
    // Same id as the Soro loader's own JSON-LD so it replaces this block instead of duplicating it.
    jsonLd: ld,
    jsonLdId: "soro-blog-jsonld",
    publishedAt: article.isoDate,
    fallbackHtml,
  });
}

export function renderNotFoundPage(template: string, path: string, section: "blog" | "daily-brief"): string {
  const label = section === "blog" ? "Article" : "Daily Brief";
  const indexPath = section === "blog" ? "/blog" : "/daily-brief";
  let html = injectPageMeta(template, path, {
    title: `${label} not found | FAULTLINE`,
    description: `This FAULTLINE ${label.toLowerCase()} is not available.`,
    robots: "noindex, follow",
  });
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>\s*/, "");
  html = stripHomepageOnlyStructuredData(html);
  return replaceBodyFallback(html, `<section data-ssr="not-found"><h1>${label} not found</h1><p>This page is not available.</p><p><a href="${BASE_URL}${indexPath}">Back to ${section === "blog" ? "the FAULTLINE blog" : "all Daily Briefs"}</a></p></section>`);
}

// ── Router ──────────────────────────────────────────────────────────────────

type MatchedRoute =
  | { kind: "blog"; slug: string }
  | { kind: "daily-brief"; slug: string }
  | { kind: "soro"; slug: string }
  | { kind: "invalid"; section: "blog" | "daily-brief"; path: string };

export function matchPublicContentRoute(originalUrl: string): MatchedRoute | null {
  const [pathPart, ...rest] = originalUrl.split("#")[0].split("?");
  const query = rest.join("?");
  const m = pathPart.match(/^\/(blog|daily-brief)\/([^/]+)\/?$/);
  if (m) {
    const section = m[1] as "blog" | "daily-brief";
    let slug: string;
    try {
      slug = decodeURIComponent(m[2]);
    } catch {
      return { kind: "invalid", section, path: pathPart };
    }
    if (!slug || slug.length > MAX_SLUG_LENGTH || /[\u0000-\u001f]/.test(slug)) {
      return { kind: "invalid", section, path: pathPart };
    }
    return { kind: section, slug };
  }
  if (pathPart === "/blog" || pathPart === "/blog/") {
    const post = new URLSearchParams(query).get("post");
    if (post) return { kind: "soro", slug: post };
  }
  return null;
}

const NOT_FOUND_HEADERS = { "X-Robots-Tag": "noindex" };

/**
 * Render a published article / Daily Brief page, a 404, or a 503.
 * Returns null when the URL is not an article URL (or no DB is configured), so the
 * caller keeps the existing generic behaviour.
 */
export async function renderPublicContentPage(
  template: string,
  originalUrl: string,
  loaders: PublicContentLoaders = defaultPublicContentLoaders,
): Promise<RenderedPage | null> {
  const route = matchPublicContentRoute(originalUrl);
  if (!route) return null;

  if (route.kind === "invalid") {
    return { html: renderNotFoundPage(template, route.path, route.section), status: 404, headers: NOT_FOUND_HEADERS };
  }

  if (route.kind === "soro") {
    // A slug that can never be a Soro slug is a 404 without consulting the feed.
    if (!isSoroSlug(route.slug)) return { html: renderNotFoundPage(template, "/blog", "blog"), status: 404, headers: NOT_FOUND_HEADERS };
    const articles = await loaders.loadSoroArticles();
    // Feed unreadable: existence cannot be confirmed, keep the normal /blog page (canonical /blog).
    if (!articles) return null;
    const article = articles.find((a) => a.slug === route.slug);
    // Feed read and the slug is not a published article: 404 + noindex, not a 200 blog index.
    if (!article) return { html: renderNotFoundPage(template, "/blog", "blog"), status: 404, headers: NOT_FOUND_HEADERS };
    return { html: renderSoroArticlePage(template, article), status: 200, headers: {} };
  }

  const path = `/${route.kind}/${encodeSlugSegment(route.slug)}`;
  const now = loaders.now();
  const lookup = route.kind === "blog" ? await loaders.loadBlogPost(route.slug) : await loaders.loadDailyBrief(route.slug);

  if (lookup.status === "db_unconfigured") return null;
  if (lookup.status === "error") {
    return {
      html: injectPageMeta(template, path),
      status: 503,
      headers: { "Retry-After": "120", "Cache-Control": "no-store" },
    };
  }
  if (lookup.status === "found") {
    if (route.kind === "blog") {
      const post = lookup.record as PublicBlogPost;
      if (isPublicBlogPost(post, now)) return { html: renderBlogPostPage(template, post), status: 200, headers: {} };
    } else {
      const item = lookup.record as PublicDailyBrief;
      if (isPublicDailyBrief(item, now)) return { html: renderDailyBriefPage(template, item), status: 200, headers: {} };
    }
  }
  return { html: renderNotFoundPage(template, path, route.kind), status: 404, headers: NOT_FOUND_HEADERS };
}

/** Entry point used by the Vite (dev) and static (prod) SPA catch-alls. */
export async function renderSpaPage(
  template: string,
  originalUrl: string,
  loaders: PublicContentLoaders = defaultPublicContentLoaders,
): Promise<RenderedPage> {
  try {
    const rendered = await renderPublicContentPage(template, originalUrl, loaders);
    if (rendered) return rendered;
  } catch {
    /* fall through to the generic metadata path */
  }
  return { html: await injectPageMetaAsync(template, originalUrl), status: 200, headers: {} };
}
