/* ============================================================
   FAULTLINE — Public Pressure Index
   Cinematic acquisition funnel. No login required.
   Viral, shareable, institutional.
   ============================================================ */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

const PLATFORM_URL = "/app";

// ── Animated number counter ───────────────────────────────────
function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return <>{val}</>;
}

// ── Pressure color helper ─────────────────────────────────────
function pressureColor(score: number) {
  if (score >= 75) return "#FF4444";
  if (score >= 50) return "#FF9500";
  if (score >= 30) return "#FFD700";
  return "#00D4FF";
}

// ── Circular gauge ────────────────────────────────────────────
function PressureGauge({ score, regime }: { score: number; regime: string }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 400);
    return () => clearTimeout(t);
  }, [score]);

  const color = pressureColor(score);
  const glow = `0 0 60px ${color}50, 0 0 120px ${color}20`;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - animated / 100);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-52 h-52">
        {/* Outer ambient ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 60px ${color}20, 0 0 120px ${color}08` }}
        />
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          {/* Background track */}
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
          {/* Glow track */}
          <circle cx="60" cy="60" r="52" fill="none" stroke={`${color}20`} strokeWidth="10" />
          {/* Progress arc */}
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 1.4s cubic-bezier(0.23,1,0.32,1), stroke 0.6s ease",
              filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}80)`,
            }}
          />
        </svg>
        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="text-6xl font-bold font-mono tabular-nums leading-none"
            style={{ color, textShadow: glow, transition: "color 0.6s ease" }}
          >
            <AnimatedNumber target={Math.round(animated)} />
          </div>
          <div className="text-[10px] font-mono text-white/25 tracking-[0.3em] mt-1">/ 100</div>
        </div>
      </div>

      {/* Regime badge */}
      <div
        className="px-6 py-2.5 rounded-full text-xs font-mono tracking-[0.25em] font-bold uppercase"
        style={{
          color,
          background: `${color}12`,
          border: `1px solid ${color}35`,
          boxShadow: `0 0 24px ${color}20`,
        }}
      >
        {regime}
      </div>
    </div>
  );
}

// ── Locked premium card ───────────────────────────────────────
function LockedCard({ title, description, accentColor }: { title: string; description: string; accentColor: string }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(12,15,22,0.9) 0%, rgba(8,10,16,0.95) 100%)",
        border: `1px solid ${accentColor}20`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      {/* Top shimmer */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }} />

      {/* Blurred content */}
      <div className="p-5 select-none" style={{ filter: "blur(3px)", opacity: 0.4 }}>
        <div className="text-[9px] font-mono tracking-widest mb-2" style={{ color: accentColor }}>{title}</div>
        <div className="text-sm text-white/60 leading-relaxed">{description}</div>
        <div className="mt-3 flex gap-2">
          {[40, 65, 30].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-white/20" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}40` }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="text-[9px] font-mono tracking-widest" style={{ color: accentColor }}>PREMIUM INTELLIGENCE</div>
      </div>
    </div>
  );
}

