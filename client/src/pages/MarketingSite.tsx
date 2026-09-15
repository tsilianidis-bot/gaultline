import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PRICING_PLANS } from "../../../shared/tiers";
import { getLoginUrl } from "@/const";
import { useSEO } from "@/hooks/useSEO";
import { trackPricingViewed, trackStartFreeClicked } from "@/hooks/useAnalytics";

const PLATFORM_URL = "/app";
const HERO_BACKGROUND = "/manus-storage/faultline_hero_bg_7d6aaf14.jpg";

const navItems = [
  { label: "Methodology", href: "#methodology" },
  { label: "Pentagonal Thesis", href: "#thesis" },
  { label: "Intelligence System", href: "#system" },
  { label: "Historical Intelligence", href: "#historical" },
  { label: "Pricing", href: "#access" },
];

const thesisQuestions = [
  {
    number: "01",
    question: "What’s happening?",
    description: "Establish the current market state across systemic pressure, regime, liquidity, volatility, credit, breadth, positioning, and cross-asset behavior.",
    emphasis: "State before story",
  },
  {
    number: "02",
    question: "Why?",
    description: "Identify the forces driving the state, while separating observed conditions from FAULTLINE’s interpretation of their significance.",
    emphasis: "Evidence before narrative",
  },
  {
    number: "03",
    question: "What’s next?",
    description: "Frame plausible paths, consequences, and uncertainty. Scenarios are not forecasts presented as certainty.",
    emphasis: "Scenarios before certainty",
  },
  {
    number: "04",
    question: "What should I watch?",
    description: "Track thresholds, divergences, confirmations, and invalidations that can strengthen or weaken the current interpretation.",
    emphasis: "Confirmation before conviction",
  },
  {
    number: "05",
    question: "What should I do?",
    description: "Translate intelligence into decision awareness: exposure, risk, patience, preparation, and positioning context—not simplistic buy or sell commands.",
    emphasis: "Awareness before action",
  },
];

const methodologySteps = [
  ["01", "Collect", "Bring together market, macro, liquidity, credit, volatility, and cross-asset inputs."],
  ["02", "Structure", "Separate current observations, derived indicators, historical context, and interpretation."],
  ["03", "Compare", "Evaluate change, persistence, divergence, and relevant historical context."],
  ["04", "Explain", "State the evidence, uncertainty, confirmation criteria, and what matters next."],
] as const;

const systemGroups = [
  {
    label: "Market State",
    description: "A structured read of present conditions.",
    items: ["Pressure Index™", "Regime analysis", "Risk vectors", "Cross-asset conditions"],
  },
  {
    label: "Signals",
    description: "Market-aware intelligence for instruments and rotations.",
    items: ["Equity intelligence", "Macro-aware signals", "Rotation context", "Watchlists"],
  },
  {
    label: "Historical Context",
    description: "Use history as context—not as a guarantee.",
    items: ["Historical Truth Engine™", "Time Machine", "Analog analysis", "Aftershock Engine™"],
  },
  {
    label: "Interpretation",
    description: "Current product capabilities that turn evidence into context.",
    items: ["ASHA market explanation", "Scenario framing", "Evidence retrieval", "Decision awareness"],
  },
];

const earlyWarningRelationships = [
  ["Liquidity", "Equity conditions"],
  ["Credit", "Equity strength"],
  ["Volatility", "Complacency"],
  ["Breadth", "Index concentration"],
  ["Rates", "Risk assets"],
  ["Crypto", "Broader risk appetite"],
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[10px] font-mono font-semibold tracking-[0.28em] text-[#00D4FF]">{children}</p>;
}

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 7.5h10M8.8 3.7l3.7 3.8-3.7 3.8" />
    </svg>
  );
}

