/**
 * Daily Brief Article Detail — /daily-brief/:slug
 *
 * Full article view for a single Daily Intelligence Brief.
 * Full SEO: Article JSON-LD schema, Open Graph, canonical URL.
 */
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ChevronLeft, ChevronRight, Shield, Rss, ExternalLink } from "lucide-react";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getPressureColor(score: number | null): string {
  if (score == null) return "#6B7280";
  if (score >= 7) return "#FF4444";
  if (score >= 5) return "#FF9500";
  return "#00FF88";
}

function getPressureLabel(score: number | null): string {
  if (score == null) return "Unknown";
  if (score >= 7) return "HIGH PRESSURE";
  if (score >= 5) return "ELEVATED";
  return "LOW PRESSURE";
}

export default function DailyBriefPost() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";

  const { data: item, isLoading } = trpc.organicContent.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  useSEO({
    title: item ? `${item.title} | FAULTLINE Daily Brief` : "Daily Intelligence Brief | FAULTLINE",
    description: item?.metaDescription ?? "FAULTLINE Daily Intelligence Brief — institutional-grade macro analysis from live engine data.",
    canonical: `https://getfaultline.live/daily-brief/${slug}`,
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
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', width: `${70 + Math.random() * 30}%` }} />
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
          <p style={{ color: '#6B7280', marginBottom: '1rem' }}>Brief not found.</p>
          <Link href="/daily-brief">
            <Button variant="outline" size="sm">← Back to Daily Briefs</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Parse internalLinks if present
  let internalLinks: { text: string; url: string }[] = [];
  try {
    if (item.internalLinksJson) {
      internalLinks = JSON.parse(item.internalLinksJson);
    }
  } catch { /* ignore */ }

  // Parse schema JSON for Article structured data
  let schemaData: Record<string, unknown> = {};
  try {
    if (item.schemaJson) schemaData = JSON.parse(item.schemaJson);
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
    "url": `https://getfaultline.live/daily-brief/${item.slug}`,
    ...schemaData,
  };

  return (
    <div className="min-h-screen" style={{ background: '#050608', color: '#F1F5F9' }}>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* ── Breadcrumb nav ──────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>
            <Link href="/" className="hover:text-cyan-400 transition-colors">HOME</Link>
            <ChevronRight style={{ width: 12, height: 12 }} />
            <Link href="/daily-brief" className="hover:text-cyan-400 transition-colors">DAILY BRIEFS</Link>
            <ChevronRight style={{ width: 12, height: 12 }} />
            <span style={{ color: '#94A3B8' }} className="truncate">{item.title.slice(0, 40)}…</span>
          </div>
        </div>
      </div>

      {/* ── Article header ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,20,30,0.8) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        paddingTop: '3rem',
        paddingBottom: '2.5rem',
      }}>
        <div className="max-w-3xl mx-auto px-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider"
              style={{ borderColor: 'rgba(0,212,255,0.3)', color: '#00D4FF', background: 'rgba(0,212,255,0.08)' }}
            >
              Daily Intelligence Brief
            </Badge>
            {item.regime && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 font-mono"
                style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94A3B8' }}
              >
                {item.regime}
              </Badge>
            )}
            {item.pressureScore != null && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 font-mono uppercase"
                style={{
                  borderColor: `${getPressureColor(item.pressureScore)}30`,
                  color: getPressureColor(item.pressureScore),
                  background: `${getPressureColor(item.pressureScore)}08`,
                }}
              >
                {getPressureLabel(item.pressureScore)} · PI {item.pressureScore.toFixed(1)}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
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
                <span>{Math.ceil(item.wordCount / 200)} min read</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Shield style={{ width: 13, height: 13 }} />
              <span>FAULTLINE Engine</span>
            </div>
          </div>

          {/* Meta description */}
          {item.metaDescription && (
            <p style={{
              marginTop: '1.25rem',
              color: '#94A3B8',
              fontSize: '1rem',
              lineHeight: 1.7,
              borderLeft: '3px solid rgba(0,212,255,0.4)',
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
            '--tw-prose-quote-borders': 'rgba(0,212,255,0.4)',
            '--tw-prose-code': '#00D4FF',
            '--tw-prose-pre-bg': 'rgba(0,212,255,0.05)',
            lineHeight: 1.8,
            fontSize: '0.95rem',
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: item.content ?? "<p>Content not available.</p>" }}
        />

        {/* ── Internal links ──────────────────────────────────── */}
        {internalLinks.length > 0 && (
          <div style={{
            marginTop: '2.5rem',
            padding: '1.25rem',
            borderRadius: 8,
            border: '1px solid rgba(0,212,255,0.12)',
            background: 'rgba(0,212,255,0.03)',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>
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

        {/* ── CTA ─────────────────────────────────────────────── */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          borderRadius: 8,
          border: '1px solid rgba(0,212,255,0.15)',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.05) 0%, rgba(0,0,0,0) 100%)',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>
            FAULTLINE Intelligence Platform
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '0.5rem' }}>
            Access Live Market Intelligence
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem', maxWidth: 400, margin: '0 auto 1.25rem' }}>
            Get real-time pressure scores, regime analysis, and AI-powered market intelligence — updated continuously.
          </p>
          <Link href="/app/discover">
            <button style={{
              padding: '10px 28px',
              background: 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.35)',
              borderRadius: 6,
              color: '#00D4FF',
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
          <Link href="/daily-brief">
            <button className="flex items-center gap-2 text-sm transition-colors hover:text-cyan-400" style={{ color: '#6B7280' }}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
              All Daily Briefs
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="/api/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-orange-400"
              style={{ color: '#6B7280' }}
            >
              <Rss style={{ width: 13, height: 13 }} />
              RSS
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
