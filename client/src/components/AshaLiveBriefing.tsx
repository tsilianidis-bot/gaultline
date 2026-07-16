/* ============================================================
   ASHA LIVE BRIEFING
   The first screen after "Enter FAULTLINE."
   The conversation simply continued.

   Layout:
   1. ASHA orb — large, listening, alive
   2. Personalized greeting — typewriter, 4 sentences
   3. Live market state — pressure + regime + biggest change + analog
   4. Four intelligent action buttons
   5. Seismic wave — full-bleed, pressure-reactive

   Design principle: this is not a dashboard.
   This is ASHA speaking directly to the user.
   ============================================================ */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useAuth } from "@/_core/hooks/useAuth";
import AshaOrb from "@/components/AshaOrb";
import type { AshaRegimeState } from "@/components/AshaOrb";

// ── Inline SeismicWave (canvas-based animated waveform) ───────
function SeismicWave({ color, score }: { color: string; score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let t = 0;
    const amplitude = 10 + score * 3;
    const freq1 = 0.022 + score * 0.003;
    const freq2 = 0.015 + score * 0.002;
    const freq3 = 0.035 + score * 0.005;
    let animId: number;
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 52;
    const ro = new ResizeObserver(() => { canvas.width = canvas.offsetWidth || 400; canvas.height = canvas.offsetHeight || 52; });
    ro.observe(canvas);
    const draw = () => {
      const w = canvas.width; const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath(); ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) { const y = h / 2 + Math.sin(x * freq1 + t) * amplitude * Math.sin(x * 0.007 + t * 0.25) * 1.6; ctx.lineTo(x, y); }
      ctx.strokeStyle = color + '18'; ctx.lineWidth = 10; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) { const y = h / 2 + Math.sin(x * freq2 + t * 0.85) * (amplitude * 0.7) * Math.sin(x * 0.01 + t * 0.4); ctx.lineTo(x, y); }
      ctx.strokeStyle = color + '28'; ctx.lineWidth = 5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) { const y = h / 2 + Math.sin(x * freq1 + t) * amplitude * Math.sin(x * 0.007 + t * 0.25); ctx.lineTo(x, y); }
      ctx.strokeStyle = color + 'D0'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) { const y = h / 2 + Math.sin(x * freq3 + t * 1.3) * (amplitude * 0.25); ctx.lineTo(x, y); }
      ctx.strokeStyle = color + '50'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
      t += 0.038;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [color, score]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '52px', display: 'block', opacity: 0.9 }} />;
}

interface AshaLiveBriefingProps {
  onContinue: () => void;
}

