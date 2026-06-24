import SEOLandingPage from "@/pages/SEOLandingPage";

export default function BitcoinRiskDashboard() {
  return (
    <SEOLandingPage
      seo={{
        title: "Bitcoin Risk Dashboard — BTC Risk Score, Key Levels & Macro Analysis | FAULTLINE",
        description: "Real-time Bitcoin risk dashboard: BTC macro alignment score, key support and resistance levels, on-chain risk signals, liquidity sensitivity, and regime-based bull/bear case analysis.",
        canonical: "/bitcoin-risk-dashboard",
      }}
      badge="BITCOIN RISK INTELLIGENCE"
      headline={"Bitcoin Risk Dashboard\nBTC Macro Analysis in Real Time"}
      subheadline="FAULTLINE's Bitcoin Risk Dashboard provides a comprehensive macro-aligned risk assessment for BTC — covering key price levels, liquidity sensitivity, macro regime alignment, bull and bear case scenarios, and systemic risk exposure."
      ctaLabel="VIEW BTC RISK DATA"
      ctaHref="/app/crypto"
      accentColor="#F7931A"
      features={[
        { icon: "◈", title: "Macro Regime Alignment Score", desc: "BTC classified against the live macro regime. Risk-on vs. risk-off conditions fundamentally change Bitcoin's risk/reward profile." },
        { icon: "◎", title: "Key Support & Resistance Levels", desc: "Critical BTC price levels updated continuously: major support zones, resistance clusters, and key psychological levels." },
        { icon: "⬡", title: "Liquidity Sensitivity Rating", desc: "Bitcoin is the most liquidity-sensitive major asset. FAULTLINE scores BTC's vulnerability to Fed QT and global liquidity withdrawal." },
        { icon: "◈", title: "Bull Case / Bear Case Analysis", desc: "Structured bull and bear case scenarios for BTC based on current macro conditions, on-chain dynamics, and technical structure." },
        { icon: "◎", title: "BTC Dominance Tracking", desc: "Monitor Bitcoin's share of total crypto market cap — the primary indicator of whether capital is flowing into or out of altcoins." },
        { icon: "⬡", title: "Risk Score (0-100)", desc: "A single composite BTC risk score aggregating macro alignment, liquidity conditions, volatility regime, and technical structure." },
      ]}
      contentSections={[
        {
          heading: "Why Bitcoin Risk Analysis Requires a Macro Framework",
          body: `Bitcoin is often analyzed in isolation — using on-chain metrics, technical analysis, and crypto-specific indicators. While these tools have value, they miss the most important driver of BTC price action: global macro conditions.

Bitcoin's price history shows a clear correlation with global liquidity cycles. During periods of Federal Reserve quantitative easing (QE) and expanding global liquidity, Bitcoin has delivered extraordinary returns. During periods of quantitative tightening (QT) and contracting liquidity, Bitcoin has experienced severe drawdowns — 50-80% declines that wiped out years of gains in months.

The 2022 bear market is the clearest example. Bitcoin fell from approximately $69,000 to $16,000 — a 77% decline — driven primarily by the most aggressive Fed tightening cycle since the 1980s. On-chain metrics remained relatively healthy throughout much of this decline; the driver was macro, not crypto-specific.

FAULTLINE's Bitcoin Risk Dashboard incorporates the macro framework as the primary analytical lens, with technical and on-chain analysis as secondary inputs. This approach provides a more complete and actionable risk assessment than crypto-only analysis.`,
        },
        {
          heading: "Key Risk Factors for Bitcoin in 2026",
          body: `FAULTLINE's Bitcoin risk assessment for 2026 focuses on five key risk factors:

1. Federal Reserve Policy Trajectory — The Fed's balance sheet and rate path are the primary macro drivers of BTC price action. QT (balance sheet reduction) withdraws liquidity from the financial system, creating headwinds for risk assets including Bitcoin. The pace and duration of QT directly affects BTC's risk profile.

2. Global Dollar Liquidity — Bitcoin is priced in dollars and is highly sensitive to global dollar liquidity conditions. A strengthening dollar (which typically accompanies Fed tightening) creates headwinds for BTC. A weakening dollar (which typically accompanies Fed easing) creates tailwinds.

3. Regulatory Environment — Regulatory clarity or uncertainty in major markets (U.S., EU, Asia) affects institutional adoption and capital flows into Bitcoin. FAULTLINE monitors regulatory developments as a qualitative risk factor.

4. Bitcoin Halving Cycle — Bitcoin's supply issuance halves approximately every four years. Historically, the 12-18 months following a halving have been associated with significant price appreciation. The most recent halving occurred in April 2024, placing the 2025-2026 period in the historically favorable post-halving window.

5. Institutional Adoption Dynamics — The approval of Bitcoin spot ETFs in January 2024 opened BTC to a new class of institutional investors. ETF inflows and outflows are now a significant driver of BTC price action and liquidity.`,
        },
        {
          heading: "Bitcoin Key Price Levels and Technical Structure",
          body: `FAULTLINE tracks the following key Bitcoin price levels as part of the risk dashboard:

Major Support Zones: These are price levels where significant buying interest has historically emerged — previous all-time highs that became support, major moving averages (200-day, 200-week), and on-chain cost basis levels for large holder cohorts.

Resistance Clusters: Price levels where significant selling pressure has historically emerged — previous all-time highs before they were broken, major round numbers, and on-chain distribution levels.

Key Psychological Levels: Round numbers ($100K, $150K, $200K) that attract significant options positioning and retail attention.

The relationship between current price and these key levels determines the risk/reward profile of BTC at any given time. FAULTLINE's risk score incorporates the proximity to support vs. resistance as one of its inputs.`,
        },
      ]}
      faqs={[
        {
          question: "What is the biggest risk to Bitcoin in 2026?",
          answer: "Based on FAULTLINE's macro framework, the primary risk to Bitcoin in 2026 is a shift in Federal Reserve policy toward renewed tightening — either through rate hikes or accelerated QT — driven by persistent inflation or financial stability concerns. Secondary risks include regulatory developments, a broader risk-off macro environment driven by recession fears, and potential contagion from crypto-specific events (exchange failures, stablecoin de-pegs).",
        },
        {
          question: "How does the Bitcoin halving affect risk in 2026?",
          answer: "The April 2024 Bitcoin halving reduced the daily supply issuance from approximately 900 BTC/day to 450 BTC/day. Historically, the 12-24 months following a halving have been associated with significant price appreciation as reduced supply meets sustained or growing demand. The 2025-2026 period falls within this historically favorable post-halving window, which FAULTLINE factors into the BTC bull case scenario.",
        },
        {
          question: "What is Bitcoin's correlation with the stock market?",
          answer: "Bitcoin's correlation with the S&P 500 has increased significantly since 2020 as institutional adoption has grown. During risk-off events (market stress, recession fears), BTC typically falls alongside equities — often more severely due to its higher volatility. During risk-on environments, BTC can outperform equities significantly. FAULTLINE tracks this correlation as part of the macro regime alignment score.",
        },
        {
          question: "What BTC price levels does FAULTLINE track?",
          answer: "FAULTLINE tracks major support zones (previous all-time highs that became support, 200-day and 200-week moving averages), resistance clusters (previous all-time highs before they were broken, major round numbers), and key psychological levels. These levels are updated continuously as new data arrives from Polygon.io.",
        },
        {
          question: "Is Bitcoin a good hedge against inflation?",
          answer: "Bitcoin's inflation hedging properties are contested. In the short term, BTC has shown high correlation with risk assets and has declined during periods of rising inflation (2022) when the Fed tightened aggressively. In the long term, Bitcoin's fixed supply (21 million BTC maximum) provides a theoretical hedge against monetary debasement. FAULTLINE tracks BTC's real-time macro alignment rather than making long-term inflation hedging claims.",
        },
      ]}
      internalLinks={[
        { label: "ETHEREUM RISK DASHBOARD", href: "/ethereum-risk-dashboard", desc: "Comprehensive ETH risk analysis and macro alignment." },
        { label: "ALT SEASON INDICATOR", href: "/alt-season-indicator", desc: "Track BTC dominance and altcoin rotation signals." },
        { label: "CRYPTO SIGNALS", href: "/crypto-signals", desc: "Macro-aligned signals for all tracked digital assets." },
        { label: "CRYPTO MARKET RISK", href: "/crypto-market-risk-dashboard", desc: "Live crypto systemic risk dashboard." },
        { label: "FEDERAL RESERVE TRACKER", href: "/federal-reserve-tracker", desc: "Fed policy — the primary macro driver of BTC price action." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Global liquidity conditions that drive BTC cycles." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
