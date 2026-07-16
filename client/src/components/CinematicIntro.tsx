/* ============================================================
   FAULTLINE — Cinematic Introduction v2
   Five-scene documentary + ASHA Awakening transition.

   Architectural upgrades (v2):
   1. Live pressure snapshot captured at cinematic START
   2. ASHA greeting generated from real delta between entry and exit
   3. Real SeismicWave component mounted in Scene 5 (stays alive)
   4. Skip behavior captures live state at skip moment
   5. onSceneEnter / onSceneExit hooks for future sound design
   6. aria-live regions for accessibility
   7. prefers-reduced-motion static fallback

   First-time only (localStorage). Skippable. Replayable from Help.
   Scene flow:
     1. Earth / Tectonic Pressure (0–11s)
     2. Scientific Seismograph → FAULTLINE Seismograph (9s)
     3. Market Forces (10s)
     4. Platform Introduction (10s)
     5. Final Declaration + ENTER FAULTLINE (8s)
     6. ASHA Awakening Transition (stays until user acts)
   ============================================================ */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEngine } from "../contexts/EngineContext";
import { trpc } from "../lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import AshaOrb from "./AshaOrb";
import SeismicWave from "./SeismicWave";
import { useLocation } from "wouter";
import { useCinematicAudio } from "../hooks/useCinematicAudio";
import { useNarrationAudio } from "../hooks/useNarrationAudio";
import { CinematicEngine } from "../lib/cinematicEngine";

// ── Types ──────────────────────────────────────────────────────
type Scene = 1 | 2 | 3 | 4 | 5 | 6;

export interface SceneHookPayload {
  scene: Scene;
  pressureScore: number;
  regime: string;
}

interface CinematicIntroProps {
  onComplete: () => void;
  /** Optional callbacks for sound design integration */
  onSceneEnter?: (payload: SceneHookPayload) => void;
  onSceneExit?: (payload: SceneHookPayload) => void;
}

// ── Snapshot of engine state at a point in time ───────────────
interface PressureSnapshot {
  score: number;
  riskLevel: string;
  regime: string;
  narrative: string;
  bullProbability: number;
  crashProbability: number;
  topDriver: string;
  analog: string;
  capturedAt: number; // Date.now()
}

// ── Particle field ─────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; opacity: number; color: string;
}

function useParticles(count: number, active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["rgba(0,229,255,", "rgba(255,170,0,", "rgba(255,255,255,"];
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.05,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles.current) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active, count]);

  return canvasRef;
}

// ── Scientific seismograph line (for Scene 2 only) ─────────────
function ScientificSeismicLine({ color = "rgba(200,200,200,0.6)" }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width, h = canvas.height;
      const mid = h / 2;
      offsetRef.current += 1.5;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = color;

      for (let x = 0; x < w; x++) {
        const t = (x + offsetRef.current) / w;
        const y = mid + Math.sin(t * 80) * 3
          + Math.sin(t * 130 + 1.2) * 2
          + Math.sin(t * 200 + 2.4) * 1;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ── Typewriter hook ────────────────────────────────────────────
function useTypewriter(text: string, speed = 28, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(""); setDone(false); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, active]);

  return { displayed, done };
}

// ── Tectonic plate visual ──────────────────────────────────────
function TectonicPlates({ visible }: { visible: boolean }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      opacity: visible ? 1 : 0,
      transition: "opacity 2s ease",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 70%, rgba(180,80,20,0.15) 0%, rgba(100,40,10,0.08) 40%, transparent 70%)",
      }} />
      {[
        { top: "55%", left: "-10%", width: "60%", height: "12px", rotate: "-3deg", color: "rgba(120,60,20,0.6)", delay: "0s" },
        { top: "58%", left: "45%", width: "65%", height: "12px", rotate: "2deg", color: "rgba(140,70,25,0.5)", delay: "0.3s" },
        { top: "65%", left: "10%", width: "80%", height: "8px", rotate: "-1deg", color: "rgba(100,50,15,0.4)", delay: "0.6s" },
      ].map((plate, i) => (
        <div key={i} style={{
          position: "absolute",
          top: plate.top, left: plate.left,
          width: plate.width, height: plate.height,
          background: plate.color,
          transform: `rotate(${plate.rotate})`,
          borderRadius: "2px",
          boxShadow: `0 0 20px ${plate.color}`,
          animation: `fl-pulse 4s ease-in-out infinite`,
          animationDelay: plate.delay,
        }} />
      ))}
      <div style={{
        position: "absolute",
        top: "52%", left: "30%",
        width: "40%", height: "20%",
        background: "radial-gradient(ellipse, rgba(255,120,0,0.12) 0%, transparent 70%)",
        animation: "fl-pulse 3s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        top: "50%", left: 0, right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)",
      }} />
    </div>
  );
}

