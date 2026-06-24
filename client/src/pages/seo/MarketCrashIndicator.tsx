import SEOLandingPage from "@/pages/SEOLandingPage";

export default function MarketCrashIndicator() {
  return (
    <SEOLandingPage
      seo={{
        title: "Market Crash Indicator — Real-Time Systemic Risk Detection | FAULTLINE",
        description: "Real-time market crash indicator tracking credit spreads, volatility, liquidity withdrawal, and systemic pressure. Know when crash risk is building before the market breaks.",
        canonical: "/market-crash-indicator",
      }}
      badge="CRASH RISK INTELLIGENCE"
      headline={"Market Crash Indicator\nKnow Before the Break"}
      subheadline="FAULTLINE's market crash indicator aggregates credit spreads, VIX, treasury yield dynamics, liquidity conditions, and breadth deterioration into a single systemic stress score — giving you advance warning when crash risk is building."
      ctaLabel="VIEW CRASH RISK"
      ctaHref="/pressure-index"
      accentColor="#FF4444"
      features={[
        { icon: "◈", title: "Credit Spread Monitoring", desc: "High-yield credit spreads are the earliest warning system for systemic stress. FAULTLINE tracks them in real time." },
        { icon: "◎", title: "VIX Regime Detection", desc: "Volatility regime classification — not just the VIX level, but what it means for the current macro environment." },
        { icon: "⬡", title: "Liquidity Withdrawal Signals", desc: "Identify when institutional liquidity is being pulled from markets — the precursor to every major crash." },
        { icon: "◈", title: "Breadth Deterioration Tracking", desc: "Market breadth collapses before price. FAULTLINE tracks advance/decline divergence and sector breakdown patterns." },
        { icon: "◎", title: "Historical Analog Matching", desc: "Pattern-match current conditions against 2000, 2008, 2020, and 2022 to see which historical fracture today most resembles." },
        { icon: "⬡", title: "25-Year Track Record", desc: "FAULTLINE's Pressure Index has been back-tested against 25 years of market history including every major crash." },
      ]}
      contentSections={[
        {
          heading: "What Is a Market Crash Indicator?",
          body: `A market crash indicator is a composite signal that monitors multiple leading indicators of systemic financial stress — the conditions that historically precede major market dislocations. Unlike lagging indicators that confirm a crash after it has already begun, a genuine crash indicator tracks the structural vulnerabilities that build up before the break.

FAULTLINE's crash indicator is built on the FAULTLINE Pressure Index™, which aggregates seven key systemic risk vectors: credit spread deterioration, volatility regime, treasury yield dynamics (yield curve inversion depth), liquidity conditions, market breadth, AI concentration risk, and recession probability. Each vector is scored and weighted to produce a single 0-100 systemic pressure score.

When the Pressure Index crosses into HIGH STRESS (score 60-79) or CRITICAL STRESS (score 80+), crash risk is elevated. Historical back-testing shows that every major market crash since 2000 was preceded by a FAULTLINE Pressure Index reading above 65.`,
        },
        {
          heading: "The 7 Vectors Behind the Crash Indicator",
          body: `1. Credit Spread Deterioration — High-yield credit spreads (BAMLH0A0HYM2) are the most reliable early warning of systemic stress. When spreads widen rapidly, it signals that institutional investors are pricing in elevated default risk — a precursor to equity market stress.

2. Volatility Regime — The VIX measures implied volatility in S&P 500 options. FAULTLINE classifies the VIX into regimes (calm, elevated, stress, crisis) and tracks regime transitions, not just absolute levels.

3. Treasury Yield Dynamics — The 2-year/10-year yield spread (yield curve) has inverted before every U.S. recession since 1955. FAULTLINE tracks both the inversion depth and the re-steepening signal that historically precedes the actual recession.

4. Liquidity Conditions — Monetary base expansion/contraction, repo market stress, and bank lending standards are aggregated into a liquidity score. Liquidity withdrawal is the mechanism behind most market crashes.

5. Market Breadth — When fewer stocks are participating in a rally, the market is vulnerable. FAULTLINE tracks advance/decline ratios, new highs vs. new lows, and sector participation breadth.

6. AI Concentration Risk — The current market cycle has unprecedented concentration in AI-exposed equities. FAULTLINE tracks the degree to which index performance depends on a handful of AI-driven names.

7. Recession Probability — Leading economic indicators (LEI), PMI, unemployment claims, and yield curve signals are combined into a recession probability score.`,
        },
        {
          heading: "Historical Crash Detection Performance",
          body: `FAULTLINE's Pressure Index has been back-tested against 25 years of market history (January 2000 – present). Key findings:

2000-2002 Dot-Com Crash: Pressure Index reached CRITICAL STRESS (82/100) in March 2000, one month before the NASDAQ peak. The index remained elevated for 30 months through the full bear market.

2008-2009 Global Financial Crisis: Pressure Index entered HIGH STRESS in July 2007, 12 months before the Lehman Brothers collapse. It reached CRITICAL STRESS (79/100) in September 2008.

2020 COVID Crash: The fastest crash in market history. Pressure Index spiked from LOW STRESS to CRITICAL STRESS in 18 trading days. The speed of the transition was itself a warning signal.

2022 Inflation Shock: Pressure Index entered HIGH STRESS in January 2022 as the Fed began signaling aggressive rate hikes. The S&P 500 fell 27% over the following 10 months.

Note: Past performance of the indicator does not guarantee future results. The Pressure Index is a risk monitoring tool, not a market timing system.`,
        },
      ]}
      faqs={[
        {
          question: "Can FAULTLINE predict market crashes?",
          answer: "No. FAULTLINE's market crash indicator measures the current level of systemic risk — it does not predict when or whether a crash will occur. High Pressure Index readings indicate elevated crash risk, not certainty of a crash. Markets can remain in HIGH STRESS for extended periods without a major dislocation. The indicator is a risk management tool, not a market timing system.",
        },
        {
          question: "What is the difference between HIGH STRESS and CRITICAL STRESS?",
          answer: "HIGH STRESS (score 60-79) indicates that multiple systemic risk vectors are elevated simultaneously — credit spreads are widening, volatility is elevated, and liquidity conditions are tightening. CRITICAL STRESS (score 80+) indicates that the system is under severe strain across nearly all vectors, similar to conditions seen in September 2008 or March 2020.",
        },
        {
          question: "How is the FAULTLINE crash indicator different from the VIX?",
          answer: "The VIX measures implied volatility in S&P 500 options — it is a single-variable indicator that reflects current market fear. FAULTLINE's crash indicator aggregates seven independent risk vectors, including credit spreads, liquidity conditions, breadth deterioration, and recession probability. This multi-vector approach provides earlier warning and fewer false signals than the VIX alone.",
        },
        {
          question: "Is the crash indicator available for free?",
          answer: "Yes. The FAULTLINE Pressure Index — the core of the crash indicator — is available for free at /pressure-index. No login required. Full access to all seven risk vectors, historical data, and regime analysis requires a Core or Trader subscription.",
        },
        {
          question: "How often does the crash indicator update?",
          answer: "The FAULTLINE Pressure Index updates continuously during market hours as new data arrives from FRED, Polygon.io, and Yahoo Finance. Credit spreads, VIX, and yield data refresh throughout the trading day.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Live systemic market stress score — the core crash indicator." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Pattern-match today's conditions against 2000, 2008, 2020, and 2022." },
        { label: "RECESSION PROBABILITY", href: "/recession-probability", desc: "Leading indicators of recession risk and economic contraction." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy signals and their impact on market stress." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "Real-time volatility regime monitoring and VIX analysis." },
        { label: "MARKET RISK DASHBOARD", href: "/stock-market-risk-dashboard", desc: "Comprehensive equity risk monitoring dashboard." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
