import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicCryptoSignals() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicCryptoSignals}
      badge="CRYPTO INTELLIGENCE ENGINE"
      headline={"Crypto Signals\nMacro-Aligned"}
      subheadline="Momentum, liquidity, and macro-regime-aligned trading signals for digital assets. Know which crypto assets fit the current macro environment — before the move is visible on-chain."
      ctaLabel="VIEW CRYPTO SIGNALS"
      ctaHref="/app/crypto-signals"
      accentColor="#A855F7"
      features={[
        { icon: "◈", title: "Macro Regime Alignment", desc: "Digital assets classified against the current macro regime. Know when the risk-on cycle is building or breaking before the move." },
        { icon: "◎", title: "BTC Dominance Tracking", desc: "Monitor BTC dominance shifts in real time — the leading indicator of altcoin risk appetite and capital rotation." },
        { icon: "⬡", title: "Liquidity Conditions", desc: "Track liquidity conditions across digital assets. Know when the environment supports risk-taking and when it doesn't." },
        { icon: "◈", title: "Contagion Risk", desc: "Identify systemic contagion risk across the crypto ecosystem before it cascades from one asset class to another." },
        { icon: "◎", title: "Altcoin Risk Scoring", desc: "Every major altcoin scored for systemic risk, macro sensitivity, and regime alignment. Know your exposure before it moves." },
        { icon: "⬡", title: "Real-Time Signal Labels", desc: "Signal classifications refresh as crypto market conditions shift. No end-of-day lag. No headline dependency." },
      ]}
    />
  );
}