// ── Vector bar ────────────────────────────────────────────────
function VectorBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 600);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="flex items-center gap-3">
      <div className="text-[9px] font-mono tracking-widest text-white/30 w-28 flex-shrink-0">{label}</div>
      <div className="flex-1 h-1 rounded-full bg-white/05 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            boxShadow: `0 0 6px ${color}60`,
            transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
          }}
        />
      </div>
      <div className="text-[9px] font-mono tabular-nums w-8 text-right" style={{ color }}>{value}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PressureIndex() {
  const { data, isLoading, error } = trpc.pressure.getCurrentPressure.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const score = data?.overallPressure ?? 0;
  const regime = data?.regime ?? "LOADING...";
  const color = pressureColor(score);

  // Build vector bars from real data if available
  const vectors = data?.vectors?.slice(0, 5) ?? [];

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{
        background: "linear-gradient(180deg, #030406 0%, #060A12 40%, #030406 100%)",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Ambient background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 30%, ${color}08 0%, transparent 70%)`,
          transition: "background 1s ease",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.3em] text-white/70 hover:text-white transition-colors cursor-pointer">
            FAULTLINE
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={getLoginUrl()}
            className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors tracking-widest hidden sm:block"
          >
            SIGN IN
          </a>
          <a
            href={PLATFORM_URL}
            className="text-[10px] font-mono px-4 py-2 rounded-lg tracking-widest transition-all"
            style={{
              background: `${color}15`,
              border: `1px solid ${color}35`,
              color,
            }}
          >
            EXPLORE FREE
          </a>
        </div>
      </nav>

      {/* Hero section */}
      <main className="relative z-10 flex-1">
        <div className="max-w-5xl mx-auto px-6 py-16">

          {/* Header */}
          <div className="text-center mb-16">
            <div
              className="inline-block text-[9px] font-mono tracking-[0.35em] px-4 py-1.5 rounded-full mb-6"
              style={{ color: `${color}`, background: `${color}10`, border: `1px solid ${color}30` }}
            >
              FAULTLINE PRESSURE INDEX™ — LIVE
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 tracking-tight leading-tight">
              Systemic Market<br />
              <span style={{ color }}>Pressure Intelligence</span>
            </h1>
            <p className="text-white/35 text-sm max-w-lg mx-auto leading-relaxed">
              Real-time composite of macro stress, liquidity conditions, Treasury yield shocks,
              credit spreads, and volatility regimes. Updated every 60 seconds.
            </p>
          </div>

          {/* Gauge + vectors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            {/* Left: gauge */}
            <div className="flex flex-col items-center">
              {isLoading ? (
                <div className="w-52 h-52 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-400/60 rounded-full animate-spin" />
                </div>
              ) : error ? (
                <div className="text-red-400/50 text-sm font-mono">DATA UNAVAILABLE</div>
              ) : (
                <PressureGauge score={score} regime={regime} />
              )}

              {/* Scale legend */}
              <div className="grid grid-cols-4 gap-2 mt-8 w-full max-w-xs">
                {[
                  { range: "0–30", label: "LOW", color: "#00D4FF" },
                  { range: "30–50", label: "MOD", color: "#FFD700" },
                  { range: "50–75", label: "HIGH", color: "#FF9500" },
                  { range: "75+", label: "CRIT", color: "#FF4444" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg px-2 py-2 text-center"
                    style={{ background: `${s.color}06`, border: `1px solid ${s.color}20` }}
                  >
                    <div className="text-[8px] font-mono tracking-widest mb-0.5" style={{ color: s.color }}>{s.label}</div>
                    <div className="text-[8px] font-mono text-white/20">{s.range}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: regime summary + vectors */}
            <div className="space-y-6">
              {/* Regime summary card */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(12,15,22,0.9) 0%, rgba(8,10,16,0.95) 100%)",
                  border: `1px solid ${color}25`,
                  boxShadow: `0 0 30px ${color}10`,
                }}
              >
                <div className="text-[9px] font-mono tracking-[0.3em] text-white/30 mb-3">CURRENT REGIME</div>
                <div className="text-lg font-bold mb-2" style={{ color }}>{regime}</div>
                <p className="text-white/40 text-xs leading-relaxed">
                  {score >= 75
                    ? "Multiple systemic stress vectors are converging. Elevated probability of cascade events. Risk management protocols should be active."
                    : score >= 50
                    ? "Significant macro stress detected across credit, rates, and volatility dimensions. Heightened vigilance warranted."
                    : score >= 30
                    ? "Moderate pressure building across key risk vectors. Markets are navigating macro uncertainty with some resilience."
                    : "Systemic risk indicators are contained. Macro environment supports measured risk-taking with appropriate position sizing."}
                </p>
              </div>

              {/* Risk vectors */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(8,10,16,0.8)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="text-[9px] font-mono tracking-[0.3em] text-white/30 mb-4">RISK VECTORS</div>
                <div className="space-y-3">
                  {vectors.length > 0 ? (
                    vectors.map((v: { id: string; label: string; score: number }) => (
                      <VectorBar
                        key={v.id}
                        label={v.label.toUpperCase().slice(0, 18)}
                        value={Math.round(v.score)}
                        color={pressureColor(v.score)}
                      />
                    ))
                  ) : (
                    // Placeholder bars while loading
                    ["CREDIT STRESS", "YIELD SHOCK", "VOLATILITY", "LIQUIDITY", "MOMENTUM"].map((label, i) => (
                      <VectorBar key={label} label={label} value={isLoading ? 0 : [42, 58, 35, 27, 61][i]} color={pressureColor([42, 58, 35, 27, 61][i])} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Macro explanation */}
          <div className="mb-20">
            <div className="text-center mb-8">
              <div className="text-[9px] font-mono tracking-[0.3em] text-white/25 mb-2">WHAT IS THE PRESSURE INDEX?</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white/80">Institutional-grade systemic risk, quantified.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: "◈",
                  title: "Multi-Vector Composite",
                  desc: "Aggregates 12+ macro risk signals including credit spreads, yield curve dynamics, VIX regimes, and liquidity conditions into a single 0–100 score.",
                  color: "#00D4FF",
                },
                {
                  icon: "◉",
                  title: "Regime Classification",
                  desc: "Classifies market conditions into five regimes — from Low Risk to Systemic Crisis — enabling regime-aware position sizing and risk management.",
                  color: "#22D3EE",
                },
                {
                  icon: "◎",
                  title: "Real-Time Intelligence",
                  desc: "Powered by live FRED data, Treasury yields, and volatility surfaces. Refreshes every 60 seconds with institutional-grade data sources.",
                  color: "#64748B",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl p-5"
                  style={{
                    background: "linear-gradient(135deg, rgba(12,15,22,0.8) 0%, rgba(8,10,16,0.9) 100%)",
                    border: `1px solid ${item.color}15`,
                  }}
                >
                  <div className="text-2xl mb-3" style={{ color: item.color }}>{item.icon}</div>
                  <div className="text-xs font-bold text-white/70 mb-2 tracking-wide">{item.title}</div>
                  <div className="text-[11px] text-white/35 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Locked premium intelligence cards */}
          <div className="mb-20">
            <div className="text-center mb-8">
              <div className="text-[9px] font-mono tracking-[0.3em] text-white/25 mb-2">PREMIUM INTELLIGENCE</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white/80">What's inside the full platform.</h2>
              <p className="text-white/30 text-xs mt-2">Available to Core and Pro subscribers.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <LockedCard
                title="SIGNALS SCREENER — CORE"
                description="BUY / SELL / HOLD / WATCH ratings across 50+ tickers with regime-adjusted conviction scores and entry/exit zones."
                accentColor="#22D3EE"
              />
              <LockedCard
                title="PORTFOLIO INTELLIGENCE — CORE"
                description="Live P&L tracking with AI-powered position guidance, risk scoring, and regime-aware allocation analysis."
                accentColor="#22D3EE"
              />
              <LockedCard
                title="ALT ROTATION ENGINE — CORE"
                description="Momentum-based rotation signals across equities, commodities, and alternatives. Know when to rotate before the crowd."
                accentColor="#22D3EE"
              />
              <LockedCard
                title="DIAGNOSTIC AI™ — PRO"
                description="Full institutional diagnostic report. Identifies the top 3 systemic risks, regime probability, and actionable intelligence for the next 30 days."
                accentColor="#00D4FF"
              />
              <LockedCard
                title="CRYPTO INTELLIGENCE — PRO"
                description="Systemic risk scoring for BTC, ETH, and top altcoins. Narrative tracking, contagion analysis, and crypto regime classification."
                accentColor="#00D4FF"
              />
              <LockedCard
                title="AFTERSHOCK ENGINE™ — PRO"
                description="Contagion chain analysis. Maps how stress propagates across asset classes and identifies second-order shock vectors before they materialize."
                accentColor="#00D4FF"
              />
            </div>
          </div>

          {/* CTA section */}
          <div
            className="rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(12,15,22,0.95) 0%, rgba(8,10,16,0.98) 100%)",
              border: `1px solid ${color}25`,
              boxShadow: `0 0 60px ${color}10`,
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />
            <div className="text-[9px] font-mono tracking-[0.3em] mb-4" style={{ color: `${color}80` }}>
              START FREE — NO CREDIT CARD REQUIRED
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Unlock Full Intelligence
            </h2>
            <p className="text-white/40 text-sm max-w-md mx-auto mb-8 leading-relaxed">
              Join thousands of traders who've upgraded from retail noise to institutional signal.
              Start free, upgrade when you're ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={getLoginUrl()}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm tracking-widest transition-all active:scale-[0.97]"
                style={{
                  background: color,
                  color: "#050608",
                  boxShadow: `0 0 30px ${color}40`,
                }}
              >
                START FREE — NO CARD NEEDED
              </a>
              <a
                href="/#access"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm tracking-widest text-white/50 hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                VIEW ALL PLANS
              </a>
            </div>

            {/* Tier mini-cards */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
              {[
                { tier: "CORE", price: "$9.99/mo", tagline: "Mobile-first intelligence", color: "#22D3EE", features: ["Signals screener", "Portfolio tracker", "Alt Rotation"] },
                { tier: "PRO", price: "$59/mo", tagline: "Institutional-grade suite", color: "#00D4FF", features: ["AI Diagnostic™", "Crypto intelligence", "Aftershock Engine™"], badge: "RECOMMENDED" },
                { tier: "FOUNDING", price: "$49/mo", tagline: "Rate locked for life", color: "#FFD700", features: ["Everything in Pro", "Founder badge", "Early beta access"], badge: "LIMITED" },
              ].map((t) => (
                <div
                  key={t.tier}
                  className="relative rounded-xl p-4"
                  style={{ background: `${t.color}08`, border: `1px solid ${t.color}20` }}
                >
                  {t.badge && (
                    <div
                      className="absolute -top-2.5 right-3 text-[8px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full"
                      style={{ background: `${t.color}20`, border: `1px solid ${t.color}40`, color: t.color }}
                    >
                      {t.badge}
                    </div>
                  )}
                  <div className="text-[9px] font-mono tracking-widest mb-0.5" style={{ color: t.color }}>{t.tier}</div>
                  <div className="text-sm font-bold text-white mb-0.5">{t.price}</div>
                  <div className="text-[10px] text-white/30 mb-3">{t.tagline}</div>
                  <ul className="space-y-1">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-[10px] text-white/40">
                        <span style={{ color: t.color }}>→</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-[9px] font-mono text-white/15 tracking-widest">
          FAULTLINE — INSTITUTIONAL MARKET INTELLIGENCE
        </div>
        <div className="flex items-center gap-6 text-[9px] font-mono text-white/15">
          <Link href="/legal">
            <span className="hover:text-white/35 transition-colors cursor-pointer">LEGAL</span>
          </Link>
          <Link href="/blog">
            <span className="hover:text-white/35 transition-colors cursor-pointer">BLOG</span>
          </Link>
          <Link href="/track-record">
            <span className="hover:text-white/35 transition-colors cursor-pointer">TRACK RECORD</span>
          </Link>
          <Link href="/">
            <span className="hover:text-white/35 transition-colors cursor-pointer">HOME</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
