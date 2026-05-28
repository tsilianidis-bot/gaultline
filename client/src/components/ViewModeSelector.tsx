/**
 * ViewModeSelector — 3-mode intelligence system switcher.
 * Displays PULSE / SIGNALS / INTELLIGENCE tabs.
 * Persists selection to user profile via tRPC.
 */
import { useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type DashboardMode = "pulse" | "signals" | "intelligence";

const MODES: {
  id: DashboardMode;
  label: string;
  sublabel: string;
  icon: string;
}[] = [
  {
    id: "pulse",
    label: "PULSE",
    sublabel: "What matters now",
    icon: "◉",
  },
  {
    id: "signals",
    label: "SIGNALS",
    sublabel: "Where is movement",
    icon: "◈",
  },
  {
    id: "intelligence",
    label: "INTELLIGENCE",
    sublabel: "Why pressure builds",
    icon: "◎",
  },
];

interface ViewModeSelectorProps {
  mode: DashboardMode;
  onChange: (mode: DashboardMode) => void;
  compact?: boolean;
}

export function ViewModeSelector({ mode, onChange, compact = false }: ViewModeSelectorProps) {
  const { user } = useAuth();
  const setMode = trpc.auth.setDashboardMode.useMutation();

  const handleChange = useCallback(
    (newMode: DashboardMode) => {
      onChange(newMode);
      if (user) {
        setMode.mutate({ mode: newMode });
      }
    },
    [onChange, user, setMode]
  );

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 p-1 rounded-lg"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleChange(m.id)}
              className="relative px-3 py-1.5 rounded-md transition-all duration-200 active:scale-[0.97]"
              style={{
                background: active ? "rgba(0,212,255,0.12)" : "transparent",
                border: active ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
                color: active ? "#00D4FF" : "rgba(100,116,139,0.8)",
                boxShadow: active ? "0 0 12px rgba(0,212,255,0.12)" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                }}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Label */}
      <div
        className="flex items-center gap-2 mb-3"
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.3em",
          color: "rgba(100,116,139,0.5)",
          textTransform: "uppercase",
        }}
      >
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
        <span>VIEW MODE</span>
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>

      {/* Mode tabs */}
      <div
        className="flex items-stretch gap-1 p-1 rounded-xl"
        style={{ background: "rgba(5,6,8,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleChange(m.id)}
              className="flex-1 flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg transition-all duration-200 active:scale-[0.97]"
              style={{
                background: active
                  ? "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))"
                  : "transparent",
                border: active ? "1px solid rgba(0,212,255,0.25)" : "1px solid transparent",
                boxShadow: active ? "0 0 16px rgba(0,212,255,0.1), inset 0 1px 0 rgba(0,212,255,0.1)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: active ? "#00D4FF" : "rgba(100,116,139,0.6)",
                  transition: "color 0.2s",
                }}
              >
                {m.icon}
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                  color: active ? "#00D4FF" : "rgba(100,116,139,0.7)",
                  transition: "color 0.2s",
                  textShadow: active ? "0 0 8px rgba(0,212,255,0.4)" : "none",
                }}
              >
                {m.label}
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "8px",
                  color: active ? "rgba(0,212,255,0.6)" : "rgba(100,116,139,0.4)",
                  transition: "color 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {m.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
