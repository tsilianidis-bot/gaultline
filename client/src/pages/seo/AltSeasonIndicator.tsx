import SEOLandingPage from "@/pages/SEOLandingPage";

export default function AltSeasonIndicator() {
  return (
    <SEOLandingPage
      seo={{
        title: "Alt Season Indicator — Is Alt Season Here? | FAULTLINE",
        description: "Alt season context: BTC dominance, the ETH/BTC ratio, altcoin momentum, and capital rotation. FAULTLINE does not offer an alt season probability or an advance-warning signal.",
        canonical: "/alt-season-indicator",
      }}
      badge="ALT SEASON INTELLIGENCE"
      headline={"Alt Season Indicator\nIs the Rotation Here?"}
      subheadline="This page explains the signals analysts watch for alt season — BTC dominance, the ETH/BTC ratio, altcoin sector momentum, and capital rotation — alongside FAULTLINE's macro Pressure Index. FAULTLINE does not offer an alt season probability or an advance-warning signal."
      ctaLabel="VIEW ALT SEASON DATA"
      ctaHref="/app/crypto"
      accentColor="#F7931A"
      features={[
        { icon: "◈", title: "BTC Dominance Cycle Tracking", desc: "BTC dominance falling below key thresholds is the primary alt season signal. FAULTLINE tracks dominance levels, trend, and rate of change." },
        { icon: "◎", title: "ETH/BTC Ratio Monitor", desc: "The ETH/BTC ratio rising is the first confirmation that capital is rotating from Bitcoin into altcoins. FAULTLINE tracks this ratio as new data is published." },
        { icon: "⬡", title: "Altcoin Sector Momentum", desc: "Track momentum across DeFi, Layer-2, AI tokens, gaming, and meme coins simultaneously to identify which sectors are leading the rotation." },
        { icon: "◈", title: "Macro Regime Alignment", desc: "Alt season requires a risk-on macro environment. FAULTLINE checks whether the macro regime supports altcoin outperformance." },
        { icon: "◎", title: "Social Sentiment Surge Detection", desc: "Retail capital floods into altcoins during alt season. FAULTLINE tracks social sentiment across Reddit, StockTwits, and crypto news." },
        { icon: "⬡", title: "Historical Alt Season Comparisons", desc: "Compare current conditions against 2017, 2020-2021, and 2023 alt season periods to understand the historical precedent." },
      ]}
      contentSections={[
        {
          heading: "What Is Alt Season and How Do You Know It Has Started?",
          body: `Alt season (short for altcoin season) is a period in the crypto market cycle when altcoins — all cryptocurrencies other than Bitcoin — significantly outperform Bitcoin. During alt season, capital rotates from Bitcoin into Ethereum, then into large-cap altcoins, then into mid-cap and small-cap tokens, and finally into meme coins and speculative assets.

The defining characteristic of alt season is BTC dominance falling. Bitcoin dominance measures Bitcoin's share of total crypto market capitalization. When dominance falls, it means capital is flowing into altcoins faster than it is flowing into Bitcoin. A sustained fall in BTC dominance below 50% has historically coincided with the most explosive altcoin rallies.

Analysts typically watch five signals. FAULTLINE does not combine them into an alt season probability or score:

1. BTC Dominance Level and Trend — Is dominance falling? How fast? Has it broken below key support levels?

2. ETH/BTC Ratio — Is Ethereum outperforming Bitcoin? The ETH/BTC ratio rising is typically the first confirmation of capital rotation from BTC into the broader altcoin market.

3. Altcoin Sector Breadth — Are multiple altcoin sectors (DeFi, Layer-2, AI tokens, gaming) showing positive momentum simultaneously? Broad-based altcoin strength is more sustainable than single-sector rallies.

4. Macro Regime Alignment — Is the broader macro environment (FAULTLINE Pressure Index, Fed policy, global liquidity) supportive of risk-on behavior? Alt season rarely sustains in HIGH STRESS macro environments.

5. Social Sentiment Momentum — Is retail interest in altcoins accelerating? Social sentiment surges have accompanied past alt season rotations.`,
        },
        {
          heading: "The Four Phases of the Crypto Rotation Cycle",
          body: `The crypto market follows a rotation cycle that FAULTLINE tracks as new data is published. Understanding where the market is in this cycle is essential for positioning correctly.

Phase 1 — Bitcoin Accumulation: Following a macro stress event or crypto-specific shock, capital concentrates in Bitcoin as the safest crypto asset. BTC dominance rises. Altcoins underperform significantly. This phase is characterized by "Bitcoin season" — a period when holding BTC outperforms holding altcoins.

Phase 2 — Ethereum Rotation: As Bitcoin stabilizes and begins to rally, capital rotates into Ethereum. The ETH/BTC ratio rises. Layer-1 and Layer-2 tokens begin to outperform. This is the earliest signal that alt season conditions are building.

Phase 3 — Mid-Cap Altcoin Breakouts: Momentum extends into mid-cap DeFi protocols, AI tokens, infrastructure plays, and established altcoin projects. Volume surges. Asymmetric setups emerge across multiple sectors simultaneously. This is the core of alt season — the period of maximum opportunity for informed investors.

Phase 4 — Small-Cap and Meme Season: Retail capital floods into small-cap and meme coins. BTC dominance falls sharply. This is the highest-risk phase — maximum opportunity and maximum danger simultaneously. Meme coin rallies are typically the final signal that alt season is reaching its peak.

FAULTLINE's Alt Season Indicator tracks which phase the market is currently in and what the historical precedent suggests about the duration and magnitude of each phase.`,
        },
        {
          heading: "2024-2025 Alt Season: What Happened and What It Means for 2026",
          body: `The 2024-2025 crypto cycle provided a textbook example of the alt season rotation pattern. Bitcoin led the cycle, setting then-record highs in late 2024. Ethereum followed, with the ETH/BTC ratio recovering from multi-year lows. AI tokens (TAO, FET, RNDR) outperformed during Phase 3.

The key lessons from the 2024-2025 cycle for 2026 positioning:

First, macro regime matters more than ever. The 2024-2025 cycle was supported by a favorable macro environment — Fed rate cuts beginning in September 2024, expanding global liquidity, and improving risk appetite. When the macro regime shifts, crypto cycles can reverse rapidly regardless of on-chain fundamentals.

Second, AI token concentration risk is real. The AI crypto sector attracted significant capital in 2024-2025, creating concentration dynamics similar to what FAULTLINE tracks in the equity market. When AI narrative momentum fades, the unwind can be rapid.

Third, the rotation from BTC to altcoins is not guaranteed. In some cycles, BTC dominance rises throughout the entire cycle without a meaningful alt season. The conditions for alt season — falling BTC dominance, rising ETH/BTC, broad altcoin momentum, supportive macro — must all align simultaneously.

FAULTLINE's Alt Season Indicator tracks all of these conditions as new data is published, giving you a data-driven assessment of whether alt season conditions are present, building, or absent.`,
        },
      ]}
      faqs={[
        {
          question: "What is the best indicator for alt season?",
          answer: "The most reliable alt season indicator is BTC dominance — specifically, a sustained decline in Bitcoin's share of total crypto market capitalization below 50%. This is typically accompanied by a rising ETH/BTC ratio and broad-based altcoin momentum across multiple sectors. FAULTLINE does not combine these signals into an alt season probability or score.",
        },
        {
          question: "How long does alt season typically last?",
          answer: "Historical alt seasons have ranged from 2-3 months (2019) to 6-9 months (2017, 2020-2021). The duration depends on the macro environment, BTC dominance dynamics, and the degree of retail participation. Alt seasons that are supported by a favorable macro regime (expanding liquidity, risk-on sentiment) tend to last longer than those driven purely by crypto-specific factors.",
        },
        {
          question: "Which altcoins perform best during alt season?",
          answer: "During early alt season (Phase 2), Ethereum and large-cap Layer-1 blockchains typically lead. During mid alt season (Phase 3), mid-cap DeFi protocols, AI tokens, and infrastructure plays tend to outperform. During late alt season (Phase 4), small-cap and meme coins experience the most explosive moves — but also the highest risk of rapid reversal. FAULTLINE tracks momentum across all these categories.",
        },
        {
          question: "Can alt season happen during a stock market crash?",
          answer: "Historically, alt season does not sustain during periods of severe macro stress. Crypto markets are highly correlated with risk assets during stress events — when the S&P 500 falls sharply, crypto typically falls further. FAULTLINE's Alt Season Indicator incorporates the macro regime (FAULTLINE Pressure Index) as a key input, flagging when macro conditions are not supportive of sustained altcoin outperformance.",
        },
        {
          question: "Is FAULTLINE's alt season data free?",
          answer: "The public Pressure Index is free to read without an account, and signed-in access starts with a free account. Paid plans are not on sale.",
        },
        {
          question: "What is the difference between alt season and a crypto bull market?",
          answer: "A crypto bull market is a period when the entire crypto market (including Bitcoin) is rising. Alt season is a specific phase within a bull market when altcoins are outperforming Bitcoin. It is possible to have a Bitcoin bull market without alt season (BTC dominance rising), and it is possible to have alt season without a broader bull market (altcoins rising while BTC is flat or declining). FAULTLINE tracks both dynamics independently.",
        },
      ]}
      internalLinks={[
        { label: "CRYPTO SIGNALS", href: "/crypto-signals", desc: "Macro-aligned signals for all tracked digital assets." },
        { label: "BITCOIN RISK DASHBOARD", href: "/bitcoin-risk-dashboard", desc: "Deep-dive BTC risk analysis and key level monitoring." },
        { label: "ETHEREUM RISK DASHBOARD", href: "/ethereum-risk-dashboard", desc: "ETH analysis including ETH/BTC ratio and macro alignment." },
        { label: "CRYPTO MARKET RISK", href: "/crypto-market-risk-dashboard", desc: "Crypto systemic risk dashboard and contagion indicators." },
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Macro regime foundation — essential context for alt season." },
        { label: "MARKET REGIME TRACKER", href: "/market-regime-tracker", desc: "Current macro regime classification and forward implications." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
