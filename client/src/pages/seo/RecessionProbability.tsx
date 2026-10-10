import SEOLandingPage from "@/pages/SEOLandingPage";

export default function RecessionProbability() {
  return (
    <SEOLandingPage
      seo={{
        title: "Recession Risk Context — Leading Economic Risk Signals | FAULTLINE",
        description: "Recession-risk context from the FRED series FAULTLINE ingests: the 10Y–2Y Treasury curve, high-yield credit spreads, unemployment, inflation, policy rates, and SOFR. FAULTLINE does not offer a recession probability.",
        canonical: "/recession-probability",
      }}
      badge="RECESSION RISK INTELLIGENCE"
      headline={"Recession Risk Context\nLeading Indicators, As Published"}
      subheadline="FAULTLINE reads recession-relevant conditions from FRED — the 10Y–2Y Treasury curve, high-yield credit spreads, the unemployment rate, inflation, policy rates, and SOFR funding — the same eight series that feed the Pressure Index."
      ctaLabel="VIEW RECESSION RISK"
      ctaHref="/pressure-index"
      accentColor="#FF8C00"
      features={[
        { icon: "◈", title: "Yield Curve Inversion Depth", desc: "The yield curve has inverted before every U.S. recession since 1955. FAULTLINE tracks inversion depth and re-steepening signals." },
        { icon: "◎", title: "Unemployment Rate", desc: "The monthly U.S. unemployment rate (FRED UNRATE). FAULTLINE does not ingest weekly jobless claims." },
        { icon: "⬡", title: "Inflation and Policy Rates", desc: "CPI (CPIAUCSL), PPI (PPIACO), and the federal funds rate (FEDFUNDS) from FRED, on their standard release schedules." },
        { icon: "◈", title: "Credit Spread Analysis", desc: "High-yield credit spreads widen as recession risk rises. FAULTLINE reads the ICE BofA US High Yield spread (BAMLH0A0HYM2) from FRED." },
        { icon: "◎", title: "Funding Conditions", desc: "The Secured Overnight Financing Rate (SOFR) from FRED, read alongside credit spreads as a funding-stress input." },
        { icon: "⬡", title: "Historical Context", desc: "Compare today's vector profile with fixed reference profiles of past stress episodes — resemblance, not a forecast." },
      ]}
      contentSections={[
        {
          heading: "Recession Risk and Why It Matters",
          body: `Published recession forecasts estimate the likelihood that the U.S. economy will enter a recession (as dated by the NBER; two consecutive quarters of negative GDP growth is a common rule of thumb, not the official definition) within a stated horizon, often 12 months. FAULTLINE does not offer a recession probability. Publishing one responsibly needs a defined event, a fixed horizon, and a calibration record against resolved outcomes, and FAULTLINE has none of these for recessions. What it shows instead is recession-risk context: the FRED data below and the Pressure Index as a current-conditions reading.

For investors, recession risk matters because recessions are associated with significant equity market drawdowns. Recession-era equity declines have historically been larger than ordinary corrections. Some recessions — 2000-2002 (49% decline) and 2007-2009 (57% decline) — produced much larger drawdowns.

More importantly, recession risk affects which asset classes, sectors, and individual equities are likely to outperform or underperform. Defensive sectors (utilities, consumer staples, healthcare) historically outperform during recessions. Cyclical sectors (technology, consumer discretionary, industrials) underperform. Understanding recession risk helps you think about positioning for the environment ahead, not the one behind you.`,
        },
        {
          heading: "The FRED Data FAULTLINE Reads",
          body: `FAULTLINE's Pressure Index reads eight FRED series, which fall into five groups relevant to recession risk:

1. Yield Curve — The 10-year (DGS10) and 2-year (DGS2) Treasury yields. An inverted yield curve (2yr > 10yr) has historically preceded most U.S. recessions, with long and variable lead times. FAULTLINE reads the 10Y–2Y spread and the 10-year level.

2. Labor — The monthly U.S. unemployment rate (UNRATE). A rising unemployment rate is one of the clearest signs of labor-market deterioration.

3. Credit Spreads — The ICE BofA US High Yield spread (BAMLH0A0HYM2), the premium investors demand to hold junk bonds over Treasuries. Spreads widen as recession risk rises.

4. Inflation and Policy Rates — CPI (CPIAUCSL), PPI (PPIACO), and the federal funds rate (FEDFUNDS). Tight policy into slowing growth has preceded many past recessions.

5. Funding — The Secured Overnight Financing Rate (SOFR), read alongside credit spreads as a funding-stress input.

FAULTLINE does not ingest PMI or ISM surveys, jobless claims, or consumer-confidence data.`,
        },
        {
          heading: "Recession vs. Market Correction: Understanding the Difference",
          body: `Not every market correction is a recession, and not every recession produces a severe market crash. Understanding the distinction helps you read FAULTLINE's recession-risk context.

A market correction (10-20% decline) can occur without a recession — driven by valuation compression, sentiment shifts, or technical factors. These corrections are typically shorter in duration and shallower in depth than recession-driven bear markets.

A recession-driven bear market (typically deeper than a correction) is characterized by fundamental deterioration: falling earnings, rising unemployment, tightening credit conditions, and declining consumer spending. These bear markets last longer and require more time to recover.

FAULTLINE does not offer a recession probability or a recession score, and it does not forecast which of the two will happen. The Pressure Index band describes current systemic pressure only: readings below the HIGH STRESS band (LOW RISK through ELEVATED RISK) describe narrower stress, while HIGH STRESS and SYSTEMIC CRISIS readings describe the broad credit, funding, and rate stress that has accompanied past recession-driven bear markets.`,
        },
      ]}
      faqs={[
        {
          question: "How accurate is FAULTLINE's recession-risk context?",
          answer: "FAULTLINE does not offer a recession probability or a recession score, so there is no forecast accuracy record to report. It shows recession-relevant FRED inputs and the Pressure Index as current-conditions context. The yield curve has inverted before every U.S. recession since 1955, but lead times have varied and not every inversion has been followed by a recession; the timing of recessions is inherently uncertain.",
        },
        {
          question: "Does FAULTLINE have recession-risk tiers?",
          answer: "No. FAULTLINE does not offer a recession probability, so it has no recession tiers. The only fixed bands are the Pressure Index labels (LOW RISK, MODERATE RISK, ELEVATED RISK, HIGH STRESS, SYSTEMIC CRISIS), which describe current systemic stress rather than the likelihood of a recession. ELEVATED RISK and higher readings are a prompt to review exposure to cyclical sectors, high-beta equities, and leveraged positions.",
        },
        {
          question: "Does a high Pressure Index reading mean I should sell everything?",
          answer: "No. The Pressure Index is one input among many. It is a current systemic-stress measure, not a recession forecast, and FAULTLINE does not offer a recession probability. A HIGH STRESS reading alongside deteriorating credit conditions can justify a defensive review — reducing cyclical exposure, increasing cash, and adding defensive sectors. But it does not necessarily mean exiting all equity positions. FAULTLINE's Situation Room helps you stress-test specific portfolio moves against current conditions.",
        },
        {
          question: "How does the yield curve predict recessions?",
          answer: "When the 2-year Treasury yield rises above the 10-year Treasury yield (yield curve inversion), it signals that investors expect the Fed to cut rates in the future — typically because they anticipate economic weakness. Yield-curve inversion has preceded every U.S. recession since 1955, with a lead time of 6-24 months, though not every inversion has been followed by a recession. The re-steepening that follows the inversion (as the Fed begins cutting) is often the final warning before recession arrives.",
        },
        {
          question: "Is FAULTLINE's recession-risk context free?",
          answer: "Yes. FAULTLINE's Pressure Index — six weighted vectors built from eight FRED series — is free to read at /pressure-index. FAULTLINE does not offer a recession probability. Full intelligence is offered through one $99/month membership; checkout is not open yet.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Systemic market stress score — six weighted vectors from eight FRED series." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy signals and their impact on recession risk." },
        { label: "MARKET CRASH INDICATOR", href: "/market-crash-indicator", desc: "Regularly refreshed crash risk detection and systemic stress monitoring." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Track liquidity conditions — the mechanism behind recessions." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Compare today's conditions against historical recession periods." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "Regularly refreshed volatility regime monitoring and risk analysis." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
