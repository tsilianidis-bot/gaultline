import SEOLandingPage from "@/pages/SEOLandingPage";

export default function MarketCrashIndicator() {
  return (
    <SEOLandingPage
      seo={{
        title: "Market Crash Indicator — Systemic Risk Detection | FAULTLINE",
        description: "Systemic market stress indicator tracking credit spreads, funding rates, the Treasury yield curve, inflation, and unemployment. See when systemic pressure is building.",
        canonical: "/market-crash-indicator",
      }}
      badge="CRASH RISK INTELLIGENCE"
      headline={"Market Crash Indicator\nKnow Before the Break"}
      subheadline="FAULTLINE's market crash indicator is built on the Pressure Index, which combines credit spreads, funding rates, the Treasury yield curve, inflation, unemployment, and a static AI-concentration baseline into a single systemic stress score."
      ctaLabel="VIEW CRASH RISK"
      ctaHref="/pressure-index"
      accentColor="#FF4444"
      features={[
        { icon: "◈", title: "Credit Spread Monitoring", desc: "High-yield credit spreads are the earliest warning system for systemic stress. FAULTLINE tracks them as new data is published." },
        { icon: "◎", title: "Yield Curve Monitoring", desc: "The 10Y–2Y Treasury spread in inversion and flatness bands, blended with the 10Y yield level. The Pressure Index does not read VIX." },
        { icon: "⬡", title: "Liquidity Withdrawal Signals", desc: "See when funding conditions tighten — high-yield spreads and SOFR — a common thread in many major crashes." },
        { icon: "◈", title: "Labor & Rates Vector", desc: "The unemployment rate blended with the 10Y Treasury yield. It is not an advance/decline or market-breadth measure." },
        { icon: "◎", title: "Historical Analog Matching", desc: "Pattern-match current conditions against 2000, 2008, 2020, and 2022 to see which historical fracture today most resembles." },
        { icon: "⬡", title: "Historical Context", desc: "Reference profiles for past stress episodes and an archived retrospective reconstruction from 2000. Neither is an independently validated backtest." },
      ]}
      contentSections={[
        {
          heading: "What Is a Market Crash Indicator?",
          body: `A market crash indicator is a composite signal that monitors multiple leading indicators of systemic financial stress — the conditions that historically precede major market dislocations. Unlike lagging indicators that confirm a crash after it has already begun, a genuine crash indicator tracks the structural vulnerabilities that build up before the break.

FAULTLINE's crash indicator is built on the FAULTLINE Pressure Index™, which combines six weighted vectors: liquidity stress, credit contagion, the 10Y–2Y yield curve and 10Y level, macro sensitivity, labor and rates, and AI / speculation (a static concentration baseline). Each vector is scored and weighted to produce a single 0-100 systemic pressure score.

The live index labels scores of 65-79 HIGH STRESS and 80+ SYSTEMIC CRISIS. Those labels describe modeled stress, not a calibrated crash probability. No independently validated backtest shows that market crashes since 2000 were preceded by any particular Pressure Index reading.`,
        },
        {
          heading: "The 6 Vectors Behind the Pressure Index",
          body: `1. Liquidity Stress (20%) — The high-yield credit spread (BAMLH0A0HYM2) and SOFR. Wide spreads and high funding rates indicate tightening credit and funding conditions.

2. Credit Contagion Risk (20%) — The high-yield spread, the 10-year Treasury yield, and the unemployment rate, blended to capture spread widening under rate and labor pressure.

3. Yield Curve (10Y–2Y) & 10Y Level (15%) — The 2-year/10-year Treasury spread scored in inversion and flatness bands, blended with the 10-year yield level. This vector was previously labelled "Volatility Regime"; it does not read VIX or realized volatility.

4. Macro Sensitivity (20%) — CPI and PPI year-over-year and the effective federal funds rate. These are monthly series with publication lag.

5. Labor & Rates (10%) — The unemployment rate blended with the 10-year yield. This vector was previously labelled "Market Breadth"; it is not an advance/decline or market-participation measure.

6. AI / Speculation (15%) — A static reference value for AI mega-cap concentration (~32.4% of the S&P 500), adjusted by the live 10-year yield and high-yield spread. The concentration baseline is not a live measurement.`,
        },
        {
          heading: "What the Historical Evidence Shows",
          body: `FAULTLINE has not published an independently validated predictive backtest. The historical evidence that exists is limited:

Historical analogs: The analog library compares current vector scores with fixed reference profiles for past stress episodes (1973, 1998, 2000, 2008, 2020, and 2022). Similarity is not an outcome forecast.

Track Record archive: The Track Record page shows an archived retrospective reconstruction from 2000 onward. It was calibrated against known historical stress episodes, uses revised rather than point-in-time data, and its formula was not versioned; the current live formula does not reproduce it.

Research reconstruction: A reproducible research reconstruction of the frozen live formula (2000–2026) peaked at 56, reached the Elevated band before 10 of 26 registered 10% S&P 500 drawdowns, never reached High Stress, and was rated inconclusive.

Note: Past readings do not guarantee future results. The Pressure Index is a risk monitoring tool, not a market timing system.`,
        },
      ]}
      faqs={[
        {
          question: "Can FAULTLINE predict market crashes?",
          answer: "No. FAULTLINE's market crash indicator measures the current level of systemic risk — it does not predict when or whether a crash will occur. High Pressure Index readings indicate elevated crash risk, not certainty of a crash. Markets can remain in HIGH STRESS for extended periods without a major dislocation. The indicator is a risk management tool, not a market timing system.",
        },
        {
          question: "What is the difference between HIGH STRESS and SYSTEMIC CRISIS?",
          answer: "HIGH STRESS (score 65-79) indicates that multiple Pressure Index vectors are elevated at once — for example, credit spreads widening while funding rates and the yield curve signal tightening. SYSTEMIC CRISIS (score 80+) is the model's highest classification, with severe readings across most vectors. Neither label is a calibrated crash probability.",
        },
        {
          question: "How is the FAULTLINE crash indicator different from the VIX?",
          answer: "The VIX measures implied volatility in S&P 500 options — it reflects current market fear. The Pressure Index does not read VIX. It combines six vectors built from FRED credit, funding, Treasury curve, inflation, policy-rate and unemployment data plus a static AI-concentration baseline. It measures a different kind of stress; it has not been shown to give earlier warning or fewer false signals than the VIX.",
        },
        {
          question: "Is the crash indicator available for free?",
          answer: "Yes. The FAULTLINE Pressure Index — the core of the crash indicator — is available for free at /pressure-index. No login required. The full vector breakdown, historical data, and regime analysis are signed-in tools. Signed-in tools start with a free account; paid plans are not on sale.",
        },
        {
          question: "How often does the crash indicator update?",
          answer: "The FAULTLINE Pressure Index recalculates from FRED data. Daily series such as credit spreads, Treasury yields, and SOFR reflect the latest published observation; CPI, PPI, and unemployment are monthly with publication lag. The Pressure Index does not use VIX.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Systemic market stress score — the core crash indicator." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Pattern-match today's conditions against 2000, 2008, 2020, and 2022." },
        { label: "RECESSION PROBABILITY", href: "/recession-probability", desc: "Leading indicators of recession risk and economic contraction." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy signals and their impact on market stress." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "Regularly refreshed volatility regime monitoring and VIX analysis." },
        { label: "MARKET RISK DASHBOARD", href: "/stock-market-risk-dashboard", desc: "Comprehensive equity risk monitoring dashboard." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
