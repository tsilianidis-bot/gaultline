/**
 * FAULTLINE Interpretation Section
 * "What today's readings actually mean"
 *
 * Dynamically derives all content from EngineOutput:
 *   - Pressure Index + Regime from overall + regime
 *   - Bull/Crash: probability-contract display text only (no numbers)
 *   - Top threat from highest-scoring domain
 *   - Easing/building signals from domain deltas
 *   - Closest historical analog from analogs[0]
 *   - AI concentration from indicators.aiConcentration
 *
 * Displays:
 *   - Status chips row (Moderate Risk, AI Concentration, etc.)
 *   - Plain-English narrative paragraphs
 *   - 3 takeaway cards: Clean Read · Guidance · Most Important
 */
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { engineProbabilityText } from "@/lib/marketStateProjection";
import { trpc } from "@/lib/trpc";
import { getRiskColor } from "@/components/RiskBadge";
import { availableDelta } from "@/lib/displayFallbacks";

// ── Helpers ────────────────────────────────────────────────────────────────────

export type InterpretationTrend = "easing" | "building" | "stable" | "unavailable";

/**
 * Domain trend for the interpretation copy. Same availability semantics as
 * #59's knownDelta (lib/deltaAvailability.ts): a missing domain, a delta
 * flagged `deltaAvailable: false`, or a non-finite delta is "unavailable" —
 * never "stable". "stable" is only a known flat delta (|Δ| ≤ 0.15).
 */
export function interpretationTrend(
  item: { delta?: unknown; deltaAvailable?: boolean } | null | undefined,
): InterpretationTrend {
  const delta = availableDelta(item);
  if (delta === null) return "unavailable";
  if (delta < -0.15) return "easing";
  if (delta > 0.15) return "building";
  return "stable";
}

const CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  green:  { bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.25)",  text: "rgba(0,255,136,0.9)" },
  cyan:   { bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.25)",  text: "rgba(0,212,255,0.9)" },
  amber:  { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", text: "rgba(251,191,36,0.9)" },
  red:    { bg: "rgba(255,45,85,0.08)",  border: "rgba(255,45,85,0.25)",  text: "rgba(255,45,85,0.9)" },
  purple: { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)", text: "rgba(168,85,247,0.9)" },
  gray:   { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", text: "rgba(148,163,184,0.7)" },
};

type ChipColor = keyof typeof CHIP_COLORS;

function StatusChip({ label, color }: { label: string; color: ChipColor }) {
  const c = CHIP_COLORS[color];
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
      padding: "4px 10px", borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function TakeawayCard({
  label, labelColor, title, body,
}: {
  label: string; labelColor: ChipColor; title: string; body: string;
}) {
  const c = CHIP_COLORS[labelColor];
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${c.border}`,
      borderRadius: 14, padding: "18px 20px",
      flex: "1 1 220px", minWidth: 0,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
        color: c.text, marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 15, fontWeight: 700, color: "#E2E8F0",
        marginBottom: 8, lineHeight: 1.3,
      }}>
        {title}
      </div>
      <p style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 12, color: "rgba(148,163,184,0.75)",
        lineHeight: 1.65, margin: 0,
      }}>
        {body}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FaultlineInterpretation() {
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { output, indicators } = useEngine();
  if (!canonicalState) return null;
  const { overall, regime, domains, analogs } = output;

  // Derive key signals dynamically
  const topDomain = useMemo(
    () => [...domains].sort((a, b) => b.score - a.score)[0],
    [domains]
  );

  const closestAnalog = analogs[0];

  const domainById = useMemo(
    () => Object.fromEntries(domains.map(d => [d.id, d])),
    [domains]
  );

  const treasuryDelta  = interpretationTrend(domainById["treasury-debt"]);
  const recessionDelta = interpretationTrend(domainById["recession"]);
  const liquidityDelta = interpretationTrend(domainById["liquidity"]);
  const bankingDelta   = interpretationTrend(domainById["banking"]);
  const creditDelta    = interpretationTrend(domainById["credit-stress"]);

  const inflationDomain = domainById["inflation-fed"];
  const bankingDomain   = domainById["banking"];
  const creditDomain    = domainById["credit-stress"];
  const creDomain       = domainById["commercial-real-estate"] ?? domainById["cre-stress"];
  const aiBubbleDomain  = domainById["ai-bubble"] ?? topDomain;

  const aiConcentration = indicators.aiConcentration;
  const pressureScore   = overall.score;
  const regimeLabel     = regime.label;
  // Probability contract: bull/crash numbers are withheld (uncalibrated / not
  // offered), so guidance keys off the pressure band, never a probability.
  const bullText        = engineProbabilityText(output, "bullProbability");
  const crashText       = engineProbabilityText(output, "crashProbability");
  const fragile         = overall.riskLevel === "critical" || overall.riskLevel === "high";
  const constructive    = overall.riskLevel === "low" || overall.riskLevel === "moderate";

  // Regime-based chip color
  const regimeChipColor: ChipColor =
    regime.code === "CRITICAL_SYSTEMIC" ? "red" :
    regime.code === "LATE_CYCLE_FRAGILITY" ? "red" :
    regime.code === "ELEVATED_STRESS" ? "amber" :
    regime.code === "MODERATE_RISK" ? "amber" : "green";

  // Top threat chip color
  const topThreatColor: ChipColor =
    topDomain?.riskLevel === "critical" ? "red" :
    topDomain?.riskLevel === "high" ? "red" :
    topDomain?.riskLevel === "elevated" ? "amber" : "amber";

  // Crash risk chip color
  const crashChipColor: ChipColor = "cyan";

  // Liquidity chip color
  const liquidityChipColor: ChipColor = liquidityDelta === "easing" ? "green" : liquidityDelta === "building" ? "amber" : liquidityDelta === "unavailable" ? "gray" : "cyan";
  const liquidityChipLabel =
    liquidityDelta === "unavailable" ? "Liquidity trend: Unavailable" :
    liquidityDelta === "easing" ? "Liquidity Easing" :
    liquidityDelta === "building" ? "Liquidity Tightening" : "Liquidity Stable";

  // Build dynamic narrative paragraphs
  const para1 = `Overall, FAULTLINE is showing ${regimeLabel.toLowerCase()} systemic risk. The current Pressure Index is ${Math.round(pressureScore * 10)}/100, placing the market in a ${regimeLabel} regime. Bull scenario weight: ${bullText}. Crash probability: ${crashText} — FAULTLINE has no governed crash model.`;

  const para2 = `The strongest warning is not broad recession pressure. The main risk is ${aiBubbleDomain?.label ?? "speculative concentration"}, scoring ${aiBubbleDomain ? Math.round(aiBubbleDomain.score * 10) : "—"}/100.${aiConcentration > 25 ? ` The model's AI/mega-cap concentration input is a static baseline of ${aiConcentration.toFixed(1)}% of the S&P 500, not a live measurement.` : ""}${closestAnalog ? ` The closest historical analog is the ${closestAnalog.era} (${closestAnalog.year}), with a ${closestAnalog.similarity}% similarity score.` : ""}`;

  const easingZones: string[] = [];
  const dangerZones: string[] = [];

  if (treasuryDelta === "easing")  easingZones.push("Treasury/Debt Stress");
  else if (treasuryDelta === "building") dangerZones.push("Treasury/Debt Stress");

  if (recessionDelta === "easing")  easingZones.push("Recession Risk");
  else if (recessionDelta === "building") dangerZones.push("Recession Risk");

  if (liquidityDelta === "easing")  easingZones.push("Liquidity Conditions");
  else if (liquidityDelta === "building") dangerZones.push("Liquidity Conditions");

  if (bankingDelta === "building")  dangerZones.push("Banking System Stress");
  if (creditDelta === "building")   dangerZones.push("Credit Market Stress");
  if (inflationDomain && inflationDomain.score >= 4) dangerZones.push("Inflation/Fed Pressure");
  if (creDomain && creDomain.score >= 6) dangerZones.push("Commercial Real Estate Stress");

  // Trend copy only claims what the deltas show: when none of the trend
  // domains has a known delta, say so instead of "no easing" / "contained".
  const trendDeltas = [treasuryDelta, recessionDelta, liquidityDelta, bankingDelta, creditDelta];
  const allTrendsUnavailable = trendDeltas.every(t => t === "unavailable");

  const para3 = allTrendsUnavailable
    ? `Domain trends versus the prior reading are unavailable, so no domain is described as easing, building or stable. The level of stress is the ${regimeLabel} regime above.`
    : easingZones.length > 0
    ? `Several major stress areas are easing, including ${easingZones.join(", ")}. This means the system is not currently confirming a broad liquidity collapse — risk-on assets may still have room to move.`
    : `No domain is showing an easing trend versus the prior reading. This is a trend statement only; the level of stress is the ${regimeLabel} regime above.`;

  const para4 = dangerZones.length > 0
    ? `However, several danger zones remain active: ${dangerZones.join(", ")}. The market can continue climbing, but the foundation is fragile if ${aiBubbleDomain?.label ?? "AI leadership"} breaks down, credit conditions worsen, or liquidity reverses.`
    : allTrendsUnavailable
      ? `No danger zone is flagged from levels alone; trend-based danger zones cannot be assessed without prior readings. Monitor credit spreads and liquidity metrics.`
      : `Risk conditions are broadly contained. Monitor for any deterioration in credit spreads or liquidity metrics.`;

  // Takeaway card content — dynamically adapted to regime
  const cleanReadTitle = fragile
    ? "High systemic pressure — defensive posture warranted"
    : "Not a 'crash now' signal";

  const cleanReadBody = fragile
    ? `Systemic pressure is in the high band. The market is showing structural fragility. Reduce exposure to high-beta and speculative names.`
    : `This is not a "crash now" signal. It is a "market is vulnerable if ${aiBubbleDomain?.label ?? "the AI trade"} cracks, credit worsens, or liquidity reverses" signal.`;

  const guidanceBody = constructive
    ? "Stay invested selectively, but do not ignore risk. Favor stronger assets, avoid chasing weak speculative names, monitor AI concentration, watch credit spreads, track liquidity, and be careful with high-beta stocks that depend on cheap money."
    : "Reduce speculative exposure. Favor quality, cash-flow positive assets. Watch credit spreads and liquidity conditions closely. Avoid adding risk until the regime clarifies.";

  const mostImportantBody = `The market can ${constructive ? "keep climbing" : "stabilize"}, but the foundation is fragile. The biggest risk is ${aiBubbleDomain?.label ?? "an AI/mega-cap unwind"}, not a traditional recession shock right now.`;

  return (
    <div style={{
      background: "rgba(7,9,16,0.8)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "24px",
      marginTop: 0,
    }}>
      {/* Section header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase",
          color: "rgba(100,116,139,0.5)", marginBottom: 6,
        }}>
          FAULTLINE INTERPRETATION
        </div>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 20, fontWeight: 700, color: "#E2E8F0",
          letterSpacing: "0.04em",
        }}>
          What today's readings actually mean
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        <StatusChip label={regimeLabel} color={regimeChipColor} />
        {aiBubbleDomain && (
          <StatusChip label={`${aiBubbleDomain.label} ${Math.round(aiBubbleDomain.score * 10)}/100`} color={topThreatColor} />
        )}
        {aiConcentration > 25 && (
          <StatusChip label={`AI Concentration ${aiConcentration.toFixed(1)}% · static baseline`} color="amber" />
        )}
        <StatusChip
          label={liquidityChipLabel}
          color={liquidityChipColor}
        />
        <StatusChip label={`Crash probability: ${crashText}`} color={crashChipColor} />
        {closestAnalog && (
          <StatusChip label={`Analog: ${closestAnalog.era} ${closestAnalog.similarity}%`} color="purple" />
        )}
      </div>

      {/* Narrative paragraphs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {[para1, para2, para3, para4].map((para, i) => (
          <p key={i} style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13, color: "rgba(148,163,184,0.8)",
            lineHeight: 1.7, margin: 0,
          }}>
            {para}
          </p>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }} />

      {/* 3 Takeaway Cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <TakeawayCard
          label="⬡ Clean Read"
          labelColor={fragile ? "red" : "cyan"}
          title={cleanReadTitle}
          body={cleanReadBody}
        />
        <TakeawayCard
          label="◈ Guidance"
          labelColor="amber"
          title={constructive ? "Stay invested, stay selective" : "Reduce risk exposure"}
          body={guidanceBody}
        />
        <TakeawayCard
          label="▲ Most Important"
          labelColor="purple"
          title="The foundation is fragile"
          body={mostImportantBody}
        />
      </div>
    </div>
  );
}
