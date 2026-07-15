/* ============================================================
   MarketSynthesisPanel — "What does this mean?"
   Unified Market Intelligence System synthesis layer.
   Connects the current page's data to the market context.
   Answers: "So... what does all of this mean?"
   ============================================================ */
import { useLocation } from "wouter";
import { ArrowRight, Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";

export type SynthesisContext =
  | "pressure"        // Pressure Index / Market Stress page
  | "signals"         // Signals page
  | "signal-outlook"  // Signal Outlook page
  | "opportunities"   // Opportunities page
  | "dashboard"       // Dashboard
  | "daily-brief"     // Daily Briefing / Report
  | "diagnostic"      // AI Diagnostic
  | "crypto"          // Crypto Hub
  | "situation"       // Situation Room / Command Center
  | "portfolio"       // Portfolio page
  | "premarket";      // Premarket Intelligence

interface MarketSynthesisPanelProps {
  context: SynthesisContext;
  /** Optional extra insight specific to the page (e.g. "3 signals triggered today") */
  pageInsight?: string;
  /** Optional next step label override */
  nextStepLabel?: string;
  /** Optional next step path override */
  nextStepPath?: string;
}

function getSynthesis(
  context: SynthesisContext,
  riskLevel: string,
  regimeLabel: string,
  bullProb: number,
  crashProb: number,
  keyRisks: string[],
  pageInsight?: string,
): { headline: string; body: string; nextLabel: string; nextPath: string } {
  const isStressed = riskLevel === "high" || riskLevel === "critical";
  const isCalm = riskLevel === "low" || riskLevel === "moderate";
  const regime = regimeLabel;

  const syntheses: Record<SynthesisContext, { headline: string; body: string; nextLabel: string; nextPath: string }> = {
    pressure: {
      headline: isStressed
        ? `Elevated systemic pressure detected — ${regime}`
        : `Market stress is contained — ${regime}`,
      body: isStressed
        ? `The Pressure Index is signaling elevated systemic risk. ${pageInsight ? pageInsight + " " : ""}With ${crashProb}% crash probability and ${bullProb}% bull probability, the environment favors defensive positioning and smaller position sizes. Focus on quality and liquidity.`
        : `Current pressure readings are within manageable bounds. ${pageInsight ? pageInsight + " " : ""}With ${bullProb}% bull probability, the environment supports selective risk-taking. Look for high-conviction setups with strong catalyst support.`,
      nextLabel: "Find opportunities that fit this environment →",
      nextPath: "/app/opportunities",
    },
    signals: {
      headline: isStressed
        ? `Signals must be filtered through elevated market stress`
        : `Market conditions support signal follow-through`,
      body: isStressed
        ? `Current regime: ${regime}. ${pageInsight ? pageInsight + " " : ""}In elevated stress environments, signals with strong institutional backing and clear catalysts have higher follow-through rates. Avoid signals that rely on broad market momentum.`
        : `Current regime: ${regime}. ${pageInsight ? pageInsight + " " : ""}In this environment, momentum signals and breakout setups tend to perform well. Signals aligned with the dominant sector rotation have the highest probability of success.`,
      nextLabel: "See the full signal outlook →",
      nextPath: "/app/signal-outlook",
    },
    "signal-outlook": {
      headline: `${regime} — here is what the signal landscape means`,
      body: isStressed
        ? `Signal quality degrades in high-stress regimes. ${pageInsight ? pageInsight + " " : ""}Prioritize signals with multiple confirming factors: institutional flow, catalyst support, and technical structure alignment. Avoid chasing momentum without confirmation.`
        : `Signal quality is elevated in the current regime. ${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports trend-following signals. Look for sector leaders with clean technical structures and institutional accumulation.`,
      nextLabel: "Identify the best opportunities now →",
      nextPath: "/app/opportunities",
    },
    opportunities: {
      headline: `Opportunities must be evaluated in the context of ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In the current ${regime} environment, the highest-probability opportunities are in defensive sectors, volatility plays, and assets with strong institutional backing. Avoid high-beta momentum plays without strong catalyst support.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports growth and momentum opportunities. Focus on assets with strong earnings momentum, institutional accumulation, and clear technical breakout setups.`,
      nextLabel: "Ask ASHA about a specific opportunity →",
      nextPath: "/app/discover",
    },
    dashboard: {
      headline: `Today's market: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}Bull probability: ${bullProb}%. Crash probability: ${crashProb}%. ${keyRisks.length > 0 ? `Primary risk: ${keyRisks[0]}.` : ""} ${isStressed ? "Maintain defensive positioning and monitor risk levels closely." : "Conditions support selective risk-taking with disciplined position sizing."}`,
      nextLabel: "See today's opportunities →",
      nextPath: "/app/opportunities",
    },
    "daily-brief": {
      headline: `Today's briefing in context: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The current ${regime} environment shapes how today's news and events should be interpreted. ${isStressed ? "In elevated stress, negative catalysts have amplified impact. Stay defensive." : `With ${bullProb}% bull probability, positive catalysts are more likely to drive sustained moves.`}`,
      nextLabel: "Ask ASHA about today's market →",
      nextPath: "/app/discover",
    },
    diagnostic: {
      headline: `AI Diagnostic results in context: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The diagnostic output should be interpreted within the current ${regime} environment. ${isStressed ? `With ${crashProb}% crash probability, diagnostic warnings carry higher urgency. Act on critical signals.` : `The ${bullProb}% bull probability environment means diagnostic alerts are more likely to resolve positively.`}`,
      nextLabel: "See the full pressure analysis →",
      nextPath: "/app/pressure",
    },
    crypto: {
      headline: isStressed
        ? `Crypto faces elevated macro headwinds — ${regime}`
        : `Macro environment is supportive for crypto — ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In ${regime} environments, crypto typically experiences amplified volatility and correlation with risk assets. Bitcoin dominance tends to rise as capital rotates to quality. Monitor BTC as the leading indicator.`
        : `${pageInsight ? pageInsight + " " : ""}The current macro environment supports risk assets including crypto. ${bullProb}% bull probability suggests institutional appetite is present. Look for breakout setups in leading assets with strong on-chain fundamentals.`,
      nextLabel: "Ask ASHA about crypto opportunities →",
      nextPath: "/app/discover",
    },
    situation: {
      headline: `Situational awareness: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The market is currently in a ${regime} environment with ${bullProb}% bull and ${crashProb}% crash probability. ${keyRisks.length > 0 ? `Key risk: ${keyRisks[0]}.` : ""} Use this context to frame every decision you make today.`,
      nextLabel: "Understand what this means →",
      nextPath: "/app/signal-outlook",
    },
    portfolio: {
      headline: isStressed
        ? `Portfolio risk elevated — ${regime} environment`
        : `Portfolio conditions favorable — ${regime} environment`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In the current ${regime} environment, review position sizes and ensure adequate hedging. ${crashProb}% crash probability warrants defensive adjustments. Prioritize capital preservation.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports holding quality positions. Review your portfolio for alignment with the current sector rotation and consider adding to highest-conviction positions.`,
      nextLabel: "Monitor your alerts →",
      nextPath: "/app/alerts",
    },
    premarket: {
      headline: isStressed
        ? `Premarket setups face elevated macro headwinds — ${regime}`
        : `Macro environment supports premarket momentum — ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In ${regime} conditions, premarket gaps have higher fade probability. Focus on setups with strong catalysts and institutional backing. Avoid chasing gap-ups without confirmation at the open.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull probability environment supports gap-and-go setups. Premarket movers with strong catalysts and high relative volume have elevated follow-through probability in this regime.`,
      nextLabel: "See today's opportunities →",
      nextPath: "/app/opportunities",
    },
  };

  return syntheses[context] ?? syntheses.dashboard;
}

export default function MarketSynthesisPanel({
  context,
  pageInsight,
  nextStepLabel,
  nextStepPath,
}: MarketSynthesisPanelProps) {
  const { output, isLoading } = useEngine();
  const [, navigate] = useLocation();

  if (isLoading) return null;

  const { overall, regime, probability, narrative } = output;
  const pressureColor = getRiskColor(overall.riskLevel);

  const synthesis = getSynthesis(
    context,
    overall.riskLevel,
    regime.label,
    probability.bullProbability,
    probability.crashProbability,
    narrative.keyRisks ?? [],
    pageInsight,
  );

  const finalNextLabel = nextStepLabel ?? synthesis.nextLabel;
  const finalNextPath = nextStepPath ?? synthesis.nextPath;

  const SentimentIcon = overall.riskLevel === "low" ? TrendingUp
    : overall.riskLevel === "critical" || overall.riskLevel === "high" ? TrendingDown
    : Minus;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(10,12,16,0.95) 0%, ${pressureColor}06 100%)`,
        border: `1px solid ${pressureColor}20`,
        borderLeft: `3px solid ${pressureColor}`,
        borderRadius: "4px",
        padding: "14px 16px",
        marginBottom: "16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "22px", height: "22px", borderRadius: "4px",
          background: `${pressureColor}15`, flexShrink: 0,
        }}>
          <Lightbulb size={12} color={pressureColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.18em", color: "rgba(100,116,139,0.6)", marginBottom: "2px" }}>WHAT DOES THIS MEAN?</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: pressureColor, lineHeight: 1.2 }}>{synthesis.headline}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <SentimentIcon size={12} color={pressureColor} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: pressureColor, fontWeight: 600 }}>{overall.score.toFixed(1)}/10</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.75)", lineHeight: 1.6, marginBottom: "10px" }}>
        {synthesis.body}
      </div>

      {/* Key risk callout */}
      {narrative.keyRisks && narrative.keyRisks.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "10px", padding: "6px 8px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "3px" }}>
          <AlertTriangle size={10} color="#F59E0B" style={{ flexShrink: 0, marginTop: "1px" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(245,158,11,0.8)" }}>{narrative.keyRisks[0]}</span>
        </div>
      )}

      {/* Continue the conversation CTA */}
      <button
        onClick={() => navigate(finalNextPath)}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "5px 10px", borderRadius: "3px",
          background: `${pressureColor}10`, border: `1px solid ${pressureColor}25`,
          cursor: "pointer",
          transition: "all 0.15s ease",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "8px", letterSpacing: "0.12em",
          color: pressureColor,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${pressureColor}20`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${pressureColor}10`; }}
      >
        {finalNextLabel}
        <ArrowRight size={9} />
      </button>
    </div>
  );
}