// ── Typewriter hook ───────────────────────────────────────────
function useTypewriter(text: string, speed = 22, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);
  useEffect(() => {
    if (!active || !text) return;
    setDisplayed("");
    setDone(false);
    idxRef.current = 0;
    const iv = setInterval(() => {
      idxRef.current++;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) {
        clearInterval(iv);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, active]);
  return { displayed, done };
}

// ── Pressure color helper ─────────────────────────────────────
function getPressureColor(score: number): string {
  if (score >= 7) return "#FF3B5C";
  if (score >= 5.5) return "#FF9500";
  if (score >= 4) return "#FFD700";
  return "#00FF99";
}

function getPressureLabel(score: number): string {
  if (score >= 7) return "CRITICAL";
  if (score >= 5.5) return "ELEVATED";
  if (score >= 4) return "MODERATE RISK";
  return "STABLE";
}

export default function AshaLiveBriefing({ onContinue }: AshaLiveBriefingProps) {
  const [, navigate] = useLocation();
  const { output, isLoading } = useEngine();
  const { user } = useAuth();
  const { overall, regime, domains, analogs, narrative } = output;

  const [greeting, setGreeting] = useState("");
  const [greetingReady, setGreetingReady] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const color = regime.color;
  const ashaRegimeState: AshaRegimeState =
    overall.score >= 7 ? "critical" : overall.score >= 4.5 ? "rising" : "calm";
  const pressureColor = getPressureColor(overall.score);
  const pressureLabel = getPressureLabel(overall.score);

  // Top changed domain
  const topChange = [...domains].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const topChangeDir = topChange?.delta > 0 ? "increasing" : "decreasing";
  const topChangeLabel = topChange?.label?.split(" ").slice(0, 2).join(" ") ?? "—";

  // Analog
  const analog = analogs[0];

  // User first name
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Generate greeting via ASHA engine
  const greetingMutation = trpc.asha.dailyGreeting.useMutation();

  useEffect(() => {
    if (isLoading || greetingReady) return;
    const keyDrivers = domains
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => d.label);
    greetingMutation.mutate(
      {
        userName: firstName !== "there" ? firstName : undefined,
        engineContext: {
          pressureScore: overall.score * 10,
          regime: regime.label,
          regimeConfidence: 0.75,
          narrative: narrative?.summary ?? "Markets are in a period of mixed signals.",
          trend: overall.delta > 0.3 ? "rising" : overall.delta < -0.3 ? "easing" : "stable",
          keyDrivers,
        },
      },
      {
        onSuccess: (data: { greeting: string }) => {
          setGreeting(data.greeting);
          setGreetingReady(true);
        },
        onError: () => {
          // Fallback greeting
          const fallback = `Welcome back${firstName !== "there" ? `, ${firstName}` : ""}. I have been monitoring the markets while you were away. Current systemic pressure is ${pressureLabel.toLowerCase()}. ${topChange ? `The most significant change today is ${topChangeDir} ${topChangeLabel.toLowerCase()}.` : ""}${analog ? ` Historical conditions continue to resemble ${analog.era}.` : ""} Would you like today's complete briefing?`;
          setGreeting(fallback);
          setGreetingReady(true);
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, overall.score, regime.label]);

  // Show actions after greeting is done
  const { displayed: greetingText, done: greetingDone } = useTypewriter(
    greeting,
    20,
    greetingReady
  );

  useEffect(() => {
    if (greetingDone) {
      const t = setTimeout(() => setActionsVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [greetingDone]);

  const handleAction = useCallback(
    (path: string, query?: string) => {
      onContinue();
      if (query) {
        navigate(`${path}?q=${encodeURIComponent(query)}`);
      } else {
        navigate(path);
      }
    },
    [navigate, onContinue]
  );

  const handleContinueToDashboard = useCallback(() => {
    setDismissed(true);
    onContinue();
  }, [onContinue]);

  if (dismissed) return null;

  const ACTIONS = [
    {
      label: "Explain Today's Market",
      sub: "Full synthesis across all 10 engines",
      icon: "◈",
      color: color,
      action: () => handleAction("/app/discover", "Explain today's market conditions"),
    },
    {
      label: "What Changed Overnight?",
      sub: "Key shifts since your last session",
      icon: "◉",
      color: "#00FF88",
      action: () => handleAction("/app/discover", "What changed in the market overnight?"),
    },
    {
      label: "Show the Seismograph",
      sub: "Live pressure across all 10 engines",
      icon: "⊕",
      color: "#FFD700",
      action: () => handleAction("/app/seismograph"),
    },
    {
      label: "Search Any Stock or Crypto",
      sub: "ASHA analyzes any symbol instantly",
      icon: "◎",
      color: "#B388FF",
      action: () => handleAction("/app/symbol-intelligence"),
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "linear-gradient(160deg, #060810 0%, #090C14 50%, #050709 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        overflowY: "auto",
        animation: "asha-briefing-in 0.6s cubic-bezier(0.23,1,0.32,1) both",
      }}
    >
      {/* Regime ambient glow */}
      <div
        style={{
          position: "fixed",
          top: "-100px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "500px",
          background: `radial-gradient(ellipse at center, ${color}18 0%, ${color}06 45%, transparent 70%)`,
          pointerEvents: "none",
          transition: "background 2s ease",
        }}
      />
      {/* Scanlines */}
      <div
        className="scanlines"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.25,
        }}
      />

      {/* ── Content ── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "640px",
          padding: "48px 24px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0",
        }}
      >
        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 16, left: 16, width: 18, height: 18, borderTop: `2px solid ${color}60`, borderLeft: `2px solid ${color}60`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 16, right: 16, width: 18, height: 18, borderTop: `2px solid ${color}60`, borderRight: `2px solid ${color}60`, pointerEvents: "none" }} />

        {/* ASHA Orb — large, listening */}
        <div
          style={{
            marginBottom: "24px",
            animation: "asha-orb-entrance 0.8s cubic-bezier(0.23,1,0.32,1) 0.1s both",
          }}
        >
          <AshaOrb
            regimeState={ashaRegimeState}
            size={64}
            isListening={greetingReady && !greetingDone}
          />
        </div>

        {/* ASHA identity label */}
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.30em",
            color: `${color}90`,
            textTransform: "uppercase",
            marginBottom: "6px",
            animation: "asha-briefing-in 0.5s cubic-bezier(0.23,1,0.32,1) 0.2s both",
          }}
        >
          ASHA · FAULTLINE INTELLIGENCE LAYER
        </div>

        {/* Live status pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 14px",
            background: `${pressureColor}12`,
            border: `1px solid ${pressureColor}40`,
            borderRadius: "20px",
            marginBottom: "28px",
            animation: "asha-briefing-in 0.5s cubic-bezier(0.23,1,0.32,1) 0.3s both",
          }}
        >
          <div
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: pressureColor,
              boxShadow: `0 0 8px ${pressureColor}`,
              animation: "blink-alert 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.18em",
              color: pressureColor,
              fontWeight: 700,
            }}
          >
            {pressureLabel}
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.10em",
              color: "rgba(148,163,184,0.45)",
            }}
          >
            · {regime.label}
          </span>
        </div>

        {/* ── Greeting text ── */}
        <div
          style={{
            width: "100%",
            marginBottom: "28px",
            animation: "asha-briefing-in 0.5s cubic-bezier(0.23,1,0.32,1) 0.4s both",
          }}
        >
          {!greetingReady ? (
            /* Loading state — ASHA is composing */
            <div
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px 0",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: color,
                    opacity: 0.5,
                    animation: `asha-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : (
            <p
              style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: "17px",
                lineHeight: 1.75,
                color: "#D8E8F8",
                margin: 0,
                textAlign: "center",
                letterSpacing: "0.01em",
              }}
            >
              {greetingText}
              {!greetingDone && (
                <span
                  style={{
                    display: "inline-block",
                    width: "2px",
                    height: "1.1em",
                    background: color,
                    marginLeft: "2px",
                    verticalAlign: "text-bottom",
                    animation: "asha-cursor-blink 0.8s step-end infinite",
                  }}
                />
              )}
            </p>
          )}
        </div>

        {/* ── Four intelligent action buttons ── */}
        {actionsVisible && (
          <div
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "28px",
              animation: "asha-actions-in 0.5s cubic-bezier(0.23,1,0.32,1) both",
            }}
          >
            {ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={action.action}
                style={{
                  background: `${action.color}08`,
                  border: `1px solid ${action.color}30`,
                  borderRadius: "6px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                  animation: `asha-briefing-in 0.4s cubic-bezier(0.23,1,0.32,1) ${0.05 * i + 0.1}s both`,
                  minHeight: "unset",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${action.color}14`;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${action.color}55`;
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${action.color}18`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${action.color}08`;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${action.color}30`;
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "14px",
                    color: action.color,
                    marginBottom: "4px",
                    fontWeight: 600,
                  }}
                >
                  {action.icon} {action.label}
                </div>
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    color: "rgba(148,163,184,0.45)",
                    letterSpacing: "0.06em",
                    lineHeight: 1.4,
                  }}
                >
                  {action.sub}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Continue to Dashboard ── */}
        {actionsVisible && (
          <button
            onClick={handleContinueToDashboard}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              color: "rgba(100,116,139,0.45)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "8px 16px",
              transition: "color 0.15s ease",
              marginBottom: "16px",
              animation: "asha-briefing-in 0.4s cubic-bezier(0.23,1,0.32,1) 0.5s both",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.65)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.45)";
            }}
          >
            Continue to Dashboard →
          </button>
        )}

        {/* ── Live seismic wave ── */}
        <div
          style={{
            width: "calc(100% + 48px)",
            marginLeft: "-24px",
            marginRight: "-24px",
            opacity: 0.6,
            animation: "asha-briefing-in 0.5s cubic-bezier(0.23,1,0.32,1) 0.6s both",
          }}
        >
          <SeismicWave color={color} score={overall.score} />
        </div>

        {/* ── Live intelligence stats ── */}
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderTop: `1px solid rgba(255,255,255,0.06)`,
            marginTop: "8px",
            animation: "asha-briefing-in 0.5s cubic-bezier(0.23,1,0.32,1) 0.7s both",
          }}
        >
          {[
            { label: "PRESSURE", value: `${overall.score.toFixed(1)}/10`, color: pressureColor },
            { label: "BULL", value: `${output.probability?.bullProbability ?? "—"}%`, color: "#00FF88" },
            { label: "CRASH", value: `${output.probability?.crashProbability ?? "—"}%`, color: "#FF2D55" },
            { label: "ANALOG", value: analog?.era?.split(" ").slice(0, 2).join(" ") ?? "—", color: "#00E5FF" },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                padding: "12px 8px",
                textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "8px",
                  color: "rgba(100,116,139,0.5)",
                  letterSpacing: "0.14em",
                  marginBottom: "4px",
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: "16px",
                  color: stat.color,
                  textShadow: `0 0 12px ${stat.color}60`,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes asha-briefing-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes asha-orb-entrance {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes asha-actions-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes asha-cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes asha-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
