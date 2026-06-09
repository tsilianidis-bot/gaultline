/**
 * FAULTLINE — SEO Optimizer Engine
 * ============================================================
 * Provides:
 *  - URL content fetching + HTML parsing
 *  - On-page SEO scoring (title, meta, headings, content, links)
 *  - Keyword density analysis
 *  - Readability scoring (Flesch-Kincaid approximation)
 *  - AI-powered meta title/description/keyword generation
 *  - SERP preview data
 *  - Technical SEO checks (canonical, robots, OG, schema)
 * ============================================================
 */

import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────

export interface SeoAnalysisResult {
  url: string;
  fetchedAt: number;
  overallScore: number;           // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  checks: SeoCheck[];
  meta: MetaData;
  headings: HeadingData;
  keywords: KeywordData[];
  readability: ReadabilityData;
  links: LinkData;
  technical: TechnicalData;
  serpPreview: SerpPreview;
  aiSuggestions: AiSuggestions;
  wordCount: number;
  pageTitle: string;
}

export interface SeoCheck {
  id: string;
  category: "meta" | "content" | "technical" | "links" | "performance";
  label: string;
  status: "pass" | "warning" | "fail" | "info";
  score: number;       // 0–10
  maxScore: number;    // 0–10
  detail: string;
  recommendation?: string;
}

export interface MetaData {
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  keywords: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  schemaTypes: string[];
}

export interface HeadingData {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export interface KeywordData {
  word: string;
  count: number;
  density: number;  // percentage
  prominence: number; // 0–100 based on placement
}

export interface ReadabilityData {
  score: number;       // Flesch Reading Ease 0–100
  grade: string;       // "Easy", "Standard", "Difficult"
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  sentenceCount: number;
}

export interface LinkData {
  internal: number;
  external: number;
  broken: number;
  nofollow: number;
  totalLinks: number;
}

export interface TechnicalData {
  hasCanonical: boolean;
  hasRobots: boolean;
  hasViewport: boolean;
  hasOgTags: boolean;
  hasTwitterCard: boolean;
  hasSchema: boolean;
  hasHttps: boolean;
  hasAltTags: boolean;
  imagesWithoutAlt: number;
  totalImages: number;
}

export interface SerpPreview {
  title: string;
  url: string;
  description: string;
  breadcrumb: string;
}

export interface AiSuggestions {
  metaTitle: string;
  metaDescription: string;
  focusKeywords: string[];
  contentGaps: string[];
  improvements: string[];
  estimatedDifficulty: "Low" | "Medium" | "High";
}

// ── HTML Parser (no external deps) ───────────────────────────

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : null;
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractHeadings(html: string, level: string): string[] {
  const regex = new RegExp(`<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`, "gi");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "").trim();
    if (text) matches.push(text);
  }
  return matches;
}

function extractBodyText(html: string): string {
  // Remove script, style, nav, header, footer blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;
  if (word.endsWith("e")) count--;
  if (word.endsWith("le") && word.length > 2) count++;
  return Math.max(1, count);
}

function computeReadability(text: string): ReadabilityData {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0 || sentences.length === 0) {
    return { score: 0, grade: "Unknown", avgWordsPerSentence: 0, avgSyllablesPerWord: 0, sentenceCount: 0 };
  }
  const avgWords = words.length / sentences.length;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSyllables = totalSyllables / words.length;
  // Flesch Reading Ease
  const score = Math.max(0, Math.min(100, 206.835 - 1.015 * avgWords - 84.6 * avgSyllables));
  let grade = "Very Difficult";
  if (score >= 90) grade = "Very Easy";
  else if (score >= 70) grade = "Easy";
  else if (score >= 60) grade = "Standard";
  else if (score >= 50) grade = "Fairly Difficult";
  else if (score >= 30) grade = "Difficult";
  return {
    score: Math.round(score),
    grade,
    avgWordsPerSentence: Math.round(avgWords * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllables * 100) / 100,
    sentenceCount: sentences.length,
  };
}

