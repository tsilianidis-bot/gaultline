/* ============================================================
   MarketSynthesisPanel — "What does this mean?"
   Unified Market Intelligence System synthesis layer.
   Connects the current page's data to the market context.
   Answers: "So... what does all of this mean?"
   ============================================================ */
import { useLocation } from "wouter";
import { ArrowRight, Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { trpc } from "@/lib/trpc";
import { getRiskColor } from "@/components/RiskBadge";
import { formatCanonicalScore } from "@shared/marketMetrics";

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
        ? `The Pressure Index is signaling elevated systemic context. ${pageInsight ? pageInsight + " " : ""}Derived scenario scores are bull ${bullProb}% and bear-stress ${crashProb}%; they are not calibrated forecasts. Review the contributing vectors and source-quality status.`
        : `Current pressure readings are within the model's lower stress range. ${pageInsight ? pageInsight + " " : ""}The derived bull scenario score is ${bullProb}%; it is context rather than a return forecast. Review individual evidence before acting.`,
      nextLabel: "Find opportunities that fit this environment →",
      nextPath: "/app/opportunities",
    },
    signals: {
      headline: isStressed
        ? `Signals must be filtered through elevated market stress`
        : `Market conditions support signal follow-through`,
      body: isStressed
        ? `Current regime: ${regime}. ${pageInsight ? pageInsight + " " : ""}Evaluate each signal against its own evidence, liquidity, and risk controls; the market context does not establish follow-through rates.`
        : `Current regime: ${regime}. ${pageInsight ? pageInsight + " " : ""}Use the current context to compare signals, not to infer a probability of success.`,
      nextLabel: "See the full signal outlook →",
      nextPath: "/app/signal-outlook",
    },
    "signal-outlook": {
      headline: `${regime} — here is what the signal landscape means`,
      body: isStressed
        ? `Signal quality degrades in high-stress regimes. ${pageInsight ? pageInsight + " " : ""}Prioritize signals with multiple confirming factors: institutional flow, catalyst support, and technical structure alignment. Avoid chasing momentum without confirmation.`
        : `Signal context is less stressed in the current regime. ${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull scenario score is a derived context value, not a trend-following forecast.`,
      nextLabel: "Identify the best opportunities now →",
      nextPath: "/app/opportunities",
    },
    opportunities: {
      headline: `Opportunities must be evaluated in the context of ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In the current ${regime} environment, compare opportunity-specific evidence and risk controls rather than assigning probability from the market context alone.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull scenario score is uncalibrated context. Evaluate each asset on its own evidence, liquidity, and risk controls.`,
      nextLabel: "Ask ASHA about a specific opportunity →",
      nextPath: "/app/discover",
    },
    dashboard: {
      headline: `Today's market: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}Bull scenario score: ${bullProb}%. Bear-stress scenario score: ${crashProb}%. These are derived context values, not calibrated probabilities. ${keyRisks.length > 0 ? `Primary risk: ${keyRisks[0]}.` : ""}`,
      nextLabel: "See today's opportunities →",
      nextPath: "/app/opportunities",
    },
    "daily-brief": {
      headline: `Today's briefing in context: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The current ${regime} environment provides context for today's news and events. ${isStressed ? "Review elevated-stress contributors and source quality." : `The ${bullProb}% bull scenario score is not evidence that positive catalysts will sustain moves.`}`,
      nextLabel: "Ask ASHA about today's market →",
      nextPath: "/app/discover",
    },
    diagnostic: {
      headline: `AI Diagnostic results in context: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The diagnostic output should be interpreted within the current ${regime} environment. ${isStressed ? `Bear-stress scenario score: ${crashProb}%. This is not a calibrated urgency forecast.` : `Bull scenario score: ${bullProb}%. This does not establish that diagnostic alerts will resolve positively.`}`,
      nextLabel: "See the full pressure analysis →",
      nextPath: "/app/pressure",
    },
    crypto: {
      headline: isStressed
        ? `Crypto faces elevated macro headwinds — ${regime}`
        : `Macro environment is supportive for crypto — ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}Use the macro stress context as one input when evaluating crypto-specific evidence; it does not establish a typical crypto outcome or leading indicator.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull scenario score is not evidence of institutional appetite or a crypto breakout forecast.`,
      nextLabel: "Ask ASHA about crypto opportunities →",
      nextPath: "/app/discover",
    },
    situation: {
      headline: `Situational awareness: ${regime}`,
      body: `${pageInsight ? pageInsight + " " : ""}The market is currently in a ${regime} environment with derived bull scenario score ${bullProb}% and bear-stress scenario score ${crashProb}%. These values are not calibrated probabilities. ${keyRisks.length > 0 ? `Key risk: ${keyRisks[0]}.` : ""}`,
      nextLabel: "Understand what this means →",
      nextPath: "/app/signal-outlook",
    },
    portfolio: {
      headline: isStressed
        ? `Portfolio risk elevated — ${regime} environment`
        : `Portfolio conditions favorable — ${regime} environment`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In the current ${regime} environment, review portfolio-specific risks and controls. The ${crashProb}% bear-stress scenario score is not a calibrated hedging instruction.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull scenario score is current context, not a recommendation to hold or add positions.`,
      nextLabel: "Monitor your alerts →",
      nextPath: "/app/alerts",
    },
    premarket: {
      headline: isStressed
        ? `Premarket setups face elevated macro headwinds — ${regime}`
        : `Macro environment supports premarket momentum — ${regime}`,
      body: isStressed
        ? `${pageInsight ? pageInsight + " " : ""}In ${regime} conditions, assess each premarket setup with its own catalyst, liquidity, and confirmation rather than a market-context fade probability.`
        : `${pageInsight ? pageInsight + " " : ""}The ${bullProb}% bull scenario score does not establish a gap-and-go or follow-through probability.`,
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
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [, navigate] = useLocation();

  if (isLoading || !canonicalState) return null;

  const { overall, regime, probability, narrative } = output;
  const canonicalRiskLevel = canonicalState.regime === "LOW RISK" ? "low" : canonicalState.regime === "MODERATE RISK" ? "moderate" : canonicalState.regime === "ELEVATED RISK" ? "elevated" : canonicalState.regime === "HIGH STRESS" ? "high" : "critical";
  const pressureColor = getRiskColor(canonicalRiskLevel);

  const synthesis = getSynthesis(
    context,
    canonicalRiskLevel,
    canonicalState.regime,
    probability.bullProbability,
    probability.crashProbability,
    narrative.keyRisks ?? [],
    pageInsight,
  );

  const finalNextLabel = nextStepLabel ?? synthesis.nextLabel;
  const finalNextPath = nextStepPath ?? synthesis.nextPath;

  const SentimentIcon = canonicalRiskLevel === "low" ? TrendingUp
    : canonicalRiskLevel === "critical" || canonicalRiskLevel === "high" ? TrendingDown
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
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: pressureColor, fontWeight: 600 }}>{formatCanonicalScore(canonicalState.pressureIndex)}</span>
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
