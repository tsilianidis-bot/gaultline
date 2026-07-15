/* ============================================================
   ASHA — Daily Greeting Banner
   Appears at the top of the Dashboard on each session.
   Personalized from live engine data. Dismissible per session.
   ============================================================ */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useAuth } from "@/_core/hooks/useAuth";
import AshaOrb from "./AshaOrb";
import { X } from "lucide-react";

const SESSION_KEY = "faultline_asha_greeting_dismissed";

export default function AshaDailyGreeting() {
  const { output, isLoading } = useEngine();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const greetingMutation = trpc.asha.dailyGreeting.useMutation();

  // Check if already dismissed this session
  useEffect(() => {
    const ts = sessionStorage.getItem(SESSION_KEY);
    if (ts) setDismissed(true);
  }, []);

  // Fetch greeting once engine data is ready
  useEffect(() => {
    if (dismissed || fetched || isLoading || !output?.overall) return;

    const score = output.overall.score;
    if (score === undefined) return;

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
      setGreeting("Welcome back. I have reviewed the market. Here is what is building beneath the surface.");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output, isLoading, dismissed, fetched]);

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, Date.now().toString());
    setDismissed(true);
  };

  if (dismissed || (!greeting && !greetingMutation.isPending)) return null;

  const regimeState = (() => {
    const s = output?.overall?.score ?? 0;
    if (s >= 7) return "critical" as const;
    if (s >= 4.5) return "rising" as const;
    return "calm" as const;
  })();

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      padding: "14px 16px",
      background: "rgba(0,212,255,0.04)",
      border: "1px solid rgba(0,212,255,0.12)",
      borderRadius: "8px",
      marginBottom: "16px",
      position: "relative",
      animation: "asha-greeting-in 0.5s cubic-bezier(0.23,1,0.32,1) both",
    }}>
      <div style={{ flexShrink: 0, marginTop: "2px" }}>
        <AshaOrb regimeState={regimeState} size={32} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "7px",
            letterSpacing: "0.2em",
            color: "rgba(0,212,255,0.5)",
            textTransform: "uppercase",
          }}>ASHA · Daily Briefing</span>
        </div>

        {greetingMutation.isPending && !greeting ? (
          <div style={{ display: "flex", gap: "4px", alignItems: "center", paddingTop: "4px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: "#00D4FF",
                opacity: 0.5,
                animation: `asha-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        ) : (
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "rgba(226,232,240,0.85)",
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
          color: "rgba(100,116,139,0.35)",
          padding: "2px",
          transition: "color 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.5)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.35)"; }}
      >
        <X size={12} />
      </button>

      <style>{`
        @keyframes asha-greeting-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes asha-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
