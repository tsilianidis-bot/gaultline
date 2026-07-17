/* ============================================================
   ASHA — Persistent Floating Ask ASHA Panel
   Synthesis → Oracle Briefing flow.
   No chat bubbles. No typing animation. No chatbot feel.
   State machine: input → synthesizing → briefing
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useAshaContext } from "@/contexts/AshaContext";
import AshaOrb, { AshaRegimeState } from "./AshaOrb";
import IntelligenceSynthesis, { SynthesisStep } from "./IntelligenceSynthesis";
import OracleBriefing, { OracleBriefingData } from "./OracleBriefing";
import { X, Send, Zap } from "lucide-react";

// ── Suggested questions per page ─────────────────────────────
const PAGE_SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    "What changed today?",
    "What is the largest hidden risk right now?",
    "What is the market overlooking?",
    "What should I pay attention to next?",
  ],
  seismograph: [
    "How long has this condition been building?",
    "What could trigger a regime change?",
    "Is this similar to 2000, 2008, 2020, or 2022?",
    "What would invalidate the current seismic reading?",
  ],
  pressure: [
    "Why is pressure at this level?",
    "What would cause pressure to fall?",
    "Which engine is contributing most to current stress?",
    "What is the historical range for this reading?",
  ],
  "symbol-intelligence": [
    "What is the primary driver of this setup?",
    "How does this asset perform in the current regime?",
    "What would invalidate this outlook?",
    "What are the key risks for this position?",
  ],
  crypto: [
    "How does crypto behave in the current macro regime?",
    "What is the relationship between this asset and macro pressure?",
    "What would invalidate the current crypto outlook?",
    "Compare this with the 2022 crypto bear market.",
  ],
  "situation-room": [
    "What is the highest-probability outcome?",
    "What evidence supports this conclusion?",
    "What would change this assessment?",
    "What is the market not pricing in right now?",
  ],
  "market-intel": [
    "What regime are we in and how long has it lasted?",
    "What is the current probability of a regime transition?",
    "Which sectors are most exposed to the current regime?",
    "What historical period most closely resembles today?",
  ],
  signals: [
    "What signals are most significant right now?",
    "Which signals are confirming the current regime?",
    "Are any signals diverging from the consensus?",
    "What would a regime reversal look like in the signals?",
  ],
  default: [
    "What is building beneath the surface?",
    "What changed today?",
    "What should I pay attention to next?",
    "What would invalidate the current outlook?",
  ],
};

// ── Synthesis pipeline step definitions ──────────────────────
const SYNTHESIS_STEPS: Array<{ id: string; label: string; detail?: string }> = [
  { id: "regime",     label: "Evaluating market regime",          detail: "Regime detection complete" },
  { id: "pressure",   label: "Reading pressure index",            detail: "Pressure vectors mapped" },
  { id: "liquidity",  label: "Analyzing liquidity conditions",    detail: "Funding markets assessed" },
  { id: "credit",     label: "Scanning credit markets",           detail: "Spread analysis complete" },
  { id: "volatility", label: "Measuring volatility structure",    detail: "Vol regime classified" },
  { id: "analog",     label: "Consulting historical analogs",     detail: "Closest periods identified" },
  { id: "probability",label: "Computing probability distribution",detail: "Outcome weights calibrated" },
  { id: "synthesis",  label: "Synthesizing 10-engine consensus",  detail: "Intelligence unified" },
];

// ── Arrival phases ────────────────────────────────────────────
type ArrivalPhase = "idle" | "rising" | "pausing" | "expanding" | "open";

// ── Panel interaction state ───────────────────────────────────
type PanelState = "input" | "synthesizing" | "briefing";

// ── Signature chime synthesizer ───────────────────────────────
let audioCtx: AudioContext | null = null;
let chimeInProgress = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playSignatureChime() {
  if (chimeInProgress) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  chimeInProgress = true;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(432, now);
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.22, now + 0.025);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(864, now);
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.08, now + 0.025);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(648, now);
  gain3.gain.setValueAtTime(0, now);
  gain3.gain.linearRampToValueAtTime(0.05, now + 0.04);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);

  const osc4 = ctx.createOscillator();
  const gain4 = ctx.createGain();
  osc4.type = "sine";
  osc4.frequency.setValueAtTime(216, now);
  gain4.gain.setValueAtTime(0, now);
  gain4.gain.linearRampToValueAtTime(0.04, now + 0.02);
  gain4.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  osc4.connect(gain4);
  gain4.connect(ctx.destination);

  osc1.start(now); osc1.stop(now + 2.3);
  osc2.start(now); osc2.stop(now + 1.7);
  osc3.start(now); osc3.stop(now + 1.9);
  osc4.start(now); osc4.stop(now + 1.1);

  setTimeout(() => { chimeInProgress = false; }, 2400);
}

// ── Mission ID generator ──────────────────────────────────────
function generateMissionId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear().toString().slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export default function AshaPanel({}: {}) {
  const { output } = useEngine();
  const { pageContext } = useAshaContext();
  const [arrivalPhase, setArrivalPhase] = useState<ArrivalPhase>("idle");
  const [panelState, setPanelState] = useState<PanelState>("input");
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [synthSteps, setSynthSteps] = useState<SynthesisStep[]>([]);
  const [briefingData, setBriefingData] = useState<OracleBriefingData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const askMutation = trpc.asha.ask.useMutation();

  const open = arrivalPhase === "open";

  // Derive regime state for orb
  const regimeState: AshaRegimeState = (() => {
    const score = output?.overall?.score ?? 0;
    if (score >= 7) return "critical";
    if (score >= 4.5) return "rising";
    return "calm";
  })();

  // Build full page context merging engine output
  const fullPageContext = {
    page: pageContext?.page ?? "dashboard",
    pressureScore: pageContext?.pressureScore ?? (output?.overall?.score !== undefined ? output.overall.score * 10 : undefined),
    regime: pageContext?.regime ?? output?.regime?.label,
    regimeConfidence: pageContext?.regimeConfidence,
    narrative: pageContext?.narrative ?? output?.narrative?.summary,
    trend: pageContext?.trend,
    keyDrivers: pageContext?.keyDrivers ?? output?.narrative?.keyRisks,
    historicalAnalog: pageContext?.historicalAnalog,
    transitionProbability: pageContext?.transitionProbability,
    additionalContext: pageContext?.additionalContext,
  };

  const suggestions = PAGE_SUGGESTIONS[fullPageContext.page] ?? PAGE_SUGGESTIONS.default;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
      if (synthTimerRef.current) clearTimeout(synthTimerRef.current);
    };
  }, []);

  // Focus input when panel opens or returns to input state
  useEffect(() => {
    if (open && panelState === "input") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, panelState]);

  // ── Arrival sequence ──────────────────────────────────────
  const handleOpen = () => {
    if (arrivalPhase !== "idle") return;
    getAudioContext();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setArrivalPhase("open");
      return;
    }

    setArrivalPhase("rising");
    arrivalTimerRef.current = setTimeout(() => {
      setArrivalPhase("pausing");
      playSignatureChime();
      arrivalTimerRef.current = setTimeout(() => {
        setArrivalPhase("expanding");
        arrivalTimerRef.current = setTimeout(() => {
          setArrivalPhase("open");
        }, 300);
      }, 300);
    }, 300);
  };

  const handleClose = () => {
    if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
    if (synthTimerRef.current) clearTimeout(synthTimerRef.current);
    setArrivalPhase("idle");
    setPanelState("input");
    setInput("");
    setCurrentQuestion("");
    setSynthSteps([]);
    setBriefingData(null);
  };

  // ── Synthesis step advancement ────────────────────────────
  const advanceSynthesisSteps = useCallback((stepIndex: number, totalSteps: number, onComplete: () => void) => {
    if (stepIndex >= totalSteps) {
      onComplete();
      return;
    }

    setSynthSteps(prev => prev.map((s, i) => {
      if (i < stepIndex) return { ...s, status: "complete" as const };
      if (i === stepIndex) return { ...s, status: "active" as const };
      return { ...s, status: "pending" as const };
    }));

    // Stagger each step: 400ms per step, accelerating toward the end
    const delay = stepIndex < totalSteps - 2 ? 400 : 250;
    synthTimerRef.current = setTimeout(() => {
      advanceSynthesisSteps(stepIndex + 1, totalSteps, onComplete);
    }, delay);
  }, []);

  // ── Submit question ───────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || askMutation.isPending) return;

    const question = text.trim();
    setCurrentQuestion(question);
    setInput("");
    setPanelState("synthesizing");

    // Initialize synthesis steps
    const initialSteps: SynthesisStep[] = SYNTHESIS_STEPS.map(s => ({
      ...s,
      status: "pending" as const,
    }));
    setSynthSteps(initialSteps);

    // Start step advancement (timed to approximate backend response)
    advanceSynthesisSteps(0, SYNTHESIS_STEPS.length, () => {
      // Steps complete — keep showing synthesis until mutation resolves
    });

    try {
      const response = await askMutation.mutateAsync({
        userMessage: question,
        history: [],
        pageContext: fullPageContext,
      });

      // Mark all steps complete
      setSynthSteps(prev => prev.map(s => ({ ...s, status: "complete" as const })));

      // Brief pause to show "SYNTHESIS COMPLETE" before transitioning
      await new Promise(resolve => setTimeout(resolve, 700));

      // Map response to OracleBriefingData
      const confidenceNum = response.confidence === "high" ? 82
        : response.confidence === "moderate" ? 65
        : 45;

      const data: OracleBriefingData = {
        question,
        missionId: generateMissionId(),
        timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),

        executiveSummary: response.executiveSummary || response.reply.split("\n")[0] || response.reply.slice(0, 200),
        marketBias: response.marketBias || "NEUTRAL",
        confidence: confidenceNum,
        marketRegime: response.marketRegime || fullPageContext.regime || "Unknown",
        threatLevel: response.threatLevel || "ELEVATED",
        pressureIndex: response.pressureIndex ?? fullPageContext.pressureScore ?? 50,
        riskLevel: response.riskLevel || "Moderate",
        suggestedBias: response.suggestedBias,

        bullProbability: response.bullProbability ?? 50,
        bearProbability: response.bearProbability ?? 50,

        keyFindings: response.keyFindings?.length ? response.keyFindings : [response.reply.slice(0, 180)],
        supportingEvidence: response.supportingEvidence?.length ? response.supportingEvidence : response.sources,
        historicalAnalog: response.historicalAnalog || fullPageContext.historicalAnalog,
        riskFactors: response.riskFactors?.length ? response.riskFactors : (response.invalidationTriggers || []),
        invalidationConditions: response.invalidationConditions?.length ? response.invalidationConditions : [],

        missionRecommendation: response.missionRecommendation || response.reply,
        finalVerdictAction: response.finalVerdictAction || "WATCH",
        expectedTimeframe: response.expectedTimeframe || "2-4 weeks",

        followUpChips: response.followUpChips?.length ? response.followUpChips : suggestions.slice(0, 3),
      };

      setBriefingData(data);
      setPanelState("briefing");

    } catch {
      // On error, return to input state with a message
      setSynthSteps([]);
      setPanelState("input");
    }
  }, [askMutation, fullPageContext, advanceSynthesisSteps, suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleAskAnother = () => {
    setPanelState("input");
    setInput("");
    setCurrentQuestion("");
    setSynthSteps([]);
    setBriefingData(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Arrival orb overlay styles ────────────────────────────
  const isArriving = arrivalPhase === "rising" || arrivalPhase === "pausing" || arrivalPhase === "expanding";

  return (
    <>
      {/* ── Arrival orb overlay (during animation phases) ──── */}
      {isArriving && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1002,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            animation:
              arrivalPhase === "rising"
                ? "asha-orb-rise 0.30s cubic-bezier(0.23,1,0.32,1) both"
                : arrivalPhase === "pausing"
                ? "asha-orb-pause-pulse 0.30s ease-in-out both"
                : arrivalPhase === "expanding"
                ? "asha-orb-expand 0.30s cubic-bezier(0.23,1,0.32,1) both"
                : "none",
          }}>
            {arrivalPhase === "pausing" && (
              <div style={{
                position: "absolute",
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: "1px solid rgba(0,229,255,0.35)",
                animation: "asha-ripple 0.30s ease-out both",
                pointerEvents: "none",
              }} />
            )}
            <AshaOrb regimeState={regimeState} size={36} isListening={false} />
          </div>
        </div>
      )}

      {/* ── Floating trigger button (idle only) ─────────────── */}
      {arrivalPhase === "idle" && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}>
          <button
            onClick={handleOpen}
            style={{
              background: "rgba(6,10,20,0.92)",
              border: "1px solid rgba(0,229,255,0.38)",
              borderRadius: "50px",
              padding: "8px 14px 8px 10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.14)",
              transition: "all 0.2s ease",
              backdropFilter: "blur(12px)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.45)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.5), 0 0 30px rgba(0,229,255,0.25)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.38)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.14)";
            }}
          >
            <AshaOrb regimeState={regimeState} size={28} isListening={false} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: "#00E5FF",
              textTransform: "uppercase",
            }}>Ask ASHA</span>
          </button>
        </div>
      )}

      {/* ── Intelligence Synthesis overlay ───────────────────── */}
      <IntelligenceSynthesis
        question={currentQuestion}
        steps={synthSteps}
        regimeState={regimeState}
        visible={open && panelState === "synthesizing"}
      />

      {/* ── Oracle Briefing overlay ───────────────────────────── */}
      {briefingData && (
        <OracleBriefing
          data={briefingData}
          visible={open && panelState === "briefing"}
          onAskAnother={handleAskAnother}
        />
      )}

      {/* ── Input panel (open + input state) ─────────────────── */}
      {open && panelState === "input" && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "min(440px, calc(100vw - 32px))",
          zIndex: 1001,
          background: "rgba(4,8,18,0.97)",
          border: "1px solid rgba(0,212,255,0.18)",
          borderRadius: "10px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "asha-panel-open 0.25s cubic-bezier(0.23,1,0.32,1) both",
          backdropFilter: "blur(20px)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderBottom: "1px solid rgba(0,229,255,0.18)",
            background: "rgba(0,0,0,0.3)",
          }}>
            <AshaOrb regimeState={regimeState} size={28} isListening={isListening} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#00E5FF", lineHeight: 1 }}>ASHA</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(0,229,255,0.55)", textTransform: "uppercase" }}>Oracle Briefing System</div>
            </div>
            <button
              onClick={handleClose}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.4)", padding: "4px", transition: "color 0.15s ease" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.4)"; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Intro + suggestions */}
          <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "12px",
              color: "rgba(148,163,184,0.65)",
              lineHeight: 1.6,
              margin: 0,
            }}>
              Submit a question. ASHA will synthesize all 10 engines and deliver a classified intelligence briefing.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    textAlign: "left",
                    padding: "7px 10px",
                    background: "rgba(0,212,255,0.04)",
                    border: "1px solid rgba(0,229,255,0.18)",
                    borderRadius: "5px",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "11px",
                    color: "rgba(148,163,184,0.7)",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.14)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#E2E8F0";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.32)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.04)";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.7)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.18)";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(0,229,255,0.14)",
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask ASHA..."
              disabled={askMutation.isPending}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(0,229,255,0.25)",
                borderRadius: "5px",
                padding: "8px 10px",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "12px",
                color: "#E2E8F0",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={e => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,229,255,0.50)";
                setIsListening(true);
              }}
              onBlur={e => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,229,255,0.25)";
                setIsListening(false);
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || askMutation.isPending}
              style={{
                background: input.trim() && !askMutation.isPending ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${input.trim() && !askMutation.isPending ? "rgba(0,229,255,0.45)" : "rgba(255,255,255,0.11)"}`,
                borderRadius: "5px",
                padding: "8px 10px",
                cursor: input.trim() && !askMutation.isPending ? "pointer" : "not-allowed",
                color: input.trim() && !askMutation.isPending ? "#00E5FF" : "rgba(100,116,139,0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <Send size={13} />
            </button>
          </div>

          {/* Page context badge */}
          <div style={{
            padding: "5px 12px",
            borderTop: "1px solid rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}>
            <Zap size={8} color="rgba(0,229,255,0.45)" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.1em", color: "rgba(100,116,139,0.35)", textTransform: "uppercase" }}>
              Context: {fullPageContext.page}
            </span>
            {fullPageContext.pressureScore !== undefined && (
              <>
                <span style={{ color: "rgba(100,116,139,0.2)" }}>·</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.35)" }}>
                  Pressure {fullPageContext.pressureScore.toFixed(0)}
                </span>
              </>
            )}
            {fullPageContext.regime && (
              <>
                <span style={{ color: "rgba(100,116,139,0.2)" }}>·</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.35)" }}>
                  {fullPageContext.regime}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        /* ── Panel open ── */
        @keyframes asha-panel-open {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Arrival: orb rises from below ── */
        @keyframes asha-orb-rise {
          from { opacity: 0; transform: translateY(20px) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Arrival: pause — one breathing pulse ── */
        @keyframes asha-orb-pause-pulse {
          0%   { transform: scale(1);    filter: brightness(1); }
          40%  { transform: scale(1.12); filter: brightness(1.35); }
          70%  { transform: scale(1.04); filter: brightness(1.15); }
          100% { transform: scale(1.08); filter: brightness(1.2); }
        }

        /* ── Arrival: expand into panel position ── */
        @keyframes asha-orb-expand {
          from { opacity: 1; transform: scale(1.08); filter: brightness(1.2); }
          to   { opacity: 0; transform: scale(2.2);  filter: brightness(0); }
        }

        /* ── Ripple ring during pause ── */
        @keyframes asha-ripple {
          from { transform: scale(0.6); opacity: 0.6; }
          to   { transform: scale(2.0); opacity: 0; }
        }
      `}</style>
    </>
  );
}
