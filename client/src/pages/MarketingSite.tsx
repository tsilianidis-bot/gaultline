import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
const PLATFORM_URL = "/app";

// ── Asset URLs ────────────────────────────────────────────────
const ASSETS = {
  heroBg: "/manus-storage/faultline_hero_bg_7d6aaf14.jpg",
  dashboardMockup: "/manus-storage/faultline_dashboard_mockup_456bb973.jpg",
  macroIntel: "/manus-storage/faultline_macro_intel_09b4c85d.jpg",
  riskEngine: "/manus-storage/faultline_risk_engine_fd070c61.jpg",
  ctaAtmosphere: "/manus-storage/faultline_cta_atmosphere_93bd4048.jpg",
};

// ── Animated counter ──────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = target / 60;
      const tick = () => {
        start = Math.min(start + step, target);
        setVal(Math.floor(start));
        if (start < target) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Status ticker ─────────────────────────────────────────────
const TICKER_ITEMS = [
  "● LIVE — PRESSURE MONITOR ACTIVE",
  "FRED DATA STREAMING",
  "REGIME: LATE-CYCLE ELEVATED",
  "SIGNALS ENGINE: ONLINE",
  "TREASURY STRESS: ELEVATED",
  "AI CONCENTRATION: 74%",
  "VOLATILITY REGIME: SUPPRESSED",
  "LIQUIDITY CONDITIONS: TIGHTENING",
  "CREDIT SPREADS: WIDENING",
  "YIELD CURVE: INVERTED",
  "AFTERSHOCK ENGINE: SCANNING",
];

function StatusTicker() {
  return (
    <div className="w-full overflow-hidden bg-[#050608] border-b border-[rgba(0,212,255,0.15)] py-2 relative">
      {/* Scan-line shimmer overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: "linear-gradient(90deg, rgba(5,6,8,0.9) 0%, transparent 8%, transparent 92%, rgba(5,6,8,0.9) 100%)",
        }}
      />
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: "ticker 35s linear infinite" }}
      >
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="text-[10px] font-mono tracking-widest px-4" style={{
            color: item.startsWith('●') ? '#00FF88' : 'rgba(0,212,255,0.65)',
            textShadow: item.startsWith('●') ? '0 0 8px rgba(0,255,136,0.5)' : 'none',
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────
function Nav({ onRequestAccess }: { onRequestAccess: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(5,6,8,0.97)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(0,212,255,0.12)" : "none",
        backdropFilter: scrolled ? "blur(20px)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
          <span className="font-mono text-sm font-bold tracking-[0.3em] text-white">FAULTLINE</span>
          <span className="hidden sm:block text-[9px] font-mono tracking-[0.2em] text-[#00D4FF]/50 border-l border-[#00D4FF]/20 pl-3">
            SYSTEMIC RISK INTELLIGENCE
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="/blog" className="text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-[#00D4FF] transition-colors">BRIEFINGS</a>
          <a href="/track-record" className="text-[11px] font-mono tracking-widest transition-colors" style={{ color: '#22C55E', textShadow: '0 0 8px rgba(34,197,94,0.3)' }} onMouseEnter={e => (e.currentTarget.style.color = '#4ADE80')} onMouseLeave={e => (e.currentTarget.style.color = '#22C55E')}>
            TRACK RECORD <span style={{ fontSize: '7px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '1px 4px', borderRadius: '2px', letterSpacing: '0.1em', verticalAlign: 'middle' }}>VERIFIED</span>
          </a>
          {["Platform", "Intelligence", "Access", "How It Works"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              className="text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-[#00D4FF] transition-colors"
            >
              {item.toUpperCase()}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onRequestAccess}
            className="text-[11px] font-mono tracking-widest text-[#FFD700] hover:text-white transition-colors px-4 py-2 border border-[#FFD700]/30 hover:border-[#FFD700]/60 rounded"
          >
            REQUEST ACCESS
          </button>
          <a
            href={getLoginUrl()}
            className="text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-white transition-colors px-4 py-2 border border-[rgba(168,184,204,0.25)] hover:border-[rgba(168,184,204,0.55)] rounded"
          >
            MEMBER LOGIN
          </a>
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors px-4 py-2 rounded font-bold"
          >
            EXPLORE FREE →
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-[#A8B8CC] hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <div className="space-y-1">
            <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-1.5" : ""}`} />
            <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
            <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0C0F16] border-t border-[rgba(0,212,255,0.12)] px-6 py-4 space-y-4">
          <a
            href="/track-record"
            onClick={() => setMobileOpen(false)}
            className="block text-[11px] font-mono tracking-widest transition-colors"
            style={{ color: '#22C55E' }}
          >
            TRACK RECORD <span style={{ fontSize: '7px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '1px 4px', borderRadius: '2px', letterSpacing: '0.1em' }}>VERIFIED</span>
          </a>
          {["Platform", "Intelligence", "Access", "How It Works"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => setMobileOpen(false)}
              className="block text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-[#00D4FF] transition-colors"
            >
              {item.toUpperCase()}
            </a>
          ))}
          <button
            onClick={() => { onRequestAccess(); setMobileOpen(false); }}
            className="block w-full text-center text-[11px] font-mono tracking-widest text-[#FFD700] border border-[#FFD700]/30 rounded py-2"
          >
            REQUEST ACCESS
          </button>
          <a
            href={getLoginUrl()}
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center text-[11px] font-mono tracking-widest text-[#A8B8CC] border border-[rgba(168,184,204,0.25)] rounded py-2"
          >
            MEMBER LOGIN
          </a>
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] rounded py-2 font-bold"
          >
            EXPLORE FREE →
          </a>
        </div>
      )}
    </nav>
  );
}

// ── Live Stats Row ───────────────────────────────────────────
function HeroStats() {
  const { data } = trpc.user.publicStats.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const riskSignals = data?.riskSignals ?? 8400;
  const waitlistCount = data?.waitlistCount ?? 0;
  const stats = [
    { val: riskSignals, suffix: "+", label: "Risk Signals Live" },
    { val: 50, suffix: "+", label: "Data Sources" },
    { val: waitlistCount > 0 ? waitlistCount : null, suffix: "+", label: "Waitlist Members", fallback: "Open" },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
      {stats.map(({ val, suffix, label, fallback }) => (
        <div key={label}>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#00D4FF]">
            {val !== null ? <Counter target={val} suffix={suffix} /> : <span>{fallback}</span>}
          </div>
          <div className="text-[10px] font-mono tracking-widest text-[#64748B] mt-1">{label.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────
function Hero({ onRequestAccess }: { onRequestAccess: () => void }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050608]">
      {/* Cinematic hero background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${ASSETS.heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Dark overlay to keep text readable */}
      <div className="absolute inset-0 bg-[#050608]/70" />
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(0,212,255,0.08)_0%,transparent_70%)]" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#050608] to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-32 pb-20">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-[#00D4FF]/20 rounded-full mb-8 bg-[#00D4FF]/5" style={{ boxShadow: '0 0 20px rgba(0,212,255,0.08)' }}>
          <div className="relative flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]" />
            <div className="absolute w-3 h-3 rounded-full bg-[#00FF88]/20 animate-ping" />
          </div>
          <span className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/80">PLATFORM LIVE — FOUNDING ACCESS OPEN</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.05]">
          Know when the market<br />
          <span className="text-[#00D4FF]">is about to break.</span>
        </h1>

        {/* Clarity bar — what FAULTLINE tracks */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {["Macro Pressure", "Liquidity Stress", "Crypto Rotation", "Systemic Risk", "Volatility Regimes"].map((item, i) => (
            <span key={i} className="text-[9px] font-mono tracking-[0.2em] text-[#00D4FF]/60 border border-[#00D4FF]/15 px-2.5 py-1 rounded-full bg-[#00D4FF]/5">{item}</span>
          ))}
        </div>

        {/* Sub */}
        <p className="text-base sm:text-lg text-[#A8B8CC] max-w-2xl mx-auto mb-10 leading-relaxed">
          FAULTLINE reads systemic pressure before it becomes a headline. Real-time macro intelligence for traders and analysts who need to position early — not react late.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={onRequestAccess}
            className="w-full sm:w-auto px-8 py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#050608] font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97]"
          >
            REQUEST FOUNDING ACCESS
          </button>
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 border border-[#00D4FF]/40 hover:border-[#00D4FF] text-[#00D4FF] font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97]"
          >
            EXPLORE FREE — NO CARD REQUIRED →
          </a>
        </div>

        {/* Social share row */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#64748B]">SHARE</span>
          {/* Twitter/X */}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("FAULTLINE — See systemic market pressure before it moves the market. Real-time macro risk intelligence for serious investors.")}&url=${encodeURIComponent("https://getfaultline.live")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#00D4FF]/20 hover:border-[#00D4FF]/50 rounded text-[#64748B] hover:text-[#00D4FF] transition-all duration-150 active:scale-[0.97]"
            aria-label="Share on X (Twitter)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-[10px] font-mono tracking-[0.1em]">X / TWITTER</span>
          </a>
          {/* LinkedIn */}
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://getfaultline.live")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#00D4FF]/20 hover:border-[#00D4FF]/50 rounded text-[#64748B] hover:text-[#00D4FF] transition-all duration-150 active:scale-[0.97]"
            aria-label="Share on LinkedIn"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span className="text-[10px] font-mono tracking-[0.1em]">LINKEDIN</span>
          </a>
          {/* Copy link */}
          <button
            onClick={() => {
              navigator.clipboard.writeText("https://getfaultline.live").then(() => {
                const btn = document.getElementById("copy-link-btn");
                if (btn) { btn.textContent = "COPIED!"; setTimeout(() => { if (btn) btn.textContent = "COPY LINK"; }, 2000); }
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#00D4FF]/20 hover:border-[#00D4FF]/50 rounded text-[#64748B] hover:text-[#00D4FF] transition-all duration-150 active:scale-[0.97]"
            aria-label="Copy link"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            <span id="copy-link-btn" className="text-[10px] font-mono tracking-[0.1em]">COPY LINK</span>
          </button>
        </div>

        {/* Stats row — live data */}
        <HeroStats />
      </div>
    </section>
  );
}

// ── Visual Showcase ──────────────────────────────────────────
function VisualShowcaseSection({ onRequestAccess }: { onRequestAccess: () => void }) {
  return (
    <section className="py-0 bg-[#050608] relative overflow-hidden">
      {/* Dashboard mockup — full bleed cinematic reveal */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050608] via-transparent to-[#050608] z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050608]/80 via-transparent to-[#050608]/80 z-10 pointer-events-none" />
        <img
          src={ASSETS.dashboardMockup}
          alt="FAULTLINE Intelligence Platform Dashboard"
          className="w-full object-cover"
          style={{ maxHeight: "70vh", objectPosition: "top center" }}
          loading="lazy"
        />
        {/* Overlay label */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#050608]/90 border border-[#00D4FF]/20 rounded-lg backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
            <span className="text-[11px] font-mono tracking-[0.25em] text-[#00D4FF]/80">LIVE INTELLIGENCE TERMINAL — FOUNDING ACCESS OPEN</span>
          </div>
        </div>
      </div>

      {/* Macro Intel image + copy side by side */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-6">
              SYSTEMIC INTELLIGENCE
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.1]">
              Every asset class.<br />
              <span className="text-[#00D4FF]">Every pressure point.</span><br />
              One terminal.
            </h2>
            <p className="text-[#A8B8CC] text-base leading-relaxed mb-8">
              FAULTLINE maps contagion pathways across equities, bonds, crypto, commodities, and currencies — showing you where stress is concentrating before it cascades into a visible market event.
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Cross-asset contagion detection in real time",
                "AI concentration risk mapped to individual holdings",
                "Liquidity stress propagation across market layers",
                "Regime-aware signal classification for every asset",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="text-[#00D4FF] mt-0.5 flex-shrink-0">◈</span>
                  <span className="text-[#A8B8CC] text-sm">{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onRequestAccess}
              className="px-8 py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#050608] font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97]"
            >
              REQUEST FOUNDING ACCESS
            </button>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="absolute -inset-4 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,212,255,0.08)_0%,transparent_70%)]" />
            <div className="relative rounded-xl overflow-hidden border border-[rgba(0,212,255,0.15)] shadow-[0_0_60px_rgba(0,212,255,0.08)]">
              <img
                src={ASSETS.macroIntel}
                alt="Cross-asset systemic risk intelligence network"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────
const FEATURES = [
  { icon: "◈", title: "Live Macro Pressure Engine", desc: "Real-time synthesis of Treasury, inflation, liquidity, and credit signals into a single systemic-risk score." },
  { icon: "◉", title: "Treasury & Bond Market Stress", desc: "Track yield curve dynamics, auction demand, and sovereign credit conditions in real time." },
  { icon: "◎", title: "AI Bubble & Concentration Tracking", desc: "Monitor index concentration, AI-driven valuations, and capex cycles for signs of late-stage froth." },
  { icon: "◈", title: "Historical Crash Analog Engine", desc: "Compare today's macro conditions against historical regimes — 1929, 2000, 2008, 2020." },
  { icon: "◉", title: "Real-Time Regime Shift Detection", desc: "Identify transitions between expansion, late-cycle, contraction, and crisis regimes as they happen." },
  { icon: "◎", title: "Signals Intelligence Screener", desc: "Filter equities and assets by macro exposure, regime sensitivity, and systemic pressure correlation." },
  { icon: "◈", title: "Live Risk Alerts", desc: "Instant notifications when pressure thresholds break, regimes shift, or systemic anomalies surface." },
  { icon: "◉", title: "Liquidity & Credit Monitoring", desc: "Track repo rates, reserve balances, credit spreads, and funding stress across global markets." },
  { icon: "◈", title: "Complete Market Awareness™", desc: "Daily Market Preflight checklist — review the full risk picture before acting. Tracks which platform sections you have reviewed today and computes an awareness score from 0–100." },
];

function FeaturesSection() {
  return (
    <section id="platform" className="py-24 bg-[#050608] relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(0,212,255,0.03)_0%,transparent_70%)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-4">
            INTELLIGENCE ENGINE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Systemic intelligence.<br /><span className="text-[#00D4FF]">Before the fracture.</span>
          </h2>
          <p className="text-[#A8B8CC] max-w-2xl mx-auto text-base leading-relaxed">
            FAULTLINE converts live Treasury, inflation, liquidity, credit, and AI concentration data into a unified macroeconomic intelligence engine — built for traders, analysts, and institutions monitoring late-cycle market stress.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="group p-5 border border-[rgba(255,255,255,0.06)] rounded bg-[#0C0F16] hover:border-[rgba(0,212,255,0.25)] hover:bg-[#111520] transition-all duration-300"
            >
              <div className="text-[#00D4FF]/50 text-xl mb-3 group-hover:text-[#00D4FF] transition-colors">{f.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-2 leading-snug">{f.title}</h3>
              <p className="text-[#64748B] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Platform Modules ──────────────────────────────────────────
const MODULES = [
  {
    badge: "LIVE",
    badgeColor: "#00FF88",
    title: "FAULTLINE Pressure Index™",
    desc: "A unified systemic-risk score synthesizing macro, credit, liquidity, and AI concentration signals in real time. The single number that tells you where the market stands.",
    tags: ["Macro Synthesis", "Real-Time", "Regime Detection"],
  },
  {
    badge: "PREMIUM",
    badgeColor: "#FFD700",
    title: "Aftershock Engine™",
    desc: "Contagion and cascade risk detection. Identifies systemic fault lines before they fracture into market-wide dislocations. Proprietary scoring across 500+ assets.",
    tags: ["Contagion Risk", "Cascade Detection", "Systemic Scoring"],
  },
  {
    badge: "PREMIUM",
    badgeColor: "#FFD700",
    title: "Stock Intelligence Engine",
    desc: "Classifies individual equities by momentum, macro regime alignment, volatility, and systemic pressure exposure. Signal labels from Momentum Breakout to Recession Defensive.",
    tags: ["Momentum Analysis", "Regime Alignment", "Signal Labels"],
  },
  {
    badge: "PREMIUM",
    badgeColor: "#FFD700",
    title: "Crypto Intelligence",
    desc: "Real-time digital asset risk analysis across macro correlation, liquidity conditions, and systemic exposure. Full intelligence layer for the digital asset market.",
    tags: ["Digital Assets", "Macro Correlation", "Liquidity Risk"],
  },
  {
    badge: "LIVE",
    badgeColor: "#00D4FF",
    title: "Complete Market Awareness™",
    desc: "Market Preflight — a daily pre-decision review checklist. Before acting, review the full FAULTLINE risk picture: Pressure Index, regime, alerts, signal context, and possible future outcomes. Tracks your daily awareness score from 0–100.",
    tags: ["Daily Preflight", "Awareness Score", "Pre-Decision Review"],
  },
];

function ModulesSection() {
  return (
    <section id="intelligence" className="py-24 bg-[#0C0F16] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#FFD700]/60 border border-[#FFD700]/20 px-4 py-1.5 rounded-full mb-4">
            PLATFORM MODULES
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            The full <span className="text-[#FFD700]">intelligence stack.</span>
          </h2>
          <p className="text-[#A8B8CC] max-w-xl mx-auto text-base">
            Four interconnected intelligence engines. One unified platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MODULES.map((m, i) => (
            <div
              key={i}
              className="group relative p-6 border border-[rgba(255,255,255,0.07)] rounded-lg bg-[#050608] hover:border-[rgba(0,212,255,0.2)] transition-all duration-300 overflow-hidden"
            >
              {/* Glow on hover */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,212,255,0.04)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-[9px] font-mono tracking-[0.3em] px-2.5 py-1 rounded-full border"
                    style={{ color: m.badgeColor, borderColor: `${m.badgeColor}40`, background: `${m.badgeColor}10` }}
                  >
                    {m.badge}
                  </span>
                  <a
                    href={PLATFORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-[#00D4FF]/50 hover:text-[#00D4FF] transition-colors"
                  >
                    ACCESS →
                  </a>
                </div>
                <h3 className="text-white font-bold text-lg mb-3">{m.title}</h3>
                <p className="text-[#A8B8CC] text-sm leading-relaxed mb-4">{m.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {m.tags.map((tag) => (
                    <span key={tag} className="text-[9px] font-mono tracking-wider text-[#64748B] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 border border-[#00D4FF]/30 hover:border-[#00D4FF] text-[#00D4FF] font-mono text-sm tracking-widest rounded transition-all duration-150"
          >
            OPEN FULL PLATFORM →
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Risk Engine Visual Section ────────────────────────────────
function RiskEngineSection({ onRequestAccess }: { onRequestAccess: () => void }) {
  return (
    <section className="relative py-0 overflow-hidden bg-[#050608]">
      <div className="relative">
        {/* Risk engine image — full bleed */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050608] via-transparent to-[#050608] z-10 pointer-events-none" />
        <img
          src={ASSETS.riskEngine}
          alt="FAULTLINE Aftershock Risk Detection Engine"
          className="w-full object-cover opacity-60"
          style={{ maxHeight: "60vh" }}
          loading="lazy"
        />
        {/* Centered overlay content */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="text-center px-6 max-w-3xl">
            <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#FF2D55]/80 border border-[#FF2D55]/30 px-4 py-1.5 rounded-full mb-6 bg-[#FF2D55]/5">
              AFTERSHOCK ENGINE™
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 leading-[1.05]">
              Detect the cascade<br />
              <span className="text-[#00D4FF]">before it hits.</span>
            </h2>
            <p className="text-[#A8B8CC] text-base sm:text-lg max-w-xl mx-auto mb-8">
              The Aftershock Engine™ maps contagion pathways and systemic pressure cascades — identifying which markets will fracture next when stress begins to propagate.
            </p>
            <button
              onClick={onRequestAccess}
              className="px-8 py-4 bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97] shadow-[0_0_30px_rgba(255,45,85,0.3)]"
            >
              UNLOCK AFTERSHOCK ENGINE™
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Live Data Ingestion",
      desc: "FRED, Treasury, inflation, liquidity, AI concentration, and global market signals — streamed and parsed in real time, around the clock. 50+ data sources, zero manual refresh.",
    },
    {
      num: "02",
      title: "FAULTLINE Pressure Index™",
      desc: "Our proprietary macro-pressure algorithm converts raw market stress into a unified systemic-risk score — instantly revealing whether pressure is building or releasing across the full macro landscape.",
    },
    {
      num: "03",
      title: "Actionable Intelligence",
      desc: "Regime analysis, stock intelligence, systemic-pressure monitoring, and real-time risk alerts — delivered before the rest of the market catches the shift. Position early, not late.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#050608] relative">
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#00D4FF]/20 to-transparent" style={{ left: "50%" }} />
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-4">
            INTELLIGENCE PIPELINE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            From raw signals to<br /><span className="text-[#00D4FF]">actionable intelligence.</span>
          </h2>
        </div>

        <div className="space-y-8">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-6 sm:gap-10 items-start group">
              <div className="flex-shrink-0 w-14 h-14 border border-[#00D4FF]/20 rounded flex items-center justify-center bg-[#0C0F16] group-hover:border-[#00D4FF]/50 transition-colors">
                <span className="text-[#00D4FF] font-mono text-sm font-bold">{step.num}</span>
              </div>
              <div className="flex-1 pb-8 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-[#A8B8CC] text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Proof / Track Record Section ──────────────────────────────
function ProofSection() {
  const CRISIS_PROOF = [
    {
      period: "2000–2002",
      label: "Dot-com Bust",
      score: 68,
      regime: "HIGH RISK",
      regimeColor: "#f97316",
      regimeBg: "rgba(249,115,22,0.08)",
      regimeBorder: "rgba(249,115,22,0.3)",
      outcome: "S&P 500 fell ~49% from peak to trough over 30 months.",
      icon: "📉",
    },
    {
      period: "Oct 2008",
      label: "Lehman Collapse",
      score: 82,
      regime: "CRITICAL",
      regimeColor: "#ef4444",
      regimeBg: "rgba(239,68,68,0.08)",
      regimeBorder: "rgba(239,68,68,0.35)",
      outcome: "S&P 500 fell ~57% peak-to-trough. Unemployment hit 10%. 8 consecutive CRITICAL months.",
      icon: "🔴",
    },
    {
      period: "Mar 2020",
      label: "COVID Crash",
      score: 72,
      regime: "HIGH RISK",
      regimeColor: "#f97316",
      regimeBg: "rgba(249,115,22,0.08)",
      regimeBorder: "rgba(249,115,22,0.3)",
      outcome: "S&P 500 fell ~34% in 33 days. Model flagged HIGH RISK before the bottom.",
      icon: "⚡",
    },
  ];

  return (
    <section className="py-24 bg-[#050608] relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(34,197,94,0.04)_0%,transparent_70%)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.3em] px-4 py-1.5 rounded-full mb-5 border" style={{ color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            METHODOLOGY VALIDATED — 25 YEARS OF PROOF
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 leading-[1.1]">
            The engine called every<br />
            <span className="text-[#22C55E]">major crash since 2000.</span>
          </h2>
          <p className="text-[#A8B8CC] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            FAULTLINE's six-vector Pressure Engine was back-tested against 25 years of FRED macroeconomic data — the same engine running live today, applied to the same data that was available at the time. No hindsight. No curve-fitting.
          </p>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { val: "300+", label: "Monthly Readings", sub: "Jan 2000 → Today", color: "#00D4FF" },
            { val: "82", label: "Peak Score", sub: "Oct 2008 — CRITICAL", color: "#ef4444" },
            { val: "13%", label: "HIGH RISK+ Frequency", sub: "Reserved for real crises", color: "#f97316" },
            { val: "25 YRS", label: "Backtest Depth", sub: "Dot-com through today", color: "#22C55E" },
          ].map((s, i) => (
            <div key={i} className="p-5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#0C0F16] text-center">
              <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: s.color }}>{s.val}</div>
              <div className="text-white text-sm font-medium">{s.label}</div>
              <div className="text-[#64748B] text-[11px] font-mono mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Crisis callout cards — BEFORE/AFTER format */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {CRISIS_PROOF.map((c, i) => (
            <div
              key={i}
              className="rounded-lg border relative overflow-hidden"
              style={{ borderColor: c.regimeBorder, background: 'rgba(5,6,8,0.9)' }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: c.regimeBorder + '60' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[9px] font-mono tracking-[0.3em] text-[#64748B] mb-1">{c.period}</div>
                    <div className="text-white font-bold text-base leading-tight">{c.label}</div>
                  </div>
                  <div
                    className="flex-shrink-0 ml-3 text-center px-2.5 py-1.5 rounded"
                    style={{ background: c.regimeBg, border: `1px solid ${c.regimeBorder}` }}
                  >
                    <div className="text-2xl font-bold leading-none" style={{ color: c.regimeColor }}>{c.score}</div>
                    <div className="text-[8px] font-mono tracking-widest mt-0.5" style={{ color: c.regimeColor }}>{c.regime}</div>
                  </div>
                </div>
              </div>

              {/* BEFORE / AFTER */}
              <div className="px-5 py-4">
                {/* BEFORE */}
                <div className="mb-3">
                  <div className="text-[8px] font-mono tracking-[0.3em] text-[#64748B] mb-1.5">BEFORE — FAULTLINE SIGNAL</div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.regimeColor, boxShadow: `0 0 6px ${c.regimeColor}` }} />
                    <span className="text-sm font-mono font-bold" style={{ color: c.regimeColor }}>{c.regime}</span>
                    <span className="text-[#64748B] text-xs">flagged</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                  <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                </div>

                {/* AFTER */}
                <div>
                  <div className="text-[8px] font-mono tracking-[0.3em] text-[#64748B] mb-1.5">AFTER — ACTUAL OUTCOME</div>
                  <p className="text-[#A8B8CC] text-sm leading-relaxed">{c.outcome}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Methodology note + CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#0C0F16]">
          <div>
            <p className="text-[#64748B] text-xs font-mono leading-relaxed max-w-xl mb-2">
              All inputs are lagging FRED economic releases — Moody's Baa spreads, Treasury yields, CPI, unemployment. The engine cannot see the future. The backfill uses only data available at the time of each reading.
            </p>
            <p className="text-[#22C55E] text-[10px] font-mono tracking-[0.2em]">
              ✓ NO HINDSIGHT    ✓ NO CURVE-FITTING    ✓ SAME ENGINE RUNNING LIVE TODAY
            </p>
          </div>
          <a
            href="/track-record"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 border font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97] whitespace-nowrap"
            style={{ color: '#22C55E', borderColor: 'rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.05)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(34,197,94,0.7)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(34,197,94,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(34,197,94,0.4)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(34,197,94,0.05)'; }}
          >
            VIEW FULL TRACK RECORD
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Who It's For ──────────────────────────────────────────────
function AudienceSection() {
  const profiles = [
    {
      role: "Active Traders",
      sub: "Macro & Futures Desks",
      desc: "Detect pressure spikes hours before the headlines. Size positions ahead of regime shifts instead of reacting to them. FAULTLINE is the edge before the edge becomes consensus.",
      tags: ["Regime Timing", "Pressure Spikes", "Early Positioning"],
    },
    {
      role: "Investors & Allocators",
      sub: "Capital Preservation",
      desc: "Monitor late-cycle stress, AI concentration, and Treasury liquidity in a single intelligence layer. Know when systemic risk is building before it shows up in your portfolio.",
      tags: ["Tail Risk", "Capital Preservation", "Macro Overlay"],
    },
    {
      role: "Macro Analysts",
      sub: "Systemic Intelligence",
      desc: "Study regime shifts, historical crash analogs, and systemic-risk telemetry in real time. FAULTLINE gives you the data infrastructure that institutional desks spend millions building.",
      tags: ["Regime Analysis", "Crash Analogs", "Systemic Telemetry"],
    },
  ];

  return (
    <section className="py-24 bg-[#0C0F16]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-4">
            BUILT FOR
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Built for those who need to<br /><span className="text-[#00D4FF]">know before the market does.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {profiles.map((p, i) => (
            <div key={i} className="p-6 border border-[rgba(255,255,255,0.07)] rounded-lg bg-[#050608] hover:border-[rgba(0,212,255,0.2)] transition-all duration-300">
              <div className="mb-4">
                <div className="text-white font-bold text-lg">{p.role}</div>
                <div className="text-[#00D4FF]/60 text-sm font-mono tracking-wider mt-0.5">{p.sub}</div>
              </div>
              <p className="text-[#A8B8CC] text-sm leading-relaxed mb-4">{p.desc}</p>
              <div className="flex flex-wrap gap-2">
                {p.tags.map((tag) => (
                  <span key={tag} className="text-[9px] font-mono tracking-wider text-[#64748B] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── I WANT IN — Sleeper CTA Section ──────────────────────────
function IWantInSection({ onRequestAccess }: { onRequestAccess: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setRevealed(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#050608]">
      {/* Atmosphere background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${ASSETS.ctaAtmosphere})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Heavy dark overlay */}
      <div className="absolute inset-0 bg-[#050608]/80" />
      {/* Gradient fade top and bottom */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#050608] to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050608] to-transparent z-10" />

      <div ref={ref} className="relative z-20 min-h-[70vh] flex items-center justify-center py-32 px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-block text-[10px] font-mono tracking-[0.4em] text-[#FFD700]/60 border border-[#FFD700]/20 px-4 py-1.5 rounded-full mb-10">
            FOUNDING ACCESS — LIMITED AVAILABILITY
          </div>

          {/* Sleeper headline — reveals on scroll */}
          <div className="overflow-hidden mb-4">
            <h2
              className="text-[clamp(3rem,10vw,9rem)] font-black tracking-[-0.02em] leading-none transition-all duration-1000"
              style={{
                transform: revealed ? "translateY(0)" : "translateY(100%)",
                opacity: revealed ? 1 : 0,
                color: "transparent",
                WebkitTextStroke: "1px rgba(255,255,255,0.15)",
                transitionDelay: "0ms",
              }}
            >
              I WANT IN.
            </h2>
          </div>

          {/* Filled version layered on top — slightly delayed */}
          <div className="overflow-hidden -mt-[clamp(3rem,10vw,9rem)] mb-12">
            <h2
              className="text-[clamp(3rem,10vw,9rem)] font-black tracking-[-0.02em] leading-none transition-all duration-1000"
              style={{
                transform: revealed ? "translateY(0)" : "translateY(100%)",
                opacity: revealed ? 1 : 0,
                color: "#FFD700",
                transitionDelay: "150ms",
                textShadow: revealed ? "0 0 80px rgba(255,215,0,0.4), 0 0 160px rgba(255,215,0,0.15)" : "none",
              }}
            >
              I WANT IN.
            </h2>
          </div>

          {/* Supporting copy */}
          <p
            className="text-lg sm:text-xl text-[#A8B8CC] max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700"
            style={{ opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(20px)", transitionDelay: "400ms" }}
          >
            The intelligence advantage is real. The window is narrow. Founding access gives you the full platform — signals, pressure engine, Aftershock™, crypto intelligence — before the price changes.
          </p>

          {/* CTA buttons */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700"
            style={{ opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(20px)", transitionDelay: "600ms" }}
          >
            <button
              onClick={onRequestAccess}
              className="w-full sm:w-auto px-10 py-5 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#050608] font-mono font-black text-base tracking-[0.2em] rounded transition-all duration-150 active:scale-[0.97] shadow-[0_0_40px_rgba(255,215,0,0.3)] hover:shadow-[0_0_60px_rgba(255,215,0,0.5)]"
            >
              REQUEST FOUNDING ACCESS
            </button>
            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-10 py-5 border border-[#00D4FF]/40 hover:border-[#00D4FF] text-[#00D4FF] font-mono font-bold text-base tracking-[0.2em] rounded transition-all duration-150 active:scale-[0.97]"
            >
              LAUNCH PLATFORM →
            </a>
          </div>

          {/* Scarcity signal */}
          <div
            className="mt-10 flex items-center justify-center gap-2 transition-all duration-700"
            style={{ opacity: revealed ? 1 : 0, transitionDelay: "800ms" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#64748B]">FOUNDING SPOTS FILLING — ACCESS CLOSES WHEN CAPACITY IS REACHED</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────
function PricingSection({ onRequestAccess }: { onRequestAccess: () => void }) {
  const [annual, setAnnual] = useState(false);
  // Scarcity: founding slots remaining (static for now, can be made dynamic)
  const foundingSlots = 47;

  type Tier = {
    name: string;
    tagline: string;
    price: string;
    annualPrice?: string;
    annualSub?: string;
    priceSub: string;
    desc: string;
    features: string[];
    cta: string;
    ctaLink?: string;
    ctaAction?: () => void;
    featured: boolean;
    popularLabel?: string;
    scarcity?: boolean;
    accentColor: string;
    glowColor: string;
  };

  const tiers: Tier[] = [
    {
      name: "PREVIEW ACCESS",
      tagline: "Free Intelligence",
      price: "Free",
      priceSub: "no credit card required",
      desc: "Start monitoring systemic pressure. Discover what institutional intelligence feels like.",
      features: [
        "FAULTLINE Pressure Index™ (live preview)",
        "Limited stock intelligence previews",
        "Limited crypto signal previews",
        "Daily macro snapshot",
        "Teaser dashboards",
        "Limited market searches",
        "Public market briefings",
      ],
      cta: "Unlock Full Intelligence",
      ctaLink: PLATFORM_URL,
      featured: false,
      accentColor: "#64748B",
      glowColor: "rgba(100,116,139,0.12)",
    },
    {
      name: "FAULTLINE CORE",
      tagline: "Mobile-first market intelligence.",
      price: "$9.99",
      annualPrice: "$7.99",
      annualSub: "billed $95.88/year — save 20%",
      priceSub: "/month — cancel anytime",
      desc: "Fast, intelligent, connected. Built for traders who want institutional signals without the institutional price.",
      features: [
        "Limited stock signals (BUY/SELL/HOLD)",
        "Limited crypto signals",
        "Portfolio tracker with live P&L",
        "Alt Rotation tracking",
        "Daily market briefings",
        "Volatility monitoring",
        "Push alerts",
        "Watchlist",
        "Limited Aftershock alerts",
        "Macro snapshot feed",
      ],
      cta: "Get Core Access",
      ctaLink: PLATFORM_URL,
      featured: false,
      popularLabel: "MOST POPULAR ENTRY",
      accentColor: "#22D3EE",
      glowColor: "rgba(34,211,238,0.1)",
    },
    {
      name: "FAULTLINE PRO",
      tagline: "Institutional-grade intelligence.",
      price: "$59",
      annualPrice: "$47",
      annualSub: "billed $564/year — save 20%",
      priceSub: "/month — cancel anytime",
      desc: "The complete intelligence suite. Every engine, every signal, every edge — fully unlocked.",
      features: [
        "Everything in Core",
        "AI Diagnostic Intelligence™",
        "Full crypto intelligence engine",
        "Advanced market analysis",
        "Advanced systemic-risk engine",
        "Full dashboard suite",
        "Premium alerts",
        "Advanced watchlists",
        "Macro regime analysis",
        "Advanced Aftershock Engine™",
        "Historical analog engine",
        "Full risk scoring system",
      ],
      cta: "Upgrade to Pro",
      ctaAction: onRequestAccess,
      featured: true,
      accentColor: "#00D4FF",
      glowColor: "rgba(0,212,255,0.15)",
    },
    {
      name: "FOUNDING ACCESS",
      tagline: "Early institutional access.",
      price: "$49",
      priceSub: "/month — locked for life",
      desc: "Everything in Pro at the founding rate. Locked forever. Never increases. Limited cohort.",
      features: [
        "Everything in Pro",
        "Permanent discounted rate",
        "Founder badge",
        "Future feature grandfathering",
        "Roadmap previews",
        "Priority feature access",
        "Early beta systems",
        "Exclusive founder-only tools",
      ],
      cta: "Lock In $49/mo",
      ctaAction: onRequestAccess,
      featured: false,
      scarcity: true,
      accentColor: "#FFD700",
      glowColor: "rgba(255,215,0,0.12)",
    },
  ];

  return (
    <section id="access" className="py-24 bg-[#050608] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(0,212,255,0.03)_0%,transparent_70%)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-4">
            INTELLIGENCE ACCESS
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Start free. Scale to<br /><span className="text-[#00D4FF]">institutional intelligence.</span>
          </h2>
          <p className="text-[#A8B8CC] max-w-xl mx-auto text-base mb-8">
            From free monitoring to the full institutional suite — choose the tier that fits your edge.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-full px-5 py-2.5">
            <span className={`text-xs font-mono tracking-widest transition-colors ${
              !annual ? 'text-white' : 'text-[#64748B]'
            }`}>MONTHLY</span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-10 h-5 rounded-full transition-all duration-300"
              style={{ background: annual ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300"
                style={{ left: annual ? '22px' : '2px', boxShadow: annual ? '0 0 8px rgba(0,212,255,0.6)' : 'none' }}
              />
            </button>
            <span className={`text-xs font-mono tracking-widest transition-colors ${
              annual ? 'text-[#00D4FF]' : 'text-[#64748B]'
            }`}>ANNUAL</span>
            {annual && (
              <span className="text-[9px] font-mono font-bold tracking-widest text-[#00FF88] bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.25)] px-2 py-0.5 rounded-full">
                SAVE 20%
              </span>
            )}
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className="relative rounded-xl border transition-all duration-300 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, rgba(12,15,22,0.95) 0%, rgba(8,10,16,0.98) 100%)`,
                borderColor: tier.featured ? tier.accentColor + '50' : 'rgba(255,255,255,0.07)',
                boxShadow: tier.featured ? `0 0 40px ${tier.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)` : `inset 0 1px 0 rgba(255,255,255,0.03)`,
              }}
            >
              {/* Glass shimmer top border */}
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tier.accentColor}40, transparent)` }} />

              {/* Popular label */}
              {tier.popularLabel && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold tracking-widest px-4 py-1 rounded-full"
                  style={{ background: tier.accentColor + '20', border: `1px solid ${tier.accentColor}50`, color: tier.accentColor }}
                >
                  {tier.popularLabel}
                </div>
              )}

              {/* Recommended badge */}
              {tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00D4FF] text-[#050608] text-[9px] font-mono font-bold tracking-widest px-4 py-1 rounded-full">
                  RECOMMENDED
                </div>
              )}

              <div className="p-6">
                {/* Tier name + tagline */}
                <div className="mb-4">
                  <div className="text-[9px] font-mono tracking-[0.3em] mb-1" style={{ color: tier.accentColor + '80' }}>{tier.name}</div>
                  <div className="text-[11px] font-mono tracking-widest mb-3" style={{ color: tier.accentColor }}>{tier.tagline}</div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-3xl font-bold" style={{ color: tier.accentColor }}>
                      {annual && tier.annualPrice ? tier.annualPrice : tier.price}
                    </span>
                    {tier.price !== 'Free' && (
                      <span className="text-[11px] font-mono text-[#64748B]">{tier.priceSub}</span>
                    )}
                  </div>
                  {annual && tier.annualSub && (
                    <div className="text-[9px] font-mono text-[#00FF88]/70 mb-2">{tier.annualSub}</div>
                  )}
                  {!annual && tier.price === 'Free' && (
                    <div className="text-[10px] font-mono text-[#64748B] mb-2">{tier.priceSub}</div>
                  )}

                  <div className="text-[#A8B8CC] text-xs leading-relaxed mt-2">{tier.desc}</div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-[#A8B8CC]">
                      <span className="mt-0.5 flex-shrink-0 text-[10px]" style={{ color: tier.accentColor }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Scarcity block for Founding */}
                {tier.scarcity && (
                  <div
                    className="mb-4 rounded-lg p-3"
                    style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
                  >
                    <div className="text-[9px] font-mono tracking-widest text-[#FFD700]/70 mb-1">LIMITED FOUNDING COHORT</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-[#FFD700]">{foundingSlots} slots remaining</span>
                      <span className="text-[9px] font-mono text-[#FF9500] animate-pulse">CLOSING SOON</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(foundingSlots / 200) * 100}%`,
                          background: 'linear-gradient(90deg, #FFD700, #FF9500)',
                          boxShadow: '0 0 8px rgba(255,215,0,0.4)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* CTA */}
                {tier.ctaAction ? (
                  <button
                    onClick={tier.ctaAction}
                    className="w-full py-3 font-mono font-bold text-sm tracking-widest rounded-lg transition-all duration-200 active:scale-[0.97]"
                    style={{
                      background: tier.featured
                        ? tier.accentColor
                        : `${tier.accentColor}15`,
                      border: `1px solid ${tier.accentColor}${tier.featured ? 'ff' : '40'}`,
                      color: tier.featured ? '#050608' : tier.accentColor,
                      boxShadow: tier.featured ? `0 0 20px ${tier.accentColor}40` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!tier.featured) (e.currentTarget.style.background = `${tier.accentColor}25`);
                    }}
                    onMouseLeave={e => {
                      if (!tier.featured) (e.currentTarget.style.background = `${tier.accentColor}15`);
                    }}
                  >
                    {tier.cta.toUpperCase()}
                  </button>
                ) : (
                  <a
                    href={tier.ctaLink}
                    className="block w-full py-3 text-center font-mono font-bold text-sm tracking-widest rounded-lg transition-all duration-200"
                    style={{
                      background: `${tier.accentColor}10`,
                      border: `1px solid ${tier.accentColor}30`,
                      color: tier.accentColor,
                    }}
                    onMouseEnter={e => { (e.currentTarget.style.background = `${tier.accentColor}20`); }}
                    onMouseLeave={e => { (e.currentTarget.style.background = `${tier.accentColor}10`); }}
                  >
                    {tier.cta.toUpperCase()}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[#64748B] text-xs font-mono mt-8 tracking-widest">
          INSTITUTIONAL-GRADE MACRO INTELLIGENCE · ALL PLANS CANCEL ANYTIME · FOUNDING PRICING LOCKS AT SIGNUP
        </p>
      </div>
    </section>
  );
}

// ── FAULTLINE Core Mobile Showcase ──────────────────────────
function CoreMobileSection({ onRequestAccess }: { onRequestAccess: () => void }) {
  const tabs = [
    { label: "PULSE", icon: "◉", desc: "Live Pressure Index, regime status, bull/crash probability" },
    { label: "SIGNALS", icon: "⚡", desc: "Stock & crypto signals with BUY/SELL/HOLD labels" },
    { label: "WATCHLIST", icon: "★", desc: "Add any ticker or crypto, track signal status live" },
    { label: "ROTATION", icon: "↻", desc: "BTC dominance, sector momentum, risk-on/off status" },
    { label: "BRIEF", icon: "▤", desc: "Daily macro brief, top signal, top rotation note" },
  ];

  const sc = { score: 61, regime: "ELEVATED", regimeColor: "#FF9500", bull: 45, crash: 43 };
  const circumference = 2 * Math.PI * 44;

  return (
    <section className="py-24 bg-[#050608] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_30%_50%,rgba(34,211,238,0.04)_0%,transparent_70%)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#22D3EE]/60 border border-[#22D3EE]/20 px-4 py-1.5 rounded-full mb-6">
              MOBILE COMPANION
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
              FAULTLINE Core —<br />
              <span className="text-[#22D3EE]">Mobile Market Intelligence</span>
            </h2>
            <p className="text-[#A8B8CC] text-base leading-relaxed mb-4">
              Fast access to market signals, crypto rotation, volatility shifts, and daily macro intelligence — all in your pocket.
            </p>
            <p className="text-[#A8B8CC] text-sm leading-relaxed mb-8">
              FAULTLINE Core is a $9.99/month mobile companion. Install it to your iPhone or Android home screen and get institutional-grade signals without the institutional price.
            </p>

            {/* 5 tabs */}
            <div className="space-y-3 mb-8">
              {tabs.map((t) => (
                <div key={t.label} className="flex items-start gap-3">
                  <span className="text-[#22D3EE] font-mono text-sm mt-0.5 w-4 flex-shrink-0">{t.icon}</span>
                  <div>
                    <span className="text-[9px] font-mono tracking-widest text-[#22D3EE]/80 block mb-0.5">{t.label}</span>
                    <span className="text-xs text-[#A8B8CC]">{t.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Install instructions */}
            <div
              className="rounded-xl p-5 mb-8"
              style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.12)" }}
            >
              <div className="text-[9px] font-mono tracking-[0.25em] text-[#22D3EE]/60 mb-3">ADD TO HOME SCREEN</div>
              <div className="space-y-2">
                {[
                  { step: "1", text: "Open FAULTLINE Core in Safari on iPhone" },
                  { step: "2", text: "Tap the Share button (□↑) at the bottom" },
                  { step: "3", text: 'Scroll down and tap "Add to Home Screen"' },
                  { step: "4", text: "Tap Add — it launches like a native app" },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0"
                      style={{ background: "rgba(34,211,238,0.15)", color: "#22D3EE" }}
                    >{s.step}</span>
                    <span className="text-xs text-[#A8B8CC]">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/mobile"
                className="px-6 py-3 font-mono font-bold text-sm tracking-widest rounded-lg transition-all duration-200 active:scale-[0.97]"
                style={{
                  background: "rgba(34,211,238,0.15)",
                  border: "1px solid rgba(34,211,238,0.4)",
                  color: "#22D3EE",
                  boxShadow: "0 0 20px rgba(34,211,238,0.1)",
                }}
              >
                OPEN CORE APP →
              </a>
              <button
                onClick={onRequestAccess}
                className="px-6 py-3 font-mono font-bold text-sm tracking-widest rounded-lg transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#A8B8CC" }}
              >
                UPGRADE TO PRO
              </button>
            </div>
          </div>

          {/* Right — iPhone mockup */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Ambient glow */}
              <div
                className="absolute inset-0 rounded-[40px] blur-3xl"
                style={{ background: "radial-gradient(ellipse, rgba(34,211,238,0.15) 0%, transparent 70%)", transform: "scale(1.3)" }}
              />

              {/* Phone frame */}
              <div
                className="relative rounded-[40px] overflow-hidden"
                style={{
                  width: 280,
                  height: 580,
                  background: "#0A0C12",
                  border: "2px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 pt-3 pb-1">
                  <span className="text-[9px] font-mono text-[#64748B]">9:41</span>
                  <div className="w-20 h-5 rounded-full bg-[#0A0C12] border border-[rgba(255,255,255,0.1)]" />
                  <span className="text-[9px] font-mono text-[#64748B]">●●●</span>
                </div>

                {/* App top bar */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-[7px] font-mono tracking-[0.3em] text-[#22D3EE]/50">FAULTLINE CORE</div>
                    <div className="text-[8px] font-mono text-[#64748B]">PRESSURE ENGINE™</div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.2)] flex items-center justify-center">
                    <span className="text-[8px] text-[#22D3EE]">↻</span>
                  </div>
                </div>

                {/* Screen content */}
                <div className="px-4 py-2 flex flex-col items-center gap-3">
                  {/* Gauge */}
                  <div className="relative" style={{ width: 110, height: 110 }}>
                    <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={55} cy={55} r={44} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                      <circle
                        cx={55} cy={55} r={44}
                        fill="none"
                        stroke={sc.regimeColor}
                        strokeWidth={6}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - sc.score / 100)}
                        style={{ filter: `drop-shadow(0 0 6px ${sc.regimeColor}80)` }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold font-mono" style={{ color: sc.regimeColor }}>{sc.score}</span>
                      <span className="text-[7px] font-mono text-[#64748B]">/100</span>
                    </div>
                  </div>

                  {/* Regime badge */}
                  <div
                    className="px-3 py-1 rounded-full text-[8px] font-mono font-bold tracking-widest"
                    style={{ background: `${sc.regimeColor}15`, border: `1px solid ${sc.regimeColor}40`, color: sc.regimeColor }}
                  >
                    {sc.regime}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {[
                      { label: "BULL CONT.", value: `${sc.bull}%`, color: "#34D399" },
                      { label: "CRASH RISK", value: `${sc.crash}%`, color: "#FF9500" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-lg p-2 flex flex-col gap-0.5"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <span className="text-[6px] font-mono tracking-widest" style={{ color: s.color + "80" }}>{s.label}</span>
                        <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Risk bar */}
                  <div className="w-full rounded-lg p-2" style={{ background: "rgba(255,45,85,0.05)", border: "1px solid rgba(255,45,85,0.12)" }}>
                    <div className="text-[6px] font-mono tracking-widest text-[#FF9500]/70 mb-1">TOP RISK TODAY</div>
                    <div className="text-[9px] font-mono font-bold text-white">Credit Spread Widening</div>
                  </div>

                  {/* Locked Pro card */}
                  <div
                    className="w-full rounded-lg p-2 flex items-center justify-between"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div>
                      <div className="text-[6px] font-mono tracking-widest text-[#64748B]">PRO REQUIRED</div>
                      <div className="text-[8px] font-mono text-[#A8B8CC]">Diagnostic AI™ + Aftershock™</div>
                    </div>
                    <span
                      className="text-[7px] font-mono px-2 py-1 rounded"
                      style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", color: "#00D4FF" }}
                    >UPGRADE</span>
                  </div>
                </div>

                {/* Bottom nav */}
                <div
                  className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2"
                  style={{ background: "rgba(5,6,8,0.95)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {["PULSE", "SIGNALS", "WATCH", "ROTATE", "BRIEF"].map((tab, i) => (
                    <div key={tab} className="flex flex-col items-center gap-0.5">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ background: i === 0 ? "rgba(34,211,238,0.15)" : "transparent" }}
                      >
                        <span className="text-[8px]" style={{ color: i === 0 ? "#22D3EE" : "#64748B" }}>
                          {["◉", "⚡", "★", "↻", "▤"][i]}
                        </span>
                      </div>
                      <span className="text-[5px] font-mono" style={{ color: i === 0 ? "#22D3EE" : "#64748B" }}>{tab}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price badge floating — bottom right */}
              <div
                className="absolute -bottom-4 -right-4 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(12,15,22,0.95)",
                  border: "1px solid rgba(34,211,238,0.3)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 20px rgba(34,211,238,0.1)",
                }}
              >
                <div className="text-[8px] font-mono tracking-widest text-[#22D3EE]/60 mb-0.5">FAULTLINE CORE</div>
                <div className="text-xl font-bold text-[#22D3EE]">$9.99<span className="text-xs font-normal text-[#64748B]">/mo</span></div>
                <div className="text-[8px] font-mono text-[#64748B]">MOST POPULAR ENTRY</div>
              </div>

              {/* Pro badge floating — top left */}
              <div
                className="absolute -top-4 -left-4 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(12,15,22,0.95)",
                  border: "1px solid rgba(0,212,255,0.3)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 20px rgba(0,212,255,0.1)",
                }}
              >
                <div className="text-[8px] font-mono tracking-widest text-[#00D4FF]/60 mb-0.5">FAULTLINE PRO</div>
                <div className="text-xl font-bold text-[#00D4FF]">$59<span className="text-xs font-normal text-[#64748B]">/mo</span></div>
                <div className="text-[8px] font-mono text-[#64748B]">FULL INTELLIGENCE</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Founding Access Form ──────────────────────────────────────
function FoundingAccessForm
({ formRef }: { formRef: React.RefObject<HTMLDivElement | null> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const mutation = trpc.user.requestFoundingAccess.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message || "Something went wrong. Please email info@getfaultline.live"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) return;
    mutation.mutate({ name: name.trim(), email: email.trim(), message: message.trim() });
  };

  return (
    <section id="access-form" className="py-24 bg-[#0C0F16] relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(0,212,255,0.04)_0%,transparent_70%)]" />
      <div ref={formRef} className="max-w-2xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-4">
            FOUNDING ACCESS
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Request access to the<br /><span className="text-[#00D4FF]">FAULTLINE intelligence platform.</span>
          </h2>
          <p className="text-[#A8B8CC] text-sm leading-relaxed">
            Founding access is limited. Tell us about your background and we will review your request within 24 hours.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 border border-[#00FF88]/30 rounded-lg bg-[#00FF88]/5 text-center">
            <div className="text-[#00FF88] text-3xl mb-4">✓</div>
            <div className="text-white font-bold text-lg mb-2">Request Received</div>
            <div className="text-[#A8B8CC] text-sm">
              Your founding access request has been received. We will be in touch within 24 hours.
            </div>
            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-6 px-6 py-3 border border-[#00D4FF]/30 hover:border-[#00D4FF] text-[#00D4FF] font-mono text-sm tracking-widest rounded transition-all"
            >
              EXPLORE PLATFORM →
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 p-8 border border-[rgba(255,255,255,0.07)] rounded-lg bg-[#050608]">
            <div>
              <label className="block text-[10px] font-mono tracking-[0.2em] text-[#64748B] mb-2">YOUR NAME *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full bg-[#0C0F16] border border-[rgba(255,255,255,0.08)] focus:border-[#00D4FF]/40 rounded px-4 py-3 text-white text-sm font-mono placeholder-[#4B5563] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-[0.2em] text-[#64748B] mb-2">EMAIL ADDRESS *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.com"
                required
                className="w-full bg-[#0C0F16] border border-[rgba(255,255,255,0.08)] focus:border-[#00D4FF]/40 rounded px-4 py-3 text-white text-sm font-mono placeholder-[#4B5563] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-[0.2em] text-[#64748B] mb-2">BACKGROUND / ROLE</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Macro analyst, portfolio manager, systematic trader, allocator..."
                rows={3}
                className="w-full bg-[#0C0F16] border border-[rgba(255,255,255,0.08)] focus:border-[#00D4FF]/40 rounded px-4 py-3 text-white text-sm font-mono placeholder-[#4B5563] outline-none transition-colors resize-none"
              />
            </div>
            {error && (
              <div className="text-[#FF2D55] text-sm font-mono border border-[#FF2D55]/20 bg-[#FF2D55]/5 rounded px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 disabled:opacity-50 text-[#050608] font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97]"
            >
              {mutation.isPending ? "SUBMITTING..." : "REQUEST FOUNDING ACCESS"}
            </button>
            <p className="text-center text-[#4B5563] text-[10px] font-mono">
              Or email us directly at{" "}
              <a href="mailto:info@getfaultline.live" className="text-[#00D4FF]/60 hover:text-[#00D4FF]">
                info@getfaultline.live
              </a>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#050608] border-t border-[rgba(255,255,255,0.06)] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse" />
              <span className="font-mono text-sm font-bold tracking-[0.3em] text-white">FAULTLINE</span>
            </div>
            <div className="text-[9px] font-mono tracking-[0.2em] text-[#00D4FF]/40 mb-4">SYSTEMIC RISK INTELLIGENCE</div>
            <p className="text-[#64748B] text-sm leading-relaxed">
              Real-time macroeconomic and systemic-risk intelligence. FAULTLINE converts live Treasury, inflation, liquidity, credit, and AI concentration data into a unified pressure index — before markets react.
            </p>
          </div>

          {/* Platform */}
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-[#64748B] mb-4">PLATFORM</div>
            <ul className="space-y-2">
              {["Pressure Index™", "Regime Detection", "Crash Analog Engine", "Live Risk Alerts", "Aftershock Engine™"].map((item) => (
                <li key={item}>
                  <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer" className="text-[#A8B8CC] hover:text-[#00D4FF] text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Intelligence */}
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-[#64748B] mb-4">INTELLIGENCE</div>
            <ul className="space-y-2">
              {["Treasury & Bond Stress", "Liquidity & Credit", "AI Concentration", "Stock Intelligence", "Crypto Intelligence"].map((item) => (
                <li key={item}>
                  <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer" className="text-[#A8B8CC] hover:text-[#00D4FF] text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Access */}
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-[#64748B] mb-4">ACCESS</div>
            <ul className="space-y-2">
              <li>
                <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] hover:text-[#00D4FF]/80 text-sm transition-colors font-mono">
                  Launch Platform →
                </a>
              </li>
              <li><a href="#access-form" className="text-[#A8B8CC] hover:text-[#00D4FF] text-sm transition-colors">Founding Access — $49/mo</a></li>
              <li><a href="#access" className="text-[#A8B8CC] hover:text-[#00D4FF] text-sm transition-colors">Pricing Tiers</a></li>
              <li><a href="mailto:info@getfaultline.live" className="text-[#A8B8CC] hover:text-[#00D4FF] text-sm transition-colors">General Inquiries</a></li>
              <li><a href="mailto:admin@getfaultline.live" className="text-[#A8B8CC] hover:text-[#00D4FF] text-sm transition-colors">Admin</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.05)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[#4B5563] text-[10px] font-mono">
            © 2026 FAULTLINE. All rights reserved.
          </div>
          <div className="text-[#00D4FF]/40 text-[10px] font-mono tracking-widest">
            MONITOR THE PRESSURE. BEFORE THE SHIFT.
          </div>
          <div className="text-[#4B5563] text-[10px] font-mono">
            <span className="flex gap-3 flex-wrap justify-center sm:justify-end">
              <a href="/legal" className="hover:text-[#00D4FF] transition-colors">Privacy Policy</a>
              <span className="opacity-30">·</span>
              <a href="/legal" className="hover:text-[#00D4FF] transition-colors">Terms of Use</a>
              <span className="opacity-30">·</span>
              <a href="mailto:info@getfaultline.live" className="hover:text-[#00D4FF] transition-colors">info@getfaultline.live</a>
              <span className="opacity-30">·</span>
              <a href="mailto:admin@getfaultline.live" className="hover:text-[#00D4FF] transition-colors">admin@getfaultline.live</a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── About / Origin ──────────────────────────────────────────
function AboutSection() {
  return (
    <section id="about" className="py-24 bg-[#0C0F16] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_0%_50%,rgba(0,212,255,0.04)_0%,transparent_70%)]" />
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left: narrative */}
          <div>
            <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-6">
              WHY FAULTLINE EXISTS
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
              Most traders see the crash.<br />
              <span className="text-[#00D4FF]">We built the tool to see it coming.</span>
            </h2>
            <p className="text-[#A8B8CC] text-sm leading-relaxed mb-4">
              Every major market dislocation — 2008, 2020, 2022 — had a pressure signature weeks before the break. Yield curves inverted. Liquidity dried up. Volatility suppression gave way. The signals were there. Most people just didn't have a single place to read them.
            </p>
            <p className="text-[#A8B8CC] text-sm leading-relaxed mb-4">
              FAULTLINE was built to solve that. We aggregate macro stress indicators, credit spreads, Treasury liquidity, AI concentration risk, and regime telemetry into one unified pressure score — the <span className="text-[#00D4FF] font-mono">FAULTLINE Pressure Index™</span>.
            </p>
            <p className="text-[#A8B8CC] text-sm leading-relaxed">
              It's not a prediction engine. It's a pressure gauge. When the gauge is elevated, you pay attention. When it spikes, you act. That's the edge.
            </p>
          </div>
          {/* Right: stats/facts */}
          <div className="space-y-4">
            {[
              { num: "8,400+", label: "Risk signals processed daily", color: "#00D4FF" },
              { num: "50+", label: "Macro data sources (FRED, Polygon, CoinGecko)", color: "#00D4FF" },
              { num: "6", label: "Proprietary intelligence engines", color: "#FFD700" },
              { num: "Real-time", label: "Pressure Index updates — not end-of-day", color: "#00FF88" },
            ].map(({ num, label, color }) => (
              <div key={label} className="flex items-start gap-4 p-4 border border-[rgba(255,255,255,0.05)] rounded-lg bg-[#050608] hover:border-[rgba(0,212,255,0.15)] transition-colors">
                <div className="flex-shrink-0 font-mono font-bold text-xl" style={{ color }}>{num}</div>
                <div className="text-[#A8B8CC] text-sm leading-relaxed">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function MarketingSite() {
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "FAULTLINE — Market Risk Intelligence Platform";
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <StatusTicker />
      <Nav onRequestAccess={scrollToForm} />
      <Hero onRequestAccess={scrollToForm} />
      <AboutSection />
      <VisualShowcaseSection onRequestAccess={scrollToForm} />
      <FeaturesSection />
      <ModulesSection />
      <RiskEngineSection onRequestAccess={scrollToForm} />
      <HowItWorksSection />
      <ProofSection />
      <AudienceSection />
      <IWantInSection onRequestAccess={scrollToForm} />
      <PricingSection onRequestAccess={scrollToForm} />
      <CoreMobileSection onRequestAccess={scrollToForm} />
      <FoundingAccessForm formRef={formRef} />
      <Footer />
    </div>
  );
}
