import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicSignals() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicSignals}
      badge="STOCK INTELLIGENCE ENGINE"
      headline={"Stock Signals\nBefore the Rotation"}
      subheadline="Every equity classified by momentum, macro regime alignment, and systemic pressure exposure. Know which names are positioned for the current environment — before the rotation becomes obvious."
      ctaLabel="VIEW CURRENT SIGNALS"
      ctaHref="/app/signals"
      accentColor="#00D4FF"
      features={[
        { icon: "◈", title: "Macro Regime Alignment", desc: "Each signal classified against the current macro regime — know which equities fit the environment as systemic pressure shifts." },
        { icon: "◎", title: "Momentum Breakouts", desc: "Identify momentum leaders and laggards as new data is published, read against the current macro regime." },
        { icon: "⬡", title: "AI Bubble Exposure", desc: "Flag equities with outsized AI-driven valuation risk and see your concentration exposure in a crowded trade." },
        { icon: "◈", title: "Liquidity-Sensitive Names", desc: "Identify which equities are most vulnerable to liquidity withdrawal — the first to break when conditions tighten." },
        { icon: "◎", title: "Recession-Defensive Classifications", desc: "Separate true defensive names from false safety. FAULTLINE regime analysis identifies which equities hold in contraction." },
        { icon: "⬡", title: "Regular Refreshes", desc: "Signal labels refresh as macro conditions shift. Each reading shows its as-of time. No headline dependency." },
      ]}
    />
  );
}
