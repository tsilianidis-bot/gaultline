import SEOLandingPage from "@/pages/SEOLandingPage";

export default function FederalReserveTracker() {
  return (
    <SEOLandingPage
      seo={{
        title: "Federal Reserve Tracker — Fed Policy Impact on Markets | FAULTLINE",
        description: "Track Federal Reserve policy signals, rate decisions, and their impact on market stress, credit spreads, liquidity, and equity risk. Know what the Fed means for your portfolio.",
        canonical: "/federal-reserve-tracker",
      }}
      badge="FED POLICY INTELLIGENCE"
      headline={"Federal Reserve Tracker\nPolicy Signals, As Published"}
      subheadline="The Federal Reserve is one of the most important drivers of market conditions. FAULTLINE reads the federal funds rate, SOFR, and the Treasury curve from FRED, and shows their regularly refreshed impact on credit spreads, liquidity, and systemic market pressure."
      ctaLabel="VIEW FED IMPACT"
      ctaHref="/pressure-index"
      accentColor="#7C3AED"
      features={[
        { icon: "◈", title: "Policy Rate Tracking", desc: "Follow the effective federal funds rate and the 2-year Treasury yield — the market's read on the expected policy path — and how shifts affect credit conditions." },
        { icon: "◎", title: "Funding Conditions", desc: "SOFR and high-yield spreads show how policy is transmitting into funding and credit markets — the Pressure Index's Liquidity Stress vector." },
        { icon: "⬡", title: "Credit Spread Impact", desc: "Fed policy is the primary driver of credit spread compression and expansion. Track how policy shifts affect high-yield and investment-grade spreads." },
        { icon: "◈", title: "Yield Curve Monitoring", desc: "The 2yr/10yr spread reflects Fed policy expectations. FAULTLINE tracks inversion depth, re-steepening signals, and historical comparisons." },
        { icon: "◎", title: "Macro Sensitivity Vector", desc: "The federal funds rate is read alongside CPI and PPI inflation in the Macro Sensitivity vector (20% weight) of the Pressure Index." },
        { icon: "⬡", title: "Fed Cycle Context", desc: "Educational context on how tightening and easing cycles have typically affected markets at each stage." },
      ]}
      contentSections={[
        {
          heading: "Why the Federal Reserve Drives Markets",
          body: `The Federal Reserve controls the federal funds rate — the benchmark interest rate that influences borrowing costs across the entire economy. When the Fed raises rates (tightening), it increases the cost of capital, slows economic activity, and reduces the present value of future corporate earnings. When the Fed cuts rates (easing), it reduces borrowing costs, stimulates economic activity, and increases equity valuations.

Beyond the federal funds rate, the Fed's balance sheet policy — quantitative easing (QE) and quantitative tightening (QT) — directly affects market liquidity. During QE, the Fed purchases Treasury bonds and mortgage-backed securities, injecting liquidity into the financial system. During QT, the Fed allows its balance sheet to shrink, withdrawing liquidity from markets.

FAULTLINE reads the rate side of Fed policy — the federal funds rate, SOFR, and the 2-year and 10-year Treasury yields from FRED — and carries its impact into the FAULTLINE Pressure Index™ through the Macro Sensitivity, Liquidity Stress, and Yield Curve vectors. FAULTLINE does not currently ingest Federal Reserve balance sheet data.`,
        },
        {
          heading: "The Fed Policy Cycle and Market Regimes",
          body: `Fed policy follows a predictable cycle that has historically driven distinct market regimes:

Early Tightening (First 2-4 Rate Hikes): Markets typically absorb early rate hikes well. Equities can continue to rise as the economy is still growing. Credit spreads remain contained. This is the "hiking into strength" phase.

Mid-Cycle Tightening (Continued Hikes): As rates rise, the yield curve flattens or inverts. Growth stocks and rate-sensitive sectors (real estate, utilities) begin to underperform. Credit conditions start to tighten.

Late Tightening (Restrictive Territory): The Fed funds rate is above the neutral rate. Economic growth slows. Unemployment begins to rise. Credit spreads widen. Recession risk increases. This is the highest-risk phase for equity markets.

Pivot / Early Easing (First Rate Cuts): The Fed begins cutting rates in response to economic weakness. Historically, the first rate cut does not immediately stabilize markets — it often signals that the economic deterioration is more serious than previously acknowledged.

Deep Easing (Aggressive Cuts / QE): The Fed cuts aggressively and/or restarts QE. Liquidity floods back into markets. This phase typically marks the beginning of the next bull market cycle.

FAULTLINE's Pressure Index shows how the current rate setting is feeding into systemic market pressure.`,
        },
        {
          heading: "How Fed Policy Affects Different Asset Classes",
          body: `The impact of Fed policy varies significantly across asset classes:

Equities: Rate hikes compress P/E multiples, particularly for growth stocks with long-duration earnings. Rate cuts expand multiples. The magnitude of the impact depends on the starting valuation level — high-multiple markets are more sensitive to rate changes.

Bonds: Rate hikes reduce bond prices (yields rise). Rate cuts increase bond prices. Long-duration bonds are more sensitive than short-duration bonds.

Real Estate: Rate hikes increase mortgage rates, reducing housing affordability and slowing real estate activity. REITs are particularly sensitive to rate changes.

Crypto: Crypto is highly sensitive to global liquidity conditions driven by Fed policy. QE periods have historically coincided with crypto bull markets. QT periods have coincided with crypto bear markets.

Gold: Gold tends to perform well when real interest rates (nominal rates minus inflation) are negative or falling. Fed rate cuts that lag inflation increases are particularly bullish for gold.

Dollar: Fed rate hikes strengthen the dollar relative to other currencies. A stronger dollar creates headwinds for U.S. multinational earnings and emerging market assets.`,
        },
      ]}
      faqs={[
        {
          question: "How does FAULTLINE track Federal Reserve policy?",
          answer: "FAULTLINE reads Fed policy through FRED data: the federal funds rate, SOFR, 2-year and 10-year Treasury yields (reflecting market expectations), and high-yield credit spreads (reflecting how policy is transmitting into credit). These feed the Pressure Index's Macro Sensitivity, Liquidity Stress, and Yield Curve vectors. Fed balance sheet data is not currently ingested.",
        },
        {
          question: "What is the difference between QE and QT?",
          answer: "Quantitative Easing (QE) is when the Federal Reserve purchases bonds (primarily Treasury bonds and mortgage-backed securities) to inject liquidity into the financial system and lower long-term interest rates. Quantitative Tightening (QT) is the reverse — the Fed allows its bond holdings to mature without reinvestment, withdrawing liquidity from the system. QE is generally bullish for risk assets; QT is generally bearish.",
        },
        {
          question: "How does the yield curve relate to Fed policy?",
          answer: "The yield curve reflects market expectations for future Fed policy. When the market expects the Fed to cut rates (due to anticipated economic weakness), short-term yields fall relative to long-term yields, steepening the curve. When the market expects continued rate hikes, short-term yields rise above long-term yields, inverting the curve. An inverted yield curve has preceded every U.S. recession since 1955.",
        },
        {
          question: "What does a Fed pivot mean for markets?",
          answer: "A Fed pivot — when the Fed shifts from raising rates to cutting rates — is often anticipated as a bullish catalyst for markets. However, historically, the first rate cut does not immediately stabilize markets. It often signals that economic conditions have deteriorated enough to warrant emergency action. The market has often bottomed some months after the first cut, not on the day of the cut.",
        },
        {
          question: "Is Fed policy data available for free on FAULTLINE?",
          answer: "Yes. The FAULTLINE Pressure Index — which incorporates Fed policy impact through its macro sensitivity, liquidity, and yield curve vectors — is free to read at /pressure-index. Signed-in tools start with a free account; paid plans are not on sale.",
        },
      ]}
      internalLinks={[
        { label: "PRESSURE INDEX", href: "/pressure-index", desc: "Systemic stress score incorporating Fed policy impact." },
        { label: "LIQUIDITY MONITOR", href: "/liquidity-monitor", desc: "Track funding conditions through credit spreads and SOFR." },
        { label: "RECESSION RISK CONTEXT", href: "/recession-probability", desc: "Leading indicators of recession risk — the outcome of Fed policy." },
        { label: "MARKET CRASH INDICATOR", href: "/market-crash-indicator", desc: "Regularly refreshed crash risk detection and systemic stress monitoring." },
        { label: "VOLATILITY DASHBOARD", href: "/volatility-dashboard", desc: "VIX context and volatility analysis." },
        { label: "HISTORICAL ANALOGS", href: "/analogs", desc: "Compare current Fed cycle to historical tightening and easing periods." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
