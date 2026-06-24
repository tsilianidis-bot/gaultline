/**
 * DynamicCryptoPage — /crypto/:symbol
 *
 * Auto-generates a full SEO landing page for any crypto symbol.
 * No separate file needed per asset — this handles all of them.
 * Server-side metadata injection in seoMeta.ts handles title/description/OG.
 */
import { useParams, Link } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

interface CryptoData {
  name: string;
  category: string;
  description: string;
  bullCase: string;
  bearCase: string;
  keyLevels: string;
  riskFactors: string[];
  relatedCrypto: string[];
  relatedStocks: string[];
  faqs: { q: string; a: string }[];
}

// ── Signal label color ─────────────────────────────────────────────────────
function signalColor(label: string | null | undefined) {
  if (!label) return "text-[#A8B8CC]";
  const l = label.toUpperCase();
  if (l === "BULLISH") return "text-emerald-400";
  if (l === "BEARISH") return "text-red-400";
  if (l === "WATCH") return "text-yellow-400";
  return "text-[#A8B8CC]";
}

const CRYPTO_DATA: Record<string, CryptoData> = {
  btc: {
    name: "Bitcoin",
    category: "Digital Gold / Store of Value",
    description: "Bitcoin (BTC) is the original cryptocurrency and the dominant digital store of value. Bitcoin's fixed supply of 21 million coins, decentralized network, and institutional adoption have established it as the benchmark asset for the entire crypto market.",
    bullCase: "Bitcoin ETF inflows driving institutional adoption, halving supply reduction creating scarcity premium, macro liquidity expansion supporting risk assets, and growing sovereign reserve interest create a strong bull case.",
    bearCase: "Macro risk-off environments, regulatory crackdowns, Mt. Gox and government wallet selling pressure, and correlation with risk assets during systemic stress events create significant downside risk.",
    keyLevels: "Key support: $85,000–$90,000 (major support zone), $70,000 (structural floor). Key resistance: $110,000–$115,000 (all-time high zone). Bitcoin's 200-week MA is the ultimate long-term support level.",
    riskFactors: ["Macro risk-off correlation", "Regulatory crackdown risk", "Government wallet selling", "Mt. Gox distribution", "Liquidity tightening"],
    relatedCrypto: ["eth", "sol", "tao"],
    relatedStocks: ["nvda", "pltr"],
    faqs: [
      { q: "Is Bitcoin in a bull market in 2025?", a: "FAULTLINE's Bitcoin Risk Dashboard tracks BTC's macro regime in real time. The current regime classification — Bull, Bear, or Crash — is updated daily based on on-chain signals, liquidity conditions, and systemic pressure." },
      { q: "What drives Bitcoin's price?", a: "Bitcoin is driven by macro liquidity conditions, institutional demand (ETF flows), halving supply dynamics, regulatory developments, and correlation with broader risk assets during stress events." },
      { q: "How does Bitcoin perform in a market crash?", a: "Bitcoin initially correlates with risk assets during systemic stress events (as seen in COVID crash, 2022 bear market). However, Bitcoin often recovers faster than traditional assets once liquidity conditions stabilize." },
      { q: "What is Bitcoin's risk score?", a: "FAULTLINE's Bitcoin Risk Dashboard generates a daily risk score incorporating macro regime, on-chain signals, liquidity conditions, and systemic pressure. Access the live score at FAULTLINE." },
      { q: "Should I buy Bitcoin now?", a: "FAULTLINE does not provide financial advice. We provide macro regime context, risk scores, and signal intelligence to help you make informed decisions. Check the current Bitcoin regime before entering any position." },
    ],
  },
  eth: {
    name: "Ethereum",
    category: "Smart Contract Platform",
    description: "Ethereum (ETH) is the leading smart contract platform, powering DeFi, NFTs, stablecoins, and Layer 2 ecosystems. Ethereum's transition to Proof of Stake and EIP-1559 fee burning have transformed its tokenomics.",
    bullCase: "ETH ETF approval and institutional adoption, Layer 2 ecosystem growth driving fee revenue, staking yield attracting institutional capital, and DeFi TVL expansion create a strong bull case.",
    bearCase: "Competition from Solana and other L1s, regulatory uncertainty around staking and DeFi, ETH underperformance vs BTC in risk-off environments, and Layer 2 fee cannibalization create headwinds.",
    keyLevels: "Key support: $2,200–$2,400 (major support zone), $1,800 (structural floor). Key resistance: $4,000–$4,200 (previous cycle highs). ETH/BTC ratio is a key indicator of altcoin cycle health.",
    riskFactors: ["L1 competition (Solana, Avalanche)", "Regulatory staking uncertainty", "ETH/BTC ratio deterioration", "DeFi regulatory risk", "Layer 2 fee cannibalization"],
    relatedCrypto: ["btc", "sol", "tao"],
    relatedStocks: ["nvda"],
    faqs: [
      { q: "Is Ethereum a good investment in 2025?", a: "Ethereum's investment case depends on macro regime, ETH/BTC ratio trends, and DeFi/Layer 2 adoption. FAULTLINE's Ethereum Risk Dashboard tracks all three dimensions daily." },
      { q: "How does Ethereum compare to Bitcoin?", a: "Ethereum offers higher risk/reward than Bitcoin due to its smart contract utility and DeFi exposure, but also higher volatility and more complex risk factors. FAULTLINE tracks both with separate risk dashboards." },
      { q: "What is the ETH/BTC ratio and why does it matter?", a: "The ETH/BTC ratio measures Ethereum's performance relative to Bitcoin. A rising ratio indicates altcoin season conditions; a falling ratio suggests Bitcoin dominance and risk-off rotation." },
      { q: "What are Ethereum's key risks?", a: "Key risks include L1 competition from Solana, regulatory uncertainty around staking, Layer 2 fee cannibalization, and correlation with Bitcoin during macro risk-off events." },
      { q: "How does FAULTLINE track Ethereum?", a: "FAULTLINE's Ethereum Risk Dashboard monitors ETH macro regime, on-chain signals, liquidity conditions, ETH/BTC ratio, and systemic risk score. Updated daily." },
    ],
  },
  sol: {
    name: "Solana",
    category: "High-Performance L1",
    description: "Solana (SOL) is a high-performance Layer 1 blockchain known for fast transaction speeds and low fees. Solana has emerged as a leading platform for DeFi, NFTs, memecoins, and consumer crypto applications.",
    bullCase: "Solana's developer ecosystem growth, DeFi TVL expansion, institutional ETF interest, and performance advantages over Ethereum create a strong bull case in risk-on environments.",
    bearCase: "Network outage history, competition from Ethereum Layer 2s, memecoin cycle dependency, and high beta to BTC in risk-off environments create significant downside risk.",
    keyLevels: "Key support: $130–$140 (major support), $100 (structural floor). Key resistance: $200–$220 (previous highs). SOL is highly correlated with BTC and ETH.",
    riskFactors: ["Network outage risk", "Memecoin cycle dependency", "High BTC correlation", "Ethereum L2 competition", "Regulatory risk"],
    relatedCrypto: ["btc", "eth", "tao"],
    relatedStocks: ["nvda"],
    faqs: [
      { q: "Is Solana a good investment?", a: "Solana offers high-beta crypto exposure with strong developer ecosystem growth. FAULTLINE tracks SOL's macro regime fit and risk score daily." },
      { q: "How does Solana compare to Ethereum?", a: "Solana offers faster transactions and lower fees than Ethereum, but with higher centralization risk and network outage history. Both are tracked by FAULTLINE's crypto intelligence engine." },
      { q: "What drives Solana's price?", a: "SOL is driven by BTC/ETH macro regime, DeFi activity, memecoin cycle sentiment, developer ecosystem growth, and institutional adoption signals." },
      { q: "What are Solana's key risks?", a: "Key risks include network outage history, memecoin cycle dependency, Ethereum L2 competition, and high correlation with BTC during risk-off events." },
      { q: "How does FAULTLINE track Solana?", a: "FAULTLINE monitors SOL's macro regime fit, momentum score, and systemic risk alignment. Signals are updated daily." },
    ],
  },
  tao: {
    name: "Bittensor",
    category: "AI / Decentralized ML",
    description: "Bittensor (TAO) is a decentralized machine learning network that creates a marketplace for AI models. TAO rewards validators and miners for contributing AI compute and model quality to the network.",
    bullCase: "AI narrative tailwind, decentralized AI infrastructure demand, subnet ecosystem expansion, and correlation with AI stock bull markets create a strong bull case for TAO.",
    bearCase: "Extreme volatility, thin liquidity, AI narrative dependency, regulatory uncertainty around AI tokens, and correlation with BTC in risk-off environments create significant downside risk.",
    keyLevels: "Key support: $250–$280 (major support zone), $200 (structural floor). Key resistance: $500–$600 (previous highs). TAO is highly volatile and should be sized accordingly.",
    riskFactors: ["Extreme volatility", "AI narrative dependency", "Thin liquidity", "Regulatory uncertainty", "BTC correlation in risk-off"],
    relatedCrypto: ["btc", "eth", "sol"],
    relatedStocks: ["nvda", "pltr"],
    faqs: [
      { q: "What is Bittensor (TAO)?", a: "Bittensor is a decentralized AI network that creates a marketplace for machine learning models. TAO is the native token used to incentivize AI compute contributions and model quality." },
      { q: "Is TAO a good investment?", a: "TAO offers high-risk, high-reward exposure to the AI narrative in crypto. It's highly volatile and should be sized conservatively. FAULTLINE tracks TAO's macro regime fit and risk score daily." },
      { q: "How does TAO relate to AI stocks like NVDA?", a: "TAO is correlated with AI sentiment and often moves with NVDA and the broader AI complex. FAULTLINE tracks this relationship in its AI Bubble Monitor." },
      { q: "What are TAO's key risks?", a: "Key risks include extreme volatility, thin liquidity, AI narrative dependency, regulatory uncertainty around AI tokens, and correlation with BTC during macro risk-off events." },
      { q: "How does FAULTLINE track TAO?", a: "FAULTLINE monitors TAO's macro regime fit, momentum score, AI narrative alignment, and systemic risk score. Signals are updated daily." },
    ],
  },
};

