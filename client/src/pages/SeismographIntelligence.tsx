/**
 * FAULTLINE — Seismograph Intelligence
 *
 * Institutional macro intelligence briefing.
 * Single source of truth: all data from getUnifiedSeismographIntelligence().
 * Architecture: Executive Assessment → What Is Building → Why FAULTLINE Believes This
 *               → Supporting Evidence → Highest Probability Path → Historical Comparison
 *               → What Could Change → Invalidation Conditions → Ask FAULTLINE
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useRegisterAshaContext } from "@/contexts/AshaContext";
import { AshaIntelligenceBrief } from "@/components/AshaIntelligenceBrief";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";

// ── Color utilities ────────────────────────────────────────────────────────────

function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#f59e0b";
  if (score >= 25) return "#22c55e";
  return "#10b981";
}

function stressColor(level: string): string {
  if (level === "Crisis") return "#ef4444";
  if (level === "High") return "#f97316";
  if (level === "Elevated") return "#f59e0b";
  return "#22c55e";
}

function directionColor(dir: string): string {
  if (dir === "Deteriorating" || dir === "Accelerating") return "#f97316";
  if (dir === "Improving") return "#22c55e";
  return "#06b6d4";
}

function signalColor(sig: string): string {
  if (sig === "bearish" || sig === "stressed") return "#f97316";
  if (sig === "bullish" || sig === "recovering") return "#22c55e";
  return "#06b6d4";
}

// ── Reduced-motion helper ─────────────────────────────────────────────────────
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Animated count-up hook ────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return; }
    let raf: number;
    const start = performance.now() + delay;
    function tick(now: number) {
      const elapsed = Math.max(0, now - start);
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

// ── Staged load hook ──────────────────────────────────────────────────────────
// Returns a phase 0-5 that increments over time after data is ready
function useStagedLoad(ready: boolean): number {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!ready) return;
    if (prefersReducedMotion()) { setPhase(5); return; }
    const delays = [0, 200, 500, 800, 1200, 1800];
    delays.forEach((d, i) => {
      const t = setTimeout(() => setPhase(i + 1), d);
      timerRef.current.push(t);
    });
    return () => timerRef.current.forEach(clearTimeout);
  }, [ready]);
  return phase;
}

// ── Live seismograph waveform ─────────────────────────────────────────────────
interface WaveformProps {
  sparkline: { score: number }[];
  scoreColor: string;
  currentScore: number;
}

function LiveSeismographWave({ sparkline, scoreColor, currentScore }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const rm = prefersReducedMotion();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Build base points from sparkline (last 90 values)
    const pts = sparkline.length > 0 ? sparkline : Array.from({ length: 60 }, (_, i) => ({ score: currentScore + Math.sin(i * 0.3) * 4 }));
    const n = pts.length;

    // Compute y positions
    const ys = pts.map((p) => H - Math.max(4, (p.score / 100) * (H - 8)) - 4);

    // Add live tremor noise to the last 8 points
    const t = phaseRef.current;
    const noisedYs = ys.map((y, i) => {
      if (i < n - 8) return y;
      const age = n - 1 - i; // 0 = newest
      const amplitude = rm ? 0 : (2 - age * 0.22) * (currentScore / 100 + 0.3);
      return y + Math.sin(t * 0.08 + i * 1.7) * amplitude;
    });

    // Draw glow line (wide, low opacity)
    ctx.beginPath();
    ctx.strokeStyle = scoreColor + "30";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const xStep = W / (n - 1);
    noisedYs.forEach((y, i) => {
      const x = i * xStep;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw main line
    ctx.beginPath();
    ctx.strokeStyle = scoreColor + "cc";
    ctx.lineWidth = 1.5;
    noisedYs.forEach((y, i) => {
      const x = i * xStep;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw scan cursor (vertical line at the right edge, sweeping slightly)
    if (!rm) {
      const cursorX = W - 2 + Math.sin(t * 0.04) * 1.5;
      const cursorY = noisedYs[n - 1];
      ctx.beginPath();
      ctx.strokeStyle = scoreColor + "80";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, H);
      ctx.stroke();
      ctx.setLineDash([]);
      // Cursor dot
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
      ctx.fillStyle = scoreColor;
      ctx.fill();
      // Glow dot
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 6, 0, Math.PI * 2);
      ctx.fillStyle = scoreColor + "25";
      ctx.fill();
    }

    phaseRef.current += 1;
    animRef.current = requestAnimationFrame(draw);
  }, [sparkline, scoreColor, currentScore, rm]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={52}
      style={{ width: "100%", height: "52px", display: "block", borderRadius: "4px" }}
    />
  );
}

// ── Animated ProbBar ──────────────────────────────────────────────────────────
function AnimProbBar({ label, value, color, width = "100px", revealDelay = 0 }: { label: string; value: number; color: string; width?: string; revealDelay?: number }) {
  const [displayed, setDisplayed] = useState(prefersReducedMotion() ? value : 0);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) { setDisplayed(value); return; }
    let raf: number;
    const from = prevRef.current;
    const to = value;
    const start = performance.now() + revealDelay;
    const dur = 900;
    function tick(now: number) {
      const elapsed = Math.max(0, now - start);
      const p = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, revealDelay]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
      <div style={{ ...mono, width, fontSize: "9px", color: "rgba(6,182,212,0.55)", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "4px", background: "rgba(6,182,212,0.08)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, displayed)}%`, background: color, borderRadius: "2px", transition: "width 0.05s linear" }} />
      </div>
      <div style={{ ...mono, width: "30px", textAlign: "right", fontSize: "10px", color, fontWeight: 700, flexShrink: 0 }}>{displayed}%</div>
    </div>
  );
}

// ── Shared layout primitives ───────────────────────────────────────────────────

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Courier New',monospace" };

function Divider() {
  return <div style={{ width: "100%", height: "1px", background: "rgba(6,182,212,0.1)", margin: "0 0 20px" }} />;
}

function SectionLabel({ text, color }: { text: string; color?: string }) {
  return (
    <div style={{ ...mono, fontSize: "9px", letterSpacing: "0.16em", fontWeight: 700, color: color || "rgba(6,182,212,0.45)", marginBottom: "14px", textTransform: "uppercase" }}>
      {text}
    </div>
  );
}

function MetaChip({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.38)", fontWeight: 600 }}>{label}</div>
      <div style={{ ...mono, fontSize: "11px", fontWeight: 700, color: valueColor || "rgba(6,182,212,0.85)", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function ProbBar({ label, value, color, width = "100px" }: { label: string; value: number; color: string; width?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
      <div style={{ ...mono, width, fontSize: "9px", color: "rgba(6,182,212,0.55)", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "4px", background: "rgba(6,182,212,0.08)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, value)}%`, background: color, borderRadius: "2px", transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
      <div style={{ ...mono, width: "30px", textAlign: "right", fontSize: "10px", color, fontWeight: 700, flexShrink: 0 }}>{value}%</div>
    </div>
  );
}

function NarrativeBlock({ question, answer, accentColor }: { question: string; answer: string; accentColor?: string }) {
  return (
    <div style={{ marginBottom: "14px", paddingLeft: "12px", borderLeft: `2px solid ${accentColor || "rgba(6,182,212,0.25)"}` }}>
      <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: accentColor || "rgba(6,182,212,0.45)", fontWeight: 700, marginBottom: "5px" }}>{question}</div>
      <div style={{ fontSize: "13px", color: "rgba(226,232,240,0.82)", lineHeight: 1.65, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{answer}</div>
    </div>
  );
}

function EngineTag({ name }: { name: string }) {
  return (
    <span style={{ ...mono, display: "inline-block", fontSize: "8px", color: "rgba(6,182,212,0.55)", padding: "2px 6px", border: "1px solid rgba(6,182,212,0.15)", borderRadius: "3px", letterSpacing: "0.04em", marginRight: "4px", marginBottom: "4px" }}>
      {name}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SeismographIntelligence() {
  const [now, setNow] = useState(() => new Date());

  const { data: intel, isLoading, refetch, isFetching } = trpc.seismograph.getUnifiedIntelligence.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatUtc = (d: Date) =>
    d.toISOString().replace("T", " ").substring(0, 16) + " UTC";

  const scoreColor = intel ? pressureColor(intel.currentScore) : "#06b6d4";

  // ── Skeleton ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", ...mono }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.14em", color: "rgba(6,182,212,0.45)", marginBottom: "8px" }}>LOADING INTELLIGENCE</div>
          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(6,182,212,0.4)", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
      </div>
    );
  }

  if (!intel) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", ...mono }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.4)" }}>INTELLIGENCE UNAVAILABLE</div>
      </div>
    );
  }

  const {
    currentScore, currentRegime, currentStressLevel, currentDirection, currentPercentile,
    todayStory, keyDevelopments, whyThisScore, whyThisRegime,
    probabilities, evidenceFamilies, evidenceConsensus, enginesAgreeing, enginesDisagreeing,
    analogs, analogSummary, transitionProbabilities, evolution, memory,
    regimeProbabilities5way, developingConditions, engineContributions, marketNarrative,
    macroTicker, dataFreshness, lastUpdated,
  } = intel;

  const regimeProbs = regimeProbabilities5way;
  const topEngines = [...engineContributions].sort((a, b) => b.contributionWeight - a.contributionWeight).slice(0, 5);

  // ── Animation hooks ──────────────────────────────────────────
  const loadPhase = useStagedLoad(true); // intel is guaranteed non-null here
  const animatedScore = useCountUp(currentScore, 1100, 400);

  // Register ASHA page context — memoized to prevent infinite render loop
  const ashaCtx = useMemo(() => ({
    page: "seismograph" as const,
    pressureScore: currentScore,
    regime: currentRegime,
    narrative: todayStory,
    trend: currentDirection,
    keyDrivers: keyDevelopments?.slice(0, 3),
    historicalAnalog: analogs?.[0] ? `${analogs[0].period} (similarity: ${(analogs[0].similarity * 100).toFixed(0)}%)` : undefined,
    transitionProbability: transitionProbabilities?.transitionToElevated,
    additionalContext: {
      stressLevel: currentStressLevel,
      percentile: currentPercentile,
      enginesAgreeing,
      enginesDisagreeing,
      dataFreshness,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentScore, currentRegime, todayStory, currentDirection, currentStressLevel, currentPercentile, transitionProbabilities?.transitionToElevated]);
  useRegisterAshaContext(ashaCtx);

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e2e8f0", padding: "0 0 80px", opacity: loadPhase >= 1 ? 1 : 0, transition: "opacity 0.4s ease-out" }}>

      {/* ── STICKY HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(0,0,0,0.95)", borderBottom: "1px solid rgba(6,182,212,0.12)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "livepulse 2s infinite" }} />
            <span style={{ ...mono, fontSize: "10px", letterSpacing: "0.14em", fontWeight: 700, color: "#06b6d4" }}>FAULTLINE SEISMOGRAPH</span>
            <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.35)", letterSpacing: "0.06em" }}>{memory.observationCount} OBS · {memory.datasetSpan}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.35)" }}>{formatUtc(now)}</span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{ background: "none", border: "none", cursor: "pointer", color: isFetching ? "rgba(6,182,212,0.25)" : "rgba(6,182,212,0.5)", padding: 0, display: "flex", alignItems: "center" }}
            >
              <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px 0" }}>

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — CURRENT MARKET ASSESSMENT
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Current Market Assessment" color="rgba(6,182,212,0.6)" />

        {/* Score + regime row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "20px", flexWrap: "wrap", opacity: loadPhase >= 2 ? 1 : 0, transition: "opacity 0.5s ease-out" }}>
          {/* Big score */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", flexShrink: 0 }}>
            <div style={{ ...mono, fontSize: "56px", fontWeight: 800, color: scoreColor, lineHeight: 1, textShadow: `0 0 30px ${scoreColor}40`, animation: loadPhase >= 2 ? `seismo-glow-breathe 3s ease-in-out infinite` : "none", opacity: loadPhase >= 2 ? 1 : 0, transition: "opacity 0.5s ease-out" }}>
              {animatedScore}
            </div>
            <div style={{ ...mono, fontSize: "9px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.4)" }}>SYSTEMIC PRESSURE</div>
          </div>
          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px", flex: 1, minWidth: "200px" }}>
            <MetaChip label="CURRENT REGIME" value={currentRegime} valueColor={stressColor(currentStressLevel)} />
            <MetaChip label="STRESS LEVEL" value={currentStressLevel} valueColor={stressColor(currentStressLevel)} />
            <MetaChip label="PRESSURE TREND" value={currentDirection} valueColor={directionColor(currentDirection)} />
            <MetaChip label="CONFIDENCE" value={`${probabilities.confidence}%`} valueColor="rgba(6,182,212,0.85)" />
            <MetaChip label="HISTORICAL PERCENTILE" value={`${currentPercentile}th`} valueColor={scoreColor} />
            <MetaChip label="REGIME DURATION" value={memory.currentStreakDescription.split(" ").slice(-3).join(" ")} />
          </div>
        </div>

        {/* ── Live seismograph waveform ── */}
        {evolution.sparkline90d.length > 0 && (
          <div style={{ marginBottom: "20px", opacity: loadPhase >= 2 ? 1 : 0, transition: "opacity 0.7s ease-out 0.15s" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              LIVE PRESSURE SIGNAL
              <span style={{ display: "inline-block", width: "5px", height: "5px", borderRadius: "50%", background: scoreColor, boxShadow: `0 0 6px ${scoreColor}`, animation: "livepulse 2s infinite" }} />
            </div>
            <LiveSeismographWave sparkline={evolution.sparkline90d} scoreColor={scoreColor} currentScore={currentScore} />
            <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: "8px", color: "rgba(6,182,212,0.28)", marginTop: "4px" }}>
              <span>90 DAYS AGO</span><span>LIVE</span>
            </div>
          </div>
        )}

        {/* Macro ticker strip */}
        <div style={{ display: "flex", gap: "24px", marginBottom: "20px", padding: "10px 14px", background: "rgba(6,182,212,0.03)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.1)", flexWrap: "wrap", opacity: loadPhase >= 3 ? 1 : 0, transition: "opacity 0.5s ease-out" }}>
          {macroTicker.tsy10y !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.4)", letterSpacing: "0.06em" }}>10Y TSY</span>
              <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color: "#06b6d4" }}>{macroTicker.tsy10y.toFixed(2)}%</span>
              {macroTicker.tsy10yChange !== null && (
                <span style={{ ...mono, fontSize: "9px", color: macroTicker.tsy10yChange > 0 ? "#ef4444" : "#22c55e" }}>
                  {macroTicker.tsy10yChange > 0 ? "▲" : "▼"}
                </span>
              )}
            </div>
          )}
          {macroTicker.hySpreadBps !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.4)", letterSpacing: "0.06em" }}>HY SPREAD</span>
              <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color: "#06b6d4" }}>{macroTicker.hySpreadBps}bps</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.4)", letterSpacing: "0.06em" }}>DATA</span>
            <span style={{ ...mono, fontSize: "10px", fontWeight: 600, color: dataFreshness === "live" ? "#22c55e" : dataFreshness === "recent" ? "#f59e0b" : "rgba(6,182,212,0.5)" }}>
              {dataFreshness.toUpperCase()}
            </span>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.3)" }}>
              {new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Executive briefing paragraph */}
        <div style={{ marginBottom: "28px", padding: "18px 20px", background: "rgba(6,182,212,0.03)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.12)", borderLeft: `3px solid ${scoreColor}`, opacity: loadPhase >= 3 ? 1 : 0, transform: loadPhase >= 3 ? "translateY(0)" : "translateY(8px)", transition: "opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.14em", color: "rgba(6,182,212,0.4)", fontWeight: 700, marginBottom: "10px" }}>EXECUTIVE INTELLIGENCE BRIEFING</div>
          <p style={{ fontSize: "14px", color: "rgba(226,232,240,0.88)", lineHeight: 1.75, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
            {todayStory}
          </p>
        </div>

        {/* Key developments */}
        {keyDevelopments.length > 0 && (
          <div style={{ marginBottom: "28px", opacity: loadPhase >= 4 ? 1 : 0, transition: "opacity 0.5s ease-out" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.4)", fontWeight: 700, marginBottom: "10px" }}>KEY DEVELOPMENTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {keyDevelopments.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ ...mono, fontSize: "10px", color: "rgba(6,182,212,0.3)", flexShrink: 0, marginTop: "3px" }}>›</span>
                  <span style={{ fontSize: "13px", color: "rgba(226,232,240,0.72)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — WHAT IS BUILDING BENEATH THE SURFACE
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="What Is Building Beneath the Surface" color="rgba(245,158,11,0.6)" />

        <NarrativeBlock
          question="WHAT IS BUILDING"
          answer={marketNarrative.whatIsBuildingBeneathSurface}
          accentColor="rgba(245,158,11,0.5)"
        />

        {developingConditions.length > 0 && (
          <div style={{ marginBottom: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {developingConditions.map((c, i) => {
              const sevColor = c.severity === "Critical" ? "#ef4444" : c.severity === "High" ? "#f97316" : c.severity === "Moderate" ? "#f59e0b" : "#22c55e";
              const trendLabel = c.trend === "building" ? "▲ BUILDING" : c.trend === "easing" ? "▼ EASING" : "─ STABLE";
              const trendColor = c.trend === "building" ? "#f97316" : c.trend === "easing" ? "#22c55e" : "rgba(6,182,212,0.45)";
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", borderLeft: `2px solid ${sevColor}50` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <div style={{ ...mono, fontSize: "11px", fontWeight: 700, color: sevColor }}>{c.title}</div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                      <span style={{ ...mono, fontSize: "8px", color: trendColor, fontWeight: 700 }}>{trendLabel}</span>
                      <span style={{ ...mono, fontSize: "8px", color: sevColor, padding: "1px 5px", border: `1px solid ${sevColor}35`, borderRadius: "3px" }}>{c.severity.toUpperCase()}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.68)", lineHeight: 1.6, margin: "0 0 8px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c.description}</p>
                  {c.durationDescription && (
                    <p style={{ ...mono, fontSize: "10px", color: "rgba(6,182,212,0.45)", margin: "0 0 6px", lineHeight: 1.4 }}>{c.durationDescription}</p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {c.engines.map((e, j) => <EngineTag key={j} name={e} />)}
                  </div>
                  {c.expectedImpact && (
                    <p style={{ fontSize: "11px", color: "rgba(6,182,212,0.5)", fontStyle: "italic", margin: "6px 0 0", lineHeight: 1.45, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>Expected impact: {c.expectedImpact}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — WHY FAULTLINE BELIEVES THIS
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Why FAULTLINE Believes This" />

        <NarrativeBlock question="WHY THIS IS HAPPENING" answer={marketNarrative.whyIsItHappening} />
        <NarrativeBlock question="WHY THIS SCORE" answer={whyThisScore} />
        <NarrativeBlock question="WHY THIS REGIME" answer={whyThisRegime} />

        {/* Engine consensus */}
        <div style={{ marginBottom: "28px", padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.4)", fontWeight: 700 }}>ENGINE CONSENSUS</div>
            <span style={{ ...mono, fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "3px", background: evidenceConsensus === "strong" ? "rgba(34,197,94,0.12)" : evidenceConsensus === "divergent" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.1)", color: evidenceConsensus === "strong" ? "#22c55e" : evidenceConsensus === "divergent" ? "#ef4444" : "#f59e0b", border: `1px solid ${evidenceConsensus === "strong" ? "rgba(34,197,94,0.25)" : evidenceConsensus === "divergent" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.2)"}` }}>
              {evidenceConsensus.toUpperCase()}
            </span>
          </div>
          {enginesAgreeing.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ ...mono, fontSize: "8px", color: "rgba(34,197,94,0.5)", letterSpacing: "0.08em", marginBottom: "4px" }}>CONFIRMING</div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {enginesAgreeing.map((e, i) => <EngineTag key={i} name={e} />)}
              </div>
            </div>
          )}
          {enginesDisagreeing.length > 0 && (
            <div>
              <div style={{ ...mono, fontSize: "8px", color: "rgba(245,158,11,0.5)", letterSpacing: "0.08em", marginBottom: "4px" }}>DIVERGING</div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {enginesDisagreeing.map((e, i) => <EngineTag key={i} name={e} />)}
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 4 — SUPPORTING EVIDENCE
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Supporting Evidence" />

        {/* 5-way regime probabilities */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>REGIME PROBABILITY DISTRIBUTION</div>
          <AnimProbBar label="BULL MARKET" value={regimeProbs.bull} color="#22c55e" revealDelay={0} />
          <AnimProbBar label="SOFT LANDING" value={regimeProbs.softLanding} color="#06b6d4" revealDelay={100} />
          <AnimProbBar label="STAGFLATION" value={regimeProbs.stagflation} color="#f59e0b" revealDelay={200} />
          <AnimProbBar label="RECESSION" value={regimeProbs.recession} color="#f97316" revealDelay={300} />
          <AnimProbBar label="CRISIS / CRASH" value={regimeProbs.crash} color="#ef4444" revealDelay={400} />
        </div>

        {/* Evidence families */}
        <div style={{ marginBottom: "28px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {evidenceFamilies.map((ef, i) => {
            const sc = signalColor(ef.signal);
            return (
              <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "12px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: `2px solid ${sc}35` }}>
                <div style={{ flexShrink: 0, width: "90px" }}>
                  <div style={{ ...mono, fontSize: "9px", fontWeight: 700, color: sc, letterSpacing: "0.04em", marginBottom: "2px" }}>{ef.name}</div>
                  <div style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.35)", letterSpacing: "0.04em" }}>{ef.signal.toUpperCase()}</div>
                  <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ flex: 1, height: "3px", background: "rgba(6,182,212,0.08)", borderRadius: "2px" }}>
                      <div style={{ height: "100%", width: `${(ef.strength / 10) * 100}%`, background: sc, borderRadius: "2px" }} />
                    </div>
                    <span style={{ ...mono, fontSize: "8px", color: sc }}>{ef.strength.toFixed(1)}</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "11px", color: "rgba(226,232,240,0.72)", lineHeight: 1.55, margin: "0 0 4px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{ef.currentValue}</p>
                  <p style={{ fontSize: "10px", color: "rgba(6,182,212,0.45)", lineHeight: 1.45, margin: "0 0 4px", fontStyle: "italic", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{ef.whyItMatters}</p>
                  <p style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.3)", lineHeight: 1.4, margin: 0 }}>{ef.historicalContext}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Engine contributions */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>ENGINE CONTRIBUTIONS</div>
          {topEngines.map((e, i) => {
            const dc = e.direction === "bearish" ? "#f97316" : e.direction === "bullish" ? "#22c55e" : "rgba(6,182,212,0.5)";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
                <div style={{ ...mono, width: "130px", fontSize: "9px", color: "rgba(6,182,212,0.6)", flexShrink: 0, letterSpacing: "0.02em" }}>{e.engine}</div>
                <div style={{ flex: 1, height: "4px", background: "rgba(6,182,212,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.contributionWeight}%`, background: dc, borderRadius: "2px", transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <div style={{ ...mono, width: "28px", textAlign: "right", fontSize: "9px", color: dc, fontWeight: 700, flexShrink: 0 }}>{e.contributionWeight}%</div>
                <div style={{ ...mono, width: "60px", fontSize: "8px", color: dc, textAlign: "right", flexShrink: 0, letterSpacing: "0.04em" }}>{e.direction.toUpperCase()}</div>
              </div>
            );
          })}
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 5 — HIGHEST PROBABILITY PATH FORWARD
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Highest Probability Path Forward" color="rgba(6,182,212,0.6)" />

        <NarrativeBlock
          question="HIGHEST-PROBABILITY OUTCOME"
          answer={marketNarrative.highestProbabilityPath}
          accentColor="rgba(6,182,212,0.4)"
        />

        {probabilities.primaryDriver && (
          <NarrativeBlock question="PRIMARY DRIVER" answer={probabilities.primaryDriver} />
        )}

        <div style={{ marginBottom: "20px" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>REGIME TRANSITION PROBABILITIES</div>
          <AnimProbBar label="REMAIN IN REGIME" value={transitionProbabilities.remainInRegime} color="#06b6d4" width="140px" />
          <AnimProbBar label="TRANSITION ELEVATED" value={transitionProbabilities.transitionToElevated} color="#f97316" width="140px" revealDelay={100} />
          <AnimProbBar label="TRANSITION LOW" value={transitionProbabilities.transitionToLow} color="#22c55e" width="140px" revealDelay={200} />
          <AnimProbBar label="TRANSITION CRISIS" value={transitionProbabilities.transitionToCrisis} color="#ef4444" width="140px" revealDelay={300} />
        </div>

        {transitionProbabilities.historicalBasis && (
          <div style={{ marginBottom: "20px", padding: "10px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "4px" }}>HISTORICAL BASIS</div>
            <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{transitionProbabilities.historicalBasis}</p>
          </div>
        )}

        {probabilities.evidenceBasis && (
          <div style={{ marginBottom: "28px", padding: "10px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "4px" }}>EVIDENCE BASIS</div>
            <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{probabilities.evidenceBasis}</p>
          </div>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 6 — HISTORICAL COMPARISON
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Historical Comparison" />

        {/* 90-day sparkline */}
        {evolution.sparkline90d.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>PRESSURE EVOLUTION — 90 DAYS</div>
            <svg width="100%" height="44" viewBox={`0 0 ${evolution.sparkline90d.length} 44`} preserveAspectRatio="none" style={{ display: "block", borderRadius: "4px" }}>
              {evolution.sparkline90d.map((v, idx) => {
                const h = Math.max(2, (v.score / 100) * 40);
                return <rect key={idx} x={idx} y={44 - h} width="0.85" height={h} fill={pressureColor(v.score)} opacity="0.75" />;
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: "8px", color: "rgba(6,182,212,0.28)", marginTop: "4px" }}>
              <span>90 DAYS AGO</span><span>TODAY</span>
            </div>
          </div>
        )}

        {/* Trend summaries */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "20px" }}>
          {([
            { label: "7-DAY TREND", text: evolution.sevenDayTrend },
            { label: "30-DAY TREND", text: evolution.thirtyDayTrend },
            { label: "90-DAY TREND", text: evolution.ninetyDayTrend },
            { label: "12-MONTH TREND", text: evolution.yearTrend },
          ] as { label: string; text: string }[]).filter((t) => t.text).map(({ label, text }, i) => (
            <div key={i} style={{ padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.08)" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.35)", fontWeight: 700, marginBottom: "4px" }}>{label}</div>
              <p style={{ fontSize: "11px", color: "rgba(226,232,240,0.65)", lineHeight: 1.5, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Historical analogs */}
        {analogs.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>CLOSEST HISTORICAL ANALOGS</div>
            {analogSummary && (
              <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.55)", lineHeight: 1.6, margin: "0 0 12px", fontStyle: "italic", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{analogSummary}</p>
            )}
            {analogs.slice(0, 3).map((a, i) => (
              <div key={i} style={{ marginBottom: "10px", padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ ...mono, fontSize: "11px", fontWeight: 700, color: "#06b6d4" }}>{a.period}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.38)", letterSpacing: "0.06em" }}>SIMILARITY</span>
                    <span style={{ ...mono, fontSize: "11px", fontWeight: 700, color: "#06b6d4" }}>{a.similarity}%</span>
                  </div>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.55, margin: "0 0 10px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{a.description}</p>
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  {([
                    { label: "3M RETURN", val: a.avgReturn3m },
                    { label: "6M RETURN", val: a.avgReturn6m },
                    { label: "12M RETURN", val: a.avgReturn12m },
                  ] as { label: string; val: number | null }[]).map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.32)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                      <div style={{ ...mono, fontSize: "13px", fontWeight: 700, color: val === null ? "rgba(6,182,212,0.25)" : val >= 0 ? "#22c55e" : "#ef4444" }}>
                        {val !== null ? `${val > 0 ? "+" : ""}${val}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                {a.resolution && (
                  <p style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.38)", margin: "8px 0 0", lineHeight: 1.4 }}>Resolution: {a.resolution}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Historical stats */}
        <div style={{ marginBottom: "28px", padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>DATASET CONTEXT — {memory.datasetSpan}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "12px" }}>
            {([
              { label: "AVG PRESSURE", val: memory.historicalStats.avgPressure },
              { label: "MAX PRESSURE", val: memory.historicalStats.maxPressure },
              { label: "CRISIS MONTHS", val: memory.historicalStats.criticalMonths },
              { label: "HIGH-RISK MONTHS", val: memory.historicalStats.highRiskMonths },
            ] as { label: string; val: number }[]).map(({ label, val }) => (
              <div key={label}>
                <div style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.32)", letterSpacing: "0.08em", marginBottom: "3px" }}>{label}</div>
                <div style={{ ...mono, fontSize: "14px", fontWeight: 700, color: "rgba(6,182,212,0.75)" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 7 — WHAT COULD CHANGE THE OUTLOOK
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="What Could Change the Outlook" color="rgba(245,158,11,0.55)" />

        <NarrativeBlock
          question="WHAT HAS CHANGED"
          answer={marketNarrative.whatHasChanged}
          accentColor="rgba(245,158,11,0.4)"
        />

        {evolution.whatChanged.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>RECENT SHIFTS</div>
            {evolution.whatChanged.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "5px" }}>
                <span style={{ ...mono, fontSize: "10px", color: "rgba(245,158,11,0.4)", flexShrink: 0, marginTop: "2px" }}>›</span>
                <span style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.5, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        {evolution.whatToWatch.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(245,158,11,0.45)", fontWeight: 700, marginBottom: "8px" }}>WHAT TO WATCH</div>
            {evolution.whatToWatch.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px", padding: "8px 12px", background: "rgba(245,158,11,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(245,158,11,0.25)" }}>
                <span style={{ fontSize: "12px", color: "rgba(245,158,11,0.7)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 8 — INVALIDATION CONDITIONS
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Invalidation Conditions" color="rgba(239,68,68,0.5)" />

        <NarrativeBlock
          question="WHAT WOULD INVALIDATE THIS OUTLOOK"
          answer={marketNarrative.whatWouldInvalidate}
          accentColor="rgba(239,68,68,0.4)"
        />

        {evolution.invalidationConditions.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            {evolution.invalidationConditions.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px", padding: "8px 12px", background: "rgba(239,68,68,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(239,68,68,0.25)" }}>
                <span style={{ fontSize: "12px", color: "rgba(239,68,68,0.65)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════
            ASHA SEISMIC REPORT — inline intelligence brief
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: '24px' }}>
          <SectionErrorBoundary label="ASHA Intelligence"><AshaIntelligenceBrief variant="seismic-report" /></SectionErrorBoundary>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 9 — ASK ASHA
        ══════════════════════════════════════════════════════ */}
        <SectionLabel text="Ask ASHA" />

        <div style={{ padding: "20px", background: "rgba(6,182,212,0.03)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.12)", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "rgba(226,232,240,0.55)", lineHeight: 1.65, margin: "0 0 16px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
            Ask ASHA any question about the current market environment. ASHA reads the full FAULTLINE intelligence context before responding.
          </p>
          <Link href="/asha">
            <button style={{ ...mono, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700, color: "#050608", background: "#06b6d4", border: "none", borderRadius: "5px", padding: "10px 24px", cursor: "pointer", transition: "opacity 0.15s" }}>
              OPEN ASHA →
            </button>
          </Link>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "40px", paddingTop: "16px", borderTop: "1px solid rgba(6,182,212,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.28)", letterSpacing: "0.08em" }}>FAULTLINE SEISMOGRAPH™ · SINGLE SOURCE OF TRUTH</div>
          <div style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.28)" }}>{memory.observationCount} OBSERVATIONS · {memory.datasetSpan}</div>
        </div>

      </div>

      <style>{`
        @keyframes livepulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes seismo-glow-breathe {
          0%,100% { filter: brightness(1); }
          50% { filter: brightness(1.15) drop-shadow(0 0 12px currentColor); }
        }
        @keyframes seismo-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes seismo-scan-pulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
        @media (max-width: 480px) {
          .seismo-meta-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
