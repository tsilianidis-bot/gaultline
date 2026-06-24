/**
 * DynamicStockPage — /stock/:symbol
 *
 * Auto-generates a full SEO landing page for any stock symbol.
 * No separate file needed per symbol — this handles all of them.
 * Server-side metadata injection in seoMeta.ts handles title/description/OG.
 */
import { useParams } from "wouter";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

// ── Per-symbol enrichment data ─────────────────────────────────────────────
// Add richer data for high-priority symbols; all others get auto-generated content.
interface SymbolData {
  name: string;
  sector: string;
  description: string;
  bullCase: string;
  bearCase: string;
  keyLevels: string;
  riskFactors: string[];
  relatedSymbols: string[];
  relatedCrypto: string[];
  faqs: { q: string; a: string }[];
}

const SYMBOL_DATA: Record<string, SymbolData> = {
  nvda: {
    name: "NVIDIA Corporation",
    sector: "AI Semiconductors",
    description: "NVIDIA (NVDA) is the dominant AI infrastructure company, supplying the GPU compute layer that powers the global AI buildout. NVDA's data center revenue has grown exponentially as hyperscalers race to deploy AI training and inference capacity.",
    bullCase: "AI infrastructure spending remains in secular growth mode. NVDA's CUDA moat, software ecosystem, and next-generation Blackwell architecture create durable competitive advantages. Hyperscaler capex commitments through 2026 provide revenue visibility.",
    bearCase: "AI capex cycle deceleration, custom ASIC competition from Google TPUs and Amazon Trainium, export restrictions to China, and extreme valuation multiples create significant downside risk if growth disappoints.",
    keyLevels: "Key support levels: $90–$95 (200-day MA), $80 (major structural support). Key resistance: $140–$145 (all-time high zone). Macro regime alignment is critical — NVDA underperforms sharply in risk-off environments.",
    riskFactors: ["AI capex cycle risk", "China export restrictions", "Custom ASIC competition", "Valuation multiple compression", "Macro regime deterioration"],
    relatedSymbols: ["amd", "msft", "meta", "pltr"],
    relatedCrypto: ["tao"],
    faqs: [
      { q: "Is NVDA a buy right now?", a: "FAULTLINE evaluates NVDA through a macro regime lens. In bull regimes with low systemic pressure, NVDA tends to outperform. In elevated-pressure or crash regimes, NVDA's high beta amplifies drawdowns. Always check the current regime before entering." },
      { q: "What is NVDA's AI risk score?", a: "FAULTLINE's AI risk score for NVDA incorporates valuation multiples, AI concentration exposure, momentum regime, and systemic market pressure. High AI concentration scores indicate elevated bubble risk." },
      { q: "How does NVDA perform in a market crash?", a: "NVDA is a high-beta AI-concentrated stock. In historical crash scenarios (2022 bear market, COVID crash), NVDA experienced drawdowns of 60–70%. FAULTLINE's crash probability indicator is a critical input for NVDA position sizing." },
      { q: "What are the key risks for NVDA in 2025–2026?", a: "The primary risks are: AI capex cycle deceleration, China export restrictions reducing addressable market, custom ASIC competition from hyperscalers, and valuation compression if growth slows." },
      { q: "How does FAULTLINE track NVDA?", a: "FAULTLINE monitors NVDA's momentum score, macro regime fit, AI bubble exposure, and systemic risk alignment. Signals are updated daily and classified as Bullish, Neutral, or Risk-Off." },
    ],
  },
  pltr: {
    name: "Palantir Technologies",
    sector: "AI Software / Defense",
    description: "Palantir (PLTR) is an AI software platform company serving government and commercial clients. Its Foundry and AIP platforms provide AI-powered data analytics and decision intelligence for defense, intelligence agencies, and enterprise customers.",
    bullCase: "PLTR's government contracts provide revenue stability, while AIP commercial adoption is accelerating. The company is one of the few profitable AI software companies with a clear path to enterprise AI dominance.",
    bearCase: "Extreme valuation multiples (100x+ revenue), heavy government dependency, slow commercial growth relative to expectations, and macro risk-off environments create significant downside risk.",
    keyLevels: "Key support: $85–$90 (200-day MA zone), $70 (major structural support). Key resistance: $125–$130 (recent highs). PLTR is highly sensitive to macro regime shifts.",
    riskFactors: ["Extreme valuation multiples", "Government contract concentration", "Commercial growth deceleration", "Macro risk-off sensitivity", "Insider selling pressure"],
    relatedSymbols: ["nvda", "meta", "msft"],
    relatedCrypto: [],
    faqs: [
      { q: "Is PLTR a good investment in 2025?", a: "PLTR's investment case depends heavily on macro regime. In bull regimes, PLTR's AI software narrative drives outperformance. In risk-off environments, its extreme valuation creates significant drawdown risk." },
      { q: "What drives PLTR's stock price?", a: "PLTR is driven by AI sentiment, government contract wins, commercial revenue growth, and macro risk appetite. FAULTLINE tracks all four dimensions in its PLTR signal analysis." },
      { q: "How risky is PLTR compared to other AI stocks?", a: "PLTR carries above-average risk due to its extreme valuation multiples and government revenue concentration. FAULTLINE's risk score reflects this elevated risk profile." },
      { q: "What is PLTR's bull case?", a: "The bull case is AIP commercial adoption accelerating to match government revenue, creating a durable AI software moat with improving margins and expanding TAM." },
      { q: "What is PLTR's bear case?", a: "The bear case is valuation compression as commercial growth disappoints, combined with macro risk-off reducing appetite for high-multiple growth stocks." },
    ],
  },
  tsla: {
    name: "Tesla Inc.",
    sector: "EV / AI / Energy",
    description: "Tesla (TSLA) is an electric vehicle manufacturer, energy storage company, and AI/robotics platform. Tesla's FSD (Full Self-Driving) and Optimus robot programs position it as an AI hardware company beyond its EV business.",
    bullCase: "FSD achieving Level 4/5 autonomy unlocks a robotaxi network with massive margin expansion. Optimus robot production creates a new revenue stream. Energy storage business growing rapidly.",
    bearCase: "EV market share erosion from Chinese competitors, FSD timeline delays, CEO distraction, margin compression from price wars, and macro sensitivity create significant downside risk.",
    keyLevels: "Key support: $200–$210 (major support zone), $170 (structural floor). Key resistance: $300–$320 (previous highs). TSLA is highly volatile and macro-sensitive.",
    riskFactors: ["EV market share erosion", "FSD regulatory risk", "CEO distraction risk", "Margin compression", "China competition"],
    relatedSymbols: ["nvda", "amd"],
    relatedCrypto: [],
    faqs: [
      { q: "Is TSLA still a growth stock?", a: "TSLA's growth narrative has shifted from pure EV to AI/robotics. The investment thesis now depends on FSD and Optimus execution, making it a higher-risk, higher-reward bet on AI hardware." },
      { q: "How does TSLA perform in different market regimes?", a: "TSLA is highly sensitive to macro regime. In bull markets, it outperforms significantly. In risk-off environments, its high beta and speculative premium compress rapidly." },
      { q: "What is TSLA's biggest risk in 2025–2026?", a: "The biggest risks are EV market share loss to BYD and other Chinese manufacturers, FSD regulatory delays, and CEO distraction from core business." },
      { q: "How does FAULTLINE track TSLA?", a: "FAULTLINE monitors TSLA's momentum score, macro regime fit, volatility risk, and systemic pressure alignment. Signals are updated daily." },
      { q: "What is TSLA's relationship to AI stocks?", a: "TSLA is increasingly classified as an AI hardware company due to FSD and Optimus. Its AI exposure creates correlation with NVDA and the broader AI complex during AI sentiment shifts." },
    ],
  },
  meta: {
    name: "Meta Platforms Inc.",
    sector: "AI / Social Media",
    description: "Meta Platforms (META) operates Facebook, Instagram, WhatsApp, and is investing heavily in AI infrastructure and the metaverse. Meta's AI investments include Llama models, AI assistants, and massive GPU infrastructure buildout.",
    bullCase: "Meta's AI-driven ad targeting improvements are driving revenue growth. Llama open-source strategy creates ecosystem advantages. Strong free cash flow funds AI infrastructure without debt.",
    bearCase: "Reality Labs metaverse losses continue to burn cash. Regulatory risk across multiple jurisdictions. AI ad targeting faces privacy regulation headwinds.",
    keyLevels: "Key support: $500–$520 (200-day MA), $450 (major structural support). Key resistance: $650–$680 (all-time high zone).",
    riskFactors: ["Regulatory risk", "Reality Labs losses", "Privacy regulation", "AI competition from Google/Apple", "Macro ad spend sensitivity"],
    relatedSymbols: ["nvda", "msft", "pltr"],
    relatedCrypto: [],
    faqs: [
      { q: "Is META a good AI stock?", a: "META is a strong AI beneficiary through improved ad targeting and Llama model development. Unlike pure-play AI stocks, META generates substantial cash flow that funds its AI investments." },
      { q: "What is META's AI strategy?", a: "META's AI strategy focuses on open-source Llama models, AI-powered ad targeting, AI assistants across its platforms, and AI infrastructure investment to reduce dependency on NVDA." },
      { q: "How does META perform in market downturns?", a: "META is less volatile than pure-play AI stocks but still sensitive to macro risk-off environments. Its strong cash flow provides a buffer compared to unprofitable AI companies." },
      { q: "What are META's key risks?", a: "Key risks include regulatory action in the EU and US, Reality Labs losses, privacy regulation impacting ad targeting, and competition from TikTok and YouTube." },
      { q: "How does FAULTLINE track META?", a: "FAULTLINE monitors META's momentum score, AI exposure, macro regime fit, and systemic pressure alignment. Signals are updated daily." },
    ],
  },
  amd: {
    name: "Advanced Micro Devices",
    sector: "AI Semiconductors",
    description: "AMD (AMD) is NVIDIA's primary competitor in AI GPUs and CPUs. AMD's MI300X GPU series targets AI training and inference workloads, while its EPYC CPU line dominates data center server deployments.",
    bullCase: "AMD's MI300X gaining traction with hyperscalers as an alternative to NVDA. CPU market share gains from Intel. Open software ecosystem (ROCm) improving. Valuation more reasonable than NVDA.",
    bearCase: "NVDA's CUDA moat is extremely difficult to displace. AMD's AI GPU market share remains small. Software ecosystem maturity gap vs NVDA creates adoption friction.",
    keyLevels: "Key support: $100–$105 (major support), $90 (structural floor). Key resistance: $140–$150 (previous highs). AMD trades at a significant discount to NVDA.",
    riskFactors: ["NVDA CUDA moat", "AI GPU market share concentration", "Software ecosystem gap", "Macro risk-off sensitivity", "Intel CPU competition recovery"],
    relatedSymbols: ["nvda", "msft", "meta"],
    relatedCrypto: [],
    faqs: [
      { q: "Is AMD a better buy than NVDA?", a: "AMD offers AI GPU exposure at a more reasonable valuation than NVDA, but with lower market share and a less mature software ecosystem. FAULTLINE tracks both for regime-aligned signal generation." },
      { q: "Can AMD challenge NVIDIA in AI GPUs?", a: "AMD is making progress with MI300X adoption, but NVDA's CUDA ecosystem creates significant switching costs. AMD is best positioned as a second-source supplier rather than a primary replacement." },
      { q: "How does AMD perform in different market regimes?", a: "AMD is highly correlated with NVDA and the broader AI semiconductor complex. In bull regimes, AMD benefits from AI sentiment. In risk-off environments, it experiences sharp drawdowns." },
      { q: "What is AMD's relationship to the AI bubble?", a: "AMD is a direct AI bubble exposure stock. FAULTLINE's AI bubble monitor tracks AMD's valuation and concentration risk alongside NVDA and the broader AI complex." },
      { q: "How does FAULTLINE track AMD?", a: "FAULTLINE monitors AMD's momentum score, AI chip exposure, macro regime fit, and systemic pressure alignment. Signals are updated daily." },
    ],
  },
};

