import SEOLandingPage from "@/pages/SEOLandingPage";
import { PentagonalThesisNarrative } from "@/components/PentagonalThesisNarrative";

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
  seoTitle: _seoTitle,
  seoDescription: _seoDescription,
  canonical,
  accentColor,
  badge,
  headline,
  subheadline: _subheadline,
  whatIsIt: _whatIsIt,
  signalAnalysis: _signalAnalysis,
  keyLevels: _keyLevels,
  riskFactors: _riskFactors,
  faqs,
  internalLinks,
}: StockSignalPageProps) {
  const unsupported = /crash|probability|\bscore\b|% confidence|\bbuy\b|\bsell\b|key price levels|key support|regime fit|0-10|advance warning|stop-loss|entry zone|pressure index|fall significantly|biggest opportunity/i;
  const safeFaqs = faqs.filter(faq => !unsupported.test(`${faq.question} ${faq.answer}`));
  const safeLinks = internalLinks.filter(link => !unsupported.test(`${link.label} ${link.desc}`));
  return (
    <>
    <SEOLandingPage
      seo={{
        title: `${ticker} — shared stock thesis | FAULTLINE`,
        description: `The ${ticker} page uses the shared Pentagonal Thesis. It does not publish a buy or sell classification, a separate regime reading, or static key price levels.`,
        canonical,
      }}
      badge={badge}
      headline={headline}
      subheadline={`Background on ${companyName}. The live read is the shared Pentagonal Thesis. This page does not add a trade call.`}
      ctaLabel={`READ ${ticker}`}
      ctaHref={`/stock/${ticker.toLowerCase()}`}
      accentColor={accentColor}
      features={[
        { icon: "◈", title: "Shared stock thesis", desc: `${ticker} is read with the same Pentagonal Thesis as the rest of the product. There is no second buy or sell classification.` },
        { icon: "◎", title: "No separate regime reading", desc: `This page does not grade how ${ticker} fits the macro regime, and it does not publish a numbered fit.` },
        { icon: "⬡", title: "No static price levels", desc: `Support, entry, stop, and target figures are not printed here. A completed-session range appears only inside the thesis when the bars are fresh.` },
        { icon: "◈", title: "Gaps stay gaps", desc: "Missing insider filings, a macro calendar, and sector rotation are not treated as drivers." },
      ]}
      contentSections={[
        {
          heading: `${companyName} (${ticker})`,
          body: `${companyName} is in the ${sector} group. That label is background, not a sector-rotation call. Price, scenarios, and what to do come from the shared thesis.`,
        },
      ]}
      faqs={safeFaqs.length > 0 ? safeFaqs : [{
        question: `What does the ${ticker} page show?`,
        answer: `It shows background on ${companyName} and points at the shared Pentagonal Thesis. It does not classify the stock or publish a confidence percentage.`,
      }]}
      internalLinks={safeLinks}
      schemaType="Article"
      datePublished="2024-06-01"
    />
    <div className="bg-[#050608] px-5 pb-16">
      <div className="mx-auto max-w-3xl">
        <PentagonalThesisNarrative symbol={ticker} surface="stock-signal" />
      </div>
    </div>
    </>
  );
}
