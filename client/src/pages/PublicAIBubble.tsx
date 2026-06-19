import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicAIBubble() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicAIBubble}
      badge="AI BUBBLE RISK TRACKER"
      headline={"Track AI Concentration Risk\nBefore It Unwinds"}
      subheadline="Monitor AI-driven market concentration and valuation risk before it unwinds. FAULTLINE AI Bubble Risk Tracker monitors index concentration, AI-exposed equities, and crowded-trade reversal signals in real time."
      ctaLabel="TRACK AI BUBBLE RISK"
      ctaHref="/app/ai-watch"
      accentColor="#FF6B35"
      features={[
        { icon: "◈", title: "Index Concentration Monitor", desc: "Track mega-cap AI concentration in real time. Know when the top 7 stocks represent an outsized share of index risk." },
        { icon: "◎", title: "AI Capex Exposure", desc: "Monitor $214B+ in AI capex commitments and the equities most exposed to AI infrastructure spending cycles." },
        { icon: "⬡", title: "Crowded Trade Signals", desc: "Identify when AI-driven trades become dangerously crowded. Know before the reversal — not after." },
        { icon: "◈", title: "Valuation Stress Score", desc: "Quantified valuation stress for AI-exposed equities. Know when valuations have disconnected from fundamentals." },
        { icon: "◎", title: "Sector Concentration Risk", desc: "Track sector-level concentration risk across technology, semiconductors, and AI infrastructure plays." },
        { icon: "⬡", title: "Reversal Risk Indicators", desc: "Early warning indicators for AI bubble reversal: momentum divergence, insider selling, and institutional positioning shifts." },
      ]}
    />
  );
}
