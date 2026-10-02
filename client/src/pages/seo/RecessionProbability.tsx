import SEOLandingPage from "@/pages/SEOLandingPage";

export default function RecessionProbability() {
  return (
    <SEOLandingPage
      seo={{
        title: "Recession Risk Context — FRED Leading Indicators | FAULTLINE",
        description: "Recession-risk context from the FRED series FAULTLINE ingests: the 10Y–2Y Treasury curve, high-yield credit spreads, unemployment, inflation, policy rates, and SOFR. FAULTLINE does not offer a recession probability.",
        canonical: "/recession-probability",
      }}
      badge="RECESSION RISK INTELLIGENCE"
      headline={"Recession Risk Context\nFRED Indicators, As Published"}
      subheadline="FAULTLINE reads recession-relevant conditions from FRED — the 10Y–2Y Treasury curve, high-yield credit spreads, the unemployment rate, inflation, policy rates, and SOFR funding — the same eight series that feed the Pressure Index."
      ctaLabel="VIEW RECESSION RISK"
      ctaHref="/pressure-index"
      accentColor="#FF8C00"
      features={[
        { icon: "◈", title: "Yield Curve Inversion Depth", desc: "An inverted 10Y–2Y curve has historically preceded most U.S. recessions, with long and variable lead times. FAULTLINE reads the spread and the 10-year level. FAULTLINE does not offer a recession probability." },
        { icon: "◎", title: "Unemployment Rate", desc: "The monthly U.S. unemployment rate (FRED UNRATE). FAULTLINE does not ingest weekly jobless claims." },
        { icon: "⬡", title: "Inflation and Policy Rates", desc: "CPI (CPIAUCSL), PPI (PPIACO), and the federal funds rate (FEDFUNDS) from FRED, on their standard release schedules." },
        { icon: "◈", title: "Credit Spread Analysis", desc: "High-yield credit spreads widen as recession risk rises. FAULTLINE reads the ICE BofA US High Yield spread (BAMLH0A0HYM2) from FRED." },
        { icon: "◎", title: "Funding Conditions", desc: "The Secured Overnight Financing Rate (SOFR) from FRED, read alongside credit spreads as a funding-stress input." },
        { icon: "⬡", title: "Historical Context", desc: "Compare today's vector profile with fixed reference profiles of past stress episodes — resemblance, not a forecast." },
      ]}
      contentSections={[
        {
          heading: "Why FAULTLINE Does Not Publish a Recession Probability",
          body: `A recession forecast estimates the likelihood that the U.S. economy enters a recession within a stated horizon. Publishing one responsibly needs three things: a defined event (for example, an NBER-dated recession), a fixed horizon, and a calibration record against resolved outcomes. FAULTLINE has none of these for recessions, so it does not offer a recession probability. What it shows instead is the FRED data below and the Pressure Index as current-conditions context.

For investors, recession risk matters because recessions are associated with significant equity market drawdowns. Recession-era equity declines have historically been larger than ordinary corrections. Some recessions — 2000-2002 (49% decline) and 2007-2009 (57% decline) — produced much larger drawdowns.

More importantly, recession risk affects which asset classes, sectors, and individual equities are likely to outperform or underperform. Defensive sectors (utilities, consumer staples, healthcare) historically outperform during recessions. Cyclical sectors (technology, consumer discretionary, industrials) underperform. Understanding recession risk helps you think about the environment ahead, not only the one behind you.`,
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
          body: `Not every market correction is a recession, and not every recession produces a severe market crash. Understanding the distinction matters when you read FAULTLINE's current-conditions data.

A market correction (10-20% decline) can occur without a recession — driven by valuation compression, sentiment shifts, or technical factors. These corrections are typically shorter in duration and shallower in depth than recession-driven bear markets.

A recession-driven bear market (typically deeper than a correction) is characterized by fundamental deterioration: falling earnings, rising unemployment, tightening credit conditions, and declining consumer spending. These bear markets last longer and require more time to recover.

FAULTLINE does not offer a recession probability or score, and it does not forecast which of the two will happen. The Pressure Index band describes current systemic pressure only: readings below HIGH STRESS (LOW RISK through ELEVATED RISK) describe less modeled pressure, and HIGH STRESS or SYSTEMIC CRISIS readings describe more. Neither band is a forecast of a correction or of a recession-driven bear market.`,
        },
      ]}
      faqs={[
        {
          question: "Does FAULTLINE forecast recessions?",
          answer: "No. FAULTLINE does not offer a recession probability or a recession score, so there is no accuracy record to report. It shows the FRED inputs listed on this page and the Pressure Index as current-conditions context. An inverted yield curve has historically preceded most U.S. recessions, with long and variable lead times; that history is not a FAULTLINE forecast.",
        },
        {
          question: "Does FAULTLINE have recession-risk tiers?",
          answer: "No. FAULTLINE does not offer a recession probability, so it has no recession tiers. The only fixed bands are the Pressure Index labels — LOW RISK (0–24), MODERATE RISK (25–44), ELEVATED RISK (45–64), HIGH STRESS (65–79), and SYSTEMIC CRISIS (80–100). They classify current systemic pressure, not recession likelihood.",
        },
        {
          question: "Does a high Pressure Index reading mean I should sell everything?",
          answer: "No. The Pressure Index is one input among many. It is a current systemic-stress measure, not a recession forecast or a trading instruction, and FAULTLINE does not offer a recession probability. Decisions about cyclical exposure, cash, or defensive sectors depend on your own circumstances and other evidence.",
        },
        {
          question: "How does the yield curve relate to recessions?",
          answer: "When the 2-year Treasury yield rises above the 10-year yield (an inversion), markets are typically pricing future rate cuts, often because they expect slower growth. Inversions have historically preceded most U.S. recessions, with long and variable lead times, and the curve has also inverted without a recession following soon after. FAULTLINE reads the 10Y–2Y spread and the 10-year level as current-conditions inputs. FAULTLINE does not offer a recession probability.",
        },
        {
          question: "Is FAULTLINE's recession-risk context free?",
          answer: "Yes. FAULTLINE's Pressure Index — six weighted vectors built from eight FRED series — is free to read at /pressure-index. FAULTLINE does not offer a recession probability. Signed-in access starts with a free account; paid plans are not on sale.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Systemic market stress score — six weighted vectors from eight FRED series." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy signals and their impact on recession risk." },
        { label: "MARKET CRASH INDICATOR", href: "/market-crash-indicator", desc: "Systemic-stress monitoring. FAULTLINE does not offer a crash probability." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Track liquidity conditions as one systemic-pressure input." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Compare today's conditions against historical recession periods." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "Regularly refreshed volatility regime monitoring and risk analysis." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
