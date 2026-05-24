import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

const PLATFORM_URL = "https://faultline-ku53w5db.manus.space";

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
];

function StatusTicker() {
  return (
    <div className="w-full overflow-hidden bg-[#050608] border-b border-[rgba(0,212,255,0.15)] py-2">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: "ticker 30s linear infinite" }}
      >
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="text-[10px] font-mono tracking-widest text-[#00D4FF]/70 px-4">
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
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors px-4 py-2 rounded font-bold"
          >
            LAUNCH PLATFORM →
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
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] rounded py-2 font-bold"
          >
            LAUNCH PLATFORM →
          </a>
        </div>
      )}
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────
function Hero({ onRequestAccess }: { onRequestAccess: () => void }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050608]">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(0,212,255,0.06)_0%,transparent_70%)]" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#050608] to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-32 pb-20">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-[#00D4FF]/20 rounded-full mb-8 bg-[#00D4FF]/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
          <span className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/80">PLATFORM LIVE — FOUNDING ACCESS OPEN</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.05]">
          See the pressure<br />
          <span className="text-[#00D4FF]">before it moves</span><br />
          the market.
        </h1>

        {/* Sub */}
        <p className="text-base sm:text-lg text-[#A8B8CC] max-w-2xl mx-auto mb-10 leading-relaxed">
          FAULTLINE is a real-time macroeconomic risk intelligence platform that shows institutional traders and analysts when systemic pressure is building — so you can position early instead of reacting late.
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
            LAUNCH PLATFORM →
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
          {[
            { val: 8400, suffix: "+", label: "Risk Signals Live" },
            { val: 50, suffix: "+", label: "Data Sources" },
            { val: 99, suffix: ".8%", label: "Platform Uptime" },
          ].map(({ val, suffix, label }) => (
            <div key={label}>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-[#00D4FF]">
                <Counter target={val} suffix={suffix} />
              </div>
              <div className="text-[10px] font-mono tracking-widest text-[#64748B] mt-1">{label.toUpperCase()}</div>
            </div>
          ))}
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
              <p className="text-[#64748B] text-xs leading-relaxed">{f.desc}</p>
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
                <div className="text-[#00D4FF]/60 text-xs font-mono tracking-wider mt-0.5">{p.sub}</div>
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

// ── Pricing ───────────────────────────────────────────────────
function PricingSection({ onRequestAccess }: { onRequestAccess: () => void }) {
  const tiers = [
    {
      name: "OBSERVER",
      price: "Free",
      desc: "Start monitoring systemic pressure with limited access.",
      features: [
        "Homepage & public previews",
        "Limited live metrics",
        "Basic macro snapshots",
        "Teaser dashboards",
        "FAULTLINE Pressure Index™ (preview)",
      ],
      cta: "Join Free",
      ctaLink: PLATFORM_URL,
      featured: false,
    },
    {
      name: "FOUNDING MEMBER",
      price: "Limited Access",
      desc: "Full intelligence platform. Founding pricing locked for life.",
      features: [
        "Full FAULTLINE intelligence platform",
        "Aftershock Engine™",
        "Stock & Crypto Intelligence",
        "Advanced dashboards",
        "Real-time risk alerts",
        "Proprietary scoring systems",
        "Full watchlists & search",
        "Founding pricing locked for life",
        "Priority onboarding",
      ],
      cta: "Request Founding Access",
      ctaAction: onRequestAccess,
      featured: true,
    },
    {
      name: "INSTITUTIONAL",
      price: "Coming Soon",
      desc: "Enterprise-grade intelligence with API access and dedicated support.",
      features: [
        "Everything in Founding",
        "Full API access",
        "Custom data streams",
        "Dedicated analyst support",
        "White-label options",
        "SLA guarantees",
      ],
      cta: "Join Waitlist",
      ctaAction: onRequestAccess,
      featured: false,
    },
  ];

  return (
    <section id="access" className="py-24 bg-[#050608] relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(255,215,0,0.03)_0%,transparent_70%)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#FFD700]/60 border border-[#FFD700]/20 px-4 py-1.5 rounded-full mb-4">
            FOUNDING ACCESS
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Markets fracture slowly…<br /><span className="text-[#FFD700]">then all at once.</span>
          </h2>
          <p className="text-[#A8B8CC] max-w-xl mx-auto text-base">
            Monitor the pressure before the shift. Founding access is limited and open now.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={`relative p-6 rounded-lg border transition-all duration-300 ${
                tier.featured
                  ? "border-[#FFD700]/40 bg-[#0C0F16] shadow-[0_0_40px_rgba(255,215,0,0.08)]"
                  : "border-[rgba(255,255,255,0.07)] bg-[#0C0F16]"
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-[#050608] text-[9px] font-mono font-bold tracking-widest px-4 py-1 rounded-full">
                  RECOMMENDED
                </div>
              )}
              <div className="mb-5">
                <div className="text-[10px] font-mono tracking-[0.3em] text-[#64748B] mb-1">{tier.name}</div>
                <div className={`text-2xl font-bold mb-1 ${tier.featured ? "text-[#FFD700]" : "text-white"}`}>{tier.price}</div>
                <div className="text-[#A8B8CC] text-xs leading-relaxed">{tier.desc}</div>
              </div>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#A8B8CC]">
                    <span className={`mt-0.5 flex-shrink-0 ${tier.featured ? "text-[#FFD700]" : "text-[#00D4FF]"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {tier.ctaAction ? (
                <button
                  onClick={tier.ctaAction}
                  className={`w-full py-3 font-mono font-bold text-sm tracking-widest rounded transition-all duration-150 active:scale-[0.97] ${
                    tier.featured
                      ? "bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#050608]"
                      : "border border-[rgba(255,255,255,0.15)] hover:border-[#00D4FF]/40 text-white"
                  }`}
                >
                  {tier.cta.toUpperCase()}
                </button>
              ) : (
                <a
                  href={tier.ctaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 text-center font-mono font-bold text-sm tracking-widest rounded border border-[rgba(255,255,255,0.15)] hover:border-[#00D4FF]/40 text-white transition-all duration-150"
                >
                  {tier.cta.toUpperCase()}
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[#64748B] text-xs font-mono mt-8">
          Institutional-grade macro intelligence. Founding pricing locks at signup. Cancel anytime.
        </p>
      </div>
    </section>
  );
}

// ── Founding Access Form ──────────────────────────────────────
function FoundingAccessForm({ formRef }: { formRef: React.RefObject<HTMLDivElement | null> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const mutation = trpc.user.requestFoundingAccess.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message || "Something went wrong. Please email admin@getfaultline.live"),
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
              <div className="text-[#FF2D55] text-xs font-mono border border-[#FF2D55]/20 bg-[#FF2D55]/5 rounded px-4 py-3">
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
              <a href="mailto:admin@getfaultline.live" className="text-[#00D4FF]/60 hover:text-[#00D4FF]">
                admin@getfaultline.live
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
            <p className="text-[#64748B] text-xs leading-relaxed">
              Real-time macroeconomic and systemic-risk intelligence. FAULTLINE converts live Treasury, inflation, liquidity, credit, and AI concentration data into a unified pressure index — before markets react.
            </p>
          </div>

          {/* Platform */}
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-[#64748B] mb-4">PLATFORM</div>
            <ul className="space-y-2">
              {["Pressure Index™", "Regime Detection", "Crash Analog Engine", "Live Risk Alerts", "Aftershock Engine™"].map((item) => (
                <li key={item}>
                  <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer" className="text-[#A8B8CC] hover:text-[#00D4FF] text-xs transition-colors">
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
                  <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer" className="text-[#A8B8CC] hover:text-[#00D4FF] text-xs transition-colors">
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
                <a href={PLATFORM_URL} target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] hover:text-[#00D4FF]/80 text-xs transition-colors font-mono">
                  Launch Platform →
                </a>
              </li>
              <li><a href="#access-form" className="text-[#A8B8CC] hover:text-[#00D4FF] text-xs transition-colors">Request Founding Access</a></li>
              <li><a href="#access" className="text-[#A8B8CC] hover:text-[#00D4FF] text-xs transition-colors">Pricing Tiers</a></li>
              <li><a href="mailto:admin@getfaultline.live" className="text-[#A8B8CC] hover:text-[#00D4FF] text-xs transition-colors">Contact</a></li>
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
            <a href="mailto:admin@getfaultline.live" className="hover:text-[#00D4FF] transition-colors">
              admin@getfaultline.live
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function MarketingSite() {
  const formRef = useRef<HTMLDivElement>(null);

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
      <FeaturesSection />
      <ModulesSection />
      <HowItWorksSection />
      <AudienceSection />
      <PricingSection onRequestAccess={scrollToForm} />
      <FoundingAccessForm formRef={formRef} />
      <Footer />
    </div>
  );
}
