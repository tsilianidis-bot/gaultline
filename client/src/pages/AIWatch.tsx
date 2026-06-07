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
              {item.timestamp}
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

  // AI bubble metrics
  const aiMetrics = [
    { label: 'Total AI Capex 2024', value: '$214B', color: '#FF9500', delta: '+42% YoY' },
    { label: 'AI Concentration (S&P)', value: '32.4%', color: '#FF2D55', delta: '+1.8%' },
    { label: 'Hyperscaler GPU Orders', value: '2.4M', color: '#FF9500', delta: '+180% YoY' },
    { label: 'AI Startup Valuations', value: '$890B', color: '#FFD700', delta: '+65% YoY' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#050608', maxWidth: '800px', margin: '0 auto' }}>
      <PageHeader
        title="AI Sector Watch"
        subtitle="AI-generated intelligence feed tracking sector trends, company headlines, and market impact signals."
        badge="AI-GENERATED"
        badgeColor="blue"
      />
      <div style={{ padding: '20px 16px 24px' }}>

      {/* AI Bubble metrics */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
        marginBottom: '16px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 60ms both',
      }}>
        {aiMetrics.map((m, i) => (
          <div key={i} style={{
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
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF9500', marginTop: '2px' }}>
              {m.delta}
            </div>
          </div>
        ))}
      </div>

      {/* AI Bubble risk indicator */}
      <div style={{
        background: 'rgba(255, 45, 85, 0.05)',
        border: '1px solid rgba(255, 45, 85, 0.2)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 120ms both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF2D55', boxShadow: '0 0 8px rgba(255,45,85,0.8)', animation: 'blink-alert 1.2s ease-in-out infinite' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF2D55', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            AI Bubble Risk: CRITICAL — 8.6/10
          </span>
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
          AI/mega-cap concentration has reached 32.4% of S&P 500 — the highest single-sector concentration in US market history, exceeding both the Nifty Fifty era and the 2000 Dot-com peak. Hyperscaler capex growth rate exceeds the 1999 fiber optic buildout at peak. ROI remains unproven at scale.
        </p>
      </div>

      {/* Category filter */}
      <div style={{ overflowX: 'auto', marginBottom: '12px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) 160ms both' }}>
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
      </div>

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
