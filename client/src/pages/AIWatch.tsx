/* ============================================================
   FAULTLINE — AI Watch Page
   Live AI intelligence feed: companies, headlines, risk interpretation,
   sentiment analysis, market impact
   ============================================================ */
import { useState } from "react";
import { aiWatchItems, AIWatchItem } from "@/lib/data";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { EarlyWarningPresentationPanel } from "@/components/EarlyWarningPresentationPanel";
import { trpc } from "@/lib/trpc";
import { formatEt } from "@shared/credibilityLabels";
import { aiWatchTiles, selectAiBubbleRisk, AI_CONCENTRATION_STATIC_BASELINE_PCT } from "@/lib/aiWatchMetrics";

const sentimentConfig = {
  bullish: { color: '#00FF88', label: 'BULLISH', icon: TrendingUp },
  bearish: { color: '#FF2D55', label: 'BEARISH', icon: TrendingDown },
  neutral: { color: '#00D4FF', label: 'NEUTRAL', icon: Minus },
  warning: { color: '#FF9500', label: 'WARNING', icon: AlertTriangle },
};

const impactConfig = {
  high: { color: '#FF2D55', label: 'HIGH IMPACT' },
  medium: { color: '#FF9500', label: 'MED IMPACT' },
  low: { color: '#00D4FF', label: 'LOW IMPACT' },
};

const categories = ['All', 'Chip Wars', 'Speculation', 'Earnings', 'Regulation', 'Competition', 'Infrastructure', 'Geopolitics'];

const companyColors: Record<string, string> = {
  NVIDIA: '#76B900',
  OpenAI: '#10A37F',
  Microsoft: '#00A4EF',
  Anthropic: '#D4A574',
  Meta: '#1877F2',
  'Google DeepMind': '#4285F4',
  xAI: '#F5F5F5',
  Amazon: '#FF9900',
  'Sovereign AI': '#FFD700',
};

