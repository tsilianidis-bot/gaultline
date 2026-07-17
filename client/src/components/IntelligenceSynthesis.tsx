/* ============================================================
   INTELLIGENCE SYNTHESIS PIPELINE
   Live pipeline display during ASHA analysis.
   Steps advance in real time as the backend processes.
   No fake delays — steps complete as data arrives.
   ============================================================ */
import { useEffect, useState, useRef } from "react";
import AshaOrb, { AshaRegimeState } from "./AshaOrb";

export interface SynthesisStep {
  id: string;
  label: string;
  detail?: string;
  status: "pending" | "active" | "complete";
}

interface Props {
  question: string;
  steps: SynthesisStep[];
  regimeState: AshaRegimeState;
  visible: boolean;
}

let synthAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!synthAudioCtx || synthAudioCtx.state === "closed") {
      synthAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return synthAudioCtx;
  } catch { return null; }
}

function playStepComplete() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.025, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

function playFinalComplete() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  [432, 540, 648].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.09);
    gain.gain.setValueAtTime(0, now + i * 0.09);
    gain.gain.linearRampToValueAtTime(0.04, now + i * 0.09 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.6);
  });
}

export default function IntelligenceSynthesis({ question, steps, regimeState, visible }: Props) {
  const prevCompleteCount = useRef(0);
  const allComplete = steps.length > 0 && steps.every(s => s.status === "complete");

  useEffect(() => {
    const completeCount = steps.filter(s => s.status === "complete").length;
    if (completeCount > prevCompleteCount.current) {
      if (completeCount === steps.length && steps.length > 0) {
        playFinalComplete();
      } else {
        playStepComplete();
      }
    }
    prevCompleteCount.current = completeCount;
  }, [steps]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 2000,
      background: "rgba(2,5,12,0.97)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      animation: "synth-fade-in 0.35s ease both",
      backdropFilter: "blur(20px)",
    }}>
      <div style={{ position: "absolute", top: 24, left: 24, width: 32, height: 32, borderTop: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" }} />
      <div style={{ position: "absolute", top: 24, right: 24, width: 32, height: 32, borderTop: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" }} />
      <div style={{ position: "absolute", bottom: 24, left: 24, width: 32, height: 32, borderBottom: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" }} />
      <div style={{ position: "absolute", bottom: 24, right: 24, width: 32, height: 32, borderBottom: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" }} />

      <div style={{
        position: "absolute",
        top: 32,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "9px",
        letterSpacing: "0.25em",
        color: "rgba(0,229,255,0.35)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        CLASSIFICATION: INTERNAL INTELLIGENCE
      </div>

      <div style={{ marginBottom: "32px", animation: "synth-orb-breathe 2.5s ease-in-out infinite" }}>
        <AshaOrb regimeState={regimeState} size={52} isListening={true} />
      </div>

      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        letterSpacing: "0.12em",
        color: "rgba(0,229,255,0.5)",
        textTransform: "uppercase",
        marginBottom: "8px",
      }}>INTELLIGENCE REQUEST</div>
      <div style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 600,
        fontSize: "clamp(16px, 2.5vw, 22px)",
        color: "#E2E8F0",
        textAlign: "center",
        maxWidth: "600px",
        marginBottom: "48px",
        padding: "0 24px",
        lineHeight: 1.4,
      }}>
        "{question}"
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "min(480px, calc(100vw - 48px))" }}>
        {steps.map((step, i) => (
          <SynthesisStepRow key={step.id} step={step} index={i} />
        ))}
      </div>

      {allComplete && (
        <div style={{
          marginTop: "32px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "#00FF88",
          textTransform: "uppercase",
          animation: "synth-complete-pulse 0.6s ease both",
        }}>
          ✓ SYNTHESIS COMPLETE — ASSEMBLING BRIEFING
        </div>
      )}

      <style>{`
        @keyframes synth-fade-in { from{opacity:0} to{opacity:1} }
        @keyframes synth-orb-breathe {
          0%,100%{transform:scale(1);filter:brightness(1)}
          50%{transform:scale(1.08);filter:brightness(1.3)}
        }
        @keyframes synth-complete-pulse {
          from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes synth-step-enter {
          from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)}
        }
        @keyframes synth-active-scan {
          0%{width:0%} 100%{width:100%}
        }
        @keyframes synth-checkmark {
          from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)}
        }
        @keyframes synth-dot-pulse {
          0%,100%{transform:scale(1);opacity:0.6}
          50%{transform:scale(1.6);opacity:1}
        }
      `}</style>
    </div>
  );
}

function SynthesisStepRow({ step, index }: { step: SynthesisStep; index: number }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), index * 40);
    return () => clearTimeout(t);
  }, [index]);

  const isComplete = step.status === "complete";
  const isActive = step.status === "active";
  const isPending = step.status === "pending";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "8px 14px",
      background: isActive ? "rgba(0,229,255,0.06)" : isComplete ? "rgba(0,255,136,0.03)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isActive ? "rgba(0,229,255,0.25)" : isComplete ? "rgba(0,255,136,0.18)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: "4px",
      opacity: entered ? 1 : 0,
      animation: entered ? "synth-step-enter 0.25s ease both" : "none",
      transition: "background 0.3s ease, border-color 0.3s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      {isActive && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.6), transparent)",
          animation: "synth-active-scan 1.2s ease-in-out infinite",
        }} />
      )}

      <div style={{ width: "16px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isComplete && <span style={{ color: "#00FF88", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", animation: "synth-checkmark 0.2s ease both" }}>✓</span>}
        {isActive && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00E5FF", boxShadow: "0 0 8px rgba(0,229,255,0.8)", animation: "synth-dot-pulse 0.8s ease-in-out infinite" }} />}
        {isPending && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(100,116,139,0.3)" }} />}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          letterSpacing: "0.05em",
          color: isComplete ? "rgba(226,232,240,0.7)" : isActive ? "#E2E8F0" : "rgba(100,116,139,0.45)",
          transition: "color 0.3s ease",
        }}>
          {step.label}
        </div>
        {step.detail && isComplete && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            color: "rgba(0,255,136,0.55)",
            marginTop: "2px",
            letterSpacing: "0.08em",
            animation: "synth-checkmark 0.3s ease both",
          }}>
            {step.detail}
          </div>
        )}
      </div>

      {isComplete && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "8px",
          color: "rgba(100,116,139,0.35)",
          letterSpacing: "0.05em",
          flexShrink: 0,
          animation: "synth-checkmark 0.3s ease both",
        }}>
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}
    </div>
  );
}
