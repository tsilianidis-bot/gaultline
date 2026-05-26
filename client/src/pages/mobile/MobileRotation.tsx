/* ============================================================
   FAULTLINE Core — Rotation Tab
   Alt rotation snapshot: BTC dominance, AI token momentum,
   sector risk-on/risk-off status.
   Uses trpc.altRotation.getData (coreProcedure).
   ============================================================ */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function getRegimeColor(regimeKey: string): string {
  switch (regimeKey) {
    case "btc_dominance": return "#F59E0B";
    case "early_rotation": return "#00D4FF";
    case "selective_expansion": return "#34D399";
    case "broad_altseason": return "#A78BFA";
    case "speculative_mania": return "#FF2D55";
    default: return "#64748B";
  }
}

function getRiskOnOff(score: number): { label: string; color: string; icon: React.ReactNode } {
  if (score >= 70) return { label: "RISK-ON", color: "#34D399", icon: <TrendingUp size={14} /> };
  if (score >= 40) return { label: "NEUTRAL", color: "#FFD700", icon: <Minus size={14} /> };
  return { label: "RISK-OFF", color: "#FF2D55", icon: <TrendingDown size={14} /> };
}

// ── Sector card ───────────────────────────────────────────────
interface SectorCardProps {
  name: string;
  color: string;
  momentum: number;
  topCoin?: string;
}

function SectorCard({ name, color, momentum, topCoin }: SectorCardProps) {
  const isPositive = momentum >= 0;
  const barWidth = Math.min(Math.abs(momentum) * 5, 100);

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] font-mono font-bold text-white">{name}</span>
        </div>
        <span
          className="text-[10px] font-mono font-bold"
          style={{ color: isPositive ? "#34D399" : "#FF2D55" }}
        >
          {isPositive ? "+" : ""}{momentum.toFixed(1)}%
        </span>
      </div>
      {/* Momentum bar */}
      <div className="h-1 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${barWidth}%`,
            background: isPositive ? color : "#FF2D55",
            opacity: 0.7,
          }}
        />
      </div>
      {topCoin && (
        <div className="text-[9px] font-mono text-[#3D4F63] mt-1">Lead: {topCoin}</div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MobileRotation() {
  const { data: rotation, isLoading } = trpc.altRotation.getData.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  const riskStatus = useMemo(() => getRiskOnOff(rotation?.score ?? 40), [rotation?.score]);
  const regimeColor = useMemo(() => getRegimeColor(rotation?.regimeKey ?? "btc_dominance"), [rotation?.regimeKey]);

  // Top 4 sectors by absolute momentum for the mobile view
  const topSectors = useMemo(() => {
    if (!rotation?.sectors) return [];
    return [...rotation.sectors]
      .sort((a, b) => b.avgChange24h - a.avgChange24h)
      .slice(0, 4);
  }, [rotation?.sectors]);

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl animate-pulse"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-0.5">ALT ROTATION™</div>
          <div className="text-xs font-mono text-[#64748B]">Crypto sector momentum</div>
        </div>
        {/* Risk-on/off badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: `${riskStatus.color}15`, border: `1px solid ${riskStatus.color}30` }}
        >
          <span style={{ color: riskStatus.color }}>{riskStatus.icon}</span>
          <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: riskStatus.color }}>
            {riskStatus.label}
          </span>
        </div>
      </div>

      {/* Regime card */}
      <div
        className="rounded-xl p-4"
        style={{ background: `${regimeColor}08`, border: `1px solid ${regimeColor}20` }}
      >
        <div className="text-[9px] font-mono tracking-widest mb-1" style={{ color: regimeColor }}>
          CURRENT REGIME
        </div>
        <div className="text-base font-bold font-mono text-white mb-1">
          {rotation?.regime ?? "BTC DOMINANCE"}
        </div>
        {rotation?.aiCommentary && (
          <p className="text-[10px] font-mono text-[#A8B8CC] leading-relaxed line-clamp-2">
            {rotation.aiCommentary}
          </p>
        )}
        {/* Score bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[9px] font-mono text-[#64748B] mb-1">
            <span>ROTATION SCORE</span>
            <span style={{ color: regimeColor }}>{rotation?.score ?? 0}/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${rotation?.score ?? 0}%`, background: regimeColor }}
            />
          </div>
        </div>
      </div>

      {/* BTC Dominance */}
      {rotation?.btcDominance && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[9px] font-mono tracking-widest text-[#64748B] mb-2">BTC DOMINANCE</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold font-mono text-[#F59E0B]">
                {rotation.btcDominance.current.toFixed(1)}%
              </div>
              <div className="text-[10px] font-mono text-[#64748B] mt-0.5">
                {rotation.btcDominance.trend === "rising"
                  ? "↑ Rising — Bitcoin dominance expanding"
                  : rotation.btcDominance.trend === "falling"
                  ? "↓ Falling — Altcoin rotation underway"
                  : "→ Stable — Consolidation phase"}
              </div>
            </div>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              {rotation.btcDominance.trend === "rising"
                ? <TrendingUp size={20} className="text-[#F59E0B]" />
                : rotation.btcDominance.trend === "falling"
                ? <TrendingDown size={20} className="text-[#F59E0B]" />
                : <Minus size={20} className="text-[#F59E0B]" />}
            </div>
          </div>
        </div>
      )}

      {/* AI Token Momentum */}
      {topSectors.length > 0 && (
        <div>
          <div className="text-[9px] font-mono tracking-widest text-[#A8B8CC]/60 mb-2">SECTOR MOMENTUM (24H)</div>
          <div className="space-y-2">
            {topSectors.map(sector => (
              <SectorCard
                key={sector.key}
                name={sector.name}
                color={sector.color}
                momentum={sector.avgChange24h}
                topCoin={sector.coins?.[0]?.symbol}
              />
            ))}
          </div>
        </div>
      )}

      {/* ETH Leadership */}
      {rotation?.ethLeadership && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[9px] font-mono tracking-widest text-[#64748B] mb-2">ETH LEADERSHIP</div>
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-sm font-mono font-bold"
                style={{ color: rotation.ethLeadership.status === "outperforming" ? "#34D399" : rotation.ethLeadership.status === "underperforming" ? "#FF2D55" : "#FF9500" }}
              >
                {rotation.ethLeadership.label}
              </div>
              <div className="text-[10px] font-mono text-[#64748B] mt-0.5">
                ETH/BTC ratio: {rotation.ethLeadership.ethBtcRatio.toFixed(4)}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-sm font-mono font-bold"
                style={{ color: rotation.ethLeadership.ethChange24h >= 0 ? "#34D399" : "#FF2D55" }}
              >
                {rotation.ethLeadership.ethChange24h >= 0 ? "+" : ""}{rotation.ethLeadership.ethChange24h.toFixed(2)}%
              </div>
              <div className="text-[9px] font-mono text-[#64748B]">ETH 24h</div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      <a
        href="/app/account"
        className="flex items-center justify-between rounded-xl p-4"
        style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)" }}
      >
        <div>
          <div className="text-xs font-mono font-bold text-white">Full Rotation Intelligence™</div>
          <div className="text-[10px] font-mono text-[#64748B] mt-0.5">50+ sectors · systemic risk · heatmap</div>
        </div>
        <div className="text-[10px] font-mono text-[#00D4FF] flex items-center gap-1">
          PRO <ChevronRight size={12} />
        </div>
      </a>
    </div>
  );
}
