import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getLoginUrl, handleLoginCtaClick } from "@/const";
import { useSEO } from "@/hooks/useSEO";
import { trackStartFreeClicked } from "@/hooks/useAnalytics";
import SeismicUnderlay from "@/components/landing/SeismicUnderlay";

const EXPLORE_HREF = "/pressure-index";
const METHOD_HREF = "#methodology";

const PAGE_TITLE = "FAULTLINE | Systemic Risk Intelligence for Financial Markets";
const PAGE_DESCRIPTION =
  "FAULTLINE reads credit stress, liquidity, the yield curve, volatility regime, macro conditions, equities, and crypto to show where systemic pressure is building.";

const navItems = [
  { label: "Intelligence", href: "#stack" },
  { label: "Pressure Index", href: "#pressure" },
  { label: "Analogs", href: "#analogs" },
  { label: "PLATO", href: "#plato" },
  { label: "Methodology", href: METHOD_HREF },
];

const pipeline = [
  ["Raw data", "Latest FRED observations, Polygon daily equity aggregates, Yahoo quotes, and CoinGecko crypto statistics."],
  ["Signals", "Equity labels from the symbol classifier, and crypto labels from the crypto intelligence engine."],
  ["Cross-market relationships", "Stock-regime versus crypto-regime alignment, plus vectors that combine credit, rates, liquidity, and macro inputs."],
  ["Systemic-risk analysis", "A six-vector pressure composite. A separate two-state regime model reads credit, rates, volatility, liquidity, and equity features and does not change the index."],
  ["Regime detection", "Pressure bands, equity-regime labels from SPY trend plus the index, and crypto cycle regimes."],
  ["Faultline Pressure Index™", "A 0–100 weighted composite of the six vector scores."],
  ["PLATO", "The interpretation layer. PLATO market explanation reads the measurements and says what they mean."],
  ["Intelligence", "Recorded seismograph readings, the daily brief generator, and the public brief archive."],
] as const;

const stack = [
  {
    label: "Core risk engine",
    items: [
      ["Faultline Pressure Index™", "0–100 weighted composite of the six live vectors."],
      ["Six stress vectors", "Liquidity, credit contagion, yield-curve volatility proxy, macro sensitivity, labor-and-rates breadth, and a static AI-concentration baseline."],
      ["Risk regime bands", "Low, Moderate, Elevated, High Stress, and Systemic Crisis, from fixed score thresholds."],
      ["Systemic Regime Engine", "Two-state Gaussian HMM on a PCA factor. Model sre-hmm2-v1.0.0. It does not feed the Pressure Index."],
      ["Signal convergence", "An n-of-m vote across independent engines, not an average."],
    ],
  },
  {
    label: "Macro intelligence",
    items: [
      ["Yield curve", "10-year minus 2-year from FRED DGS10 and DGS2. T10Y2Y is also a systemic-regime feature."],
      ["Interest-rate conditions", "Federal funds, SOFR, and Treasury yields."],
      ["Inflation", "CPI and PPI, year-over-year from monthly FRED levels. Publication lag applies."],
      ["Unemployment", "FRED UNRATE. Monthly, with publication lag. This is the labor input."],
      ["Financial conditions", "NFCI and the St. Louis Fed Financial Stress Index are weekly features in the systemic-regime model."],
    ],
  },
  {
    label: "Credit intelligence",
    items: [
      ["High-yield credit", "ICE BofA US High Yield OAS, FRED BAMLH0A0HYM2, inside the pressure composite."],
      ["Investment-grade credit", "ICE BofA US Corporate OAS, FRED BAMLC0A0CM, in the systemic-regime feature set only."],
      ["Credit and rates together", "The credit-contagion vector blends the high-yield spread, the 10-year yield, and unemployment."],
    ],
  },
  {
    label: "Equity and market structure",
    items: [
      ["Equity market regimes", "Eight labels from the Pressure Index plus SPY trend on Polygon daily bars."],
      ["Symbol intelligence", "Regime-aware signal labels for individual tickers."],
      ["Aftershock map", "A static contagion graph rescored with price, volume, volatility, and pressure context."],
      ["Index context", "S&P 500 return, 21-day realized volatility, and 252-day drawdown are systemic-regime features."],
      ["Quoted boards", "Major equity indexes via Yahoo. Not a substitute for the pressure score."],
    ],
  },
  {
    label: "Rates and fixed income",
    items: [
      ["Treasury yields", "2-year, 10-year, and, on the markets board, 30-year constant-maturity rates from FRED."],
      ["Curve inversion and steepening", "Threshold bands on the 10-year minus 2-year spread inside the volatility vector."],
      ["Curve on the markets board", "A derived 2-year/10-year spread in basis points."],
    ],
  },
  {
    label: "Crypto intelligence",
    items: [
      ["Bitcoin and Ethereum", "Asset reads from CoinGecko, joined to the macro pressure score."],
      ["Crypto market regimes", "Cycle labels derived from the crypto intelligence report."],
      ["Crypto volatility", "24-hour range across the top markets returned by CoinGecko."],
      ["Crypto and macro", "The crypto systemic score includes the Pressure Index. Cross-market alignment compares crypto regime with the equity regime."],
      ["Dominance and market cap", "CoinGecko global statistics, including Bitcoin dominance."],
    ],
  },
  {
    label: "Historical intelligence",
    items: [
      ["Historical analog engine", "Euclidean similarity between the current vector profile and a fixed fingerprint library."],
      ["Pressure Index library", "2000, 2008, 2020, 2022, 1998, and 1973."],
      ["Extended FMOS library", "Adds 2015, 2011, 2019, and 2023. Similarity is still not an outcome."],
      ["Research stress windows", "Labeled intervals for systemic-regime validation only. They are not used to fit the model."],
    ],
  },
  {
    label: "Interpretation",
    items: [
      ["PLATO", "The customer-facing interpretation layer. FAULTLINE measures. PLATO explains."],
      ["Daily intelligence brief", "Generated from an engine snapshot. A public archive is published at /daily-brief."],
      ["Seismograph record", "Stores pressure readings and looks for recurring patterns in that record."],
      ["Cross-market synthesis", "Plain-language alignment or divergence between the equity regime and the crypto regime."],
      ["Situation Room", "An in-app portfolio-level review beside trade preflight. It is not part of the public Pressure Index, and this page does not link into the signed-in app."],
    ],
  },
] as const;

