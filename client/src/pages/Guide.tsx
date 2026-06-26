/* ============================================================
   FAULTLINE — User Guidance
   Comprehensive in-app documentation explaining every feature,
   tab, signal label, and data source in detail.
   Design: Palantir Noir — void-black, neon accents, scanlines.
   ============================================================ */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Gauge, LayoutDashboard, Activity, BarChart2, Brain,
  Radio, Bell, AlertTriangle, Clock, Zap, FileText, TrendingUp,
  ChevronDown, ChevronRight, Search, Shield, Cpu, Database,
  Target, Eye, Layers, Info, ArrowRight,
} from "lucide-react";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { PreflightTrigger } from "@/components/MarketPreflight";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  content: React.ReactNode;
  keywords?: string[]; // search aliases — not displayed to user
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function CornerBracket({ color = "rgba(0,212,255,0.5)" }: { color?: string }) {
  return (
    <>
      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: color }} />
      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: color }} />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{ borderColor: color }} />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{ borderColor: color }} />
    </>
  );
}

function Panel({ children, className = "", accentColor = "rgba(0,212,255,0.15)" }: {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}) {
  return (
    <div className={`relative border border-white/10 bg-black/40 backdrop-blur-sm p-4 ${className}`}
      style={{ borderTop: `1px solid ${accentColor}` }}>
      <CornerBracket color={accentColor} />
      {children}
    </div>
  );
}

function SignalBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold tracking-widest border rounded-sm mr-1 mb-1"
      style={{ color, borderColor: `${color}60`, background: `${color}15` }}>
      {label}
    </span>
  );
}

function FieldRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-mono text-cyan-400/70 w-36 shrink-0 pt-0.5">{label}</span>
      <div>
        <span className="text-[11px] font-mono text-white/90">{value}</span>
        {note && <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full border border-cyan-400/50 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px] font-mono text-cyan-400">{num}</span>
      </div>
      <div>
        <p className="text-[11px] font-mono text-white/90 font-bold">{title}</p>
        <p className="text-[10px] text-white/50 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─── Section content ──────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "overview",
    icon: BookOpen,
    title: "What Is FAULTLINE?",
    subtitle: "Platform overview and core philosophy",
    color: "#00D4FF",
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
                    FAULTLINE is a <span className="text-cyan-400">Market Navigation System</span> that keeps investors informed through continuous updates on changing market conditions. Markets move through changing regimes — FAULTLINE helps you understand what is changing, why it matters, and what deserves attention next.
          </p>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono mt-3">
            Rather than relying on headlines or emotions, FAULTLINE continuously monitors multiple dimensions of the market — macro, technical, sentiment, and liquidity — and translates complex information into clear, actionable awareness. The platform is built on one principle: <span className="text-cyan-400 font-bold">Understand. Adapt. Navigate.</span>
          </p>
        </Panel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: Database, label: "Live FRED Data", desc: "10+ Federal Reserve economic series updated in real-time: yields, spreads, inflation, unemployment, SOFR, and more." },
            { icon: Cpu, label: "AI Regime Engine", desc: "A proprietary macro regime classifier that continuously evaluates systemic risk across 6 stress domains and assigns a 0–10 pressure score." },
            { icon: Target, label: "S.O.B.™ Framework", desc: "Signals of Breakdown — FAULTLINE's proprietary framework measuring the accumulation of market stress across 6 independent pillars. Not a crash prediction system. A structured awareness tool." },
          ].map(({ icon: Icon, label, desc }) => (
            <Panel key={label} accentColor="rgba(0,212,255,0.2)">
              <Icon className="w-4 h-4 text-cyan-400 mb-2" />
              <p className="text-[11px] font-mono text-white/90 font-bold mb-1">{label}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
        <Panel accentColor="rgba(255,200,0,0.3)">
          <p className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            <span className="text-yellow-400 font-bold">DISCLAIMER</span> — FAULTLINE is an analytical research tool. Nothing on this platform constitutes financial advice, investment recommendations, or solicitation to buy or sell any security. All data is provided for informational purposes only.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "pressure",
    icon: Gauge,
    title: "Pressure Tab",
    subtitle: "FAULTLINE Pressure Index — systemic risk at a glance",
    color: "#FF4444",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(255,68,68,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-red-400">Pressure Tab</span> is the core heart of FAULTLINE. It displays the <strong className="text-white">FAULTLINE Pressure Index</strong> — a composite 0–100 score representing the current level of systemic financial stress. The score is derived from 6 independent risk vectors, each weighted and normalised from live FRED economic data.
          </p>
        </Panel>

        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Pressure Level Scale</p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { level: "LOW", range: "0–20", color: "#22c55e", desc: "System stable. No elevated stress detected across major risk vectors." },
              { level: "MODERATE", range: "21–40", color: "#84cc16", desc: "Minor stress in 1–2 vectors. Monitor but no immediate concern." },
              { level: "ELEVATED", range: "41–60", color: "#eab308", desc: "Multiple vectors showing stress. Regime shift possible within weeks." },
              { level: "HIGH", range: "61–80", color: "#f97316", desc: "Significant systemic stress. Historical analog patterns activating." },
              { level: "CRITICAL", range: "81–100", color: "#ef4444", desc: "Crisis-level pressure. Multiple contagion vectors breached simultaneously." },
            ].map(({ level, range, color, desc }) => (
              <Panel key={level} accentColor={`${color}60`} className="text-center">
                <p className="text-[10px] font-mono font-bold" style={{ color }}>{level}</p>
                <p className="text-[9px] font-mono text-white/40 mt-0.5">{range}</p>
                <p className="text-[9px] text-white/40 mt-1 leading-tight">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Risk Vectors</p>
          <div className="space-y-1">
            {[
              { name: "Liquidity Stress", desc: "Measures tightness in short-term funding markets. Derived from SOFR rate, HY credit spread (BAMLH0A0HYM2), and NFCI (National Financial Conditions Index). High values indicate banks and funds are struggling to access cash." },
              { name: "Credit Contagion Risk", desc: "Tracks the risk of credit stress spreading across the financial system. Uses HY spread, 10Y Treasury yield (DGS10), and the yield curve slope. Elevated when credit markets price in widespread default risk." },
              { name: "Volatility Regime", desc: "Assesses whether markets are in a calm or turbulent volatility regime. Derived from the VIX proxy (VIXCLS) and recent equity market behaviour. High values signal fear and uncertainty are dominant." },
              { name: "Macro Sensitivity", desc: "How sensitive the current environment is to macro surprises. Uses CPI inflation (CPIAUCSL), unemployment (UNRATE), and the 10Y yield. High sensitivity means small data misses can cause outsized market moves." },
              { name: "Market Breadth", desc: "Measures the health of market participation. Derived from equity market conditions and the spread between growth and value. Narrow breadth (few stocks leading) is a classic late-cycle warning sign." },
              { name: "AI / Speculative Bubble Exposure", desc: "Tracks the degree to which speculative and AI-driven assets are inflating systemic risk. Uses equity valuations and sector concentration data. High values indicate bubble dynamics are contributing to overall pressure." },
            ].map(({ name, desc }) => (
              <Panel key={name} className="!p-3">
                <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
                <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>

        <Panel accentColor="rgba(0,212,255,0.2)">
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            <span className="text-cyan-400 font-bold">LIQUIDITY STRESS METER</span> — The bottom section of the Pressure tab shows a detailed breakdown of the 4 liquidity sub-indicators (HY Spread, Yield Curve, NFCI, Credit Spread) with individual bar meters and a composite liquidity stress score.
          </p>
          <p className="text-[10px] font-mono text-white/50 leading-relaxed mt-2">
            <span className="text-cyan-400 font-bold">CONTAGION RISK CASCADE</span> — A visual cascade diagram showing which risk vectors are above the stress threshold and how contagion could propagate through the system. The contagion spread percentage indicates how many vectors are simultaneously stressed.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard Tab",
    subtitle: "Live macro overview — the command centre",
    color: "#00D4FF",
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-cyan-400">Dashboard</span> is the primary macro overview screen. It shows the current regime, live FRED data, probability distributions, and a risk domain heatmap — all updating in real-time as new data arrives from the Federal Reserve.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Dashboard Sections</p>
          <div className="space-y-1">
            {[
              { name: "Regime Banner", desc: "Shows the current macro regime label (e.g. 'Late Cycle Stress', 'Expansion', 'Crisis Mode') with a 0–10 systemic risk score and a colour-coded severity indicator. The regime is recalculated every time FRED data refreshes." },
              { name: "Live FRED Ticker", desc: "A scrolling marquee at the top of the screen showing real-time values for 10Y yield, 30Y yield, HY spread, CPI, SOFR, and unemployment rate. Values update automatically." },
              { name: "Bull vs Crash Probability", desc: "A probability gauge showing the engine's current estimate of bullish continuation vs systemic crash risk, expressed as a percentage split. Derived from the composite regime score." },
              { name: "Risk Domain Heatmap", desc: "A 6-cell grid showing the stress level for each domain: Treasury Stress, Inflation Pressure, Credit Risk, AI Bubble Risk, Liquidity Stress, and Recession Risk. Each cell is colour-coded from green (low) to red (critical)." },
              { name: "AI Intelligence Narrative", desc: "A live AI-generated paragraph summarising the current macro environment in institutional language. Updates with the regime engine on each data refresh." },
              { name: "Top Signals Today", desc: "A curated list of the highest-scoring tickers from the Signals screener given the current regime, surfaced automatically by the engine." },
            ].map(({ name, desc }) => (
              <Panel key={name} className="!p-3">
                <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
                <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "scores",
    icon: Activity,
    title: "Scores Tab",
    subtitle: "Granular domain stress scores and trend indicators",
    color: "#A78BFA",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(167,139,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-purple-400">Scores Tab</span> provides a granular breakdown of each of the 6 risk domains with individual 0–10 scores, trend direction indicators, and supporting FRED data points. This is the analytical layer beneath the Dashboard's heatmap.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Treasury Stress Score", fred: "DGS10, DGS30", desc: "Measures stress in the US Treasury market. Elevated when the 10Y yield is rising rapidly or when the yield curve inverts (long rates below short rates), signalling recession expectations." },
            { name: "Inflation Pressure Score", fred: "CPIAUCSL", desc: "Tracks the degree to which inflation is above or below the Fed's 2% target. High scores indicate the Fed is likely to maintain or increase restrictive monetary policy." },
            { name: "Credit Risk Score", fred: "BAMLH0A0HYM2", desc: "Derived from the ICE BofA High Yield OAS spread. When this spread widens, it means credit markets are pricing in higher default risk — a classic leading indicator of financial stress." },
            { name: "AI Bubble Risk Score", fred: "Equity valuations + sector data", desc: "A proprietary score estimating the degree to which AI and speculative technology valuations are stretched relative to fundamentals. High scores indicate bubble dynamics." },
            { name: "Liquidity Stress Score", fred: "SOFR, NFCI, BAMLH0A0HYM2", desc: "Composite score measuring tightness in short-term funding markets. Elevated SOFR, wide HY spreads, and a tight NFCI all contribute to a high liquidity stress score." },
            { name: "Recession Risk Score", fred: "UNRATE, yield curve, FRED composite", desc: "Probability-weighted recession risk score. Incorporates unemployment trends, yield curve inversion depth, and leading indicator deterioration." },
          ].map(({ name, fred, desc }) => (
            <Panel key={name} className="!p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-mono text-purple-400 font-bold mb-1">{name}</p>
                <span className="text-[9px] font-mono text-white/30 shrink-0">FRED: {fred}</span>
              </div>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "charts",
    icon: BarChart2,
    title: "Charts Tab",
    subtitle: "Interactive time-series charts for all FRED indicators",
    color: "#34D399",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(52,211,153,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-emerald-400">Charts Tab</span> renders interactive time-series charts for every FRED economic indicator tracked by the engine. Charts show historical context alongside the current reading, allowing you to see whether conditions are deteriorating or improving relative to recent history.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Available Charts</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "10Y Treasury Yield (DGS10)", "30Y Treasury Yield (DGS30)",
              "HY Credit Spread (BAMLH0A0HYM2)", "CPI Inflation (CPIAUCSL)",
              "SOFR Rate", "Unemployment Rate (UNRATE)",
              "Yield Curve Slope", "Composite Risk Score",
            ].map(label => (
              <Panel key={label} className="!p-2" accentColor="rgba(52,211,153,0.2)">
                <p className="text-[10px] font-mono text-emerald-400/80">{label}</p>
              </Panel>
            ))}
          </div>
        </div>
        <Panel className="!p-3">
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            Each chart includes a <span className="text-emerald-400">regime overlay</span> — a colour band that shows which macro regime was active during each historical period, making it easy to contextualise current readings against past stress events.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "ai-watch",
    icon: Brain,
    title: "AI Watch Tab",
    subtitle: "Real-time AI surveillance of macro and market intelligence",
    color: "#F472B6",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(244,114,182,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-pink-400">AI Watch Tab</span> is FAULTLINE's live intelligence feed. It monitors AI and technology sector risk in real-time, tracking AI capital expenditure, bubble risk indicators, and curated macro news — all synthesised through the regime engine.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "AI Capex Tracker", desc: "Tracks the aggregate capital expenditure commitments from major AI infrastructure players (Microsoft, Google, Amazon, Meta, NVIDIA). Currently tracking $214B+ in announced AI capex. High capex concentration is a leading indicator of AI bubble risk." },
            { name: "AI Bubble Risk Score", desc: "A 0–10 score updated by the engine estimating the current degree of AI-sector overvaluation. Scores above 7 indicate bubble dynamics; scores above 9 indicate critical bubble risk." },
            { name: "Live Intelligence Feed", desc: "A curated stream of macro and AI-sector news items, each tagged with a relevance score and regime impact assessment. Items are filtered for systemic relevance — not noise." },
            { name: "Sector Concentration Monitor", desc: "Tracks the degree to which the S&P 500 and Nasdaq are concentrated in AI and technology names. High concentration amplifies systemic risk when sentiment reverses." },
            { name: "Regime Narrative", desc: "An AI-generated paragraph updated with each engine cycle that contextualises the current AI/tech environment within the broader macro regime. Written in institutional language." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-pink-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "signals",
    icon: Radio,
    title: "Signals Tab",
    subtitle: "Live stock screener + AI-powered ticker intelligence",
    color: "#00D4FF",
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-cyan-400">Signals Tab</span> is the market intelligence layer of FAULTLINE. It combines a curated live screener of 42 priority tickers with an on-demand AI classifier that can analyse any stock symbol in the context of the current macro regime.
          </p>
        </Panel>

        {/* Ticker Search */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase flex items-center gap-2">
            <Search className="w-3 h-3" /> Ticker Search — Stock Intelligence Card
          </p>
          <Panel accentColor="rgba(0,212,255,0.25)" className="space-y-3">
            <div className="space-y-2">
              {[
                { step: 1, title: "Enter any ticker symbol", desc: "Type any valid US stock ticker (e.g. NVDA, TSLA, BRK.B, SPY) into the search bar at the top of the Signals tab. Press Enter or click ANALYZE." },
                { step: 2, title: "Live data fetch", desc: "FAULTLINE fetches real-time intraday prices from Yahoo Finance (during market hours) and 5-day sparklines from Polygon.io. This takes 1–3 seconds." },
                { step: 3, title: "AI classification", desc: "The LLM classifier receives the ticker profile and current macro regime context, then assigns FAULTLINE signal labels, a regime fit score, and a full intelligence briefing. This takes 5–15 seconds." },
                { step: 4, title: "Stock Intelligence Card", desc: "The full card renders with all data sections. You can save the ticker to your watchlist or expand the 'Why This Signal?' panel for the AI's full reasoning." },
              ].map(({ step, title, desc }) => (
                <StepCard key={step} num={step} title={title} desc={desc} />
              ))}
            </div>
          </Panel>
        </div>

        {/* Signal Labels */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">FAULTLINE Signal Labels</p>
          <Panel>
            <div className="space-y-2">
              {[
                { label: "MOMENTUM BREAKOUT", color: "#00D4FF", desc: "The stock is exhibiting strong price momentum relative to the market. In the current regime, momentum is being rewarded. High momentum score (70+)." },
                { label: "AI BUBBLE EXPOSURE", color: "#F472B6", desc: "The stock has significant exposure to AI infrastructure, software, or hardware. In a high AI bubble risk regime, this label indicates elevated valuation risk." },
                { label: "SPECULATIVE ACCELERATION", color: "#A78BFA", desc: "The stock is showing signs of speculative buying beyond fundamental justification. Volume and price action suggest retail-driven momentum." },
                { label: "LIQUIDITY SENSITIVE", color: "#34D399", desc: "The stock's performance is highly sensitive to changes in liquidity conditions. When SOFR rises or HY spreads widen, this stock typically underperforms." },
                { label: "DEBT STRESS RISK", color: "#F97316", desc: "The company carries significant debt that becomes more burdensome in a high-rate, tight-credit environment. Credit risk is elevated." },
                { label: "RECESSION DEFENSIVE", color: "#22C55E", desc: "The stock historically outperforms during recessions or economic slowdowns. Defensive characteristics: stable cash flows, essential products/services." },
                { label: "MACRO BENEFICIARY", color: "#EAB308", desc: "The stock stands to benefit from the current macro regime. For example, energy stocks in an inflationary regime, or financials in a rising-rate environment." },
                { label: "MACRO VULNERABLE", color: "#EF4444", desc: "The stock is particularly exposed to the risks of the current macro regime. For example, high-duration growth stocks in a rising-rate environment." },
                { label: "NEUTRAL / WATCH", color: "#6B7280", desc: "No strong directional signal in the current regime. The stock should be monitored but does not warrant a strong conviction position based on macro factors alone." },
              ].map(({ label, color, desc }) => (
                <div key={label} className="flex gap-3 items-start py-1.5 border-b border-white/5 last:border-0">
                  <SignalBadge label={label} color={color} />
                  <p className="text-[10px] text-white/50 leading-relaxed flex-1">{desc}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Screener */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Curated Screener</p>
          <Panel className="!p-3">
            <p className="text-[10px] text-white/50 leading-relaxed">
              The screener shows 42 priority tickers spanning AI infrastructure, semiconductors, financials, energy, defensives, and macro-sensitive sectors. Each card shows live price, daily change, volume, a 5-day sparkline, and FAULTLINE signal labels. Use the <span className="text-cyan-400">filter tabs</span> (ALL / MOMENTUM / AI / DEFENSIVE / STRESS / SPECULATIVE) to narrow by signal type. The screener refreshes every 5 minutes with live Yahoo Finance data.
            </p>
          </Panel>
        </div>

        {/* Search History & Watchlist */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Search History & Watchlist</p>
          <Panel className="!p-3">
            <p className="text-[10px] text-white/50 leading-relaxed">
              Your last 12 ticker searches are saved automatically as <span className="text-cyan-400">Recent</span> chips below the search bar. Tickers you star (★) are saved to your <span className="text-yellow-400">Watchlist</span> chips. Both are persisted to your browser's local storage and survive page refreshes. Click any chip to instantly re-run the analysis.
            </p>
          </Panel>
        </div>
      </div>
    ),
  },
  {
    id: "watchlist",
    icon: Bell,
    title: "Watch Tab",
    subtitle: "Custom macro indicator watchlist with live threshold alerts",
    color: "#EAB308",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(234,179,8,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-yellow-400">Watch Tab</span> lets you pin specific FRED macro indicators, set custom alert thresholds with above/below conditions, and receive live visual alerts when thresholds are crossed. Your watchlist is persisted to local storage.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">How to Use</p>
          <div className="space-y-2">
            <StepCard num={1} title="Add an indicator" desc="Click the + ADD INDICATOR button. Choose from the full FRED indicator catalog: yields, spreads, inflation, unemployment, SOFR, and more." />
            <StepCard num={2} title="Set a threshold" desc="For each indicator, set an alert condition: ABOVE a value, BELOW a value, or CROSSES (triggers on both directions). Enter your threshold value." />
            <StepCard num={3} title="Monitor live" desc="The watchlist shows the current live value next to your threshold. A red breach indicator appears when the condition is met. The nav tab shows a badge count of active breaches." />
            <StepCard num={4} title="Manage alerts" desc="Edit thresholds, toggle alerts on/off, or remove indicators at any time. All changes persist across browser sessions." />
          </div>
        </div>
        <Panel className="!p-3">
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            <span className="text-yellow-400 font-bold">BREACH BADGE</span> — When one or more of your watchlist thresholds is breached, a red number badge appears on the Watch tab icon in the navigation sidebar. This gives you a persistent at-a-glance alert without needing to be on the Watch tab.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "alerts",
    icon: AlertTriangle,
    title: "Alerts Tab",
    subtitle: "Regime shift detection and automated threshold alerts",
    color: "#F97316",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(249,115,22,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-orange-400">Alerts Tab</span> is the automated alert system. It continuously monitors all FRED indicators against a set of pre-defined threshold rules and generates alerts when conditions are met — without requiring you to manually set thresholds.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Regime Shift Alerts", desc: "Triggered when the macro regime score crosses a major threshold (e.g. from Moderate to Elevated). These are the most important alerts — they signal a fundamental change in the risk environment." },
            { name: "Threshold Breach Alerts", desc: "Triggered when individual FRED indicators cross pre-defined danger levels. Examples: 10Y yield above 5%, HY spread above 500bps, unemployment rising above 5%." },
            { name: "Directional Change Alerts", desc: "Triggered when an indicator reverses direction after a sustained trend. For example, CPI falling for 3 consecutive months after a rising trend — a potential Fed pivot signal." },
            { name: "Alert History", desc: "A chronological log of all alerts generated in the current session, with timestamps, severity levels (INFO / WARNING / CRITICAL), and the specific indicator and value that triggered each alert." },
            { name: "Pressure Gauges", desc: "Mini arc gauges at the top of the Alerts tab showing the current pressure level for each of the 6 risk domains at a glance." },
            { name: "Acknowledge & Clear", desc: "Mark individual alerts as acknowledged to remove them from the active list, or clear all acknowledged alerts to reset the history." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-orange-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "scenarios",
    icon: TrendingUp,
    title: "Scenarios Tab",
    subtitle: "Pre-built macro stress scenarios and their market impact",
    color: "#A78BFA",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(167,139,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-purple-400">Scenarios Tab</span> presents a library of pre-built macro stress scenarios — each one a plausible near-term macro outcome — with probability estimates, domain impact scores, and a radar chart showing which risk domains are most affected.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Scenario Library", desc: "A curated set of named scenarios (e.g. 'Fed Pivot', 'Credit Crunch', 'AI Bubble Pop', 'Soft Landing', 'Stagflation Return'). Each scenario has a probability estimate derived from the current regime score." },
            { name: "Domain Impact Radar", desc: "A radar chart for each scenario showing how it would affect each of the 6 risk domains. Allows you to quickly see which scenarios are most dangerous for specific areas of the market." },
            { name: "Probability Ranking", desc: "Scenarios are ranked by current probability. The most likely scenario is shown first. Probabilities update as the regime engine recalculates." },
            { name: "Scenario Detail", desc: "Expand any scenario to see the full narrative, the specific FRED conditions that would trigger it, and the expected market impact across asset classes." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-purple-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "analogs",
    icon: Clock,
    title: "Analogs Tab",
    subtitle: "Historical era comparisons and similarity scoring",
    color: "#34D399",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(52,211,153,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-emerald-400">Analogs Tab</span> is one of FAULTLINE's signature features. It compares the current macro environment against historical crisis eras and scores the similarity — helping you understand what the current period most resembles and what happened next.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Historical Eras Tracked</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "2008 — Global Financial Crisis",
              "2000 — Dot-Com Bubble",
              "1987 — Black Monday",
              "1994 — Bond Market Massacre",
              "2020 — COVID Crash",
              "1997 — Asian Financial Crisis",
              "2022 — Fed Tightening Cycle",
              "1929 — Great Depression",
            ].map(era => (
              <Panel key={era} className="!p-2" accentColor="rgba(52,211,153,0.2)">
                <p className="text-[10px] font-mono text-emerald-400/80">{era}</p>
              </Panel>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {[
            { name: "Similarity Score", desc: "Each era is scored 0–100% for similarity to the current environment based on the 7 crisis dimensions: treasury stress, inflation, credit, AI bubble, liquidity, recession, and banking stress." },
            { name: "Divergence Indicators", desc: "Shows which dimensions are most different from the historical analog — helping you understand what makes the current period unique and where the analog breaks down." },
            { name: "Outcome Context", desc: "Each era card shows the peak market drawdown, recovery timeline, and a brief institutional narrative describing what happened and why." },
            { name: "Radar Comparison", desc: "A radar chart overlaying the current environment against the selected historical analog across all 7 dimensions, making divergences immediately visible." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-emerald-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "simulate",
    icon: Zap,
    title: "Simulate Tab",
    subtitle: "Interactive stress-testing — drag sliders to break the system",
    color: "#EAB308",
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(234,179,8,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-yellow-400">Simulate Tab</span> is FAULTLINE's flagship interactive feature. Drag sliders to manually override any FRED indicator and watch the entire engine — regime score, domain scores, probability gauges, and radar chart — react in real-time.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">How to Use</p>
          <div className="space-y-2">
            <StepCard num={1} title="Adjust a slider" desc="Each FRED indicator has a slider with a realistic range. Drag the 10Y yield slider to 6% to simulate a rate shock, or drag the HY spread to 800bps to simulate a credit crunch." />
            <StepCard num={2} title="Watch the engine react" desc="The regime score, all 6 domain scores, and the probability gauges update instantly as you drag. The radar chart morphs to reflect the new environment." />
            <StepCard num={3} title="Combine scenarios" desc="Adjust multiple sliders simultaneously to construct complex scenarios. What happens if CPI rises to 8% AND the yield curve inverts AND HY spreads blow out?" />
            <StepCard num={4} title="Reset" desc="Click the RESET button to return all sliders to their current live FRED values and restore the real-world engine state." />
          </div>
        </div>
        <Panel className="!p-3">
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            <span className="text-yellow-400 font-bold">NOTE</span> — Simulation mode does not affect the live engine. Changes you make in the Simulate tab are isolated to that tab and do not alter the readings on the Dashboard, Pressure, Scores, or Alerts tabs.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "report",
    icon: FileText,
    title: "Report Tab",
    subtitle: "Daily intelligence briefing — one-click PDF export",
    color: "#6B7280",
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-gray-400">Report Tab</span> generates an institutional-grade daily macro briefing from the live engine state. The report is auto-generated and typewritten on screen, then available for one-click PDF export via the browser print dialog.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Executive Summary", desc: "A 2–3 paragraph AI-generated summary of the current macro environment, written in the style of an institutional research note. Covers the dominant regime, key risks, and the most important data points." },
            { name: "Domain Scorecard", desc: "A bar chart showing all 6 domain scores with colour-coded severity, allowing the reader to quickly identify which areas of the financial system are under the most stress." },
            { name: "Key Indicator Table", desc: "A table of all live FRED values with their current reading, the prior reading, the change, and a brief interpretation of what the change means for the regime." },
            { name: "Top Signals", desc: "The top 5 FAULTLINE signal opportunities given the current regime, with signal labels and a brief rationale for each." },
            { name: "PDF Export", desc: "Click the EXPORT PDF button (or use the browser's print function, Cmd+P / Ctrl+P) to save the report as a PDF. The report is formatted for A4/Letter printing with the FAULTLINE branding intact." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-gray-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "data",
    icon: Database,
    title: "Data Sources",
    subtitle: "Where FAULTLINE's data comes from",
    color: "#00D4FF",
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            FAULTLINE pulls from three primary data sources: the <span className="text-cyan-400">Federal Reserve Economic Data (FRED)</span> API for macroeconomic indicators, <span className="text-cyan-400">Yahoo Finance</span> for live intraday stock prices during market hours, and <span className="text-cyan-400">Polygon.io</span> for sparklines and historical bar data. All API calls are made server-side — your browser never sees an API key.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">FRED — Federal Reserve Economic Data</p>
          <div className="space-y-1">
            {[
              { label: "DGS10", value: "10-Year Treasury Constant Maturity Rate", note: "The benchmark long-term interest rate. Rising rapidly = tightening financial conditions." },
              { label: "DGS30", value: "30-Year Treasury Constant Maturity Rate", note: "Long-end of the yield curve. Used for yield curve slope calculations." },
              { label: "BAMLH0A0HYM2", value: "ICE BofA US High Yield OAS Spread", note: "Credit risk barometer. Widening = markets pricing in higher default risk." },
              { label: "CPIAUCSL", value: "Consumer Price Index — All Urban Consumers", note: "Primary inflation measure. Above 2% = Fed likely to maintain restrictive policy." },
              { label: "SOFR", value: "Secured Overnight Financing Rate", note: "Short-term funding rate. Elevated = tight liquidity in overnight markets." },
              { label: "UNRATE", value: "Unemployment Rate", note: "Labour market health. Rising = economic deterioration; falling = overheating risk." },
              { label: "VIXCLS", value: "CBOE Volatility Index (VIX)", note: "Market fear gauge. Above 30 = elevated fear; above 40 = crisis-level volatility." },
              { label: "NFCI", value: "Chicago Fed National Financial Conditions Index", note: "Composite financial conditions. Positive = tighter than average; negative = looser." },
            ].map(({ label, value, note }) => (
              <FieldRow key={label} label={label} value={value} note={note} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Yahoo Finance + Polygon.io — Live Market Data</p>
          <Panel className="!p-3">
            <p className="text-[10px] text-white/50 leading-relaxed">
              During market hours, FAULTLINE fetches live intraday prices for all 42 priority tickers from Yahoo Finance (batch API, ~2s). Polygon.io provides 5-day sparklines, ticker details (company name, sector, industry, market cap, description), and historical bar data. Both sources are cached server-side with a 5-minute TTL. When the live feed is unavailable, FAULTLINE falls back to the most recent cached data and displays a STALE or FALLBACK badge on affected cards.
            </p>
          </Panel>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Cache & Refresh Behaviour</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "FRED Data", ttl: "15 min TTL", desc: "Macro indicators cached for 15 minutes. Stale fallback on FRED API errors." },
              { label: "Screener Prices", ttl: "5 min TTL", desc: "Screener bulk price fetch cached for 5 minutes. Manual refresh available." },
              { label: "Ticker Search", ttl: "2 min TTL", desc: "Per-ticker search results cached for 2 minutes to reduce API calls." },
            ].map(({ label, ttl, desc }) => (
              <Panel key={label} className="!p-3" accentColor="rgba(0,212,255,0.2)">
                <p className="text-[11px] font-mono text-cyan-400 font-bold">{label}</p>
                <p className="text-[10px] font-mono text-white/40 mt-0.5">{ttl}</p>
                <p className="text-[10px] text-white/40 mt-1 leading-tight">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "market-preflight",
    icon: Shield,
    title: "Complete Market Awareness™",
    subtitle: "Market Preflight, awareness scoring, and the pre-decision review process",
    color: "#00FF88",
    keywords: [
      "preflight",
      "market preflight",
      "awareness score",
      "complete market awareness",
      "daily review",
      "decision checklist",
      "risk review",
      "before acting",
      "market checklist",
    ],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(0,255,136,0.2)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-emerald-400 font-bold">Market Preflight</span> is FAULTLINE's pre-decision review process. It helps users check the current FAULTLINE reading, market stress level, regime, pressure drivers, alerts, signal context, data quality, and possible future outcomes before making financial decisions.
          </p>
        </Panel>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Complete Market Awareness™</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              Complete Market Awareness™ is a daily situational awareness framework built into FAULTLINE. Before making any financial decision, the system guides users through reviewing the full risk picture: the Pressure Index, market regime, active alerts, signal context, data quality, and possible future outcomes.
            </p>
            <p className="text-[11px] text-white/70 leading-relaxed font-mono">
              The system tracks which platform sections you have reviewed today and computes a <span className="text-emerald-400">Complete Market Awareness Score</span> from 0–100. This score reflects how thoroughly you have reviewed the available context — it is not a market prediction or a signal to act.
            </p>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Complete Market Awareness Score</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              The score is calculated from completed review steps across the platform. Each step corresponds to a section of the FAULTLINE risk picture.
            </p>
            <div className="space-y-1.5">
              {[
                { range: "90–100", label: "Complete Market Awareness", color: "#00FF88" },
                { range: "75–89", label: "Strong Market Awareness", color: "#00D4FF" },
                { range: "60–74", label: "Developing Awareness", color: "#FFD700" },
                { range: "40–59", label: "Partial Awareness", color: "#FF9500" },
                { range: "0–39",  label: "Limited Awareness", color: "#FF2D55" },
              ].map(({ range, label, color }) => (
                <div key={range} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-[10px] font-mono w-16 shrink-0" style={{ color }}>{ range }</span>
                  <span className="text-[10px] font-mono text-white/70">{ label }</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Market Preflight Checklist</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              The checklist covers 10 review steps across the platform. Completing each step contributes points to your awareness score for the day.
            </p>
            <div className="space-y-1.5">
              {[
                "Current FAULTLINE reading reviewed",
                "Market stress level understood",
                "Current regime reviewed",
                "Pressure drivers reviewed",
                "Crash/bull probability context reviewed",
                "Active alerts checked",
                "Signal context reviewed",
                "Data status confirmed",
                "Possible future outcomes reviewed",
                "Watchlist/portfolio impact considered",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
                  <span className="text-[10px] font-mono text-emerald-400/60 w-4 shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-[10px] font-mono text-white/70">{ item }</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Daily Market Preflight</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-2">
              The Market Preflight resets daily. Each day you start with a fresh score. Your review history is stored and never deleted — turning off the prompts does not clear your history.
            </p>
            <p className="text-[11px] text-white/70 leading-relaxed font-mono">
              The "Run Market Preflight" button is available on the Dashboard, Market Signals, Watchlist, Portfolio Monitor, Pressure Simulator, Daily Market Briefing, and this page. You can also access it at any time from <span className="text-emerald-400">Profile → Account Preferences → Market Preflight Prompts</span>.
            </p>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">What the Score Measures</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono">
              The score measures <span className="text-white/90">platform usage and risk-review behaviour</span> — specifically, how many of the available context sections you have reviewed today. A higher score means you have reviewed more of the available FAULTLINE risk picture before acting.
            </p>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">What the Score Does Not Measure</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <div className="space-y-1.5">
              {[
                "It does not measure the quality of your investment decisions.",
                "It does not predict market outcomes or investment results.",
                "It does not reduce risk or guarantee better performance.",
                "It does not reflect your knowledge, experience, or skill.",
                "It is not a trading signal or recommendation to act.",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
                  <span className="text-[10px] font-mono text-white/30 shrink-0 mt-0.5">—</span>
                  <span className="text-[10px] font-mono text-white/60">{ item }</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Preference Controls</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              You can control how prominently Market Preflight surfaces itself from <span className="text-emerald-400">Profile → Account Preferences → Market Preflight Prompts</span>.
            </p>
            <div className="space-y-2">
              {[
                { mode: "Full Guidance", desc: "Shows the full dashboard card, missing checks list, checklist CTA, and page-level triggers on all relevant pages." },
                { mode: "Minimal Reminders", desc: "Shows only a compact score ring and \"Run Market Preflight\" button. No missing-checks list or detailed prompts." },
                { mode: "Off", desc: "Hides all page-level prompts and the dashboard card. The feature remains accessible from this page and from Profile. Tracking history is preserved." },
              ].map(({ mode, desc }) => (
                <div key={mode} className="p-2.5 border border-white/8 bg-white/3 rounded-sm">
                  <p className="text-[10px] font-mono text-emerald-400 font-bold mb-1">{ mode }</p>
                  <p className="text-[10px] font-mono text-white/50 leading-relaxed">{ desc }</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Timeframe Awareness</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              A single reading shows current conditions. <span className="text-white/90">Timeframe Awareness</span> helps users understand whether market pressure is temporary, building, or becoming structural.
            </p>
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              The Market Preflight modal includes a <span className="text-emerald-400">Timeframes</span> tab that shows the current FAULTLINE reading across Today, This Week, This Month, and This Year. For each timeframe it shows: what changed, whether pressure is improving, stable, or deteriorating, the main driver, the most supported scenario, and what to watch next.
            </p>
            <p className="text-[11px] text-white/70 leading-relaxed font-mono">
              Timeframe readings are not predictions. They reflect historical FAULTLINE platform data only. Past readings do not indicate future market conditions.
            </p>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Reading History</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-3">
              <span className="text-white/90">Reading History</span> is a dedicated page (<span className="text-emerald-400">Market Stress → Reading History</span>) that shows daily FAULTLINE snapshots across all four timeframes. It also includes the <span className="text-white/90">Outcome Support Engine</span> — a view of how current readings align with four possible market scenarios.
            </p>
            <div className="space-y-1.5">
              {[
                { tab: "Today", desc: "Current score, stress level, main driver, and scenario support." },
                { tab: "Week", desc: "7-day view. Whether pressure has moved up, down, or held steady." },
                { tab: "Month", desc: "30-day view. Useful for identifying temporary vs. structural pressure." },
                { tab: "Year", desc: "365-day view. Regime changes, peak stress periods, and yearly trajectory." },
                { tab: "Outcomes", desc: "Live Outcome Support Engine: how current readings align with four possible scenarios." },
              ].map(({ tab, desc }) => (
                <div key={tab} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
                  <span className="text-[10px] font-mono text-emerald-400 w-16 shrink-0 mt-0.5">{tab}</span>
                  <span className="text-[10px] font-mono text-white/60">{desc}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">Run Market Preflight</h3>
          <Panel accentColor="rgba(0,255,136,0.15)">
            <p className="text-[11px] text-white/70 leading-relaxed font-mono mb-4">
              Click the button below to open the Market Preflight panel and review the current FAULTLINE risk picture.
            </p>
            <PreflightTrigger
              currentPage="guide"
              actionKey="viewed_guide"
            />
          </Panel>
        </div>

        <Panel accentColor="rgba(255,149,0,0.2)">
          <p className="text-[10px] font-mono text-white/40 leading-relaxed">
            <span className="text-amber-400/70 font-bold">Disclaimer: </span>
            Market Preflight reflects platform usage and risk-review behavior only. It does not predict investment results, reduce risk, or provide personalized financial advice.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "glossary",
    icon: Layers,
    title: "Glossary",
    subtitle: "Key terms and concepts used throughout FAULTLINE",
    color: "#6B7280",
    content: (
      <div className="space-y-1">
        {[
          { term: "Basis Points (bps)", def: "1/100th of a percentage point. 100bps = 1%. Used for yield and spread changes." },
          { term: "Credit Spread", def: "The yield difference between a risky bond (e.g. high yield) and a risk-free bond (e.g. Treasury). Wider spread = more credit risk priced in." },
          { term: "HY Spread (OAS)", def: "Option-Adjusted Spread on high yield bonds. The primary credit risk barometer. Normal: 300–400bps. Stressed: 500–700bps. Crisis: 800bps+." },
          { term: "Yield Curve", def: "The relationship between Treasury yields at different maturities. Normal: long rates > short rates. Inverted: short rates > long rates — historically a recession predictor." },
          { term: "SOFR", def: "Secured Overnight Financing Rate. The benchmark short-term interest rate that replaced LIBOR. Elevated SOFR indicates tight overnight funding conditions." },
          { term: "NFCI", def: "National Financial Conditions Index (Chicago Fed). A composite of 105 financial conditions measures. Positive = tighter than historical average; negative = looser." },
          { term: "Regime", def: "A persistent macro environment characterised by a specific combination of growth, inflation, and financial conditions. FAULTLINE identifies regimes like 'Late Cycle Stress', 'Expansion', 'Stagflation', and 'Crisis Mode'." },
          { term: "Systemic Risk", def: "The risk that stress in one part of the financial system cascades and destabilises the entire system. FAULTLINE's core mission is to detect and quantify systemic risk before it becomes visible in headlines." },
          { term: "Contagion", def: "The spread of financial stress from one market, institution, or asset class to others. The Pressure tab's Contagion Cascade visualises which risk vectors are simultaneously stressed." },
          { term: "Regime Fit", def: "A 0–10 score on the Stock Intelligence Card indicating how well a specific ticker's characteristics align with the current macro regime. High fit = the stock is well-positioned for the current environment." },
          { term: "VIX", def: "The CBOE Volatility Index. Measures expected 30-day volatility of the S&P 500 based on options pricing. Often called the 'fear gauge'. Normal: 15–20. Elevated: 25–35. Crisis: 40+." },
          { term: "Duration", def: "A bond's sensitivity to interest rate changes. High-duration assets (long bonds, growth stocks) fall more in value when rates rise. Low-duration assets are less sensitive." },
          { term: "OAS", def: "Option-Adjusted Spread. A spread measure that removes the value of any embedded options (like call provisions) from a bond's yield spread, giving a cleaner credit risk signal." },
          { term: "Capex", def: "Capital Expenditure. Cash spent by a company on acquiring or maintaining fixed assets. In the AI context, refers to spending on data centres, chips, and infrastructure." },
        ].map(({ term, def }) => (
          <FieldRow key={term} label={term} value={def} />
        ))}
      </div>
    ),
  },
];

// ─── Main Guide Component ─────────────────────────────────────────────────────

export default function Guide() {
  useSEO(PAGE_SEO.guide);
  const [activeId, setActiveId] = useState<string>("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? SECTIONS.filter(s => {
        const q = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.subtitle.toLowerCase().includes(q) ||
          (s.keywords ?? []).some(kw => kw.toLowerCase().includes(q))
        );
      })
    : SECTIONS;

  const activeSection = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];

  return (
    <div className="min-h-screen bg-[#020408] text-white font-mono"
      style={{ backgroundImage: "radial-gradient(ellipse at 20% 20%, rgba(0,212,255,0.03) 0%, transparent 60%)" }}>

      <PageHeader
        title="How to Use FAULTLINE"
        subtitle="Complete feature documentation — learn what each score means, how the engine works, and how to read the signals."
        badge="GUIDE"
        badgeColor="gray"
        rightSlot={
          <PreflightTrigger
            currentPage="guide"
            actionKey="viewed_guide"
          />
        }
      />

      <div className="flex h-[calc(100vh-120px)]">
        {/* Sidebar nav */}
        <div className="w-52 shrink-0 border-r border-white/10 overflow-y-auto bg-black/20">
          {/* Search */}
          <div className="p-2 border-b border-white/10">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 py-1.5 rounded-sm">
              <Search className="w-3 h-3 text-white/30 shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-[10px] text-white/70 placeholder-white/25 outline-none w-full"
              />
            </div>
          </div>
          {/* Nav items */}
          <div className="py-1">
            {filtered.map(section => {
              const Icon = section.icon;
              const isActive = section.id === activeId;
              return (
                <button
                  key={section.id}
                  onClick={() => { setActiveId(section.id); setSearchQuery(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 hover:bg-white/5"
                  style={{
                    background: isActive ? `${section.color}15` : undefined,
                    borderLeft: isActive ? `2px solid ${section.color}` : "2px solid transparent",
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? section.color : "rgba(255,255,255,0.4)" }} />
                  <span className="text-[10px] tracking-wide truncate" style={{ color: isActive ? "white" : "rgba(255,255,255,0.5)" }}>
                    {section.title}
                  </span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" style={{ color: section.color }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="p-5 max-w-3xl"
            >
              {/* Section header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const Icon = activeSection.icon;
                    return <Icon className="w-4 h-4" style={{ color: activeSection.color }} />;
                  })()}
                  <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: activeSection.color }}>
                    {activeSection.title}
                  </h2>
                </div>
                <p className="text-[10px] text-white/40 tracking-wide ml-6">{activeSection.subtitle}</p>
                <div className="mt-3 h-px" style={{ background: `linear-gradient(90deg, ${activeSection.color}60, transparent)` }} />
              </div>

              {/* Section content */}
              {activeSection.content}

              {/* Navigation footer */}
              <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                {(() => {
                  const idx = SECTIONS.findIndex(s => s.id === activeSection.id);
                  const prev = SECTIONS[idx - 1];
                  const next = SECTIONS[idx + 1];
                  return (
                    <>
                      {prev ? (
                        <button onClick={() => setActiveId(prev.id)}
                          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                          <ChevronDown className="w-3 h-3 rotate-90" />
                          {prev.title}
                        </button>
                      ) : <div />}
                      {next ? (
                        <button onClick={() => setActiveId(next.id)}
                          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                          {next.title}
                          <ChevronDown className="w-3 h-3 -rotate-90" />
                        </button>
                      ) : <div />}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
