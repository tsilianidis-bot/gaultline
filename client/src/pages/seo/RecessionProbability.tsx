import SEOLandingPage from "@/pages/SEOLandingPage";

export default function RecessionProbability() {
  return (
    <SEOLandingPage
      seo={{
        title: "Recession Probability Indicator — Leading Economic Risk Signals | FAULTLINE",
        description: "Recession-risk context from the FRED series FAULTLINE ingests: the 10Y–2Y Treasury curve, high-yield credit spreads, unemployment, inflation, policy rates, and SOFR. Know when recession risk is rising.",
        canonical: "/recession-probability",
      }}
      badge="RECESSION RISK INTELLIGENCE"
      headline={"Recession Probability\nLeading Indicators, As Published"}
      subheadline="FAULTLINE reads recession-relevant conditions from FRED — the 10Y–2Y Treasury curve, high-yield credit spreads, the unemployment rate, inflation, policy rates, and SOFR funding — the same eight series that feed the Pressure Index."
      ctaLabel="VIEW RECESSION RISK"
      ctaHref="/pressure-index"
      accentColor="#FF8C00"
      features={[
        { icon: "◈", title: "Yield Curve Inversion Depth", desc: "The 2yr/10yr spread has inverted before every U.S. recession since 1955. FAULTLINE tracks inversion depth and re-steepening signals." },
        { icon: "◎", title: "Unemployment Rate", desc: "The monthly U.S. unemployment rate (FRED UNRATE). FAULTLINE does not ingest weekly jobless claims." },
        { icon: "⬡", title: "Inflation and Policy Rates", desc: "CPI (CPIAUCSL), PPI (PPIACO), and the federal funds rate (FEDFUNDS) from FRED, on their standard release schedules." },
        { icon: "◈", title: "Credit Spread Analysis", desc: "High-yield credit spreads widen as recession risk rises. FAULTLINE reads the ICE BofA US High Yield spread (BAMLH0A0HYM2) from FRED." },
        { icon: "◎", title: "Funding Conditions", desc: "The Secured Overnight Financing Rate (SOFR) from FRED, read alongside credit spreads as a funding-stress input." },
        { icon: "⬡", title: "Historical Context", desc: "Compare today's vector profile with fixed reference profiles of past stress episodes — resemblance, not a forecast." },
      ]}
      contentSections={[
        {
          heading: "What Is Recession Probability and Why Does It Matter?",
          body: `Recession probability is an estimate of the likelihood that the U.S. economy will enter a formal recession — defined as two consecutive quarters of negative GDP growth — within a specified time horizon (typically 12 months).

For investors, recession probability matters because recessions are associated with significant equity market drawdowns. The average S&P 500 decline during recessions since 1945 is approximately 30%. Some recessions — 2000-2002 (49% decline) and 2008-2009 (57% decline) — produced much larger drawdowns.

More importantly, recession risk affects which asset classes, sectors, and individual equities are likely to outperform or underperform. Defensive sectors (utilities, consumer staples, healthcare) historically outperform during recessions. Cyclical sectors (technology, consumer discretionary, industrials) underperform. Understanding recession probability helps you position your portfolio for the environment ahead, not the one behind you.`,
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
          body: `Not every market correction is a recession, and not every recession produces a severe market crash. Understanding the distinction helps you calibrate your response to FAULTLINE's recession probability readings.

A market correction (10-20% decline) can occur without a recession — driven by valuation compression, sentiment shifts, or technical factors. These corrections are typically shorter in duration and shallower in depth than recession-driven bear markets.

A recession-driven bear market (typically 30-50%+ decline) is characterized by fundamental deterioration: falling earnings, rising unemployment, tightening credit conditions, and declining consumer spending. These bear markets last longer and require more time to recover.

FAULTLINE's recession probability score helps you distinguish between the two scenarios. When recession probability is LOW and the Pressure Index is below the HIGH STRESS band (LOW RISK through ELEVATED RISK), a market correction is more likely than a full recession-driven bear market. When recession probability is HIGH and the Pressure Index is in the HIGH STRESS or SYSTEMIC CRISIS band, the risk profile shifts toward a more severe, longer-duration drawdown.`,
        },
      ]}
      faqs={[
        {
          question: "How accurate is FAULTLINE's recession probability indicator?",
          answer: "FAULTLINE's recession probability score is based on leading indicators with strong historical track records — particularly the yield curve, which has preceded every U.S. recession since 1955. However, no indicator is perfectly accurate, and the timing of recessions is inherently uncertain. The score should be used as a risk management input, not a precise prediction.",
        },
        {
          question: "What recession probability level should I be concerned about?",
          answer: "FAULTLINE classifies recession probability into four tiers: LOW (0-25%), MODERATE (25-50%), ELEVATED (50-75%), and HIGH (75%+). ELEVATED and HIGH readings warrant a review of portfolio positioning — particularly exposure to cyclical sectors, high-beta equities, and leveraged positions.",
        },
        {
          question: "Does a high recession probability mean I should sell everything?",
          answer: "No. Recession probability is one input among many. High recession probability combined with HIGH STRESS macro regime and deteriorating credit conditions warrants defensive positioning — reducing cyclical exposure, increasing cash, and adding defensive sectors. But it does not necessarily mean exiting all equity positions. FAULTLINE's Situation Room helps you stress-test specific portfolio moves against current conditions.",
        },
        {
          question: "How does the yield curve predict recessions?",
          answer: "When the 2-year Treasury yield rises above the 10-year Treasury yield (yield curve inversion), it signals that investors expect the Fed to cut rates in the future — typically because they anticipate economic weakness. This inversion has preceded every U.S. recession since 1955, with a lead time of 6-18 months. The re-steepening that follows the inversion (as the Fed begins cutting) is often the final warning before recession arrives.",
        },
        {
          question: "Is recession probability data available for free?",
          answer: "Yes. FAULTLINE's Pressure Index — six weighted vectors built from eight FRED series — is free to read at /pressure-index. Recession probability is not one of its inputs. Signed-in access starts with a free account; paid plans are not on sale.",
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
