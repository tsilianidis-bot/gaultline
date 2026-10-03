import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { EarlyWarningPresentationPanel } from "@/components/EarlyWarningPresentationPanel";
import { PUBLIC_DISCLAIMER } from "@shared/publicDisclaimer";

// ── Regime color helpers ─────────────────────────────────────────────────────
const REGIME_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  "CRITICAL":      { bg: "bg-red-950/60",     border: "border-red-500",   text: "text-red-400",    bar: "#ef4444" },
  "HIGH RISK":     { bg: "bg-orange-950/60",   border: "border-orange-500",text: "text-orange-400", bar: "#f97316" },
  "ELEVATED RISK": { bg: "bg-yellow-950/60",   border: "border-yellow-600",text: "text-yellow-400", bar: "#eab308" },
  "MODERATE RISK": { bg: "bg-zinc-900/60",     border: "border-zinc-600",  text: "text-zinc-400",   bar: "#71717a" },
  "LOW RISK":      { bg: "bg-emerald-950/60",  border: "border-emerald-700",text: "text-emerald-400",bar: "#10b981" },
};

function regimeColor(regime: string) {
  return REGIME_COLORS[regime] ?? REGIME_COLORS["MODERATE RISK"];
}

// ── Crisis event annotations ─────────────────────────────────────────────────
const CRISIS_EVENTS = [
  { month: "2000-03", label: "Dot-com Peak", short: "Dot-com" },
  { month: "2001-09", label: "9/11 Attacks", short: "9/11" },
  { month: "2008-09", label: "Lehman Collapse", short: "Lehman" },
  { month: "2020-03", label: "COVID Crash", short: "COVID" },
  { month: "2022-06", label: "Rate Shock", short: "Rate Shock" },
];

