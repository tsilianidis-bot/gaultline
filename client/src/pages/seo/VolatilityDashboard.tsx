import SEOLandingPage from "@/pages/SEOLandingPage";

export default function VolatilityDashboard() {
  return (
    <SEOLandingPage
      seo={{
        title: "Volatility Dashboard — VIX Regime Analysis | FAULTLINE",
        description: "Read the VIX in context: delayed VIX quotes, simple volatility bands, and how volatility relates to the credit, funding, and rates stress measured by the FAULTLINE Pressure Index.",
        canonical: "/volatility-dashboard",
      }}
      badge="VOLATILITY INTELLIGENCE"
      headline={"Volatility Dashboard\nVIX Regime Analysis"}
      subheadline="FAULTLINE puts the VIX level in context. The markets board shows a delayed VIX quote with simple volatility bands, and FAULTLINE's separate systemic-regime model reads the daily VIX close from FRED. The Pressure Index itself is built from credit, funding, rates, inflation, and labor data — so you can see whether volatility is confirming structural pressure or running ahead of it."
      ctaLabel="VIEW VOLATILITY DATA"
      ctaHref="/pressure-index"
      accentColor="#FF6B35"
      features={[
        { icon: "◈", title: "VIX Bands", desc: "The markets board labels the delayed VIX quote low (below 15), normal (15-25), or elevated (above 25). Transitions matter more than absolute levels." },
        { icon: "◎", title: "Implied vs. Realized Volatility", desc: "Educational context: when implied volatility (VIX) exceeds realized volatility, options are expensive; when realized exceeds implied, the market may be underpricing risk." },
        { icon: "⬡", title: "Volatility Term Structure", desc: "Educational context: the VIX term structure (contango vs. backwardation) shows whether the market expects near-term or longer-term stress. FAULTLINE does not currently ingest VIX futures." },
        { icon: "◈", title: "Volatility vs. Credit", desc: "Compare the VIX with high-yield credit spreads from FRED: volatility without credit stress is often noise; volatility with widening spreads is structural." },
        { icon: "◎", title: "Systemic-Regime Panel", desc: "FAULTLINE's separate systemic-regime model reads the daily VIX close (VIXCLS) alongside credit, financial-conditions, and curve series from FRED." },
        { icon: "⬡", title: "Historical Volatility Context", desc: "Reference levels from past stress periods — 2008, 2011, 2018, 2020, 2022 — for reading today's VIX." },
      ]}
      contentSections={[
        {
          heading: "Understanding the VIX and Volatility Regimes",
          body: `The VIX (CBOE Volatility Index) measures the market's expectation of 30-day volatility in the S&P 500, derived from options prices. It is often called the "fear gauge" — but this characterization is incomplete. The VIX measures expected volatility, not fear per se. Understanding what the VIX is actually signaling requires context: the current regime, the trend, and the term structure.

A common way to read VIX levels uses four bands:

Calm (VIX sub-15): Low volatility, complacency risk. Markets are pricing in minimal near-term disruption. Historically, extended periods of sub-15 VIX are followed by volatility spikes.

Elevated (VIX 15-25): Normal market uncertainty. Investors are pricing in some risk but not acute stress. Most of the time, markets operate in this range.

Stress (VIX 25-35): Elevated fear and uncertainty. Institutional investors are hedging aggressively. Equity markets are typically experiencing a correction or early bear market.

Crisis (VIX 35+): Acute market stress. Panic selling, forced liquidations, and liquidity withdrawal. Historical examples (intraday highs): March 2020 (VIX 85), October 2008 (VIX 89), August 2015 (VIX 53).`,
        },
        {
          heading: "Why Volatility Regime Transitions Matter More Than Levels",
          body: `The absolute level of the VIX matters less than the direction and speed of change. A VIX at 20 that is rising rapidly from 12 is more dangerous than a VIX at 25 that is falling from 35.

Three dimensions of volatility dynamics matter:

1. Level: The current VIX reading and its regime classification.

2. Trend: Is volatility rising or falling? The rate of change matters. A VIX that doubles in a week (as it did in February 2018 and late February 2020) signals a regime transition that requires immediate attention.

3. Term Structure: The relationship between short-term and long-term implied volatility. In normal markets, longer-dated volatility is higher than shorter-dated volatility (contango). When near-term volatility spikes above longer-dated volatility (backwardation), it signals acute near-term stress.

The combination of these three dimensions — level, trend, and term structure — provides a much more complete picture of market risk than the VIX level alone.`,
        },
      ]}
      faqs={[
        {
          question: "What is the VIX and how is it calculated?",
          answer: "The VIX (CBOE Volatility Index) measures the market's expectation of 30-day volatility in the S&P 500, derived from the prices of S&P 500 options across a range of strike prices and expiration dates. It is expressed as an annualized percentage. A VIX of 20 means the market expects the S&P 500 to move approximately 20% over the next year, or about 5.8% per month.",
        },
        {
          question: "What VIX level indicates a market crash?",
          answer: "There is no single VIX level that definitively indicates a crash. However, VIX readings above 35 have historically been associated with significant market stress events. The key signal is not the absolute level but the speed of the move — a VIX that doubles in a week (from 15 to 30, for example) is a stronger warning signal than a VIX that gradually rises to 30 over several months.",
        },
        {
          question: "How does FAULTLINE use volatility in its market analysis?",
          answer: "The FAULTLINE Pressure Index™ does not read VIX: its six vectors are built from credit spreads, SOFR, Treasury yields, CPI, PPI, federal funds, and unemployment, plus a static AI-concentration baseline. VIX appears as a delayed quote on the markets board and as a daily input to FAULTLINE's separate systemic-regime model. Reading volatility next to the Pressure Index shows whether a volatility spike is confirmed by structural credit and funding stress.",
        },
        {
          question: "Can high volatility be a buying opportunity?",
          answer: "Yes — historically, extreme volatility spikes (VIX above 40-50) have coincided with market bottoms and created significant buying opportunities. However, catching the exact bottom is extremely difficult. FAULTLINE's approach is to monitor the Pressure Index for signs that multiple risk vectors are simultaneously improving — not just volatility declining — before increasing risk exposure.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Systemic stress score to read volatility against." },
        { label: "MARKET CRASH INDICATOR", href: "/market-crash-indicator", desc: "Systemic pressure context for volatility spikes." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy impact on volatility and market conditions." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Liquidity conditions that drive volatility spikes." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Historical volatility comparisons across crash periods." },
        { label: "AI STOCK SIGNALS", href: "/ai-stock-signals", desc: "Volatility-adjusted stock signals for the current regime." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
