/* ============================================================
   FAULTLINE — Pressure Dashboard  (client/src/pages/Pressure.tsx)
   Palantir Noir aesthetic: void black, neon cyan, scanlines,
   corner brackets, Framer Motion animations.
   ============================================================ */
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, Zap } from "lucide-react";

// ── Types (mirror server output) ─────────────────────────────
type PressureLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

interface RiskVector {
  id: string;
  label: string;
  description: string;
  score: number;
  level: PressureLevel;
  driver: string;
  trend: "rising" | "falling" | "stable";
  weight: number;
  rawInputs: Record<string, number | null>;
}

interface PressureAlert {
  severity: "critical" | "high" | "elevated" | "moderate";
  title: string;
  detail: string;
}

interface HistoricalAnalog {
  year: number;
  label: string;
  similarity: number;
  description: string;
}

// ── Color helpers ─────────────────────────────────────────────
const LEVEL_COLORS: Record<PressureLevel, { primary: string; glow: string; bg: string; text: string }> = {
  Low:      { primary: "#00FF88", glow: "rgba(0,255,136,0.4)",   bg: "rgba(0,255,136,0.06)",   text: "#00FF88" },
  Moderate: { primary: "#00D4FF", glow: "rgba(0,212,255,0.4)",   bg: "rgba(0,212,255,0.06)",   text: "#00D4FF" },
  Elevated: { primary: "#FFB800", glow: "rgba(255,184,0,0.4)",   bg: "rgba(255,184,0,0.06)",   text: "#FFB800" },
  High:     { primary: "#FF6B00", glow: "rgba(255,107,0,0.4)",   bg: "rgba(255,107,0,0.06)",   text: "#FF6B00" },
  Critical: { primary: "#FF2D55", glow: "rgba(255,45,85,0.5)",   bg: "rgba(255,45,85,0.08)",   text: "#FF2D55" },
};

const SEVERITY_COLORS = {
  critical: "#FF2D55",
  high: "#FF6B00",
  elevated: "#FFB800",
  moderate: "#00D4FF",
};

function getLevelColor(level: PressureLevel) {
  return LEVEL_COLORS[level] ?? LEVEL_COLORS.Moderate;
}

// ── Corner bracket decoration ─────────────────────────────────
function CornerBrackets({ color = "rgba(0,212,255,0.3)", size = 10 }: { color?: string; size?: number }) {
  const s = `${size}px`;
  const style = { position: "absolute" as const, width: s, height: s, borderColor: color };
  return (
    <>
      <div style={{ ...style, top: 0, left: 0, borderTopWidth: "1px", borderLeftWidth: "1px", borderStyle: "solid" }} />
      <div style={{ ...style, top: 0, right: 0, borderTopWidth: "1px", borderRightWidth: "1px", borderStyle: "solid" }} />
      <div style={{ ...style, bottom: 0, left: 0, borderBottomWidth: "1px", borderLeftWidth: "1px", borderStyle: "solid" }} />
      <div style={{ ...style, bottom: 0, right: 0, borderBottomWidth: "1px", borderRightWidth: "1px", borderStyle: "solid" }} />
    </>
  );
}

// ── Scanline overlay ──────────────────────────────────────────
function Scanlines() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
        zIndex: 1,
      }}
    />
  );
}

// ── Animated pressure gauge (arc) ────────────────────────────
function PressureGaugeArc({ value, level }: { value: number; level: PressureLevel }) {
  const colors = getLevelColor(level);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H * 0.72;
    const r = W * 0.38;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    ctx.clearRect(0, 0, W, H);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.stroke();

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (i / 10) * Math.PI;
      const inner = r - 18;
      const outer = r - 8;
      const x1 = cx + inner * Math.cos(angle);
      const y1 = cy + inner * Math.sin(angle);
      const x2 = cx + outer * Math.cos(angle);
      const y2 = cy + outer * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)";
      ctx.lineWidth = i % 2 === 0 ? 1.5 : 1;
      ctx.stroke();
    }

    // Colored fill arc
    const fillAngle = startAngle + (value / 100) * Math.PI;
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, "#00FF88");
    grad.addColorStop(0.4, "#FFB800");
    grad.addColorStop(0.7, "#FF6B00");
    grad.addColorStop(1, "#FF2D55");

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, fillAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.stroke();

    // Glow
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, fillAngle);
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Needle
    const needleAngle = startAngle + (value / 100) * Math.PI;
    const nx = cx + (r - 6) * Math.cos(needleAngle);
    const ny = cy + (r - 6) * Math.sin(needleAngle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
    ctx.fillStyle = colors.primary;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [value, level, colors]);

  return <canvas ref={canvasRef} width={280} height={160} style={{ width: "100%", maxWidth: "280px" }} />;
}

