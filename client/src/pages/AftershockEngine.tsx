import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { PremiumGateFull } from "@/components/PremiumGate";

// ── Types (mirrored from server) ───────────────────────────────
type AftershockLabel =
  | "Primary Rupture"
  | "First-Wave Aftershock"
  | "Delayed Reaction"
  | "Sympathy Momentum"
  | "Sector Echo"
  | "Liquidity Spillover"
  | "Macro Shockwave"
  | "Fading Aftershock"
  | "False Aftershock";

type ContagionDirection = "Bullish" | "Bearish" | "Uncertain";
type ConfirmationStatus = "Confirmed" | "Developing" | "Unconfirmed" | "Fading";
type ConfidenceLevel = "High" | "Moderate" | "Low";
type AssetClass = "Stock" | "ETF" | "Crypto" | "Macro" | "Sector";

interface RuptureEvent {
  id: string;
  triggerAsset: string;
  triggerName: string;
  assetClass: AssetClass;
  ruptureType: string;
  magnitude: number;
  volumeRatio: number;
  volatilityRatio: number;
  strength: number;
  direction: ContagionDirection;
  description: string;
  detectedAt: number;
  aftershockWindowHours: number;
}

interface AftershockSignal {
  id: string;
  ruptureId: string;
  triggerAsset: string;
  triggerName: string;
  relatedAsset: string;
  relatedName: string;
  relatedAssetClass: AssetClass;
  label: AftershockLabel;
  probability: number;
  strength: number;
  timingWindowHours: number;
  timingWindowLabel: string;
  relationshipType: string;
  direction: ContagionDirection;
  confidence: ConfidenceLevel;
  confirmationStatus: ConfirmationStatus;
  explanation: string;
  currentReactionPercent: number | null;
  reactionStarted: boolean;
  generatedAt: number;
}

interface AftershockChain {
  triggerAsset: string;
  triggerName: string;
  ruptureType: string;
  direction: ContagionDirection;
  signals: AftershockSignal[];
  totalAftershocks: number;
  confirmedAftershocks: number;
  macroContext: string;
}

// ── Color helpers ──────────────────────────────────────────────

function directionColor(d: ContagionDirection): string {
  if (d === "Bullish") return "text-emerald-400";
  if (d === "Bearish") return "text-red-400";
  return "text-amber-400";
}

function directionBg(d: ContagionDirection): string {
  if (d === "Bullish") return "bg-emerald-500/10 border-emerald-500/30";
  if (d === "Bearish") return "bg-red-500/10 border-red-500/30";
  return "bg-amber-500/10 border-amber-500/30";
}

function statusColor(s: ConfirmationStatus): string {
  if (s === "Confirmed")   return "text-emerald-400";
  if (s === "Developing")  return "text-cyan-400";
  if (s === "Fading")      return "text-orange-400";
  return "text-zinc-400";
}

function statusBg(s: ConfirmationStatus): string {
  if (s === "Confirmed")   return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
  if (s === "Developing")  return "bg-cyan-500/15 border-cyan-500/40 text-cyan-300";
  if (s === "Fading")      return "bg-orange-500/15 border-orange-500/40 text-orange-300";
  return "bg-zinc-700/40 border-zinc-600/40 text-zinc-400";
}

function labelColor(l: AftershockLabel): string {
  const map: Record<AftershockLabel, string> = {
    "Primary Rupture":        "bg-red-500/20 border-red-500/50 text-red-300",
    "First-Wave Aftershock":  "bg-orange-500/20 border-orange-500/50 text-orange-300",
    "Delayed Reaction":       "bg-amber-500/20 border-amber-500/50 text-amber-300",
    "Sympathy Momentum":      "bg-cyan-500/20 border-cyan-500/50 text-cyan-300",
    "Sector Echo":            "bg-violet-500/20 border-violet-500/50 text-violet-300",
    "Liquidity Spillover":    "bg-blue-500/20 border-blue-500/50 text-blue-300",
    "Macro Shockwave":        "bg-red-600/20 border-red-600/50 text-red-200",
    "Fading Aftershock":      "bg-zinc-600/20 border-zinc-600/50 text-zinc-400",
    "False Aftershock":       "bg-zinc-700/20 border-zinc-700/50 text-zinc-500",
  };
  return map[l] ?? "bg-zinc-700/20 border-zinc-600/40 text-zinc-400";
}

