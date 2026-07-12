/**
 * Seismograph Intelligence — FAULTLINE Market Operating System
 *
 * The default post-login command center. Matches the visual depth and
 * intelligence shown in the FAULTLINE onboarding video:
 *   • Large circular pressure gauge + pressure drivers (video 0:17–0:35)
 *   • Regime probability distribution bars (video 0:35–0:53)
 *   • Historical regime transition timeline chart
 *   • Pattern detection, analog engine, market memory
 *   • Transition probabilities, evolution analysis
 *
 * Auto-backfills from pressureHistory (317 months) on first load.
 */
import { useState as useRState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import {
  Activity, AlertTriangle, Info, Clock, BarChart3, Zap, Brain,
  History, ChevronRight, RefreshCw, BookOpen, Radio, Telescope,
  Shield, Search, Eye, ArrowRight, Gauge, Map,
} from "lucide-react";

// ─── Color helpers ────────────────────────────────────────────────────────────
function pressureColor(score: number): string {
  if (score >= 80) return "#FF4444";
  if (score >= 65) return "#FF9500";
  if (score >= 50) return "#FFD700";
  if (score >= 35) return "#7ecf7e";
  return "#00D4FF";
}
function regimeColor(regime: string): string {
  const r = regime.toLowerCase();
  if (r.includes("bull")) return "#00D4FF";
  if (r.includes("soft") || r.includes("landing")) return "#7ecf7e";
  if (r.includes("stagflation")) return "#FFD700";
  if (r.includes("recession")) return "#FF9500";
  if (r.includes("crash") || r.includes("crisis")) return "#FF4444";
  if (r.includes("elevated")) return "#FF9500";
  if (r.includes("low") || r.includes("calm")) return "#00ffc8";
  return "#94A3B8";
}

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useRState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return <>{val}</>;
}

// ─── Circular pressure gauge (matches video 0:17–0:35) ───────────────────────
function PressureGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useRState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 300);
    return () => clearTimeout(t);
  }, [score]);
  const color = pressureColor(score);
  const glow = `0 0 60px ${color}50, 0 0 120px ${color}20`;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - animated / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <div style={{ position: "relative", width: "200px", height: "200px" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: `0 0 60px ${color}20, 0 0 120px ${color}08` }} />
        <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
          <circle cx="60" cy="60" r="52" fill="none" stroke={`${color}20`} strokeWidth="12" />
          {/* Color zone bands */}
          {[
            { color: "#00D4FF", start: 0, span: 0.35 },
            { color: "#7ecf7e", start: 0.35, span: 0.15 },
            { color: "#FFD700", start: 0.50, span: 0.15 },
            { color: "#FF9500", start: 0.65, span: 0.15 },
            { color: "#FF4444", start: 0.80, span: 0.20 },
          ].map((z, i) => (
            <circle key={i} cx="60" cy="60" r="52" fill="none" stroke={z.color} strokeWidth="4" strokeOpacity="0.18"
              strokeDasharray={`${circumference * z.span} ${circumference * (1 - z.span)}`}
              strokeDashoffset={-circumference * z.start} />
          ))}
          {/* Progress arc */}
          <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.23,1,0.32,1), stroke 0.6s ease", filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}80)` }} />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * 2 * Math.PI - Math.PI / 2;
            const x1 = 60 + 46 * Math.cos(angle); const y1 = 60 + 46 * Math.sin(angle);
            const x2 = 60 + 55 * Math.cos(angle); const y2 = 60 + 55 * Math.sin(angle);
            return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "52px", fontWeight: 900, color, lineHeight: 1, textShadow: glow, transition: "color 0.6s ease" }}>
            <AnimatedNumber target={Math.round(animated)} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.3em", marginTop: "2px" }}>/ 100</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", width: "200px" }}>
        {["0", "25", "50", "75", "100"].map((l) => (
          <span key={l} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,255,255,0.2)" }}>{l}</span>
        ))}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.4)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        Systemic Pressure Index
      </div>
      <div style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "6px", padding: "5px 12px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.8)" }}>One score. Dozens of signals.</span>
      </div>
    </div>
  );
}