// ── Mini bar for vector score ─────────────────────────────────
function ScoreBar({ score, level }: { score: number; level: PressureLevel }) {
  const colors = getLevelColor(level);
  return (
    <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
        style={{ height: "100%", background: colors.primary, borderRadius: "2px", boxShadow: `0 0 6px ${colors.glow}` }}
      />
    </div>
  );
}

// ── Trend icon ────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: "rising" | "falling" | "stable" }) {
  if (trend === "rising") return <TrendingUp size={12} style={{ color: "#FF6B00" }} />;
  if (trend === "falling") return <TrendingDown size={12} style={{ color: "#00FF88" }} />;
  return <Minus size={12} style={{ color: "#6B7280" }} />;
}

// ── Risk Vector Card ──────────────────────────────────────────
function VectorCard({ vector, index }: { vector: RiskVector; index: number }) {
  const colors = getLevelColor(vector.level);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      style={{
        position: "relative",
        background: "rgba(10,12,16,0.8)",
        border: `1px solid ${colors.primary}22`,
        borderRadius: "6px",
        padding: "16px",
        overflow: "hidden",
      }}
    >
      <CornerBrackets color={`${colors.primary}44`} size={8} />

      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: 0, right: 0,
        width: "60px", height: "60px",
        background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
        opacity: 0.3,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>
            VECTOR {String(index + 1).padStart(2, "0")}
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0", letterSpacing: "0.05em" }}>
            {vector.label.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <TrendIcon trend={vector.trend} />
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "22px",
            fontWeight: 700,
            color: colors.primary,
            textShadow: `0 0 12px ${colors.glow}`,
            lineHeight: 1,
          }}>
            {vector.score}
          </div>
        </div>
      </div>

      <ScoreBar score={vector.score} level={vector.level} />

      <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          color: colors.text,
          background: colors.bg,
          border: `1px solid ${colors.primary}33`,
          borderRadius: "3px",
          padding: "2px 6px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          {vector.level}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.06em" }}>
          WT {Math.round(vector.weight * 100)}%
        </div>
      </div>

      <div style={{ marginTop: "10px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>
        {vector.driver}
      </div>
    </motion.div>
  );
}

// ── Alert row ─────────────────────────────────────────────────
function AlertRow({ alert, index }: { alert: PressureAlert; index: number }) {
  const color = SEVERITY_COLORS[alert.severity];
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.5 + index * 0.07, ease: [0.23, 1, 0.32, 1] }}
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "12px",
        background: `${color}08`,
        border: `1px solid ${color}22`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "4px",
      }}
    >
      <AlertTriangle size={14} style={{ color, flexShrink: 0, marginTop: "1px" }} />
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, letterSpacing: "0.08em", fontWeight: 700 }}>
          {alert.title}
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", marginTop: "3px", lineHeight: 1.4 }}>
          {alert.detail}
        </div>
      </div>
    </motion.div>
  );
}

