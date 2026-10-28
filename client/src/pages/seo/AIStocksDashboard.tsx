import SEOLandingPage from "@/pages/SEOLandingPage";
import { PentagonalThesisNarrative } from "@/components/PentagonalThesisNarrative";

export default function AIStocksDashboard() {
  return (
    <>
    <SEOLandingPage
      seo={{
        title: "AI Stocks Dashboard — AI-Exposed Equities | FAULTLINE",
        description: "A guide to AI-exposed equities. Individual stock conclusions use the shared Pentagonal Thesis. This page does not publish regime-fit scores or trade instructions.",
        canonical: "/ai-stocks-dashboard",
      }}
      badge="AI STOCKS INTELLIGENCE"
      headline={"AI Stocks Dashboard\nAll AI Stocks. One Signal View."}
      subheadline="A map of AI-exposed equities, from infrastructure (NVDA, AMD) to software (PLTR, MSFT) to platforms (META, GOOGL, AMZN). An individual stock conclusion is the shared Pentagonal Thesis. This page does not add a trade call."
      ctaLabel="VIEW AI STOCK SIGNALS"
      ctaHref="/app/signals"
      accentColor="#00D4FF"
      features={[
        { icon: "◈", title: "Exposure is a description", desc: "The essay below groups companies by how their businesses relate to AI spending. Those groups are not live scores." },
        { icon: "◎", title: "No regime-fit score", desc: "This page does not score how an AI stock fits the macro regime, and it does not publish a numbered fit score." },
        { icon: "⬡", title: "Shared Stock Thesis", desc: "Individual AI-stock conclusions use the Pentagonal Thesis. The thesis does not issue an unsupported buy or sell call." },
        { icon: "◈", title: "Concentration is not a live gauge", desc: "Index concentration is discussed as background. This page does not measure it as a FAULTLINE score." },
        { icon: "◎", title: "No sector-rotation call", desc: "A company profile sector is a classification. It is not a capital-flow or sector-rotation signal." },
        { icon: "⬡", title: "Earnings dates need an as-of", desc: "An earnings date is not cited unless the provider supplies an as-of timestamp. A missing date stays a gap." },
      ]}
      contentSections={[
        {
          heading: "The AI Stock Universe — A Taxonomy of Exposure",
          body: `Companies often discussed alongside AI spending do different work. Some sell compute hardware, such as NVIDIA and AMD. Some sell software used to deploy models, such as Palantir and Microsoft. Some run large platforms that also spend on AI, such as Meta, Alphabet, Amazon, and Tesla. Some supply components or manufacturing used by those businesses, such as Broadcom and TSMC.

These notes describe the business. They are not a rating, a ranking, or a live score, and they do not say which names are more exposed than others.`,
        },
        {
          heading: "AI Concentration Risk — The Systemic Dimension",
          body: `The 2026 S&P 500 is historically concentrated in AI-exposed equities. The top 10 stocks — the majority of which are AI-exposed — represent over 35% of the index by market cap. This concentration creates a systemic risk dimension that goes beyond individual stock analysis.

When concentrated positions unwind, the cascade effect on index-level returns is severe. The 2000 dot-com bubble provides the historical precedent: the top 10 S&P 500 stocks in March 2000 represented approximately 25% of the index. When technology stocks began to fall, the concentration amplified the index-level decline.

This page does not measure that concentration as a live score and does not say which names to buy or sell. An individual name is read through the shared thesis, which lists missing inputs as gaps.

A name can look reasonable on its own reported figures and still sit inside a concentrated index. This page does not turn that background into a ranking or a trade.`,
        },
        {
          heading: "How to Use the AI Stocks Dashboard",
          body: `This page is a taxonomy of how businesses relate to AI spending. It is not a signal generator and it does not rank names.

No fit score: This dashboard does not time entries with a regime-fit number. When a fresh canonical market reading exists, the shared thesis may mention it as context and still label any link to the stock as a hypothesis.

No rotation call: Capital moving between AI infrastructure, software, and platforms is not inferred from a quote, a daily bar, or a company profile.

No bubble rating: This page does not publish an exposure score, and it does not say which names will move first.`,
        },
      ]}
      faqs={[
        {
          question: "Does this page say which AI stocks to buy in 2026?",
          answer: "No. The page does not publish buy, sell, hold, or watch classifications. An individual stock read is the shared Pentagonal Thesis, which withholds a conclusion when the inputs are missing.",
        },
        {
          question: "Does this page say whether an AI stock bubble will burst?",
          answer: "No. This page does not publish a bubble score, a crash probability, or a forecast of a valuation reset. Concentration is discussed as background history, not as a live gauge.",
        },
        {
          question: "Does this page rank which AI stocks are most at risk?",
          answer: "No. It does not publish an exposure rating or a crash ranking. An individual name is read through the shared thesis, which leaves missing inputs as gaps.",
        },
        {
          question: "Does this page sort AI stocks into exposure tiers?",
          answer: "No. The notes below describe what the businesses sell. They are not exposure tiers and they are not a ranking.",
        },
        {
          question: "What is the difference between AI infrastructure stocks and AI software stocks?",
          answer: "AI infrastructure stocks (NVDA, AMD) supply the physical compute substrate for AI — GPUs and custom silicon. Their revenue is directly tied to AI capex spending by hyperscalers. AI software stocks (PLTR, MSFT) build the software platforms that enable AI deployment. Their revenue is tied to AI software adoption rates and enterprise digital transformation. Infrastructure stocks have higher revenue concentration in AI; software stocks have more diversified revenue bases.",
        },
      ]}
      internalLinks={[
        { label: "NVDA SIGNAL", href: "/stock/nvda", desc: "NVIDIA — the central node of AI infrastructure." },
        { label: "PLTR SIGNAL", href: "/stock/pltr", desc: "Palantir — leading AI software platform." },
        { label: "AMD SIGNAL", href: "/stock/amd", desc: "AMD — NVIDIA's primary AI GPU competitor." },
        { label: "META SIGNAL", href: "/stock/meta", desc: "Meta — AI-powered advertising platform." },
        { label: "AI BUBBLE MONITOR", href: "/ai-bubble-risk-tracker", desc: "Systemic AI concentration risk dashboard." },
        { label: "MARKET STRESS RESEARCH", href: "/market-crash-probability-2026", desc: "Background reading. This dashboard does not publish a crash probability." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
    <div className="bg-[#050608] px-5 pb-16">
      <div className="mx-auto max-w-3xl">
        <PentagonalThesisNarrative surface="ai-stocks" />
      </div>
    </div>
    </>
  );
}