const futureItems = [
  "GDP and other BEA growth accounts. No BEA client is wired into the engines.",
  "Jobless claims. Unemployment is the labor series that is actually read.",
  "Lending-standards or bank loan-officer surveys.",
  "Money supply as a pressure-index input. M2 appears in unused client metadata, not in the live composite.",
  "Direct BLS, BEA, or Treasury.gov clients. Those statistics are read only where FRED republishes them.",
  "Advance/decline market breadth. The vector named Market Breadth uses unemployment and the 10-year yield.",
  "A live market-cap concentration feed. The AI vector uses a static 32.4% baseline.",
  "Duration stress as its own model.",
  "A named credit/liquidity divergence module.",
  "Leadership analysis as its own model.",
  "A 2024–2025 analog period. It is not in the fingerprint library.",
  "A point-in-time backtest that replays raw inputs through the live formulas. The audit utility marks raw recreation as not defensible.",
  "Calibrated crash probabilities. Scenario scores elsewhere in the stack are arithmetic, not a fitted forecast.",
];

const experiences = [
  {
    name: "Faultline Pressure Index™",
    href: EXPLORE_HREF,
    what: "A single 0–100 reading of systemic pressure.",
    analyzes: "High-yield spreads, SOFR, the Treasury curve, CPI, PPI, federal funds, and unemployment, plus a static concentration baseline.",
    matters: "It is the shared starting number for the equity regime, the crypto macro link, and the interpretation layer.",
  },
  {
    name: "Seismograph",
    href: null,
    what: "A record of pressure readings over time.",
    analyzes: "The stored score, regime, direction, and patterns in that history.",
    matters: "A level means more next to the path that produced it. Pattern counts are historical descriptions, not guarantees.",
  },
  {
    name: "Stock signals",
    href: null,
    what: "Symbol intelligence for individual equities.",
    analyzes: "Ticker context classified into regime-aware labels such as momentum, rate sensitivity, and macro vulnerability. Prices come from Polygon daily aggregates and Yahoo quotes.",
    matters: "A label says how a name sits in the current macro read. It is not an instruction to trade.",
  },
  {
    name: "Crypto intelligence",
    href: null,
    what: "Bitcoin, Ethereum, and a market-wide crypto stress score.",
    analyzes: "CoinGecko prices, dominance, 24-hour ranges, and the Pressure Index.",
    matters: "Crypto is treated as part of the same risk system, not as a separate dashboard.",
  },
  {
    name: "Historical analog engine",
    href: "#analogs",
    what: "A comparison of today’s vector profile with a fixed library of past periods.",
    analyzes: "Distance between current liquidity, credit, macro, and concentration scores and the stored fingerprints.",
    matters: "Similarity describes resemblance. It does not mean the same path will follow.",
  },
  {
    name: "Daily intelligence brief",
    href: "/daily-brief",
    what: "A written brief from the engine snapshot, plus a public archive.",
    analyzes: "Pressure, regime, and the inputs assembled for that brief.",
    matters: "It is the narrative layer of the same measurements, not a second source of truth.",
  },
  {
    name: "PLATO",
    href: "#plato",
    what: "The interpretation layer of FAULTLINE.",
    analyzes: "Persisted engine output, including the pressure read and, when present, the systemic-regime contract.",
    matters: "PLATO can explain a measurement. It cannot replace one.",
  },
] as const;

const bands = [
  ["0–24", "Low Risk", "LOW RISK"],
  ["25–44", "Moderate", "MODERATE RISK"],
  ["45–64", "Elevated", "ELEVATED RISK"],
  ["65–79", "High", "HIGH STRESS"],
  ["80–100", "Critical", "SYSTEMIC CRISIS"],
];

