import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicDiagnosticAI() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicDiagnosticAI}
      badge="DIAGNOSTIC AI™"
      headline={"Understand the Market's\nTrue Health"}
      subheadline="FAULTLINE Diagnostic AI™: AI-powered market health analysis covering regime conditions, risk vectors, and structural vulnerabilities across timeframes. Understand the market's true health before you act."
      ctaLabel="RUN DIAGNOSTIC"
      ctaHref="/app/diagnostic"
      accentColor="#00D4FF"
      features={[
        { icon: "◈", title: "Regime Condition Analysis", desc: "AI-powered assessment of the current macro regime: expansion, contraction, stress, or crisis. Know which playbook applies." },
        { icon: "◎", title: "Risk Vector Identification", desc: "Identify the primary risk vectors driving current market conditions. Know what's driving the risk before it becomes consensus." },
        { icon: "⬡", title: "Structural Vulnerability Scan", desc: "Detect structural vulnerabilities across equity, credit, and rates markets before they manifest in price action." },
        { icon: "◈", title: "Multi-Timeframe Analysis", desc: "Diagnostic analysis across daily, weekly, and monthly timeframes. Know which timeframe the risk is most acute." },
        { icon: "◎", title: "AI-Powered Synthesis", desc: "Large language model synthesis of macro conditions, regime signals, and risk vectors into a single coherent market health assessment." },
        { icon: "⬡", title: "Actionable Intelligence", desc: "Not just analysis — actionable intelligence. Know what the diagnostic means for your positioning and risk management." },
      ]}
    />
  );
}