// ── Market streams visual ──────────────────────────────────────
function MarketStreams({ visible }: { visible: boolean }) {
  const streams = [
    { label: "TREASURY", color: "#00E5FF", delay: 0 },
    { label: "CREDIT", color: "#FFAA00", delay: 0.2 },
    { label: "LIQUIDITY", color: "#00FF88", delay: 0.4 },
    { label: "VOLATILITY", color: "#FF6B6B", delay: 0.6 },
    { label: "INFLATION", color: "#C084FC", delay: 0.8 },
    { label: "BREADTH", color: "#60A5FA", delay: 1.0 },
    { label: "ROTATION", color: "#34D399", delay: 1.2 },
    { label: "RISK", color: "#F97316", delay: 1.4 },
  ];

  return (
    <div style={{
      position: "absolute", inset: 0,
      opacity: visible ? 1 : 0,
      transition: "opacity 1.5s ease",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        display: "flex", flexDirection: "column", gap: "10px",
        width: "min(480px, 90vw)",
      }}>
        {streams.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "12px",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-20px)",
            transition: `opacity 0.6s ease ${s.delay}s, transform 0.6s ease ${s.delay}s`,
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px", letterSpacing: "0.15em",
              color: s.color, opacity: 0.7, width: "80px", flexShrink: 0,
            }}>{s.label}</span>
            <div style={{
              flex: 1, height: "24px",
              position: "relative", overflow: "hidden",
            }}>
              <ScientificSeismicLine color={s.color} />
            </div>
          </div>
        ))}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: "8px", gap: "8px",
          opacity: visible ? 1 : 0,
          transition: "opacity 1s ease 1.6s",
        }}>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.4))" }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
            letterSpacing: "0.2em", color: "rgba(0,229,255,0.6)",
          }}>ONE UNIFIED SYSTEM</span>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(0,229,255,0.4), transparent)" }} />
        </div>
      </div>
    </div>
  );
}

