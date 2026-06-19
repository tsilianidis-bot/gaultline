import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicStockMarketRisk() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicStockMarketRisk}
      badge="STOCK MARKET RISK DASHBOARD"
      headline={"Know Your Equity Risk\nBefore It Moves"}
      subheadline="Real-time stock market risk dashboard: systemic pressure score, regime detection, credit spreads, volatility, liquidity conditions, and breadth deterioration. The read top macro desks build their own models to generate."
      ctaLabel="VIEW RISK DASHBOARD"
      ctaHref="/app/pressure"
      accentColor="#00FF88"
      features={[
        { icon: "◈", title: "Systemic Pressure Score", desc: "A single number that tells you where the market stands before it moves. Updated in real time — no end-of-day lag." },
        { icon: "◎", title: "Regime Detection", desc: "Identify the current macro regime: expansion, contraction, stress, or crisis. Know which playbook applies before the headlines confirm it." },
        { icon: "⬡", title: "Credit Spread Analysis", desc: "Monitor investment-grade and high-yield credit spreads — the earliest warning system for equity market stress." },
        { icon: "◈", title: "Volatility Regime", desc: "Track volatility regime transitions before they become obvious. Know when the VIX is signaling structural change vs. noise." },
        { icon: "◎", title: "Liquidity Conditions", desc: "Real-time liquidity monitoring across equity markets. Identify when conditions are tightening before it shows up in price action." },
        { icon: "⬡", title: "Breadth Deterioration", desc: "Market breadth analysis that identifies internal deterioration before index-level weakness becomes visible." },
      ]}
    />
  );
}
