import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicCryptoSignals() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicCryptoSignals}
      badge="CRYPTO INTELLIGENCE ENGINE"
      headline={"Crypto Signals\nMacro-Aligned"}
      subheadline="Momentum, liquidity, and macro-regime-aligned trading signals for digital assets. See which crypto assets fit the current macro environment."
      ctaLabel="VIEW CRYPTO SIGNALS"
      ctaHref="/app/crypto-signals"
      accentColor="#A855F7"
      features={[
        { icon: "◈", title: "Macro Regime Alignment", desc: "Digital assets classified against the current macro regime. See whether the risk-on cycle is building or breaking." },
        { icon: "◎", title: "BTC Dominance Tracking", desc: "Monitor BTC dominance shifts as new data is published — the leading indicator of altcoin risk appetite and capital rotation." },
        { icon: "⬡", title: "Liquidity Conditions", desc: "Track liquidity conditions across digital assets. Know when the environment supports risk-taking and when it doesn't." },
        { icon: "◈", title: "Contagion Risk", desc: "Identify systemic contagion risk across the crypto ecosystem before it cascades from one asset class to another." },
        { icon: "◎", title: "Altcoin Risk Scoring", desc: "Every major altcoin scored for systemic risk, macro sensitivity, and regime alignment. Know your exposure before it moves." },
        { icon: "⬡", title: "Regularly Refreshed Signal Labels", desc: "Signal classifications refresh as crypto market conditions shift. Each reading shows its as-of time. No headline dependency." },
      ]}
    />
  );
}