// ── Platform preview cards ─────────────────────────────────────
function PlatformCards({ visible }: { visible: boolean }) {
  const cards = [
    { name: "PRESSURE INDEX™", desc: "Measures systemic market pressure across 10 engines.", color: "#00E5FF", delay: 0 },
    { name: "SEISMOGRAPH™", desc: "Visualizes how pressure changes over time.", color: "#FFAA00", delay: 0.3 },
    { name: "ASHA", desc: "Continuously interprets thousands of market signals in clear language.", color: "#00FF88", delay: 0.6 },
    { name: "AFTERSHOCK™", desc: "Tracks how markets react after major structural shifts.", color: "#C084FC", delay: 0.9 },
  ];

  return (
    <div style={{
      position: "absolute", inset: 0,
      opacity: visible ? 1 : 0,
      transition: "opacity 1s ease",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
        width: "min(520px, 90vw)",
      }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            background: "rgba(0,0,0,0.6)",
            border: `1px solid ${card.color}30`,
            borderRadius: "8px",
            padding: "16px",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
            transition: `opacity 0.5s ease ${card.delay}s, transform 0.5s ease ${card.delay}s`,
            boxShadow: `0 0 20px ${card.color}10`,
          }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.15em",
              color: card.color, marginBottom: "6px",
            }}>{card.name}</div>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "11px", lineHeight: 1.5,
              color: "rgba(255,255,255,0.55)",
            }}>{card.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ASHA Awakening Scene (Scene 6) ─────────────────────────────
function AshaAwakeningScene({
  visible,
  onEnter,
  userName,
  entrySnapshot,
}: {
  visible: boolean;
  onEnter: () => void;
  userName?: string;
  entrySnapshot: PressureSnapshot | null;
}) {
  const { output, isLoading } = useEngine();
  const [, navigate] = useLocation();

  // Build engine context using CURRENT live state for the greeting
  const engineContext = useMemo(() => ({
    pressureScore: output.overall.score,
    regime: output.regime.label,
    regimeConfidence: 85,
    narrative: output.narrative.summary,
    trend: output.overall.score > 5 ? "rising" : "stable",
    keyDrivers: output.domains.slice(0, 3).map(d => d.label),
  }), [output]);

  const greetingMutation = trpc.asha.dailyGreeting.useMutation();

  const [greeting, setGreeting] = useState("");
  const [greetingDone, setGreetingDone] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const hasStarted = useRef(false);

  // Generate greeting when scene becomes visible, using delta from entry snapshot
  useEffect(() => {
    if (!visible || hasStarted.current || isLoading) return;
    hasStarted.current = true;
    setIsListening(true);

    const name = userName || "there";
    const currentScore = output.overall.score;
    const currentRisk = output.overall.riskLevel;

    // Build delta context if we have an entry snapshot
    let deltaContext = "";
    if (entrySnapshot) {
      const scoreDelta = currentScore - entrySnapshot.score;
      const elapsed = Math.round((Date.now() - entrySnapshot.capturedAt) / 1000);
      if (Math.abs(scoreDelta) >= 0.2) {
        const direction = scoreDelta > 0 ? "increased" : "decreased";
        deltaContext = ` Pressure has ${direction} by ${Math.abs(scoreDelta).toFixed(1)} points since you began watching.`;
      } else if (elapsed > 30) {
        deltaContext = ` Conditions have remained stable during the introduction.`;
      }
    }

    const fallback = `Welcome, ${name}.\n\nI'm ASHA — the intelligence layer of FAULTLINE.\n\nWhile you were watching, I was monitoring the markets.${deltaContext}\n\nCurrent systemic pressure is ${currentRisk.toUpperCase()} at ${currentScore.toFixed(1)}.\n\n${output.narrative.summary}\n\nLet me show you what is building beneath the surface today.`;

    greetingMutation.mutateAsync({
      userName: name,
      engineContext: {
        ...engineContext,
        // Inject delta note into the narrative context
        narrative: engineContext.narrative + (deltaContext ? ` [Note: ${deltaContext.trim()}]` : ""),
      },
    }).then(res => {
      setGreeting(res.greeting || fallback);
    }).catch(() => {
      setGreeting(fallback);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isLoading]);

  // Typewriter for greeting
  const [displayedGreeting, setDisplayedGreeting] = useState("");
  const [greetingIdx, setGreetingIdx] = useState(0);

  useEffect(() => {
    if (!greeting) return;
    setGreetingIdx(0);
    setDisplayedGreeting("");
    setGreetingDone(false);
  }, [greeting]);

  useEffect(() => {
    if (!greeting || greetingDone) return;
    if (greetingIdx >= greeting.length) {
      setGreetingDone(true);
      setIsListening(false);
      setTimeout(() => setActionsVisible(true), 400);
      setTimeout(() => setStatsVisible(true), 800);
      return;
    }
    const t = setTimeout(() => {
      setDisplayedGreeting(greeting.slice(0, greetingIdx + 1));
      setGreetingIdx(i => i + 1);
    }, 22);
    return () => clearTimeout(t);
  }, [greeting, greetingIdx, greetingDone]);

  const actions = [
    { label: "Explain Today's Market", query: "Explain today's market conditions in detail." },
    { label: "What Changed Overnight?", query: "What changed in the markets overnight?" },
    { label: "Show the Seismograph", path: "/app/seismograph" },
    { label: "Search a Stock or Crypto", path: "/app/discover" },
  ];

  const handleAction = (action: typeof actions[0]) => {
    if (action.path) {
      onEnter();
      setTimeout(() => navigate(action.path!), 300);
    } else {
      onEnter();
      setTimeout(() => navigate(`/app/discover?q=${encodeURIComponent(action.query!)}`), 300);
    }
  };

  const pressureColor = output.overall.riskLevel === "critical" ? "#FF3B5C"
    : output.overall.riskLevel === "high" ? "#FF6B35"
    : output.overall.riskLevel === "elevated" ? "#FFAA00"
    : output.overall.riskLevel === "moderate" ? "#FFDD00"
    : "#00E5FF";

  const regimeState = output.overall.riskLevel === "critical" || output.overall.riskLevel === "high"
    ? "critical" as const
    : output.overall.riskLevel === "elevated" || output.overall.riskLevel === "moderate"
    ? "rising" as const
    : "calm" as const;

  return (
    <div
      role="region"
      aria-label="ASHA Intelligence Briefing"
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px",
        opacity: visible ? 1 : 0,
        transition: "opacity 1.5s cubic-bezier(0.23,1,0.32,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${pressureColor}08 0%, transparent 60%)`,
        transition: "background 2s ease",
      }} />

      <div style={{
        width: "100%", maxWidth: "560px",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "24px",
        position: "relative",
      }}>
        {/* ASHA Orb */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.8)",
          transition: "opacity 1s ease 0.3s, transform 1s cubic-bezier(0.23,1,0.32,1) 0.3s",
        }}>
          <AshaOrb
            regimeState={regimeState}
            size={64}
            isListening={isListening}
            label="ASHA · FAULTLINE INTELLIGENCE LAYER"
          />
        </div>

        {/* Greeting text — aria-live so screen readers announce it */}
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "clamp(14px, 2.5vw, 16px)",
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.88)",
            textAlign: "center",
            whiteSpace: "pre-wrap",
            minHeight: "120px",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.8s ease 0.6s",
          }}
        >
          {displayedGreeting}
          {!greetingDone && greeting && (
            <span style={{
              display: "inline-block", width: "2px", height: "1em",
              background: pressureColor, marginLeft: "2px",
              animation: "fl-pulse 0.8s ease-in-out infinite",
              verticalAlign: "text-bottom",
            }} aria-hidden="true" />
          )}
        </div>

        {/* Live stats */}
        {statsVisible && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px", width: "100%",
            animation: "fl-fade-in 0.6s ease forwards",
          }}>
            {[
              { label: "PRESSURE", value: output.overall.score.toFixed(1), color: pressureColor },
              { label: "BULL %", value: `${output.probability.bullProbability}%`, color: "#00FF88" },
              { label: "CRASH %", value: `${output.probability.crashProbability}%`, color: "#FF3B5C" },
            ].map((stat, i) => (
              <div key={i} style={{
                background: "rgba(0,0,0,0.5)",
                border: `1px solid ${stat.color}25`,
                borderRadius: "6px", padding: "10px",
                textAlign: "center",
              }}>
                <div style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: "18px", fontWeight: 700,
                  color: stat.color, letterSpacing: "0.05em",
                }}>{stat.value}</div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "8px", letterSpacing: "0.15em",
                  color: "rgba(255,255,255,0.35)", marginTop: "2px",
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {actionsVisible && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "8px", width: "100%",
            animation: "fl-fade-in 0.6s ease forwards",
          }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleAction(action)}
                style={{
                  background: "rgba(0,229,255,0.06)",
                  border: "1px solid rgba(0,229,255,0.2)",
                  borderRadius: "6px",
                  padding: "12px 10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: "rgba(0,229,255,0.8)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.12)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.4)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.2)";
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Enter platform link */}
        {actionsVisible && (
          <button
            onClick={onEnter}
            style={{
              background: "transparent",
              border: "none",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              padding: "8px",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; }}
          >
            CONTINUE TO DASHBOARD →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Static fallback for prefers-reduced-motion ─────────────────
function StaticIntroFallback({ onComplete }: { onComplete: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "24px",
      padding: "40px",
    }}>
      <div style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: "clamp(32px, 7vw, 64px)",
        fontWeight: 700,
        letterSpacing: "0.2em",
        background: "linear-gradient(135deg, #00E5FF, rgba(0,229,255,0.6))",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}>FAULTLINE</div>
      <div style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: "clamp(14px, 2vw, 18px)",
        lineHeight: 1.7,
        color: "rgba(255,255,255,0.75)",
        textAlign: "center",
        maxWidth: "560px",
      }}>
        Markets communicate long before they move.<br />
        FAULTLINE reveals what is building beneath the surface.
      </div>
      <button
        onClick={() => { onComplete(); }}
        style={{
          background: "transparent",
          border: "1px solid rgba(0,229,255,0.4)",
          borderRadius: "4px",
          padding: "14px 40px",
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "rgba(0,229,255,0.9)",
          cursor: "pointer",
        }}
      >
        ENTER FAULTLINE
      </button>
    </div>
  );
}