function confidenceDot(c: ConfidenceLevel): string {
  if (c === "High")     return "bg-emerald-400";
  if (c === "Moderate") return "bg-amber-400";
  return "bg-zinc-500";
}

function assetClassBadge(ac: AssetClass): string {
  const map: Record<AssetClass, string> = {
    Stock:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
    ETF:    "bg-violet-500/15 text-violet-300 border-violet-500/30",
    Crypto: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Macro:  "bg-red-500/15 text-red-300 border-red-500/30",
    Sector: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  };
  return map[ac] ?? "bg-zinc-700/20 text-zinc-400";
}

// ── Ripple Canvas ──────────────────────────────────────────────

function RippleCanvas({ ruptures }: { ruptures: RuptureEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;

    // Build node positions from ruptures
    const nodes = ruptures.slice(0, 6).map((r, i) => {
      const angle = (i / Math.max(ruptures.slice(0, 6).length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(W, H) * 0.32;
      return {
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius,
        label: r.triggerAsset,
        strength: r.strength,
        direction: r.direction,
        rings: [] as { r: number; alpha: number }[],
      };
    });

    // Seed rings
    nodes.forEach(n => {
      for (let i = 0; i < 3; i++) {
        n.rings.push({ r: (i * 30) % 80, alpha: 1 - i * 0.3 });
      }
    });

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw connection lines between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, "rgba(59,130,246,0.12)");
          grad.addColorStop(0.5, "rgba(239,68,68,0.08)");
          grad.addColorStop(1, "rgba(59,130,246,0.12)");
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Draw ripple rings
      nodes.forEach(n => {
        n.rings.forEach(ring => {
          const color = n.direction === "Bullish" ? "34,197,94" :
                        n.direction === "Bearish" ? "239,68,68" : "251,191,36";
          ctx.beginPath();
          ctx.arc(n.x, n.y, ring.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${color},${ring.alpha * 0.5})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      });

      // Animate rings
      nodes.forEach(n => {
        n.rings.forEach(ring => {
          ring.r += 0.6;
          ring.alpha -= 0.004;
          if (ring.alpha <= 0) {
            ring.r = 0;
            ring.alpha = 0.8;
          }
        });
      });

      // Draw node circles
      nodes.forEach(n => {
        const color = n.direction === "Bullish" ? "#22c55e" :
                      n.direction === "Bearish" ? "#ef4444" : "#fbbf24";
        const glowColor = n.direction === "Bullish" ? "34,197,94" :
                          n.direction === "Bearish" ? "239,68,68" : "251,191,36";

        // Glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 18);
        grd.addColorStop(0, `rgba(${glowColor},0.4)`);
        grd.addColorStop(1, `rgba(${glowColor},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6 + (n.strength / 100) * 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y - 16);
      });

      // Center pulse
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.04);
      const cGrd = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 20 + pulse * 8);
      cGrd.addColorStop(0, `rgba(59,130,246,${0.3 * pulse})`);
      cGrd.addColorStop(1, "rgba(59,130,246,0)");
      ctx.beginPath();
      ctx.arc(W/2, H/2, 20 + pulse * 8, 0, Math.PI * 2);
      ctx.fillStyle = cGrd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(W/2, H/2, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59,130,246,0.9)";
      ctx.fill();

      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("FAULTLINE", W/2, H/2 + 16);

      t++;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [ruptures]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

// ── Strength Meter ─────────────────────────────────────────────

function StrengthMeter({ value, label }: { value: number; label?: string }) {
  const color = value >= 70 ? "bg-red-500" : value >= 45 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      {label && <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color}`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-xs font-mono text-zinc-300 w-8 text-right">{value}</span>
      </div>
    </div>
  );
}

// ── Rupture Card ───────────────────────────────────────────────

function RuptureCard({ rupture, isSelected, onClick }: {
  rupture: RuptureEvent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const dirCls = directionBg(rupture.direction);
  const dirTxt = directionColor(rupture.direction);
  const mag = rupture.magnitude;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded border transition-all duration-200 ${
        isSelected
          ? "border-blue-500/60 bg-blue-500/8 shadow-[0_0_16px_rgba(59,130,246,0.15)]"
          : `${dirCls} hover:border-zinc-500/60`
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-white">{rupture.triggerAsset}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${assetClassBadge(rupture.assetClass)}`}>
              {rupture.assetClass}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[160px]">{rupture.triggerName}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-mono font-bold ${dirTxt}`}>
            {mag > 0 ? "+" : ""}{mag.toFixed(1)}%
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">{rupture.ruptureType}</div>
        </div>
      </div>

      <StrengthMeter value={rupture.strength} label="Rupture Strength" />

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Vol {rupture.volumeRatio.toFixed(1)}x avg</span>
        <span>Window: {rupture.aftershockWindowHours}h</span>
      </div>
    </button>
  );
}

// ── Aftershock Signal Card ─────────────────────────────────────

function AftershockCard({ signal }: { signal: AftershockSignal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-zinc-800/60 bg-zinc-900/40 rounded p-4 hover:border-zinc-700/60 transition-all duration-200 cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-bold text-white">{signal.relatedAsset}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${assetClassBadge(signal.relatedAssetClass)}`}>
              {signal.relatedAssetClass}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBg(signal.confirmationStatus)}`}>
              {signal.confirmationStatus}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{signal.relatedName}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-xs font-mono font-bold ${directionColor(signal.direction)}`}>
            {signal.direction}
          </div>
          {signal.currentReactionPercent !== null && (
            <div className={`text-[11px] font-mono mt-0.5 ${signal.currentReactionPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {signal.currentReactionPercent > 0 ? "+" : ""}{signal.currentReactionPercent.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Label + Trigger */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${labelColor(signal.label)}`}>
          {signal.label}
        </span>
        <span className="text-[10px] text-zinc-500">← {signal.triggerAsset}</span>
        <span className="text-[10px] text-zinc-600">{signal.relationshipType}</span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Probability</div>
          <div className="text-sm font-mono font-bold text-white">{signal.probability}%</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Timing</div>
          <div className="text-[11px] font-mono text-zinc-300">{signal.timingWindowLabel}</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Confidence</div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${confidenceDot(signal.confidence)}`} />
            <span className="text-[11px] font-mono text-zinc-300">{signal.confidence}</span>
          </div>
        </div>
      </div>

      <StrengthMeter value={signal.strength} label="Aftershock Strength" />

      {/* Expanded explanation */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60">
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Why This Aftershock?</div>
          <p className="text-xs text-zinc-300 leading-relaxed">{signal.explanation}</p>
        </div>
      )}

      <div className="mt-2 text-[10px] text-zinc-600 text-right">
        {expanded ? "▲ collapse" : "▼ expand explanation"}
      </div>
    </div>
  );
}

// ── Chain View ─────────────────────────────────────────────────

function ChainView({ chain }: { chain: AftershockChain }) {
  return (
    <div className="border border-zinc-800/60 bg-zinc-900/30 rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-white">{chain.triggerAsset}</span>
          <span className={`text-xs font-mono ${directionColor(chain.direction)}`}>{chain.direction}</span>
          <span className="text-[10px] text-zinc-500">{chain.ruptureType}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="text-emerald-400 font-mono">{chain.confirmedAftershocks} confirmed</span>
          <span>{chain.totalAftershocks} total</span>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">{chain.macroContext}</p>

      {/* Contagion path visualization */}
      <div className="flex items-center gap-1 flex-wrap mb-3">
        <span className="text-[10px] font-mono bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-white">
          {chain.triggerAsset}
        </span>
        {chain.signals.slice(0, 6).map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className={`text-[10px] ${directionColor(s.direction)}`}>→</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusBg(s.confirmationStatus)}`}>
              {s.relatedAsset}
            </span>
          </div>
        ))}
        {chain.signals.length > 6 && (
          <span className="text-[10px] text-zinc-600">+{chain.signals.length - 6} more</span>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

function AftershockEnginePageInner() {
  const { data, isLoading, error, refetch } = trpc.aftershock.getAnalysis.useQuery(undefined, {
    refetchInterval: 3 * 60 * 1000, // refresh every 3 min
    staleTime: 2 * 60 * 1000,
  });

  const [selectedRuptureId, setSelectedRuptureId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signals" | "chains" | "map">("signals");
  const [filterClass, setFilterClass] = useState<AssetClass | "All">("All");
  const [filterStatus, setFilterStatus] = useState<ConfirmationStatus | "All">("All");

  // Auto-select first rupture
  useEffect(() => {
    if (data?.activeRuptures?.length && !selectedRuptureId) {
      setSelectedRuptureId(data.activeRuptures[0].id);
    }
  }, [data]);

  const selectedRupture = useMemo(
    () => data?.activeRuptures?.find(r => r.id === selectedRuptureId) ?? null,
    [data, selectedRuptureId]
  );

  const filteredAftershocks = useMemo(() => {
    if (!data) return [];
    let list = selectedRuptureId
      ? data.aftershocks.filter(a => a.ruptureId === selectedRuptureId)
      : data.aftershocks;
    if (filterClass !== "All") list = list.filter(a => a.relatedAssetClass === filterClass);
    if (filterStatus !== "All") list = list.filter(a => a.confirmationStatus === filterStatus);
    return list;
  }, [data, selectedRuptureId, filterClass, filterStatus]);

  const confirmedCount  = data?.aftershocks.filter(a => a.confirmationStatus === "Confirmed").length ?? 0;
  const developingCount = data?.aftershocks.filter(a => a.confirmationStatus === "Developing").length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h1 className="text-lg font-mono font-bold tracking-tight text-white">
                    AFTERSHOCK ENGINE™
                  </h1>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-300 font-mono">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Market Contagion & Delayed Reaction Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {data && (
                <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-zinc-400">{data.activeRuptures.length} ruptures</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-zinc-400">{confirmedCount} confirmed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-zinc-400">{developingCount} developing</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => refetch()}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 border border-zinc-700/60 hover:border-zinc-600 px-3 py-1.5 rounded transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-red-500/40 border-t-red-500 rounded-full animate-spin" />
            <div className="text-sm font-mono text-zinc-500">Scanning markets for rupture events...</div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="text-red-400 font-mono text-sm">Engine error — {error.message}</div>
            <button onClick={() => refetch()} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
              Retry
            </button>
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* ── Summary Banner ── */}
            <div className="mb-6 p-4 rounded border border-zinc-800/60 bg-zinc-900/30">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Engine Summary</div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{data.summary}</p>
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="text-center">
                    <div className="text-xl font-mono font-bold text-white">{Math.round(data.pressureIndex)}</div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest">Pressure</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-mono font-bold ${
                      data.systemicRiskLevel === "Critical" ? "text-red-400" :
                      data.systemicRiskLevel === "High"     ? "text-orange-400" :
                      data.systemicRiskLevel === "Elevated" ? "text-amber-400" : "text-emerald-400"
                    }`}>{data.systemicRiskLevel}</div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest">Risk Level</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Main Layout ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">

              {/* ── Left: Rupture List ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Active Ruptures</div>
                  <div className="text-[10px] text-zinc-600 font-mono">{data.activeRuptures.length} detected</div>
                </div>

                {data.activeRuptures.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 text-sm font-mono">
                    No active ruptures detected
                  </div>
                ) : (
                  data.activeRuptures.map(rupture => (
                    <RuptureCard
                      key={rupture.id}
                      rupture={rupture}
                      isSelected={selectedRuptureId === rupture.id}
                      onClick={() => setSelectedRuptureId(
                        selectedRuptureId === rupture.id ? null : rupture.id
                      )}
                    />
                  ))
                )}

                {/* Selected rupture description */}
                {selectedRupture && (
                  <div className="mt-3 p-3 rounded border border-zinc-800/60 bg-zinc-900/30">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Rupture Detail</div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">{selectedRupture.description}</p>
                  </div>
                )}
              </div>

              {/* ── Right: Tabs ── */}
              <div>
                {/* Tab bar */}
                <div className="flex items-center gap-1 mb-4 border-b border-zinc-800/60 pb-0">
                  {(["signals", "chains", "map"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2.5 text-xs font-mono uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                        activeTab === tab
                          ? "border-blue-500 text-blue-300"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tab === "signals" ? "Aftershock Signals" : tab === "chains" ? "Contagion Chains" : "Ripple Map"}
                    </button>
                  ))}
                </div>

                {/* ── Signals Tab ── */}
                {activeTab === "signals" && (
                  <div>
                    {/* Filters */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <div className="flex gap-1">
                        {(["All", "Stock", "ETF", "Crypto", "Macro"] as const).map(cls => (
                          <button
                            key={cls}
                            onClick={() => setFilterClass(cls)}
                            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                              filterClass === cls
                                ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                                : "border-zinc-700/60 text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {(["All", "Confirmed", "Developing", "Unconfirmed"] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => setFilterStatus(st)}
                            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                              filterStatus === st
                                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                                : "border-zinc-700/60 text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                      <div className="ml-auto text-[10px] text-zinc-600 font-mono">
                        {filteredAftershocks.length} signals
                        {selectedRuptureId && (
                          <button
                            onClick={() => setSelectedRuptureId(null)}
                            className="ml-2 text-blue-400 hover:text-blue-300 underline"
                          >
                            show all
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredAftershocks.length === 0 ? (
                      <div className="text-center py-12 text-zinc-600 font-mono text-sm">
                        No aftershocks match the current filters
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {filteredAftershocks.map(signal => (
                          <AftershockCard key={signal.id} signal={signal} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Chains Tab ── */}
                {activeTab === "chains" && (
                  <div className="space-y-3">
                    {data.chains.length === 0 ? (
                      <div className="text-center py-12 text-zinc-600 font-mono text-sm">
                        No active contagion chains
                      </div>
                    ) : (
                      data.chains.map((chain, i) => (
                        <ChainView key={i} chain={chain} />
                      ))
                    )}
                  </div>
                )}

                {/* ── Map Tab ── */}
                {activeTab === "map" && (
                  <div>
                    <div className="border border-zinc-800/60 bg-zinc-900/30 rounded overflow-hidden" style={{ height: "420px" }}>
                      {data.activeRuptures.length > 0 ? (
                        <RippleCanvas ruptures={data.activeRuptures} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-sm">
                          No active ruptures to visualize
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {(["Bullish", "Bearish", "Uncertain"] as const).map(d => (
                        <div key={d} className={`p-3 rounded border ${directionBg(d)}`}>
                          <div className={`text-xs font-mono font-bold ${directionColor(d)} mb-1`}>{d}</div>
                          <div className="text-lg font-mono font-bold text-white">
                            {data.activeRuptures.filter(r => r.direction === d).length}
                          </div>
                          <div className="text-[10px] text-zinc-500">active ruptures</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 rounded border border-zinc-800/60 bg-zinc-900/30">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Legend</div>
                      <div className="flex flex-wrap gap-4 text-[10px] text-zinc-400 font-mono">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Bullish rupture node</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Bearish rupture node</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Uncertain rupture node</div>
                        <div className="flex items-center gap-1.5"><div className="w-8 h-px bg-blue-500/40" /> Contagion path</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Signal Label Reference ── */}
            <div className="mt-8 border-t border-zinc-800/60 pt-6">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">Aftershock Signal Classification Reference</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {([
                  ["Primary Rupture",       "The initial triggering event — the fault-line break."],
                  ["First-Wave Aftershock", "Immediate sympathy reaction within 2–6 hours of rupture."],
                  ["Delayed Reaction",      "Secondary reaction expected 6–48 hours after the rupture."],
                  ["Sympathy Momentum",     "Asset moving in alignment with the trigger via shared narrative."],
                  ["Sector Echo",           "Sector-wide replication of the primary move via ETF flows."],
                  ["Liquidity Spillover",   "Capital rotating from the trigger into related assets."],
                  ["Macro Shockwave",       "Macro-level contagion across asset classes and regimes."],
                  ["Fading Aftershock",     "Predicted reaction is weakening — probability declining."],
                  ["False Aftershock",      "Predicted reaction did not materialize — signal invalidated."],
                ] as [AftershockLabel, string][]).map(([label, desc]) => (
                  <div key={label} className={`p-2.5 rounded border text-[10px] ${labelColor(label)}`}>
                    <div className="font-mono font-bold mb-1">{label}</div>
                    <div className="text-zinc-500 leading-relaxed">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Disclaimer ── */}
            <div className="mt-6 p-4 rounded border border-zinc-800/40 bg-zinc-900/20">
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                <span className="text-zinc-500 font-mono">AFTERSHOCK ENGINE™</span> — Signals are generated from market data analysis and historical contagion patterns. Aftershock probabilities represent statistical likelihoods based on observed correlations, not guarantees of future price movements. This system is for informational and research purposes only. Not financial advice. Past contagion patterns do not guarantee future reactions. Always conduct independent research before making investment decisions.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function AftershockEnginePage() {
  return (
    <PremiumGateFull variant="aftershock">
      <AftershockEnginePageInner />
    </PremiumGateFull>
  );
}