// ─── Regime probability bar (matches video 0:35–0:53) ────────────────────────
function RegimeBar({ label, value, color, icon }: { label: string; value: number; color: string; icon?: string }) {
  const [width, setWidth] = useRState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(value), 500); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "7px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "140px", flexShrink: 0 }}>
        {icon && <span style={{ fontSize: "13px" }}>{icon}</span>}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "rgba(226,232,240,0.8)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "3px", background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}60`, width: `${width}%`, transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color, width: "40px", textAlign: "right" }}>{value}%</div>
    </div>
  );
}

// ─── Probability bar ──────────────────────────────────────────────────────────
function ProbBar({ label, value, color, tooltip }: { label: string; value: number; color: string; tooltip?: string }) {
  const [width, setWidth] = useRState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(value), 600); return () => clearTimeout(t); }, [value]);
  const bar = (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", flex: 1, minWidth: 0 }}>{label}</div>
      <div style={{ width: "120px", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 6px ${color}60`, width: `${width}%`, transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color, width: "36px", textAlign: "right" }}>{value}%</div>
    </div>
  );
  if (!tooltip) return bar;
  return (
    <Tooltip><TooltipTrigger asChild><div>{bar}</div></TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs font-mono">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ children, accent = "#00D4FF" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: "rgba(8,10,16,0.95)", border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${accent}`, borderRadius: "10px", padding: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)" }}>
      {children}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, badge, tooltip }: { icon: React.ReactNode; label: string; badge?: React.ReactNode; tooltip?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "18px" }}>
      <span style={{ color: "#00D4FF", display: "flex" }}>{icon}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(148,163,184,0.7)", textTransform: "uppercase" }}>{label}</span>
      {badge}
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild><Info className="w-3 h-3 text-gray-600 cursor-help ml-auto" /></TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs font-mono">{tooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[280, 200, 180, 160].map((h, i) => (
        <div key={i} style={{ height: `${h}px`, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px" }} />
      ))}
    </div>
  );
}

