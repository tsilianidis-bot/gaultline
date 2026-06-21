import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { Streamdown } from "streamdown";
import { CalendarDays, Clock, ArrowLeft, Tag, ChevronRight, Eye, Archive, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function readingTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    "Macro Intelligence": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "Market Analysis": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Risk Intelligence": "bg-red-500/10 text-red-400 border-red-500/20",
    "Crypto Intelligence": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Platform Updates": "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return map[cat] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

/** Injects or removes a <meta name="robots"> tag */
function setRobotsMeta(content: string | null) {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (content === null) {
    // Restore default (index, follow)
    if (existing) existing.setAttribute("content", "index, follow");
    return;
  }
  if (existing) {
    existing.setAttribute("content", content);
  } else {
    const el = document.createElement("meta");
    el.name = "robots";
    el.content = content;
    document.head.appendChild(el);
  }
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, error } = trpc.blog.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  const incrementView = trpc.blog.incrementViewCount.useMutation();

  // Fetch evergreen posts for Related Posts section (only shown on evergreen posts)
  const { data: evergreenPosts } = trpc.blog.listEvergreen.useQuery(
    { limit: 4 },
    { enabled: post?.contentClass === "evergreen" }
  );

  // Related posts = other evergreen posts (exclude current)
  const relatedPosts = evergreenPosts?.filter(p => p.slug !== slug).slice(0, 3) ?? [];

  // Fire view count increment once when post loads
  useEffect(() => {
    if (post?.slug) {
      incrementView.mutate({ slug: post.slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.slug]);

  // Dynamic SEO — title, description, canonical, OG, robots, JSON-LD
  useEffect(() => {
    if (!post) return;

    const isEvergreen = post.contentClass === "evergreen";
    const isIntelRecord = post.contentClass === "intel_record";

    // Use metaTitle/metaDescription from DB if available (evergreen articles have these)
    const seoTitle = (post as any).metaTitle ?? post.title;
    const seoDesc = (post as any).metaDescription ?? post.subtitle ?? post.title;
    const fullTitle = `${seoTitle} | FAULTLINE`;
    const canonicalUrl = `https://getfaultline.live/blog/${post.slug}`;

    document.title = fullTitle;

    const setMeta = (sel: string, val: string) => {
      const el = document.querySelector<HTMLMetaElement>(sel);
      if (el) el.setAttribute("content", val);
    };

    setMeta('meta[name="description"]', seoDesc);
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', seoDesc);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', seoDesc);

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", canonicalUrl);

    // ── Robots directive ────────────────────────────────────────
    // Evergreen: index, follow (default — Google should index these)
    // Intel Record: noindex, follow (preserve link equity, skip indexing)
    // Test: noindex, nofollow
    if (isEvergreen) {
      setRobotsMeta("index, follow");
    } else if (isIntelRecord) {
      setRobotsMeta("noindex, follow");
    } else {
      setRobotsMeta("noindex, nofollow");
    }

    // ── Structured data ─────────────────────────────────────────
    // Evergreen: full Article JSON-LD with wordCount, keywords, articleSection
    // Intel Record: minimal BlogPosting (still useful for Google Discover)
    const existingLd = document.getElementById("blog-post-ld");
    if (existingLd) existingLd.remove();

    const ld = document.createElement("script");
    ld.id = "blog-post-ld";
    ld.type = "application/ld+json";

    const baseSchema = {
      "@context": "https://schema.org",
      "@type": isEvergreen ? "Article" : "BlogPosting",
      "headline": post.title,
      "description": post.subtitle ?? post.title,
      "url": canonicalUrl,
      "datePublished": post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
      "author": {
        "@type": "Organization",
        "name": "FAULTLINE",
        "url": "https://getfaultline.live",
      },
      "publisher": {
        "@type": "Organization",
        "name": "FAULTLINE",
        "url": "https://getfaultline.live",
        "logo": {
          "@type": "ImageObject",
          "url": "https://getfaultline.live/favicon-32x32.png",
        },
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      ...(post.category ? { "articleSection": post.category } : {}),
      ...(post.tags ? { "keywords": post.tags } : {}),
    };

    // Evergreen-only enrichments
    const evergreenEnrichments = isEvergreen ? {
      "wordCount": post.content.trim().split(/\s+/).length,
      "inLanguage": "en-US",
      "isPartOf": {
        "@type": "Blog",
        "@id": "https://getfaultline.live/blog",
        "name": "FAULTLINE Analysis",
        "url": "https://getfaultline.live/blog",
      },
    } : {};

    ld.textContent = JSON.stringify({ ...baseSchema, ...evergreenEnrichments });
    document.head.appendChild(ld);

    return () => {
      document.title = "FAULTLINE — Market Risk Intelligence Platform";
      const ldEl = document.getElementById("blog-post-ld");
      if (ldEl) ldEl.remove();
      setRobotsMeta(null);
    };
  }, [post]);

  return (
    <div className="min-h-screen bg-[#080c18] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="font-['Orbitron'] text-lg font-bold tracking-widest text-white cursor-pointer">
              FAULT<span className="text-cyan-400">LINE</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {post?.contentClass === "intel_record" && (
              <Link href="/intel-archive">
                <span className="flex items-center gap-1 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-amber-400 transition-colors cursor-pointer">
                  <Archive className="w-3 h-3" /> ARCHIVE
                </span>
              </Link>
            )}
            <Link href="/blog">
              <span className="flex items-center gap-1 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-cyan-400 transition-colors cursor-pointer">
                <ArrowLeft className="w-3 h-3" /> ALL BRIEFINGS
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {isLoading && (
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-white/5 rounded animate-pulse" />
            <div className="h-64 bg-white/5 rounded animate-pulse mt-8" />
          </div>
        )}

        {error && (
          <div className="text-center py-24">
            <p className="text-red-400 font-['IBM_Plex_Mono'] text-sm mb-4">BRIEFING NOT FOUND</p>
            <Link href="/blog">
              <span className="text-cyan-400 text-xs font-['IBM_Plex_Mono'] hover:underline cursor-pointer">
                ← BACK TO BRIEFINGS
              </span>
            </Link>
          </div>
        )}

        {post && (
          <article>
            {/* Intel Record banner */}
            {post.contentClass === "intel_record" && (
              <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5 text-xs font-['IBM_Plex_Mono'] text-amber-400/80">
                <Archive className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Historical Intelligence Record — This is a daily briefing from the FAULTLINE archive.{" "}
                  <Link href="/intel-archive">
                    <span className="underline hover:text-amber-300 cursor-pointer">Browse all records →</span>
                  </Link>
                </span>
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(post.category)}`}>
                {post.category.toUpperCase()}
              </span>
              {post.contentClass === "evergreen" && (
                <Badge className="text-[10px] px-1.5 py-0 font-mono bg-cyan-500/10 text-cyan-400 border-cyan-500/20 border">
                  ANALYSIS
                </Badge>
              )}
              {post.tags && post.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs text-slate-500 font-['IBM_Plex_Mono']">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
              {post.title}
            </h1>
            {post.subtitle && (
              <p className="text-slate-400 text-base mb-6 leading-relaxed">{post.subtitle}</p>
            )}

            {/* Byline */}
            <div className="flex items-center gap-4 text-xs text-slate-500 font-['IBM_Plex_Mono'] pb-6 mb-8 border-b border-white/5">
              <span>{post.author}</span>
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {formatDate(post.publishedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {readingTime(post.content)} MIN READ
              </span>
              {(post.viewCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 ml-auto">
                  <Eye className="w-3 h-3" />
                  {(post.viewCount ?? 0).toLocaleString()} VIEWS
                </span>
              )}
            </div>

            {/* Content */}
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:font-bold prose-headings:text-white prose-headings:font-['Space_Grotesk']
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
              prose-strong:text-white
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-cyan-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded prose-code:text-xs
              prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
              prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-400
              prose-ul:text-slate-300 prose-ol:text-slate-300
              prose-li:mb-1
              prose-hr:border-white/10">
              <Streamdown>{post.content}</Streamdown>
            </div>

            {/* ── Related Posts (evergreen only) ─────────────────── */}
            {post.contentClass === "evergreen" && relatedPosts.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/5">
                <div className="flex items-center gap-2 mb-5">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-['IBM_Plex_Mono'] text-slate-300 uppercase tracking-widest">
                    Related Analysis
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {relatedPosts.map(rp => (
                    <Link key={rp.id} href={`/blog/${rp.slug}`}>
                      <div className="group p-4 rounded border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/20 transition-all cursor-pointer">
                        <p className="text-xs text-cyan-400/60 font-['IBM_Plex_Mono'] mb-1.5">
                          {rp.category?.toUpperCase()}
                        </p>
                        <h3 className="text-sm text-white leading-snug group-hover:text-cyan-400 transition-colors line-clamp-3">
                          {rp.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-2 font-['IBM_Plex_Mono']">
                          {formatDate(rp.publishedAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── Intel Record archive CTA ─────────────────────── */}
            {post.contentClass === "intel_record" && (
              <div className="mt-12 pt-8 border-t border-white/5">
                <div className="flex items-start gap-4 p-5 rounded border border-amber-500/15 bg-amber-500/[0.03]">
                  <Archive className="w-5 h-5 text-amber-400/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-300 mb-1 font-medium">Intelligence Archive</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                      This record is part of FAULTLINE's daily intelligence history — a transparent log of how the model
                      read macro conditions at each date. Browse the full archive to trace regime shifts and pressure
                      index evolution over time.
                    </p>
                    <Link href="/intel-archive">
                      <span className="text-xs text-amber-400 font-['IBM_Plex_Mono'] hover:underline cursor-pointer flex items-center gap-1">
                        BROWSE FULL ARCHIVE <ChevronRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
              <Link href="/blog">
                <span className="flex items-center gap-1 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-cyan-400 transition-colors cursor-pointer">
                  <ArrowLeft className="w-3 h-3" /> ALL BRIEFINGS
                </span>
              </Link>
              <Link href="/pressure-index">
                <span className="flex items-center gap-1 text-xs text-cyan-400 font-['IBM_Plex_Mono'] hover:underline cursor-pointer">
                  VIEW LIVE PRESSURE INDEX <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
