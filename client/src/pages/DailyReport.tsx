/* ============================================================
   FAULTLINE — Daily Intelligence Report
   Institutional-grade macro briefing, auto-generated from
   the reactive engine. One-click PDF export via browser print.

   Design: Palantir Noir — void-black, neon gold/electric-blue
   Typography: Rajdhani 700 + IBM Plex Mono
   ============================================================ */
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  Tooltip,
} from 'recharts';
import { useEngine } from '@/contexts/EngineContext';
import { getRiskColor } from '@/components/RiskBadge';
import {
  FileText, Download, Share2, Printer, AlertTriangle,
  TrendingUp, TrendingDown, Shield, Zap, Clock, Info,
} from 'lucide-react';

// ── Typewriter hook ──────────────────────────────────────────
function useTypewriter(text: string, speed = 18): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const textRef = useRef(text);

  useEffect(() => {
    // Reset when text changes
    textRef.current = text;
    indexRef.current = 0;
    setDisplayed('');
    setDone(false);

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(textRef.current.slice(0, indexRef.current));
      if (indexRef.current >= textRef.current.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

const TT: React.CSSProperties = {
  background: '#0A0C10', border: '1px solid rgba(0,212,255,0.18)',
  borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '9px', color: '#F0F4FF', padding: '6px 8px',
};

// ── Print styles injected into head ──────────────────────────
const PRINT_STYLES = `
@media print {
  body { background: #050608 !important; color: #F0F4FF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .print-page { page-break-after: always; }
  @page { size: A4; margin: 0; }
}
`;

export default function DailyReport() {
  const { output, indicators, isLive, lastUpdated, isSimulating } = useEngine();
  const { overall, domains, regime, probability, analogs, narrative } = output;
  const reportRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => lastUpdated ?? new Date(), [lastUpdated]);

  const color = getRiskColor(overall.riskLevel);

  // Radar data
  const radarData = useMemo(() => domains.map(d => ({
    domain: d.label.replace(' Stress', '').replace(' Conditions', '').replace(' Risk', '').replace(' Pressure', '').replace(' Market', '').replace(' System', '').replace(' Bubble / Speculation', ''),
    score: d.score,
  })), [domains]);

  // Bar data for domain scores
  const barData = useMemo(() => [...domains].sort((a, b) => b.score - a.score).map(d => ({
    name: d.label.split(' ')[0],
    score: d.score,
    color: getRiskColor(d.riskLevel),
  })), [domains]);

  // Top analog
  const topAnalog = analogs[0] ?? { era: 'Unknown', year: '—', similarity: 0, matchReasons: [] };

  // AI Briefing text — synthesized from engine output
  const aiBriefingText = useMemo(() => {
    const topDomain = [...domains].sort((a, b) => b.score - a.score)[0];
    const bottomDomain = [...domains].sort((a, b) => a.score - b.score)[0];
    const crashPct = probability.crashProbability;
    const bullPct = probability.bullProbability;
    const recPct = probability.recessionProbability;
    const stagPct = probability.stagflationProbability;

    return [
      `FAULTLINE DAILY INTELLIGENCE BRIEFING — ${formatDate(new Date())}`,
      ``,
      `EXECUTIVE SUMMARY`,
      `The systemic risk index stands at ${overall.score.toFixed(1)}/10, placing the macro environment in a ${regime.label.toUpperCase()} regime. ${regime.description}`,
      ``,
      `DOMINANT RISK VECTOR`,
      `${topDomain?.label ?? 'Unknown'} leads systemic pressure at ${topDomain?.score.toFixed(1) ?? '—'}/10. Primary drivers: ${topDomain?.drivers.slice(0, 2).join('; ') ?? '—'}.`,
      ``,
      `STABILIZING FACTOR`,
      `${bottomDomain?.label ?? 'Unknown'} remains the lowest-stress domain at ${bottomDomain?.score.toFixed(1) ?? '—'}/10, providing relative macro stability.`,
      ``,
      `SCENARIO PROBABILITY MATRIX`,
      `Bull/Recovery: ${bullPct}%  |  Crash/Bear: ${crashPct}%  |  Recession: ${recPct}%  |  Stagflation: ${stagPct}%  |  Soft Landing: ${probability.softLandingProbability}%`,
      ``,
      `HISTORICAL ANALOG`,
      `Current conditions most closely resemble ${topAnalog.era} (${topAnalog.year}) at ${topAnalog.similarity}% similarity. ${topAnalog.matchReasons[0] ?? ''}`,
      ``,
      `KEY SYSTEMIC THREATS`,
      ...narrative.keyRisks.slice(0, 4).map((r, i) => `${i + 1}. ${r}`),
      ``,
      `REGIME ASSESSMENT`,
      narrative.regimeAssessment,
      ``,
      `INTELLIGENCE SUMMARY`,
      narrative.summary,
      ``,
      `— Probabilistic risk intelligence. Not financial advice. —`,
    ].join('\n');
  }, [overall, regime, domains, probability, analogs, narrative, topAnalog]);

  // Typewriter state — only plays once per briefing
  const [showBriefing, setShowBriefing] = useState(false);
  const { displayed: typewriterText, done: typewriterDone } = useTypewriter(
    showBriefing ? aiBriefingText : '',
    12,
  );

  // Print handler
  const handlePrint = useCallback(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  }, []);

  // Share card handler
  const handleShare = useCallback(async () => {
    const text = `FAULTLINE Daily Report — ${formatDate(now)}\n\nSystemic Risk: ${overall.score.toFixed(1)}/10 — ${regime.label}\nCrash Probability: ${probability.crashProbability}%\nTop Analog: ${topAnalog.era} (${topAnalog.similarity}% match)\n\nProbabilistic risk intelligence. Not financial advice.`;
    if (navigator.share) {
      await navigator.share({ title: 'FAULTLINE Daily Report', text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Report summary copied to clipboard.');
    }
  }, [now, overall, regime, probability, topAnalog]);

  return (
    <div style={{ minHeight: '100vh', background: '#050608', padding: '20px 16px 60px', maxWidth: '800px', margin: '0 auto' }}>

      {/* ── Action Bar (no-print) ── */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) both' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '3px' }}>
            Intelligence Briefing
          </div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '26px', color: '#F0F4FF', lineHeight: 1 }}>
            Daily Report
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleShare}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.15s ease' }}
          >
            <Share2 size={11} /> Share
          </button>
          <button
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00D4FF', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.15s ease' }}
          >
            <Printer size={11} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Report Body ── */}
      <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── Cover Block ── */}
        <div style={{
          background: `linear-gradient(135deg, rgba(10,12,16,0.98) 0%, ${color}08 100%)`,
          border: `1px solid ${color}25`,
          borderRadius: '8px', padding: '20px',
          position: 'relative', overflow: 'hidden',
          animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 40ms both',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
          <div style={{ position: 'absolute', top: '12px', right: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textAlign: 'right' }}>
            <div>{formatDate(now)}</div>
            <div style={{ marginTop: '2px' }}>{formatTime(now)}</div>
            {isSimulating && <div style={{ color: '#FF9500', marginTop: '2px' }}>⚡ SIMULATED</div>}
            {isLive && !isSimulating && <div style={{ color: '#00FF88', marginTop: '2px' }}>● LIVE DATA</div>}
          </div>

          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>
            FAULTLINE · Systemic Risk Intelligence
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F0F4FF', lineHeight: 1.1, marginBottom: '10px' }}>
            Macro Intelligence Briefing
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Systemic Risk Index</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '52px', color, lineHeight: 1, textShadow: `0 0 30px ${color}50` }}>
                {overall.score.toFixed(1)}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563' }}>/ 10.0</div>
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Current Regime</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color, lineHeight: 1.1, marginBottom: '3px' }}>{regime.label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>{regime.sublabel}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#94A3B8', lineHeight: 1.5, marginTop: '6px' }}>{regime.description}</div>
            </div>
          </div>
        </div>

        {/* ── Today's Narrative ── */}
        <div style={{ background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={10} style={{ color: '#00D4FF' }} />
            Today's Narrative
          </div>

          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00D4FF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Regime Assessment
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#E2E8F0', lineHeight: 1.7, marginBottom: '14px', fontWeight: 500 }}>
            {narrative.regimeAssessment}
          </p>

          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00D4FF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Market Intelligence Summary
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '14px' }}>
            {narrative.summary}
          </p>

          {/* Key risks */}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF9500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Top Systemic Threats
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {narrative.keyRisks.slice(0, 5).map((risk, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF9500', flexShrink: 0, marginTop: '2px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>{risk}</span>
              </div>
            ))}
          </div>

          {/* Biggest stabilizer */}
          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '4px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#00FF88', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={9} /> Biggest Stabilizer
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#6B7280', lineHeight: 1.5 }}>
              {domains.reduce((min, d) => d.score < min.score ? d : min, domains[0]).label} at {domains.reduce((min, d) => d.score < min.score ? d : min, domains[0]).score.toFixed(1)}/10 — lowest systemic stress domain, providing relative stability.
            </p>
          </div>
        </div>

        {/* ── Systemic Risk Scores ── */}
        <div style={{ background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 120ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={10} style={{ color: '#00D4FF' }} />
            Systemic Risk Scores
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {domains.map(d => {
              const dc = getRiskColor(d.riskLevel);
              const pct = d.score * 10;
              return (
                <div key={d.id} style={{ background: 'rgba(5,6,8,0.6)', borderRadius: '4px', padding: '10px', border: `1px solid ${dc}12` }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>
                    {d.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '5px' }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: dc, lineHeight: 1, textShadow: `0 0 10px ${dc}40` }}>{d.score.toFixed(1)}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>/10</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: d.delta > 0 ? '#FF9500' : '#00FF88', marginLeft: 'auto' }}>
                      {d.delta > 0 ? '+' : ''}{d.delta.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: dc, borderRadius: '1px', boxShadow: `0 0 4px ${dc}50` }} />
                  </div>
                  {d.drivers[0] && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', marginTop: '4px', lineHeight: 1.4 }}>
                      {d.drivers[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Domain radar */}
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="domain" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#6B7280' }} />
              <Radar name="Risk" dataKey="score" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Scenario Probabilities ── */}
        <div style={{ background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 160ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={10} style={{ color: '#00D4FF' }} />
            Scenario Probabilities
          </div>

          {/* Bull vs Crash bar */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#00FF88' }}>{probability.bullProbability}% <span style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", color: '#4B5563' }}>BULL</span></span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#FF2D55' }}>{probability.crashProbability}% <span style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", color: '#4B5563' }}>CRASH/BEAR</span></span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${probability.bullProbability}%`, background: 'linear-gradient(90deg, #00FF88, #FFD700)', borderRadius: '3px', boxShadow: '0 0 8px rgba(0,255,136,0.4)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'Recession', value: probability.recessionProbability, color: '#FF9500' },
              { label: 'Stagflation', value: probability.stagflationProbability, color: '#FFD700' },
              { label: 'Soft Landing', value: probability.softLandingProbability, color: '#00FF88' },
            ].map(p => (
              <div key={p.label} style={{ background: 'rgba(5,6,8,0.6)', borderRadius: '4px', padding: '10px', textAlign: 'center', border: `1px solid ${p.color}15` }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '24px', color: p.color, lineHeight: 1 }}>{p.value}%</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Core High-Signal Metrics ── */}
        <div style={{ background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 200ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={10} style={{ color: '#00D4FF' }} />
            Core High-Signal Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {[
              { label: '10Y Treasury', value: `${indicators.yield10Y.toFixed(2)}%`, note: indicators.yield10Y > 5.0 ? 'Elevated' : 'Moderate' },
              { label: 'Yield Curve', value: `${indicators.yieldCurveSpread}bps`, note: indicators.yieldCurveSpread < 0 ? 'Inverted' : 'Normal' },
              { label: 'HY Spread', value: `${indicators.hySpread}bps`, note: indicators.hySpread > 500 ? 'Stressed' : 'Contained' },
              { label: 'VIX', value: indicators.vix.toFixed(1), note: indicators.vix > 30 ? 'Elevated Fear' : 'Moderate' },
              { label: 'CPI', value: `${indicators.cpi.toFixed(1)}%`, note: indicators.cpi > 4 ? 'Above Target' : 'Easing' },
              { label: 'Fed Funds', value: `${indicators.fedFundsRate.toFixed(2)}%`, note: 'Restrictive' },
              { label: 'Unemployment', value: `${indicators.unemployment.toFixed(1)}%`, note: indicators.unemployment > 5 ? 'Rising' : 'Contained' },
              { label: 'AI Concentration', value: `${indicators.aiConcentration.toFixed(1)}%`, note: indicators.aiConcentration > 35 ? 'Extreme' : 'Elevated' },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(5,6,8,0.6)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#F0F4FF', fontWeight: 700 }}>{m.value}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563' }}>{m.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Historical Analog ── */}
        <div style={{ background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 240ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={10} style={{ color: '#00D4FF' }} />
            Historical Analog Comparison
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analogs.slice(0, 4).map((a, i) => {
              const barColor = i === 0 ? '#FF9500' : i === 1 ? '#FFD700' : '#00D4FF';
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '120px', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '12px', color: i === 0 ? barColor : '#94A3B8', lineHeight: 1 }}>{a.era}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>{a.year}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '3px' }}>
                      <div style={{ height: '100%', width: `${a.similarity}%`, background: barColor, borderRadius: '2px', boxShadow: `0 0 6px ${barColor}50` }} />
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563' }}>{a.matchReasons[0]}</div>
                  </div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: barColor, width: '38px', textAlign: 'right', flexShrink: 0 }}>
                    {a.similarity}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trigger Watchlist ── */}
        <div style={{ background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 280ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={10} style={{ color: '#FF9500' }} />
            Trigger Watchlist
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { trigger: 'HY Spread > 500bps', current: `${indicators.hySpread}bps`, status: indicators.hySpread > 500 ? 'TRIGGERED' : 'WATCHING', color: indicators.hySpread > 500 ? '#FF2D55' : '#FF9500' },
              { trigger: 'VIX > 35', current: indicators.vix.toFixed(1), status: indicators.vix > 35 ? 'TRIGGERED' : 'WATCHING', color: indicators.vix > 35 ? '#FF2D55' : '#FF9500' },
              { trigger: 'Yield Curve < -150bps', current: `${indicators.yieldCurveSpread}bps`, status: indicators.yieldCurveSpread < -150 ? 'TRIGGERED' : 'WATCHING', color: indicators.yieldCurveSpread < -150 ? '#FF2D55' : '#FF9500' },
              { trigger: 'CPI > 5%', current: `${indicators.cpi.toFixed(1)}%`, status: indicators.cpi > 5 ? 'TRIGGERED' : 'WATCHING', color: indicators.cpi > 5 ? '#FF2D55' : '#FF9500' },
              { trigger: 'Unemployment > 5.5%', current: `${indicators.unemployment.toFixed(1)}%`, status: indicators.unemployment > 5.5 ? 'TRIGGERED' : 'MONITORING', color: indicators.unemployment > 5.5 ? '#FF2D55' : '#00D4FF' },
              { trigger: 'AI Concentration > 40%', current: `${indicators.aiConcentration.toFixed(1)}%`, status: indicators.aiConcentration > 40 ? 'TRIGGERED' : 'MONITORING', color: indicators.aiConcentration > 40 ? '#FF2D55' : '#00D4FF' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(5,6,8,0.6)', borderRadius: '3px', border: `1px solid ${t.color}15` }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#94A3B8' }}>{t.trigger}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginTop: '1px' }}>Current: {t.current}</div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: t.color, background: `${t.color}12`, border: `1px solid ${t.color}25`, borderRadius: '2px', padding: '2px 7px', letterSpacing: '0.08em' }}>
                  {t.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Final Regime Assessment ── */}
        <div style={{
          background: `linear-gradient(135deg, rgba(10,12,16,0.98) 0%, ${color}06 100%)`,
          border: `1px solid ${color}20`,
          borderRadius: '8px', padding: '16px',
          animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 320ms both',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={10} style={{ color: color }} />
            Final Regime Assessment
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color, marginBottom: '6px', textShadow: `0 0 16px ${color}40` }}>
            {regime.label} — {overall.riskLevel.toUpperCase()} RISK
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#94A3B8', lineHeight: 1.7, marginBottom: '10px' }}>
            {regime.description}
          </p>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', lineHeight: 1.6 }}>
            Top analog: <span style={{ color: '#FF9500' }}>{topAnalog.era} ({topAnalog.year})</span> at <span style={{ color: '#FF9500' }}>{topAnalog.similarity}% similarity</span>.
            Crash probability: <span style={{ color: '#FF2D55' }}>{probability.crashProbability}%</span>.
            Recession risk: <span style={{ color: '#FF9500' }}>{probability.recessionProbability}%</span>.
          </div>
        </div>

        {/* ── AI Macro Briefing ── */}
        <div style={{
          background: 'rgba(5,6,8,0.95)',
          border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: '8px', padding: '16px',
          animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 360ms both',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Top glow line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#00D4FF', letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={10} style={{ color: '#00D4FF' }} />
              AI Macro Briefing
              {showBriefing && !typewriterDone && (
                <span style={{ color: '#00FF88', animation: 'blink-alert 0.8s ease-in-out infinite' }}>▋</span>
              )}
              {showBriefing && typewriterDone && (
                <span style={{ color: '#00FF88', fontSize: '7px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '2px', padding: '1px 5px' }}>COMPLETE</span>
              )}
            </div>
            {!showBriefing ? (
              <button
                onClick={() => setShowBriefing(true)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
                  color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.25)', borderRadius: '4px',
                  padding: '6px 12px', cursor: 'pointer', letterSpacing: '0.08em',
                  textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.15s',
                }}
              >
                <Zap size={10} /> Generate Briefing
              </button>
            ) : (
              <button
                onClick={() => { setShowBriefing(false); setTimeout(() => setShowBriefing(true), 50); }}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  color: '#4B5563', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px',
                  padding: '5px 10px', cursor: 'pointer', letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                ↺ Replay
              </button>
            )}
          </div>

          {!showBriefing ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151', lineHeight: 1.6 }}>
                Click "Generate Briefing" to synthesize a full intelligence report<br />
                from live macro data and the reactive risk engine.
              </div>
            </div>
          ) : (
            <pre style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
              color: '#94A3B8', lineHeight: 1.8, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', margin: 0,
              minHeight: '120px',
            }}>
              {typewriterText}
              {!typewriterDone && <span style={{ color: '#00D4FF', animation: 'blink-alert 0.6s ease-in-out infinite' }}>▋</span>}
            </pre>
          )}
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '4px' }}>
          <Info size={11} style={{ color: '#374151', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', lineHeight: 1.6 }}>
            <strong style={{ color: '#4B5563' }}>Probabilistic risk intelligence. Not financial advice.</strong>{' '}
            FAULTLINE generates composite risk signals from macroeconomic indicators. All scores are model-derived estimates. Past crisis analogs do not guarantee future outcomes. This report is for informational and educational purposes only.
          </p>
        </div>

      </div>
    </div>
  );
}
