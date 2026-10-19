import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getLoginUrl, handleLoginCtaClick } from "@/const";
import { useSEO } from "@/hooks/useSEO";
import { trackStartFreeClicked } from "@/hooks/useAnalytics";
import HeroProof from "@/components/landing/HeroProof";
import PentagonalThesis from "@/components/landing/PentagonalThesis";
import HistoricalContext from "@/components/landing/HistoricalContext";
import { PRESSURE_BANDS, PRESSURE_VECTOR_ORDER, useLandingPressure } from "@/components/landing/useLandingPressure";
import { PRESSURE_VECTOR_DISPLAY } from "@shared/pressureVectorLabels";
import { PUBLIC_DISCLAIMER } from "@shared/publicDisclaimer";

import MembershipOffer from "@/components/MembershipOffer";
import MarketingIntelligenceHero from "@/components/marketing/MarketingIntelligenceHero";
import ProductShowcase from "@/components/marketing/ProductShowcase";

const EXPLORE_HREF = "/pressure-index";
const METHOD_HREF = "/methodology";
const TRUST_HREF = "/trust";
const DAILY_BRIEF_HREF = "/daily-brief";
const BLOG_HREF = "/blog";
const PRICING_HREF = "/pricing";

const PAGE_TITLE = "FAULTLINE | Structural Market Intelligence";
const PAGE_DESCRIPTION =
  "Understand market pressure, its drivers and what to watch. FAULTLINE connects cross-market context with evidence-led intelligence for self-directed investors.";

const navItems = [
  { label: "Intelligence", href: "#product-showcase" },
  { label: "Methodology", href: "#thesis" },
  { label: "Evidence", href: "#pressure" },
  { label: "Membership", href: "#access" },
];


const founderParagraphs = [
  "I built FAULTLINE because I believe the most important risks in markets rarely appear in isolation.",
  "A market can look healthy on the surface while pressure is quietly building underneath — in credit, liquidity, rates, volatility, currencies, commodities, equities, and other interconnected markets.",
  "The challenge isn't access to more data.",
  "There is already more data than anyone can reasonably process.",
  "The challenge is understanding what the data means together.",
  "FAULTLINE was built to look across those relationships, identify where pressure is developing, and translate complex market conditions into intelligence that people can actually understand.",
  "The goal isn't to tell you what to buy or sell.",
  "The goal is to help you see what may be changing beneath the surface, understand the forces driving it, and make your own decisions with better information.",
];

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-4 text-[12px] font-[inherit] font-semibold tracking-[0.06em] text-[#65D6E5]">{children}</p>;
}

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 7.5h10M8.8 3.7l3.7 3.8-3.7 3.8" />
    </svg>
  );
}

function SignInCta({ className }: { className: string }) {
  const loginUrl = getLoginUrl();
  if (loginUrl) {
    return (
      <a href={loginUrl} onClick={handleLoginCtaClick} className={className}>
        SIGN IN
      </a>
    );
  }
  return (
    <button type="button" onClick={() => handleLoginCtaClick()} className={className}>
      SIGN IN
    </button>
  );
}

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]";

