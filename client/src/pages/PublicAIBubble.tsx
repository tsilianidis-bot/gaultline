import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicAIBubble() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicAIBubble}
      badge="AI BUBBLE RISK TRACKER"
      headline={"Track AI Concentration Risk\nWhile It Builds"}
      subheadline="Monitor AI-driven market concentration and valuation risk while it builds. FAULTLINE AI Bubble Risk Tracker monitors index concentration, AI-exposed equities, and crowded-trade reversal signals as new data is published."
      ctaLabel="TRACK AI BUBBLE RISK"
      ctaHref="/app/ai-watch"
      accentColor="#FF6B35"
      features={[
        { icon: "◈", title: "Index Concentration Monitor", desc: "Track mega-cap AI concentration as new data is published. Know when the top 7 stocks represent an outsized share of index risk." },
        { icon: "◎", title: "AI Concentration Baseline", desc: "FAULTLINE uses a static AI-concentration baseline (AI mega-cap share of the S&P 500) adjusted by rates and credit. AI capex is context; FAULTLINE does not ingest capex data." },
        { icon: "⬡", title: "Crowded Trade Signals", desc: "See when AI-driven trades look crowded. Context, not a reversal forecast." },
        { icon: "◈", title: "Valuation Stress Score", desc: "Quantified valuation stress for AI-exposed equities. Know when valuations have disconnected from fundamentals." },
        { icon: "◎", title: "Sector Concentration Risk", desc: "Track sector-level concentration risk across technology, semiconductors, and AI infrastructure plays." },
        { icon: "⬡", title: "Reversal Risk Indicators", desc: "Context for AI-concentration risk, such as momentum divergence in AI-exposed equities. FAULTLINE does not ingest insider-selling or institutional-positioning data." },
      ]}
    />
  );
}
