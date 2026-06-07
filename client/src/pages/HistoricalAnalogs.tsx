/* ============================================================
   FAULTLINE — Historical Analog Engine v3
   Signature feature: cinematic era comparison, live similarity
   scoring, divergence indicators, and institutional narrative.
   ============================================================ */
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, LineChart, Line, ReferenceLine,
} from 'recharts';
import { useEngine } from '@/contexts/EngineContext';
import { getRiskColor } from '@/components/RiskBadge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";

// ── Era data ──────────────────────────────────────────────────
interface HistoricalEra {
  id: string; era: string; year: string; period: string; color: string;
  tagline: string; description: string;
  crisisScores: { treasury: number; inflation: number; credit: number; aiBubble: number; liquidity: number; recession: number; banking: number; };
  keyMetrics: { label: string; value: string; note: string }[];
  outcome: string; peakDrop: string; recoveryMonths: number;
  trajectory: number[]; speculationTrend: number[]; inflationTrend: number[]; liquidityTrend: number[];
  matchIndicators: string[];   // what makes this era match current
  divergeIndicators: string[]; // what's different from current
  policyResponse: string;
  leadingSignals: string[];
}

const ERAS: HistoricalEra[] = [
  {
    id: 'great-depression', era: 'Great Depression', year: '1929', period: '1929–1933', color: '#FF2D55',
    tagline: 'Total systemic collapse — the benchmark crisis',
    description: 'Speculative equity bubble followed by cascading bank failures, deflation spiral, and 90% market drawdown. Debt deflation destroyed 25% of GDP. 9,000+ bank failures.',
    crisisScores: { treasury: 9.5, inflation: 8.0, credit: 9.8, aiBubble: 8.5, liquidity: 9.9, recession: 9.8, banking: 9.9 },
    keyMetrics: [
      { label: 'Market Drawdown', value: '-89%', note: 'Dow Jones peak to trough' },
      { label: 'Bank Failures', value: '9,000+', note: 'US banks closed 1930–33' },
      { label: 'Unemployment', value: '25%', note: 'Peak US unemployment' },
      { label: 'GDP Decline', value: '-30%', note: 'Real GDP contraction' },
    ],
    outcome: 'Total systemic collapse. New Deal restructuring. Glass-Steagall. FDIC created.',
    peakDrop: '-89%', recoveryMonths: 300,
    trajectory: [100,95,88,75,60,45,32,22,18,15,14,15,18,22,28,35,42,50,58,65,72,80,88,95],
    speculationTrend: [95,98,100,98,90,75,55,35,20,15,12,14,18,22,28,35,42,50,55,58,60,62,63,65],
    inflationTrend: [100,102,98,90,80,65,50,40,35,32,30,32,35,40,45,50,55,60,65,68,70,72,74,75],
    liquidityTrend: [100,95,85,70,55,40,30,22,18,16,15,18,22,28,35,42,50,58,65,70,75,80,85,90],
    matchIndicators: ['Extreme equity concentration', 'Banking system fragility', 'Credit leverage at historic extremes'],
    divergeIndicators: ['No gold standard constraint', 'FDIC deposit insurance exists', 'Fed has QE tools', 'No debt deflation yet'],
    policyResponse: 'New Deal fiscal stimulus, FDIC creation, Glass-Steagall banking separation',
    leadingSignals: ['Bank run contagion', 'Credit contraction', 'Deflationary spiral', 'Mass unemployment'],
  },
  {
    id: 'stagflation', era: '1970s Stagflation', year: '1973', period: '1973–1982', color: '#FFD700',
    tagline: 'Oil shock + inflation + recession — the stagflation trap',
    description: 'OPEC oil embargo triggered supply-side inflation while growth collapsed. Fed trapped between fighting inflation and supporting growth. Volcker eventually broke inflation with 20% rates.',
    crisisScores: { treasury: 7.5, inflation: 9.5, credit: 6.5, aiBubble: 2.0, liquidity: 7.0, recession: 8.0, banking: 6.0 },
    keyMetrics: [
      { label: 'Peak CPI', value: '14.8%', note: '1980 peak inflation' },
      { label: 'Fed Funds Peak', value: '20%', note: 'Volcker 1981' },
      { label: 'Market Drawdown', value: '-48%', note: '1973–74 bear market' },
      { label: 'Unemployment', value: '10.8%', note: 'Peak 1982' },
    ],
    outcome: 'Volcker shock broke inflation at the cost of deep recession. Supply-side reforms followed.',
    peakDrop: '-48%', recoveryMonths: 84,
    trajectory: [100,98,95,90,82,75,68,62,58,55,52,55,58,62,68,72,78,82,86,90,94,97,100,102],
    speculationTrend: [40,42,45,48,50,48,45,42,40,38,36,38,40,42,45,48,50,52,55,58,60,62,65,68],
    inflationTrend: [30,40,55,70,85,95,100,98,92,85,75,65,55,48,42,38,35,32,30,28,26,25,24,23],
    liquidityTrend: [100,95,88,80,72,65,58,52,48,45,42,45,48,52,58,65,72,78,84,88,92,95,98,100],
    matchIndicators: ['Persistent above-target inflation', 'Fed policy dilemma', 'Rising unemployment with inflation', 'Energy cost pressures'],
    divergeIndicators: ['No oil embargo shock', 'AI productivity offset', 'Global supply chains more resilient', 'No wage-price spiral yet'],
    policyResponse: 'Volcker shock — 20% rates, deep recession, eventual inflation defeat',
    leadingSignals: ['CPI re-acceleration', 'Wage growth above productivity', 'Energy price spikes', 'Fed credibility erosion'],
  },
  {
    id: 'dotcom', era: 'Dot-Com Bubble', year: '2000', period: '2000–2002', color: '#C084FC',
    tagline: 'Speculation without monetization — the AI bubble analog',
    description: 'Internet mania drove NASDAQ to extreme valuations with no earnings support. Concentration in tech exceeded 35% of S&P 500. Closest historical analog to current AI concentration.',
    crisisScores: { treasury: 5.0, inflation: 3.5, credit: 5.5, aiBubble: 9.8, liquidity: 5.5, recession: 6.0, banking: 4.5 },
    keyMetrics: [
      { label: 'NASDAQ Drawdown', value: '-78%', note: 'Peak to trough 2000–02' },
      { label: 'Tech Concentration', value: '35%+', note: 'S&P 500 peak weight' },
      { label: 'P/E Ratio', value: '200x+', note: 'Median internet company' },
      { label: 'Capex Waste', value: '$1T+', note: 'Unrecoverable investment' },
    ],
    outcome: 'NASDAQ lost 78%. Thousands of companies failed. Recovery took 15 years for NASDAQ to new highs.',
    peakDrop: '-78%', recoveryMonths: 180,
    trajectory: [100,102,105,108,110,108,102,92,80,68,56,46,38,32,28,26,28,32,38,45,52,60,68,75],
    speculationTrend: [60,70,82,92,100,98,88,72,55,40,30,24,22,24,28,32,38,45,52,58,65,70,75,80],
    inflationTrend: [25,26,27,28,29,28,27,26,25,24,23,22,22,23,24,25,26,27,28,29,30,31,32,33],
    liquidityTrend: [100,102,104,106,108,105,98,90,82,75,68,62,58,55,54,55,58,62,68,75,82,88,94,100],
    matchIndicators: ['AI/mega-cap concentration exceeds 2000 peak', 'Capex growth outpacing revenue', 'Monetization gap widening', 'Narrative-driven valuations'],
    divergeIndicators: ['AI has real revenue (unlike 1999 internet)', 'Profitable mega-caps (not loss-making startups)', 'Credit conditions not yet stressed', 'No IPO bubble of unprofitable companies'],
    policyResponse: 'Fed cut rates 475bps 2001–2003. No bailouts. Market cleared naturally.',
    leadingSignals: ['Earnings disappointments vs capex', 'Insider selling acceleration', 'IPO market cooling', 'Concentration reversal'],
  },
  {
    id: 'gfc', era: 'Global Financial Crisis', year: '2007', period: '2007–2009', color: '#FF9500',
    tagline: 'Credit leverage + housing + shadow banking — systemic contagion',
    description: 'Subprime mortgage securitization created hidden leverage throughout the financial system. When housing prices fell, the entire credit complex froze. Lehman Brothers failed. TARP required.',
    crisisScores: { treasury: 7.0, inflation: 5.5, credit: 9.9, aiBubble: 3.0, liquidity: 9.5, recession: 9.0, banking: 9.8 },
    keyMetrics: [
      { label: 'Market Drawdown', value: '-57%', note: 'S&P 500 peak to trough' },
      { label: 'HY Spread Peak', value: '1,900bps', note: 'November 2008' },
      { label: 'Bank Writedowns', value: '$2.8T', note: 'Global financial losses' },
      { label: 'Unemployment', value: '10%', note: 'Peak US unemployment' },
    ],
    outcome: 'Fed balance sheet expanded 4x. ZIRP for 7 years. Dodd-Frank regulation. Too-big-to-fail institutionalized.',
    peakDrop: '-57%', recoveryMonths: 65,
    trajectory: [100,102,104,106,108,105,98,88,75,60,48,38,30,26,24,26,30,36,44,52,62,72,82,92],
    speculationTrend: [55,60,65,70,75,78,80,75,62,48,35,25,20,18,20,24,30,38,46,55,62,68,74,80],
    inflationTrend: [28,30,32,35,38,40,42,40,35,28,22,18,16,18,22,26,30,34,38,40,42,44,45,46],
    liquidityTrend: [100,102,104,106,108,104,95,80,60,42,28,20,16,18,24,32,42,55,68,78,88,95,100,104],
    matchIndicators: ['CRE stress building', 'HY spreads widening', 'Regional bank fragility', 'Liquidity deterioration'],
    divergeIndicators: ['No subprime mortgage bubble', 'Banks better capitalized (Basel III)', 'No shadow banking opacity', 'Fed has QE playbook ready'],
    policyResponse: 'TARP $700B, QE1-3, ZIRP, Dodd-Frank, stress tests',
    leadingSignals: ['HY spread widening >500bps', 'Bank CDS spreads rising', 'Repo market stress', 'CRE default cascade'],
  },
  {
    id: 'covid', era: 'COVID Shock', year: '2020', period: '2020', color: '#00D4FF',
    tagline: 'Exogenous shock — fastest bear market in history',
    description: 'Global pandemic triggered the fastest 30% market decline in history (23 trading days). Unprecedented fiscal and monetary response. $5T+ in stimulus. Recovery was equally rapid.',
    crisisScores: { treasury: 6.5, inflation: 4.0, credit: 8.0, aiBubble: 4.0, liquidity: 8.5, recession: 8.5, banking: 6.5 },
    keyMetrics: [
      { label: 'Market Drawdown', value: '-34%', note: 'Fastest 30%+ decline ever' },
      { label: 'GDP Decline', value: '-31.4%', note: 'Q2 2020 annualized' },
      { label: 'Fed Balance Sheet', value: '+$3T', note: 'In 3 months' },
      { label: 'Unemployment', value: '14.7%', note: 'April 2020 peak' },
    ],
    outcome: 'Fastest recovery in history due to unprecedented policy response. Inflation followed 12–18 months later.',
    peakDrop: '-34%', recoveryMonths: 6,
    trajectory: [100,102,104,106,108,110,112,108,98,80,66,58,62,70,80,90,100,108,115,120,122,124,125,126],
    speculationTrend: [50,52,55,58,60,62,65,60,48,38,32,36,45,58,72,85,95,100,105,108,110,112,114,116],
    inflationTrend: [20,20,21,21,22,22,22,20,18,16,15,16,18,22,28,35,42,50,58,65,70,72,70,65],
    liquidityTrend: [100,102,104,106,108,110,108,95,75,55,42,48,62,78,92,100,108,115,120,122,124,125,126,127],
    matchIndicators: ['Liquidity conditions can freeze rapidly', 'Policy response speed critical', 'Recession risk elevated'],
    divergeIndicators: ['No pandemic shock', 'No lockdown mechanism', 'Supply chains partially normalized', 'Fed already has crisis playbook'],
    policyResponse: '$5T+ fiscal stimulus, QE infinity, ZIRP, PPP loans, Main Street lending',
    leadingSignals: ['Sudden VIX spike >40', 'Credit market freeze', 'Repo stress', 'Dollar liquidity crunch'],
  },
  {
    id: 'inflation2022', era: 'Inflation/Rates Shock', year: '2022', period: '2022–2023', color: '#FF9500',
    tagline: 'Post-stimulus inflation + fastest rate hike cycle in 40 years',
    description: 'COVID stimulus + supply chain disruption triggered 40-year high inflation. Fed hiked 525bps in 16 months. Duration risk devastated bond portfolios. SVB and regional bank failures.',
    crisisScores: { treasury: 8.5, inflation: 8.8, credit: 6.0, aiBubble: 5.0, liquidity: 6.5, recession: 6.5, banking: 7.0 },
    keyMetrics: [
      { label: 'Peak CPI', value: '9.1%', note: 'June 2022' },
      { label: 'Rate Hikes', value: '+525bps', note: 'March 2022 – July 2023' },
      { label: 'Bond Drawdown', value: '-18%', note: 'Worst since 1788' },
      { label: 'S&P Drawdown', value: '-25%', note: '2022 bear market' },
    ],
    outcome: 'Inflation contained but not fully defeated. Soft landing achieved. AI boom emerged from the ashes.',
    peakDrop: '-25%', recoveryMonths: 18,
    trajectory: [100,102,104,106,108,105,98,90,82,75,70,68,70,75,82,88,94,100,106,110,114,118,122,126],
    speculationTrend: [70,75,80,82,85,80,72,62,52,44,38,36,40,48,58,68,78,88,96,102,108,112,116,120],
    inflationTrend: [28,35,45,58,70,80,88,92,90,85,78,70,62,55,48,42,38,35,32,30,28,26,25,24],
    liquidityTrend: [100,102,104,106,108,104,96,86,76,68,62,58,60,65,72,80,88,95,100,104,108,112,115,118],
    matchIndicators: ['Treasury/debt stress elevated', 'Rate sensitivity high', 'Inflation above target', 'Fed funds restrictive'],
    divergeIndicators: ['Inflation declining (not accelerating)', 'Rate hike cycle ending', 'No 9%+ CPI', 'Soft landing partially achieved'],
    policyResponse: '525bps rate hikes, QT, SVB bailout, BTFP facility',
    leadingSignals: ['CPI re-acceleration above 4%', 'Long-end yield spike', 'Duration risk crystallization', 'Regional bank stress'],
  },
];

