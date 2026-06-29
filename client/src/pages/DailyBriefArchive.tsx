/**
 * Daily Brief Archive — /daily-brief
 *
 * Public archive of all auto-generated FAULTLINE Daily Intelligence Briefs.
 * Filters organicContent to daily_market_brief content type.
 * Full SEO: Article schema, Open Graph, canonical URL.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, ChevronRight, FileText, Clock, Rss, TrendingUp, Shield, AlertTriangle } from "lucide-react";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPressureColor(score: number | null): string {
  if (score == null) return "#6B7280";
  if (score >= 7) return "#FF4444";
  if (score >= 5) return "#FF9500";
  return "#00FF88";
}

function getPressureLabel(score: number | null): string {
  if (score == null) return "—";
  if (score >= 7) return "HIGH";
  if (score >= 5) return "ELEVATED";
  return "LOW";
}

export default function DailyBriefArchive() {
  useSEO({
    title: "Daily Intelligence Briefs | FAULTLINE — Institutional Market Analysis",
    description:
      "FAULTLINE's automated Daily Intelligence Briefs — institutional-grade macro analysis generated from live engine data every market day. Regime, pressure, opportunities, and risks.",
    canonical: "https://getfaultline.live/daily-brief",
  });

  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const queryInput = useMemo(() => ({
    contentType: "daily_market_brief",
    limit: LIMIT,
    offset,
  }), [offset]);

  const { data, isLoading } = trpc.organicContent.listPublished.useQuery(queryInput);

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const q = search.toLowerCase();
    return data.items.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.metaDescription ?? "").toLowerCase().includes(q) ||
      (p.regime ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,20,30,0.95) 0%, rgba(5,6,8,0.98) 100%)',
        borderBottom: '1px solid rgba(0,212,255,0.15)',
      }}>
        <div className="max-w-5xl mx-auto px-4 py-14">
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText style={{ width: 20, height: 20, color: '#00D4FF' }} />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.15em', color: '#6B7280', textTransform: 'uppercase' }}>
                FAULTLINE INTELLIGENCE
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#00D4FF' }}>
                Daily Brief Archive
              </div>
            </div>
          </div>

          <h1 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#F1F5F9',
            marginBottom: '0.75rem',
            lineHeight: 1.2,
          }}>
            Daily Intelligence Briefs
          </h1>
          <p style={{ color: '#94A3B8', maxWidth: 600, lineHeight: 1.7, fontSize: '0.95rem' }}>
            Every market day, FAULTLINE's autonomous engine collects live macro, liquidity, credit, and volatility data
            and generates an institutional-grade intelligence brief — validated for accuracy before publishing.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
              <Clock style={{ width: 14, height: 14 }} />
              <span>Published daily at market open</span>
            </div>
            <span style={{ color: '#374151' }}>·</span>
            <a
              href="/api/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm transition-colors hover:text-orange-400"
              style={{ color: '#6B7280' }}
            >
              <Rss style={{ width: 14, height: 14 }} />
              RSS Feed
            </a>
            <span style={{ color: '#374151' }}>·</span>
            <Link href="/intel-archive" className="text-sm transition-colors hover:text-cyan-400" style={{ color: '#6B7280' }}>
              Full Archive →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-6">
            {[
              { icon: FileText, label: "Total Briefs", value: data?.total?.toLocaleString() ?? "—" },
              { icon: TrendingUp, label: "Coverage", value: "Every Market Day" },
              { icon: Shield, label: "Validation", value: "AI + Confidence Score" },
              { icon: AlertTriangle, label: "Data Guard", value: "No Fabrication Policy" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon style={{ width: 14, height: 14, color: '#00D4FF' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#94A3B8' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="relative max-w-sm">
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#6B7280' }} />
            <Input
              placeholder="Search briefs…"
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0); }}
              className="pl-9 h-9 text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9' }}
            />
          </div>
        </div>
      </div>

      {/* ── Brief list ──────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#6B7280' }}>
            <FileText style={{ width: 40, height: 40, margin: '0 auto 1rem', opacity: 0.3 }} />
            <p className="text-sm">No briefs published yet. The first brief will appear here after the automated pipeline runs.</p>
            <p className="text-xs mt-2" style={{ color: '#4B5563' }}>
              Briefs are generated automatically every market day at open.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#4B5563', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {filtered.length} brief{filtered.length !== 1 ? "s" : ""} {search ? "matching search" : "published"}
            </p>

            <div className="space-y-2">
              {filtered.map(item => (
                <Link
                  key={item.id}
                  href={`/daily-brief/${item.slug}`}
                  className="group flex items-start gap-4 p-5 rounded-lg transition-all duration-150"
                  style={{
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.2)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  }}
                >
                  {/* Date column */}
                  <div style={{ flexShrink: 0, width: 72, textAlign: 'right' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280' }}>
                      {formatDateShort(item.publishedAt)}
                    </div>
                    {item.pressureScore != null && (
                      <div style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 9,
                        color: getPressureColor(item.pressureScore),
                        marginTop: 2,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}>
                        PI {item.pressureScore.toFixed(1)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {item.regime && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono"
                          style={{ borderColor: 'rgba(0,212,255,0.2)', color: '#00D4FF', background: 'rgba(0,212,255,0.05)' }}
                        >
                          {item.regime}
                        </Badge>
                      )}
                      {item.pressureScore != null && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono"
                          style={{
                            borderColor: `${getPressureColor(item.pressureScore)}30`,
                            color: getPressureColor(item.pressureScore),
                            background: `${getPressureColor(item.pressureScore)}10`,
                          }}
                        >
                          {getPressureLabel(item.pressureScore)}
                        </Badge>
                      )}
                    </div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F1F5F9', lineHeight: 1.4, marginBottom: 4 }}
                      className="group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    {item.metaDescription && (
                      <p style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5 }} className="line-clamp-2">
                        {item.metaDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4B5563' }}>
                        {formatDate(item.publishedAt)}
                      </span>
                      {item.wordCount && (
                        <>
                          <span style={{ color: '#374151' }}>·</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4B5563' }}>
                            {Math.ceil(item.wordCount / 200)} min read
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronRight style={{ flexShrink: 0, width: 16, height: 16, color: '#374151', marginTop: 2 }}
                    className="group-hover:text-cyan-400 transition-colors" />
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {(data?.total ?? 0) > LIMIT && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  className="text-xs"
                >
                  ← Previous
                </Button>
                <span className="text-xs" style={{ color: '#6B7280' }}>
                  Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil((data?.total ?? 0) / LIMIT)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + LIMIT >= (data?.total ?? 0)}
                  onClick={() => setOffset(offset + LIMIT)}
                  className="text-xs"
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.1)', background: 'rgba(0,212,255,0.03)', marginTop: '2rem' }}>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '0.75rem' }}>
            Get Daily Briefs Delivered
          </h2>
          <p style={{ color: '#94A3B8', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
            Pro and Founding members receive the Daily Intelligence Brief by email every market morning before open.
          </p>
          <Link href="/">
            <button style={{
              padding: '10px 28px',
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 6,
              color: '#00D4FF',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.15s ease',
            }}>
              View Plans →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
