/* ============================================================
   FAULTLINE — Mobile Pulse (Phase 4 Redesign)
   First screen answers: "What should I do today?"
   No scrolling required for the answer.
   ============================================================ */
import { useMemo } from "react";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Zap, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── Helpers ───────────────────────────────────────────────────
function getRegimeColor(regime: string): string {
  const r = regime?.toLowerCase() ?? "";
  if (r.includes("crisis") || r.includes("bear")) return "#FF2D55";
  if (r.includes("stress") || r.includes("caution")) return "#FF9500";
  if (r.includes("bull") || r.includes("expansion")) return "#34D399";
  return "#00D4FF";
}

function getCanonicalAnswer(quality: string | undefined, regime: string | null): { label: string; sub: string; color: string } {
  if (!quality || quality === "UNAVAILABLE") {
    return { label: "UNAVAILABLE", sub: "Canonical evidence is withheld. No action light is manufactured.", color: "#64748B" };
  }
  return {
    label: (regime ?? "UNAVAILABLE").toUpperCase(),
    sub: "Action-specific GREEN/YELLOW/RED lights live in ACT and Situation Room — this screen does not collapse to one bullish or bearish instruction.",
    color: getRegimeColor(regime ?? ""),
  };
}

function getRegimeLabel(regime: string): string {
  const r = regime?.toLowerCase() ?? "";
  if (r.includes("crisis")) return "CRISIS REGIME";
  if (r.includes("bear")) return "BEAR REGIME";
  if (r.includes("stress")) return "STRESS REGIME";
  if (r.includes("caution")) return "CAUTION REGIME";
  if (r.includes("bull")) return "BULL REGIME";
  if (r.includes("expansion")) return "EXPANSION REGIME";
  return "NEUTRAL REGIME";
}