// ── Generic data generator for unknown symbols ─────────────────────────────
function getSymbolData(symbol: string): SymbolData {
  const upper = symbol.toUpperCase();
  const existing = SYMBOL_DATA[symbol.toLowerCase()];
  if (existing) return existing;

  return {
    name: `${upper} Stock`,
    sector: "Equity",
    description: `${upper} is a publicly traded equity tracked by FAULTLINE's signal intelligence engine. FAULTLINE monitors ${upper}'s macro regime fit, momentum score, and systemic risk alignment to generate daily signals.`,
    bullCase: `${upper} outperforms when macro regime is bullish and systemic pressure is low. Monitor FAULTLINE's Pressure Index™ for regime confirmation before entering long positions.`,
    bearCase: `${upper} faces elevated risk in high-pressure macro environments. Credit spread widening, VIX regime elevation, and liquidity tightening are key warning signals tracked by FAULTLINE.`,
    keyLevels: `Key levels for ${upper} are updated dynamically based on price action and macro regime. FAULTLINE tracks support, resistance, and regime-aligned entry zones.`,
    riskFactors: ["Macro regime deterioration", "Systemic pressure elevation", "Liquidity tightening", "Credit spread widening", "Sector rotation risk"],
    relatedSymbols: ["nvda", "pltr", "tsla", "meta", "amd"],
    relatedCrypto: ["btc", "eth"],
    faqs: [
      { q: `What is ${upper}'s current signal?`, a: `FAULTLINE generates daily signals for ${upper} based on macro regime, momentum, and systemic pressure. Sign up for FAULTLINE to access the current ${upper} signal.` },
      { q: `How does ${upper} perform in different market regimes?`, a: `${upper}'s performance varies significantly across bull, bear, and crash regimes. FAULTLINE's regime tracker classifies current conditions to help you align ${upper} exposure appropriately.` },
      { q: `What are the key risks for ${upper}?`, a: `Key risks include macro regime deterioration, systemic pressure elevation, sector rotation, and liquidity tightening. FAULTLINE monitors all four dimensions daily.` },
      { q: `How does FAULTLINE track ${upper}?`, a: `FAULTLINE monitors ${upper}'s momentum score, macro regime fit, and systemic pressure alignment. Signals are updated daily and classified as Bullish, Neutral, or Risk-Off.` },
      { q: `Should I buy ${upper} now?`, a: `FAULTLINE does not provide financial advice. We provide macro regime context, systemic risk scores, and signal intelligence to help you make informed decisions. Always check the current regime before entering any position.` },
    ],
  };
}

