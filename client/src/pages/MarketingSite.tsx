import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getLoginUrl, handleLoginCtaClick } from "@/const";
import { useSEO } from "@/hooks/useSEO";
import { trackStartFreeClicked } from "@/hooks/useAnalytics";
import SeismicUnderlay from "@/components/landing/SeismicUnderlay";
import AmberSeismograph from "@/components/landing/AmberSeismograph";
import MarketTicker from "@/components/landing/ticker/MarketTicker";
import HeroProof from "@/components/landing/HeroProof";
import PentagonalThesis from "@/components/landing/PentagonalThesis";
import HistoricalContext from "@/components/landing/HistoricalContext";
import { PRESSURE_BANDS, PRESSURE_VECTOR_ORDER, useLandingPressure } from "@/components/landing/useLandingPressure";
import { PRESSURE_VECTOR_DISPLAY } from "@shared/pressureVectorLabels";
import { PUBLIC_DISCLAIMER } from "@shared/publicDisclaimer";

import MembershipOffer from "@/components/MembershipOffer";

const HERO_BACKGROUND = "/faultline_hero_bg_7d6aaf14.jpg";
const HERO_BACKGROUND_WIDTHS = [640, 1280, 1920, 2560] as const;
const HERO_BACKGROUND_SRCSET = {
  avif: HERO_BACKGROUND_WIDTHS.map(w => `/faultline_hero_bg_7d6aaf14-${w}.avif ${w}w`).join(", "),
  webp: HERO_BACKGROUND_WIDTHS.map(w => `/faultline_hero_bg_7d6aaf14-${w}.webp ${w}w`).join(", "),
};

const EXPLORE_HREF = "/pressure-index";
const METHOD_HREF = "/methodology";
const TRUST_HREF = "/trust";
const DAILY_BRIEF_HREF = "/daily-brief";
const BLOG_HREF = "/blog";
const PRICING_HREF = "/pricing";

const PAGE_TITLE = "FAULTLINE | Structural Market Intelligence";
const PAGE_DESCRIPTION =
  "FAULTLINE reads high-yield credit, SOFR, the Treasury curve, macro conditions, equities, and crypto to show where systemic pressure is building.";

