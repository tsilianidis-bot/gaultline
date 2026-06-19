import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicSignals() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicSignals}
      badge="STOCK INTELLIGENCE ENGINE"
      headline={"Stock Signals\nBefore the Rotation"}
      subheadline="Every equity classified by momentum, macro regime alignment, and systemic pressure exposure. Know which names are positioned for the current environment — before the rotation becomes obvious."
      ctaLabel="VIEW LIVE SIGNALS"
      ctaHref="/app/signals"
      accentColor="#00D4FF"
      features={[
        { icon: "◈", title: "Macro Regime Alignment", desc: "Each signal classified against the current macro regime — know which equities fit the environment before the crowd notices." },
        { icon: "◎", title: "Momentum Breakouts", desc: "Identify momentum leaders and laggards in real time. FAULTLINE signals surface pre-move setups before they become consensus." },
        { icon: "⬡", title: "AI Bubble Exposure", desc: "Flag equities with outsized AI-driven valuation risk. Know your concentration exposure before the crowded trade reverses." },
        { icon: "◈", title: "Liquidity-Sensitive Names", desc: "Identify which equities are most vulnerable to liquidity withdrawal — the first to break when conditions tighten." },
        { icon: "◎", title: "Recession-Defensive Classifications", desc: "Separate true defensive names from false safety. FAULTLINE regime analysis identifies which equities hold in contraction." },
        { icon: "⬡", title: "Real-Time Updates", desc: "Signal labels refresh as macro conditions shift. No end-of-day lag. No headline dependency." },
      ]}
    />
  );
}