function extractKeywords(text: string, titleText: string, h1Text: string): KeywordData[] {
  const stopWords = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were",
    "be","been","being","have","has","had","do","does","did","will","would","could","should","may","might",
    "this","that","these","those","it","its","we","our","you","your","they","their","he","she","his","her",
    "not","no","so","if","as","up","out","about","into","than","then","when","where","which","who","what",
    "all","any","each","more","most","other","some","such","only","own","same","too","very","just","also",
    "can","get","use","make","like","time","new","one","two","three","way","see","now","know","take","come",
    "how","there","their","been","here","my","me","him","us","them","its","over","after","before","between",
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  const totalWords = words.length;
  const titleWords = new Set(titleText.toLowerCase().split(/\s+/));
  const h1Words = new Set(h1Text.toLowerCase().split(/\s+/));

  return Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word, count]) => {
      const density = totalWords > 0 ? (count / totalWords) * 100 : 0;
      let prominence = 50;
      if (titleWords.has(word)) prominence += 30;
      if (h1Words.has(word)) prominence += 20;
      return { word, count, density: Math.round(density * 100) / 100, prominence: Math.min(100, prominence) };
    });
}

function extractLinks(html: string, baseUrl: string): LinkData {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let internal = 0, external = 0, nofollow = 0;
  let m;
  const base = new URL(baseUrl);
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const fullTag = m[0];
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (fullTag.includes("nofollow")) nofollow++;
    try {
      const url = new URL(href, baseUrl);
      if (url.hostname === base.hostname) internal++;
      else external++;
    } catch {
      internal++;
    }
  }
  return { internal, external, broken: 0, nofollow, totalLinks: internal + external };
}

function extractImages(html: string): { total: number; withoutAlt: number } {
  const imgRegex = /<img[^>]+>/gi;
  let total = 0, withoutAlt = 0;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    total++;
    if (!m[0].includes("alt=") || m[0].match(/alt=["']\s*["']/)) withoutAlt++;
  }
  return { total, withoutAlt };
}

function extractSchemaTypes(html: string): string[] {
  const types: string[] = [];
  const regex = /"@type"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!types.includes(m[1])) types.push(m[1]);
  }
  return types;
}

// ── SEO Scoring ───────────────────────────────────────────────

