/* ============================================================
   FAULTLINE — Public Pressure Index
   Lightweight public page showing live Pressure Index score.
   No login required. Acts as top-of-funnel for Core/Pro tiers.
   ============================================================ */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

const PLATFORM_URL = "/app";

function PressureGauge({ score, regime }: { score: number; regime: string }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 300);
    return () => clearTimeout(timer);
  }, [score]);

  const color =
    score >= 75 ? "#FF4444" :
    score >= 50 ? "#FF9500" :
    score >= 30 ? "#FFD700" :
    "#00D4FF";

  const glow = `0 0 40px ${color}40, 0 0 80px ${color}20`;
  const pct = animated; // already 0-100

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Circular gauge */}
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          {/* Progress */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
            style={{
              transition: "stroke-dashoffset 1.2s cubic-bezier(0.23,1,0.32,1)",
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        </svg>
        {/* Score in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="text-5xl font-bold font-mono tabular-nums"
            style={{ color, textShadow: glow, transition: "color 0.6s ease" }}
          >
            {Math.round(animated)}
          </div>
          <div className="text-xs font-mono text-white/30 tracking-widest mt-1">/ 100</div>
        </div>
      </div>

      {/* Regime label */}
      <div
        className="px-5 py-2 rounded-full text-xs font-mono tracking-[0.2em] font-semibold uppercase"
        style={{
          color,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          boxShadow: `0 0 20px ${color}20`,
        }}
      >
        {regime}
      </div>
    </div>
  );
}

export default function PressureIndex() {
  const { data, isLoading, error } = trpc.pressure.getCurrentPressure.useQuery(undefined, {
    refetchInterval: 60_000, // refresh every 60s
    staleTime: 30_000,
  });

  const score = data?.overallPressure ?? 0; // 0-100 scale
  const regime = data?.regime ?? "LOADING...";

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{
        background: "linear-gradient(180deg, #050608 0%, #080C14 50%, #050608 100%)",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Top nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] text-white/80 hover:text-white transition-colors cursor-pointer">
            FAULTLINE
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <a
            href={getLoginUrl()}
            className="text-xs font-mono text-white/40 hover:text-white/70 transition-colors tracking-widest"
          >
            SIGN IN
          </a>
          <a
            href={PLATFORM_URL}
            className="text-xs font-mono px-4 py-2 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all tracking-widest"
          >
            EXPLORE FREE
          </a>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 text-[10px] font-mono tracking-[0.3em] text-cyan-400/60 border border-cyan-400/20 px-4 py-1.5 rounded-full">
          FAULTLINE PRESSURE INDEX™ — LIVE
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 tracking-tight">
          Systemic Market Pressure
        </h1>
        <p className="text-white/40 text-sm max-w-md mb-12 leading-relaxed">
          Real-time composite of macro stress, liquidity conditions, Treasury yield shocks, and volatility regimes.
          Updated every 60 seconds.
        </p>

        {/* Gauge */}
        <div className="mb-12">
          {isLoading ? (
            <div className="w-48 h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400/70 text-sm font-mono">DATA UNAVAILABLE</div>
          ) : (
            <PressureGauge score={score} regime={regime} />
          )}
        </div>

        {/* Pressure scale legend */}
        <div className="grid grid-cols-4 gap-3 mb-12 max-w-lg w-full">
          {[
            { range: "0–30", label: "LOW RISK", color: "#00D4FF" },
            { range: "30–50", label: "MODERATE", color: "#FFD700" },
            { range: "50–75", label: "HIGH STRESS", color: "#FF9500" },
            { range: "75–100", label: "CRITICAL", color: "#FF4444" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg px-3 py-2 text-center"
              style={{
                background: `${s.color}08`,
                border: `1px solid ${s.color}25`,
              }}
            >
              <div className="text-[9px] font-mono tracking-widest mb-1" style={{ color: s.color }}>
                {s.label}
              </div>
              <div className="text-[9px] font-mono text-white/30">{s.range}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-sm tracking-widest bg-cyan-500 text-black hover:bg-cyan-400 transition-all active:scale-[0.97]"
            style={{ boxShadow: "0 0 24px rgba(34,211,238,0.4)" }}
          >
            START FREE — NO CARD NEEDED
          </a>
          <a
            href="/#access"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-sm tracking-widest text-white/60 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            VIEW PRICING
          </a>
        </div>

        {/* Tier teaser */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
          {[
            {
              tier: "CORE — $9.99/mo",
              color: "#22D3EE",
              features: ["Signals screener", "Portfolio tracker", "Alt Rotation engine"],
            },
            {
              tier: "PRO — $59/mo",
              color: "#00D4FF",
              features: ["AI Position Guidance™", "Diagnostic AI™", "Crypto intelligence"],
            },
            {
              tier: "FOUNDING — $49/mo",
              color: "#FFD700",
              features: ["Everything in Pro", "Rate locked for life", "Founding member badge"],
            },
          ].map((t) => (
            <div
              key={t.tier}
              className="rounded-lg p-4"
              style={{
                background: `${t.color}06`,
                border: `1px solid ${t.color}20`,
              }}
            >
              <div className="text-[9px] font-mono tracking-widest mb-3" style={{ color: t.color }}>
                {t.tier}
              </div>
              <ul className="space-y-1.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/40">
                    <span style={{ color: t.color }}>→</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-[10px] font-mono text-white/20 tracking-widest">
          FAULTLINE — INSTITUTIONAL MARKET INTELLIGENCE
        </div>
        <div className="flex items-center gap-6 text-[10px] font-mono text-white/20">
          <Link href="/legal">
            <span className="hover:text-white/40 transition-colors cursor-pointer">LEGAL</span>
          </Link>
          <Link href="/blog">
            <span className="hover:text-white/40 transition-colors cursor-pointer">BLOG</span>
          </Link>
          <Link href="/track-record">
            <span className="hover:text-white/40 transition-colors cursor-pointer">TRACK RECORD</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