// ── Main Component ────────────────────────────────────────────
export default function MobilePulse() {
  const { data: canonicalState, isLoading: canonicalLoading, refetch, isFetching } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const regimeColor = useMemo(() => getRegimeColor(canonicalState?.regime ?? ""), [canonicalState?.regime]);

  if (canonicalLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF] animate-spin" />
        <span className="text-[10px] font-mono tracking-widest text-[#64748B]">LOADING...</span>
      </div>
    );
  }

  if (!canonicalState) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <span className="text-[10px] font-mono tracking-widest text-[#64748B]">CANONICAL STATE UNAVAILABLE</span>
        <p className="text-xs text-[#A8B8CC]">Current mobile pulse is withheld. No default, fixture, or live pressure recalculation is shown as current intelligence.</p>
      </div>
    );
  }

  const score = canonicalState.pressureIndex;
  const quality = canonicalState.confidenceOrEvidenceQuality;
  const withheld = quality === "UNAVAILABLE" || score == null;
  const verdict = getCanonicalAnswer(quality, canonicalState.regime);
  const regimeLabel = withheld ? "UNAVAILABLE" : getRegimeLabel(canonicalState.regime ?? "Unavailable");
  const bullProb = canonicalState.scenarioOutputs.bull ?? canonicalState.scenarioOutputs.softLanding ?? null;
  const crashProb = canonicalState.scenarioOutputs.crash ?? canonicalState.scenarioOutputs.bear ?? null;

  const riskVectors = [...canonicalState.engines]
    .filter(engine => engine.value != null && engine.qualityStatus !== "UNAVAILABLE")
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 5)
    .map(engine => ({ label: engine.engineName, score: engine.value ?? 0 }));

  const topRisk = withheld
    ? "UNAVAILABLE"
    : (canonicalState.warnings[0] ?? riskVectors[0]?.label ?? "UNAVAILABLE");
  const whatChanged = withheld
    ? "Canonical change narrative is withheld."
    : (canonicalState.warnings[0] ?? "Canonical change narrative is unavailable.");

  // Score arc (0–100 → 0–180deg)
  const arcColor = withheld || score == null ? "#64748B" : score >= 70 ? "#FF2D55" : score >= 55 ? "#FF9500" : score >= 40 ? "#FFD700" : "#34D399";

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>

      {/* ── ABOVE-THE-FOLD HERO (answers: What should I do today?) ── */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-5 flex flex-col gap-3"
        style={{
          background: "linear-gradient(180deg, rgba(8,10,16,1) 0%, rgba(5,6,8,0.98) 100%)",
          borderBottom: `1px solid ${regimeColor}20`,
        }}
      >
        {/* Date + refresh */}
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-mono tracking-[0.25em] text-[#64748B]">
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <RefreshCw size={12} className={`text-[#64748B] ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* TODAY'S ANSWER — the dominant element */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="text-[9px] font-mono tracking-[0.35em] text-[#64748B]">TODAY'S ANSWER</div>
          <div
            className="text-4xl font-black tracking-tight text-center"
            style={{ color: verdict.color, textShadow: `0 0 30px ${verdict.color}40` }}
          >
            {verdict.label}
          </div>
          <div className="text-[11px] text-[#A8B8CC] text-center max-w-[260px] leading-snug">
            {verdict.sub}
          </div>
        </div>

        {/* Score + Regime row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Risk Score */}
          <div
            className="rounded-xl p-3 flex flex-col items-center gap-1"
            style={{ background: `${arcColor}08`, border: `1px solid ${arcColor}25` }}
          >
            <div className="text-[8px] font-mono tracking-widest text-[#64748B]">RISK</div>
            <div className="text-2xl font-black font-mono" style={{ color: arcColor }}>{score == null ? "—" : Math.round(score)}</div>
            <div className="text-[8px] font-mono text-[#64748B]">/100</div>
          </div>

          {/* Regime */}
          <div
            className="rounded-xl p-3 flex flex-col items-center justify-center gap-1 col-span-2"
            style={{ background: `${regimeColor}06`, border: `1px solid ${regimeColor}20` }}
          >
            <div className="text-[8px] font-mono tracking-widest text-[#64748B]">REGIME</div>
            <div className="text-[11px] font-mono font-bold text-center" style={{ color: regimeColor }}>
              {regimeLabel}
            </div>
          </div>
        </div>

        {/* Bull / Crash probability */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl p-3 flex flex-col gap-1"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp size={10} className="text-[#34D399]" />
              <span className="text-[8px] font-mono tracking-widest text-[#34D399]/70">BULL PROB</span>
            </div>
            <div className="text-xl font-black font-mono text-[#34D399]">{bullProb == null ? "UNAVAILABLE" : `${Math.round(bullProb)}%`}</div>
          </div>
          <div
            className="rounded-xl p-3 flex flex-col gap-1"
            style={{
              background: crashProb != null && crashProb >= 50 ? "rgba(255,45,85,0.06)" : "rgba(255,149,0,0.06)",
              border: `1px solid ${crashProb != null && crashProb >= 50 ? "rgba(255,45,85,0.2)" : "rgba(255,149,0,0.2)"}`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <TrendingDown size={10} style={{ color: crashProb != null && crashProb >= 50 ? "#FF2D55" : "#FF9500" }} />
              <span className="text-[8px] font-mono tracking-widest" style={{ color: crashProb != null && crashProb >= 50 ? "rgba(255,45,85,0.7)" : "rgba(255,149,0,0.7)" }}>CRASH RISK</span>
            </div>
            <div className="text-xl font-black font-mono" style={{ color: crashProb != null && crashProb >= 50 ? "#FF2D55" : "#FF9500" }}>{crashProb == null ? "UNAVAILABLE" : `${Math.round(crashProb)}%`}</div>
          </div>
        </div>
      </div>

      {/* ── BELOW-THE-FOLD DETAIL ── */}
      <div className="flex-1 px-4 py-4 space-y-3 pb-6">

        {/* Top risk today */}
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,45,85,0.05)", border: "1px solid rgba(255,45,85,0.15)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} className="text-[#FF9500]" />
            <span className="text-[9px] font-mono tracking-widest text-[#FF9500]/80">TOP MARKET RISK TODAY</span>
          </div>
          <p className="text-sm font-mono font-bold text-white">{topRisk}</p>
        </div>

        {/* Risk vectors */}
        {riskVectors.length > 0 && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap size={12} className="text-[#00D4FF]" />
              <span className="text-[9px] font-mono tracking-widest text-[#00D4FF]/60">RISK VECTORS</span>
            </div>
            {riskVectors.map((v) => {
              const pct = Math.min(100, v.score);
              const c = v.score >= 70 ? "#FF2D55" : v.score >= 50 ? "#FF9500" : "#34D399";
              return (
                <div key={v.label} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#A8B8CC] flex-1 truncate">{v.label}</span>
                  <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: c }} />
                  </div>
                  <span className="text-[10px] font-mono w-4 text-right flex-shrink-0" style={{ color: c }}>{v.score}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* What changed today */}
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}
        >
          <div className="text-[9px] font-mono tracking-widest text-[#00D4FF]/60 mb-2">WHAT CHANGED TODAY</div>
          <p className="text-[12px] text-[#A8B8CC] leading-relaxed">{whatChanged}</p>
        </div>

        {/* CTA — go to full platform */}
        <a
          href="/app"
          className="flex items-center justify-between rounded-xl p-4 transition-all duration-200 active:scale-[0.98]"
          style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)" }}
        >
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#00D4FF]/60 mb-0.5">FULL ANALYSIS</div>
            <div className="text-xs font-mono font-bold text-white">Open Decision Engine →</div>
          </div>
          <ArrowRight size={16} className="text-[#00D4FF] flex-shrink-0" />
        </a>

        {/* Pro upgrade teaser */}
        <div
          className="rounded-xl p-4 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#64748B] mb-0.5">PRO REQUIRED</div>
            <div className="text-xs text-[#A8B8CC]">Full Diagnostic AI™ + Aftershock Engine™</div>
          </div>
          <a
            href="/app/account"
            className="text-[9px] font-mono tracking-widest px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
          >
            UPGRADE
          </a>
        </div>
      </div>
    </div>
  );
}
