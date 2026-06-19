import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { Streamdown } from "streamdown";
import { CalendarDays, Clock, ArrowLeft, Tag, ChevronRight, Eye } from "lucide-react";

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

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, error } = trpc.blog.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  const incrementView = trpc.blog.incrementViewCount.useMutation();

  // Fire view count increment once when post loads
  useEffect(() => {
    if (post?.slug) {
      incrementView.mutate({ slug: post.slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.slug]);

  // Dynamic SEO — title, description, canonical, OG, Twitter
  useEffect(() => {
    if (post) {
      const fullTitle = `${post.title} | FAULTLINE`;
      const desc = post.subtitle ?? post.title;
      const canonicalUrl = `https://getfaultline.live/blog/${post.slug}`;

      document.title = fullTitle;

      const setMeta = (sel: string, val: string) => {
        const el = document.querySelector<HTMLMetaElement>(sel);
        if (el) el.setAttribute("content", val);
      };

      setMeta('meta[name="description"]', desc);
      setMeta('meta[property="og:title"]', fullTitle);
      setMeta('meta[property="og:description"]', desc);
      setMeta('meta[property="og:url"]', canonicalUrl);
      setMeta('meta[name="twitter:title"]', fullTitle);
      setMeta('meta[name="twitter:description"]', desc);

      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) canonical.setAttribute("href", canonicalUrl);

      // Inject BlogPosting JSON-LD structured data
      const existingLd = document.getElementById('blog-post-ld');
      if (existingLd) existingLd.remove();
      const ld = document.createElement('script');
      ld.id = 'blog-post-ld';
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.subtitle ?? post.title,
        "url": canonicalUrl,
        "datePublished": post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
        "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
        "author": {
          "@type": "Organization",
          "name": "FAULTLINE",
          "url": "https://getfaultline.live"
        },
        "publisher": {
          "@type": "Organization",
          "name": "FAULTLINE",
          "url": "https://getfaultline.live",
          "logo": {
            "@type": "ImageObject",
            "url": "https://getfaultline.live/favicon-32x32.png"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": canonicalUrl
        },
        ...(post.category ? { "articleSection": post.category } : {}),
        ...(post.tags ? { "keywords": post.tags } : {})
      });
      document.head.appendChild(ld);
    }
    return () => {
      document.title = "FAULTLINE — Market Risk Intelligence Platform";
      const ld = document.getElementById('blog-post-ld');
      if (ld) ld.remove();
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
          <Link href="/blog">
            <span className="flex items-center gap-1 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-cyan-400 transition-colors cursor-pointer">
              <ArrowLeft className="w-3 h-3" /> ALL BRIEFINGS
            </span>
          </Link>
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
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(post.category)}`}>
                {post.category.toUpperCase()}
              </span>
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

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
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