// ── Main CinematicIntro ────────────────────────────────────────
export const CINEMATIC_SEEN_KEY = "fl_cinematic_intro_v1";

export default function CinematicIntro({ onComplete, onSceneEnter, onSceneExit }: CinematicIntroProps) {
  // ── Sound design layer ────────────────────────────────────────
  const audio = useCinematicAudio();
  const narration = useNarrationAudio();
  const [scene, setScene] = useState<Scene>(1);
  const [exiting, setExiting] = useState(false);
  const [sceneVisible, setSceneVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { user } = useAuth();
  const { output, isLoading } = useEngine();
  const canvasRef = useParticles(120, true);
  // engineCanvasRef and engineRef live in CinematicIntroInner (where the canvas element is rendered)
  const engineCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CinematicEngine | null>(null);

  // ── Global audio unlock on first interaction ──────────────────
  // Unlocks Web Audio on the very first touch/click/key anywhere in the cinematic
  const audioUnlockedRef = useRef(false);
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      audio.unlockAndPlay();
      // Also unlock narration — play scene 1 narration on first gesture
      narration.unlockNarration(1);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upgrade 1: Capture live pressure snapshot at cinematic START ──
  const entrySnapshotRef = useRef<PressureSnapshot | null>(null);
  useEffect(() => {
    if (!isLoading && !entrySnapshotRef.current) {
      entrySnapshotRef.current = {
        score: output.overall.score,
        riskLevel: output.overall.riskLevel,
        regime: output.regime.label,
        narrative: output.narrative.summary,
        bullProbability: output.probability.bullProbability,
        crashProbability: output.probability.crashProbability,
        topDriver: output.domains[0]?.label ?? "Unknown",
        analog: output.analogs?.[0]?.era ?? "None",
        capturedAt: Date.now(),
      };
    }
  }, [isLoading, output]);

  // ── Upgrade 7: prefers-reduced-motion ─────────────────────────
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  if (reducedMotion) {
    return <StaticIntroFallback onComplete={onComplete} />;
  }

  // ── Audio: start on mount, play scene on change ───────────────
  // (These are called inside the outer component so they fire once,
  //  before the inner component mounts.)

  // Narrator lines per scene — compressed for 25–35 second total runtime
  // Scene 1: 5s  Scene 2: 7s  Scene 3: 7s  Scene 4: 8s  Scene 5: 5s  = ~32s
  const narratorLines: Record<Scene, string[]> = {
    1: [
      "Most people think an earthquake begins when the ground moves. It doesn't.",
    ],
    2: [
      "Pressure builds beneath the surface — invisible, until it isn't.",
    ],
    3: [
      "Financial markets aren't so different.\n\nLong before prices move, pressure is already building beneath the surface.",
    ],
    4: [
      "FAULTLINE measures that hidden pressure...\n\nreveals it through the Seismograph...\n\nand translates it through ASHA...\n\nso you can understand what is building beneath the surface.",
    ],
    5: [
      "Earthquakes don't begin when the ground moves.\n\nFinancial markets aren't so different.\n\nSee what's building beneath the surface.",
    ],
    6: [],
  };

  // Scene durations (ms) — total ~32 seconds
  const sceneDurations: Record<Scene, number> = {
    1: 5000,
    2: 7000,
    3: 7000,
    4: 8000,
    5: 5000,
    6: 0,
  };

  return <CinematicIntroInner
    scene={scene}
    setScene={setScene}
    exiting={exiting}
    setExiting={setExiting}
    sceneVisible={sceneVisible}
    setSceneVisible={setSceneVisible}
    timerRef={timerRef}
    user={user}
    output={output}
    canvasRef={canvasRef}
    engineCanvasRef={engineCanvasRef}
    engineRef={engineRef}
    narratorLines={narratorLines}
    sceneDurations={sceneDurations}
    onComplete={onComplete}
    onSceneEnter={onSceneEnter}
    onSceneExit={onSceneExit}
    entrySnapshot={entrySnapshotRef.current}
    audio={audio}
    narration={narration}
  />;
}

// ── Inner component (separated to allow hooks before early return) ─
function CinematicIntroInner({
  scene, setScene, exiting, setExiting, sceneVisible, setSceneVisible,
  timerRef, user, output, canvasRef, engineCanvasRef, engineRef, narratorLines, sceneDurations,
  onComplete, onSceneEnter, onSceneExit, entrySnapshot, audio, narration,
}: {
  scene: Scene;
  setScene: React.Dispatch<React.SetStateAction<Scene>>;
  exiting: boolean;
  setExiting: React.Dispatch<React.SetStateAction<boolean>>;
  sceneVisible: boolean;
  setSceneVisible: React.Dispatch<React.SetStateAction<boolean>>;
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout>[]>;
  user: { name?: string | null } | null | undefined;
  output: ReturnType<typeof useEngine>["output"];
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engineCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  engineRef: React.MutableRefObject<CinematicEngine | null>;
  narratorLines: Record<Scene, string[]>;
  sceneDurations: Record<Scene, number>;
  onComplete: () => void;
  onSceneEnter?: (payload: SceneHookPayload) => void;
  onSceneExit?: (payload: SceneHookPayload) => void;
  entrySnapshot: PressureSnapshot | null;
  audio: ReturnType<typeof useCinematicAudio>;
  narration: ReturnType<typeof import('../hooks/useNarrationAudio').useNarrationAudio>;
}) {
  const [narratorIdx, setNarratorIdx] = useState(0);
  const [currentNarrator, setCurrentNarrator] = useState("");
  const [narratorVisible, setNarratorVisible] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // ── Initialize CinematicEngine (runs here where the canvas element is mounted) ──
  useEffect(() => {
    const canvas = engineCanvasRef.current;
    if (!canvas) return;
    const eng = new CinematicEngine({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      pressureScore: output.overall.score,
      regime: output.regime.label,
    });
    eng.start();
    engineRef.current = eng;
    const onResize = () => {
      eng.resize(window.innerWidth, window.innerHeight);
      setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => {
      eng.stop();
      window.removeEventListener('resize', onResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep engine pressure in sync
  useEffect(() => {
    engineRef.current?.setPressureScore(output.overall.score);
  }, [output.overall.score]);

  // ── Upgrade 5: Fire onSceneEnter/onSceneExit hooks ────────────
  const fireHook = useCallback((hook: typeof onSceneEnter, s: Scene) => {
    if (!hook) return;
    hook({ scene: s, pressureScore: output.overall.score, regime: output.regime.label });
  }, [output, onSceneEnter]);

  // ── Audio: start on scene 1 mount, then change per scene ────────
  // Voiceover disabled — narration is captions-only on screen
  useEffect(() => {
    if (scene >= 1 && scene <= 5) {
      if (scene === 1) {
        audio.startAudio(1);
      } else {
        audio.playScene(scene as 1 | 2 | 3 | 4 | 5 | 6);
      }
    } else if (scene === 6) {
      audio.playScene(6);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Advance narrator lines within a scene
  useEffect(() => {
    const lines = narratorLines[scene];
    if (!lines.length) return;
    setNarratorIdx(0);
    setCurrentNarrator(lines[0]);
    setNarratorVisible(true);

    // Fire onSceneEnter
    fireHook(onSceneEnter, scene);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 0;
    for (let i = 1; i < lines.length; i++) {
      const lineDelay = lines[i - 1].length * 45 + 800;
      delay += lineDelay;
      const d = delay;
      const line = lines[i];
      timers.push(setTimeout(() => {
        setNarratorVisible(false);
        setTimeout(() => {
          setCurrentNarrator(line);
          setNarratorIdx(i);
          setNarratorVisible(true);
        }, 400);
      }, d));
    }
    timerRef.current.push(...timers);
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Auto-advance scenes
  useEffect(() => {
    if (scene === 6) return;
    const duration = sceneDurations[scene];
    const t = setTimeout(() => {
      advanceScene();
    }, duration);
    timerRef.current.push(t);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const advanceScene = useCallback(() => {
    // Fire onSceneExit for current scene
    fireHook(onSceneExit, scene);
    setSceneVisible(false);
    setTimeout(() => {
      setScene(s => {
        const next = Math.min(s + 1, 6) as Scene;
        return next;
      });
      setSceneVisible(true);
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, onSceneExit, fireHook]);

  // ── Upgrade 4: Skip captures live state at skip moment ────────
  const handleSkip = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    fireHook(onSceneExit, scene);
    setExiting(true);
    setTimeout(() => { onComplete(); }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, onComplete, onSceneExit, fireHook]);

  const handleEnterFaultline = useCallback(() => {
    fireHook(onSceneExit, scene);
    setSceneVisible(false);
    setTimeout(() => {
      setScene(6);
      setSceneVisible(true);
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, onSceneExit, fireHook]);

  const handleAshaComplete = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    setExiting(true);
    setTimeout(() => { onComplete(); }, 800);
  }, [onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => timerRef.current.forEach(clearTimeout);
  }, []);

  const { displayed: narratorText } = useTypewriter(
    currentNarrator,
    28,
    narratorVisible && scene < 6
  );

  // ── Audio: duck when narrator is speaking ─────────────────────
  useEffect(() => {
    if (scene < 6) {
      audio.duckForNarration(narratorVisible);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narratorVisible, scene]);

  // ── Glitch flash on scene transitions ─────────────────────────
  useEffect(() => {
    if (scene > 1) {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 180);
    }
  }, [scene]);

  // ── Drive CinematicEngine scene changes ───────────────────────
  useEffect(() => {
    if (engineRef.current && scene >= 1 && scene <= 5) {
      engineRef.current.setScene(scene as 1|2|3|4|5);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const pressureColor = output.overall.riskLevel === "critical" ? "#FF3B5C"
    : output.overall.riskLevel === "high" ? "#FF6B35"
    : output.overall.riskLevel === "elevated" ? "#FFAA00"
    : "#00E5FF";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FAULTLINE Introduction"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        opacity: exiting ? 0 : 1,
        transition: exiting ? "opacity 0.8s cubic-bezier(0.23,1,0.32,1)" : "none",
        overflow: "hidden",
      }}
    >
      {/* ── Upgrade 6: aria-live status region ─────────────────── */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}
      >
        {scene < 6 ? `Scene ${scene} of 5: ${currentNarrator}` : "ASHA Intelligence Briefing"}
      </div>

      {/* CinematicEngine — living canvas: all scenes, particles, atmosphere, earth, fault lines, data streams */}
      <canvas
        ref={engineCanvasRef}
        aria-hidden="true"
        width={canvasSize.w}
        height={canvasSize.h}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, width: "100%", height: "100%" }}
      />

      {/* Legacy particle field — kept as supplemental layer */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, opacity: 0.3 }}
      />

      {/* ── Bloomberg-cinema layers ─────────────────────────────── */}

      {/* CRT scanlines overlay */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
        mixBlendMode: "multiply",
      }} />

      {/* Noise grain */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 11,
        opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        animation: "fl-noise-drift 0.15s steps(1) infinite",
      }} />

      {/* Vignette — heavy cinematic border darkening */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 12,
        background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
      }} />

      {/* Corner brackets — Bloomberg terminal aesthetic */}
      {["top:0;left:0", "top:0;right:0", "bottom:0;left:0", "bottom:0;right:0"].map((pos, i) => {
        const [v, h] = pos.split(";");
        const isRight = h.includes("right");
        const isBottom = v.includes("bottom");
        return (
          <div key={i} aria-hidden="true" style={{
            position: "absolute",
            [v.split(":")[0]]: "16px",
            [h.split(":")[0]]: "16px",
            width: "28px", height: "28px",
            borderTop: isBottom ? "none" : "1px solid rgba(0,229,255,0.35)",
            borderBottom: isBottom ? "1px solid rgba(0,229,255,0.35)" : "none",
            borderLeft: isRight ? "none" : "1px solid rgba(0,229,255,0.35)",
            borderRight: isRight ? "1px solid rgba(0,229,255,0.35)" : "none",
            pointerEvents: "none", zIndex: 20,
            opacity: scene < 6 ? 0.7 : 0.3,
            transition: "opacity 1s ease",
          }} />
        );
      })}

      {/* Glitch flash on scene transition — brief RGB split */}
      {glitching && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30,
          animation: "fl-glitch-flash 0.18s ease forwards",
          background: "linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(255,0,80,0.04) 50%, rgba(0,255,136,0.04) 100%)",
          mixBlendMode: "screen",
        }} />
      )}

      {/* Live data ticker — top left, Bloomberg terminal style */}
      {scene >= 1 && scene < 6 && (
        <div aria-hidden="true" style={{
          position: "absolute", top: "20px", left: "20px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px", letterSpacing: "0.12em",
          color: "rgba(0,229,255,0.35)",
          pointerEvents: "none", zIndex: 20,
          lineHeight: 1.8,
        }}>
          <div style={{ color: "rgba(0,229,255,0.5)", marginBottom: "2px" }}>FAULTLINE INTELLIGENCE</div>
          <div>SCENE {scene}/5</div>
          <div style={{ marginTop: "4px", color: "rgba(255,255,255,0.2)" }}>LIVE FEED ACTIVE</div>
        </div>
      )}

      {/* Pressure readout — bottom left */}
      {scene >= 2 && scene < 6 && (
        <div aria-hidden="true" style={{
          position: "absolute", bottom: "clamp(40px, 6vh, 60px)", left: "20px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px", letterSpacing: "0.12em",
          color: "rgba(0,229,255,0.3)",
          pointerEvents: "none", zIndex: 20,
        }}>
          <div>PRESSURE {output.overall.score.toFixed(1)}/10</div>
          <div style={{ color: pressureColor, opacity: 0.6 }}>{output.regime.label.toUpperCase()}</div>
        </div>
      )}

      {/* Scene content */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: sceneVisible ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}>
        {/* Scenes 1–4: CinematicEngine renders all visuals on canvas — no DOM content needed */}

        {/* Scene 5 — Final declaration with live SeismicWave */}
        {scene === 5 && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "32px",
          }}>
            {/* FAULTLINE wordmark */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "clamp(36px, 8vw, 72px)",
              fontWeight: 700,
              letterSpacing: "0.2em",
              background: "linear-gradient(135deg, #00E5FF, rgba(0,229,255,0.6))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 60px rgba(0,229,255,0.3)",
              opacity: sceneVisible ? 1 : 0,
              transition: "opacity 1s ease",
            }}>FAULTLINE</div>

            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "clamp(10px, 1.5vw, 12px)",
              letterSpacing: "0.3em",
              color: "rgba(0,229,255,0.5)",
              opacity: sceneVisible ? 1 : 0,
              transition: "opacity 1s ease 0.3s",
            }}>SEE WHAT'S BUILDING BENEATH THE SURFACE.</div>

            {/* ── Upgrade 3: Real live SeismicWave in Scene 5 ── */}
            <div style={{
              width: "min(560px, 85vw)", height: "60px",
              opacity: sceneVisible ? 1 : 0,
              transition: "opacity 1.2s ease 0.5s",
            }}>
              <SeismicWave color={pressureColor} score={output.overall.score} height={60} />
            </div>

            {/* ENTER FAULTLINE button */}
            <button
              onClick={handleEnterFaultline}
              style={{
                background: "transparent",
                border: "1px solid rgba(0,229,255,0.4)",
                borderRadius: "4px",
                padding: "14px 40px",
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.3em",
                color: "rgba(0,229,255,0.9)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                opacity: sceneVisible ? 1 : 0,
                transform: sceneVisible ? "scale(1)" : "scale(0.95)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.08)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.7)";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.4)";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              ENTER FAULTLINE
            </button>
          </div>
        )}

        {/* Scene 6 — ASHA Awakening */}
        {scene === 6 && (
          <AshaAwakeningScene
            visible={sceneVisible && scene === 6}
            onEnter={handleAshaComplete}
            userName={user?.name?.split(" ")[0]}
            entrySnapshot={entrySnapshot}
          />
        )}
      </div>

      {/* Narrator text overlay (scenes 1–5) */}
      {scene < 6 && (
        <div style={{
          position: "absolute",
          bottom: "clamp(80px, 12vh, 140px)",
          left: "50%", transform: "translateX(-50%)",
          width: "min(600px, 85vw)",
          textAlign: "center",
          opacity: narratorVisible ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}>
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "clamp(14px, 2.5vw, 18px)",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.82)",
            margin: 0,
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
          }}>
            {narratorText}
            <span aria-hidden="true" style={{
              display: "inline-block", width: "2px", height: "1em",
              background: "rgba(0,229,255,0.7)",
              marginLeft: "2px", verticalAlign: "text-bottom",
              animation: "fl-pulse 0.8s ease-in-out infinite",
            }} />
          </p>
        </div>
      )}

      {/* Scene progress dots (scenes 1–5) */}
      {scene < 6 && (
        <div
          role="progressbar"
          aria-valuenow={scene}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-label={`Scene ${scene} of 5`}
          style={{
            position: "absolute", bottom: "clamp(40px, 6vh, 60px)",
            left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: "8px",
          }}
        >
          {([1, 2, 3, 4, 5] as Scene[]).map(s => (
            <div key={s} aria-hidden="true" style={{
              width: s === scene ? "20px" : "6px",
              height: "6px",
              borderRadius: "3px",
              background: s === scene ? "rgba(0,229,255,0.8)" : "rgba(255,255,255,0.2)",
              transition: "all 0.4s ease",
            }} />
          ))}
        </div>
      )}

      {/* Skip button + Mute toggle */}
      {scene < 6 && (
        <div style={{
          position: "absolute", top: "20px", right: "20px",
          display: "flex", gap: "8px", alignItems: "center",
        }}>
          {/* Mute / unmute */}
          <button
            onClick={() => {
              audio.toggleMute();
              narration.setNarrationMuted(!audio.isMuted);
            }}
            aria-label={audio.isMuted ? "Unmute sound" : "Mute sound"}
            title={audio.isMuted ? "Unmute" : "Mute"}
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              padding: "8px 12px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px", letterSpacing: "0.1em",
              color: audio.isMuted ? "rgba(255,255,255,0.25)" : "rgba(0,229,255,0.5)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = audio.isMuted ? "rgba(255,255,255,0.25)" : "rgba(0,229,255,0.5)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
            }}
          >
            {audio.isMuted ? "■■" : "▶■"}
          </button>

          {/* Skip */}
          <button
            onClick={handleSkip}
            aria-label="Skip introduction"
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              padding: "8px 16px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px", letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
            }}
          >
            SKIP INTRO
          </button>
        </div>
      )}

      {/* Enable Sound prompt — shown when browser blocked autoplay */}
      {audio.needsGesture && scene < 6 && (
        <button
          onClick={audio.unlockAndPlay}
          aria-label="Enable sound"
          style={{
            position: "absolute",
            bottom: "clamp(80px, 12vh, 140px)",
            right: "20px",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(0,229,255,0.2)",
            borderRadius: "4px",
            padding: "6px 12px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px", letterSpacing: "0.15em",
            color: "rgba(0,229,255,0.4)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex", alignItems: "center", gap: "6px",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,229,255,0.8)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.5)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,229,255,0.4)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.2)";
          }}
        >
          <span style={{ fontSize: "8px" }}>▶</span> SOUND ON
        </button>
      )}

      {/* Corner brackets */}
      {[
        { top: "12px", left: "12px", borderTop: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" },
        { top: "12px", right: "12px", borderTop: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" },
        { bottom: "12px", left: "12px", borderBottom: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" },
        { bottom: "12px", right: "12px", borderBottom: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" },
      ].map((style, i) => (
        <div key={i} aria-hidden="true" style={{
          position: "absolute", width: "24px", height: "24px",
          ...style,
          opacity: 0.6,
        }} />
      ))}
    </div>
  );
}