function getCryptoData(symbol: string): CryptoData {
  const upper = symbol.toUpperCase();
  const existing = CRYPTO_DATA[symbol.toLowerCase()];
  if (existing) return existing;

  return {
    name: `${upper}`,
    category: "Cryptocurrency",
    description: `${upper} is a cryptocurrency tracked by FAULTLINE's crypto intelligence engine. FAULTLINE monitors ${upper}'s macro regime fit, momentum score, and systemic risk alignment to generate daily signals.`,
    bullCase: `${upper} outperforms when macro regime is bullish, Bitcoin is in a bull trend, and systemic pressure is low. Monitor FAULTLINE's Bitcoin Risk Dashboard and Pressure Index™ for regime confirmation.`,
    bearCase: `${upper} faces elevated risk in high-pressure macro environments and Bitcoin bear markets. FAULTLINE's crypto risk dashboards track the key warning signals.`,
    keyLevels: `Key levels for ${upper} are updated dynamically based on price action and macro regime. FAULTLINE tracks support, resistance, and regime-aligned entry zones.`,
    riskFactors: ["BTC correlation risk", "Macro risk-off sensitivity", "Liquidity tightening", "Regulatory uncertainty", "Altcoin cycle dependency"],
    relatedCrypto: ["btc", "eth", "sol"],
    relatedStocks: ["nvda"],
    faqs: [
      { q: `What is ${upper}'s current signal?`, a: `FAULTLINE generates daily signals for ${upper} based on macro regime, momentum, and systemic pressure. Sign up for FAULTLINE to access the current ${upper} signal.` },
      { q: `How does ${upper} perform in different market regimes?`, a: `${upper}'s performance varies significantly across bull, bear, and crash regimes. FAULTLINE's regime tracker classifies current conditions to help you align ${upper} exposure appropriately.` },
      { q: `What are the key risks for ${upper}?`, a: `Key risks include BTC correlation, macro risk-off sensitivity, liquidity tightening, and regulatory uncertainty. FAULTLINE monitors all dimensions daily.` },
      { q: `How does FAULTLINE track ${upper}?`, a: `FAULTLINE monitors ${upper}'s momentum score, macro regime fit, and systemic pressure alignment. Signals are updated daily and classified as Bullish, Neutral, or Risk-Off.` },
      { q: `Is ${upper} in an alt season?`, a: `FAULTLINE's Alt Season Indicator tracks Bitcoin dominance, altcoin momentum, and liquidity rotation to determine if alt season conditions are present. Check the live indicator for current status.` },
    ],
  };
}

