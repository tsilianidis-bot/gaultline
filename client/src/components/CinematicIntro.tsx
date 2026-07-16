/* ============================================================
   FAULTLINE — Cinematic Introduction
   Five-scene documentary teaching the geological pressure
   philosophy, followed by a seamless ASHA awakening transition.

   First-time only (localStorage). Skippable. Replayable from Help.
   Scene flow:
     1. Earth / Tectonic Pressure (0–10s)
     2. Scientific Seismograph → FAULTLINE Seismograph (10–20s)
     3. Market Forces (20–30s)
     4. Platform Introduction (30–42s)
     5. Final Declaration + ENTER FAULTLINE (42–55s)
     6. ASHA Awakening Transition (55s → onComplete)
   ============================================================ */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEngine } from "../contexts/EngineContext";
import { trpc } from "../lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import AshaOrb from "./AshaOrb";
import { useLocation } from "wouter";

// ── Types ──────────────────────────────────────────────────────
type Scene = 1 | 2 | 3 | 4 | 5 | 6;

interface CinematicIntroProps {
  onComplete: () => void;
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

// ── Seismograph wave ───────────────────────────────────────────
function SeismicLine({ intensity = 1, color = "#00E5FF", scientific = false }: {
  intensity?: number; color?: string; scientific?: boolean;
}) {
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
      ctx.lineWidth = scientific ? 1.5 : 2;
      ctx.shadowBlur = scientific ? 4 : 12;
      ctx.shadowColor = color;

      for (let x = 0; x < w; x++) {
        const t = (x + offsetRef.current) / w;
        let y = mid;
        if (scientific) {
          // Scientific seismograph — small irregular tremors
          y = mid + Math.sin(t * 80) * 3 * intensity
            + Math.sin(t * 130 + 1.2) * 2 * intensity
            + Math.sin(t * 200 + 2.4) * 1 * intensity;
        } else {
          // FAULTLINE seismograph — dramatic pressure waves
          y = mid + Math.sin(t * 25) * 18 * intensity
            + Math.sin(t * 60 + 0.8) * 8 * intensity
            + Math.sin(t * 110 + 1.6) * 4 * intensity
            + Math.sin(t * 180 + 2.4) * 2 * intensity;
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [intensity, color, scientific]);

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
      {/* Deep earth gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 70%, rgba(180,80,20,0.15) 0%, rgba(100,40,10,0.08) 40%, transparent 70%)",
      }} />
      {/* Tectonic plates */}
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
      {/* Pressure accumulation glow */}
      <div style={{
        position: "absolute",
        top: "52%", left: "30%",
        width: "40%", height: "20%",
        background: "radial-gradient(ellipse, rgba(255,120,0,0.12) 0%, transparent 70%)",
        animation: "fl-pulse 3s ease-in-out infinite",
      }} />
      {/* Earth surface line */}
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
              <SeismicLine intensity={0.4 + Math.random() * 0.6} color={s.color} scientific />
            </div>
          </div>
        ))}
        {/* Convergence arrow */}
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
    {
      name: "PRESSURE INDEX™",
      desc: "Measures systemic market pressure across 10 engines.",
      color: "#00E5FF", delay: 0,
    },
    {
      name: "SEISMOGRAPH™",
      desc: "Visualizes how pressure changes over time.",
      color: "#FFAA00", delay: 0.3,
    },
    {
      name: "ASHA",
      desc: "Continuously interprets thousands of market signals in clear language.",
      color: "#00FF88", delay: 0.6,
    },
    {
      name: "AFTERSHOCK™",
      desc: "Tracks how markets react after major structural shifts.",
      color: "#C084FC", delay: 0.9,
    },
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
}: {
  visible: boolean;
  onEnter: () => void;
  userName?: string;
}) {
  const { output, isLoading } = useEngine();
  const [, navigate] = useLocation();

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

  // Generate greeting when scene becomes visible
  useEffect(() => {
    if (!visible || hasStarted.current || isLoading) return;
    hasStarted.current = true;
    setIsListening(true);

    const name = userName || "there";
    const fallback = `Welcome, ${name}.\n\nI'm ASHA — the intelligence layer of FAULTLINE.\n\nWhile you were watching, I was monitoring the markets.\n\nCurrent systemic pressure is ${output.overall.riskLevel.toUpperCase()} at ${output.overall.score.toFixed(1)}.\n\n${output.narrative.summary}\n\nLet me show you what is building beneath the surface today.`;

    greetingMutation.mutateAsync({
      userName: name,
      engineContext,
    }).then(res => {
      setGreeting(res.greeting || fallback);
    }).catch(() => {
      setGreeting(fallback);
    });
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

  const pressureColor = output.overall.riskLevel === 'critical' ? '#FF3B5C'
    : output.overall.riskLevel === 'high' ? '#FF6B35'
    : output.overall.riskLevel === 'elevated' ? '#FFAA00'
    : output.overall.riskLevel === 'moderate' ? '#FFDD00'
    : '#00E5FF';

  const regimeState = output.overall.riskLevel === 'critical' || output.overall.riskLevel === 'high'
    ? 'critical' as const
    : output.overall.riskLevel === 'elevated' || output.overall.riskLevel === 'moderate'
    ? 'rising' as const
    : 'calm' as const;

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px",
      opacity: visible ? 1 : 0,
      transition: "opacity 1.5s cubic-bezier(0.23,1,0.32,1)",
      pointerEvents: visible ? "auto" : "none",
    }}>
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

        {/* Greeting text */}
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "clamp(14px, 2.5vw, 16px)",
          lineHeight: 1.8,
          color: "rgba(255,255,255,0.88)",
          textAlign: "center",
          whiteSpace: "pre-wrap",
          minHeight: "120px",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s ease 0.6s",
        }}>
          {displayedGreeting}
          {!greetingDone && greeting && (
            <span style={{
              display: "inline-block", width: "2px", height: "1em",
              background: pressureColor, marginLeft: "2px",
              animation: "fl-pulse 0.8s ease-in-out infinite",
              verticalAlign: "text-bottom",
            }} />
          )}
        </div>

        {/* Live stats */}
        {statsVisible && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px", width: "100%",
            opacity: statsVisible ? 1 : 0,
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
            opacity: actionsVisible ? 1 : 0,
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

// ── Main CinematicIntro ────────────────────────────────────────
export const CINEMATIC_SEEN_KEY = "fl_cinematic_intro_v1";

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [scene, setScene] = useState<Scene>(1);
  const [exiting, setExiting] = useState(false);
  const [sceneVisible, setSceneVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { user } = useAuth();
  const canvasRef = useParticles(80, true);

  // Narrator lines per scene
  const narratorLines: Record<Scene, string[]> = {
    1: [
      "Most people think an earthquake begins when the ground shakes.",
      "It doesn't.",
      "For days... months... sometimes years...",
      "Pressure quietly builds beneath the surface.",
      "Invisible to almost everyone.",
    ],
    2: [
      "Scientists don't wait for the earthquake.",
      "They monitor the pressure.",
    ],
    3: [
      "Financial markets behave in remarkably similar ways.",
      "Major market shifts rarely begin without pressure building first.",
      "The signals exist.",
      "They are simply difficult to understand together.",
    ],
    4: [
      "That is why we built FAULTLINE.",
      "Not to predict the future with certainty.",
      "But to help you understand what is building beneath the surface.",
    ],
    5: [
      "The question isn't whether markets move.",
      "The question is whether you'll understand the pressure before everyone else.",
    ],
    6: [],
  };

  // Scene durations (ms)
  const sceneDurations: Record<Scene, number> = {
    1: 11000,
    2: 9000,
    3: 10000,
    4: 10000,
    5: 8000,
    6: 0, // stays until user acts
  };

  const [narratorIdx, setNarratorIdx] = useState(0);
  const [currentNarrator, setCurrentNarrator] = useState("");
  const [narratorVisible, setNarratorVisible] = useState(false);

  // Advance narrator lines within a scene
  useEffect(() => {
    const lines = narratorLines[scene];
    if (!lines.length) return;
    setNarratorIdx(0);
    setCurrentNarrator(lines[0]);
    setNarratorVisible(true);

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
  }, [scene]);

  const advanceScene = useCallback(() => {
    setSceneVisible(false);
    setTimeout(() => {
      setScene(s => {
        const next = Math.min(s + 1, 6) as Scene;
        return next;
      });
      setSceneVisible(true);
    }, 600);
  }, []);

  const handleSkip = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    setExiting(true);
    setTimeout(() => {
      try { localStorage.setItem(CINEMATIC_SEEN_KEY, "1"); } catch {}
      onComplete();
    }, 600);
  }, [onComplete]);

  const handleEnterFaultline = useCallback(() => {
    // From Scene 5 — transition to Scene 6 (ASHA awakening)
    setSceneVisible(false);
    setTimeout(() => {
      setScene(6);
      setSceneVisible(true);
    }, 600);
  }, []);

  const handleAshaComplete = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    setExiting(true);
    setTimeout(() => {
      try { localStorage.setItem(CINEMATIC_SEEN_KEY, "1"); } catch {}
      onComplete();
    }, 800);
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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000",
      opacity: exiting ? 0 : 1,
      transition: exiting ? "opacity 0.8s cubic-bezier(0.23,1,0.32,1)" : "none",
      overflow: "hidden",
    }}>
      {/* Particle field */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Deep space gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, rgba(0,20,40,0.8) 0%, rgba(0,0,0,0.95) 70%)",
        pointerEvents: "none",
      }} />

      {/* Scene content */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: sceneVisible ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}>
        {/* Scene 1 — Earth / Tectonic */}
        {scene === 1 && (
          <>
            <TectonicPlates visible={sceneVisible} />
            {/* Earth horizon glow */}
            <div style={{
              position: "absolute", top: "48%", left: 0, right: 0,
              height: "2px",
              background: "linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.2) 20%, rgba(0,229,255,0.4) 50%, rgba(0,229,255,0.2) 80%, transparent 100%)",
            }} />
          </>
        )}

        {/* Scene 2 — Seismograph transition */}
        {scene === 2 && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "24px",
          }}>
            {/* Scientific seismograph */}
            <div style={{
              width: "min(600px, 90vw)", height: "60px",
              opacity: 0.7,
            }}>
              <SeismicLine intensity={0.5} color="rgba(200,200,200,0.6)" scientific />
            </div>
            {/* Transform arrow */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px", letterSpacing: "0.2em",
              color: "rgba(0,229,255,0.4)",
            }}>↓</div>
            {/* FAULTLINE seismograph */}
            <div style={{
              width: "min(600px, 90vw)", height: "80px",
              position: "relative",
            }}>
              <SeismicLine intensity={1.2} color="#00E5FF" />
              {/* FAULTLINE label */}
              <div style={{
                position: "absolute", bottom: "-20px", right: 0,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px", letterSpacing: "0.2em",
                color: "rgba(0,229,255,0.5)",
              }}>FAULTLINE SEISMOGRAPH™</div>
            </div>
          </div>
        )}

        {/* Scene 3 — Market streams */}
        {scene === 3 && <MarketStreams visible={sceneVisible} />}

        {/* Scene 4 — Platform cards */}
        {scene === 4 && <PlatformCards visible={sceneVisible} />}

        {/* Scene 5 — Final declaration */}
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

            {/* ENTER FAULTLINE button */}
            <button
              onClick={handleEnterFaultline}
              style={{
                marginTop: "16px",
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
          }}>
            {narratorText}
            <span style={{
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
        <div style={{
          position: "absolute", bottom: "clamp(40px, 6vh, 60px)",
          left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: "8px",
        }}>
          {([1, 2, 3, 4, 5] as Scene[]).map(s => (
            <div key={s} style={{
              width: s === scene ? "20px" : "6px",
              height: "6px",
              borderRadius: "3px",
              background: s === scene ? "rgba(0,229,255,0.8)" : "rgba(255,255,255,0.2)",
              transition: "all 0.4s ease",
            }} />
          ))}
        </div>
      )}

      {/* Skip button */}
      {scene < 6 && (
        <button
          onClick={handleSkip}
          style={{
            position: "absolute", top: "20px", right: "20px",
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
      )}

      {/* Corner brackets */}
      {[
        { top: "12px", left: "12px", borderTop: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" },
        { top: "12px", right: "12px", borderTop: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" },
        { bottom: "12px", left: "12px", borderBottom: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" },
        { bottom: "12px", right: "12px", borderBottom: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" },
      ].map((style, i) => (
        <div key={i} style={{
          position: "absolute", width: "24px", height: "24px",
          ...style,
          opacity: 0.6,
        }} />
      ))}
    </div>
  );
}
