/**
 * Intelligence Library — /intelligence-library
 *
 * Premium evergreen content hub organized by 15 institutional categories.
 * SEO: Article schema, Open Graph, canonical URL, internal linking.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, BookOpen, TrendingUp, Shield, Brain, BarChart2,
  Bitcoin, Globe, Activity, Zap, Clock, ChevronRight, Layers,
  AlertTriangle, DollarSign, Target, RotateCcw,
} from "lucide-react";

const CATEGORIES = [
  { id: "macro-analysis",        label: "Macro Analysis",          icon: Globe,         color: "#00D4FF", desc: "Global economic forces, Fed policy, and macro regime analysis" },
  { id: "market-cycles",         label: "Market Cycles",           icon: RotateCcw,     color: "#A78BFA", desc: "Bull and bear market identification, cycle timing, and regime transitions" },
  { id: "recession-indicators",  label: "Recession Indicators",    icon: AlertTriangle, color: "#FF9500", desc: "Leading indicators, yield curve, and recession probability frameworks" },
  { id: "ai-investing",          label: "AI & Technology",         icon: Brain,         color: "#00FF88", desc: "AI sector analysis, concentration risk, and technology market dynamics" },
  { id: "crypto-cycles",         label: "Crypto Cycles",           icon: Bitcoin,       color: "#F59E0B", desc: "Bitcoin cycles, altcoin rotation, and on-chain market intelligence" },
  { id: "risk-management",       label: "Risk Management",         icon: Shield,        color: "#EF4444", desc: "Portfolio protection, drawdown management, and position sizing" },
  { id: "liquidity-analysis",    label: "Liquidity & Credit",      icon: Activity,      color: "#06B6D4", desc: "Market liquidity conditions, credit spreads, and financial stress" },
  { id: "volatility",            label: "Volatility",              icon: Zap,           color: "#F97316", desc: "VIX analysis, volatility regimes, and options market intelligence" },
  { id: "institutional-flows",   label: "Institutional Flows",     icon: BarChart2,     color: "#8B5CF6", desc: "ETF flows, positioning data, and institutional market behavior" },
  { id: "trading-psychology",    label: "Trading Psychology",      icon: Target,        color: "#EC4899", desc: "Behavioral finance, sentiment analysis, and decision-making frameworks" },
  { id: "federal-reserve",       label: "Federal Reserve",         icon: DollarSign,    color: "#10B981", desc: "Fed policy analysis, rate cycles, and monetary policy impact" },
  { id: "sector-rotation",       label: "Sector Rotation",         icon: Layers,        color: "#6366F1", desc: "Sector leadership cycles, rotation signals, and relative strength" },
  { id: "market-structure",      label: "Market Structure",        icon: TrendingUp,    color: "#14B8A6", desc: "Market breadth, technical structure, and price action analysis" },
  { id: "geopolitical-risk",     label: "Geopolitical Risk",       icon: Globe,         color: "#F43F5E", desc: "Global risk events, geopolitical impact on markets, and safe havens" },
  { id: "investing-frameworks",  label: "Investing Frameworks",    icon: BookOpen,      color: "#84CC16", desc: "Evidence-based investing, probability thinking, and decision models" },
];

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function IntelligenceLibrary() {
  useSEO({
    title: "Intelligence Library | FAULTLINE — Institutional Market Research & Analysis",
    description:
      "FAULTLINE's Intelligence Library — 15 categories of institutional-grade market research covering macro analysis, market cycles, recession indicators, AI investing, crypto cycles, risk management, and more.",
    canonical: "https://getfaultline.live/intelligence-library",
  });

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const queryInput = useMemo(() => ({
    contentType: "evergreen_article",
    limit: 50,
    offset: 0,
  }), []);

  const { data, isLoading } = trpc.organicContent.listPublished.useQuery(queryInput);

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items;
    if (activeCategory) {
      items = items.filter(p => p.regime === activeCategory || (p.metaDescription ?? "").toLowerCase().includes(activeCategory.replace(/-/g, " ")));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.metaDescription ?? "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, activeCategory, search]);

  return (
    <div className="min-h-screen" style={{ background: '#050608', color: '#F1F5F9' }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,20,30,0.95) 0%, rgba(5,6,8,0.98) 100%)',
        borderBottom: '1px solid rgba(0,212,255,0.12)',
      }}>
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen style={{ width: 20, height: 20, color: '#00D4FF' }} />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.15em', color: '#6B7280', textTransform: 'uppercase' }}>
                FAULTLINE INTELLIGENCE
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#00D4FF' }}>
                Research Library
              </div>
            </div>
          </div>

          <h1 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: '#F1F5F9',
            marginBottom: '0.75rem',
            lineHeight: 1.15,
          }}>
            Intelligence Library
          </h1>
          <p style={{ color: '#94A3B8', maxWidth: 560, lineHeight: 1.7, fontSize: '0.95rem' }}>
            Institutional-grade research across 15 categories — macro analysis, market cycles, recession indicators,
            AI investing, crypto, risk management, and more. Written to FAULTLINE methodology standards.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
              <BookOpen style={{ width: 14, height: 14 }} />
              <span>{data?.total ?? "—"} articles published</span>
            </div>
            <span style={{ color: '#374151' }}>·</span>
            <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
              <Clock style={{ width: 14, height: 14 }} />
              <span>Updated continuously</span>
            </div>
            <span style={{ color: '#374151' }}>·</span>
            <Link href="/daily-brief" className="text-sm transition-colors hover:text-cyan-400" style={{ color: '#6B7280' }}>
              Daily Briefs →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Category grid ────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1rem' }}>
            Browse by Category
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: `1px solid ${activeCategory === null ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                background: activeCategory === null ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                color: activeCategory === null ? '#00D4FF' : '#6B7280',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.08em',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                textTransform: 'uppercase',
              }}
            >
              All Articles
            </button>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(isActive ? null : cat.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: `1px solid ${isActive ? `${cat.color}40` : 'rgba(255,255,255,0.06)'}`,
                    background: isActive ? `${cat.color}0D` : 'rgba(255,255,255,0.02)',
                    color: isActive ? cat.color : '#6B7280',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon style={{ width: 11, height: 11, flexShrink: 0 }} />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Search + articles ────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#6B7280' }} />
          <Input
            placeholder="Search articles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9' }}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#6B7280' }}>
            <BookOpen style={{ width: 40, height: 40, margin: '0 auto 1rem', opacity: 0.3 }} />
            <p className="text-sm">
              {data?.total === 0
                ? "No articles published yet. The Intelligence Library will populate as content is generated."
                : "No articles match your search."}
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#4B5563', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {filtered.length} article{filtered.length !== 1 ? "s" : ""}
              {activeCategory ? ` in ${CATEGORIES.find(c => c.id === activeCategory)?.label ?? activeCategory}` : ""}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(item => {
                const catMatch = CATEGORIES.find(c => c.id === item.regime);
                const catColor = catMatch?.color ?? "#6B7280";
                return (
                  <Link
                    key={item.id}
                    href={`/intelligence-library/${item.slug}`}
                    className="group block rounded-lg transition-all duration-150"
                    style={{
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '1.25rem',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = `${catColor}08`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${catColor}25`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    }}
                  >
                    {/* Category badge */}
                    {catMatch && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <catMatch.icon style={{ width: 12, height: 12, color: catColor }} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: catColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                          {catMatch.label}
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F1F5F9', lineHeight: 1.4, marginBottom: '0.5rem' }}
                      className="group-hover:text-cyan-400 transition-colors line-clamp-3">
                      {item.title}
                    </h3>

                    {/* Description */}
                    {item.metaDescription && (
                      <p style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5 }} className="line-clamp-2 mb-3">
                        {item.metaDescription}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4B5563' }}>
                          {formatDate(item.publishedAt)}
                        </span>
                        {item.wordCount && (
                          <>
                            <span style={{ color: '#374151' }}>·</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4B5563' }}>
                              {Math.ceil(item.wordCount / 200)}m
                            </span>
                          </>
                        )}
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, color: '#374151' }}
                        className="group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Category showcase (when no filter active) ────────────── */}
      {!activeCategory && !search && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '2rem' }}>
          <div className="max-w-6xl mx-auto px-4 py-10">
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1.5rem' }}>
              15 Research Categories
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className="group text-left p-4 rounded-lg transition-all duration-150"
                    style={{
                      border: '1px solid rgba(255,255,255,0.05)',
                      background: 'rgba(255,255,255,0.015)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = `${cat.color}08`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}25`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)';
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon style={{ width: 16, height: 16, color: cat.color }} />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#F1F5F9' }}>{cat.label}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.5 }}>{cat.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.08)', background: 'rgba(0,212,255,0.02)', marginTop: '2rem' }}>
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '0.75rem' }}>
            Apply This Research in Real Time
          </h2>
          <p style={{ color: '#94A3B8', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.7, fontSize: '0.9rem' }}>
            Ask FAULTLINE any market question and get an institutional-grade answer grounded in live engine data and this research library.
          </p>
          <Link href="/app/discover">
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
              Ask FAULTLINE →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
