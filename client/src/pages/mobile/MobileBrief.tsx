/* ============================================================
   FAULTLINE Core — Daily Brief Tab
   Short daily market brief: top signal, top macro pressure,
   top crypto/rotation note. Synthesizes pressure + signals + rotation.
   ============================================================ */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { TrendingUp, TrendingDown, Zap, Shield, RotateCcw, ChevronRight, Clock } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function getRegimeColor(regime: string): string {
  const r = regime?.toUpperCase() ?? "";
  if (r.includes("CRITICAL")) return "#FF2D55";
  if (r.includes("HIGH")) return "#FF9500";
  if (r.includes("ELEVATED")) return "#FFD700";
  if (r.includes("MODERATE")) return "#00D4FF";
  return "#34D399";
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Brief section card ────────────────────────────────────────
interface BriefCardProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  accentColor: string;
}

function BriefCard({ icon, label, title, body, accentColor }: BriefCardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: `${accentColor}06`, border: `1px solid ${accentColor}18` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {icon}
        </div>
        <span className="text-[9px] font-mono tracking-widest" style={{ color: accentColor }}>
          {label}
        </span>
      </div>
      <div className="text-sm font-mono font-bold text-white mb-1.5">{title}</div>
      <p className="text-[11px] font-mono text-[#A8B8CC] leading-relaxed">{body}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MobileBrief() {
  const now = useMemo(() => new Date(), []);

  // Pressure data
  const { data: pressure, isLoading: pressureLoading } = trpc.pressure.getCurrentPressure.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Alt rotation for crypto/rotation note
  const { data: rotation } = trpc.altRotation.getData.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  // Engine context for narrative
  const { output } = useEngine();
  const { narrative, regime, probability } = output;

  const regimeColor = useMemo(() => getRegimeColor(pressure?.regime ?? regime.label), [pressure?.regime, regime.label]);

  // Top signal: highest pressure vector
  const topVector = useMemo(() => {
    if (!pressure?.vectors?.length) return null;
    return [...pressure.vectors].sort((a, b) => b.score - a.score)[0];
  }, [pressure?.vectors]);

  // Top rotation note
  const topSector = useMemo(() => {
    if (!rotation?.sectors?.length) return null;
    return [...rotation.sectors].sort((a, b) => Math.abs(b.avgChange24h) - Math.abs(a.avgChange24h))[0];
  }, [rotation?.sectors]);

  const isLoading = pressureLoading;

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
        ))}
      </div>
    );
  }

  const pressureScore = pressure?.overallPressure ?? 0;
  const bullProb = Math.max(5, Math.round(100 - pressureScore * 0.9));

  return (
    <div className="px-4 py-4 pb-6 space-y-4">
      {/* Header */}
      <div>
        <div className="text-[9px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-0.5">DAILY BRIEF</div>
        <div className="text-xs font-mono text-[#64748B]">{formatDate(now)}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <Clock size={10} className="text-[#3D4F63]" />
          <span className="text-[9px] font-mono text-[#3D4F63]">Updated {formatTime(now)}</span>
        </div>
      </div>

      {/* Regime summary card */}
      <div
        className="rounded-xl p-4"
        style={{ background: `${regimeColor}08`, border: `1px solid ${regimeColor}20` }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] font-mono tracking-widest" style={{ color: regimeColor }}>
            MARKET REGIME
          </div>
          <div
            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${regimeColor}15`, color: regimeColor }}
          >
            {pressureScore.toFixed(0)} / 100
          </div>
        </div>
        <div className="text-base font-bold font-mono text-white mb-1">
          {pressure?.regime ?? regime.label}
        </div>
        <p className="text-[11px] font-mono text-[#A8B8CC] leading-relaxed">
          {narrative.regimeAssessment || narrative.summary}
        </p>
        {/* Bull/crash probabilities */}
        <div className="flex gap-4 mt-3">
          <div>
            <div className="text-[8px] font-mono text-[#64748B] mb-0.5">BULL CONTINUATION</div>
            <div className="text-sm font-mono font-bold text-[#34D399]">{bullProb}%</div>
          </div>
          <div>
            <div className="text-[8px] font-mono text-[#64748B] mb-0.5">CRASH RISK</div>
            <div className="text-sm font-mono font-bold text-[#FF2D55]">
              {Math.min(95, Math.round(pressureScore * 0.7))}%
            </div>
          </div>
          <div>
            <div className="text-[8px] font-mono text-[#64748B] mb-0.5">REGIME HOLD</div>
            <div className="text-sm font-mono font-bold text-[#FFD700]">
              {Math.round(50 + (50 - pressureScore / 2))}%
            </div>
          </div>
        </div>
      </div>

      {/* Top macro pressure */}
      {topVector && (
        <BriefCard
          icon={<Shield size={12} />}
          label="TOP MACRO PRESSURE"
          title={topVector.label}
          body={topVector.driver || topVector.description}
          accentColor="#FF9500"
        />
      )}

      {/* Key risks from narrative */}
      {narrative.keyRisks?.length > 0 && (
        <BriefCard
          icon={<Zap size={12} />}
          label="TOP SIGNAL"
          title={narrative.keyRisks[0]}
          body={narrative.keyRisks[1] ?? "Monitor closely for regime confirmation."}
          accentColor="#00D4FF"
        />
      )}

      {/* Top rotation note */}
      {topSector && (
        <BriefCard
          icon={<RotateCcw size={12} />}
          label="ROTATION NOTE"
          title={`${topSector.name} ${topSector.avgChange24h >= 0 ? "Leading" : "Lagging"}`}
          body={`${topSector.name} is showing ${Math.abs(topSector.avgChange24h).toFixed(1)}% 24h momentum. ${
            rotation?.aiCommentary
              ? rotation.aiCommentary.split(".")[0] + "."
              : topSector.avgChange24h >= 0
              ? "Risk-on rotation detected in this sector."
              : "Risk-off pressure weighing on this sector."
          }`}
          accentColor={topSector.color ?? "#A78BFA"}
        />
      )}

      {/* BTC dominance note */}
      {rotation?.btcDominance && (
        <BriefCard
          icon={<TrendingUp size={12} />}
          label="CRYPTO BRIEF"
          title={`BTC Dominance: ${rotation.btcDominance.current.toFixed(1)}%`}
          body={`${rotation.regime}. ${
            rotation.btcDominance.trend === "rising"
              ? "Bitcoin is absorbing capital — altcoin rotation is limited."
              : rotation.btcDominance.trend === "falling"
              ? "BTC dominance declining — altcoin rotation window is open."
              : "Dominance stable — watch for breakout direction."
          }`}
          accentColor="#F59E0B"
        />
      )}

      {/* Upgrade CTA */}
      <a
        href="/app/account"
        className="flex items-center justify-between rounded-xl p-4"
        style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)" }}
      >
        <div>
          <div className="text-xs font-mono font-bold text-white">Full Intelligence Report™</div>
          <div className="text-[10px] font-mono text-[#64748B] mt-0.5">AI narrative · PDF export · historical analogs</div>
        </div>
        <div className="text-[10px] font-mono text-[#00D4FF] flex items-center gap-1">
          PRO <ChevronRight size={12} />
        </div>
      </a>
    </div>
  );
}