const TT: React.CSSProperties = {
  background: '#0A0C10', border: '1px solid rgba(0,212,255,0.18)',
  borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '9px', color: '#F0F4FF', padding: '6px 8px',
};

function SimilarityBar({ value, color, animate = true }: { value: number; color: string; animate?: boolean }) {
  return (
    <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, height: '100%',
        width: `${value}%`,
        background: `linear-gradient(90deg, ${color}60, ${color})`,
        borderRadius: '3px',
        boxShadow: `0 0 8px ${color}60`,
        transition: animate ? 'width 1.2s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
      }} />
    </div>
  );
}

function MatchTag({ text, type }: { text: string; type: 'match' | 'diverge' }) {
  const isMatch = type === 'match';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '6px',
      padding: '6px 8px',
      background: isMatch ? 'rgba(255,45,85,0.06)' : 'rgba(0,212,255,0.06)',
      border: `1px solid ${isMatch ? 'rgba(255,45,85,0.15)' : 'rgba(0,212,255,0.15)'}`,
      borderRadius: '4px',
    }}>
      {isMatch
        ? <AlertTriangle size={10} style={{ color: '#FF2D55', flexShrink: 0, marginTop: '1px' }} />
        : <CheckCircle size={10} style={{ color: '#00D4FF', flexShrink: 0, marginTop: '1px' }} />
      }
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: isMatch ? '#FF9090' : '#90D4FF', lineHeight: 1.4 }}>
        {text}
      </span>
    </div>
  );
}

