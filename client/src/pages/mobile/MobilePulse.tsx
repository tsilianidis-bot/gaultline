/* ============================================================
   FAULTLINE Core — Pulse Tab
   Live Pressure Index, regime status, bull/crash probability,
   top risk today, and "what changed" summary.
   ============================================================ */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, RefreshCw } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function getRegimeColor(regime: string): string {
  const r = regime?.toLowerCase() ?? "";
  if (r.includes("critical") || r.includes("crash")) return "#FF2D55";
  if (r.includes("high") || r.includes("stress") || r.includes("elevated")) return "#FF9500";
  if (r.includes("moderate") || r.includes("caution")) return "#FFD700";
  return "#34D399";
}

function getRegimeLabel(regime: string): string {
  const r = regime?.toLowerCase() ?? "";
  if (r.includes("critical")) return "CRITICAL";
  if (r.includes("high stress")) return "HIGH STRESS";
  if (r.includes("elevated")) return "ELEVATED";
  if (r.includes("moderate")) return "MODERATE";
  return "LOW RISK";
}

function getPressureDescription(score: number): string {
  if (score >= 75) return "Systemic stress is critical. Multiple risk vectors are simultaneously elevated. Defensive positioning strongly indicated.";
  if (score >= 55) return "High stress conditions detected. Credit spreads widening, liquidity tightening. Risk-off posture recommended.";
  if (score >= 40) return "Moderate pressure building. Monitor closely — conditions can deteriorate rapidly from this zone.";
  if (score >= 25) return "Low-to-moderate systemic risk. Markets functioning normally with isolated pockets of stress.";
  return "Systemic pressure is low. Risk appetite is elevated. Conditions support risk-on positioning.";
}

// ── Circular gauge ────────────────────────────────────────────
function PressureGauge({ score, color }: { score: number; color: string }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 64;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      {/* Center content */}
      <div className="relative flex flex-col items-center justify-center">
        <span className="text-4xl font-bold font-mono" style={{ color }}>{Math.round(score)}</span>
        <span className="text-[9px] font-mono tracking-widest text-[#64748B] mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string;   icon?: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className="flex-shrink-0" style={{ color }} />}
        <span className="text-[9px] font-mono tracking-widest" style={{ color: color + "80" }}>{label}</span>
      </div>
      <span className="text-lg font-bold font-mono" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-[#64748B]">{sub}</span>}
    </div>
  );
}

// ── Risk vector row ───────────────────────────────────────────
function RiskRow({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 70 ? "#FF2D55" : pct >= 50 ? "#FF9500" : pct >= 30 ? "#FFD700" : "#34D399";
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono text-[#A8B8CC] w-32 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>
      <span className="text-[10px] font-mono w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MobilePulse() {
  const { data: pressure, isLoading, refetch, isFetching } = trpc.pressure.getCurrentPressure.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const regimeColor = useMemo(() => getRegimeColor(pressure?.regime ?? ""), [pressure?.regime]);
  const regimeLabel = useMemo(() => getRegimeLabel(pressure?.regime ?? ""), [pressure?.regime]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF] animate-spin" />
        <span className="text-[10px] font-mono tracking-widest text-[#64748B]">LOADING PRESSURE ENGINE...</span>
      </div>
    );
  }

  const score = pressure?.overallPressure ?? 0;
  const bullProb = Math.max(5, Math.round(100 - score * 0.9));
  const crashProb = Math.min(95, Math.round(score * 0.7));

  // Top 5 risk vectors from the pressure data
  const riskVectors = useMemo(() => {
    if (!pressure?.vectors) return [];
    return [...pressure.vectors]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(v => ({ label: v.label, score: v.score }));
  }, [pressure]);

  const topAlert = pressure?.alerts?.[0];
  const whatChanged = topAlert?.detail ?? "Monitoring all risk vectors. No significant regime change detected in the last 24 hours.";
  const topRisk = topAlert?.title ?? riskVectors[0]?.label ?? "Credit Spread Widening";

  return (
    <div className="px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-0.5">FAULTLINE PRESSURE INDEX™</div>
          <div className="text-xs font-mono text-[#64748B]">
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <RefreshCw size={14} className={`text-[#64748B] ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Gauge + regime */}
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(12,15,22,0.95) 0%, rgba(8,10,16,0.98) 100%)",
          border: `1px solid ${regimeColor}25`,
          boxShadow: `0 0 40px ${regimeColor}10`,
        }}
      >
        <PressureGauge score={score} color={regimeColor} />

        {/* Regime badge */}
        <div
          className="px-4 py-1.5 rounded-full font-mono font-bold text-xs tracking-widest"
          style={{
            background: `${regimeColor}15`,
            border: `1px solid ${regimeColor}40`,
            color: regimeColor,
            boxShadow: `0 0 12px ${regimeColor}20`,
          }}
        >
          {regimeLabel}
        </div>

        <p className="text-[11px] text-[#A8B8CC] text-center leading-relaxed max-w-xs">
          {getPressureDescription(score)}
        </p>
      </div>

      {/* Bull / Crash probability */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="BULL CONTINUATION"
          value={`${bullProb}%`}
          sub="probability"
          color="#34D399"
          icon={TrendingUp}
        />
        <StatCard
          label="CRASH RISK"
          value={`${crashProb}%`}
          sub="probability"
          color={crashProb >= 50 ? "#FF2D55" : "#FF9500"}
          icon={TrendingDown}
        />
      </div>

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
          {riskVectors.map((v) => (
            <RiskRow key={v.label} label={v.label} score={v.score} />
          ))}
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
  );
}