function buildChecks(meta: MetaData, headings: HeadingData, body: string, links: LinkData, tech: TechnicalData, wordCount: number): SeoCheck[] {
  const checks: SeoCheck[] = [];

  // Title checks
  if (!meta.title) {
    checks.push({ id: "title-missing", category: "meta", label: "Page Title", status: "fail", score: 0, maxScore: 10, detail: "No <title> tag found.", recommendation: "Add a descriptive title tag (50–60 characters)." });
  } else if (meta.titleLength < 30) {
    checks.push({ id: "title-short", category: "meta", label: "Page Title Length", status: "warning", score: 5, maxScore: 10, detail: `Title is too short (${meta.titleLength} chars). Aim for 50–60.`, recommendation: "Expand your title to include your primary keyword and brand." });
  } else if (meta.titleLength > 60) {
    checks.push({ id: "title-long", category: "meta", label: "Page Title Length", status: "warning", score: 7, maxScore: 10, detail: `Title is too long (${meta.titleLength} chars). Google truncates at ~60.`, recommendation: "Shorten your title to under 60 characters." });
  } else {
    checks.push({ id: "title-good", category: "meta", label: "Page Title", status: "pass", score: 10, maxScore: 10, detail: `Title is ${meta.titleLength} characters — optimal length.` });
  }

  // Meta description
  if (!meta.description) {
    checks.push({ id: "desc-missing", category: "meta", label: "Meta Description", status: "fail", score: 0, maxScore: 10, detail: "No meta description found.", recommendation: "Add a compelling meta description (120–160 characters)." });
  } else if (meta.descriptionLength < 70) {
    checks.push({ id: "desc-short", category: "meta", label: "Meta Description Length", status: "warning", score: 5, maxScore: 10, detail: `Description too short (${meta.descriptionLength} chars). Aim for 120–160.`, recommendation: "Expand your meta description to improve click-through rate." });
  } else if (meta.descriptionLength > 160) {
    checks.push({ id: "desc-long", category: "meta", label: "Meta Description Length", status: "warning", score: 7, maxScore: 10, detail: `Description too long (${meta.descriptionLength} chars). Google truncates at ~160.`, recommendation: "Shorten to under 160 characters." });
  } else {
    checks.push({ id: "desc-good", category: "meta", label: "Meta Description", status: "pass", score: 10, maxScore: 10, detail: `Description is ${meta.descriptionLength} characters — optimal.` });
  }

  // H1 checks
  if (headings.h1.length === 0) {
    checks.push({ id: "h1-missing", category: "content", label: "H1 Heading", status: "fail", score: 0, maxScore: 8, detail: "No H1 heading found on the page.", recommendation: "Add exactly one H1 heading containing your primary keyword." });
  } else if (headings.h1.length > 1) {
    checks.push({ id: "h1-multiple", category: "content", label: "H1 Heading", status: "warning", score: 5, maxScore: 8, detail: `${headings.h1.length} H1 headings found. Best practice is exactly one.`, recommendation: "Use only one H1 per page. Use H2–H3 for subheadings." });
  } else {
    checks.push({ id: "h1-good", category: "content", label: "H1 Heading", status: "pass", score: 8, maxScore: 8, detail: `One H1 found: "${headings.h1[0].substring(0, 60)}${headings.h1[0].length > 60 ? '…' : ''}"` });
  }

  // Word count
  if (wordCount < 300) {
    checks.push({ id: "content-thin", category: "content", label: "Content Length", status: "fail", score: 0, maxScore: 8, detail: `Only ${wordCount} words. Thin content may rank poorly.`, recommendation: "Aim for at least 600–800 words for informational pages." });
  } else if (wordCount < 600) {
    checks.push({ id: "content-short", category: "content", label: "Content Length", status: "warning", score: 5, maxScore: 8, detail: `${wordCount} words. Consider expanding to 800+.`, recommendation: "More comprehensive content tends to rank better." });
  } else {
    checks.push({ id: "content-good", category: "content", label: "Content Length", status: "pass", score: 8, maxScore: 8, detail: `${wordCount} words — good content depth.` });
  }

  // H2 structure
  if (headings.h2.length === 0) {
    checks.push({ id: "h2-missing", category: "content", label: "H2 Subheadings", status: "warning", score: 3, maxScore: 5, detail: "No H2 subheadings found.", recommendation: "Add H2 headings to structure your content and include secondary keywords." });
  } else {
    checks.push({ id: "h2-good", category: "content", label: "H2 Subheadings", status: "pass", score: 5, maxScore: 5, detail: `${headings.h2.length} H2 subheadings found — good structure.` });
  }

  // Canonical
  if (!tech.hasCanonical) {
    checks.push({ id: "canonical-missing", category: "technical", label: "Canonical Tag", status: "warning", score: 3, maxScore: 5, detail: "No canonical tag found.", recommendation: "Add <link rel='canonical'> to prevent duplicate content issues." });
  } else {
    checks.push({ id: "canonical-good", category: "technical", label: "Canonical Tag", status: "pass", score: 5, maxScore: 5, detail: "Canonical tag present." });
  }

  // OG tags
  if (!tech.hasOgTags) {
    checks.push({ id: "og-missing", category: "technical", label: "Open Graph Tags", status: "warning", score: 3, maxScore: 5, detail: "No Open Graph meta tags found.", recommendation: "Add og:title, og:description, og:image for better social sharing." });
  } else {
    checks.push({ id: "og-good", category: "technical", label: "Open Graph Tags", status: "pass", score: 5, maxScore: 5, detail: "Open Graph tags present." });
  }

  // Twitter card
  if (!tech.hasTwitterCard) {
    checks.push({ id: "twitter-missing", category: "technical", label: "Twitter Card", status: "info", score: 3, maxScore: 4, detail: "No Twitter Card meta tags found.", recommendation: "Add twitter:card tags for better Twitter sharing." });
  } else {
    checks.push({ id: "twitter-good", category: "technical", label: "Twitter Card", status: "pass", score: 4, maxScore: 4, detail: "Twitter Card tags present." });
  }

  // Schema
  if (!tech.hasSchema) {
    checks.push({ id: "schema-missing", category: "technical", label: "Structured Data", status: "warning", score: 3, maxScore: 6, detail: "No JSON-LD schema markup found.", recommendation: "Add schema.org structured data to improve rich snippet eligibility." });
  } else {
    checks.push({ id: "schema-good", category: "technical", label: "Structured Data", status: "pass", score: 6, maxScore: 6, detail: `Schema types found: ${tech.hasSchema ? "Yes" : "No"}.` });
  }

  // HTTPS
  if (!tech.hasHttps) {
    checks.push({ id: "https-missing", category: "technical", label: "HTTPS", status: "fail", score: 0, maxScore: 5, detail: "Page is not served over HTTPS.", recommendation: "Install an SSL certificate. HTTPS is a confirmed Google ranking factor." });
  } else {
    checks.push({ id: "https-good", category: "technical", label: "HTTPS", status: "pass", score: 5, maxScore: 5, detail: "Page is served over HTTPS." });
  }

  // Images alt text
  if (tech.totalImages > 0 && tech.imagesWithoutAlt > 0) {
    checks.push({ id: "img-alt", category: "content", label: "Image Alt Text", status: "warning", score: Math.round(5 * (1 - tech.imagesWithoutAlt / tech.totalImages)), maxScore: 5, detail: `${tech.imagesWithoutAlt} of ${tech.totalImages} images missing alt text.`, recommendation: "Add descriptive alt text to all images for accessibility and SEO." });
  } else if (tech.totalImages > 0) {
    checks.push({ id: "img-alt-good", category: "content", label: "Image Alt Text", status: "pass", score: 5, maxScore: 5, detail: `All ${tech.totalImages} images have alt text.` });
  }

  // Internal links
  if (links.internal < 2) {
    checks.push({ id: "internal-links", category: "links", label: "Internal Links", status: "warning", score: 3, maxScore: 5, detail: `Only ${links.internal} internal link(s). Internal linking helps crawlability.`, recommendation: "Add more internal links to related pages on your site." });
  } else {
    checks.push({ id: "internal-links-good", category: "links", label: "Internal Links", status: "pass", score: 5, maxScore: 5, detail: `${links.internal} internal links found.` });
  }

  // Viewport
  if (!tech.hasViewport) {
    checks.push({ id: "viewport-missing", category: "technical", label: "Viewport Meta", status: "fail", score: 0, maxScore: 4, detail: "No viewport meta tag found.", recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> for mobile SEO." });
  } else {
    checks.push({ id: "viewport-good", category: "technical", label: "Viewport Meta", status: "pass", score: 4, maxScore: 4, detail: "Viewport meta tag present — mobile-friendly." });
  }

  return checks;
}

function computeScore(checks: SeoCheck[]): { score: number; grade: "A" | "B" | "C" | "D" | "F" } {
  const total = checks.reduce((sum, c) => sum + c.maxScore, 0);
  const earned = checks.reduce((sum, c) => sum + c.score, 0);
  const pct = total > 0 ? (earned / total) * 100 : 0;
  const score = Math.round(pct);
  let grade: "A" | "B" | "C" | "D" | "F" = "F";
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 45) grade = "D";
  return { score, grade };
}

// ── Main Analysis Function ────────────────────────────────────

export async function analyzeSeoUrl(url: string): Promise<SeoAnalysisResult> {
  // Fetch the page
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let html = "";
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FaultlineSEOBot/1.0; +https://getfaultline.live)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await resp.text();
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse metadata
  const titleText = extractTag(html, "title") || "";
  const meta: MetaData = {
    title: titleText || null,
    titleLength: titleText.length,
    description: extractMeta(html, "description"),
    descriptionLength: (extractMeta(html, "description") || "").length,
    keywords: extractMeta(html, "keywords"),
    canonical: (() => { const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i); return m ? m[1] : null; })(),
    robots: extractMeta(html, "robots"),
    viewport: extractMeta(html, "viewport"),
    ogTitle: extractMeta(html, "og:title"),
    ogDescription: extractMeta(html, "og:description"),
    ogImage: extractMeta(html, "og:image"),
    twitterCard: extractMeta(html, "twitter:card"),
    twitterTitle: extractMeta(html, "twitter:title"),
    twitterDescription: extractMeta(html, "twitter:description"),
    schemaTypes: extractSchemaTypes(html),
  };

  // Headings
  const headings: HeadingData = {
    h1: extractHeadings(html, "h1"),
    h2: extractHeadings(html, "h2"),
    h3: extractHeadings(html, "h3"),
    h4: extractHeadings(html, "h4"),
    h5: extractHeadings(html, "h5"),
    h6: extractHeadings(html, "h6"),
  };

  // Body text
  const bodyText = extractBodyText(html);
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Keywords
  const keywords = extractKeywords(bodyText, titleText, headings.h1[0] || "");

  // Readability
  const readability = computeReadability(bodyText);

  // Links
  const links = extractLinks(html, url);

  // Images
  const imgData = extractImages(html);

  // Technical
  const technical: TechnicalData = {
    hasCanonical: !!meta.canonical,
    hasRobots: !!meta.robots,
    hasViewport: !!meta.viewport,
    hasOgTags: !!(meta.ogTitle || meta.ogDescription),
    hasTwitterCard: !!meta.twitterCard,
    hasSchema: meta.schemaTypes.length > 0,
    hasHttps: url.startsWith("https://"),
    hasAltTags: imgData.withoutAlt === 0,
    imagesWithoutAlt: imgData.withoutAlt,
    totalImages: imgData.total,
  };

  // Checks & score
  const checks = buildChecks(meta, headings, bodyText, links, technical, wordCount);
  const { score, grade } = computeScore(checks);

  // SERP preview
  const serpTitle = meta.title || meta.ogTitle || "Untitled Page";
  const serpDesc = meta.description || meta.ogDescription || bodyText.substring(0, 160);
  const urlObj = new URL(url);
  const serpPreview: SerpPreview = {
    title: serpTitle.length > 60 ? serpTitle.substring(0, 57) + "…" : serpTitle,
    url: url,
    description: serpDesc.length > 160 ? serpDesc.substring(0, 157) + "…" : serpDesc,
    breadcrumb: urlObj.hostname + urlObj.pathname.replace(/\/$/, ""),
  };

  // AI suggestions
  const aiSuggestions = await generateAiSuggestions(url, meta, headings, keywords, checks, bodyText.substring(0, 2000));

  return {
    url,
    fetchedAt: Date.now(),
    overallScore: score,
    grade,
    checks,
    meta,
    headings,
    keywords,
    readability,
    links,
    technical,
    serpPreview,
    aiSuggestions,
    wordCount,
    pageTitle: titleText,
  };
}