function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0A0D12]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className={`flex shrink-0 items-center gap-3 ${focusRing}`} onClick={close}>
          <span className="h-2 w-2 rounded-full bg-[#65D6E5]" aria-hidden="true" />
          <span className="font-[inherit] text-sm font-semibold tracking-[0.06em] text-white">FAULTLINE</span>
          <span className="hidden whitespace-nowrap border-l border-white/10 pl-3 text-[12px] font-[inherit] tracking-[0.06em] text-[#B7C1CD] min-[1180px]:inline">STRUCTURAL MARKET INTELLIGENCE</span>
        </Link>

        <nav className="hidden items-center gap-5 whitespace-nowrap lg:flex" aria-label="Landing navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={`text-[12px] font-[inherit] tracking-[0.06em] text-[#C5D0DC] transition-colors hover:text-[#65D6E5] ${focusRing}`}>
              {item.label.toUpperCase()}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 whitespace-nowrap lg:flex">
          <SignInCta className={`rounded-lg border border-white/15 px-3 py-2 text-[12px] font-[inherit] tracking-[0.06em] text-[#C5D0DC] transition-colors hover:border-[#00D4FF]/50 hover:text-white ${focusRing}`} />
          <a href={EXPLORE_HREF} onClick={() => trackStartFreeClicked("marketing_rebuild_hero")} className={`rounded-lg bg-[#65D6E5] px-3 py-2 text-[12px] font-[inherit] font-semibold tracking-[0.06em] text-[#050608] transition-colors hover:bg-[#6EE7FF] ${focusRing}`}>
            EXPLORE FAULTLINE
          </a>
        </div>

        <button type="button" className={`rounded-lg border border-white/15 p-3 text-[#C5D0DC] lg:hidden ${focusRing}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close navigation" : "Open navigation"}>
          <span className="block h-px w-5 bg-current" />
          <span className="my-1 block h-px w-5 bg-current" />
          <span className="block h-px w-5 bg-current" />
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/[0.07] bg-[#080B10] px-5 py-4 lg:hidden" aria-label="Mobile landing navigation">
          <div className="mx-auto grid max-w-7xl gap-1">
            <div className="grid grid-cols-2 gap-1">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={close} className={`rounded-lg px-3 py-3 text-[12px] font-[inherit] tracking-[0.06em] text-white ${focusRing}`}>
                  {item.label.toUpperCase()}
                </a>
              ))}
            </div>
            <SignInCta className={`rounded-lg px-3 py-3 text-left text-[12px] font-[inherit] tracking-[0.06em] text-white ${focusRing}`} />
            <a href={EXPLORE_HREF} onClick={close} className={`mt-2 rounded-lg bg-[#65D6E5] px-3 py-3 text-center text-[12px] font-[inherit] font-semibold tracking-[0.06em] text-[#050608] ${focusRing}`}>
              EXPLORE FAULTLINE
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return <MarketingIntelligenceHero />;
}

function PublicReadingProof() {
  return (
    <section className="mp-proof-band" aria-label="Canonical public product evidence">
      <div className="mp-proof-layout">
        <div className="mp-proof-intro">
          <p className="mp-eyebrow">EVIDENCE, NOT ANIMATION</p>
          <h2>A real reading.<br />Its source status, in view.</h2>
          <p>The visualization above explains the architecture. This separate public reading uses the existing canonical snapshot, with its own date and freshness. When the source is unavailable, no score is substituted.</p>
        </div>
        <HeroProof />
      </div>
    </section>
  );
}

function Pressure() {
  const reading = useLandingPressure();
  const currentBand = reading.status === "available" ? reading.band : null;
  return (
    <section id="pressure" className="scroll-mt-24 border-b border-[#00D4FF]/15 bg-[#07121A] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>FAULTLINE PRESSURE INDEX™</SectionLabel>
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">A 0–100 measure of systemic pressure.</h2>
            <p className="mt-6 text-lg leading-[1.75] text-[#E3E5E8]">
              Six weighted vectors, built from FRED series and one static reference value, combine into one score. A higher number means more of those inputs sit in stressed ranges at the same time. It measures pressure inside this framework. It does not predict a specific crash, and it does not name a date.
            </p>
            <div className="mt-8 flex flex-col gap-3 text-[12px] font-bold tracking-[0.06em] sm:flex-row sm:gap-6">
              <a href={EXPLORE_HREF} className={`inline-flex items-center gap-2 text-[#65D6E5] hover:text-[#6EE7FF] ${focusRing}`}>
                OPEN THE PUBLIC PRESSURE INDEX <Arrow />
              </a>
              <a href="/methodology#weights" className={`inline-flex items-center gap-2 text-[#C5D0DC] hover:text-white ${focusRing}`}>
                FULL VECTOR INVENTORY <Arrow />
              </a>
            </div>
          </div>
          <div className="grid gap-8">
            <div>
              <ol className="grid gap-2" aria-label="Pressure bands">
                {PRESSURE_BANDS.map((band) => {
                  const current = currentBand === band.regime;
                  return (
                    <li key={band.regime} aria-current={current ? "true" : undefined} className={`grid grid-cols-[4.75rem_1fr_auto] items-center gap-3 rounded-lg border px-4 py-3 ${current ? "border-[#65D6E5]/60 bg-[#65D6E5]/[0.08]" : "border-white/[0.08] bg-[#0A0D12]/60"}`}>
                      <span className="font-[inherit] text-sm text-[#65D6E5]">{band.range}</span>
                      <span className="text-sm font-semibold tracking-[0.04em] text-white">{band.regime}</span>
                      {current ? <span className="text-[11px] font-semibold tracking-[0.06em] text-[#8BE6F0]">CURRENT</span> : <span aria-hidden="true" />}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-[12px] leading-[1.75] text-[#A8B4C2]">Engine labels and thresholds, inclusive at the lower bound: 25, 45, 65, and 80. Source: the classifier in the pressure engine.</p>
            </div>
            <div>
              <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#B7C1CD]">THE SIX VECTORS</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {PRESSURE_VECTOR_ORDER.map(([id, weight]) => {
                  const live = reading.status === "available" ? reading.vectors.find((vector) => vector.id === id) : undefined;
                  return (
                    <li key={id} className="flex items-baseline justify-between gap-3 rounded-lg border border-white/[0.08] px-4 py-3">
                      <span className="text-sm text-white">
                        {PRESSURE_VECTOR_DISPLAY[id].label}
                        <span className="ml-2 text-[12px] text-[#A8B4C2]">{weight}</span>
                      </span>
                      {live && live.value != null && (
                        <span className="shrink-0 text-sm tabular-nums text-[#E3E5E8]">{Math.round(live.value)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[12px] leading-[1.75] text-[#A8B4C2]" role="status">
                {reading.status === "available"
                  ? "Values are the current vector scores from the same public reading as the hero. The AI / Speculation vector uses a static reference value, not a live measurement."
                  : reading.status === "loading"
                    ? "Loading current vector scores. None are shown until they arrive."
                    : "Current vector scores are unavailable, so none are shown. The AI / Speculation vector uses a static reference value, not a live measurement."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Plato() {
  return (
    <section id="plato" className="scroll-mt-24 bg-[#0A0D12] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>PLATO</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">FAULTLINE detects the signals. PLATO helps explain what they mean.</h2>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <p className="text-lg leading-[1.75] text-[#C9D4E0]">
              PLATO is the interpretation layer. The quantitative measurements come from the FAULTLINE engines. PLATO market explanation synthesizes those measurements into context: what changed, and why it matters. It does not replace the score.
            </p>
            <p className="mt-5 text-base leading-[1.75] text-[#B7C1CD]">
              When a persisted systemic-regime reading is available, PLATO is instructed to read that contract as-is and not to invent a regime, a factor, or a likelihood of crisis. If the reading is missing, the instruction is to say it is unavailable.
            </p>
          </div>
          <article className="rounded-2xl border border-[#00D4FF]/20 bg-[#071018] p-5 sm:p-6" aria-labelledby="plato-how-title">
            <p className="inline-flex rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.06em] text-[#C5D0DC]">
              STATIC DESCRIPTION · NOT LIVE PLATO OUTPUT
            </p>
            <h3 id="plato-how-title" className="mt-4 text-lg font-semibold text-white">How a PLATO read is put together</h3>
            <ol className="mt-4 grid gap-3">
              {[
                ["Market data", "FRED, Polygon, Yahoo, and CoinGecko inputs."],
                ["FAULTLINE signals", "Vector scores, regimes, and cross-market alignment."],
                ["Systemic-risk analysis", "The Pressure Index and the separate systemic-regime reading."],
                ["PLATO", "Reads those persisted outputs. It does not rescore them."],
                ["Context / why it matters", "A plain-language explanation, with unavailable inputs stated as unavailable."],
              ].map(([step, detail], index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5]">0{index + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{step}</span>
                    <span className="block text-sm leading-[1.65] text-[#B7C1CD]">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[12px] leading-[1.7] text-[#A8B4C2]">
              No public endpoint publishes PLATO output, so this page shows no PLATO text. PLATO reads are available inside the product.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

const capabilityModules = [
  {
    title: "Systemic pressure and regimes",
    body: "The Pressure Index, its six vectors and bands, plus a separate two-state systemic-regime model that never feeds the index.",
    links: [["Open the Pressure Index", EXPLORE_HREF], ["Vector inventory", "/methodology#weights"]],
  },
  {
    title: "Cross-market and crypto",
    body: "Equity regime against crypto regime, read as aligned or diverging. The crypto stress score includes the Pressure Index.",
    links: [["How alignment works", "/methodology#cross-market"], ["Data sources", "/methodology#sources"]],
  },
  {
    title: "Daily intelligence",
    body: "A written brief generated from the engine snapshot, a public archive, and long-form research on the blog.",
    links: [["Daily brief", DAILY_BRIEF_HREF], ["Blog", BLOG_HREF]],
  },
] as const;

function Capabilities() {
  return (
    <section id="stack" className="scroll-mt-24 border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>CAPABILITIES</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">Three things FAULTLINE does every day.</h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {capabilityModules.map((module) => (
            <article key={module.title} className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0A1018] p-6">
              <h3 className="text-xl font-semibold text-white">{module.title}</h3>
              <p className="mt-3 flex-1 text-base leading-[1.75] text-[#B7C1CD]">{module.body}</p>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                {module.links.map(([label, href]) => (
                  <a key={href} href={href} className={`inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.06em] text-[#65D6E5] hover:text-[#6EE7FF] ${focusRing}`}>
                    {label.toUpperCase()} <Arrow />
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm leading-[1.75] text-[#A8B4C2]">
          The full tool inventory, and the ideas that are not live yet, are on the <a href="/methodology#stack" className={`text-[#65D6E5] hover:text-[#8BE6F0] ${focusRing}`}>methodology page</a>.
        </p>
      </div>
    </section>
  );
}

const trustPoints = [
  "Every input, weight, and band is published, including the static AI-concentration baseline.",
  "No 25-year backtest is claimed. Analogs are resemblance tests, and the research windows are validation labels only.",
  "High pressure does not mean an immediate crash. Low pressure does not mean risk is absent.",
  "FAULTLINE does not tell you what to buy or sell. Nothing on this page is a solicitation or a personal recommendation.",
];

const trustLinks = [
  ["Methodology", METHOD_HREF],
  ["Data sources", "/methodology#sources"],
  ["Limitations", "/methodology#limitations"],
  ["Future intelligence", "/methodology#future"],
  ["Trust Center", TRUST_HREF],
] as const;

function TrustTeaser() {
  return (
    <section id="methodology" className="scroll-mt-24 bg-[#0A0D12] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <SectionLabel>TRUST AND METHODOLOGY</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">Built to be checked.</h2>
          <ul className="mt-8 grid gap-3">
            {trustPoints.map((point) => (
              <li key={point} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-base leading-[1.75] text-[#E3E5E8]">{point}</li>
            ))}
          </ul>
          <nav aria-label="Methodology and trust" className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
            {trustLinks.map(([label, href]) => (
              <a key={href} href={href} className={`inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.06em] text-[#65D6E5] hover:text-[#6EE7FF] ${focusRing}`}>
                {label.toUpperCase()} <Arrow />
              </a>
            ))}
          </nav>
        </div>
        <aside className="rounded-2xl border border-white/[0.08] bg-[#070A0F] p-6 sm:p-8" aria-labelledby="founder-title">
          <h2 id="founder-title" className="text-[12px] font-[inherit] font-semibold tracking-[0.06em] text-[#65D6E5]">A NOTE FROM THE FOUNDER</h2>
          <div className="mt-6 space-y-4 text-base leading-[1.75] text-[#E3E5E8]">
            {founderParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold tracking-[0.06em] text-white">SEE THE PRESSURE BEFORE THE BREAK.</p>
          <p className="mt-4 text-base text-[#C9D4E0]">— JT</p>
        </aside>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="access" className="relative isolate scroll-mt-24 overflow-hidden border-t border-white/[0.06] bg-[#0A0D12] py-24 sm:py-32">
      {/* Existing underlay remains available in source; no decorative market motion in membership. */}
      <div className="pointer-events-none absolute inset-0 bg-[#0A0D12]/72" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <p className="mp-membership-kicker">MEMBERSHIP / BUILT FOR SELF-DIRECTED INVESTORS</p>
        <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
          Less noise. More context.
          A clearer view of the market.
        </h2>
        <div className="mt-10"><MembershipOffer /></div>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-[1.75] text-[#C9D4E0]">
          Explore the limited public preview without an account. Full intelligence is offered through FAULTLINE Standard at $99/month or FAULTLINE Lifetime at $1,500 one-time.
        </p>
        <p className="mt-3 text-sm text-[#B7C1CD]">
          Already a member? <SignInCta className={`font-semibold text-[#65D6E5] underline-offset-4 hover:underline ${focusRing}`} />
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#030405] py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <div>
            <p className="font-[inherit] text-lg font-semibold tracking-[0.06em] text-white">FAULTLINE</p>
            <p className="mt-3 max-w-md text-base leading-[1.75] text-[#B7C1CD]">Structural Market Intelligence. See the pressure before the break.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-[12px] font-[inherit] tracking-[0.06em] text-[#C5D0DC]" aria-label="Footer">
            <a href={EXPLORE_HREF} className={`hover:text-[#65D6E5] ${focusRing}`}>PRESSURE INDEX</a>
            <a href={METHOD_HREF} className={`hover:text-[#65D6E5] ${focusRing}`}>METHODOLOGY</a>
            <a href={TRUST_HREF} className={`hover:text-[#65D6E5] ${focusRing}`}>TRUST CENTER</a>
            <a href={DAILY_BRIEF_HREF} className={`hover:text-[#65D6E5] ${focusRing}`}>DAILY BRIEF</a>
            <a href={BLOG_HREF} className={`hover:text-[#65D6E5] ${focusRing}`}>BLOG</a>
            <a href={PRICING_HREF} className={`hover:text-[#65D6E5] ${focusRing}`}>PRICING</a>
            <a href="/about" className={`hover:text-[#65D6E5] ${focusRing}`}>ABOUT</a>
            <a href="/contact" className={`hover:text-[#65D6E5] ${focusRing}`}>CONTACT</a>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-6 text-[12px] leading-[1.75] text-[#A8B4C2] sm:flex-row">
          <span>© 2026 FAULTLINE · A PHOENIX SYSTEMS PLATFORM</span>
          <span>{PUBLIC_DISCLAIMER}</span>
        </div>
      </div>
    </footer>
  );
}

type MarketingSitePlacement = "methodology" | "pressure" | "plato" | "analogs" | "stack" | "access" | "pricing";

export default function MarketingSite({ initialSection }: { initialSection?: MarketingSitePlacement } = {}) {
  useSEO({
    title: initialSection === "pricing" ? "FAULTLINE Membership — $99/month or $1,500 Lifetime" : PAGE_TITLE,
    description: initialSection === "pricing" ? "FAULTLINE Standard at $99/month or FAULTLINE Lifetime at $1,500 one-time. Explore the limited public preview without registering." : PAGE_DESCRIPTION,
    canonical: initialSection === "pricing" ? "/pricing" : "/",
  });

  useEffect(() => {
    if (!initialSection) return;
    const targetSection = initialSection === "pricing" ? "access" : initialSection;
    const timer = window.setTimeout(() => document.getElementById(targetSection)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 250);
    return () => window.clearTimeout(timer);
  }, [initialSection]);

  return (
    <div className="mp-site min-h-screen overflow-x-hidden bg-[#0A0D12] text-[#F4F2ED]" style={{ fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <a href="#main" className={`absolute left-4 top-4 z-[60] -translate-y-24 rounded bg-[#65D6E5] px-3 py-2 text-sm font-semibold text-[#050608] focus:translate-y-0 ${focusRing}`}>
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <PublicReadingProof />
        <ProductShowcase />
        <PentagonalThesis />
        <Pressure />
        <HistoricalContext />
        <Plato />
        <Capabilities />
        <TrustTeaser />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