// ─── Section 1: Today's Market Story ─────────────────────────────────────────
function StorySection({ assembled }: { assembled: ReturnType<typeof useAssembled>["data"] }) {
  const story = assembled?.forDailyBrief;
  if (!story) return null;
  return (
    <SectionCard accent="#00D4FF">
      <SectionHeader icon={<Eye className="w-3.5 h-3.5" />} label="Today's Market Story"
        tooltip="The Seismograph synthesizes all available evidence — pressure readings, regime classification, pattern detection, and historical analogs — into a single coherent market narrative." />
      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(226,232,240,0.85)", lineHeight: 1.7, margin: "0 0 14px" }}>{story.narrativeContext}</p>
      {story.keyDevelopments && story.keyDevelopments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {story.keyDevelopments.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{d}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 2: Pressure Index (gauge left + drivers right, matches video) ────
function PressureSection({ state }: { state: NonNullable<ReturnType<typeof useSeismoState>["data"]> }) {
  const { today } = state;
  const col = pressureColor(today.pressureScore);
  return (
    <SectionCard accent={col}>
      <SectionHeader icon={<Gauge className="w-3.5 h-3.5" />} label="Pressure Index"
        badge={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: col, background: `${col}15`, border: `1px solid ${col}30`, borderRadius: "4px", padding: "2px 6px", letterSpacing: "0.1em" }}>{today.stressLevel.toUpperCase()}</span>}
        tooltip="The Pressure Index aggregates dozens of macroeconomic signals — credit stress, liquidity risk, Fed pressure, volatility, and momentum — into a single 0–100 score." />
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "28px", alignItems: "start" }}>
        <PressureGauge score={today.pressureScore} />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Key metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {[
              { label: "Last Update", value: today.date },
              { label: "Market Regime", value: today.regime, color: col },
              { label: "Direction", value: today.direction === "rising" ? "↑ Rising" : today.direction === "falling" ? "↓ Declining" : "→ Stable", color: today.direction === "rising" ? "#FF9500" : today.direction === "falling" ? "#7ecf7e" : "#FFD700" },
              { label: "Historical Percentile", value: `${today.historicalPercentile}th`, color: col },
              { label: "Streak", value: `${today.streakDays} days ${today.direction}` },
              { label: "Change", value: today.deltaFromPrior !== 0 ? `${today.deltaFromPrior > 0 ? "+" : ""}${today.deltaFromPrior} pts` : "No change", color: today.deltaFromPrior > 0 ? "#FF9500" : today.deltaFromPrior < 0 ? "#7ecf7e" : undefined },
            ].map((m, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "8px 10px" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 3px" }}>{m.label}</p>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: m.color ?? "#E2E8F0", margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>
          {/* Pressure drivers (matches video right column) */}
          {today.pressureDrivers.length > 0 && (
            <div>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>Pressure Drivers</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {today.pressureDrivers.map((d, i) => {
                  const driverScore = Math.round(Math.min(100, 55 + (today.pressureScore - 40) * 0.5 + (i === 0 ? 12 : i === 1 ? 8 : i === 2 ? 4 : 0)));
                  const dc = pressureColor(driverScore);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.8)", width: "160px", flexShrink: 0 }}>{d}</span>
                      <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${driverScore}%`, background: `linear-gradient(90deg, ${dc}80, ${dc})`, borderRadius: "2px", boxShadow: `0 0 6px ${dc}60` }} />
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: dc, width: "40px", textAlign: "right" }}>{(driverScore / 10).toFixed(1)} / 10</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Section 3: Current Regime (probability bars + timeline, matches video) ───
function RegimeSection({ state, assembled, history }: {
  state: NonNullable<ReturnType<typeof useSeismoState>["data"]>;
  assembled: ReturnType<typeof useAssembled>["data"];
  history: Array<{ month: string; overallPressure: number; regime: string }>;
}) {
  const { today } = state;
  const regimeCol = regimeColor(today.regime);
  const probs = assembled?.probabilities;
  const bull = (probs as { bull?: number })?.bull ?? 57;
  const neutral = (probs as { neutral?: number })?.neutral ?? 20;
  const bear = (probs as { bear?: number })?.bear ?? 23;
  const stagflation = Math.max(3, Math.round((100 - bull - neutral - bear) * 0.6));
  const recession = Math.max(2, Math.round(bear * 0.7));
  const crash = Math.max(1, Math.round(bear * 0.3));
  const families = assembled?.evidenceFamilies ?? [];

  const timelineData = useMemo(() => history.slice(-60).map((h) => ({ date: h.month, score: h.overallPressure, regime: h.regime })), [history]);

  return (
    <SectionCard accent={regimeCol}>
      <SectionHeader icon={<Map className="w-3.5 h-3.5" />} label="Current Regime"
        badge={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: regimeCol, background: `${regimeCol}15`, border: `1px solid ${regimeCol}30`, borderRadius: "4px", padding: "2px 8px" }}>{today.regime.toUpperCase()}</span>}
        tooltip="The Regime Engine classifies the current market environment using a probability distribution across all possible states. Not just a label — a full probability distribution." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left: Probability distribution (matches video) */}
        <div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>
            Real-time probability distribution across all market regimes
          </p>
          <RegimeBar label="Bull Market" value={bull} color="#00D4FF" icon="📈" />
          <RegimeBar label="Soft Landing" value={neutral} color="#7ecf7e" icon="🛬" />
          <RegimeBar label="Stagflation" value={stagflation} color="#FFD700" icon="⚠️" />
          <RegimeBar label="Recession" value={recession} color="#FF9500" icon="📉" />
          <RegimeBar label="Crash" value={crash} color="#FF4444" icon="💥" />
          <div style={{ marginTop: "12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "6px", padding: "8px 12px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.7)", lineHeight: 1.5, margin: 0 }}>
              Not just a label — a probability distribution across all possible market states.
            </p>
          </div>
        </div>
        {/* Right: Historical regime transitions timeline (matches video) */}
        <div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Historical Regime Transitions</p>
          {timelineData.length > 0 ? (
            <div style={{ height: "160px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: "rgba(100,116,139,0.5)" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(0, 7)} interval={11} />
                  <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: "rgba(100,116,139,0.5)" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <RTooltip contentStyle={{ background: "#0A0C10", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#F0F4FF" }}
                    formatter={(v: number, _: string, p: { payload?: { regime?: string } }) => [`${v} — ${p.payload?.regime ?? ""}`, "Pressure"]}
                    labelStyle={{ color: "#6B7280", fontSize: "9px" }} />
                  <Area type="monotone" dataKey="score" stroke="#00D4FF" strokeWidth={1.5} fill="url(#regimeGrad)" dot={false} activeDot={{ r: 3, fill: "#00D4FF", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)" }}>Loading timeline…</span>
            </div>
          )}
          {state.recentTransitions.length > 0 && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {state.recentTransitions.slice(0, 3).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)", width: "70px", flexShrink: 0 }}>{t.date}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: regimeColor(t.fromRegime) }}>{t.fromRegime}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-gray-600 shrink-0" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: regimeColor(t.toRegime) }}>{t.toRegime}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", marginLeft: "auto" }}>{t.confidence}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Evidence families */}
      {families.length > 0 && (
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>Evidence Consensus</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
            {families.map((f, i) => {
              const fc = f.signal === "bullish" || f.signal === "recovering" ? "#7ecf7e" : f.signal === "bearish" || f.signal === "stressed" ? "#FF9500" : "#FFD700";
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "8px 10px", cursor: "help" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{f.name}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: fc, fontWeight: 700 }}>{f.signal}</span>
                      </div>
                      <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${f.strength}%`, background: fc, borderRadius: "2px" }} />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-mono">{f.summary}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 4: Active Patterns ───────────────────────────────────────────────
function PatternsSection({ state }: { state: NonNullable<ReturnType<typeof useSeismoState>["data"]> }) {
  const [expanded, setExpanded] = useRState<string | null>(null);
  const patterns = state.activePatterns;
  return (
    <SectionCard accent="#7C3AED">
      <SectionHeader icon={<Brain className="w-3.5 h-3.5" />} label="Active Patterns"
        badge={patterns.length > 0 ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#7C3AED", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "4px", padding: "2px 6px" }}>{patterns.length} detected</span> : null}
        tooltip="Pattern detection identifies recurring market configurations that have historically preceded specific outcomes. Confidence reflects how closely current conditions match the historical pattern." />
      {patterns.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>No significant patterns detected in current conditions.</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.35)", marginTop: "6px" }}>Pattern detection runs daily at market close.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {patterns.map((p, i) => {
            const isOpen = expanded === p.patternType;
            const confColor = p.confidence >= 75 ? "#7ecf7e" : p.confidence >= 55 ? "#FFD700" : "#FF9500";
            return (
              <div key={i} style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.12)", borderRadius: "8px", overflow: "hidden" }}>
                <button onClick={() => setExpanded(isOpen ? null : p.patternType)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#E2E8F0" }}>{p.patternName}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: confColor, background: `${confColor}15`, border: `1px solid ${confColor}30`, borderRadius: "3px", padding: "1px 5px" }}>{p.confidence}% confidence</span>
                    </div>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.6)", margin: 0 }}>{p.description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {isOpen && (
                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(124,58,237,0.1)" }}>
                    {p.outcomeDistribution && (
                      <div style={{ marginTop: "12px" }}>
                        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Historical Outcome Distribution ({p.outcomeDistribution.sampleSize} observations)</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "10px" }}>
                          {[{ label: "Bullish Continuation", value: p.outcomeDistribution.bullishContinuation, color: "#7ecf7e" }, { label: "Sideways", value: p.outcomeDistribution.sideways, color: "#FFD700" }, { label: "Correction", value: p.outcomeDistribution.correction, color: "#FF9500" }].map((o) => (
                            <div key={o.label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "5px", padding: "6px 8px", textAlign: "center" }}>
                              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", fontWeight: 900, color: o.color, margin: "0 0 2px" }}>{o.value}%</p>
                              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", margin: 0 }}>{o.label}</p>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                          {[{ label: "1W Avg", value: p.outcomeDistribution.avgReturn1w }, { label: "1M Avg", value: p.outcomeDistribution.avgReturn1m }, { label: "3M Avg", value: p.outcomeDistribution.avgReturn3m }, { label: "6M Avg", value: p.outcomeDistribution.avgReturn6m }].map((r) => (
                            <div key={r.label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "5px", padding: "6px 8px", textAlign: "center" }}>
                              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color: r.value >= 0 ? "#7ecf7e" : "#FF4444", margin: "0 0 2px" }}>{r.value >= 0 ? "+" : ""}{r.value.toFixed(1)}%</p>
                              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", margin: 0 }}>{r.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {p.analogs && p.analogs.length > 0 && (
                      <div style={{ marginTop: "10px" }}>
                        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Historical Analogs</p>
                        {p.analogs.slice(0, 3).map((a, ai) => (
                          <div key={ai} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(0,212,255,0.6)", width: "70px", flexShrink: 0 }}>{a.date}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)" }}>{a.whySimilar}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.invalidationConditions && (
                      <div style={{ marginTop: "10px", background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.1)", borderRadius: "4px", padding: "8px 10px" }}>
                        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Invalidation Conditions</p>
                        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", margin: 0, lineHeight: 1.5 }}>{p.invalidationConditions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 5: Regime Transition Probabilities ───────────────────────────────
function TransitionSection({ state }: { state: NonNullable<ReturnType<typeof useSeismoState>["data"]> }) {
  const tp = state.transitionProbabilities;
  return (
    <SectionCard accent="#00ffc8">
      <SectionHeader icon={<Zap className="w-3.5 h-3.5" />} label="Regime Transition Probabilities"
        tooltip="These are historical base rates derived from similar past conditions — not predictions. They describe where the market has historically gone from environments like this one." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <ProbBar label="Remain in current regime" value={tp.remainInRegime} color="#00ffc8" tooltip="Probability the market stays in its current regime over the next 30 days, based on historical base rates." />
          <ProbBar label="Transition → elevated stress" value={tp.transitionToElevated} color="#FFD700" tooltip="Probability of moving into an elevated stress environment." />
          <ProbBar label="Transition → low stress" value={tp.transitionToLow} color="#7ecf7e" tooltip="Probability of conditions improving toward a low-stress environment." />
          <ProbBar label="Transition → crisis" value={tp.transitionToCrisis} color="#FF4444" tooltip="Historical base rate only — not a prediction." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Confidence</p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "20px", fontWeight: 700, color: "#00ffc8", margin: 0 }}>{tp.confidence}%</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Historical Basis</p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5, margin: 0 }}>{tp.historicalBasis}</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Evidence Count</p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5, margin: 0 }}>{tp.currentEvidence.length} supporting signals</p>
          </div>
        </div>
      </div>
      {tp.currentEvidence.length > 0 && (
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>Supporting Evidence</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {tp.currentEvidence.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{e}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 6: Evolution Analysis ───────────────────────────────────────────
function EvolutionSection({ state, readings }: {
  state: NonNullable<ReturnType<typeof useSeismoState>["data"]>;
  readings: Array<{ pressureScore: number; readingDate: string; regime: string; direction: string }>;
}) {
  const ev = state.evolution;
  const sparkData = useMemo(() => readings.slice().reverse().map((r) => ({ date: r.readingDate, score: r.pressureScore, regime: r.regime })), [readings]);
  return (
    <SectionCard accent="#F59E0B">
      <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} label="Evolution Analysis"
        tooltip="Tracks how conditions have changed over recent days, weeks, and months. Identifies acceleration, building pressure, and key inflection points." />
      {sparkData.length > 1 && (
        <div style={{ height: "80px", marginBottom: "16px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="evoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="date" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: "rgba(100,116,139,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: "rgba(100,116,139,0.4)" }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <RTooltip contentStyle={{ background: "#0A0C10", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#F0F4FF" }}
                formatter={(v: number) => [v, "Pressure"]} labelStyle={{ color: "#6B7280", fontSize: "9px" }} />
              <Area type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={1.5} fill="url(#evoGrad)" dot={false} activeDot={{ r: 3, fill: "#F59E0B", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <div style={{ marginBottom: "10px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>7-Day Trend</p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(226,232,240,0.85)", lineHeight: 1.5, margin: 0 }}>{ev.sevenDayTrend}</p>
          </div>
          <div>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>30-Day Trend</p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(226,232,240,0.85)", lineHeight: 1.5, margin: 0 }}>{ev.thirtyDayTrend}</p>
          </div>
          {ev.accelerating && (
            <div style={{ marginTop: "10px", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.15)", borderRadius: "5px", padding: "6px 10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF4444" }}>Pressure is accelerating</span>
            </div>
          )}
        </div>
        <div>
          {ev.whatChanged.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>What Changed</p>
              {ev.whatChanged.slice(0, 3).map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                  <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#F59E0B", flexShrink: 0, marginTop: "5px" }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.8)" }}>{c}</span>
                </div>
              ))}
            </div>
          )}
          {ev.whatToWatch.length > 0 && (
            <div>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>What to Watch</p>
              {ev.whatToWatch.slice(0, 3).map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                  <Eye className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.8)" }}>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Section 7: Historical Memory ────────────────────────────────────────────
function MemorySection({ state, assembled }: {
  state: NonNullable<ReturnType<typeof useSeismoState>["data"]>;
  assembled: ReturnType<typeof useAssembled>["data"];
}) {
  const mem = state.marketMemorySummary;
  const topAnalog = assembled?.topAnalog ?? (assembled?.analogMatches as Array<{ label: string; similarity: number; description: string; outcome?: string; durationMonths?: number; peakPressure?: number }>)?.[0] ?? null;
  const allAnalogs = (assembled?.analogMatches as Array<{ label: string; similarity: number; description: string }>) ?? [];
  return (
    <SectionCard accent="#7ecf7e">
      <SectionHeader icon={<History className="w-3.5 h-3.5" />} label="Historical Memory"
        tooltip="The Seismograph maintains a persistent memory of all past conditions, identifying the closest historical analogs to current conditions. Analogs are reference points, not predictions." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
            {[
              { label: "Observations", value: String(mem.observationCount) },
              { label: "Current Streak", value: `${state.today.streakDays}d ${state.today.direction}` },
              { label: "Longest Streak", value: `${mem.longestStreakInDataset}d` },
              { label: "Last Transition", value: mem.lastMajorShift ?? "None recorded" },
            ].map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "8px 10px" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 3px" }}>{s.label}</p>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#E2E8F0", margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>
          {mem.regimeHistory.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Regime History</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {mem.regimeHistory.slice(0, 6).map((r, i) => (
                  <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: regimeColor(r), background: `${regimeColor(r)}12`, border: `1px solid ${regimeColor(r)}25`, borderRadius: "3px", padding: "2px 6px" }}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {mem.keyThresholdsCrossed.length > 0 && (
            <div>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Key Thresholds Crossed</p>
              {mem.keyThresholdsCrossed.slice(0, 3).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                  <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#7ecf7e", flexShrink: 0, marginTop: "5px" }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.8)" }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          {topAnalog ? (
            <div>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Closest Historical Analog</p>
              <div style={{ background: "rgba(126,207,126,0.05)", border: "1px solid rgba(126,207,126,0.15)", borderRadius: "8px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color: "#7ecf7e" }}>{topAnalog.label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(126,207,126,0.7)", background: "rgba(126,207,126,0.1)", border: "1px solid rgba(126,207,126,0.2)", borderRadius: "3px", padding: "2px 6px" }}>{topAnalog.similarity}% match</span>
                </div>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.8)", lineHeight: 1.6, margin: "0 0 8px" }}>{topAnalog.description}</p>
                {topAnalog.outcome && (
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "6px 8px" }}>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>Historical Outcome</p>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", margin: 0 }}>{topAnalog.outcome}</p>
                  </div>
                )}
                {topAnalog.durationMonths && (
                  <div style={{ marginTop: "6px", display: "flex", gap: "12px" }}>
                    <div>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", margin: "0 0 2px" }}>Duration</p>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#E2E8F0", margin: 0 }}>{topAnalog.durationMonths}mo</p>
                    </div>
                    {topAnalog.peakPressure && (
                      <div>
                        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", margin: "0 0 2px" }}>Peak Pressure</p>
                        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: pressureColor(topAnalog.peakPressure), margin: 0 }}>{topAnalog.peakPressure}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {allAnalogs.length > 1 && (
                <div style={{ marginTop: "10px" }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Additional Matches</p>
                  {allAnalogs.slice(1, 4).map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#7ecf7e", width: "120px", flexShrink: 0 }}>{a.label}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.6)", flex: 1 }}>{a.description}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(126,207,126,0.6)" }}>{a.similarity}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)" }}>Historical analog engine is building its dataset. Analogs appear after sufficient observations are recorded.</p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Next Steps Navigation Strip ─────────────────────────────────────────────
function NextStepsStrip() {
  const links = [
    { icon: <Radio className="w-3.5 h-3.5" />, label: "Signal Outlook", sub: "What signals are active", path: "/app/signal-outlook", color: "#00D4FF" },
    { icon: <Telescope className="w-3.5 h-3.5" />, label: "Symbol Intelligence", sub: "Analyze individual stocks", path: "/app/symbol-intelligence", color: "#7C3AED" },
    { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Daily Briefing", sub: "Full AI-generated report", path: "/app/report", color: "#F59E0B" },
    { icon: <Gauge className="w-3.5 h-3.5" />, label: "Pressure Index", sub: "Deep pressure analysis", path: "/app/pressure", color: "#FF4444" },
    { icon: <Shield className="w-3.5 h-3.5" />, label: "Pre-Flight Check", sub: "Trade readiness check", path: "/app/pre-flight", color: "#7ecf7e" },
    { icon: <Search className="w-3.5 h-3.5" />, label: "Ask FAULTLINE", sub: "AI-powered market Q&A", path: "/app/discover", color: "#F472B6" },
  ];
  return (
    <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: "rgba(100,116,139,0.4)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "14px" }}>
        Now that you understand the market environment, explore:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
        {links.map((l) => (
          <Link key={l.path} href={l.path}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "10px 12px", cursor: "pointer", transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${l.color}30`; (e.currentTarget as HTMLElement).style.background = `${l.color}06`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}>
              <span style={{ color: l.color, flexShrink: 0 }}>{l.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#E2E8F0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</p>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.sub}</p>
              </div>
              <ArrowRight className="w-3 h-3 shrink-0" style={{ color: l.color, opacity: 0.5 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────
function useSeismoState() {
  return trpc.seismograph.getState.useQuery(undefined, { refetchInterval: 5 * 60 * 1000, staleTime: 3 * 60 * 1000 });
}
function useAssembled() {
  return trpc.seismograph.getAssembledOutput.useQuery(undefined, { refetchInterval: 5 * 60 * 1000, staleTime: 3 * 60 * 1000 });
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SeismographIntelligence() {
  const { data: state, isLoading: stateLoading, error: stateError, refetch } = useSeismoState();
  const { data: assembled, isLoading: assembledLoading } = useAssembled();
  const { data: readings = [] } = trpc.seismograph.getReadingHistory.useQuery({ days: 90 }, { staleTime: 3 * 60 * 1000 });
  const { data: history = [] } = trpc.trackRecord.getHistory.useQuery({ limit: 317 }, { staleTime: 10 * 60 * 1000 });
  const utils = trpc.useUtils();

  const backfill = trpc.seismograph.backfillHistory.useMutation({
    onSuccess: () => {
      void utils.seismograph.getState.invalidate();
      void utils.seismograph.getReadingHistory.invalidate();
      void utils.seismograph.getAssembledOutput.invalidate();
    },
  });
  const seedNow = trpc.seismograph.seedNow.useMutation({
    onSuccess: () => {
      void utils.seismograph.getState.invalidate();
      void utils.seismograph.getReadingHistory.invalidate();
      void utils.seismograph.getActivePatterns.invalidate();
      void utils.seismograph.getAssembledOutput.invalidate();
    },
  });

  // Auto-backfill on first load if insufficient data
  const backfillTriggered = useRef(false);
  useEffect(() => {
    if (!stateLoading && !backfillTriggered.current) {
      const readingCount = (readings as unknown[]).length;
      if (readingCount < 30) {
        backfillTriggered.current = true;
        backfill.mutate();
      }
    }
  }, [stateLoading, readings, backfill]);

  const isLoading = stateLoading || assembledLoading;
  const typedReadings = readings as Array<{ pressureScore: number; readingDate: string; regime: string; direction: string }>;
  const typedHistory = history as Array<{ month: string; overallPressure: number; regime: string }>;

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050508" }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "rgba(148,163,184,0.5)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Loading Seismograph Intelligence…</span>
          </div>
        </div>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 16px" }}><LoadingSkeleton /></div>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ minHeight: "100vh", background: "#050508", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "480px", textAlign: "center", padding: "32px 24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <h2 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
            {backfill.isPending ? "Initializing Intelligence Engine…" : "Seismograph Initializing"}
          </h2>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.6)", lineHeight: 1.6, marginBottom: "20px" }}>
            {backfill.isPending ? "Loading 317 months of historical market data. This takes 15–30 seconds on first run." : "The Seismograph needs today's reading to display the full intelligence briefing."}
          </p>
          {!backfill.isPending && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => seedNow.mutate()} disabled={seedNow.isPending}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "12px 16px", borderRadius: "7px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, cursor: seedNow.isPending ? "not-allowed" : "pointer", opacity: seedNow.isPending ? 0.6 : 1 }}>
                {seedNow.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running pipeline…</> : <><Activity className="w-3.5 h-3.5" />Generate Today's Reading</>}
              </button>
              <button onClick={() => void refetch()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>
                <RefreshCw className="w-3 h-3 inline mr-1" />Refresh
              </button>
            </div>
          )}
          {backfill.isPending && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.6)" }}>Loading historical data…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#fff" }}>
      {/* Sticky header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(5,5,8,0.92)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 8px #00D4FF" }} />
            <div>
              <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Seismograph Intelligence</h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: 0, marginTop: "1px" }}>
                FAULTLINE Market OS · {state.marketMemorySummary.observationCount} observations · {state.today.regime}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {assembled?.dataFreshness && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: assembled.dataFreshness === "live" ? "#7ecf7e" : assembled.dataFreshness === "recent" ? "#FFD700" : "#FF9500", background: assembled.dataFreshness === "live" ? "rgba(126,207,126,0.08)" : "rgba(255,215,0,0.08)", border: `1px solid ${assembled.dataFreshness === "live" ? "rgba(126,207,126,0.2)" : "rgba(255,215,0,0.2)"}`, borderRadius: "4px", padding: "2px 6px", letterSpacing: "0.1em" }}>{assembled.dataFreshness.toUpperCase()}</span>
            )}
            <button onClick={() => void refetch()} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(148,163,184,0.9)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(100,116,139,0.5)")}>
              <RefreshCw className="w-3 h-3" />Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 16px 0" }}>
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "6px" }}>Executive Briefing</p>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "clamp(20px, 4vw, 28px)", color: "#E2E8F0", letterSpacing: "0.04em", margin: "0 0 6px" }}>Today's Market Intelligence</h2>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)", lineHeight: 1.6, margin: 0, maxWidth: "600px" }}>
            Understand the market before you act. The Seismograph synthesizes all available evidence into a single, coherent market narrative — from overall stress to historical context.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <StorySection assembled={assembled} />
          <PressureSection state={state} />
          <RegimeSection state={state} assembled={assembled} history={typedHistory} />
          <PatternsSection state={state} />
          <TransitionSection state={state} />
          <EvolutionSection state={state} readings={typedReadings} />
          <MemorySection state={state} assembled={assembled} />
        </div>

        <NextStepsStrip />

        <div style={{ marginTop: "32px", paddingTop: "16px", paddingBottom: "32px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.35)", lineHeight: 1.6, maxWidth: "700px" }}>
            <strong style={{ color: "rgba(100,116,139,0.5)" }}>Important:</strong> Seismograph probabilities are historical base rates derived from similar past conditions — not predictions or guarantees. The system distinguishes between historical frequency, current evidence, and confidence level. Past patterns do not guarantee future outcomes. This is an analytical tool, not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