export default function DynamicStockPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol ?? "").toLowerCase();
  const upper = symbol.toUpperCase();
  const data = getSymbolData(symbol);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": `${upper} Signal — Stock Risk Score & Analysis | FAULTLINE`,
        "description": `Real-time ${upper} signal analysis. FAULTLINE tracks ${upper} macro regime fit, momentum score, volatility risk, and key price levels.`,
        "author": { "@type": "Organization", "name": "FAULTLINE" },
        "publisher": { "@type": "Organization", "name": "FAULTLINE", "url": "https://getfaultline.live" },
        "url": `https://getfaultline.live/stock/${symbol}`,
        "dateModified": new Date().toISOString().split("T")[0],
      },
      {
        "@type": "FAQPage",
        "mainEntity": data.faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": { "@type": "Answer", "text": faq.a },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      {/* Schema markup */}
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
            <Link href="/signals" className="text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-[#00D4FF] transition-colors hidden sm:block">
              ALL SIGNALS
            </Link>
            <a href={getLoginUrl()} className="text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 px-4 py-2 rounded font-bold transition-colors">
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
          <Link href="/signals" className="hover:text-[#00D4FF] transition-colors">SIGNALS</Link>
          <span>/</span>
          <span className="text-[#A8B8CC]">{upper}</span>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-3">{data.sector.toUpperCase()}</div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            {upper} Signal Analysis
          </h1>
          <p className="text-lg text-[#A8B8CC] leading-relaxed max-w-2xl">
            Real-time {data.name} signal intelligence. FAULTLINE tracks {upper}'s macro regime fit, momentum score, and systemic risk alignment — updated daily.
          </p>
        </div>

        {/* Signal CTA */}
        <div className="p-6 rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 mb-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-2">LIVE SIGNAL</div>
              <p className="text-white font-semibold mb-1">Access the current {upper} signal</p>
              <p className="text-[#A8B8CC] text-sm">Macro regime fit · Momentum score · Risk classification · Key levels</p>
            </div>
            <a href={getLoginUrl()} className="shrink-0 text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 px-5 py-3 rounded font-bold transition-colors whitespace-nowrap">
              GET SIGNAL →
            </a>
          </div>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">What is {data.name}?</h2>
          <p className="text-[#A8B8CC] leading-relaxed">{data.description}</p>
        </section>

        {/* Bull / Bear */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">{upper} Bull Case vs Bear Case</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[10px] font-mono tracking-widest text-emerald-400 mb-3">BULL CASE</div>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">{data.bullCase}</p>
            </div>
            <div className="p-6 rounded-lg border border-red-500/20 bg-red-500/5">
              <div className="text-[10px] font-mono tracking-widest text-red-400 mb-3">BEAR CASE</div>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">{data.bearCase}</p>
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
            {upper}'s performance is highly dependent on the prevailing macro regime. FAULTLINE classifies the current market environment as Bull, Bear, Crash, or Recovery — and each regime has distinct implications for {upper} positioning.
          </p>
          <p className="text-[#A8B8CC] leading-relaxed mb-4">
            In bull regimes with low systemic pressure, {upper} tends to benefit from risk appetite expansion. In elevated-pressure environments — characterized by credit spread widening, VIX regime elevation, and liquidity tightening — {upper} faces headwinds that FAULTLINE's Pressure Index™ detects in advance.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <Link href="/market-regime-tracker" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-cyan-400/30 transition-all">
              <div className="text-[10px] font-mono tracking-widest text-cyan-400 mb-2">REGIME</div>
              <div className="text-white text-sm font-semibold group-hover:text-[#00D4FF] transition-colors">Market Regime Tracker</div>
            </Link>
            <Link href="/market-crash-probability-2026" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-red-400/30 transition-all">
              <div className="text-[10px] font-mono tracking-widest text-red-400 mb-2">CRASH RISK</div>
              <div className="text-white text-sm font-semibold group-hover:text-[#00D4FF] transition-colors">Crash Probability 2026</div>
            </Link>
            <Link href="/volatility-dashboard" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-yellow-400/30 transition-all">
              <div className="text-[10px] font-mono tracking-widest text-yellow-400 mb-2">VOLATILITY</div>
              <div className="text-white text-sm font-semibold group-hover:text-[#00D4FF] transition-colors">Volatility Dashboard</div>
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">{upper} Frequently Asked Questions</h2>
          <div className="space-y-4">
            {data.faqs.map((faq, i) => (
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
            {data.relatedSymbols.map((sym) => (
              <Link key={sym} href={`/stock/${sym}`} className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-[#00D4FF]/20 transition-all text-center">
                <div className="text-[10px] font-mono tracking-widest text-[#64748B] mb-1">STOCK</div>
                <div className="text-white font-bold group-hover:text-[#00D4FF] transition-colors">{sym.toUpperCase()}</div>
              </Link>
            ))}
            {data.relatedCrypto.map((sym) => (
              <Link key={sym} href={`/crypto/${sym}`} className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-purple-400/20 transition-all text-center">
                <div className="text-[10px] font-mono tracking-widest text-purple-400/60 mb-1">CRYPTO</div>
                <div className="text-white font-bold group-hover:text-[#00D4FF] transition-colors">{sym.toUpperCase()}</div>
              </Link>
            ))}
            <Link href="/signals" className="group p-4 rounded-lg border border-white/8 bg-white/[0.02] hover:border-[#00D4FF]/20 transition-all text-center">
              <div className="text-[10px] font-mono tracking-widest text-[#00D4FF]/60 mb-1">ALL</div>
              <div className="text-white font-bold group-hover:text-[#00D4FF] transition-colors">ALL SIGNALS</div>
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
