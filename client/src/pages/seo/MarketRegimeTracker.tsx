import SEOLandingPage from "@/pages/SEOLandingPage";

export default function MarketRegimeTracker() {
  return (
    <SEOLandingPage
      seo={{
        title: "Market Regime Tracker — Current Macro Regime Classification | FAULTLINE",
        description: "Market regime classification from the FAULTLINE Pressure Index: Low Risk, Moderate Risk, Elevated Risk, High Stress, or Systemic Crisis. See which band the six-vector score sits in and what it means for systemic pressure.",
        canonical: "/market-regime-tracker",
      }}
      badge="REGIME INTELLIGENCE"
      headline={"Market Regime Tracker\nWhat Regime Are We In Right Now?"}
      subheadline="FAULTLINE's Market Regime Tracker classifies the current macro environment as new data is published — Low Risk, Moderate Risk, Elevated Risk, High Stress, or Systemic Crisis — from the six weighted vectors of the Pressure Index. Know the regime. See the pressure before the break."
      ctaLabel="VIEW CURRENT REGIME"
      ctaHref="/pressure-index"
      accentColor="#9B59B6"
      features={[
        { icon: "◈", title: "Five-Band Classification", desc: "Low Risk (below 25), Moderate Risk (25-44), Elevated Risk (45-64), High Stress (65-79), and Systemic Crisis (80+) — each with distinct implications for risk management." },
        { icon: "◎", title: "Six-Vector Analysis", desc: "Liquidity stress, credit contagion, yield curve, macro sensitivity, labor and rates, and a static AI-concentration baseline — combined into one 0-100 score from eight FRED series." },
        { icon: "⬡", title: "Regime Transition Context", desc: "See which vectors are moving and how close the score sits to the next band threshold — structural pressure that often builds before it is obvious in price action." },
        { icon: "◈", title: "Historical Regime Context", desc: "Reference context from past stress periods — 2008, 2011, 2018, 2020, 2022 — to understand the precedent. Resemblance, not a forecast." },
        { icon: "◎", title: "Asset Class Context", desc: "Educational context on how stocks, bonds, crypto, commodities, and cash have historically behaved in calmer and more stressed regimes." },
        { icon: "⬡", title: "Regime Duration Context", desc: "How long has the current band been in place? Stored daily readings show the streak and trend." },
      ]}
      contentSections={[
        {
          heading: "What Is a Market Regime and Why Does It Matter?",
          body: `A market regime is a persistent state of the financial system characterized by a consistent set of conditions — risk appetite, liquidity, volatility, credit conditions, and economic momentum. Understanding the current regime matters because different regimes carry fundamentally different risks.

FAULTLINE classifies the market into five bands of the Pressure Index:

Low Risk (Pressure Index below 25): The measured inputs show little structural stress. Credit spreads are contained, funding is orderly, and the yield curve, inflation, and labor data are not adding pressure.

Moderate Risk (25-44): Some pressure is present in one or more vectors, but the system is not under broad stress. This is a common resting state for the score.

Elevated Risk (45-64): Pressure is building across several vectors. Historically, conditions like these have warranted closer attention to credit, funding, and rate dynamics.

High Stress (65-79): Multiple vectors are simultaneously under strain. The system is structurally fragile, and shocks are more likely to propagate.

Systemic Crisis (80+): Acute, broad-based systemic stress across credit, funding, and rates. Periods such as October 2008 (after Lehman's September 2008 failure) and March 2020 (COVID) are the kind of episodes this band describes.

The bands describe the pressure in the system today. They are not a forecast of a crash or its date.`,
        },
        {
          heading: "The Six Vectors That Determine the Regime",
          body: `FAULTLINE's regime classification is built on the six weighted vectors of the Pressure Index, computed from eight FRED series plus one static baseline:

1. Liquidity Stress (20%): The ICE BofA U.S. high-yield spread (BAMLH0A0HYM2) and SOFR. Wider spreads and rising funding costs signal that capital is becoming scarcer.

2. Credit Contagion (20%): High-yield spreads read alongside the 10-year Treasury yield and the unemployment rate — how credit stress could spread into the real economy.

3. Yield Curve & 10Y Level (15%): The 2yr/10yr Treasury spread blended with the level of the 10-year yield. Inversion signals recession risk; a high 10-year level adds rate pressure.

4. Macro Sensitivity (20%): CPI and PPI inflation (year over year) and the federal funds rate — how much inflation and policy are constraining the system.

5. Labor & Rates (10%): The unemployment rate and the 10-year yield — labor deterioration under restrictive rates.

6. AI/Speculation (15%): A static baseline (score 65) reflecting the concentration of S&P 500 market cap in AI-exposed equities. It is not a live market feed.

FAULTLINE publishes these weights. The Pressure Index does not read VIX or market breadth, and FAULTLINE does not offer a recession probability. VIX appears separately as a delayed quote and in FAULTLINE's separate systemic-regime model.`,
        },
        {
          heading: "What Each Regime Has Historically Meant",
          body: `FAULTLINE's regime classification provides context for risk decisions, not specific investment recommendations. Here is the general historical precedent:

Low and Moderate Risk: Growth assets have historically tended to do well when credit and funding conditions are calm, and defensive assets have tended to lag. Calm conditions can also breed complacency.

Elevated Risk: Investors have historically paid closer attention to cyclical and growth exposure, liquidity, and concentration when pressure builds across several vectors. Watching which vectors are moving is critical.

High Stress: Historically the most difficult environment to navigate. Flexibility and avoiding large concentrated bets have often mattered most.

Systemic Crisis: Cash, short-duration Treasuries, and gold have historically preserved capital in acute crises. Such periods have also preceded some of the most significant recoveries — but timing the bottom is extremely difficult. A falling Pressure Index across several vectors at once shows stress easing.

This is educational and informational context, not investment advice.`,
        },
      ]}
      faqs={[
        {
          question: "What market regime are we in right now?",
          answer: "The current market regime is classified by the FAULTLINE Pressure Index as new data is published. Visit /pressure-index for the latest published regime band, Pressure Index score, and the six weighted vectors that determine it.",
        },
        {
          question: "How does FAULTLINE classify market regimes?",
          answer: "FAULTLINE combines six weighted vectors — liquidity stress, credit contagion, yield curve and 10-year level, macro sensitivity, labor and rates, and a static AI-concentration baseline — built from eight FRED series into the Pressure Index (0-100). Low Risk is below 25, Moderate Risk 25-44, Elevated Risk 45-64, High Stress 65-79, and Systemic Crisis 80 and above.",
        },
        {
          question: "How long do market regimes typically last?",
          answer: "Calm, low-stress periods have historically been the most durable, often lasting years during bull market phases. Stressed periods have typically lasted months. Acute crises are the shortest but most intense — typically lasting weeks to a few months before either resolving or deepening into a prolonged bear market.",
        },
        {
          question: "Can the regime change quickly?",
          answer: "Yes — regime transitions can occur rapidly. The March 2020 COVID crash moved markets from calm to crisis in roughly 23 trading days. Because several Pressure Index inputs are published daily or monthly, the score shows structural pressure building but can lag a sudden shock.",
        },
        {
          question: "What is the difference between an Elevated Risk regime and a market crash?",
          answer: "Elevated Risk (Pressure Index 45-64) means pressure is building but is not acute. A market crash is typically associated with High Stress or Systemic Crisis conditions — acute, self-reinforcing stress across multiple vectors simultaneously. Elevated readings can resolve without a crash if the underlying vectors improve. The score is not a calibrated crash probability.",
        },
        {
          question: "How does the macro regime affect crypto markets?",
          answer: "Crypto markets are highly sensitive to macro regime changes. In calm regimes, crypto has tended to outperform equities. In stressed regimes, crypto has typically fallen more severely than equities due to its higher beta and lower liquidity. The 2022 stress period produced some of the worst crypto drawdowns in history (BTC about -77%, ETH about -80%, with many altcoins falling further).",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "The regime classification engine — six weighted vectors in one score." },
        { label: "MARKET RISK CONTEXT 2026", href: "/market-crash-probability-2026", desc: "Systemic-pressure context based on current regime conditions." },
        { label: "RECESSION RISK CONTEXT", href: "/recession-probability", desc: "Economic recession risk — a key regime driver." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy — the primary regime-setting force." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "VIX context — read alongside the Pressure Index, not an input to it." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Liquidity conditions — the mechanism behind regime shifts." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