// ── AI Suggestions ────────────────────────────────────────────

async function generateAiSuggestions(
  url: string,
  meta: MetaData,
  headings: HeadingData,
  keywords: KeywordData[],
  checks: SeoCheck[],
  bodySnippet: string
): Promise<AiSuggestions> {
  const failedChecks = checks.filter(c => c.status === "fail" || c.status === "warning").map(c => c.label).join(", ");
  const topKeywords = keywords.slice(0, 8).map(k => k.word).join(", ");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert SEO consultant. Analyze the provided page data and return actionable SEO recommendations in JSON format. Be specific, concise, and actionable.`,
        },
        {
          role: "user",
          content: `Analyze this page for SEO and return JSON with these exact fields:
- metaTitle: An optimized meta title (50-60 chars)
- metaDescription: An optimized meta description (120-155 chars)  
- focusKeywords: Array of 5 primary keywords to target
- contentGaps: Array of 3 content topics missing from this page
- improvements: Array of 4 specific actionable improvements
- estimatedDifficulty: "Low", "Medium", or "High" (how hard to rank for primary keyword)

Page URL: ${url}
Current title: ${meta.title || "MISSING"}
Current description: ${meta.description || "MISSING"}
H1: ${headings.h1[0] || "MISSING"}
H2s: ${headings.h2.slice(0, 5).join(" | ") || "NONE"}
Top keywords: ${topKeywords}
Failed SEO checks: ${failedChecks || "None"}
Content snippet: ${bodySnippet.substring(0, 500)}

Return ONLY valid JSON, no markdown.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "seo_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              metaTitle: { type: "string" },
              metaDescription: { type: "string" },
              focusKeywords: { type: "array", items: { type: "string" } },
              contentGaps: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              estimatedDifficulty: { type: "string", enum: ["Low", "Medium", "High"] },
            },
            required: ["metaTitle", "metaDescription", "focusKeywords", "contentGaps", "improvements", "estimatedDifficulty"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content as string | undefined;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        metaTitle: parsed.metaTitle || "",
        metaDescription: parsed.metaDescription || "",
        focusKeywords: parsed.focusKeywords || [],
        contentGaps: parsed.contentGaps || [],
        improvements: parsed.improvements || [],
        estimatedDifficulty: parsed.estimatedDifficulty || "Medium",
      };
    }
  } catch {
    // Fallback if AI fails
  }

  return {
    metaTitle: meta.title ? `${meta.title.substring(0, 55)}` : "Add a descriptive title here",
    metaDescription: meta.description || "Add a compelling meta description that summarizes your page content in 120-160 characters.",
    focusKeywords: keywords.slice(0, 5).map(k => k.word),
    contentGaps: ["FAQ section", "Internal linking to related content", "Author/expertise signals"],
    improvements: [
      "Add structured data markup for rich snippets",
      "Improve internal linking structure",
      "Optimize images with descriptive alt text",
      "Add more comprehensive content (800+ words)",
    ],
    estimatedDifficulty: "Medium",
  };
}