const weights = [
  ["Liquidity stress", "20%", "High-yield OAS and SOFR"],
  ["Credit contagion", "20%", "High-yield OAS, 10-year yield, unemployment"],
  ["Volatility regime", "15%", "10-year minus 2-year, and the 10-year level. Not the VIX."],
  ["Macro sensitivity", "20%", "CPI, PPI, and federal funds. Monthly series are lagged."],
  ["Market breadth", "10%", "Unemployment and the 10-year yield. Not advance/decline breadth."],
  ["AI / speculative bubble", "15%", "Static 32.4% concentration baseline, adjusted by yields and spreads."],
];

const sources = [
  ["Federal Reserve / FRED", "Primary economic and financial series", "High-yield and investment-grade OAS, Treasury constant-maturity yields, T10Y2Y, SOFR, federal funds, CPI, PPI, unemployment, VIX close, S&P 500, NFCI, and the St. Louis Fed Financial Stress Index.", "Daily series are the latest published observation, typically the prior business day. CPI, PPI, unemployment, and federal funds are monthly and lagged. NFCI and the financial-stress index are weekly. Nothing here is a tick feed."],
  ["Polygon", "Market-data provider", "Grouped daily equity aggregates used for signals and for SPY trend in the equity-regime engine.", "Daily bars, including the previous session. This path is not a tick feed."],
  ["Yahoo quotes", "Market-data provider", "Index, volatility, FX, commodity, Bitcoin, and Ethereum quotes on the markets board, and a second quote path for signals.", "Snapshot quotes. Session state is carried on the quote. Treat them as a board, not as the pressure calculation."],
  ["CoinGecko", "Market-data provider", "Coin prices, global market cap, Bitcoin dominance, and 24-hour ranges for crypto intelligence.", "Cached in the crypto engine (about 90 seconds for an asset, about 3 minutes for the systemic crypto score). Not an on-exchange matching engine."],
];

const analogs = [
  ["2000", "Dot-Com Bubble", "Pressure Index library and FMOS library"],
  ["1973", "1970s Stagflation", "Pressure Index library and FMOS library"],
  ["1998", "LTCM / Russia Crisis", "Pressure Index library and FMOS library"],
  ["2008", "Global Financial Crisis", "Pressure Index library and FMOS library"],
  ["2011", "European Debt Crisis", "FMOS library"],
  ["2015", "China Shock / EM Crisis", "FMOS library"],
  ["2019", "Fed Pivot Rally", "FMOS library"],
  ["2020", "COVID Shock", "Pressure Index library and FMOS library"],
  ["2022", "Rates Shock", "Pressure Index library and FMOS library"],
  ["2023", "Soft Landing Rally", "FMOS library"],
];

