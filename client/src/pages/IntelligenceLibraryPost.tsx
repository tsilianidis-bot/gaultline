/**
 * Intelligence Library Article Detail — /intelligence-library/:slug
 *
 * Full article view for an evergreen intelligence article.
 * Full SEO: Article JSON-LD schema, FAQ schema, Open Graph, canonical URL.
 */
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, ChevronLeft, ChevronRight, BookOpen,
  ExternalLink, Share2, TrendingUp,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "macro-analysis": "#00D4FF",
  "market-cycles": "#A78BFA",
  "recession-indicators": "#FF9500",
  "ai-investing": "#00FF88",
  "crypto-cycles": "#F59E0B",
  "risk-management": "#EF4444",
  "liquidity-analysis": "#06B6D4",
  "volatility": "#F97316",
  "institutional-flows": "#8B5CF6",
  "trading-psychology": "#EC4899",
  "federal-reserve": "#10B981",
  "sector-rotation": "#6366F1",
  "market-structure": "#14B8A6",
  "geopolitical-risk": "#F43F5E",
  "investing-frameworks": "#84CC16",
};

const CATEGORY_LABELS: Record<string, string> = {
  "macro-analysis": "Macro Analysis",
  "market-cycles": "Market Cycles",
  "recession-indicators": "Recession Indicators",
  "ai-investing": "AI & Technology",
  "crypto-cycles": "Crypto Cycles",
  "risk-management": "Risk Management",
  "liquidity-analysis": "Liquidity & Credit",
  "volatility": "Volatility",
  "institutional-flows": "Institutional Flows",
  "trading-psychology": "Trading Psychology",
  "federal-reserve": "Federal Reserve",
  "sector-rotation": "Sector Rotation",
  "market-structure": "Market Structure",
  "geopolitical-risk": "Geopolitical Risk",
  "investing-frameworks": "Investing Frameworks",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function IntelligenceLibraryPost() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";

  const { data: item, isLoading } = trpc.organicContent.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  useSEO({
    title: item ? `${item.title} | FAULTLINE Intelligence Library` : "Intelligence Library | FAULTLINE",
    description: item?.metaDescription ?? "Institutional-grade market research from FAULTLINE.",
    canonical: `https://getfaultline.live/intelligence-library/${slug}`,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: '#050608' }}>
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="space-y-4">
            <div className="h-6 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-10 w-3/4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-4 w-1/2 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="space-y-3 mt-8">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', width: `${65 + Math.random() * 35}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050608' }}>
        <div className="text-center">
          <p style={{ color: '#6B7280', marginBottom: '1rem' }}>Article not found.</p>
          <Link href="/intelligence-library">
            <Button variant="outline" size="sm">← Back to Intelligence Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  const catColor = (item.regime && CATEGORY_COLORS[item.regime]) ? CATEGORY_COLORS[item.regime] : "#00D4FF";
  const catLabel = (item.regime && CATEGORY_LABELS[item.regime]) ? CATEGORY_LABELS[item.regime] : item.regime ?? "Research";

  // Parse internalLinks
  let internalLinks: { text: string; url: string }[] = [];
  try {
    if (item.internalLinksJson) internalLinks = JSON.parse(item.internalLinksJson);
  } catch { /* ignore */ }

  // Parse schemaJson
  let extraSchema: Record<string, unknown> = {};
  try {
    if (item.schemaJson) extraSchema = JSON.parse(item.schemaJson);
  } catch { /* ignore */ }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": item.title,
    "description": item.metaDescription,
    "datePublished": item.publishedAt,
    "author": { "@type": "Organization", "name": "FAULTLINE" },
    "publisher": {
      "@type": "Organization",
      "name": "FAULTLINE",
      "url": "https://getfaultline.live",
    },
    "url": `https://getfaultline.live/intelligence-library/${item.slug}`,
    "articleSection": catLabel,
    ...extraSchema,
  };

  return (
    <div className="min-h-screen" style={{ background: '#050608', color: '#F1F5F9' }}>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>
            <Link href="/" className="hover:text-cyan-400 transition-colors">HOME</Link>
            <ChevronRight style={{ width: 12, height: 12 }} />
            <Link href="/intelligence-library" className="hover:text-cyan-400 transition-colors">INTELLIGENCE LIBRARY</Link>
            <ChevronRight style={{ width: 12, height: 12 }} />
            <span style={{ color: catColor }}>{catLabel.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* ── Article header ──────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(180deg, ${catColor}08 0%, transparent 100%)`,
        borderBottom: `1px solid ${catColor}12`,
        paddingTop: '3rem',
        paddingBottom: '2.5rem',
      }}>
        <div className="max-w-3xl mx-auto px-4">
          {/* Category badge */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider"
              style={{ borderColor: `${catColor}40`, color: catColor, background: `${catColor}0D` }}
            >
              {catLabel}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 font-mono"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#6B7280' }}
            >
              Intelligence Library
            </Badge>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
            color: '#F1F5F9',
            marginBottom: '1rem',
          }}>
            {item.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: '#6B7280' }}>
            <div className="flex items-center gap-1.5">
              <Calendar style={{ width: 13, height: 13 }} />
              <span>{formatDate(item.publishedAt)}</span>
            </div>
            {item.wordCount && (
              <div className="flex items-center gap-1.5">
                <Clock style={{ width: 13, height: 13 }} />
                <span>{Math.ceil(item.wordCount / 200)} min read · {item.wordCount.toLocaleString()} words</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <BookOpen style={{ width: 13, height: 13 }} />
              <span>FAULTLINE Research</span>
            </div>
          </div>

          {/* Lead */}
          {item.metaDescription && (
            <p style={{
              marginTop: '1.25rem',
              color: '#94A3B8',
              fontSize: '1.05rem',
              lineHeight: 1.75,
              borderLeft: `3px solid ${catColor}60`,
              paddingLeft: '1rem',
              fontStyle: 'italic',
            }}>
              {item.metaDescription}
            </p>
          )}
        </div>
      </div>

      {/* ── Article body ────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <article
          className="prose prose-invert max-w-none"
          style={{
            '--tw-prose-body': '#CBD5E1',
            '--tw-prose-headings': '#F1F5F9',
            '--tw-prose-lead': '#94A3B8',
            '--tw-prose-links': '#00D4FF',
            '--tw-prose-bold': '#F1F5F9',
            '--tw-prose-counters': '#6B7280',
            '--tw-prose-bullets': '#374151',
            '--tw-prose-hr': '#1F2937',
            '--tw-prose-quotes': '#94A3B8',
            '--tw-prose-quote-borders': `${catColor}60`,
            '--tw-prose-code': catColor,
            '--tw-prose-pre-bg': `${catColor}08`,
            lineHeight: 1.85,
            fontSize: '0.95rem',
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: item.content ?? "<p>Content not available.</p>" }}
        />

        {/* ── Quality score ────────────────────────────────────── */}
        {item.qualityScore != null && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem 1.25rem',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <TrendingUp style={{ width: 14, height: 14, color: '#00D4FF', flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Content Quality Score
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#00D4FF' }}>
              {item.qualityScore}/100
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4B5563', marginLeft: 'auto' }}>
              FAULTLINE Methodology
            </span>
          </div>
        )}

        {/* ── Internal links ───────────────────────────────────── */}
        {internalLinks.length > 0 && (
          <div style={{
            marginTop: '2.5rem',
            padding: '1.25rem',
            borderRadius: 8,
            border: `1px solid ${catColor}18`,
            background: `${catColor}05`,
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: catColor, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>
              Related Tools & Analysis
            </div>
            <div className="flex flex-wrap gap-2">
              {internalLinks.map((link, i) => (
                <Link key={i} href={link.url}>
                  <button
                    className="flex items-center gap-1.5 text-xs transition-colors hover:text-cyan-400"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      color: '#94A3B8',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    <ExternalLink style={{ width: 11, height: 11 }} />
                    {link.text}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Share ────────────────────────────────────────────── */}
        <div style={{
          marginTop: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Share2 style={{ width: 14, height: 14, color: '#6B7280' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Share
          </span>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: item.title, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: '#94A3B8',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Copy Link
          </button>
        </div>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          borderRadius: 8,
          border: `1px solid ${catColor}20`,
          background: `linear-gradient(135deg, ${catColor}06 0%, rgba(0,0,0,0) 100%)`,
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: catColor, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>
            Apply This Research
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '0.5rem' }}>
            Ask FAULTLINE About {catLabel}
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem', maxWidth: 400, margin: '0 auto 1.25rem' }}>
            Get real-time analysis grounded in live engine data and this research library.
          </p>
          <Link href="/app/discover">
            <button style={{
              padding: '10px 28px',
              background: `${catColor}15`,
              border: `1px solid ${catColor}40`,
              borderRadius: 6,
              color: catColor,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.15s ease',
            }}>
              Ask FAULTLINE →
            </button>
          </Link>
        </div>

        {/* ── Navigation ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/intelligence-library">
            <button className="flex items-center gap-2 text-sm transition-colors hover:text-cyan-400" style={{ color: '#6B7280' }}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
              Intelligence Library
            </button>
          </Link>
          <Link href="/daily-brief" className="text-sm transition-colors hover:text-cyan-400" style={{ color: '#6B7280' }}>
            Daily Briefs →
          </Link>
        </div>
      </div>
    </div>
  );
}
