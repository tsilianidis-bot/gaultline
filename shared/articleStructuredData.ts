/**
 * articleStructuredData.ts — shared JSON-LD builders for public article pages.
 *
 * Used by the server-side HTML renderer (server/publicContentSsr.ts) and by the
 * client Daily Brief page so the structured data a crawler receives in the
 * initial HTML is the same object the SPA renders after hydration.
 *
 * Builders only use fields that exist on the stored record. They never invent
 * headlines, dates, or authors.
 */

export const PUBLIC_SITE_URL = "https://getfaultline.live";

type DateLike = Date | string | number | null | undefined;

/** Convert a stored date value into an ISO-8601 string, or undefined when absent/invalid. */
export function toIsoDate(value: DateLike): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? d.toISOString() : undefined;
}

/** Path-segment-safe encoding that keeps original slugs readable (a-z, 0-9, "-", "_", ".", "~"). */
export function encodeSlugSegment(slug: string): string {
  return encodeURIComponent(slug);
}

export function dailyBriefCanonicalUrl(slug: string): string {
  return `${PUBLIC_SITE_URL}/daily-brief/${encodeSlugSegment(slug)}`;
}

export interface DailyBriefStructuredDataInput {
  slug: string;
  title: string;
  metaDescription?: string | null;
  publishedAt?: DateLike;
  updatedAt?: DateLike;
}

/**
 * Article JSON-LD for a published Daily Intelligence Brief (/daily-brief/:slug).
 * The canonical URL is always the /daily-brief/ URL; legacy stored schemaJson
 * (which pointed at the non-routed /intelligence/ path) is intentionally not merged.
 */
export function buildDailyBriefStructuredData(item: DailyBriefStructuredDataInput): Record<string, unknown> {
  const url = dailyBriefCanonicalUrl(item.slug);
  const datePublished = toIsoDate(item.publishedAt);
  const dateModified = toIsoDate(item.updatedAt) ?? datePublished;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": item.title,
    "url": url,
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "author": { "@type": "Organization", "name": "FAULTLINE", "url": PUBLIC_SITE_URL },
    "publisher": { "@type": "Organization", "name": "FAULTLINE", "url": PUBLIC_SITE_URL },
    "isPartOf": { "@type": "CollectionPage", "@id": `${PUBLIC_SITE_URL}/daily-brief`, "name": "FAULTLINE Daily Intelligence Briefs" },
    "inLanguage": "en-US",
  };
  if (item.metaDescription) ld.description = item.metaDescription;
  if (datePublished) ld.datePublished = datePublished;
  if (dateModified) ld.dateModified = dateModified;
  return ld;
}

/**
 * Serialize JSON-LD for embedding inside a <script type="application/ld+json"> element.
 * Escapes characters that could terminate the script element or break parsing.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