const navItems = [
  { label: "Thesis", href: "#thesis" },
  { label: "Pressure Index", href: "#pressure" },
  { label: "History", href: "#analogs" },
  { label: "PLATO", href: "#plato" },
  { label: "Methodology", href: METHOD_HREF },
  { label: "Brief", href: DAILY_BRIEF_HREF },
  { label: "Blog", href: BLOG_HREF },
  { label: "Pricing", href: PRICING_HREF },
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

function Ctas({ primaryTrack }: { primaryTrack?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={EXPLORE_HREF}
        onClick={primaryTrack ? () => trackStartFreeClicked("marketing_rebuild_hero") : undefined}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#65D6E5] px-7 py-4 text-center text-[12px] font-[inherit] font-semibold tracking-[0.06em] text-[#050608] transition hover:bg-[#6EE7FF] ${focusRing}`}
      >
        EXPLORE FAULTLINE <Arrow />
      </a>
      <a href={METHOD_HREF} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#00D4FF]/40 bg-[#0A0D12]/70 px-7 py-4 text-center text-[12px] font-[inherit] font-bold tracking-[0.06em] text-[#65D6E5] transition hover:border-[#00D4FF]/70 hover:bg-[#65D6E5]/10 ${focusRing}`}>
        VIEW METHODOLOGY
      </a>
    </div>
  );
}

function setHeroBackgroundSrc(img: HTMLImageElement | null) {
  if (img && !img.getAttribute("src")) img.src = HERO_BACKGROUND;
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[#00D4FF]/10 bg-[#0A0D12]">
      {/* Restored original hero background (faultline_hero_bg_7d6aaf14.jpg), same treatment as before
          07f06ac: full-bleed cover, centred, 35% opacity, under the existing overlays. Responsive
          AVIF/WebP derivatives; the recovered original is the final fallback. Decorative, no animation. */}
      <picture aria-hidden="true">
        <source type="image/avif" srcSet={HERO_BACKGROUND_SRCSET.avif} sizes="100vw" />
        <source type="image/webp" srcSet={HERO_BACKGROUND_SRCSET.webp} sizes="100vw" />
        {/* src is set from the ref, i.e. once the <img> is inside the <picture> in the document.
            React sets props on the detached element, and WebKit then fetches the jpg fallback as
            well as the selected source. Same frame as the commit, so the request (and LCP) is not
            deferred, unlike loading="lazy". */}
        <img
          ref={setHeroBackgroundSrc}
          alt=""
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-35"
        />
      </picture>
      <SeismicUnderlay className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(180deg,transparent_0%,transparent_42%,#000_68%)] lg:[mask-image:linear-gradient(90deg,transparent_0%,transparent_38%,rgba(0,0,0,0.4)_54%,#000_72%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,8,0.94)_0%,rgba(5,6,8,0.9)_48%,rgba(5,6,8,0.45)_72%,rgba(5,6,8,0.12)_100%)] lg:bg-[linear-gradient(90deg,rgba(5,6,8,0.96)_0%,rgba(5,6,8,0.92)_42%,rgba(5,6,8,0.55)_62%,rgba(5,6,8,0.08)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0A0D12] to-transparent" aria-hidden="true" />
      <AmberSeismograph className="absolute inset-x-0 bottom-10 h-28 sm:bottom-16 sm:h-36" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:min-h-[calc(100svh-88px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-12 lg:py-12 xl:py-24">
        <div className="max-w-4xl">
          <h1 className="max-w-5xl">
            <span className="block font-[inherit] text-[2.65rem] font-semibold leading-[1] tracking-[0.06em] text-white sm:text-7xl sm:tracking-[0.06em] lg:text-[4.5rem] xl:text-[6.25rem]">
              FAULTLINE
            </span>
            <span className="mt-4 block h-px w-16 bg-[#65D6E5] sm:mt-6 sm:w-24" aria-hidden="true" />
            <span className="mt-4 block max-w-4xl text-[1.85rem] font-bold leading-[1.08] tracking-[-0.04em] text-white sm:mt-6 sm:text-5xl lg:text-[2.75rem] xl:text-6xl">
              See the pressure before the break.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-[1.75] text-[#E3E5E8] sm:text-xl lg:mt-5 lg:text-lg xl:text-xl">
            FAULTLINE monitors credit, liquidity, rates, macro conditions, equities and crypto together to show where systemic pressure is building.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-[1.75] text-[#B7C1CD]">
            Built on the <a href="#thesis" className={`font-semibold text-white underline decoration-[#65D6E5]/60 underline-offset-4 hover:decoration-[#65D6E5] ${focusRing}`}>Pentagonal Thesis™</a>: what is happening, why, what could come next, what to watch, and how to frame a decision. It does not claim to know that a crash will happen.
          </p>
          <div className="mt-7 sm:mt-9 lg:mt-7 xl:mt-9">
            <Ctas primaryTrack />
          </div>
          <p className="mt-4 text-[12px] leading-[1.75] text-[#A8B4C2]">
            Explore opens the public Pressure Index. No account is required.
          </p>
        </div>
        <div className="w-full max-w-md lg:justify-self-end">
          <HeroProof />
        </div>
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
      <SeismicUnderlay intensity={0.72} />
      <div className="pointer-events-none absolute inset-0 bg-[#0A0D12]/72" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
          THE MARKET IS A SYSTEM. UNDERSTAND THE PRESSURE BUILDING BENEATH IT.
        </h2>
        <div className="mt-10"><MembershipOffer /></div>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-[1.75] text-[#C9D4E0]">
          Explore the limited public preview without an account. Full intelligence is offered through one $99/month membership.
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
    title: initialSection === "pricing" ? "FAULTLINE Intelligence — $99/month" : PAGE_TITLE,
    description: initialSection === "pricing" ? "Premium financial intelligence through one $99/month membership. Explore the limited public preview without registering." : PAGE_DESCRIPTION,
    canonical: initialSection === "pricing" ? "/pricing" : "/",
  });

  useEffect(() => {
    if (!initialSection) return;
    const targetSection = initialSection === "pricing" ? "access" : initialSection;
    const timer = window.setTimeout(() => document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => window.clearTimeout(timer);
  }, [initialSection]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0A0D12] text-[#F4F2ED]" style={{ fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <a href="#main" className={`absolute left-4 top-4 z-[60] -translate-y-24 rounded bg-[#65D6E5] px-3 py-2 text-sm font-semibold text-[#050608] focus:translate-y-0 ${focusRing}`}>
        Skip to content
      </a>
      <MarketTicker />
      <div className="border-b border-[#00D4FF]/15 bg-[#0A0D12] px-4 py-2 text-center">
        <p className="text-[12px] font-[inherit] tracking-[0.06em] text-[#65D6E5] sm:text-[12px] sm:tracking-[0.06em]">
          FAULTLINE STRUCTURAL MARKET INTELLIGENCE <span className="mx-2 text-white/30">/</span> SYSTEMIC PRESSURE AND INTERPRETATION
        </p>
      </div>
      <Header />
      <main id="main">
        <Hero />
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
