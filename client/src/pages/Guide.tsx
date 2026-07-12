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
  Target, Eye, Layers, Info, ArrowRight, Command, BarChart3,
  Bitcoin, Users, TrendingDown, RotateCcw, Sparkles, Telescope,
  Crosshair, Briefcase, Newspaper, GitBranch, Map,
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

  // ─── MARKET OPERATING SYSTEM ─────────────────────────────────────────────
  {
    id: "market-os",
    icon: GitBranch,
    title: "Market Operating System",
    subtitle: "How every engine connects to the Seismograph — the single source of truth",
    color: "#00D4FF",
    keywords: ["architecture", "seismograph core", "evidence", "market os", "intelligence layer", "unified"],
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            FAULTLINE is built as a <span className="text-cyan-400 font-bold">Market Operating System</span> — not a collection of independent dashboards. Every engine in the platform contributes evidence to a single central intelligence layer: the <span className="text-cyan-400">FAULTLINE Seismograph™</span>. The Seismograph synthesises all evidence into one continuously evolving market understanding and distributes that intelligence to every user-facing surface.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Evidence Contributors → Seismograph</p>
          <div className="space-y-1">
            {[
              { name: "Pressure Index", role: "Measures systemic financial stress across 6 risk vectors. Feeds a weighted evidence packet to the Seismograph every cycle." },
              { name: "Regime Engine (FMOS)", role: "Classifies the current macro regime and transition probabilities. Feeds regime label, confidence, and transition risk." },
              { name: "Risk Vector Engine", role: "Identifies causal risk factors driving the current environment. Feeds causation evidence." },
              { name: "Historical Analog Engine", role: "Matches the current environment to historical crisis eras. Feeds the best-match analog and similarity score." },
              { name: "Aftershock Engine", role: "Analyses post-transition market behaviour. Feeds recovery and continuation patterns." },
              { name: "Cross-Market Intelligence", role: "Monitors correlations and divergences across equities, bonds, crypto, and commodities." },
              { name: "SOB Framework", role: "Signals of Breakdown — tracks accumulation of stress across 6 independent pillars." },
            ].map(({ name, role }) => (
              <Panel key={name} className="!p-3">
                <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
                <p className="text-[10px] text-white/50 leading-relaxed">{role}</p>
              </Panel>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Seismograph → Consumer Surfaces</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "Dashboard", desc: "Receives the Seismograph Narrative Banner — current state, drivers, duration, analog, and what to watch." },
              { name: "ASHA (Ask FAULTLINE)", desc: "Receives the full forASHA context block — evidence consensus, probabilities, analog, and transition risk — before generating every response." },
              { name: "Daily Brief", desc: "Generated directly from the Seismograph's forDailyBrief context — direction, probabilities, analog, and key developments." },
              { name: "Signal Intelligence", desc: "Injects Seismograph evidence consensus and analog into every symbol interpretation prompt." },
              { name: "Stock & Crypto Pages", desc: "Consume the Seismograph's macro assessment, probabilities, and historical analogs rather than generating separate macro conclusions." },
              { name: "Alerts", desc: "Seismograph transition risk and regime change evidence trigger alert conditions." },
            ].map(({ name, desc }) => (
              <Panel key={name} className="!p-3" accentColor="rgba(0,212,255,0.2)">
                <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
                <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>
        <Panel accentColor="rgba(255,200,0,0.2)">
          <p className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            <span className="text-yellow-400 font-bold">PRINCIPLE</span> — No engine independently determines market state, probabilities, or user-facing conclusions. Every engine contributes evidence. The Seismograph synthesises. All consumer surfaces read from one canonical output.
          </p>
        </Panel>
      </div>
    ),
  },
  // ─── SEISMOGRAPH INTELLIGENCE ─────────────────────────────────────────────
  {
    id: "seismograph",
    icon: Activity,
    title: "Seismograph Intelligence",
    subtitle: "The central intelligence layer — pattern recognition, market memory, and regime transitions",
    color: "#A78BFA",
    keywords: ["seismograph", "market memory", "pattern", "analog", "regime transition", "evidence", "probability"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(167,139,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-purple-400 font-bold">FAULTLINE Seismograph™</span> is the central intelligence layer of the platform. It continuously collects evidence from every engine, detects recurring market patterns, matches the current environment to historical analogs, calculates regime transition probabilities, and maintains a persistent Market Memory of how conditions have evolved over time.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Core Capabilities</p>
          <div className="space-y-1">
            {[
              { name: "Evidence Assembly", desc: "Collects evidence packets from all contributing engines — Pressure, Regime, Risk Vectors, Analogs, Aftershock, Cross-Market, and SOB — and weighs them by confidence and recency to produce a single synthesised market assessment." },
              { name: "Pattern Recognition", desc: "Identifies recurring market patterns in the evidence stream: Pressure Buildup, Regime Transition, Liquidity Squeeze, Credit Contagion, Volatility Spike, and Breadth Collapse. Each pattern is tracked with duration, intensity, and historical frequency." },
              { name: "Historical Analog Matching", desc: "Matches the current evidence profile to historical crisis eras using multi-dimensional similarity scoring. Shows the best-match analog, similarity percentage, what happened next, and where the current period diverges." },
              { name: "Regime Transition Probabilities", desc: "Calculates the probability of transitioning to Bull, Soft Landing, Stagflation, Recession, or Crisis within the next 30–90 days, based on the current evidence consensus and historical transition rates from similar environments." },
              { name: "Market Memory", desc: "Maintains a persistent daily record of Seismograph readings, pattern detections, and regime states. Shows how long the current conditions have been developing and how they compare to the historical distribution." },
            ].map(({ name, desc }) => (
              <Panel key={name} className="!p-3">
                <p className="text-[11px] font-mono text-purple-400 font-bold mb-1">{name}</p>
                <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Seismograph Page Sections</p>
          <div className="space-y-1">
            {[
              { name: "Current State", desc: "The synthesised market direction (Bullish / Cautious / Bearish / Crisis), evidence consensus score, dominant regime, and active analog." },
              { name: "Pattern Timeline", desc: "A chronological view of all detected patterns with their start date, duration, intensity, and current status (active / resolved)." },
              { name: "Regime Matrix", desc: "A probability matrix showing the current regime and the likelihood of transitioning to each alternative regime within 30, 60, and 90 days." },
              { name: "Analog Matches", desc: "The top 3 historical analog matches with similarity scores, divergence indicators, and outcome context." },
              { name: "Market Memory Feed", desc: "A daily log of Seismograph readings showing how the evidence consensus, direction, and pattern activity have evolved over time." },
              { name: "Generate Today's Reading", desc: "If no reading exists for today, click this button to run the full pipeline on demand and populate the Seismograph immediately." },
            ].map(({ name, desc }) => (
              <Panel key={name} className="!p-3" accentColor="rgba(167,139,250,0.2)">
                <p className="text-[11px] font-mono text-purple-400 font-bold mb-1">{name}</p>
                <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  // ─── INTELLIGENCE HUB ────────────────────────────────────────────────────
  {
    id: "intelligence-hub",
    icon: Brain,
    title: "Intelligence Hub",
    subtitle: "The unified entry point for all market intelligence",
    color: "#00D4FF",
    keywords: ["intelligence hub", "overview", "entry point", "summary", "hub"],
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-cyan-400 font-bold">Intelligence Hub</span> is the unified entry point for the FAULTLINE platform. It surfaces the most important intelligence from across all engines in a single view — current regime, Seismograph state, top signals, active alerts, and the daily brief — so you can orient quickly before diving into any specific section.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Market State Summary", desc: "The current Seismograph direction, regime label, pressure score, and evidence consensus — the four numbers that define the current environment." },
            { name: "Active Alerts", desc: "Any alerts that have triggered since your last visit, surfaced immediately so nothing is missed." },
            { name: "Top Signals", desc: "The highest-scoring signal opportunities given the current regime, updated automatically." },
            { name: "Daily Brief Preview", desc: "A condensed version of the latest Daily Briefing — the most important developments in two to three sentences." },
            { name: "Quick Navigation", desc: "Direct links to the most relevant sections based on the current market state — the platform guides you to what matters most right now." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── COMMAND CENTER ──────────────────────────────────────────────────────
  {
    id: "command-center",
    icon: Command,
    title: "Command Center",
    subtitle: "Real-time macro command view — all critical indicators in one screen",
    color: "#00D4FF",
    keywords: ["command", "command center", "macro", "live", "real-time", "indicators"],
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-cyan-400 font-bold">Command Center</span> is a dense, real-time macro overview designed for users who want all critical indicators visible simultaneously without navigating between sections. It is the operator's view of the market — everything important on one screen.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Live Ticker Strip", desc: "A scrolling marquee showing real-time values for 10Y yield, HY spread, VIX, DXY, BTC dominance, Fed cut probability, market breadth, and Fear & Greed Index." },
            { name: "Regime & Pressure Panel", desc: "Current regime label, pressure score, and probability distribution — the three core outputs of the FMOS pipeline." },
            { name: "Risk Domain Grid", desc: "All 6 risk domains displayed simultaneously with colour-coded severity and trend direction." },
            { name: "Cross-Market Snapshot", desc: "Key readings across equities, bonds, crypto, and commodities — showing whether markets are moving in concert or diverging." },
            { name: "Alert Status", desc: "Active alert count and the most recently triggered alert condition." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── TODAY'S STORY ───────────────────────────────────────────────────────
  {
    id: "todays-story",
    icon: Newspaper,
    title: "Today's Story",
    subtitle: "The narrative behind today's market — what happened, why, and what it means",
    color: "#F59E0B",
    keywords: ["today's story", "narrative", "daily", "story", "what happened", "why"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(245,158,11,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-amber-400 font-bold">Today's Story</span> translates the day's market data into a clear, readable narrative. Rather than presenting raw numbers, it explains what happened in the market today, what was driving it, how it connects to the current regime, and what to watch next. It is written in institutional language, not financial media hype.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "The Headline", desc: "A single sentence capturing the most important development of the day — the thing that matters most given the current regime." },
            { name: "What Happened", desc: "A factual summary of the key market moves: which assets moved, by how much, and in what direction." },
            { name: "Why It Happened", desc: "The causal explanation — which macro forces, data releases, or regime dynamics drove today's moves." },
            { name: "How Long It Has Been Developing", desc: "Context on whether today's move is a new development or the continuation of a trend that has been building for days, weeks, or months." },
            { name: "What to Watch Next", desc: "The two or three indicators or events that will determine whether today's conditions continue, reverse, or escalate." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-amber-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── SIGNAL OUTLOOK ──────────────────────────────────────────────────────
  {
    id: "signal-outlook",
    icon: Eye,
    title: "Signal Outlook",
    subtitle: "Forward-looking signal assessment — what the current regime means for each signal type",
    color: "#34D399",
    keywords: ["signal outlook", "outlook", "forward", "regime fit", "signal type"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(52,211,153,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-emerald-400 font-bold">Signal Outlook</span> answers the question: given the current macro regime and Seismograph state, which types of signals have the highest historical follow-through? It maps the current environment to signal categories and shows which strategies are most aligned with the prevailing conditions.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Regime-Signal Alignment", desc: "For each signal category (momentum, mean reversion, breakout, defensive, speculative), Signal Outlook shows how well that category has historically performed in the current regime." },
            { name: "Seismograph Context", desc: "The Seismograph's current evidence consensus and transition probability are injected into every outlook interpretation — so the assessment reflects not just the regime label but the full evidence picture." },
            { name: "Historical Follow-Through Rates", desc: "For the current regime, shows the historical percentage of signals in each category that resulted in positive outcomes over 5, 10, and 20 trading days." },
            { name: "What to Avoid", desc: "Explicitly flags which signal types have historically underperformed in the current environment — helping users avoid strategies that are misaligned with prevailing conditions." },
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
  // ─── SOCIAL INTELLIGENCE ─────────────────────────────────────────────────
  {
    id: "social-intel",
    icon: Users,
    title: "Social Intelligence",
    subtitle: "Market sentiment from social media and crowd behaviour analysis",
    color: "#60A5FA",
    keywords: ["social", "sentiment", "twitter", "x", "crowd", "social intelligence", "social media"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(96,165,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-blue-400 font-bold">Social Intelligence</span> monitors crowd sentiment and social media activity to identify when retail sentiment is diverging from or confirming institutional signals. It is a contrarian and confirmation tool — not a primary signal source.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Sentiment Tracking", desc: "Monitors social media sentiment across key tickers and macro topics. Identifies when crowd sentiment is at extremes — historically a contrarian indicator." },
            { name: "Trend Detection", desc: "Surfaces emerging topics and tickers gaining unusual social attention before they appear in mainstream financial media." },
            { name: "Regime Context", desc: "Social sentiment readings are interpreted in the context of the current Seismograph state — extreme bullish sentiment in a high-pressure regime is a different signal than the same reading in an expansion regime." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-blue-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
        <Panel accentColor="rgba(255,200,0,0.2)">
          <p className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            <span className="text-yellow-400 font-bold">NOTE</span> — Social sentiment is one input among many. It is most useful as a contrarian indicator at extremes and as a confirmation tool when aligned with institutional signals. Never use social sentiment as a standalone signal.
          </p>
        </Panel>
      </div>
    ),
  },
  // ─── INSIDER INTELLIGENCE ────────────────────────────────────────────────
  {
    id: "insider-intel",
    icon: TrendingDown,
    title: "Insider Intelligence",
    subtitle: "Institutional and insider activity — who is buying and selling",
    color: "#F87171",
    keywords: ["insider", "institutional", "buying", "selling", "insider intelligence", "smart money"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(248,113,113,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-red-400 font-bold">Insider Intelligence</span> tracks reported insider transactions and institutional positioning changes to identify when smart money is accumulating or distributing. It is a confirmation and divergence tool — most powerful when insider activity diverges from price action.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Insider Transaction Tracking", desc: "Monitors SEC Form 4 filings for significant insider buys and sells across key tickers. Flags clusters of insider activity that historically precede price moves." },
            { name: "Institutional Flow Analysis", desc: "Tracks changes in institutional ownership and positioning. Large increases or decreases in institutional ownership relative to the prior quarter are flagged." },
            { name: "Regime Context", desc: "Insider activity is interpreted in the context of the current macro regime. Insider buying during a high-pressure regime is a stronger contrarian signal than the same activity during an expansion." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-red-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── SECTOR ROTATION ─────────────────────────────────────────────────────
  {
    id: "sector-rotation",
    icon: RotateCcw,
    title: "Sector Rotation",
    subtitle: "Which sectors are leading, lagging, and rotating — and why",
    color: "#A78BFA",
    keywords: ["sector", "rotation", "sector rotation", "leading", "lagging", "cyclical", "defensive"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(167,139,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-purple-400 font-bold">Sector Rotation</span> maps the current macro regime to the historical sector rotation model — showing which sectors typically lead and lag in the current environment, and whether current sector performance is confirming or diverging from the expected pattern.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Regime-Sector Alignment", desc: "For the current regime, shows which sectors have historically outperformed and underperformed. Compares historical expectations to current relative performance." },
            { name: "Rotation Signals", desc: "Identifies when money is actively rotating between sectors — a leading indicator of regime transitions. Unusual rotation patterns are flagged with historical context." },
            { name: "Defensive vs Cyclical Balance", desc: "Tracks the ratio of defensive sector performance (utilities, healthcare, consumer staples) to cyclical performance (technology, consumer discretionary, industrials) as a regime health indicator." },
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
  // ─── CRYPTO HUB ──────────────────────────────────────────────────────────
  {
    id: "crypto-hub",
    icon: Bitcoin,
    title: "Crypto Hub",
    subtitle: "Crypto market intelligence — macro context, dominance, and regime alignment",
    color: "#F59E0B",
    keywords: ["crypto", "bitcoin", "ethereum", "crypto hub", "dominance", "altcoin", "defi"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(245,158,11,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-amber-400 font-bold">Crypto Hub</span> provides macro-contextualised crypto market intelligence. Unlike standalone crypto dashboards, every reading in the Crypto Hub is interpreted through the lens of the current Seismograph state and macro regime — because crypto does not exist in isolation from the broader financial system.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "BTC Dominance", desc: "Bitcoin's share of total crypto market capitalisation. Rising dominance = risk-off within crypto (capital consolidating into BTC). Falling dominance = risk-on (capital rotating into altcoins)." },
            { name: "Crypto Regime Alignment", desc: "Shows how the current crypto market conditions align with the macro regime. In a high-pressure macro environment, crypto typically behaves as a risk asset — this section makes that relationship explicit." },
            { name: "Altcoin Season Indicator", desc: "Tracks whether altcoins are outperforming Bitcoin — a classic signal of speculative excess or risk appetite in the crypto market." },
            { name: "Macro-Crypto Correlation", desc: "Shows the rolling correlation between crypto and equities, bonds, and the dollar. High correlation = crypto is trading as a macro risk asset. Low correlation = crypto is trading on its own dynamics." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-amber-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── CRYPTO REGIME ───────────────────────────────────────────────────────
  {
    id: "crypto-regime",
    icon: Bitcoin,
    title: "Crypto Regime",
    subtitle: "The macro regime as it applies specifically to crypto markets",
    color: "#F59E0B",
    keywords: ["crypto regime", "bitcoin regime", "crypto macro", "crypto environment"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(245,158,11,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-amber-400 font-bold">Crypto Regime</span> applies the FAULTLINE regime framework specifically to crypto markets. It classifies the current crypto market environment — Accumulation, Expansion, Distribution, or Contraction — and maps it to the broader macro regime to show whether the two are aligned or diverging.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Crypto Regime Classification", desc: "Accumulation (smart money building positions quietly), Expansion (broad participation, rising prices), Distribution (smart money selling into strength), or Contraction (declining participation, falling prices)." },
            { name: "Macro Alignment Score", desc: "How well the current crypto regime aligns with the macro regime. Misalignment — for example, crypto in Expansion while macro is in Late Cycle Stress — is historically a warning sign." },
            { name: "Regime Transition Signals", desc: "Early indicators of a crypto regime transition, drawn from on-chain data, dominance shifts, and correlation changes." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-amber-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── MARKET INTELLIGENCE (REGIMES) ───────────────────────────────────────
  {
    id: "market-intelligence",
    icon: BarChart3,
    title: "Market Intelligence",
    subtitle: "Regime classification, probability distributions, and macro scenario analysis",
    color: "#00D4FF",
    keywords: ["market intelligence", "regime", "probability", "scenario", "FMOS", "macro regime"],
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-cyan-400 font-bold">Market Intelligence</span> is the regime analysis layer of FAULTLINE. It shows the current macro regime classification, the probability distribution across all possible regimes, and the historical context for the current environment — answering the question: what kind of market are we in, and how likely is it to change?
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Regime Classification", desc: "The current macro regime label (e.g. Late Cycle Stress, Expansion, Stagflation, Crisis Mode) with a confidence score and the key evidence supporting the classification." },
            { name: "Probability Distribution", desc: "The probability of being in each of the five possible regimes — Bull, Soft Landing, Stagflation, Recession, and Crash — expressed as percentages that sum to 100." },
            { name: "Transition Risk", desc: "The probability of transitioning to a different regime within the next 30, 60, and 90 days, based on the current evidence and historical transition rates." },
            { name: "Regime History", desc: "A timeline showing how the regime classification has evolved over the past 12 months — useful for understanding whether the current regime is new or well-established." },
            { name: "Scenario Analysis", desc: "For each possible regime transition, shows the historical market outcomes — what typically happens to equities, bonds, and crypto in each scenario." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── OPPORTUNITIES ───────────────────────────────────────────────────────
  {
    id: "opportunities",
    icon: Sparkles,
    title: "Opportunities",
    subtitle: "Regime-aligned opportunities — what the current environment favours",
    color: "#34D399",
    keywords: ["opportunities", "regime opportunities", "what to buy", "what to avoid", "regime aligned"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(52,211,153,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-emerald-400 font-bold">Opportunities</span> surfaces asset classes, sectors, and strategies that have historically performed well in the current macro regime. It is not a buy list — it is a regime-aligned awareness tool that helps users understand which types of opportunities are most supported by the current environment.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Regime-Favoured Asset Classes", desc: "Which asset classes (equities, bonds, commodities, cash, crypto) have historically outperformed in the current regime, with historical return data." },
            { name: "Sector Opportunities", desc: "Which sectors are most aligned with the current regime based on historical sector rotation patterns." },
            { name: "Strategy Alignment", desc: "Which investment strategies (momentum, value, defensive, speculative) have the highest historical success rate in the current environment." },
            { name: "What to Avoid", desc: "Asset classes, sectors, and strategies that have historically underperformed in the current regime — equally important as what to favour." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-emerald-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
        <Panel accentColor="rgba(255,200,0,0.2)">
          <p className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            <span className="text-yellow-400 font-bold">DISCLAIMER</span> — Opportunities are based on historical regime patterns. Past performance in a given regime does not guarantee future results. This is not investment advice.
          </p>
        </Panel>
      </div>
    ),
  },
  // ─── SYMBOL INTELLIGENCE ─────────────────────────────────────────────────
  {
    id: "symbol-intelligence",
    icon: Telescope,
    title: "Symbol Intelligence",
    subtitle: "Deep macro-contextualised analysis for any stock or crypto ticker",
    color: "#60A5FA",
    keywords: ["symbol", "ticker", "stock", "crypto", "symbol intelligence", "stock analysis", "macro context"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(96,165,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-blue-400 font-bold">Symbol Intelligence</span> provides deep, macro-contextualised analysis for any stock or crypto ticker. Unlike standalone stock screeners, every analysis in Symbol Intelligence is grounded in the current Seismograph state — so you understand not just what a ticker is doing, but whether the macro environment supports or undermines it.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Regime Fit Score", desc: "A 0–10 score indicating how well the ticker's characteristics align with the current macro regime. High fit = the ticker is well-positioned for the current environment." },
            { name: "Seismograph Context", desc: "The Seismograph's evidence consensus, active analog, and transition probability are injected into every ticker analysis — so the assessment reflects the full macro picture." },
            { name: "Risk Vector Exposure", desc: "Which of the 6 FAULTLINE risk vectors (Liquidity, Credit, Volatility, Macro, Breadth, AI Bubble) the ticker is most exposed to given its sector, size, and characteristics." },
            { name: "Historical Regime Performance", desc: "How the ticker has historically performed in the current regime type — based on available historical data." },
            { name: "AI Interpretation", desc: "An AI-generated narrative explaining the ticker's current macro positioning, key risks, and what the Seismograph's assessment means for this specific asset." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-blue-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── DECISION ENGINE ─────────────────────────────────────────────────────
  {
    id: "decision-engine",
    icon: Crosshair,
    title: "Decision Engine",
    subtitle: "Structured decision support — before you act, check the engine",
    color: "#F87171",
    keywords: ["decision", "decision engine", "before acting", "structured decision", "risk check"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(248,113,113,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-red-400 font-bold">Decision Engine</span> is a structured pre-decision framework. Before acting on any signal or opportunity, the Decision Engine checks the current macro regime, Seismograph state, and risk vectors against the proposed action — and surfaces any conflicts, risks, or alignment issues.
          </p>
        </Panel>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">How to Use</p>
          <div className="space-y-2">
            <StepCard num={1} title="Enter your proposed action" desc="Describe what you are considering — buying, selling, or holding a specific asset or position." />
            <StepCard num={2} title="Engine checks the macro context" desc="The Decision Engine evaluates your proposed action against the current regime, Seismograph state, risk vectors, and active alerts." />
            <StepCard num={3} title="Review the assessment" desc="The engine surfaces any conflicts (e.g. buying a high-beta growth stock in a Late Cycle Stress regime), alignment signals, and key risks to consider." />
            <StepCard num={4} title="Make an informed decision" desc="The engine does not tell you what to do — it ensures you have considered the full macro context before acting." />
          </div>
        </div>
        <Panel accentColor="rgba(255,200,0,0.2)">
          <p className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            <span className="text-yellow-400 font-bold">NOTE</span> — The Decision Engine is a structured awareness tool. It does not provide investment advice or guarantee outcomes. All decisions remain the user's responsibility.
          </p>
        </Panel>
      </div>
    ),
  },
  // ─── DAY TRADE INTELLIGENCE ──────────────────────────────────────────────
  {
    id: "day-trade",
    icon: Target,
    title: "Day Trade Intelligence",
    subtitle: "Intraday macro context for active traders",
    color: "#F59E0B",
    keywords: ["day trade", "intraday", "active trading", "day trading", "short term"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(245,158,11,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-amber-400 font-bold">Day Trade Intelligence</span> provides intraday macro context for active traders. It surfaces the key macro factors that are most likely to drive intraday volatility on any given day — so traders understand the macro backdrop before entering positions.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Today's Macro Catalysts", desc: "Economic data releases, Fed communications, and other macro events scheduled for today that could drive intraday volatility." },
            { name: "Regime Volatility Profile", desc: "How the current macro regime typically affects intraday volatility — whether to expect trending or mean-reverting conditions." },
            { name: "Risk-On / Risk-Off Bias", desc: "The current macro bias — whether the environment favours risk-on (buy dips, momentum) or risk-off (sell rallies, defensive) intraday strategies." },
            { name: "Key Levels to Watch", desc: "Critical technical and macro levels that, if breached, would change the intraday macro narrative." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-amber-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── PORTFOLIO ───────────────────────────────────────────────────────────
  {
    id: "portfolio",
    icon: Briefcase,
    title: "Portfolio",
    subtitle: "Track your positions and see how the macro regime affects your portfolio",
    color: "#34D399",
    keywords: ["portfolio", "positions", "holdings", "track", "portfolio tracker"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(52,211,153,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-emerald-400 font-bold">Portfolio</span> section lets you track your positions and see how the current macro regime and Seismograph state affect your overall portfolio exposure. It is a macro-contextualised portfolio awareness tool — not a brokerage or trading platform.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Position Tracking", desc: "Add your holdings manually. The platform tracks each position's current price, gain/loss, and regime fit score." },
            { name: "Macro Exposure Analysis", desc: "Shows your portfolio's aggregate exposure to each of the 6 FAULTLINE risk vectors — so you can see at a glance whether your portfolio is concentrated in areas of elevated macro risk." },
            { name: "Regime Alignment Score", desc: "An overall score showing how well your current portfolio is aligned with the current macro regime, based on the regime fit scores of your individual positions." },
            { name: "Risk Concentration Alerts", desc: "Flags if your portfolio has excessive concentration in a single risk vector or sector given the current macro environment." },
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
  // ─── TRADE JOURNAL ───────────────────────────────────────────────────────
  {
    id: "trade-journal",
    icon: BookOpen,
    title: "Trade Journal",
    subtitle: "Log your trades with macro context — learn from every decision",
    color: "#60A5FA",
    keywords: ["trade journal", "journal", "log", "trades", "review", "learn"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(96,165,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-blue-400 font-bold">Trade Journal</span> lets you log every trade with the macro context that existed at the time — regime, pressure score, Seismograph state, and active alerts. Over time, it builds a record of your decisions and the macro environment they were made in, helping you identify patterns in your own decision-making.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Trade Logging", desc: "Log any trade — entry, exit, size, and notes — with the current FAULTLINE macro context automatically attached." },
            { name: "Macro Context Snapshot", desc: "Each journal entry automatically captures the regime, pressure score, Seismograph direction, and active alerts at the time of the trade." },
            { name: "Performance Review", desc: "Review your trade history filtered by regime — see which macro environments your decisions have performed best and worst in." },
            { name: "Decision Quality Analysis", desc: "Over time, the journal helps you identify whether your best trades were made with high Complete Market Awareness scores and whether poor trades correlated with low awareness." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-blue-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  // ─── ASK FAULTLINE (ASHA) ────────────────────────────────────────────────
  {
    id: "ask-faultline",
    icon: Brain,
    title: "Ask FAULTLINE (ASHA)",
    subtitle: "The AI intelligence interface — ask anything about the current market",
    color: "#A78BFA",
    keywords: ["ask faultline", "asha", "ai", "chat", "ask", "question", "intelligence"],
    content: (
      <div className="space-y-4">
        <Panel accentColor="rgba(167,139,250,0.3)">
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            <span className="text-purple-400 font-bold">ASHA</span> (Ask FAULTLINE) is the AI intelligence interface. Ask any question about the current market, a specific ticker, the current regime, historical analogs, or what the Seismograph is detecting — and ASHA will answer using the full context of the FAULTLINE platform, including the Seismograph's current evidence consensus.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "Seismograph-Grounded Responses", desc: "Every ASHA response is grounded in the Seismograph's current forASHA context block — evidence consensus, active analog, transition probability, and market direction. ASHA never answers in a macro vacuum." },
            { name: "What to Ask", desc: "What is the current macro regime and why? What does the Seismograph say about transition risk? Which sectors are most aligned with the current environment? What does the current analog suggest about the next 90 days?" },
            { name: "Ticker Analysis", desc: "Ask about any specific ticker — ASHA will analyse it in the context of the current regime, Seismograph state, and risk vectors." },
            { name: "Historical Context", desc: "Ask about historical analogs, past regimes, or how similar environments have resolved — ASHA has access to the full FAULTLINE historical knowledge base." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3">
              <p className="text-[11px] font-mono text-purple-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
        <Panel accentColor="rgba(255,200,0,0.2)">
          <p className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            <span className="text-yellow-400 font-bold">NOTE</span> — ASHA is an AI assistant grounded in FAULTLINE's analytical framework. It does not provide personalised financial advice. All responses are for informational and educational purposes only.
          </p>
        </Panel>
      </div>
    ),
  },
  // ─── NARRATIVE BANNER ────────────────────────────────────────────────────
  {
    id: "narrative-banner",
    icon: Map,
    title: "Seismograph Narrative Banner",
    subtitle: "The persistent context thread — what, why, how long, and what to watch",
    color: "#00D4FF",
    keywords: ["narrative banner", "context", "what is happening", "why", "how long", "what to watch", "banner"],
    content: (
      <div className="space-y-4">
        <Panel>
          <p className="text-[11px] text-white/70 leading-relaxed font-mono">
            The <span className="text-cyan-400 font-bold">Seismograph Narrative Banner</span> appears at the top of every major page in FAULTLINE. It is the cohesion thread of the platform — a collapsible panel that answers the seven most important understanding questions from the Seismograph's current output.
          </p>
        </Panel>
        <div className="space-y-1">
          {[
            { name: "What is happening", desc: "The current market direction and regime label in plain language." },
            { name: "Why it is happening", desc: "The dominant evidence drivers — which risk vectors and macro forces are most responsible for the current state." },
            { name: "How long it has been developing", desc: "The number of days the current conditions have been active, drawn from Market Memory." },
            { name: "Historical percentile", desc: "Where the current pressure score sits relative to the full historical distribution — e.g. 'higher than 78% of all days since 2000'." },
            { name: "Active analog", desc: "The historical era that most closely resembles the current environment, with similarity score." },
            { name: "Transition probability", desc: "The probability of a regime transition within the next 30 days." },
            { name: "What to watch next", desc: "The two or three indicators or events that will determine whether conditions continue, reverse, or escalate." },
          ].map(({ name, desc }) => (
            <Panel key={name} className="!p-3" accentColor="rgba(0,212,255,0.15)">
              <p className="text-[11px] font-mono text-cyan-400 font-bold mb-1">{name}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{desc}</p>
            </Panel>
          ))}
        </div>
        <Panel className="!p-3">
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            The banner is <span className="text-cyan-400">expanded by default on the Dashboard</span> and collapsed by default on all other pages. Click the banner header to expand or collapse it at any time.
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
