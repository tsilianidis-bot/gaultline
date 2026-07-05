import SEOLandingPage from "@/pages/SEOLandingPage";

export default function RecessionProbability() {
  return (
    <SEOLandingPage
      seo={{
        title: "Recession Probability Indicator — Leading Economic Risk Signals | FAULTLINE",
        description: "Real-time recession probability tracking using yield curve inversion, PMI, unemployment claims, credit spreads, and leading economic indicators. Know when recession risk is rising.",
        canonical: "/recession-probability",
      }}
      badge="RECESSION RISK INTELLIGENCE"
      headline={"Recession Probability\nLeading Indicators in Real Time"}
      subheadline="FAULTLINE tracks the leading economic indicators that historically precede recessions — yield curve inversion, PMI deterioration, unemployment claims, credit spreads, and consumer confidence — and synthesizes them into a live recession probability score."
      ctaLabel="VIEW RECESSION RISK"
      ctaHref="/pressure-index"
      accentColor="#FF8C00"
      features={[
        { icon: "◈", title: "Yield Curve Inversion Depth", desc: "The 2yr/10yr spread has inverted before every U.S. recession since 1955. FAULTLINE tracks inversion depth and re-steepening signals." },
        { icon: "◎", title: "PMI Deterioration Tracking", desc: "Manufacturing and services PMI below 50 signals economic contraction. FAULTLINE monitors trend and rate-of-change, not just the level." },
        { icon: "⬡", title: "Unemployment Claims Monitoring", desc: "Initial and continuing jobless claims are leading indicators of labor market deterioration. Rising claims precede recession by 3-6 months." },
        { icon: "◈", title: "Credit Spread Analysis", desc: "High-yield credit spreads widen as recession risk rises. FAULTLINE tracks spread levels, velocity of change, and historical comparisons." },
        { icon: "◎", title: "Consumer Confidence Tracking", desc: "Consumer confidence deterioration precedes spending pullbacks that deepen recessions. FAULTLINE monitors trend reversals." },
        { icon: "⬡", title: "Historical Recession Comparisons", desc: "Compare current conditions against every U.S. recession since 1970 to understand the historical precedent for today's readings." },
      ]}
      contentSections={[
        {
          heading: "What Is Recession Probability and Why Does It Matter?",
          body: `Recession probability is an estimate of the likelihood that the U.S. economy will enter a formal recession — defined as two consecutive quarters of negative GDP growth — within a specified time horizon (typically 12 months).

For investors, recession probability matters because recessions are associated with significant equity market drawdowns. The average S&P 500 decline during recessions since 1945 is approximately 30%. Some recessions — 2000-2002 (49% decline) and 2008-2009 (57% decline) — produced much larger drawdowns.

More importantly, recession risk affects which asset classes, sectors, and individual equities are likely to outperform or underperform. Defensive sectors (utilities, consumer staples, healthcare) historically outperform during recessions. Cyclical sectors (technology, consumer discretionary, industrials) underperform. Understanding recession probability helps you position your portfolio for the environment ahead, not the one behind you.`,
        },
        {
          heading: "The Leading Indicators FAULTLINE Tracks",
          body: `FAULTLINE's recession probability score is built on five leading indicator categories:

1. Yield Curve — The 2-year/10-year Treasury yield spread is the most reliable recession predictor in the historical record. An inverted yield curve (2yr > 10yr) has preceded every U.S. recession since 1955 with a lead time of 6-18 months. FAULTLINE tracks both the inversion depth and the re-steepening signal — the re-steepening that occurs as the Fed begins cutting rates is often the final warning before recession arrives.

2. PMI (Purchasing Managers Index) — The ISM Manufacturing PMI and Services PMI measure business activity. Readings below 50 indicate contraction. FAULTLINE tracks the trend and rate of change, not just the absolute level. A PMI that has been declining for 6+ months is more concerning than a single below-50 reading.

3. Unemployment Claims — Initial jobless claims are a high-frequency leading indicator. A sustained rise in claims (4-week moving average up 10%+) has historically preceded recessions by 3-6 months. FAULTLINE monitors the trend and compares current readings to historical recession thresholds.

4. Credit Spreads — High-yield credit spreads (the premium investors demand to hold junk bonds over Treasuries) widen as recession risk rises. Rapid spread widening — particularly when it occurs across multiple credit quality tiers simultaneously — is a strong recession signal.

5. Consumer Confidence — The Conference Board Consumer Confidence Index and University of Michigan Consumer Sentiment Index measure household expectations. Sharp declines in consumer confidence precede spending pullbacks that deepen recessions.`,
        },
        {
          heading: "Recession vs. Market Correction: Understanding the Difference",
          body: `Not every market correction is a recession, and not every recession produces a severe market crash. Understanding the distinction helps you calibrate your response to FAULTLINE's recession probability readings.

A market correction (10-20% decline) can occur without a recession — driven by valuation compression, sentiment shifts, or technical factors. These corrections are typically shorter in duration and shallower in depth than recession-driven bear markets.

A recession-driven bear market (typically 30-50%+ decline) is characterized by fundamental deterioration: falling earnings, rising unemployment, tightening credit conditions, and declining consumer spending. These bear markets last longer and require more time to recover.

FAULTLINE's recession probability score helps you distinguish between the two scenarios. When recession probability is LOW and the Pressure Index is in LOW or ELEVATED STRESS, a market correction is more likely than a full recession-driven bear market. When recession probability is HIGH and the Pressure Index is in HIGH or CRITICAL STRESS, the risk profile shifts toward a more severe, longer-duration drawdown.`,
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
          answer: "Yes. FAULTLINE's Pressure Index — which incorporates recession probability as one of its seven risk vectors — is available for free at /pressure-index. Full access to the detailed recession probability breakdown, historical comparisons, and leading indicator data requires a Trader or Power subscription.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Live systemic market stress score incorporating recession probability." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy signals and their impact on recession risk." },
        { label: "MARKET CRASH INDICATOR", href: "/market-crash-indicator", desc: "Real-time crash risk detection and systemic stress monitoring." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Track liquidity conditions — the mechanism behind recessions." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Compare today's conditions against historical recession periods." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "Real-time volatility regime monitoring and risk analysis." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
