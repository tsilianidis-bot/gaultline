/* ============================================================
   ASHA — Daily Briefing Banner
   Appears at the top of the Dashboard on each session.
   Professional market briefing tone. Live engine data.
   Dismissible per session.
   ============================================================ */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useAuth } from "@/_core/hooks/useAuth";
import AshaOrb from "./AshaOrb";
import { X } from "lucide-react";

const SESSION_KEY = "faultline_asha_greeting_dismissed_v2";

export default function AshaDailyGreeting() {
  const { output, isLoading } = useEngine();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const greetingMutation = trpc.asha.dailyGreeting.useMutation();

  useEffect(() => {
    const ts = sessionStorage.getItem(SESSION_KEY);
    if (ts) setDismissed(true);
  }, []);

  useEffect(() => {
    if (dismissed || fetched || isLoading || !output?.overall || !user) return;
    const score = output.overall.score;
    if (score === undefined || isNaN(score)) return;

    setFetched(true);
    greetingMutation.mutateAsync({
      userName: user?.name ?? undefined,
      engineContext: {
        pressureScore: score * 10,
        regime: output.regime?.label ?? "Unknown",
        regimeConfidence: 0.75,
        narrative: output.narrative?.summary ?? "",
        trend: output.regime?.sublabel ?? "",
        keyDrivers: output.narrative?.keyRisks ?? [],
      },
    }).then(res => {
      setGreeting(res.greeting);
    }).catch(() => {
      setGreeting("Good morning. Current market pressure is elevated. I am monitoring conditions across all active engines. Here is what is building beneath the surface.");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output, isLoading, dismissed, fetched]);

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, Date.now().toString());
    setDismissed(true);
  };

  if (dismissed || (!greeting && !greetingMutation.isPending)) return null;

  const pressureScore = (output?.overall?.score ?? 0) * 10;
  const regimeState: "calm" | "rising" | "critical" =
    pressureScore >= 70 ? "critical" : pressureScore >= 45 ? "rising" : "calm";

  const regimeLabel = output?.regime?.label ?? "Unknown";
  const pressureLabel =
    pressureScore >= 70 ? "CRITICAL" :
    pressureScore >= 55 ? "ELEVATED" :
    pressureScore >= 40 ? "MODERATE" : "STABLE";

  const pressureColor =
    pressureScore >= 70 ? "#FF3B5C" :
    pressureScore >= 55 ? "#FFAA00" :
    pressureScore >= 40 ? "#FFD700" : "#00FF99";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "14px",
      padding: "16px 20px",
      background: "rgba(8,10,16,0.97)",
      border: "1px solid rgba(0,229,255,0.18)",
      borderLeft: "3px solid rgba(0,229,255,0.60)",
      borderRadius: "4px",
      marginBottom: "16px",
      position: "relative",
      animation: "asha-greeting-in 0.45s cubic-bezier(0.23,1,0.32,1) both",
    }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg, rgba(0,229,255,0.35), transparent 60%)",
        pointerEvents: "none",
      }} />

      <div style={{ flexShrink: 0, marginTop: "1px" }}>
        <AshaOrb regimeState={regimeState} size={30} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "7px",
          flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.20em",
            color: "rgba(0,229,255,0.70)",
            textTransform: "uppercase",
            fontWeight: 700,
          }}>
            ASHA · DAILY BRIEFING
          </span>
          {/* Pressure status pill */}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.12em",
            color: pressureColor,
            padding: "2px 7px",
            background: `${pressureColor}12`,
            border: `1px solid ${pressureColor}35`,
            borderRadius: "2px",
          }}>
            {pressureLabel}
          </span>
          {/* Regime label */}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.10em",
            color: "rgba(255,255,255,0.30)",
          }}>
            {regimeLabel}
          </span>
        </div>

        {/* Greeting text */}
        {greetingMutation.isPending && !greeting ? (
          <div style={{ display: "flex", gap: "5px", alignItems: "center", paddingTop: "2px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: "#00E5FF",
                opacity: 0.5,
                animation: `asha-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        ) : (
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: "13px",
            lineHeight: 1.65,
            color: "#D8E8F8",
            margin: 0,
          }}>
            {greeting}
          </p>
        )}
      </div>

      <button
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "rgba(100,116,139,0.30)",
          padding: "2px",
          transition: "color 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.55)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.30)"; }}
      >
        <X size={12} />
      </button>

      <style>{`
        @keyframes asha-greeting-in {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes asha-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