export default function HistoricalAnalogs() {
  useSEO(PAGE_SEO.analogs);
  const { output } = useEngine();
  const { analogs: liveAnalogs, domains, overall } = output;
  const [selectedId, setSelectedId] = useState<string>('dotcom');
  const [overlayMode, setOverlayMode] = useState<'trajectory' | 'speculation' | 'inflation' | 'liquidity'>('trajectory');
  const [showDetail, setShowDetail] = useState(false);

  // Merge live similarity into eras
  const erasWithLive = useMemo(() => {
    return ERAS.map(era => {
      const live = liveAnalogs.find(a => a.id === era.id);
      return {
        ...era,
        liveSimilarity: live?.similarity ?? 0,
        liveMatchReasons: live?.matchReasons ?? era.matchIndicators,
      };
    }).sort((a, b) => b.liveSimilarity - a.liveSimilarity);
  }, [liveAnalogs]);

  const selectedEra = useMemo(() => erasWithLive.find(e => e.id === selectedId) ?? erasWithLive[0], [erasWithLive, selectedId]);
  const topMatch = erasWithLive[0];

  // Radar comparison data
  const radarData = useMemo(() => {
    const domainMap: Record<string, number> = {};
    domains.forEach(d => {
      if (d.id === 'treasury-debt') domainMap['treasury'] = d.score;
      else if (d.id === 'inflation-fed') domainMap['inflation'] = d.score;
      else if (d.id === 'credit-stress') domainMap['credit'] = d.score;
      else if (d.id === 'ai-bubble') domainMap['aiBubble'] = d.score;
      else if (d.id === 'liquidity') domainMap['liquidity'] = d.score;
      else if (d.id === 'recession') domainMap['recession'] = d.score;
      else if (d.id === 'banking') domainMap['banking'] = d.score;
    });
    return [
      { axis: 'Treasury', current: domainMap['treasury'] ?? 0, historical: selectedEra.crisisScores.treasury },
      { axis: 'Inflation', current: domainMap['inflation'] ?? 0, historical: selectedEra.crisisScores.inflation },
      { axis: 'Credit', current: domainMap['credit'] ?? 0, historical: selectedEra.crisisScores.credit },
      { axis: 'AI/Spec', current: domainMap['aiBubble'] ?? 0, historical: selectedEra.crisisScores.aiBubble },
      { axis: 'Liquidity', current: domainMap['liquidity'] ?? 0, historical: selectedEra.crisisScores.liquidity },
      { axis: 'Recession', current: domainMap['recession'] ?? 0, historical: selectedEra.crisisScores.recession },
      { axis: 'Banking', current: domainMap['banking'] ?? 0, historical: selectedEra.crisisScores.banking },
    ];
  }, [domains, selectedEra]);

  // Overlay chart data
  const overlayData = useMemo(() => {
    const months = ['M-12','M-10','M-8','M-6','M-4','M-2','NOW','+2','+4','+6','+8','+10','+12','+14','+16','+18','+20','+22','+24','+26','+28','+30','+32','+34'];
    const series = overlayMode === 'trajectory' ? selectedEra.trajectory
      : overlayMode === 'speculation' ? selectedEra.speculationTrend
      : overlayMode === 'inflation' ? selectedEra.inflationTrend
      : selectedEra.liquidityTrend;

    // Synthesize current path based on overall score
    const currentBase = 100 - (overall.score - 3) * 5;
    const currentPath = months.map((_, i) => {
      if (i < 6) return Math.round(100 - i * 0.5);
      if (i === 6) return currentBase;
      return Math.round(currentBase - (i - 6) * (overall.score > 6 ? 2.5 : 1.0));
    });

    return months.map((m, i) => ({
      month: m,
      historical: series[i] ?? null,
      current: i <= 6 ? currentPath[i] : null,
      projected: i >= 6 ? currentPath[i] : null,
    }));
  }, [overlayMode, selectedEra, overall.score]);

  const overlayLabels = {
    trajectory: 'Market Trajectory (Indexed)',
    speculation: 'Speculation Index',
    inflation: 'Inflation Pressure',
    liquidity: 'Liquidity Conditions',
  };

  return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader
        title="Historical Comparisons"
        subtitle="Compare today’s market conditions to past stress periods. Similarity scores show how closely current data matches historical crises."
        badge="LIVE"
        badgeColor="green"
      />
      <div style={{ padding: '16px', paddingBottom: '100px' }}>

      {/* Top Match Banner */}
      {topMatch && (
        <div style={{
          background: `linear-gradient(135deg, ${topMatch.color}12, rgba(10,12,16,0.95))`,
          border: `1px solid ${topMatch.color}40`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${topMatch.color}, transparent)`,
          }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: topMatch.color, letterSpacing: '0.15em', marginBottom: '4px' }}>
                ◆ CLOSEST HISTORICAL MATCH
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#F0F4FF', marginBottom: '2px' }}>
                {topMatch.era} <span style={{ color: topMatch.color }}>{topMatch.year}</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9CA3AF', marginBottom: '8px' }}>
                {topMatch.tagline}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', lineHeight: 1.5 }}>
                Current environment shows <span style={{ color: topMatch.color, fontWeight: 700 }}>{topMatch.liveSimilarity}% similarity</span> to the {topMatch.era} regime based on live macro indicators.
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '42px',
                color: topMatch.color,
                lineHeight: 1,
                textShadow: `0 0 30px ${topMatch.color}60`,
              }}>
                {topMatch.liveSimilarity}%
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em' }}>
                SIMILARITY
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Era ranking list */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em', marginBottom: '10px' }}>
          SIMILARITY RANKING — ALL ERAS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {erasWithLive.map((era, i) => (
            <div
              key={era.id}
              onClick={() => { setSelectedId(era.id); setShowDetail(true); }}
              style={{
                background: selectedId === era.id ? `${era.color}10` : 'rgba(10,12,16,0.8)',
                border: `1px solid ${selectedId === era.id ? era.color + '40' : 'rgba(255,255,255,0.06)'}`,
                borderLeft: `3px solid ${era.color}`,
                borderRadius: '6px',
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
              }}
              onMouseEnter={e => { if (selectedId !== era.id) (e.currentTarget as HTMLElement).style.background = 'rgba(17,19,24,0.9)'; }}
              onMouseLeave={e => { if (selectedId !== era.id) (e.currentTarget as HTMLElement).style.background = 'rgba(10,12,16,0.8)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', width: '16px', flexShrink: 0 }}>
                  #{i + 1}
                </span>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#E2E8F0', flex: 1 }}>
                  {era.era}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563' }}>
                  {era.period}
                </span>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: era.color, minWidth: '40px', textAlign: 'right' }}>
                  {era.liveSimilarity}%
                </span>
              </div>
              <SimilarityBar value={era.liveSimilarity} color={era.color} />
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', marginTop: '6px' }}>
                {era.tagline}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Era Detail */}
      {selectedEra && (
        <div style={{
          background: `linear-gradient(135deg, ${selectedEra.color}08, rgba(10,12,16,0.95))`,
          border: `1px solid ${selectedEra.color}30`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          {/* Era header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: selectedEra.color, letterSpacing: '0.15em', marginBottom: '4px' }}>
                SELECTED ERA · {selectedEra.period}
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#F0F4FF' }}>
                {selectedEra.era}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9CA3AF', marginTop: '2px' }}>
                {selectedEra.description}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color: '#FF2D55' }}>{selectedEra.peakDrop}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563' }}>PEAK DROP</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color: '#FFD700' }}>{selectedEra.recoveryMonths}mo</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563' }}>RECOVERY</div>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '14px' }}>
            {selectedEra.keyMetrics.map((m, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: selectedEra.color }}>{m.value}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#9CA3AF' }}>{m.label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', marginTop: '2px' }}>{m.note}</div>
              </div>
            ))}
          </div>

          {/* Match / Diverge indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF2D55', letterSpacing: '0.1em', marginBottom: '6px' }}>
                ▲ MATCHING SIGNALS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedEra.matchIndicators.map((m, i) => (
                  <MatchTag key={i} text={m} type="match" />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#00D4FF', letterSpacing: '0.1em', marginBottom: '6px' }}>
                ▼ KEY DIVERGENCES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedEra.divergeIndicators.slice(0, 4).map((d, i) => (
                  <MatchTag key={i} text={d} type="diverge" />
                ))}
              </div>
            </div>
          </div>

          {/* Leading signals */}
          <div style={{ marginBottom: '14px', padding: '10px', background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.15)', borderRadius: '4px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FFD700', letterSpacing: '0.1em', marginBottom: '6px' }}>
              ⚡ LEADING SIGNALS TO WATCH
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedEra.leadingSignals.map((s, i) => (
                <span key={i} style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FFD700',
                  background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)',
                  borderRadius: '3px', padding: '3px 7px',
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Policy response */}
          <div style={{ padding: '10px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: '4px', marginBottom: '14px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#00D4FF', letterSpacing: '0.1em', marginBottom: '4px' }}>
              🏛 HISTORICAL POLICY RESPONSE
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9CA3AF', lineHeight: 1.5 }}>
              {selectedEra.policyResponse}
            </div>
          </div>

          {/* Outcome */}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
            <span style={{ color: '#4B5563' }}>OUTCOME: </span>{selectedEra.outcome}
          </div>
        </div>
      )}

      {/* Overlay Chart */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em', marginBottom: '2px' }}>
              TRAJECTORY OVERLAY
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#E2E8F0' }}>
              {overlayLabels[overlayMode]} — Current vs {selectedEra.era}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['trajectory', 'speculation', 'inflation', 'liquidity'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setOverlayMode(mode)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', border: 'none',
                  background: overlayMode === mode ? selectedEra.color : 'rgba(255,255,255,0.06)',
                  color: overlayMode === mode ? '#050608' : '#6B7280',
                  fontWeight: overlayMode === mode ? 700 : 400,
                  transition: 'all 0.2s',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '20px', height: '2px', background: selectedEra.color }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280' }}>{selectedEra.era}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '20px', height: '2px', background: '#00D4FF' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280' }}>Current</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '20px', height: '2px', background: '#00D4FF', opacity: 0.4, borderTop: '1px dashed #00D4FF' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280' }}>Projected</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={overlayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} interval={3} />
            <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={TT} />
            <ReferenceLine x="NOW" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="historical" stroke={selectedEra.color} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="current" stroke="#00D4FF" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="projected" stroke="#00D4FF" strokeWidth={1.5} strokeDasharray="5 5" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Comparison */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em', marginBottom: '4px' }}>
          DOMAIN COMPARISON RADAR
        </div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#E2E8F0', marginBottom: '10px' }}>
          Current Conditions vs {selectedEra.era} Peak
        </div>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: `${selectedEra.color}40`, border: `1px solid ${selectedEra.color}` }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280' }}>{selectedEra.era}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(0,212,255,0.2)', border: '1px solid #00D4FF' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280' }}>Current</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="axis" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: '#6B7280' }} />
            <Radar name={selectedEra.era} dataKey="historical" stroke={selectedEra.color} fill={selectedEra.color} fillOpacity={0.15} strokeWidth={1.5} />
            <Radar name="Current" dataKey="current" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.12} strokeWidth={1.5} />
            <Tooltip contentStyle={TT} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Disclaimer */}
      <div style={{
        textAlign: 'center', padding: '12px',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151',
        borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '8px',
      }}>
        PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE · HISTORICAL ANALOGS ARE ILLUSTRATIVE, NOT PREDICTIVE
      </div>
      </div>{/* /padding div */}
    </div>
  );
}