// ── Analog match bar ──────────────────────────────────────────
function AnalogBar({ analog, index, isTop }: { analog: HistoricalAnalog; index: number; isTop: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 + index * 0.08 }}
      style={{ marginBottom: "10px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: isTop ? "#FFB800" : "#94A3B8", fontWeight: isTop ? 700 : 400 }}>
            {analog.year} — {analog.label}
          </span>
          {isTop && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#FFB800", background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.3)", borderRadius: "3px", padding: "1px 5px", letterSpacing: "0.1em" }}>
              BEST MATCH
            </span>
          )}
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: isTop ? "#FFB800" : "#6B7280" }}>
          {analog.similarity}%
        </span>
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${analog.similarity}%` }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.7 + index * 0.1 }}
          style={{
            height: "100%",
            background: isTop ? "#FFB800" : "rgba(0,212,255,0.5)",
            borderRadius: "2px",
            boxShadow: isTop ? "0 0 6px rgba(255,184,0,0.4)" : "none",
          }}
        />
      </div>
      {isTop && (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#6B7280", marginTop: "4px", lineHeight: 1.4 }}>
          {analog.description}
        </div>
      )}
    </motion.div>
  );
}

// ── Liquidity Stress Meter ───────────────────────────────────
function LiquidityStressMeter({ vectors }: { vectors: RiskVector[] }) {
  const liq = vectors.find(v => v.id === "liquidity-stress");
  const credit = vectors.find(v => v.id === "credit-contagion");
  const vol = vectors.find(v => v.id === "volatility-regime");

  const meters = [
    { label: "HY SPREAD STRESS",   value: liq?.rawInputs?.hySpread ?? null,   max: 1000, unit: "bps",  color: "#FF6B00", desc: "High-yield credit spread above 300bps signals funding stress" },
    { label: "YIELD CURVE INVERSION", value: vol?.rawInputs?.t10y2y ?? null, max: 300, unit: "bps", color: "#FFB800", desc: "Negative 10Y-2Y spread historically precedes recession" },
    { label: "NFCI STRESS INDEX",   value: liq?.rawInputs?.nfci ?? null,       max: 3,   unit: "",    color: "#00D4FF", desc: "Chicago Fed National Financial Conditions Index — positive = tighter" },
    { label: "CREDIT SPREAD",       value: credit?.rawInputs?.hySpread ?? null, max: 1000, unit: "bps", color: "#FF2D55", desc: "Investment-grade and high-yield spread composite" },
  ].filter(m => m.value !== null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      style={{
        position: "relative",
        background: "rgba(10,12,16,0.85)",
        border: "1px solid rgba(0,212,255,0.12)",
        borderRadius: "8px",
        padding: "20px",
        overflow: "hidden",
      }}
    >
      <CornerBrackets color="rgba(0,212,255,0.25)" size={8} />

      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: "120px", height: "120px",
        background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "16px" }}>
        LIQUIDITY STRESS METER
      </div>

      {/* Overall liquidity score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "20px" }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 900,
          fontSize: "44px",
          color: getLevelColor(liq?.level ?? "Moderate").primary,
          textShadow: `0 0 20px ${getLevelColor(liq?.level ?? "Moderate").glow}`,
          lineHeight: 1,
        }}>
          {liq?.score ?? "—"}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563" }}>/100</div>
        <div style={{
          marginLeft: "auto",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          color: getLevelColor(liq?.level ?? "Moderate").text,
          background: getLevelColor(liq?.level ?? "Moderate").bg,
          border: `1px solid ${getLevelColor(liq?.level ?? "Moderate").primary}33`,
          borderRadius: "3px",
          padding: "2px 8px",
          letterSpacing: "0.1em",
        }}>
          {(liq?.level ?? "MODERATE").toUpperCase()}
        </div>
      </div>

      {/* Sub-metric bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {meters.map((m, i) => {
          // Normalize: for NFCI, higher = worse; for spreads, higher = worse
          const pct = m.label === "NFCI STRESS INDEX"
            ? Math.min(100, Math.max(0, ((m.value! + 0.5) / 3.5) * 100))
            : Math.min(100, Math.max(0, (m.value! / m.max) * 100));
          return (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", letterSpacing: "0.08em" }}>
                  {m.label}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: m.color, fontWeight: 700 }}>
                  {m.label === "NFCI STRESS INDEX" ? m.value!.toFixed(3) : Math.round(m.value!)} {m.unit}
                </span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.6 + i * 0.1 }}
                  style={{
                    height: "100%",
                    background: `linear-gradient(90deg, ${m.color}88, ${m.color})`,
                    borderRadius: "3px",
                    boxShadow: `0 0 8px ${m.color}66`,
                  }}
                />
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#374151", marginTop: "3px", lineHeight: 1.3 }}>
                {m.desc}
              </div>
            </div>
          );
        })}
        {meters.length === 0 && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#374151", textAlign: "center", padding: "16px" }}>
            LIVE DATA UNAVAILABLE — USING FALLBACK
          </div>
        )}
      </div>

      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#4B5563", lineHeight: 1.5 }}>
          {liq?.driver ?? "Liquidity conditions monitoring HY spreads, NFCI, and funding markets."}
        </div>
      </div>
    </motion.div>
  );
}

// ── Contagion Cascade Visualization ──────────────────────────
const CONTAGION_ORDER = [
  { id: "liquidity-stress",   label: "LIQUIDITY",    icon: "💧" },
  { id: "credit-contagion",   label: "CREDIT",       icon: "📉" },
  { id: "volatility-regime", label: "VOLATILITY",   icon: "⚡" },
  { id: "macro-sensitivity", label: "MACRO",         icon: "🏛" },
  { id: "market-breadth",    label: "BREADTH",       icon: "📊" },
  { id: "ai-bubble",         label: "SPECULATIVE",   icon: "🤖" },
];

function ContagionVisualization({ vectors, overallPressure }: { vectors: RiskVector[]; overallPressure: number }) {
  // Build ordered nodes from vectors
  const nodes = CONTAGION_ORDER.map(o => {
    const v = vectors.find(v2 => v2.id === o.id);
    return { ...o, score: v?.score ?? 0, level: v?.level ?? ("Low" as PressureLevel), trend: v?.trend ?? "stable" as const };
  });

  // Contagion threshold: a node "fires" if score > 35
  const THRESHOLD = 35;
  const fired = nodes.filter(n => n.score > THRESHOLD);
  const contagionPct = Math.round((fired.length / nodes.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      style={{
        position: "relative",
        background: "rgba(10,12,16,0.85)",
        border: "1px solid rgba(255,45,85,0.1)",
        borderRadius: "8px",
        padding: "20px",
        overflow: "hidden",
      }}
    >
      <CornerBrackets color="rgba(255,45,85,0.2)" size={8} />

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "16px" }}>
        CONTAGION RISK CASCADE
      </div>

      {/* Contagion spread % */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "20px" }}>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 900,
          fontSize: "44px",
          color: contagionPct >= 67 ? "#FF2D55" : contagionPct >= 33 ? "#FFB800" : "#00FF88",
          textShadow: contagionPct >= 67 ? "0 0 20px rgba(255,45,85,0.5)" : contagionPct >= 33 ? "0 0 20px rgba(255,184,0,0.4)" : "0 0 20px rgba(0,255,136,0.4)",
          lineHeight: 1,
        }}>
          {contagionPct}%
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563" }}>SPREAD</div>
        <div style={{
          marginLeft: "auto",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          color: contagionPct >= 67 ? "#FF2D55" : contagionPct >= 33 ? "#FFB800" : "#00FF88",
          background: contagionPct >= 67 ? "rgba(255,45,85,0.08)" : contagionPct >= 33 ? "rgba(255,184,0,0.06)" : "rgba(0,255,136,0.06)",
          border: `1px solid ${contagionPct >= 67 ? "rgba(255,45,85,0.3)" : contagionPct >= 33 ? "rgba(255,184,0,0.3)" : "rgba(0,255,136,0.3)"}`,
          borderRadius: "3px",
          padding: "2px 8px",
          letterSpacing: "0.1em",
        }}>
          {fired.length}/{nodes.length} VECTORS
        </div>
      </div>

      {/* Cascade nodes */}
      <div style={{ position: "relative" }}>
        {/* Vertical connector line */}
        <div style={{
          position: "absolute",
          left: "19px",
          top: "20px",
          bottom: "20px",
          width: "1px",
          background: "linear-gradient(to bottom, rgba(255,45,85,0.3), rgba(0,212,255,0.1))",
        }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {nodes.map((node, i) => {
            const active = node.score > THRESHOLD;
            const nodeColor = active ? getLevelColor(node.level).primary : "#1F2937";
            const glowColor = active ? getLevelColor(node.level).glow : "transparent";
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.07, ease: [0.23, 1, 0.32, 1] }}
                style={{ display: "flex", alignItems: "center", gap: "12px", paddingLeft: "4px" }}
              >
                {/* Node dot */}
                <div style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: nodeColor,
                  boxShadow: active ? `0 0 10px ${glowColor}` : "none",
                  border: `1px solid ${active ? nodeColor : "#374151"}`,
                  flexShrink: 0,
                  zIndex: 1,
                  position: "relative",
                  transition: "all 0.3s ease",
                }} />

                {/* Node content */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "10px",
                    color: active ? nodeColor : "#374151",
                    letterSpacing: "0.08em",
                    fontWeight: active ? 700 : 400,
                    transition: "color 0.3s ease",
                  }}>
                    {node.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Mini score bar */}
                    <div style={{ width: "60px", height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${node.score}%` }}
                        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.8 + i * 0.08 }}
                        style={{
                          height: "100%",
                          background: nodeColor,
                          borderRadius: "2px",
                          boxShadow: active ? `0 0 4px ${glowColor}` : "none",
                        }}
                      />
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "10px",
                      color: active ? nodeColor : "#374151",
                      fontWeight: 700,
                      minWidth: "24px",
                      textAlign: "right",
                    }}>
                      {node.score}
                    </div>
                    <TrendIcon trend={node.trend} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#4B5563", lineHeight: 1.5 }}>
          {fired.length === 0
            ? "No active contagion vectors — systemic linkages contained."
            : `${fired.length} vector${fired.length > 1 ? "s" : ""} above stress threshold (35/100). Contagion risk is ${contagionPct >= 67 ? "elevated" : contagionPct >= 33 ? "moderate" : "low"}.`}
        </div>
      </div>
    </motion.div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────