export default function DynamicCryptoPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol ?? "").toLowerCase();
  const upper = symbol.toUpperCase();
  const data = getCryptoData(symbol);

  // Live signal data from DB
  const { data: liveSignal } = trpc.organicContent.getSignalPage.useQuery(
    { symbol: upper },
    { retry: false, staleTime: 5 * 60 * 1000 }
  );

  // CTA click tracker
  const trackCta = trpc.organicContent.trackCtaClick.useMutation();
  const handleCtaClick = useCallback((ctaType: "start_free" | "demo" | "pricing" | "related_tool") => {
    trackCta.mutate({ pageSlug: `/crypto/${symbol}`, ctaType });
  }, [symbol, trackCta]);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": `${upper} Signal — Crypto Risk Score & Analysis | FAULTLINE`,
        "description": `Real-time ${upper} signal analysis. FAULTLINE tracks ${upper} macro regime fit, liquidity conditions, momentum score, and key price levels.`,
        "author": { "@type": "Organization", "name": "FAULTLINE" },
        "publisher": { "@type": "Organization", "name": "FAULTLINE", "url": "https://getfaultline.live" },
        "url": `https://getfaultline.live/crypto/${symbol}`,
        "dateModified": new Date().toISOString().split("T")[0],
      },
      {
        "@type": "FAQPage",
        "mainEntity": (liveSignal?.faqJson ? JSON.parse(liveSignal.faqJson) : data.faqs).map((faq: { q?: string; a?: string; question?: string; answer?: string }) => ({
          "@type": "Question",
          "name": faq.q ?? faq.question,
          "acceptedAnswer": { "@type": "Answer", "text": faq.a ?? faq.answer },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      {/* Header */}
      <header className="border-b border-white/8 bg-[#050608]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-mono text-sm font-bold tracking-[0.3em] text-white hover:text-[#00D4FF] transition-colors">
            FAULTLINE
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/crypto-signals" className="text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-[#00D4FF] transition-colors hidden sm:block">
              CRYPTO SIGNALS
            </Link>
            <a href={getLoginUrl()} onClick={() => handleCtaClick("start_free")} className="text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 px-4 py-2 rounded font-bold transition-colors">
              GET ACCESS →
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[11px] font-mono text-[#64748B] mb-8">
          <Link href="/" className="hover:text-[#00D4FF] transition-colors">HOME</Link>
          <span>/</span>
          <Link href="/crypto-signals" className="hover:text-[#00D4FF] transition-colors">CRYPTO SIGNALS</Link>
          <span>/</span>
          <span className="text-[#A8B8CC]">{upper}</span>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-3">{data.category.toUpperCase()}</div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            {upper} Signal Analysis
          </h1>
          <p className="text-lg text-[#A8B8CC] leading-relaxed max-w-2xl">
            Real-time {data.name} ({upper}) signal intelligence. FAULTLINE tracks {upper}'s macro regime fit, liquidity conditions, and systemic risk alignment — updated daily.
          </p>
          {liveSignal && (
            <div className="flex items-center gap-4 mt-4">
              <span className={`text-sm font-mono font-bold ${signalColor(liveSignal.signalLabel)}`}>
                {liveSignal.signalLabel}
              </span>
              {liveSignal.confidenceScore != null && (
                <span className="text-[11px] font-mono text-[#64748B]">
                  {liveSignal.confidenceScore}% confidence
                </span>
              )}
              {liveSignal.regime && (
                <span className="text-[11px] font-mono text-[#64748B]">
                  Regime: {liveSignal.regime}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Signal CTA */}
        <div className="p-6 rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 mb-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-2">LIVE SIGNAL</div>
              <p className="text-white font-semibold mb-1">Access the current {upper} signal</p>
              <p className="text-[#A8B8CC] text-sm">Macro regime fit · Momentum score · Risk classification · Key levels</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/pricing" onClick={() => handleCtaClick("pricing")} className="text-[11px] font-mono tracking-widest text-[#A8B8CC] border border-white/20 hover:border-[#00D4FF]/40 px-4 py-2.5 rounded transition-colors">
                SEE PRICING
              </a>
              <a href={getLoginUrl()} onClick={() => handleCtaClick("start_free")} className="shrink-0 text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 px-5 py-3 rounded font-bold transition-colors whitespace-nowrap">
                GET SIGNAL →
              </a>
            </div>
          </div>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">What is {data.name} ({upper})?</h2>
          <p className="text-[#A8B8CC] leading-relaxed">{data.description}</p>
        </section>

        {/* Live signal summary if available */}
        {liveSignal?.signalSummary && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Current {upper} Signal Summary</h2>
            <div className="p-6 rounded-lg border border-[#00D4FF]/20 bg-[#00D4FF]/5">
              <p className="text-[#A8B8CC] leading-relaxed">{liveSignal.signalSummary}</p>
            </div>
          </section>
        )}

        {/* Bull / Bear */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">{upper} Bull Case vs Bear Case</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[10px] font-mono tracking-widest text-emerald-400 mb-3">BULL CASE</div>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">{liveSignal?.bullishCase ?? data.bullCase}</p>
            </div>
            <div className="p-6 rounded-lg border border-red-500/20 bg-red-500/5">
              <div className="text-[10px] font-mono tracking-widest text-red-400 mb-3">BEAR CASE</div>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">{liveSignal?.bearishCase ?? data.bearCase}</p>
            </div>
          </div>
        </section>

        {/* Key Levels */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">{upper} Key Price Levels</h2>
          <p className="text-[#A8B8CC] leading-relaxed">{data.keyLevels}</p>
        </section>

        {/* Risk Factors */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">{upper} Key Risk Factors</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.riskFactors.map((risk, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-lg border border-white/8 bg-white/[0.02]">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-[#A8B8CC] text-sm">{risk}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Macro Context */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Macro Regime Context for {upper}</h2>
          <p className="text-[#A8B8CC] leading-relaxed mb-4">
            {upper}'s performance is tightly linked to the macro regime and Bitcoin's trend. FAULTLINE classifies the current market environment as Bull, Bear, Crash, or Recovery — and each regime has distinct implications for {upper} positioning.
          </p>
          <p className="text-[#A8B8CC] leading-relaxed mb-4">
            In bull regimes with expanding liquidity and low systemic pressure, {upper} tends to benefit from risk appetite expansion. In elevated-pressure environments, FAULTLINE's Pressure Index™ detects the warning signals before they become apparent in price action.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <Link href="/bitcoin-risk-dashboard" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-orange-400/30 transition-all">
              <div className="text-[10px] font-mono tracking-widest text-orange-400 mb-2">BITCOIN</div>
              <div className="text-white text-sm font-semibold group-hover:text-[#00D4FF] transition-colors">Bitcoin Risk Dashboard</div>
            </Link>
            <Link href="/alt-season-indicator" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-purple-400/30 transition-all">
              <div className="text-[10px] font-mono tracking-widest text-purple-400 mb-2">CYCLE</div>
              <div className="text-white text-sm font-semibold group-hover:text-[#00D4FF] transition-colors">Alt Season Indicator</div>
            </Link>
            <Link href="/liquidity-monitor" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-blue-400/30 transition-all">
              <div className="text-[10px] font-mono tracking-widest text-blue-400 mb-2">LIQUIDITY</div>
              <div className="text-white text-sm font-semibold group-hover:text-[#00D4FF] transition-colors">Liquidity Monitor</div>
            </Link>
          </div>
        </section>

        {/* Demo CTA */}
        <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] mb-12">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] font-mono tracking-[0.3em] text-[#A8B8CC]/60 mb-1">FAULTLINE DEMO</div>
              <p className="text-white font-semibold text-sm">See how FAULTLINE tracks {upper} in real-time</p>
            </div>
            <a href={getLoginUrl()} onClick={() => handleCtaClick("demo")} className="text-[11px] font-mono tracking-widest text-[#00D4FF] border border-[#00D4FF]/30 hover:bg-[#00D4FF]/10 px-5 py-2.5 rounded font-bold transition-colors whitespace-nowrap">
              VIEW DEMO →
            </a>
          </div>
        </div>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">{upper} Frequently Asked Questions</h2>
          <div className="space-y-4">
            {(liveSignal?.faqJson
              ? JSON.parse(liveSignal.faqJson).map((f: { question?: string; answer?: string; q?: string; a?: string }) => ({ q: f.question ?? f.q ?? "", a: f.answer ?? f.a ?? "" }))
              : data.faqs
            ).map((faq: { q: string; a: string }, i: number) => (
              <div key={i} className="p-6 rounded-lg border border-white/8 bg-white/[0.02]">
                <h3 className="text-white font-semibold mb-3">{faq.q}</h3>
                <p className="text-[#A8B8CC] text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Pages */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Related Intelligence</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.relatedCrypto.map((sym) => (
              <Link key={sym} href={`/crypto/${sym}`} onClick={() => handleCtaClick("related_tool")} className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-purple-400/20 transition-all text-center">
                <div className="text-[10px] font-mono tracking-widest text-purple-400/60 mb-1">CRYPTO</div>
                <div className="text-white font-bold group-hover:text-[#00D4FF] transition-colors">{sym.toUpperCase()}</div>
              </Link>
            ))}
            {data.relatedStocks.map((sym) => (
              <Link key={sym} href={`/stock/${sym}`} onClick={() => handleCtaClick("related_tool")} className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-[#00D4FF]/20 transition-all text-center">
                <div className="text-[10px] font-mono tracking-widest text-[#64748B] mb-1">STOCK</div>
                <div className="text-white font-bold group-hover:text-[#00D4FF] transition-colors">{sym.toUpperCase()}</div>
              </Link>
            ))}
            <Link href="/crypto-signals" onClick={() => handleCtaClick("related_tool")} className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-[#00D4FF]/20 transition-all text-center">
              <div className="text-[10px] font-mono tracking-widest text-[#00D4FF]/60 mb-1">ALL</div>
              <div className="text-white font-bold group-hover:text-[#00D4FF] transition-colors">ALL CRYPTO</div>
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="p-8 rounded-xl border border-[#00D4FF]/20 bg-gradient-to-br from-[#00D4FF]/5 to-transparent text-center">
          <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-3">FAULTLINE INTELLIGENCE</div>
          <h2 className="text-2xl font-bold text-white mb-3">Get the Live {upper} Signal</h2>
          <p className="text-[#A8B8CC] text-sm mb-6 max-w-md mx-auto">
            Access real-time {upper} signals, macro regime classification, and systemic risk scores. Updated daily by FAULTLINE's intelligence engine.
          </p>
          <a href={getLoginUrl()} className="inline-flex items-center gap-2 text-[12px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 px-8 py-4 rounded font-bold transition-colors">
            START FREE ACCESS →
          </a>
          <p className="text-[#64748B] text-xs mt-3 font-mono">No credit card required</p>
        </section>
      </main>
    </div>
  );
}