// ── Quick Meta Generator ──────────────────────────────────────

export async function generateMetaTags(topic: string, targetKeyword: string, pageType: string): Promise<{
  titles: string[];
  descriptions: string[];
  keywords: string[];
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an SEO copywriter. Generate optimized meta tags in JSON format.",
        },
        {
          role: "user",
          content: `Generate SEO meta tags for:
Topic: ${topic}
Target keyword: ${targetKeyword}
Page type: ${pageType}

Return JSON with:
- titles: array of 3 meta title options (50-60 chars each)
- descriptions: array of 3 meta description options (120-155 chars each)
- keywords: array of 10 related keywords

Return ONLY valid JSON.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meta_tags",
          strict: true,
          schema: {
            type: "object",
            properties: {
              titles: { type: "array", items: { type: "string" } },
              descriptions: { type: "array", items: { type: "string" } },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["titles", "descriptions", "keywords"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content as string | undefined;
    if (content) return JSON.parse(content);
  } catch { /* fallback */ }

  return {
    titles: [`${targetKeyword} — ${topic}`, `${topic} | ${targetKeyword} Guide`, `Best ${targetKeyword}: ${topic}`],
    descriptions: [
      `Discover everything about ${topic}. Our comprehensive guide covers ${targetKeyword} with expert insights and actionable tips.`,
      `Looking for ${targetKeyword}? Explore our in-depth ${topic} resource with proven strategies and real-world examples.`,
    ],
    keywords: [targetKeyword, topic, `${targetKeyword} guide`, `best ${targetKeyword}`, `how to ${targetKeyword}`],
  };
}