function AIWatchCard({ item, index }: { item: AIWatchItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sentiment = sentimentConfig[item.sentiment];
  const impact = impactConfig[item.marketImpact];
  const SentimentIcon = sentiment.icon;
  const companyColor = companyColors[item.company] || '#6B7280';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: 'rgba(10, 12, 16, 0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `2px solid ${sentiment.color}`,
        borderRadius: '4px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        animation: `fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${index * 50}ms both`,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(17, 19, 24, 0.95)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(10, 12, 16, 0.9)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Company badge */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '4px',
          background: `${companyColor}20`,
          border: `1px solid ${companyColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '9px', color: companyColor, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1 }}>
            {item.company.slice(0, 3)}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '11px', color: companyColor }}>
              {item.company}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '2px' }}>
              {item.category}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginLeft: 'auto' }}>
              {formatEt(item.publishedAt) ?? '—'} · {item.source.name}
            </span>
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#E2E8F0', lineHeight: 1.4, marginBottom: '6px' }}>
            {item.headline}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              background: `${sentiment.color}15`,
              border: `1px solid ${sentiment.color}30`,
              borderRadius: '2px', padding: '2px 6px',
            }}>
              <SentimentIcon size={8} style={{ color: sentiment.color }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: sentiment.color, letterSpacing: '0.1em' }}>
                {sentiment.label}
              </span>
            </div>
            <div style={{
              background: `${impact.color}15`,
              border: `1px solid ${impact.color}30`,
              borderRadius: '2px', padding: '2px 6px',
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: impact.color, letterSpacing: '0.1em' }}>
                {impact.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Risk Interpretation
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
            {item.riskInterpretation}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AIWatch() {
  useSEO(PAGE_SEO.aiWatch);
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? aiWatchItems
    : aiWatchItems.filter(item => item.category === activeCategory);

  // AI tiles: static baseline (labelled) or Not tracked; no invented figures or deltas.
  const aiMetrics = aiWatchTiles().map(t => ({ ...t, color: t.tone === 'baseline' ? '#C084FC' : '#64748B' }));
  // AI / Speculation vector score: canonical Pressure state only, else Unavailable.
  const canonicalQuery = trpc.marketState.canonicalCurrent.useQuery(undefined, { refetchInterval: 60_000, staleTime: 30_000 });
  const aiRisk = selectAiBubbleRisk(canonicalQuery.data ?? null, { isLoading: canonicalQuery.isLoading });

  return (
    <div style={{ minHeight: '100vh', background: '#050608', maxWidth: '800px', margin: '0 auto' }}>
      <PageHeader
        title="AI Sector Watch"
        subtitle="AI sector exposure in the FAULTLINE Pressure Index: the AI / Speculation vector and its static AI-concentration baseline."
        badge="STATIC BASELINE"
        badgeColor="blue"
	  />
	  <div style={{ padding: '20px 16px 24px' }}>
	    <EarlyWarningPresentationPanel mode="watch" />

	  {/* AI Bubble metrics */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
        marginBottom: '16px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 60ms both',
      }}>
        {aiMetrics.map((m) => (
          <div key={m.id} data-ai-watch-tile={m.id} style={{
            background: 'rgba(10, 12, 16, 0.9)',
            border: `1px solid ${m.color}20`,
            borderRadius: '4px',
            padding: '10px',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
              {m.label}
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color: m.color, textShadow: `0 0 12px ${m.color}60`, lineHeight: 1 }}>
              {m.value}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
              {m.note}
            </div>
          </div>
        ))}
      </div>

      {/* AI / Speculation vector: canonical Pressure state with source + ET as-of, else Unavailable */}
      <div data-ai-bubble-risk={aiRisk.available ? 'canonical' : 'unavailable'} style={{
        background: 'rgba(10, 12, 16, 0.9)',
        border: '1px solid rgba(192, 132, 252, 0.2)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 120ms both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: aiRisk.available ? '#C084FC' : '#64748B', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            {aiRisk.label}: {aiRisk.value}
          </span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#64748B', marginBottom: '6px' }}>
          {aiRisk.basis}
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
          FAULTLINE uses a static AI-concentration baseline (~{AI_CONCENTRATION_STATIC_BASELINE_PCT.toFixed(1)}% of the S&amp;P 500, a reference value, not a live measurement) in this vector, adjusted by the live 10Y yield and HY spread. It does not ingest AI capex, GPU-order or AI startup valuation data.
        </p>
      </div>

      {/* No sourced, dated AI headline feed is ingested: say so instead of showing undated items. */}
      {aiWatchItems.length === 0 && (
        <div data-ai-watch-feed="unavailable" style={{
          background: 'rgba(10, 12, 16, 0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
          padding: '12px', marginBottom: '12px',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#64748B', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
            AI Headline Feed · Unavailable
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
            FAULTLINE does not ingest a dated, sourced AI news feed, so no headlines are shown here.
          </p>
        </div>
      )}

      {/* Category filter */}
      {aiWatchItems.length > 0 && <div style={{ overflowX: 'auto', marginBottom: '12px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 160ms both' }}>
        <div style={{ display: 'flex', gap: '4px', paddingBottom: '4px', minWidth: 'max-content' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: '2px',
                border: `1px solid ${activeCategory === cat ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                background: activeCategory === cat ? 'rgba(0,212,255,0.1)' : 'transparent',
                color: activeCategory === cat ? '#00D4FF' : '#6B7280',
                cursor: 'pointer', transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>}

      {/* Intelligence feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((item, i) => (
          <AIWatchCard key={item.id} item={item} index={i} />
        ))}
      </div>

      {/* Company tracker */}
      <div style={{
        marginTop: '16px',
        background: 'rgba(10, 12, 16, 0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px',
        padding: '14px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 600ms both',
      }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
          AI Entity Tracker
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {Object.entries(companyColors).map(([company, color]) => (
            <div key={company} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 8px',
              background: `${color}08`,
              border: `1px solid ${color}20`,
              borderRadius: '3px',
            }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#94A3B8', letterSpacing: '0.05em' }}>
                {company}
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>{/* /padding div */}
    </div>
  );
}
