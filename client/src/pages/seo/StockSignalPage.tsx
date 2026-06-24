import SEOLandingPage from "@/pages/SEOLandingPage";

interface StockSignalPageProps {
  ticker: string;
  companyName: string;
  sector: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  accentColor: string;
  badge: string;
  headline: string;
  subheadline: string;
  keyFacts?: { label: string; value: string }[];
  whatIsIt: string;
  signalAnalysis: string;
  keyLevels: string;
  riskFactors: string;
  faqs: { question: string; answer: string }[];
  internalLinks: { label: string; href: string; desc: string }[];
}

export default function StockSignalPage({
  ticker,
  companyName,
  sector,
  seoTitle,
  seoDescription,
  canonical,
  accentColor,
  badge,
  headline,
  subheadline,
  whatIsIt,
  signalAnalysis,
  keyLevels,
  riskFactors,
  faqs,
  internalLinks,
}: StockSignalPageProps) {
  return (
    <SEOLandingPage
      seo={{ title: seoTitle, description: seoDescription, canonical }}
      badge={badge}
      headline={headline}
      subheadline={subheadline}
      ctaLabel={`ANALYZE ${ticker} NOW`}
      ctaHref={`/app/signals?ticker=${ticker}`}
      accentColor={accentColor}
      features={[
        { icon: "◈", title: "Live Signal Classification", desc: `FAULTLINE classifies ${ticker} against the current macro regime — BUY, SELL, HOLD, or WATCH — updated continuously.` },
        { icon: "◎", title: "Regime Fit Score", desc: `How well does ${ticker} fit the current macro environment? FAULTLINE scores regime alignment from 0-10.` },
        { icon: "⬡", title: "Key Price Levels", desc: `Support, resistance, entry zone, and stop-loss levels for ${ticker} derived from technical analysis and FAULTLINE's signal engine.` },
        { icon: "◈", title: "Bull & Bear Case", desc: `Structured bull and bear case scenarios for ${ticker} based on macro conditions, sector dynamics, and technical structure.` },
        { icon: "◎", title: "Risk Score (0-100)", desc: `A composite ${ticker} risk score aggregating macro alignment, momentum, volatility, debt risk, and AI exposure.` },
        { icon: "⬡", title: "AI & Macro Sensitivity", desc: `${ticker}'s sensitivity to AI narrative shifts, Federal Reserve policy, and macro regime transitions — quantified.` },
      ]}
      contentSections={[
        {
          heading: `What Is ${companyName} (${ticker})? — Company Overview`,
          body: whatIsIt,
        },
        {
          heading: `${ticker} Signal Analysis — Macro Regime Alignment`,
          body: signalAnalysis,
        },
        {
          heading: `${ticker} Key Price Levels and Technical Structure`,
          body: keyLevels,
        },
        {
          heading: `${ticker} Risk Factors — What Could Go Wrong`,
          body: riskFactors,
        },
      ]}
      faqs={faqs}
      internalLinks={internalLinks}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