function PressureSkeleton() {
  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1F2937", animation: "fl-pulse 1.5s ease-in-out infinite" }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#374151", letterSpacing: "0.15em" }}>
          LOADING PRESSURE ENGINE…
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
        <div style={{ height: "320px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", animation: "fl-pulse 1.5s ease-in-out infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: "140px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", animation: `fl-pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Pressure Page ────────────────────────────────────────
export default function Pressure() {
  const { data, isLoading, error, refetch, isFetching } = trpc.pressure.getCurrentPressure.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 } // auto-refresh every 5 minutes
  );

  if (isLoading) return <PressureSkeleton />;

  if (error || !data) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <AlertTriangle size={32} style={{ color: "#FF2D55", margin: "0 auto 16px" }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#FF2D55", letterSpacing: "0.1em" }}>
          PRESSURE ENGINE OFFLINE
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#6B7280", marginTop: "8px" }}>
          {error?.message ?? "Failed to load pressure data"}
        </div>
        <button
          onClick={() => refetch()}
          style={{ marginTop: "16px", padding: "8px 16px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "4px", color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", cursor: "pointer" }}
        >
          RETRY
        </button>
      </div>
    );
  }

  const levelColors = getLevelColor(data.level);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050608",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <Scanlines />

      {/* Ambient background glow */}
      <div style={{
        position: "absolute",
        top: "10%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "300px",
        background: `radial-gradient(ellipse, ${levelColors.glow} 0%, transparent 70%)`,
        opacity: 0.12,
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 2, padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>

        {/* ── Page header ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <Zap size={16} style={{ color: levelColors.primary }} />
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: "#F0F4FF", letterSpacing: "0.12em" }}>
                PRESSURE ENGINE
              </span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.12em" }}>
              FAULTLINE SYSTEMIC RISK INDEX · {new Date(data.timestamp).toLocaleString()} · {data.dataSource.toUpperCase()}
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 12px",
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: "4px",
              color: "#00D4FF",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.08em",
              cursor: "pointer",
              opacity: isFetching ? 0.5 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            <RefreshCw size={10} style={{ animation: isFetching ? "fl-spin 1s linear infinite" : "none" }} />
            REFRESH
          </button>
        </motion.div>

        {/* ── Hero section: Gauge + Regime banner ──────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px", marginBottom: "24px" }}>

          {/* Gauge card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: "relative",
              background: "rgba(10,12,16,0.9)",
              border: `1px solid ${levelColors.primary}33`,
              borderRadius: "8px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <CornerBrackets color={`${levelColors.primary}55`} size={12} />

            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "8px" }}>
              PRESSURE INDEX
            </div>

            <PressureGaugeArc value={data.overallPressure} level={data.level} />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{ textAlign: "center", marginTop: "-8px" }}
            >
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 900,
                fontSize: "56px",
                color: levelColors.primary,
                textShadow: `0 0 30px ${levelColors.glow}`,
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}>
                {data.overallPressure}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.12em", marginTop: "2px" }}>
                / 100
              </div>
            </motion.div>

            {/* Level badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                marginTop: "14px",
                padding: "5px 16px",
                background: levelColors.bg,
                border: `1px solid ${levelColors.primary}44`,
                borderRadius: "4px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                color: levelColors.primary,
                letterSpacing: "0.15em",
                textShadow: `0 0 8px ${levelColors.glow}`,
              }}
            >
              {data.level.toUpperCase()}
            </motion.div>
          </motion.div>

          {/* Regime banner + alerts */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Regime banner */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              position: "relative",
              background: `linear-gradient(135deg, ${levelColors.bg} 0%, rgba(10,12,16,0.9) 100%)`,
              border: `1px solid ${levelColors.primary}44`,
              borderRadius: "8px",
              padding: "20px 24px",
              overflow: "hidden",
            }}
          >
            {/* top gradient rule */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${levelColors.primary}55, transparent)` }} />
            <CornerBrackets color={`${levelColors.primary}55`} size={10} />
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "6px" }}>
                CURRENT REGIME
              </div>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 900,
                fontSize: "28px",
                color: levelColors.primary,
                letterSpacing: "0.12em",
                textShadow: `0 0 20px ${levelColors.glow}`,
              }}>
                {data.regime}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", marginTop: "6px", letterSpacing: "0.06em" }}>
                Best analog: {data.topAnalog.year} {data.topAnalog.label} · {data.topAnalog.similarity}% match
              </div>
            </motion.div>

            {/* Top alerts */}
            <div style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              overflow: "hidden",
              background: "rgba(10,12,16,0.7)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "16px",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,184,0,0.2), transparent)" }} />
              <CornerBrackets color="rgba(255,184,0,0.25)" size={8} />
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "2px" }}>
                TOP RISK ALERTS
              </div>
              <AnimatePresence>
                {data.alerts.slice(0, 3).map((alert, i) => (
                  <AlertRow key={`${alert.title}-${i}`} alert={alert} index={i} />
                ))}
                {data.alerts.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#374151", padding: "12px", textAlign: "center" }}
                  >
                    NO ACTIVE ALERTS — SYSTEM STABLE
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Risk Vectors Grid ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            position: "relative",
            background: "rgba(10,12,16,0.88)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "24px",
            overflow: "hidden",
          }}
        >
          {/* top gradient rule */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.25), transparent)" }} />
          <CornerBrackets color="rgba(0,212,255,0.25)" size={10} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "14px" }}>
            RISK VECTORS — {data.vectors.length} ACTIVE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {data.vectors.map((vector, i) => (
              <VectorCard key={vector.id} vector={vector} index={i} />
            ))}
          </div>
        </motion.div>

        {/* ── Liquidity Stress Meter + Contagion visualization ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>

          {/* Liquidity Stress Meter */}
          <LiquidityStressMeter vectors={data.vectors} />

          {/* Contagion Cascade */}
          <ContagionVisualization vectors={data.vectors} overallPressure={data.overallPressure} />
        </div>

        {/* ── Bottom row: Analog matches + extra alerts ─────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

          {/* Historical Analogs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            style={{
              position: "relative",
              background: "rgba(10,12,16,0.8)",
              border: "1px solid rgba(0,212,255,0.1)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <CornerBrackets color="rgba(0,212,255,0.2)" size={8} />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "16px" }}>
              HISTORICAL ANALOG MATCH
            </div>
            {data.analogs.map((analog, i) => (
              <AnalogBar key={analog.year} analog={analog} index={i} isTop={i === 0} />
            ))}
          </motion.div>

          {/* All alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
            style={{
              position: "relative",
              background: "rgba(10,12,16,0.8)",
              border: "1px solid rgba(0,212,255,0.1)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <CornerBrackets color="rgba(0,212,255,0.2)" size={8} />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "16px" }}>
              FULL ALERT STACK
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.alerts.map((alert, i) => (
                <AlertRow key={`full-${i}`} alert={alert} index={i} />
              ))}
              {data.alerts.length === 0 && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#374151", padding: "12px", textAlign: "center" }}>
                  NO ACTIVE ALERTS
                </div>
              )}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