const researchWindows = [
  ["2007-07-01 to 2009-03-31", "Global Financial Crisis"],
  ["2011-07-01 to 2012-06-30", "Euro area sovereign stress"],
  ["2015-08-01 to 2016-02-29", "Taper / EM stress"],
  ["2018-10-01 to 2018-12-31", "Q4 2018 drawdown"],
  ["2020-02-20 to 2020-04-30", "COVID liquidity shock"],
  ["2022-01-03 to 2022-10-31", "2022 hiking / inflation shock"],
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

const faqs = [
  ["Is FAULTLINE investment advice?", "No. FAULTLINE is an analytical framework and an educational record of how that framework reads public data. It is not a recommendation to buy or sell any security, and it does not know your circumstances."],
  ["What does a high Pressure Index mean?", "More of the monitored inputs are in stressed ranges together. High pressure does not mean a crash is imminent. Low pressure does not mean risk is absent."],
  ["Does similarity to a past period mean the same outcome?", "No. The analog engine measures distance between fingerprints. Markets can diverge from any historical resemblance."],
];

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-4 text-[11px] font-mono font-semibold tracking-[0.28em] text-[#00D4FF]">{children}</p>;
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
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#050608]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className={`flex items-center gap-3 ${focusRing}`} onClick={close}>
          <span className="h-2 w-2 rounded-full bg-[#00D4FF]" aria-hidden="true" />
          <span className="font-mono text-sm font-black tracking-[0.28em] text-white">FAULTLINE</span>
          <span className="hidden border-l border-white/10 pl-3 text-[10px] font-mono tracking-[0.18em] text-[#A8B8CC] lg:inline">MARKET RISK INTELLIGENCE</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Landing navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={`text-[11px] font-mono tracking-[0.12em] text-[#C5D0DC] transition-colors hover:text-[#00D4FF] ${focusRing}`}>
              {item.label.toUpperCase()}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <SignInCta className={`rounded-lg border border-white/15 px-3 py-2 text-[10px] font-mono tracking-[0.14em] text-[#C5D0DC] transition-colors hover:border-[#00D4FF]/50 hover:text-white ${focusRing}`} />
          <a href={EXPLORE_HREF} onClick={() => trackStartFreeClicked("marketing_rebuild_hero")} className={`rounded-lg bg-[#00D4FF] px-3 py-2 text-[10px] font-mono font-black tracking-[0.14em] text-[#050608] transition-colors hover:bg-[#6EE7FF] ${focusRing}`}>
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
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={close} className={`rounded-lg px-3 py-3 text-[12px] font-mono tracking-[0.12em] text-white ${focusRing}`}>
                {item.label.toUpperCase()}
              </a>
            ))}
            <SignInCta className={`rounded-lg px-3 py-3 text-left text-[12px] font-mono tracking-[0.12em] text-white ${focusRing}`} />
            <a href={EXPLORE_HREF} onClick={close} className={`mt-2 rounded-lg bg-[#00D4FF] px-3 py-3 text-center text-[12px] font-mono font-black tracking-[0.12em] text-[#050608] ${focusRing}`}>
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
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#00D4FF] px-7 py-4 text-center text-[12px] font-mono font-black tracking-[0.13em] text-[#050608] transition hover:bg-[#6EE7FF] ${focusRing}`}
      >
        EXPLORE FAULTLINE <Arrow />
      </a>
      <a href={METHOD_HREF} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#00D4FF]/40 bg-[#050608]/70 px-7 py-4 text-center text-[12px] font-mono font-bold tracking-[0.13em] text-[#00D4FF] transition hover:border-[#00D4FF]/70 hover:bg-[#00D4FF]/10 ${focusRing}`}>
        VIEW METHODOLOGY
      </a>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[#00D4FF]/10 bg-[#050608]">
      <SeismicUnderlay className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(180deg,transparent_0%,transparent_42%,#000_68%)] lg:[mask-image:linear-gradient(90deg,transparent_0%,transparent_38%,rgba(0,0,0,0.4)_54%,#000_72%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,8,0.94)_0%,rgba(5,6,8,0.9)_48%,rgba(5,6,8,0.45)_72%,rgba(5,6,8,0.12)_100%)] lg:bg-[linear-gradient(90deg,rgba(5,6,8,0.96)_0%,rgba(5,6,8,0.92)_42%,rgba(5,6,8,0.55)_62%,rgba(5,6,8,0.08)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050608] to-transparent" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[calc(100svh-88px)] max-w-7xl items-center px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-4xl">
          <h1 className="max-w-5xl">
            <span className="block font-mono text-[2.65rem] font-black leading-[0.9] tracking-[0.14em] text-white sm:text-7xl sm:tracking-[0.16em] lg:text-[6.25rem]">
              FAULTLINE
            </span>
            <span className="mt-4 block h-px w-16 bg-[#00D4FF] sm:mt-6 sm:w-24" aria-hidden="true" />
            <span className="mt-4 block max-w-4xl text-[1.85rem] font-bold leading-[1.08] tracking-[-0.04em] text-white sm:mt-6 sm:text-5xl lg:text-6xl">
              See the fault before the break.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#E4EAF2] sm:text-xl">
            FAULTLINE monitors the relationships between markets, credit, liquidity, rates, volatility, macroeconomic conditions, equities and crypto to identify where systemic pressure is building.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#A8B8CC] sm:text-base">
            A systemic-risk intelligence and interpretation engine. It connects those domains into a pressure reading and a written explanation. It does not claim to know that a crash will happen.
          </p>
          <div className="mt-9">
            <Ctas primaryTrack />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-[#93A3B5]">
            Explore opens the public Pressure Index. No account is required. Methodology is on this page.
          </p>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section id="problem" className="scroll-mt-24 border-b border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionLabel>THE PROBLEM</SectionLabel>
          <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">
            The signal is rarely hiding in one chart. It is hiding in the relationships between markets.
          </h2>
        </div>
        <div className="text-base leading-relaxed text-[#C9D4E0] sm:text-lg">
          <p>
            Prices, charts, headlines, economic releases, and indicators are already everywhere. The hard question is what they mean together.
          </p>
          <p className="mt-5">
            FAULTLINE exists to connect credit, liquidity, rates, the curve, macro releases, equities, and crypto into one pressure reading and one explanation of why that reading matters.
          </p>
        </div>
      </div>
    </section>
  );
}

function Pipeline() {
  return (
    <section id="pipeline" className="scroll-mt-24 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>WHAT FAULTLINE DOES</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">From raw data to intelligence.</h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#C9D4E0]">What is happening, why it matters, and where pressure is building. Each stage below is a system that exists in the product.</p>
        <ol className="mt-12 grid gap-0">
          {pipeline.map(([title, body], index) => (
            <li key={title} className="grid gap-4 border-t border-[#00D4FF]/15 py-5 sm:grid-cols-[auto_14rem_1fr] sm:items-start sm:gap-8">
              <span className="font-mono text-[12px] tracking-[0.18em] text-[#00D4FF]">0{index + 1}</span>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-[#A8B8CC] sm:text-base">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section id="stack" className="scroll-mt-24 border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>INTELLIGENCE STACK</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">What is actually implemented.</h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#C9D4E0]">Only tools present in the engines are listed here. Anything else is in Future Intelligence.</p>
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {stack.map((group) => (
            <article key={group.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <h3 className="text-[12px] font-mono font-semibold tracking-[0.2em] text-[#00D4FF]">{group.label.toUpperCase()}</h3>
              <ul className="mt-5 grid gap-4">
                {group.items.map(([name, detail]) => (
                  <li key={name}>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#A8B8CC]">{detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#F5C16C]/30 bg-[#F5C16C]/[0.05] p-6">
          <h3 className="text-[12px] font-mono font-semibold tracking-[0.22em] text-[#F5C16C]">FUTURE INTELLIGENCE</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#E7D7B4]">These ideas are not current product behavior. They are listed so they are not mistaken for live tools.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {futureItems.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-[#E4D3AE]">{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Experiences() {
  return (
    <section id="experiences" className="scroll-mt-24 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>PRODUCT EXPERIENCES</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">The readings, and what each one is for.</h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {experiences.map((item) => (
            <article key={item.name} className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0A1018] p-6">
              <h3 className="text-xl font-semibold text-white">{item.name}</h3>
              <dl className="mt-5 grid gap-4 text-sm leading-relaxed">
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">WHAT IT IS</dt>
                  <dd className="mt-1 text-[#E4EAF2]">{item.what}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">WHAT IT ANALYZES</dt>
                  <dd className="mt-1 text-[#A8B8CC]">{item.analyzes}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">WHY IT MATTERS</dt>
                  <dd className="mt-1 text-[#A8B8CC]">{item.matters}</dd>
                </div>
              </dl>
              {item.href && (
                <a href={item.href} className={`mt-6 inline-flex items-center gap-2 text-[11px] font-mono font-bold tracking-[0.14em] text-[#00D4FF] hover:text-[#6EE7FF] ${focusRing}`}>
                  OPEN <Arrow />
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pressure() {
  return (
    <section id="pressure" className="scroll-mt-24 border-y border-[#00D4FF]/15 bg-[#07121A] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>FAULTLINE PRESSURE INDEX™</SectionLabel>
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">A 0–100 measure of systemic pressure.</h2>
            <p className="mt-6 text-lg leading-relaxed text-[#E4EAF2]">
              The score aggregates the six vectors below. A higher number means more of those inputs sit in stressed ranges at the same time. It measures pressure inside this framework. It does not predict a specific crash, and it does not name a date.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#A8B8CC]">
              Changing conditions show up as the score and the vector mix move between readings. Regime labels are the bands on this scale. Historical context comes from the analog fingerprints, which are a resemblance test, not a forecast.
            </p>
            <a href={EXPLORE_HREF} className={`mt-8 inline-flex items-center gap-2 text-[12px] font-mono font-bold tracking-[0.14em] text-[#00D4FF] hover:text-[#6EE7FF] ${focusRing}`}>
              OPEN THE PUBLIC PRESSURE INDEX <Arrow />
            </a>
          </div>
          <div>
            <ol className="grid gap-2">
              {bands.map(([range, level, regime]) => (
                <li key={range} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 rounded-lg border border-white/[0.08] bg-[#050608]/60 px-4 py-3">
                  <span className="font-mono text-sm text-[#00D4FF]">{range}</span>
                  <span className="text-sm text-white">{level}</span>
                  <span className="font-mono text-[10px] tracking-[0.12em] text-[#A8B8CC]">{regime}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-[#93A3B5]">Thresholds are inclusive at the lower bound: 25, 45, 65, and 80. Source: the classifier in the pressure engine.</p>
          </div>
        </div>
        <div className="mt-10 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Pressure Index vector weights</caption>
            <thead className="bg-white/[0.03] text-[10px] font-mono tracking-[0.16em] text-[#A8B8CC]">
              <tr>
                <th className="px-4 py-3 font-medium">Vector</th>
                <th className="px-4 py-3 font-medium">Weight</th>
                <th className="px-4 py-3 font-medium">What enters the score</th>
              </tr>
            </thead>
            <tbody>
              {weights.map(([name, weight, detail]) => (
                <tr key={name} className="border-t border-white/[0.06]">
                  <th className="px-4 py-3 font-medium text-white">{name}</th>
                  <td className="px-4 py-3 font-mono text-[#00D4FF]">{weight}</td>
                  <td className="px-4 py-3 text-[#C9D4E0]">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CrossMarket() {
  return (
    <section id="cross-market" className="scroll-mt-24 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>CROSS-MARKET INTELLIGENCE</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-5xl">
          Stress often appears first as a relationship changing between markets.
        </h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#C9D4E0]">
          The cross-market engine compares the equity regime with the crypto regime and states whether they are aligned risk-on, aligned risk-off, diverging, or neutral. Separately, the pressure composite is itself a relationship: credit, funding, the curve, inflation, policy rates, and unemployment are scored together.
        </p>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#00D4FF]/20 bg-[#071018] p-6">
            <h3 className="text-lg font-semibold text-white">Equity regime and crypto regime</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#A8B8CC]">
              Equity labels include bull, expansion, consolidation, correction, distribution, bear, recovery, and recession risk. Crypto labels follow the cycle vocabulary in the crypto regime engine, from accumulation through expansion to capitulation. Alignment is a comparison of those two reads.
            </p>
            <p className="mt-4 font-mono text-[11px] leading-relaxed tracking-wide text-[#00D4FF]">
              EQUITY REGIME <span aria-hidden="true">——</span> CRYPTO REGIME <span aria-hidden="true">——</span> ALIGNED OR DIVERGING
            </p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-[#0A1018] p-6">
            <h3 className="text-lg font-semibold text-white">What is quoted, and what is scored</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#A8B8CC]">
              The markets board quotes equity indexes, VIX, the dollar, major FX pairs, gold, silver, crude, natural gas, Bitcoin, and Ethereum. Those quotes are context. The Pressure Index does not take a weight from FX or commodities. VIX enters the separate systemic-regime model as a daily close, not the pressure composite. Inside the composite, “volatility regime” means the yield curve.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function Analogs() {
  return (
    <section id="analogs" className="scroll-mt-24 border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>HISTORICAL ANALOG ENGINE</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">Compare the current profile with periods that were given similar fingerprints.</h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#C9D4E0]">
          Similarity is one minus the normalized Euclidean distance between the current vector scores and a stored fingerprint. A closer fingerprint ranks higher. The library was written as a set of reference profiles. It is not a claim that FAULTLINE issued a live warning in those years, and resemblance is not a prediction.
        </p>
        <p className="mt-4 max-w-3xl text-[12px] font-mono tracking-[0.16em] text-[#F5C16C]">NOT A RETROSPECTIVE RECONSTRUCTION OF LIVE WARNINGS</p>
        <div className="mt-8 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Historical analog periods present in code</caption>
            <thead className="bg-white/[0.03] text-[10px] font-mono tracking-[0.16em] text-[#A8B8CC]">
              <tr>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Library label</th>
                <th className="px-4 py-3 font-medium">Where it is used</th>
              </tr>
            </thead>
            <tbody>
              {analogs.map(([year, label, where]) => (
                <tr key={year + label} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3 font-mono text-[#00D4FF]">{year}</td>
                  <td className="px-4 py-3 text-white">{label}</td>
                  <td className="px-4 py-3 text-[#C9D4E0]">{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Plato() {
  return (
    <section id="plato" className="scroll-mt-24 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>PLATO</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">FAULTLINE detects the signals. PLATO helps explain what they mean.</h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#C9D4E0]">
          PLATO is the interpretation layer. The quantitative measurements come from the FAULTLINE engines. PLATO market explanation synthesizes those measurements into context: what changed, and why it matters. It does not replace the score.
        </p>
        <ol className="mt-10 grid gap-3 sm:grid-cols-5">
          {["Market data", "FAULTLINE signals", "Systemic-risk analysis", "PLATO", "Context / why it matters"].map((step, index) => (
            <li key={step} className="rounded-xl border border-[#00D4FF]/20 bg-[#071018] p-4">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">0{index + 1}</span>
              <p className="mt-3 text-sm font-semibold leading-snug text-white">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[#A8B8CC]">
          When a persisted systemic-regime reading is available, PLATO is instructed to read that contract as-is and not to invent a regime, a crisis probability, or a factor. If the reading is missing, the instruction is to say it is unavailable.
        </p>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    <section id="methodology" className="scroll-mt-24 border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>METHODOLOGY</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">How the Pressure Index is built.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="text-[11px] font-mono tracking-[0.16em] text-[#00D4FF]">METHODOLOGY VERSION</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#E4EAF2]">There is no single published methodology version for this page. The live Pressure Index uses the Champion V1 weights. The audit label on that weight table is v1-observed-2026-08-18. FMOS pipeline version is 1.0.0. The separate systemic-regime model is sre-hmm2-v1.0.0.</p>
          </article>
          <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="text-[11px] font-mono tracking-[0.16em] text-[#00D4FF]">LAST UPDATED</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#E4EAF2]">29 September 2026. This is the date of this methodology copy. It is not the vintage of any market or economic series.</p>
          </article>
          <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="text-[11px] font-mono tracking-[0.16em] text-[#00D4FF]">DATA COVERAGE</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#E4EAF2]">The live index uses the latest valid observation of each series it requests, and about thirteen months of CPI and PPI to form year-over-year changes. No verified point-in-time backtest window is published. The systemic-regime worker requests up to 10,000 observations on its long daily series.</p>
          </article>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="text-sm leading-relaxed text-[#C9D4E0] sm:text-base">
            <h3 className="text-lg font-semibold text-white">Normalization and aggregation</h3>
            <p className="mt-3">Most inputs are linearly mapped from a calm reference range to a stressed reference range and clamped to the score bounds. The curve vector uses threshold bands: deeply inverted, inverted, slightly inverted, flat, and steeper. That band is then blended with the level of the 10-year yield.</p>
            <p className="mt-3">The index is the rounded weighted sum of the six vector scores. Weights sum to 1 and are fixed in the engine. They are not refit on each run.</p>
            <h3 className="mt-8 text-lg font-semibold text-white">Regimes and relationships</h3>
            <p className="mt-3">The composite maps to the five bands in the Pressure Index section. Equity regime detection adds SPY trend to that score. Crypto regime detection uses the crypto report. The systemic-regime HMM is a second opinion on a broader FRED panel, and the code forbids adding it into the pressure weights.</p>
          </div>
          <div className="text-sm leading-relaxed text-[#C9D4E0] sm:text-base">
            <h3 className="text-lg font-semibold text-white">Historical analysis</h3>
            <p className="mt-3">Analog matching ranks the fingerprint library by Euclidean similarity. Narrative outcomes stored next to those fingerprints are descriptions attached to the library. They are not computed drawdowns from a price study inside the analog function.</p>
            <h3 className="mt-8 text-lg font-semibold text-white">Tool and signal inventory</h3>
            <p className="mt-3">The inventory in the intelligence stack is the methodology inventory: pressure vectors, systemic-regime features, equity and crypto regimes, symbol labels, the aftershock graph, analogs, the seismograph record, the daily brief, and PLATO. Items under Future Intelligence are outside this methodology.</p>
            <p className="mt-4">
              <a href="/methodology" className={`text-[#00D4FF] hover:text-[#6EE7FF] ${focusRing}`}>Open the standalone methodology note</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sources() {
  return (
    <section id="sources" className="scroll-mt-24 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>DATA SOURCES</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">Where the inputs come from, and how current they are.</h2>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#C9D4E0]">FRED is the primary government and financial-statistics path. Polygon, Yahoo, and CoinGecko are market-data providers. FAULTLINE does not call BLS, BEA, or Treasury.gov directly. CPI, unemployment, and Treasury yields are used where FRED republishes them.</p>
        <div className="mt-10 grid gap-4">
          {sources.map(([name, kind, contributes, timing]) => (
            <article key={name} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-white">{name}</h3>
                <p className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">{kind.toUpperCase()}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#E4EAF2]">{contributes}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#A8B8CC]">{timing}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Validation() {
  return (
    <section id="validation" className="scroll-mt-24 border-y border-white/[0.06] bg-[#071018] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>HISTORICAL CONTEXT</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">What the historical record in this codebase actually is.</h2>
        <div className="mt-8 max-w-3xl space-y-4 text-base leading-relaxed text-[#C9D4E0]">
          <p>The analog engine does not replay history. It compares today’s scores with hand-specified fingerprints for the periods in the table above. An elevated similarity means the current mix of vector scores is nearer to that fingerprint than to the others. It does not mean the later market path will match the text stored beside the fingerprint.</p>
          <p>An audit utility can recompute the weighted composite from stored monthly vector scores. It refuses to call that a raw-input backtest: legacy months do not carry SOFR, PPI, or source vintages. The code marks that case raw recreation not defensible. This page does not claim a 25-year backtest and does not claim the index predicted any crisis.</p>
          <p>The systemic-regime research file labels these stress windows for validation metrics only. The same file says the windows are not current product truth and are never used to fit the HMM.</p>
        </div>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {researchWindows.map(([span, label]) => (
            <li key={span} className="rounded-lg border border-white/[0.08] px-4 py-3 text-sm text-[#E4EAF2]">
              <span className="font-mono text-[11px] text-[#00D4FF]">{span}</span>
              <span className="mt-1 block">{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm leading-relaxed text-[#A8B8CC]">Past resemblance does not guarantee future outcomes. Elevated, in the pressure engine, means a composite of 45 or higher.</p>
      </div>
    </section>
  );
}

function Limitations() {
  return (
    <section id="limitations" className="scroll-mt-24 bg-[#050608] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>TRANSPARENCY</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">What FAULTLINE does not guarantee.</h2>
        <ul className="mt-8 grid gap-3">
          {[
            "FAULTLINE is an analytical framework. It does not guarantee outcomes.",
            "High pressure does not mean an immediate crash. Low pressure does not mean risk is absent.",
            "Historical relationships can change. A fingerprint that resembled the past can stop resembling it.",
            "Economic series are revised. Monthly series arrive with a reporting lag. Daily FRED series are not intraday.",
            "The model can read stress when a break does not follow, and it can stay quiet when one does. Those are false positives and false negatives.",
            "The AI-concentration input is a static baseline. The breadth vector is not exchange breadth. The volatility vector inside the index is the yield curve.",
            "Nothing on this page is a solicitation or a personal recommendation.",
          ].map((item) => (
            <li key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-sm leading-relaxed text-[#E4EAF2] sm:text-base">{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className="border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>WHO IT IS FOR</SectionLabel>
        <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">People who want the system, not a trade instruction.</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["Investors", "Traders", "Macro researchers", "Financial professionals", "Business leaders", "Risk-conscious decision makers", "Readers who want a broader view of market conditions"].map((item) => (
            <li key={item} className="rounded-xl border border-white/[0.08] px-5 py-4 text-sm text-[#E4EAF2]">{item}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[#A8B8CC]">FAULTLINE does not tell you what to buy or sell.</p>
      </div>
    </section>
  );
}

function Difference() {
  return (
    <section className="bg-[#050608] py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <SectionLabel>WHY FAULTLINE IS DIFFERENT</SectionLabel>
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">Relationships, regimes, pressure, interpretation.</h2>
        </div>
        <div className="text-base leading-relaxed text-[#C9D4E0] sm:text-lg">
          <p>Many platforms are built to show the individual point: a price, a release, a headline, a chart. FAULTLINE is built around the combination.</p>
          <p className="mt-5 text-white">Data tells you what moved. FAULTLINE helps explain why the movement matters in the broader system.</p>
        </div>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section className="border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <h2 className="text-[12px] font-mono font-semibold tracking-[0.28em] text-[#00D4FF]">A NOTE FROM THE FOUNDER</h2>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-[#E4EAF2] sm:text-lg">
          {founderParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-8 text-sm font-semibold tracking-[0.14em] text-white">SEE THE FAULT BEFORE THE BREAK.</p>
        <p className="mt-6 text-base text-[#C9D4E0]">— JT</p>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-[#050608] py-24 sm:py-32">
      <SeismicUnderlay intensity={0.72} />
      <div className="pointer-events-none absolute inset-0 bg-[#050608]/72" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <h2 className="text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
          THE MARKET IS A SYSTEM. UNDERSTAND THE PRESSURE BUILDING BENEATH IT.
        </h2>
        <div className="mt-10 flex justify-center">
          <Ctas />
        </div>
      </div>
    </section>
  );
}

function AccessNote() {
  return (
    <section id="access" className="scroll-mt-24 border-t border-white/[0.06] bg-[#070A0F] py-16">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionLabel>ACCESS</SectionLabel>
        <h2 className="text-2xl font-bold text-white">Checkout is not offered on this page.</h2>
        <p className="mt-4 text-sm leading-relaxed text-[#C9D4E0]">
          The public Pressure Index and this methodology do not require an account. Paid checkout stays unavailable from the landing page.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={EXPLORE_HREF} className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[#00D4FF] px-6 text-[12px] font-mono font-black tracking-[0.12em] text-[#050608] ${focusRing}`}>EXPLORE FAULTLINE</a>
          <a href={METHOD_HREF} className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 text-[12px] font-mono tracking-[0.12em] text-[#E4EAF2] ${focusRing}`}>VIEW METHODOLOGY</a>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="border-t border-white/[0.06] bg-[#050608] py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionLabel>COMMON QUESTIONS</SectionLabel>
        <h2 className="text-3xl font-bold text-white">Limits, stated plainly.</h2>
        <div className="mt-8 divide-y divide-white/[0.08] rounded-xl border border-white/[0.08]">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group p-5">
              <summary className={`cursor-pointer list-none text-base font-semibold text-white ${focusRing}`}>
                {question}
                <span className="float-right text-[#00D4FF] group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-[#C9D4E0]">{answer}</p>
            </details>
          ))}
        </div>
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
            <p className="font-mono text-lg font-black tracking-[0.23em] text-white">FAULTLINE</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#A8B8CC]">Systemic-risk intelligence. See the fault before the break.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-[11px] font-mono tracking-[0.1em] text-[#C5D0DC]" aria-label="Footer">
            <a href={METHOD_HREF} className={`hover:text-[#00D4FF] ${focusRing}`}>METHODOLOGY</a>
            <a href="/trust" className={`hover:text-[#00D4FF] ${focusRing}`}>TRUST CENTER</a>
            <a href="/about" className={`hover:text-[#00D4FF] ${focusRing}`}>ABOUT</a>
            <a href="/daily-brief" className={`hover:text-[#00D4FF] ${focusRing}`}>DAILY BRIEF</a>
            <a href="/contact" className={`hover:text-[#00D4FF] ${focusRing}`}>CONTACT</a>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-6 text-[11px] leading-relaxed text-[#93A3B5] sm:flex-row">
          <span>© 2026 FAULTLINE · A PHOENIX SYSTEMS PLATFORM</span>
          <span>NOT INVESTMENT ADVICE.</span>
        </div>
      </div>
    </footer>
  );
}

type MarketingSitePlacement = "methodology" | "pressure" | "plato" | "analogs" | "stack" | "access" | "pricing";

export default function MarketingSite({ initialSection }: { initialSection?: MarketingSitePlacement } = {}) {
  useSEO({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    canonical: "/",
  });

  useEffect(() => {
    if (!initialSection) return;
    const targetSection = initialSection === "pricing" ? "access" : initialSection;
    const timer = window.setTimeout(() => document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => window.clearTimeout(timer);
  }, [initialSection]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050608] text-white">
      <a href="#main" className={`absolute left-4 top-4 z-[60] -translate-y-24 rounded bg-[#00D4FF] px-3 py-2 text-sm font-semibold text-[#050608] focus:translate-y-0 ${focusRing}`}>
        Skip to content
      </a>
      <div className="border-b border-[#00D4FF]/15 bg-[#050608] px-4 py-2 text-center">
        <p className="text-[10px] font-mono tracking-[0.18em] text-[#00D4FF] sm:text-[11px] sm:tracking-[0.22em]">
          FAULTLINE MARKET RISK INTELLIGENCE <span className="mx-2 text-white/30">/</span> SYSTEMIC PRESSURE AND INTERPRETATION
        </p>
      </div>
      <Header />
      <main id="main">
        <Hero />
        <Problem />
        <Pipeline />
        <Stack />
        <Experiences />
        <Pressure />
        <CrossMarket />
        <Analogs />
        <Plato />
        <Methodology />
        <Sources />
        <Validation />
        <Limitations />
        <Audience />
        <Difference />
        <Founder />
        <FinalCta />
        <AccessNote />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