// ── Pressure bar chart (mini sparkline) ─────────────────────────────────────
function PressureTimeline({ data }: { data: Array<{ month: string; overallPressure: number; regime: string }> }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; month: string; pressure: number; regime: string } | null>(null);

  const width = 1000;
  const height = 160;
  const padLeft = 40;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 30;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const barW = chartW / data.length;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ minWidth: 600 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {[25, 45, 65, 80].map(v => {
          const y = padTop + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#374151" strokeWidth={0.5} strokeDasharray="4 4" />
              <text x={padLeft - 4} y={y + 4} fontSize={9} fill="#6b7280" textAnchor="end">{v}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padLeft + i * barW;
          const barH = (d.overallPressure / 100) * chartH;
          const y = padTop + chartH - barH;
          const color = regimeColor(d.regime).bar;
          return (
            <rect
              key={d.month}
              x={x + 0.5}
              y={y}
              width={Math.max(barW - 1, 0.5)}
              height={barH}
              fill={color}
              opacity={0.85}
              onMouseEnter={(e) => {
                const svgRect = (e.target as SVGRectElement).closest('svg')?.getBoundingClientRect();
                if (svgRect) {
                  setTooltip({ x: x + barW / 2, y, month: d.month, pressure: d.overallPressure, regime: d.regime });
                }
              }}
            />
          );
        })}

        {/* Crisis annotations */}
        {CRISIS_EVENTS.map(ev => {
          const idx = data.findIndex(d => d.month === ev.month);
          if (idx < 0) return null;
          const x = padLeft + idx * barW + barW / 2;
          return (
            <g key={ev.month}>
              <line x1={x} x2={x} y1={padTop} y2={padTop + chartH} stroke="#f87171" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <text x={x} y={padTop + 8} fontSize={8} fill="#f87171" textAnchor="middle" opacity={0.8}>{ev.short}</text>
            </g>
          );
        })}

        {/* Year labels on x-axis */}
        {data.filter(d => d.month.endsWith("-01")).map((d, _i) => {
          const year = d.month.slice(0, 4);
          const idx = data.findIndex(r => r.month === d.month);
          const x = padLeft + idx * barW;
          return (
            <text key={year} x={x} y={height - 6} fontSize={9} fill="#6b7280">{year}</text>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 50, width - 110)}
              y={Math.max(tooltip.y - 40, 0)}
              width={100}
              height={36}
              rx={4}
              fill="#1f2937"
              stroke="#374151"
            />
            <text x={Math.min(tooltip.x - 50, width - 110) + 50} y={Math.max(tooltip.y - 40, 0) + 14} fontSize={10} fill="#f9fafb" textAnchor="middle" fontWeight="bold">
              {tooltip.month}
            </text>
            <text x={Math.min(tooltip.x - 50, width - 110) + 50} y={Math.max(tooltip.y - 40, 0) + 28} fontSize={9} fill={regimeColor(tooltip.regime).bar} textAnchor="middle">
              {tooltip.pressure} — {tooltip.regime}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Regime distribution bar ──────────────────────────────────────────────────
function RegimeDistribution({ stats }: { stats: { criticalMonths: number; highRiskMonths: number; elevatedMonths: number; moderateMonths: number; lowMonths: number; totalMonths: number } }) {
  const segments = [
    { label: "CRITICAL",      count: stats.criticalMonths,  color: "#ef4444" },
    { label: "HIGH RISK",     count: stats.highRiskMonths,  color: "#f97316" },
    { label: "ELEVATED RISK", count: stats.elevatedMonths,  color: "#eab308" },
    { label: "MODERATE RISK", count: stats.moderateMonths,  color: "#71717a" },
    { label: "LOW RISK",      count: stats.lowMonths,       color: "#10b981" },
  ];
  const total = stats.totalMonths;
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden w-full">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.count} months (${Math.round((s.count / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-sm text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
            <span className="text-zinc-400">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Crisis callout cards ─────────────────────────────────────────────────────
const CRISIS_CALLOUTS = [
  {
    period: "2001–2003",
    label: "Dot-com Bust + 9/11",
    peak: 72,
    regime: "HIGH RISK",
    description: "Retrospective analysis shows HIGH RISK readings from Sep 2001 through Feb 2003 — 18 consecutive months. Credit contagion and liquidity stress spiked as tech valuations collapsed and post-9/11 uncertainty froze capital markets.",
    outcome: "S&P 500 fell ~49% from peak (Mar 2000) to trough (Oct 2002).",
  },
  {
    period: "2008–2009",
    label: "Global Financial Crisis",
    peak: 82,
    regime: "CRITICAL",
    description: "Retrospective analysis shows CRITICAL (82/100) in October 2008 — the month after Lehman Brothers' September 15, 2008 bankruptcy filing. The Moody's Baa–10-year Treasury spread stood at 5.53% on October 31, 2008 (FRED BAA10Y), with CRITICAL readings sustained for 8 consecutive months through May 2009.",
    outcome: "S&P 500 fell ~57% from peak (Oct 2007) to trough (Mar 2009). Unemployment peaked at 10%.",
  },
  {
    period: "2010–2012",
    label: "European Debt Crisis",
    peak: 72,
    regime: "HIGH RISK",
    description: "Elevated unemployment (7.7–9.9% over 2010–2012) and persistent credit stress kept the model in HIGH RISK territory through much of 2010–2012, capturing the eurozone sovereign debt contagion that threatened global financial stability.",
    outcome: "Multiple EU sovereign downgrades, ECB emergency interventions, Greek restructuring.",
  },
  {
    period: "2020",
    label: "COVID-19 Shock",
    peak: 72,
    regime: "HIGH RISK",
    description: "Retrospective analysis shows HIGH RISK in March 2020 as credit spreads spiked and unemployment surged to 14.8% by April. The rapid Fed response (QE, rate cuts to zero) compressed spreads quickly, limiting the duration of the HIGH RISK reading.",
    outcome: "S&P 500 fell ~34% in 33 days (Feb–Mar 2020). Recovered to new highs by August 2020.",
  },
];

// ── Main page ────────────────────────────────────────────────────────────────
export default function TrackRecord() {
  useSEO({
    title: "Track Record | FAULTLINE — Historical Pressure Index 2000–Present",
    description: "FAULTLINE's archived retrospective Pressure Index reconstruction from 2000, built from historical FRED data. See how the stored reconstruction scored the 2008 financial crisis (82/CRITICAL), COVID crash (72/HIGH RISK), and dot-com bust against actual market outcomes. Retrospective only — not an independently validated backtest.",
    canonical: "/track-record",
  });

  // Inject Dataset + WebPage JSON-LD structured data for Googlebot
  useEffect(() => {
    const id = "faultline-track-record-ld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "FAULTLINE Track Record — Historical Pressure Index 2000–Present",
        "description": "Archived retrospective reconstruction of FAULTLINE Pressure Index scores from historical FRED macroeconomic data, covering the 2000 dot-com bust, 2008 financial crisis, COVID crash, and 2022 rate shock. Not a live record, not a point-in-time backtest, and not independently validated.",
        "url": "https://getfaultline.live/track-record",
        "publisher": {
          "@type": "Organization",
          "name": "FAULTLINE",
          "url": "https://getfaultline.live"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": "FAULTLINE Historical Pressure Index 2000–Present",
        "description": "Monthly FAULTLINE Pressure Index scores from January 2000, stored from a single historical batch built on FRED macroeconomic data. The batch formula was not versioned and is not reproduced by the live six-vector formula.",
        "url": "https://getfaultline.live/track-record",
        "creator": {
          "@type": "Organization",
          "name": "FAULTLINE",
          "url": "https://getfaultline.live"
        },
        "temporalCoverage": "2000-01/",
        "variableMeasured": "Systemic market pressure score (0–100)",
        "license": "https://getfaultline.live/legal"
      }
    ]);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const { data: history, isLoading: histLoading } = trpc.trackRecord.getHistory.useQuery({});
  const { data: stats, isLoading: statsLoading } = trpc.trackRecord.getStats.useQuery();

  const [activeYear, setActiveYear] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (!history) return [];
    if (!activeYear) return history;
    return history.filter(d => d.month.startsWith(activeYear));
  }, [history, activeYear]);

  const years = useMemo(() => {
    if (!history) return [];
    const ys = new Set(history.map(d => d.month.slice(0, 4)));
    return Array.from(ys).sort();
  }, [history]);

  const isLoading = histLoading || statsLoading;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-black/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-white font-bold tracking-widest text-sm hover:text-zinc-300 transition-colors">
            FAULTLINE
          </Link>
          <nav className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/pressure-index" className="hover:text-white transition-colors">Market Stress</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Intelligence Briefings</Link>
            <Link href="/app" className="hover:text-white transition-colors border border-zinc-700 px-3 py-1.5 rounded hover:border-zinc-500">
              Open Platform
            </Link>
          </nav>
        </div>
      </header>

      <PageHeader
        title="Track Record"
        subtitle="Monthly stress scores from an archived retrospective reconstruction on historical FRED data — historical context, not a validated backtest."
        badge="HISTORICAL DATA"
        badgeColor="amber"
	  />
	  <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
	    <section className="mb-10">
	      <div className="text-xs font-mono tracking-[0.18em] text-cyan-400 uppercase mb-3">Current Early Warning Presentation</div>
	      <EarlyWarningPresentationPanel mode="compact" />
	      <p className="mt-3 text-xs text-zinc-500 leading-relaxed">The governed presentation above is separate from the retrospective historical analysis below. Historical reconstruction is not a live verified warning record.</p>
	    </section>
	    {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 text-sm text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-1 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            HISTORICAL RECORD
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            2000 to Today:<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
              A Retrospective Stress Reconstruction
            </span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed mb-4">
            Monthly readings from January 2000 onward, stored from a <strong className="text-zinc-200">single historical batch</strong> built on publicly available FRED macroeconomic data. The batch was calibrated against known historical stress episodes, including a crisis amplifier (documented maximum of 82 in October 2008). Its formula was not versioned, and an internal provenance audit found that the current live six-vector formula reproduces only 14 of the 317 stored months.
          </p>
          <p className="text-zinc-400 text-base max-w-2xl leading-relaxed">
            Treat it as historical context, not proof. Because the batch was calibrated with knowledge of past crises, uses revised rather than point-in-time data, and has not been independently validated, it cannot show that FAULTLINE would have warned in advance. A separate, reproducible research reconstruction of the frozen live formula peaked at 56, reached the Elevated band before 10 of 26 registered 10% S&amp;P 500 drawdowns, and was rated inconclusive.
          </p>
        </div>

        {/* Why This Matters */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="text-sm font-mono text-cyan-400 tracking-widest uppercase mb-2">Context, Not Validation</div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              The archive is not a forecast and not an independent validation of the live engine. It is a <strong className="text-zinc-200">retrospective reconstruction</strong> whose generating formula differs from the formula that runs today, so its readings describe how that batch scored the past — not how the live index would have behaved at the time.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="text-sm font-mono text-orange-400 tracking-widest uppercase mb-2">Regime Context for Live Readings</div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              The archived reconstruction labels only <strong className="text-zinc-200">13% of months</strong> HIGH RISK or CRITICAL, concentrated in the dot-com bust, the GFC, the European debt crisis, and COVID. Its regime labels and thresholds are not guaranteed to match the live index, so use this as rough context for how rare severe readings were in that reconstruction.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="text-sm font-mono text-yellow-400 tracking-widest uppercase mb-2">Data Limitations</div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Inputs are <strong className="text-zinc-200">FRED economic series as currently published</strong> — Moody's Baa spreads, Treasury yields, CPI, unemployment — not point-in-time vintages, so revised values may differ from what was known at the time. Because the crisis amplifier was calibrated against known historical episodes, the archive is partly fitted to the outcomes it is compared with.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="text-sm font-mono text-emerald-400 tracking-widest uppercase mb-2">Score Distribution</div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              In the archived reconstruction, <strong className="text-zinc-200">56% of months since 2000 scored ELEVATED or below</strong>, and 8 months reached CRITICAL. These shares describe the archived batch; they are not a measured false-alarm or hit rate for the live index.
            </p>
          </div>
        </div>

        {/* Methodology note */}
        <div className="mb-10 p-4 border border-zinc-800 rounded-lg bg-zinc-900/40 text-sm text-zinc-400 leading-relaxed">
          <strong className="text-zinc-300">How the archive relates to the live score:</strong> Each stored month carries six vector columns named after the live vectors —
          <strong className="text-zinc-300"> Liquidity Stress</strong>,
          <strong className="text-zinc-300"> Credit Contagion</strong>,
          <strong className="text-zinc-300"> Yield Curve (10Y–2Y) &amp; 10Y Level</strong> (formerly labelled Volatility Regime),
          <strong className="text-zinc-300"> Macro Sensitivity</strong>,
          <strong className="text-zinc-300"> Labor &amp; Rates</strong> (formerly labelled Market Breadth), and
          <strong className="text-zinc-300"> AI / Speculation</strong> (a static baseline in the live index).
          The formulas that produced the historical columns were not preserved, so they should not be assumed to match the live vectors. The batch also applied a crisis amplifier calibrated against historical stress episodes; its exact triggers, floor and cap were not preserved, which is why the archived composite cannot be reproduced from the live weights.
          <span className="block mt-2 text-zinc-400 text-sm">
            Data source: Federal Reserve Economic Data (FRED). Moody's Baa Corporate Bond Spread used as primary credit proxy. HY spread estimated as Baa10Y × 1.8 + 1.5 for pre-2023 periods where direct HY data is unavailable.
          </span>
        </div>

        {/* Stats row */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-zinc-900/60 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="text-2xl font-bold text-white">{stats.totalMonths}</div>
              <div className="text-sm text-zinc-400 mt-0.5">Monthly Readings</div>
            </div>
            <div className="p-4 rounded-lg border border-red-900/50 bg-red-950/20">
              <div className="text-2xl font-bold text-red-400">{stats.criticalMonths + stats.highRiskMonths}</div>
              <div className="text-sm text-zinc-400 mt-0.5">HIGH RISK + CRITICAL Months</div>
            </div>
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="text-2xl font-bold text-white">{stats.avgPressure}</div>
              <div className="text-sm text-zinc-400 mt-0.5">Average Pressure Score</div>
            </div>
            <div className="p-4 rounded-lg border border-orange-900/50 bg-orange-950/20">
              <div className="text-2xl font-bold text-orange-400">{stats.maxPressure}</div>
              <div className="text-sm text-zinc-400 mt-0.5">Peak Score (Oct–Nov 2008)</div>
            </div>
          </div>
        ) : null}

        {/* Regime distribution */}
        {stats && (
          <div className="mb-10 p-5 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Regime Distribution (2000–2026)</h2>
            <RegimeDistribution stats={stats} />
          </div>
        )}

        {/* Timeline chart */}
        <div className="mb-10 p-5 rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Pressure Index Timeline</h2>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setActiveYear(null)}
                className={`text-sm px-2 py-1 rounded border transition-colors ${!activeYear ? 'border-zinc-500 text-white bg-zinc-800' : 'border-zinc-700 text-zinc-400 hover:text-zinc-300'}`}
              >
                All
              </button>
              {years.filter((_, i) => i % 5 === 0 || i === years.length - 1).map(y => (
                <button
                  key={y}
                  onClick={() => setActiveYear(activeYear === y ? null : y)}
                  className={`text-sm px-2 py-1 rounded border transition-colors ${activeYear === y ? 'border-zinc-500 text-white bg-zinc-800' : 'border-zinc-700 text-zinc-400 hover:text-zinc-300'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div className="h-40 rounded bg-zinc-800/50 animate-pulse" />
          ) : (
            <PressureTimeline data={filteredData} />
          )}
          <p className="text-sm text-zinc-400 mt-2">Hover bars for details. Red dashed lines mark major crisis events.</p>
        </div>

        {/* Crisis callouts — BEFORE/AFTER format */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-2">Crisis Period Analysis</h2>
          <p className="text-sm text-zinc-400 mb-6">
            How the archived reconstruction scored each major market crisis, next to what actually happened. Reconstructed readings were not issued live and are not evidence of advance warning.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CRISIS_CALLOUTS.map(c => {
              const rc = regimeColor(c.regime);
              return (
                <div key={c.period} className={`rounded-lg border overflow-hidden ${rc.border}`} style={{ background: 'rgba(9,9,11,0.8)' }}>
                  {/* Card header */}
                  <div className={`px-5 pt-5 pb-3 border-b ${rc.border} flex items-start justify-between`}>
                    <div>
                      <span className="text-xs text-zinc-500 font-mono">{c.period}</span>
                      <h3 className="text-base font-semibold text-white mt-0.5">{c.label}</h3>
                    </div>
                    <div className={`flex-shrink-0 ml-4 text-center px-3 py-1.5 rounded ${rc.bg} ${rc.border} border`}>
                      <div className={`text-2xl font-bold leading-none ${rc.text}`}>{c.peak}</div>
                      <div className={`text-[9px] font-mono tracking-widest mt-0.5 ${rc.text}`}>{c.regime}</div>
                    </div>
                  </div>

                  {/* BEFORE */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="text-[9px] font-mono tracking-[0.3em] text-zinc-500 mb-2">RECONSTRUCTED READING — NOT ISSUED LIVE</div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rc.text.replace('text-', 'bg-')}`} style={{ boxShadow: `0 0 6px currentColor` }} />
                      <span className={`text-sm font-mono font-bold ${rc.text}`}>{c.regime}</span>
                      <span className="text-zinc-500 text-xs">reconstructed</span>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{c.description}</p>
                  </div>

                  {/* Divider with arrow */}
                  <div className="flex items-center gap-3 px-5 py-2">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  {/* AFTER */}
                  <div className="px-5 pb-5">
                    <div className="text-[9px] font-mono tracking-[0.3em] text-zinc-500 mb-2">ACTUAL OUTCOME</div>
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">{c.outcome}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly table */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-2">Monthly Pressure Index Table</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Complete monthly record from January 2000 to present. Showing most recent first.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium">Month</th>
                  <th className="text-right px-3 py-2.5 text-zinc-400 font-medium">Score</th>
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium">Regime</th>
                  <th className="text-right px-3 py-2.5 text-zinc-400 font-medium hidden sm:table-cell">Baa Spread</th>
                  <th className="text-right px-3 py-2.5 text-zinc-400 font-medium hidden sm:table-cell">Unemployment</th>
                  <th className="text-right px-3 py-2.5 text-zinc-400 font-medium hidden md:table-cell">CPI YoY</th>
                  <th className="text-right px-3 py-2.5 text-zinc-400 font-medium hidden md:table-cell">10Y Yield</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-3 py-2">
                          <div className="h-3 rounded bg-zinc-800 animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  [...(history ?? [])].reverse().map(r => {
                    const rc = regimeColor(r.regime);
                    return (
                      <tr key={r.month} className="border-b border-zinc-800/30 hover:bg-zinc-900/40 transition-colors">
                        <td className="px-3 py-2 font-mono text-zinc-300">{r.month}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-bold ${rc.text}`}>{r.overallPressure}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-sm font-medium ${rc.text}`}>{r.regime}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 hidden sm:table-cell">
                          {r.baaSpread != null ? `${r.baaSpread.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 hidden sm:table-cell">
                          {r.unemployment != null ? `${r.unemployment.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 hidden md:table-cell">
                          {r.cpiYoy != null ? `${r.cpiYoy.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 hidden md:table-cell">
                          {r.tsy10y != null ? `${r.tsy10y.toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="border border-zinc-800 rounded-xl p-8 bg-zinc-900/40 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">See Today's Reading</h2>
          <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
            The current Pressure Index is recalculated as new FRED data is published. Access the full platform to see current risk vectors, scenario analysis, and the Aftershock Engine.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/pressure-index" className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-sm">
              View the Pressure Index
            </Link>
            <Link href="/app" className="px-6 py-3 border border-zinc-700 text-white font-semibold rounded-lg hover:border-zinc-500 transition-colors text-sm">
              Explore Free Platform
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <span>© {new Date().getFullYear()} FAULTLINE. All rights reserved. {PUBLIC_DISCLAIMER}</span>
          <div className="flex items-center gap-4">
            <Link href="/legal" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
            <Link href="/legal" className="hover:text-zinc-400 transition-colors">Terms of Use</Link>
            <Link href="/blog" className="hover:text-zinc-400 transition-colors">Intelligence Briefings</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
