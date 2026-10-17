/**
 * soroBlogFeed.ts — read-only server access to the public Soro blog feed.
 *
 * The public /blog page mounts the user-approved Soro embed (client/src/pages/Blog.tsx).
 * Soro articles are deep-linked as /blog?post=<slug>. The embed loader is a public
 * JavaScript file that carries the list of *published* Soro articles
 * (id, title, slug, excerpt, isoDate, image). This module fetches that same public
 * loader with a short timeout, extracts the article list, validates it strictly and
 * caches it, so the server can emit per-article metadata for /blog?post=<slug>.
 *
 * Fail-closed: any network, parse, or validation problem yields `null`, and callers
 * fall back to the generic /blog metadata. Nothing here writes to Soro.
 */

/** Must stay identical to SORO_BLOG_EMBED_SRC in client/src/pages/Blog.tsx (asserted in tests). */
export const SORO_BLOG_EMBED_SRC = "https://app.trysoro.com/api/embed/46626052-54a8-4bcf-9ec4-84473cffbb53";

export interface SoroArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** ISO-8601 publication timestamp exactly as supplied by Soro. */
  isoDate: string;
  image?: string;
}

const SORO_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/;

/** True when `slug` has the shape of a Soro article slug (the feed only ever publishes these). */
export function isSoroSlug(slug: string): boolean {
  return SORO_SLUG_RE.test(slug);
}

/**
 * CSP img-src source for Soro featured images: Soro's Supabase storage host, scoped
 * to this blog's public featured-images folder (CSP path matching). Narrowest source
 * that covers the images the Soro feed publishes (asserted in tests).
 */
export const SORO_FEATURED_IMAGE_CSP_SOURCE =
  "https://afocirmbqdxnkyescnev.supabase.co/storage/v1/object/public/featured-images/59987b54-3140-4228-a59a-2acbbc63c959/";
const SUCCESS_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;
/** Allowed clock skew when checking that a publication date is not in the future. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Extract the JSON array literal assigned to `SORO_ARTICLES` from the loader source.
 * Uses a string-aware bracket scanner instead of evaluating any third-party code.
 */
export function extractSoroArticlesLiteral(source: string): string | null {
  const marker = source.match(/var\s+SORO_ARTICLES\s*=\s*\[/);
  if (!marker || marker.index === undefined) return null;
  const start = marker.index + marker[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse and strictly validate the Soro article list. Invalid entries are dropped. */
export function parseSoroEmbedArticles(source: string, now: Date = new Date()): SoroArticle[] | null {
  const literal = extractSoroArticlesLiteral(source);
  if (!literal) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(literal);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const articles: SoroArticle[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const { id, slug, title, excerpt, isoDate, image } = e;
    if (typeof id !== "string" || !id) continue;
    if (typeof slug !== "string" || !SORO_SLUG_RE.test(slug)) continue;
    if (typeof title !== "string" || !title.trim() || title.length > 300) continue;
    if (typeof isoDate !== "string") continue;
    const published = new Date(isoDate).getTime();
    if (!Number.isFinite(published) || published > now.getTime() + FUTURE_SKEW_MS) continue;
    const article: SoroArticle = {
      id,
      slug,
      title: title.trim(),
      excerpt: typeof excerpt === "string" ? excerpt.trim().slice(0, 1000) : "",
      isoDate,
    };
    if (typeof image === "string" && /^https:\/\/[^\s"'<>]+$/.test(image)) article.image = image;
    articles.push(article);
  }
  return articles;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  text(): Promise<string>;
}>;

let cache: { value: SoroArticle[] | null; expiresAt: number } | null = null;
let inFlight: Promise<SoroArticle[] | null> | null = null;

/** Test hook: clear the in-memory cache. */
export function resetSoroFeedCache(): void {
  cache = null;
  inFlight = null;
}

/**
 * Return the published Soro article list, or null when it cannot be read.
 * Cached for 10 minutes on success and 1 minute on failure.
 */
export async function getSoroArticles(fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<SoroArticle[] | null> {
  const nowMs = Date.now();
  if (cache && cache.expiresAt > nowMs) return cache.value;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let value: SoroArticle[] | null = null;
    try {
      const response = await fetchImpl(SORO_BLOG_EMBED_SRC, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "application/javascript, text/javascript, */*" },
      });
      if (response.ok) value = parseSoroEmbedArticles(await response.text());
    } catch {
      value = null;
    }
    cache = { value, expiresAt: Date.now() + (value ? SUCCESS_TTL_MS : FAILURE_TTL_MS) };
    return value;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