function StatusStrip() {
  return (
    <div className="border-b border-[#00D4FF]/15 bg-[#050608] px-4 py-2 text-center">
      <p className="text-[9px] font-mono tracking-[0.22em] text-[#00D4FF]/75">
        FAULTLINE MARKET RISK INTELLIGENCE <span className="mx-2 text-white/20">/</span> EVIDENCE-FIRST MARKET AWARENESS
      </p>
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#050608]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" onClick={close}>
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#00FF88]/50" />
            <span className="relative h-2 w-2 rounded-full bg-[#00D4FF]" />
          </span>
          <span className="font-mono text-sm font-black tracking-[0.28em] text-white">FAULTLINE</span>
          <span className="hidden border-l border-white/10 pl-3 text-[9px] font-mono tracking-[0.2em] text-[#A8B8CC]/60 lg:inline">MARKET RISK INTELLIGENCE</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Marketing navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-[10px] font-mono tracking-[0.12em] text-[#A8B8CC] transition-colors hover:text-[#00D4FF]">
              {item.label.toUpperCase()}
            </a>
          ))}
          <a href="/blog" className="text-[10px] font-mono tracking-[0.12em] text-[#A8B8CC] transition-colors hover:text-[#00D4FF]">RESEARCH</a>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a href={getLoginUrl()} className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-mono tracking-[0.14em] text-[#A8B8CC] transition-colors hover:border-[#00D4FF]/50 hover:text-white">SIGN IN</a>
          <a href="#access" className="rounded-lg bg-[#00D4FF] px-3 py-2 text-[10px] font-mono font-black tracking-[0.14em] text-[#050608] transition-colors hover:bg-[#6EE7FF]">FOUNDING ACCESS</a>
        </div>

        <button type="button" className="rounded-lg border border-white/15 p-3 text-[#A8B8CC] lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close navigation" : "Open navigation"}>
          <span className="block h-px w-5 bg-current" />
          <span className="my-1 block h-px w-5 bg-current" />
          <span className="block h-px w-5 bg-current" />
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/[0.07] bg-[#080B10] px-5 py-4 lg:hidden" aria-label="Mobile marketing navigation">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={close} className="rounded-lg px-3 py-3 text-[12px] font-mono tracking-[0.12em] text-white/85 active:bg-white/5">
                {item.label.toUpperCase()}
              </a>
            ))}
            <a href="/blog" onClick={close} className="rounded-lg px-3 py-3 text-[12px] font-mono tracking-[0.12em] text-white/85 active:bg-white/5">RESEARCH</a>
            <a href="#access" onClick={close} className="mt-2 rounded-lg bg-[#00D4FF] px-3 py-3 text-center text-[12px] font-mono font-black tracking-[0.12em] text-[#050608]">GET FOUNDING LIFETIME ACCESS — $299</a>
          </div>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[#00D4FF]/10 bg-[#050608]">
      <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: `url(${HERO_BACKGROUND})` }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_20%_35%,rgba(0,212,255,0.16),transparent_60%),linear-gradient(180deg,rgba(5,6,8,0.25),#050608_92%)]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(0,212,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,1)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="relative mx-auto grid min-h-[calc(100svh-102px)] max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/5 px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" />
            <span className="text-[10px] font-mono tracking-[0.24em] text-[#00D4FF]">INSTITUTIONAL-STYLE MARKET INTELLIGENCE</span>
          </div>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            Recognize when the market environment <span className="text-[#00D4FF]">has changed.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#C7D2DF] sm:text-xl">
            FAULTLINE turns fragmented market, macro, liquidity, credit, volatility, and positioning data into a structured view of market risk—so investors can understand what is happening, why it matters, and what to watch next.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#8291A6] sm:text-base">
            Not another prediction engine. A market intelligence system built to identify changing conditions before they become obvious in headline narratives.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href={PLATFORM_URL} onClick={() => trackStartFreeClicked("marketing_rebuild_hero")} className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-[#00D4FF] px-7 py-4 text-center text-[12px] font-mono font-black tracking-[0.13em] text-[#050608] shadow-[0_0_36px_rgba(0,212,255,0.25)] transition hover:bg-[#6EE7FF] active:scale-[0.98]">
              SEE TODAY’S MARKET ENVIRONMENT <Arrow />
            </a>
            <a href="/app/pressure" className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl border border-[#00D4FF]/35 bg-[#00D4FF]/5 px-7 py-4 text-center text-[12px] font-mono font-bold tracking-[0.13em] text-[#00D4FF] transition hover:border-[#00D4FF]/70 hover:bg-[#00D4FF]/10 active:scale-[0.98]">
              EXPLORE THE PRESSURE INDEX™
            </a>
          </div>
          <p className="mt-4 text-[11px] font-mono tracking-wide text-[#718096]">Free market-environment preview available. Not investment advice.</p>
        </div>

        <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-[#00D4FF]/20 bg-[#080D14]/90 p-4 shadow-[0_0_80px_rgba(0,212,255,0.08)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
            <span className="text-[10px] font-mono tracking-[0.18em] text-[#00D4FF]/75">FAULTLINE INTELLIGENCE VIEW</span>
            <span className="rounded border border-white/10 px-2 py-1 text-[8px] font-mono tracking-[0.13em] text-[#8FA0B3]">ILLUSTRATIVE INTERFACE</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["MARKET STATE", "Pressure, regime, and cross-asset conditions", "#00D4FF"],
              ["WHY IT MATTERS", "Evidence and the forces shaping the current state", "#00FF88"],
              ["WHAT CHANGED", "Developments that altered the interpretation", "#FFB020"],
              ["WHAT TO WATCH", "Confirmations, thresholds, and invalidations", "#A78BFA"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <p className="text-[9px] font-mono tracking-[0.18em] text-white/45">{label}</p>
                <p className="mt-3 text-sm font-semibold leading-snug" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#00D4FF]/15 bg-[#00D4FF]/[0.035] p-4">
            <p className="text-[9px] font-mono tracking-[0.18em] text-[#00D4FF]/70">ONE CURRENT MARKET MOMENT</p>
            <p className="mt-2 text-sm leading-relaxed text-[#B9C7D8]">One organized decision context—rather than disconnected indicators, headlines, and opinions.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    <section id="methodology" className="scroll-mt-20 border-b border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <SectionLabel>FAULTLINE METHODOLOGY™</SectionLabel>
            <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">The reasoning system behind the intelligence.</h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-[#C7D2DF]">Markets generate enormous amounts of data. The problem is not access. It is determining what matters, what is changing, why it may be changing, whether the change is persistent, what could invalidate the interpretation, and what deserves attention now.</p>
            <p className="mt-5 text-base leading-relaxed text-[#8796A9]">FAULTLINE Methodology™ structures that problem into a repeatable intelligence process. It is designed to improve market awareness—not to eliminate uncertainty or make guarantees about future outcomes.</p>
          </div>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {methodologySteps.map(([number, title, description]) => (
            <article key={number} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#00D4FF]">{number}</p>
              <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#8FA0B3]">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PentagonalThesis() {
  return (
    <section id="thesis" className="scroll-mt-20 overflow-hidden bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <SectionLabel>FAULTLINE PENTAGONAL THESIS™</SectionLabel>
          <h2 className="text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Five questions. One connected intelligence system.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[#A8B8CC]">The point is not to produce more indicators. It is to turn changing conditions into an organized decision context: current state, drivers, plausible paths, what to monitor, and how to prepare.</p>
        </div>
        <div className="relative mt-12">
          <div className="absolute left-[10%] right-[10%] top-10 hidden h-px bg-gradient-to-r from-transparent via-[#00D4FF]/45 to-transparent lg:block" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {thesisQuestions.map((item, index) => (
              <article key={item.number} className="relative rounded-2xl border border-[#00D4FF]/15 bg-[linear-gradient(180deg,rgba(0,212,255,0.075),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#00D4FF]/35 bg-[#050608] font-mono text-xs font-bold text-[#00D4FF]">{item.number}</div>
                <h3 className="mt-7 text-xl font-bold leading-tight text-white">{item.question}</h3>
                <p className="mt-4 text-sm leading-relaxed text-[#98A7B9]">{item.description}</p>
                <p className="mt-6 border-t border-white/[0.08] pt-4 text-[10px] font-mono tracking-[0.13em] text-[#00D4FF]/75">{item.emphasis.toUpperCase()}</p>
                {index < thesisQuestions.length - 1 && <span className="absolute -right-3 top-9 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-[#00D4FF]/25 bg-[#050608] text-[#00D4FF] lg:flex">→</span>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PressureIndex() {
  return (
    <section className="border-y border-[#00D4FF]/10 bg-[#07121A] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-full border border-[#00D4FF]/25 bg-[radial-gradient(circle,rgba(0,212,255,0.14)_0%,rgba(0,212,255,0.035)_42%,transparent_70%)]">
          <div className="absolute inset-7 rounded-full border border-dashed border-[#00D4FF]/25" />
          <div className="absolute inset-16 rounded-full border border-[#00D4FF]/20" />
          <div className="relative text-center">
            <p className="font-mono text-[10px] tracking-[0.25em] text-[#00D4FF]">FLAGSHIP INDICATOR</p>
            <p className="mt-4 text-5xl font-bold tracking-[-0.06em] text-white">0–100</p>
            <p className="mt-2 text-[11px] font-mono tracking-[0.17em] text-[#95A6B8]">SYSTEMIC PRESSURE SCALE</p>
          </div>
        </div>
        <div>
          <SectionLabel>FAULTLINE PRESSURE INDEX™</SectionLabel>
          <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">A starting point for investigation—not a conclusion.</h2>
          <p className="mt-6 text-lg leading-relaxed text-[#C7D2DF]">The FAULTLINE Pressure Index™ is a 0–100 measure designed to summarize systemic market pressure across multiple risk dimensions. It gives the investor a place to begin asking better questions.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {["Regime and primary pressure vectors", "What changed and supporting evidence", "Historical context and relevant analogs", "Conditions that confirm or invalidate the read"].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4 text-sm leading-relaxed text-[#A8B8CC]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D4FF]" />{item}
              </div>
            ))}
          </div>
          <a href="/app/pressure" className="mt-8 inline-flex items-center gap-2 text-[12px] font-mono font-bold tracking-[0.14em] text-[#00D4FF] hover:text-[#6EE7FF]">EXPLORE THE PRESSURE INDEX™ <Arrow /></a>
        </div>
      </div>
    </section>
  );
}

function EarlyWarning() {
  return (
    <section className="bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <SectionLabel>EARLY WARNING INTELLIGENCE™</SectionLabel>
            <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">Pressure often builds somewhere before it becomes a headline.</h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-[#C7D2DF]">FAULTLINE monitors developing stress relationships across market systems and is expanding this capability into a dedicated Early Warning Intelligence™ system.</p>
            <p className="mt-5 text-sm leading-relaxed text-[#8291A6]">This work is about identifying relationships worth investigating—not claiming that every future architecture or every warning signal is already operational.</p>
          </div>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {earlyWarningRelationships.map(([left, right]) => (
            <div key={left} className="group flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
              <span className="text-sm font-semibold text-white">{left}</span>
              <span className="mx-3 h-px flex-1 bg-gradient-to-r from-[#00D4FF]/50 to-[#00FF88]/40" />
              <span className="text-right text-sm text-[#A8B8CC]">{right}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntelligenceSystem() {
  return (
    <section id="system" className="scroll-mt-20 border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <SectionLabel>INTELLIGENCE SYSTEM</SectionLabel>
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">One system. Four ways to understand the market.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[#A8B8CC]">FAULTLINE brings existing capabilities into a coherent intelligence flow instead of presenting a long catalogue of disconnected tools.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {systemGroups.map((group, index) => (
            <article key={group.label} className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(0,212,255,0.055),rgba(255,255,255,0.015)_55%)] p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.22em] text-[#00D4FF]">0{index + 1}</span>
                <span className="h-2 w-2 rounded-full bg-[#00D4FF]/70" />
              </div>
              <h3 className="mt-8 text-2xl font-bold text-white">{group.label}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#93A2B4]">{group.description}</p>
              <ul className="mt-6 grid gap-2 border-t border-white/[0.08] pt-5 sm:grid-cols-2">
                {group.items.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-[#C7D2DF]"><span className="h-1 w-1 rounded-full bg-[#00D4FF]" />{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HistoricalIntelligence() {
  return (
    <section id="historical" className="scroll-mt-20 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <SectionLabel>HISTORICAL INTELLIGENCE</SectionLabel>
          <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">Use history to challenge the interpretation.</h2>
          <p className="mt-6 text-lg leading-relaxed text-[#C7D2DF]">The Historical Truth Engine™ and Time Machine provide retrospective reconstructions: how the current FAULTLINE methodology would interpret conditions using information available in the historical dataset.</p>
          <p className="mt-4 text-sm leading-relaxed text-[#8291A6]">These reconstructions were not generated live at those historical dates. They do not represent contemporaneous FAULTLINE warnings, investment recommendations, or guaranteed outcomes.</p>
          <a href="/track-record" className="mt-8 inline-flex items-center gap-2 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/5 px-6 py-4 text-[12px] font-mono font-bold tracking-[0.13em] text-[#00D4FF] transition hover:border-[#00D4FF]/60">VIEW HISTORICAL INTELLIGENCE <Arrow /></a>
        </div>
        <div className="rounded-2xl border border-[#00D4FF]/15 bg-[#081018] p-6 sm:p-8">
          <p className="font-mono text-[10px] tracking-[0.22em] text-[#00D4FF]">RETROSPECTIVE RECONSTRUCTION</p>
          <div className="mt-8 space-y-5">
            {[
              ["Select a period", "Choose a market period and load the relevant historical dataset."],
              ["Examine the evidence", "Review the methodology’s interpretation of conditions that were available at the time."],
              ["Compare context and outcome", "Use the subsequent outcome as context for evaluating the evidence—not as data available to the original read."],
            ].map(([title, text], index) => (
              <div key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#00D4FF]/30 font-mono text-xs text-[#00D4FF]">0{index + 1}</span>
                <div><h3 className="font-semibold text-white">{title}</h3><p className="mt-1 text-sm leading-relaxed text-[#8FA0B3]">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="border-y border-white/[0.06] bg-[#071018] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <SectionLabel>DATA, EVIDENCE, AND TRUST</SectionLabel>
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">Know what the information is—and what it is not.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[#C7D2DF]">FAULTLINE combines underlying public-market and economic data with derived calculations and contextual interpretation. Different inputs update at different frequencies; a market quote, an economic release, a cached read, and a scheduled calculation should not be treated as the same thing.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["Underlying data", "Market data, economic releases, Treasury information, and other source inputs each carry their own publication cadence."],
            ["Derived intelligence", "Pressure, regime, scenario, and other FAULTLINE metrics are calculations built from available inputs."],
            ["Interpretation", "Explanations distinguish evidence and context from judgment. FAULTLINE is decision support, not individualized financial advice."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-6"><h3 className="text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[#9AA9BA]">{text}</p></article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4"><a href="/trust#data-sources" className="text-[11px] font-mono font-bold tracking-[0.13em] text-[#00D4FF] hover:text-[#6EE7FF]">FULL DATA SOURCES <Arrow /></a><a href="/methodology" className="text-[11px] font-mono font-bold tracking-[0.13em] text-[#A8B8CC] hover:text-white">METHODOLOGY <Arrow /></a></div>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className="bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>WHO FAULTLINE IS FOR</SectionLabel>
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">For investors who want context before they act.</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Self-directed investors seeking a structured market read", "Active traders who want regime and risk context", "Long-term allocators monitoring evolving macro conditions", "Crypto participants tracking broader liquidity and risk appetite"].map((item) => <div key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm leading-relaxed text-[#B6C4D3]">{item}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const lifetime = PRICING_PLANS.lifetime;
  const pro = PRICING_PLANS.premium;
  const core = PRICING_PLANS.core;
  return (
    <section id="access" className="scroll-mt-20 border-y border-[#00D4FF]/15 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(0,212,255,0.1),transparent_62%),#071018] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center"><SectionLabel>ACCESS</SectionLabel><h2 className="text-3xl font-bold tracking-[-0.04em] text-white sm:text-5xl">A clear way to start. A clear founding offer.</h2><p className="mt-5 text-lg leading-relaxed text-[#B7C5D5]">Begin with the market environment. When you want full access, the current promotional centerpiece is Founding Lifetime Access.</p></div>
        <div className="mt-12 grid gap-5 lg:grid-cols-[0.8fr_0.9fr_1.2fr]">
          <article className="rounded-2xl border border-white/[0.1] bg-[#050608]/70 p-6 sm:p-7"><p className="font-mono text-[10px] tracking-[0.2em] text-[#A8B8CC]">START HERE</p><h3 className="mt-5 text-2xl font-bold text-white">Free market awareness</h3><p className="mt-3 text-sm leading-relaxed text-[#98A7B9]">Explore the current market environment, Pressure Index™, core regime context, and daily intelligence summary.</p><p className="mt-7 text-3xl font-bold text-white">$0</p><a href={PLATFORM_URL} onClick={() => trackStartFreeClicked("marketing_pricing_free")} className="mt-7 inline-flex w-full items-center justify-center rounded-xl border border-[#00D4FF]/35 px-5 py-4 text-[11px] font-mono font-bold tracking-[0.13em] text-[#00D4FF] hover:bg-[#00D4FF]/10">SEE TODAY’S MARKET ENVIRONMENT</a></article>
          <article className="rounded-2xl border border-white/[0.1] bg-[#050608]/70 p-6 sm:p-7"><p className="font-mono text-[10px] tracking-[0.2em] text-[#A8B8CC]">MONTHLY ACCESS</p><h3 className="mt-5 text-2xl font-bold text-white">{pro.name.replace("FAULTLINE ", "")}</h3><p className="mt-3 text-sm leading-relaxed text-[#98A7B9]">Full market intelligence suite including advanced analysis, historical context, and premium tools.</p><p className="mt-7 text-3xl font-bold text-white">{pro.priceLabel}</p><p className="mt-2 text-[11px] leading-relaxed text-[#6F8092]">Core access is also available from {core.priceLabel}.</p><a href="/pricing" className="mt-7 inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-5 py-4 text-[11px] font-mono font-bold tracking-[0.13em] text-[#D0DAE6] hover:border-white/35">VIEW PLAN OPTIONS</a></article>
          <article className="relative overflow-hidden rounded-2xl border border-[#FFD700]/45 bg-[linear-gradient(145deg,rgba(255,215,0,0.12),rgba(0,212,255,0.08)_55%,rgba(5,6,8,0.9))] p-6 shadow-[0_0_50px_rgba(255,215,0,0.1)] sm:p-7"><div className="absolute right-0 top-0 rounded-bl-xl border-b border-l border-[#FFD700]/35 bg-[#FFD700]/10 px-3 py-2 text-[9px] font-mono font-bold tracking-[0.15em] text-[#FFD700]">FOUNDING OFFER</div><p className="font-mono text-[10px] tracking-[0.2em] text-[#FFD700]">FOUNDING LIFETIME ACCESS</p><h3 className="mt-5 text-2xl font-bold text-white">One payment. Founding access for life.</h3><p className="mt-3 text-sm leading-relaxed text-[#D2DCE6]">Everything in Pro, lifetime access to current Pro features, future core Pro features, a Founding Member badge, and early access to major releases.</p><div className="mt-7 flex items-end gap-3"><p className="text-5xl font-bold tracking-[-0.06em] text-[#FFD700]">{lifetime.priceLabel.replace(" one-time", "")}</p><span className="pb-1 text-[12px] font-mono tracking-wide text-[#D0B452]">ONE-TIME</span></div><p className="mt-3 text-sm text-[#B9C8D8]">No recurring subscription. The break-even point versus Pro is approximately five months.</p><a href="/pricing" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-5 py-4 text-[11px] font-mono font-black tracking-[0.13em] text-[#050608] transition hover:bg-[#FFE277]">GET FOUNDING LIFETIME ACCESS — $299 <Arrow /></a><p className="mt-4 text-center text-[10px] leading-relaxed text-[#9AA9BA]">No claimed-member count or manufactured scarcity is displayed.</p></article>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const questions = [
    ["Is FAULTLINE investment advice?", "No. FAULTLINE provides market intelligence and educational analysis, not individualized investment advice, a recommendation to buy or sell a security, or a guarantee of future results."],
    ["What does the Pressure Index™ tell me?", "It is a 0–100 starting point for investigating systemic pressure. The surrounding regime, evidence, what changed, and historical context matter as much as the number."],
    ["How should I interpret historical analysis?", "Historical views are retrospective reconstructions using historical datasets. They were not generated live at those dates and should not be treated as contemporaneous warnings or proof of future outcomes."],
  ];
  return <section className="border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-24"><div className="mx-auto max-w-4xl px-5 sm:px-8"><SectionLabel>COMMON QUESTIONS</SectionLabel><h2 className="text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">Clear about the limits of the platform.</h2><div className="mt-9 divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] bg-white/[0.015]">{questions.map(([question, answer]) => <details key={question} className="group p-5"><summary className="cursor-pointer list-none pr-8 text-base font-semibold text-white marker:hidden">{question}<span className="float-right text-[#00D4FF] transition-transform group-open:rotate-45">+</span></summary><p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#9AA9BA]">{answer}</p></details>)}</div><p className="mt-6 text-sm leading-relaxed text-[#718096]">All investing involves risk, including possible loss of principal. <a href="/trust#disclaimers" className="text-[#00D4FF] hover:text-[#6EE7FF]">Read the full disclosures.</a></p></div></section>;
}

function ResearchLibrary() {
  return <section className="bg-[#050608] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionLabel>INTELLIGENCE LIBRARY</SectionLabel><h2 className="text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">Research for deeper investigation.</h2></div><a href="/analysis" className="inline-flex items-center gap-2 text-[11px] font-mono font-bold tracking-[0.13em] text-[#00D4FF]">VIEW ALL ANALYSIS <Arrow /></a></div><div className="mt-10 grid gap-4 md:grid-cols-3">{[["Market risk", "Understand market regimes, pressure, liquidity, and volatility."], ["Macro context", "Explore rates, inflation, credit, and economic transmission channels."], ["Crypto and concentration", "Study liquidity, risk appetite, and concentration across evolving markets."]].map(([title, text]) => <a key={title} href="/analysis" className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition hover:border-[#00D4FF]/35 hover:bg-[#00D4FF]/[0.03]"><p className="text-[10px] font-mono tracking-[0.18em] text-[#00D4FF]">RESEARCH</p><h3 className="mt-5 text-xl font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[#93A2B4]">{text}</p><span className="mt-6 inline-flex text-[#00D4FF] transition group-hover:translate-x-1">→</span></a>)}</div></div></section>;
}

function Footer() {
  return <footer className="border-t border-white/[0.07] bg-[#030405] py-12"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8"><div className="flex flex-col justify-between gap-6 sm:flex-row"><div><p className="font-mono text-lg font-black tracking-[0.23em] text-white">FAULTLINE</p><p className="mt-3 max-w-md text-sm leading-relaxed text-[#7F90A3]">Market risk intelligence for understanding changing conditions before headline narratives make them obvious.</p></div><div className="flex flex-wrap gap-x-5 gap-y-3 text-[11px] font-mono tracking-[0.1em] text-[#A8B8CC]"><a href="/methodology" className="hover:text-[#00D4FF]">METHODOLOGY</a><a href="/trust" className="hover:text-[#00D4FF]">TRUST CENTER</a><a href="/contact" className="hover:text-[#00D4FF]">CONTACT</a><a href="/blog" className="hover:text-[#00D4FF]">RESEARCH</a><a href="/pricing" className="hover:text-[#00D4FF]">PRICING</a></div></div><div className="flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-6 text-[10px] font-mono tracking-wide text-[#64748B] sm:flex-row"><span>© 2026 FAULTLINE · A PHOENIX SYSTEMS PLATFORM</span><span>MARKET AWARENESS. BEFORE THE CONSENSUS FORMS.</span></div></div></footer>;
}

type MarketingSitePlacement = "methodology" | "thesis" | "system" | "historical" | "access" | "pricing";

export default function MarketingSite({ initialSection }: { initialSection?: MarketingSitePlacement } = {}) {
  useSEO({
    title: "FAULTLINE | Market Risk Intelligence, Systemic Risk & Early Warning Signals",
    description: "Market risk intelligence for understanding systemic market stress, early warning signals, macroeconomic risk, and changing market regimes with actionable context.",
    canonical: "/",
  });

  useEffect(() => {
    trackPricingViewed();
    if (!initialSection) return;
    const targetSection = initialSection === "pricing" ? "access" : initialSection;
    const timer = window.setTimeout(() => document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => window.clearTimeout(timer);
  }, [initialSection]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050608] text-white">
      <StatusStrip />
      <Header />
      <main>
        <Hero />
        <Methodology />
        <PentagonalThesis />
        <PressureIndex />
        <EarlyWarning />
        <IntelligenceSystem />
        <HistoricalIntelligence />
        <Trust />
        <Audience />
        <Pricing />
        <FAQ />
        <ResearchLibrary />
      </main>
      <Footer />
    </div>
  );
}
