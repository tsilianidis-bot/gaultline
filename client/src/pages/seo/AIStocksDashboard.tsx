import SEOLandingPage from "@/pages/SEOLandingPage";

export default function AIStocksDashboard() {
  return (
    <SEOLandingPage
      seo={{
        title: "AI Stocks Dashboard — Real-Time AI Stock Signals & Risk Scores | FAULTLINE",
        description: "Track all major AI stocks in one dashboard: NVDA, PLTR, META, AMD, TSLA, MSFT, GOOGL, AMZN. Real-time macro-aligned signals, AI bubble exposure ratings, regime fit scores, and key price levels.",
        canonical: "/ai-stocks-dashboard",
      }}
      badge="AI STOCKS INTELLIGENCE"
      headline={"AI Stocks Dashboard\nAll AI Stocks. One Signal View."}
      subheadline="FAULTLINE's AI Stocks Dashboard tracks every major AI-exposed equity in real time — from AI infrastructure (NVDA, AMD) to AI software (PLTR, MSFT) to AI-powered platforms (META, GOOGL, AMZN). One dashboard. All signals. Macro-aligned."
      ctaLabel="VIEW AI STOCK SIGNALS"
      ctaHref="/app/signals"
      accentColor="#00D4FF"
      features={[
        { icon: "◈", title: "AI Bubble Exposure Ratings", desc: "Every AI stock classified by its sensitivity to AI narrative momentum — from HIGH to MODERATE to LOW exposure." },
        { icon: "◎", title: "Regime Fit Scores", desc: "How well does each AI stock fit the current macro regime? Scores from 0-10 updated continuously." },
        { icon: "⬡", title: "Live Signal Classification", desc: "BUY, SELL, HOLD, or WATCH for every tracked AI stock — based on macro alignment, momentum, and technical structure." },
        { icon: "◈", title: "AI Concentration Risk Monitor", desc: "Track the aggregate AI concentration in the S&P 500 and the systemic risk it creates for the broader market." },
        { icon: "◎", title: "Sector Rotation Signals", desc: "Monitor capital flows between AI infrastructure, AI software, and AI-powered platforms to identify rotation opportunities." },
        { icon: "⬡", title: "Earnings Catalyst Tracking", desc: "AI stock earnings are the most market-moving events in the current cycle. FAULTLINE tracks upcoming catalysts and their potential impact." },
      ]}
      contentSections={[
        {
          heading: "The AI Stock Universe — A Taxonomy of Exposure",
          body: `The term 'AI stock' encompasses a wide range of companies with very different risk profiles, revenue models, and sensitivity to the AI narrative. FAULTLINE classifies AI stocks into four categories:

AI Infrastructure (Highest AI Exposure): Companies that supply the physical infrastructure for AI — primarily GPUs, custom silicon, and data center components. NVIDIA (NVDA) is the dominant player. AMD (AMD) is the primary alternative. These companies have the highest direct revenue exposure to AI infrastructure spending and the highest sensitivity to AI capex cycle changes.

AI Software Platforms (High AI Exposure): Companies that build software platforms enabling AI deployment and decision intelligence. Palantir (PLTR) is the leading example, with its AIP platform enabling enterprise and government AI deployment. Microsoft (MSFT) with Copilot, Salesforce (CRM) with Einstein, and ServiceNow (NOW) with AI workflows also belong to this category.

AI-Powered Platforms (Moderate-High AI Exposure): Large technology platforms that are deploying AI to enhance their core products and services. Meta (META) with AI-powered advertising and Llama models, Alphabet (GOOGL) with Gemini and AI search, Amazon (AMZN) with AWS AI services, and Tesla (TSLA) with FSD and Optimus belong to this category. Their AI exposure is real but secondary to their core business fundamentals.

AI-Adjacent (Moderate AI Exposure): Companies that benefit from AI adoption without being primarily AI companies. Broadcom (AVGO) with custom AI silicon, TSMC (TSM) as the primary AI chip manufacturer, and cloud infrastructure providers (AMZN, MSFT, GOOGL) as AI compute providers belong to this category.`,
        },
        {
          heading: "AI Concentration Risk — The Systemic Dimension",
          body: `The 2026 S&P 500 is historically concentrated in AI-exposed equities. The top 10 stocks — the majority of which are AI-exposed — represent over 35% of the index by market cap. This concentration creates a systemic risk dimension that goes beyond individual stock analysis.

When concentrated positions unwind, the cascade effect on index-level returns is severe. The 2000 dot-com bubble provides the historical precedent: the top 10 S&P 500 stocks in March 2000 represented approximately 25% of the index. When technology stocks began to fall, the concentration amplified the index-level decline.

FAULTLINE's AI Bubble Monitor tracks this concentration risk in real time, measuring the degree to which the current market concentration resembles historical bubble periods. The AI Stocks Dashboard provides the stock-level view of this systemic risk — showing which individual stocks are most exposed and how their signals are evolving.

The key insight is that AI stock analysis cannot be done in isolation from the systemic concentration risk. A stock that looks attractive on individual metrics may still be a poor risk-adjusted investment if it is part of a highly concentrated sector that is vulnerable to a systemic unwind.`,
        },
        {
          heading: "How to Use the AI Stocks Dashboard",
          body: `FAULTLINE's AI Stocks Dashboard is designed to be used as a risk management tool, not a trading signal generator. Here is how to use it effectively:

Regime Alignment First: Before looking at individual stock signals, check the FAULTLINE Pressure Index and macro regime. In HIGH STRESS environments (Pressure Index 60+), even the strongest individual AI stock signals should be treated with caution — systemic risk can overwhelm individual stock fundamentals.

AI Bubble Exposure as Risk Filter: Use the AI Bubble Exposure rating to understand each stock's sensitivity to AI narrative changes. HIGH exposure stocks (NVDA, AMD, PLTR) will amplify both upside and downside moves when AI narrative momentum shifts. MODERATE exposure stocks (META, GOOGL) have more fundamental revenue support that provides a floor during AI narrative corrections.

Regime Fit Score as Timing Tool: The regime fit score tells you how well each stock fits the current macro environment. A stock with a high regime fit score in the current environment is better positioned than one with a low score, regardless of its individual fundamentals.

Sector Rotation Signals: Monitor capital flows between AI infrastructure, AI software, and AI-powered platforms. Early rotation signals — when capital begins moving from one sub-sector to another — can provide advance warning of sector-level trend changes.`,
        },
      ]}
      faqs={[
        {
          question: "What are the best AI stocks to buy in 2026?",
          answer: "FAULTLINE does not provide investment advice or stock recommendations. The AI Stocks Dashboard provides real-time macro-aligned signal classifications (BUY, SELL, HOLD, WATCH) for all tracked AI stocks based on macro regime alignment, momentum, and technical structure. Access the live signals on the FAULTLINE Signals tab.",
        },
        {
          question: "Is the AI stock bubble going to burst?",
          answer: "FAULTLINE's AI Bubble Monitor tracks the degree to which current AI stock valuations and concentration resemble historical bubble periods. The monitor provides a real-time risk assessment, not a prediction. Bubbles are only definitively identified in retrospect — the question is whether current conditions are creating structural vulnerability to a rapid valuation reset.",
        },
        {
          question: "Which AI stocks are most at risk in a market crash?",
          answer: "AI stocks with HIGH AI Bubble Exposure ratings (NVDA, AMD, PLTR) are most sensitive to AI narrative changes and macro regime shifts. These stocks have the highest beta to both AI narrative momentum and broader market conditions. In a HIGH STRESS macro environment, high-multiple AI stocks typically experience the largest drawdowns.",
        },
        {
          question: "How does FAULTLINE classify AI stocks?",
          answer: "FAULTLINE classifies AI stocks into four categories: AI Infrastructure (NVDA, AMD — highest direct AI revenue exposure), AI Software Platforms (PLTR, MSFT — software enabling AI deployment), AI-Powered Platforms (META, GOOGL, AMZN, TSLA — AI enhancing core businesses), and AI-Adjacent (AVGO, TSM — benefiting from AI adoption). Each category has a different risk profile and sensitivity to AI narrative changes.",
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
        { label: "MARKET CRASH PROBABILITY", href: "/market-crash-probability-2026", desc: "Crash risk driven by AI concentration." },
      ]}
      schemaType="Article"
      datePublished="2024-06-01"
    />
  );
}
