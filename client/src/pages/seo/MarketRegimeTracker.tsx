import SEOLandingPage from "@/pages/SEOLandingPage";

export default function MarketRegimeTracker() {
  return (
    <SEOLandingPage
      seo={{
        title: "Market Regime Tracker — Current Macro Regime Classification | FAULTLINE",
        description: "Real-time market regime classification: Risk-On, Risk-Off, Transition, or Crisis. Track the current macro regime using FAULTLINE's seven-vector Pressure Index and understand what it means for your portfolio.",
        canonical: "/market-regime-tracker",
      }}
      badge="REGIME INTELLIGENCE"
      headline={"Market Regime Tracker\nWhat Regime Are We In Right Now?"}
      subheadline="FAULTLINE's Market Regime Tracker classifies the current macro environment in real time — Risk-On, Risk-Off, Transition, or Crisis — using seven independent risk vectors. Know the regime. Position accordingly."
      ctaLabel="VIEW LIVE REGIME"
      ctaHref="/pressure-index"
      accentColor="#9B59B6"
      features={[
        { icon: "◈", title: "Four-Regime Classification", desc: "Risk-On, Risk-Off, Transition, and Crisis — each with distinct implications for asset allocation and risk management." },
        { icon: "◎", title: "Seven-Vector Analysis", desc: "Credit spreads, VIX regime, yield curve, liquidity, AI concentration, recession probability, and breadth — all synthesized into one regime score." },
        { icon: "⬡", title: "Regime Transition Signals", desc: "Early warning signals when the regime is shifting — before the transition is obvious in price action." },
        { icon: "◈", title: "Historical Regime Comparisons", desc: "Compare the current regime to historical periods: 2008, 2011, 2018, 2020, 2022. Understand the precedent." },
        { icon: "◎", title: "Asset Class Implications", desc: "What does the current regime mean for stocks, bonds, crypto, commodities, and cash? FAULTLINE maps regime to asset class positioning." },
        { icon: "⬡", title: "Regime Duration Tracking", desc: "How long has the current regime been in place? Historical regime durations provide context for positioning decisions." },
      ]}
      contentSections={[
        {
          heading: "What Is a Market Regime and Why Does It Matter?",
          body: `A market regime is a persistent state of the financial system characterized by a consistent set of conditions — risk appetite, liquidity, volatility, credit conditions, and economic momentum. Understanding the current regime is the foundation of sound investment decision-making because different regimes require fundamentally different positioning strategies.

FAULTLINE classifies the market into four regimes:

Risk-On (FAULTLINE Pressure Index 0-39): The macro environment is supportive of risk-taking. Credit spreads are tight, volatility is low, liquidity is ample, the yield curve is positively sloped, and economic momentum is positive. In Risk-On regimes, growth assets (equities, crypto, high-yield bonds) outperform defensive assets (Treasuries, cash, gold). This is the regime where the highest returns are generated.

Risk-Off (Pressure Index 40-59): The macro environment is showing signs of stress. One or more risk vectors are deteriorating, but the system has not entered acute stress. In Risk-Off regimes, defensive positioning becomes more appropriate — reducing cyclical exposure, increasing cash, and adding defensive sector positions.

Transition (Pressure Index 40-59, rapidly changing): The regime is actively shifting from Risk-On to Risk-Off or vice versa. Transition periods are the most dangerous because the old positioning is no longer appropriate but the new regime is not yet confirmed. FAULTLINE's regime transition signals provide advance warning of these shifts.

Crisis (Pressure Index 60+): Acute systemic stress. Multiple risk vectors are simultaneously deteriorating. Historical crisis regimes include March 2020 (COVID), October 2008 (Lehman), and August 2011 (U.S. debt ceiling/European sovereign debt). In Crisis regimes, maximum defensive positioning is historically appropriate.`,
        },
        {
          heading: "The Seven Vectors That Determine the Regime",
          body: `FAULTLINE's regime classification is built on seven independent risk vectors, each with a historical track record as a leading indicator of regime transitions:

1. Credit Spread Dynamics: High-yield credit spreads (BAMLH0A0HYM2) reflect the premium investors demand to hold below-investment-grade debt. Spread widening signals deteriorating credit conditions — one of the earliest institutional signals of regime deterioration.

2. VIX Regime: The VIX level and trend reflect the market's expectation of near-term volatility. A rising VIX from low levels is a stronger regime transition signal than a high VIX that is declining.

3. Yield Curve Dynamics: The 2yr/10yr Treasury spread reflects the market's expectation of future economic growth and Fed policy. Inversion signals recession risk; re-steepening after inversion signals the recession is arriving.

4. Liquidity Conditions: Fed balance sheet trajectory, bank lending standards, and money market conditions reflect the availability of capital for risk asset investment. Liquidity withdrawal is the mechanism behind most major market dislocations.

5. AI Concentration Risk: The historically unprecedented concentration of S&P 500 market cap in AI-exposed equities creates systemic vulnerability. When concentrated positions begin to unwind, the cascade effect amplifies regime deterioration.

6. Recession Probability: Leading economic indicators (PMI, unemployment claims, consumer confidence, yield curve) feed into a recession probability score that reflects the fundamental economic backdrop.

7. Market Breadth: The percentage of stocks participating in a rally or decline reflects the underlying health of the market. Breadth deterioration — fewer stocks participating in a rally — precedes major market tops.`,
        },
        {
          heading: "How to Position for Each Regime",
          body: `FAULTLINE's regime classification provides a framework for positioning decisions, not specific investment recommendations. Here is the historical precedent for each regime:

Risk-On Regime: Growth assets historically outperform. Equities (particularly cyclical and growth sectors), crypto, high-yield bonds, and commodities tend to deliver the strongest returns. Defensive assets (Treasuries, cash, gold) tend to underperform. This is the regime where taking calculated risk is historically rewarded.

Risk-Off Regime: Defensive positioning becomes more appropriate. Reducing cyclical and growth exposure, increasing cash allocation, and adding defensive sector positions (utilities, consumer staples, healthcare) is historically prudent. Monitoring for regime transition signals is critical.

Transition Regime: The most dangerous positioning environment. The old regime's positioning is no longer appropriate, but the new regime is not yet confirmed. FAULTLINE's transition signals provide advance warning, but maintaining flexibility and avoiding large concentrated bets is historically prudent.

Crisis Regime: Maximum defensive positioning is historically appropriate. Cash, short-duration Treasuries, and gold have historically preserved capital during crisis regimes. The crisis regime also creates the conditions for the most significant buying opportunities — but timing the bottom is extremely difficult. FAULTLINE monitors for signs that multiple risk vectors are simultaneously improving before signaling a potential regime recovery.`,
        },
      ]}
      faqs={[
        {
          question: "What market regime are we in right now?",
          answer: "The current market regime is classified in real time by the FAULTLINE Pressure Index. Visit /pressure-index for the live regime classification, Pressure Index score, and the seven individual risk vectors that determine the regime.",
        },
        {
          question: "How does FAULTLINE classify market regimes?",
          answer: "FAULTLINE uses seven independent risk vectors — credit spreads, VIX regime, yield curve dynamics, liquidity conditions, AI concentration risk, recession probability, and market breadth — to calculate the Pressure Index (0-100). Risk-On is 0-39, Risk-Off is 40-59, and Crisis is 60+. Transition regimes are identified when the Pressure Index is rapidly changing direction.",
        },
        {
          question: "How long do market regimes typically last?",
          answer: "Risk-On regimes are the most durable, historically lasting 12-36 months during bull market phases. Risk-Off regimes typically last 3-12 months. Crisis regimes are the shortest but most intense — typically lasting 1-6 months before either resolving or deepening into a prolonged bear market. The 2022 Risk-Off regime lasted approximately 10 months.",
        },
        {
          question: "Can the regime change quickly?",
          answer: "Yes — regime transitions can occur rapidly. The March 2020 COVID crash took the market from Risk-On to Crisis in approximately 23 trading days. The February 2018 volatility spike (VIX doubled in one day) created a brief Transition regime before recovering. FAULTLINE's regime transition signals are designed to provide advance warning of these rapid shifts.",
        },
        {
          question: "What is the difference between a Risk-Off regime and a market crash?",
          answer: "A Risk-Off regime is a period of elevated but not acute stress — the Pressure Index is 40-59. A market crash is typically associated with a Crisis regime (Pressure Index 60+) characterized by acute, self-reinforcing stress across multiple risk vectors simultaneously. Risk-Off regimes can resolve without a crash if the underlying risk vectors improve; Crisis regimes have historically been associated with significant market dislocations.",
        },
        {
          question: "How does the macro regime affect crypto markets?",
          answer: "Crypto markets are highly sensitive to macro regime changes. In Risk-On regimes, crypto tends to outperform equities significantly. In Risk-Off and Crisis regimes, crypto typically falls more severely than equities due to its higher beta and lower liquidity. The 2022 Risk-Off/Crisis regime produced some of the worst crypto drawdowns in history (BTC -77%, ETH -80%, altcoins -90%+).",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "The live regime classification engine — seven vectors in one score." },
        { label: "MARKET CRASH PROBABILITY", href: "/market-crash-probability-2026", desc: "Crash risk assessment based on current regime conditions." },
        { label: "RECESSION PROBABILITY", href: "/recession-probability", desc: "Economic recession risk — a key regime driver." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy — the primary regime-setting force." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "VIX regime — one of the seven regime vectors." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Liquidity conditions — the mechanism behind regime shifts." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
