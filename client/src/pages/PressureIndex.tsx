/* ============================================================
   FAULTLINE — Public Pressure Index
   Cinematic acquisition funnel. No login required.
   Viral, shareable, institutional.
   ============================================================ */
import { canonicalEngineEvidence } from "@shared/snapshotEvidence";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { useEffect, useState } from "react";
import { useMemo } from "react";
import { useRegisterAshaContext } from "@/contexts/AshaContext";
import { AshaIntelligenceBrief } from "@/components/AshaIntelligenceBrief";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { getLoginUrl, handleLoginCtaClick } from "@/const";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID, pressureVectorLabel } from "@shared/pressureVectorLabels";
import { pressureDisplayBand } from "@shared/pressureScale";
import { usePressureSnapshot } from "@/hooks/usePressureSnapshot";
import { PressureBandLegend, PressureSnapshotGauge } from "@/components/PressureSnapshotGauge";
import { PRESSURE_UNAVAILABLE_COLOR, pressureBandFor } from "@/lib/pressureSnapshot";

const PLATFORM_URL = "/app";

// ── Pressure color helper ─────────────────────────────────────
function pressureColor(score: number) {
  return pressureBandFor(score).color;
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
  useSEO({
    title: "FAULTLINE Pressure Index™ — Live Systemic Market Risk Score",
    description: "The FAULTLINE Pressure Index™ combines credit spreads, funding rates, the Treasury yield curve, inflation, unemployment, and a static AI-concentration baseline into a single systemic risk score (0–100).",
    canonical: "/pressure-index",
  });

  // Same fallback / stale / delayed definition as every other surface (shared/snapshotEvidence.ts).
  const evidenceDataStatus = (status: string) => (status === "CURRENT" ? "live" : status.toLowerCase());

  // One canonical snapshot drives the ring, number, band, regime, timestamp and interpretation.
  const snapshot = usePressureSnapshot();
  const isLoading = snapshot.status === "loading";
  const score = snapshot.status === "ready" ? snapshot.score : null;
  const regime = snapshot.status === "ready" ? snapshot.regime : "UNAVAILABLE";
  const withheld = snapshot.status !== "ready";
  const color = snapshot.status === "ready" ? snapshot.band.color : PRESSURE_UNAVAILABLE_COLOR;

  const vectors = snapshot.status !== "ready"
    ? []
    : snapshot.state.engines
        .filter(engine => engine.value != null && engine.qualityStatus !== "UNAVAILABLE")
        .slice(0, 5)
        .map(engine => ({
          id: engine.engineId,
          label: pressureVectorLabel(engine.engineId, engine.engineName),
          score: engine.value ?? 0,
          // The AI vector's concentration input is a static reference value, not a live measurement.
          dataStatus: engine.sourceInputIds.includes(AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID)
            ? "static"
            : evidenceDataStatus(canonicalEngineEvidence(engine, snapshot.state)),
          fallbackReason: engine.fallbackStatus === "ACTIVE" ? "Governed fallback" : undefined,
          source: "canonical-state",
        }));

  // Register ASHA page context — memoized to prevent infinite render loop
  const ashaCtx = useMemo(() => ({
    page: "pressure" as const,
    pressureScore: score ?? undefined,
    regime,
    keyDrivers: vectors.map(v => `${v.label}: ${v.score?.toFixed(1) ?? "UNAVAILABLE"}`),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [score, regime, vectors.length]);
  useRegisterAshaContext(ashaCtx);

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
              {isLoading ? "FAULTLINE PRESSURE INDEX™ — LOADING" : withheld ? "FAULTLINE PRESSURE INDEX™ — UNAVAILABLE" : "FAULTLINE PRESSURE INDEX™ — CANONICAL"}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 tracking-tight leading-tight">
              Systemic Market<br />
              <span style={{ color }}>Pressure Intelligence</span>
            </h1>
            <p className="text-white/35 text-sm max-w-lg mx-auto leading-relaxed">
              Composite of credit spreads, funding rates, the Treasury yield curve, inflation,
              policy rates and unemployment, plus a static AI-concentration baseline. Each published reading shows its as-of time.
            </p>
          </div>

          {/* Gauge + vectors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            {/* Left: gauge */}
            <div className="flex flex-col items-center">
              <PressureSnapshotGauge snapshot={snapshot} />

              {/* Scale legend — engine bands */}
              <PressureBandLegend snapshot={snapshot} />
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
                  {snapshot.status === "loading"
                    ? "Loading the canonical pressure snapshot."
                    : snapshot.status !== "ready"
                    ? "Canonical pressure evidence is withheld. This page will not manufacture a live score, regime story, or placeholder vectors."
                    : pressureDisplayBand(snapshot.score).desc}
                </p>
              </div>

              {/* Risk vectors */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(8,10,16,0.8)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <div className="text-[9px] font-mono tracking-[0.3em] text-white/30 mb-4">RISK VECTORS</div>
                <div className="space-y-3">
                  {vectors.length > 0 ? (
                    vectors.map((v: { id: string; label: string; score: number; dataStatus?: string; fallbackReason?: string; source?: string }) => (
                      <div key={v.id}>
                        <VectorBar
                          label={v.label.toUpperCase().slice(0, 18)}
                          value={Math.round(v.score)}
                          color={pressureColor(v.score)}
                        />
                        {v.dataStatus && v.dataStatus !== "live" && (
                          <div
                            className="text-[8px] font-mono mt-0.5 ml-1"
                            style={{ color: v.dataStatus === "static" ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.3)" }}
                            title={v.fallbackReason ?? v.dataStatus}
                          >
                            {v.dataStatus === "static" ? "⚠ STATIC BASELINE" : v.dataStatus === "fallback" ? "⚠ FALLBACK" : v.dataStatus === "delayed" ? "⏱ DELAYED" : v.dataStatus.toUpperCase()}
                            {v.source ? ` · ${v.source}` : ""}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] font-mono text-white/30">
                      {isLoading ? "LOADING CANONICAL VECTORS…" : "RISK VECTORS UNAVAILABLE — WITHHELD"}
                    </div>
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
                  desc: "Combines eight FRED series (HY spread, SOFR, 10Y and 2Y Treasury yields, CPI, PPI, Fed Funds, unemployment) and one static AI-concentration baseline into six weighted vectors and a single 0–100 score. It does not read VIX.",
                  color: "#00E5FF",
                },
                {
                  icon: "◉",
                  title: "Regime Classification",
                  desc: "Classifies market conditions into five regimes — from Low Risk to Systemic Crisis — enabling regime-aware position sizing and risk management.",
                  color: "#22D3EE",
                },
                {
                  icon: "◎",
                  title: "Data Freshness",
                  desc: "Powered by FRED data, including daily Treasury yields and credit spreads. Monthly series carry publication lag, and the AI-concentration input is a static reference value, not a live measurement. This page checks for a newly published reading every 60 seconds; each reading shows its as-of time.",
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
              <p className="text-white/30 text-xs mt-2">Shown inside the signed-in app. Paid plans are not on sale.</p>
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
                accentColor="#00E5FF"
              />
              <LockedCard
                title="CRYPTO INTELLIGENCE — PRO"
                description="Systemic risk scoring for BTC, ETH, and top altcoins. Narrative tracking, contagion analysis, and crypto regime classification."
                accentColor="#00E5FF"
              />
              <LockedCard
                title="AFTERSHOCK ENGINE™ — PRO"
                description="Contagion chain analysis. Maps how stress propagates across asset classes and identifies second-order shock vectors before they materialize."
                accentColor="#00E5FF"
              />
            </div>
          </div>

          {/* ASHA Pressure Brief */}
          <div className="mb-12">
            <SectionErrorBoundary label="PLATO Intelligence"><AshaIntelligenceBrief variant="pressure-brief" /></SectionErrorBoundary>
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
              FREE ACCOUNT · NO PAYMENT DETAILS
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Open the full reading
            </h2>
            <p className="text-white/40 text-sm max-w-md mx-auto mb-8 leading-relaxed">
              Sign in or create a free account to see NOW, WHY, OUTLOOK, WATCH and ACT for this reading.
              The Pressure Index and methodology stay free to read without an account. Paid plans are not on sale.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={getLoginUrl() || undefined}
                onClick={handleLoginCtaClick}
                data-cta="pressure-index-sign-in"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm tracking-widest transition-all active:scale-[0.97] cursor-pointer"
                style={{
                  background: color,
                  color: "#050608",
                  boxShadow: `0 0 30px ${color}40`,
                }}
              >
                SIGN IN / CREATE FREE ACCOUNT
              </a>
              <Link href="/methodology">
                <span
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm tracking-widest text-white/50 hover:text-white transition-all cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.14)" }}
                >
                  READ THE METHODOLOGY
                </span>
              </Link>
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

          <Link href="/">
            <span className="hover:text-white/35 transition-colors cursor-pointer">HOME</span>
          </Link>
        </div>
      </footer>
      <DisclaimerBanner variant="compact" />
    </div>
  );
}
