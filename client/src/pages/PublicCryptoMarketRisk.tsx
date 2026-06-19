import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicCryptoMarketRisk() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicCryptoMarketRisk}
      badge="CRYPTO MARKET RISK DASHBOARD"
      headline={"Monitor Crypto Systemic Risk\nIn Real Time"}
      subheadline="Live crypto market risk dashboard: BTC dominance, altcoin risk, systemic crypto pressure, contagion risk, and digital asset macro alignment. Know when the environment supports risk-taking and when it doesn't."
      ctaLabel="VIEW CRYPTO RISK"
      ctaHref="/app/crypto"
      accentColor="#A855F7"
      features={[
        { icon: "◈", title: "BTC Dominance Monitor", desc: "Track BTC dominance in real time — the primary leading indicator of altcoin risk appetite and capital rotation cycles." },
        { icon: "◎", title: "Systemic Crypto Pressure", desc: "A single systemic pressure score for the crypto ecosystem. Know when structural stress is building before it cascades." },
        { icon: "⬡", title: "Altcoin Risk Scoring", desc: "Every major altcoin scored for systemic risk, macro sensitivity, and regime alignment. Know your exposure before it moves." },
        { icon: "◈", title: "Contagion Risk Mapping", desc: "Identify contagion pathways across the crypto ecosystem. Know which assets fracture next when stress begins propagating." },
        { icon: "◎", title: "Macro Correlation", desc: "Track how digital assets correlate with macro risk factors: rates, liquidity, credit spreads, and equity volatility." },
        { icon: "⬡", title: "Digital Asset Regime", desc: "Classify the current crypto regime: risk-on expansion, liquidity stress, or systemic contraction. Know which playbook applies." },
      ]}
    />
  );
}
