/* ============================================================
   ASHA — Persistent Floating Panel
   State machine: idle → summon → synthesizing → briefing

   idle:        Floating orb in bottom-right corner
   summon:      AshaSummon overlay — 7-step cinematic activation
   synthesizing: IntelligenceSynthesis overlay — live pipeline
   briefing:    OracleBriefing — classified intelligence report
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useAshaContext } from "@/contexts/AshaContext";
import AshaOrb, { AshaRegimeState } from "./AshaOrb";
import AshaSummon from "./AshaSummon";
import IntelligenceSynthesis, { SynthesisStep } from "./IntelligenceSynthesis";
import OracleBriefing, { OracleBriefingData } from "./OracleBriefing";

// ── Context-aware suggestions per page ───────────────────────
const PAGE_SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    "Explain today's market",
    "What changed today?",
    "What is the largest hidden risk right now?",
    "What should I pay attention to next?",
    "What is the market overlooking?",
    "Show systemic risks",
  ],
  seismograph: [
    "How long has this condition been building?",
    "What could trigger a regime change?",
    "Is this similar to 2000, 2008, 2020, or 2022?",
    "What would invalidate the current seismic reading?",
    "Explain the Pressure Index",
    "Where is the market heading?",
  ],
  pressure: [
    "Why is pressure at this level?",
    "What would cause pressure to fall?",
    "Which engine is contributing most to current stress?",
    "Explain the Pressure Index",
    "What is the historical range for this reading?",
    "Show systemic risks",
  ],
  "symbol-intelligence": [
    "What is the primary driver of this setup?",
    "Analyze NVDA",
    "How does this asset perform in the current regime?",
    "What would invalidate this outlook?",
    "What are the key risks for this position?",
    "Where is the market heading?",
  ],
  crypto: [
    "How does crypto behave in the current macro regime?",
    "What is the relationship between BTC and macro pressure?",
    "What would invalidate the current crypto outlook?",
    "Compare this with the 2022 crypto bear market.",
    "Explain today's market",
    "Show systemic risks",
  ],
  "situation-room": [
    "What is the highest-probability outcome?",
    "What evidence supports this conclusion?",
    "What would change this assessment?",
    "What is the market not pricing in right now?",
    "Where is the market heading?",
    "What changed today?",
  ],
  "market-intel": [
    "What regime are we in and how long has it lasted?",
    "What is the current probability of a regime transition?",
    "Which sectors are most exposed to the current regime?",
    "What historical period most closely resembles today?",
    "Explain today's market",
    "Show systemic risks",
  ],
  signals: [
    "What signals are most significant right now?",
    "Which signals are confirming the current regime?",
    "Are any signals diverging from the consensus?",
    "Analyze NVDA",
    "What would a regime reversal look like in the signals?",
    "Where is the market heading?",
  ],
  default: [
    "Explain today's market",
    "What changed today?",
    "What should I pay attention to next?",
    "What is the market overlooking?",
    "Show systemic risks",
    "Where is the market heading?",
  ],
};

// ── Synthesis pipeline steps ──────────────────────────────────
const SYNTHESIS_STEPS: Array<{ id: string; label: string; detail?: string }> = [
  { id: "regime",      label: "Evaluating market regime",          detail: "Regime detection complete" },
  { id: "pressure",    label: "Reading pressure index",            detail: "Pressure vectors mapped" },
  { id: "liquidity",   label: "Analyzing liquidity conditions",    detail: "Funding markets assessed" },
  { id: "credit",      label: "Scanning credit markets",           detail: "Spread analysis complete" },
  { id: "volatility",  label: "Measuring volatility structure",    detail: "Vol regime classified" },
  { id: "analog",      label: "Consulting historical analogs",     detail: "Closest periods identified" },
  { id: "probability", label: "Computing probability distribution", detail: "Outcome weights calibrated" },
  { id: "synthesis",   label: "Synthesizing 10-engine consensus",  detail: "Intelligence unified" },
];

// ── Panel state ───────────────────────────────────────────────
type PanelState = "idle" | "summon" | "synthesizing" | "briefing";

// ── Mission ID ────────────────────────────────────────────────
function generateMissionId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear().toString().slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export default function AshaPanel() {
  const { output } = useEngine();
  const { pageContext } = useAshaContext();
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [synthSteps, setSynthSteps] = useState<SynthesisStep[]>([]);
  const [briefingData, setBriefingData] = useState<OracleBriefingData | null>(null);
  const synthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const askMutation = trpc.asha.ask.useMutation();

  // ── Derive regime state for orb ───────────────────────────
  const regimeState: AshaRegimeState = (() => {
    const score = output?.overall?.score ?? 0;
    if (score >= 7) return "critical";
    if (score >= 4.5) return "rising";
    return "calm";
  })();

  // ── Build full page context ───────────────────────────────
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

  // ── External trigger: asha:summon CustomEvent ────────────
  // Dispatched by RightActionDrawer and keyboard shortcut Cmd+/
  // Payload: { prompt?: string }
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setPanelState("summon");
      if (prompt) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("asha:prefill", { detail: { prompt } }));
        }, 80);
      }
    };
    window.addEventListener("asha:summon", handler);
    return () => window.removeEventListener("asha:summon", handler);
  }, []);

  // ── Keyboard shortcut: Cmd+/ ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setPanelState(prev => prev === "idle" ? "summon" : "idle");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthTimerRef.current) clearTimeout(synthTimerRef.current);
    };
  }, []);

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

    const delay = stepIndex < totalSteps - 2 ? 420 : 280;
    synthTimerRef.current = setTimeout(() => {
      advanceSynthesisSteps(stepIndex + 1, totalSteps, onComplete);
    }, delay);
  }, []);

  // ── Submit question ───────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || askMutation.isPending) return;

    const question = text.trim();
    setCurrentQuestion(question);
    setPanelState("synthesizing");

    // Initialize synthesis steps
    const initialSteps: SynthesisStep[] = SYNTHESIS_STEPS.map(s => ({
      ...s,
      status: "pending" as const,
    }));
    setSynthSteps(initialSteps);

    advanceSynthesisSteps(0, SYNTHESIS_STEPS.length, () => {});

    try {
      const response = await askMutation.mutateAsync({
        userMessage: question,
        history: [],
        pageContext: fullPageContext,
      });

      // Mark all steps complete
      setSynthSteps(prev => prev.map(s => ({ ...s, status: "complete" as const })));
      await new Promise(resolve => setTimeout(resolve, 650));

      // Map to OracleBriefingData
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
      setSynthSteps([]);
      setPanelState("summon");
    }
  }, [askMutation, fullPageContext, advanceSynthesisSteps, suggestions]);

  // ── Ask another question ──────────────────────────────────
  const handleAskAnother = useCallback(() => {
    setPanelState("summon");
    setCurrentQuestion("");
    setSynthSteps([]);
    setBriefingData(null);
  }, []);

  // ── Dismiss summon ────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    setPanelState("idle");
    setCurrentQuestion("");
    setSynthSteps([]);
    setBriefingData(null);
  }, []);

  return (
    <>
      {/* ── Floating trigger orb (idle state only) ─────────── */}
      {panelState === "idle" && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}>
          <button
            onClick={() => setPanelState("summon")}
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
              transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
              backdropFilter: "blur(12px)",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "rgba(0,212,255,0.55)";
              el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.5), 0 0 32px rgba(0,229,255,0.28)";
              el.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "rgba(0,229,255,0.38)";
              el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.14)";
              el.style.transform = "translateY(0)";
            }}
            onMouseDown={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(0.97)";
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1)";
            }}
          >
            <AshaOrb regimeState={regimeState} size={28} isListening={false} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: "#00E5FF",
              textTransform: "uppercase",
            }}>
              Ask ASHA
            </span>
          </button>
        </div>
      )}

      {/* ── Summon sequence ────────────────────────────────── */}
      <AshaSummon
        visible={panelState === "summon"}
        regimeState={regimeState}
        suggestions={suggestions}
        onSubmit={sendMessage}
        onDismiss={handleDismiss}
        dockBottom={20}
        dockRight={undefined}
      />

      {/* ── Intelligence Synthesis ─────────────────────────── */}
      <IntelligenceSynthesis
        question={currentQuestion}
        steps={synthSteps}
        regimeState={regimeState}
        visible={panelState === "synthesizing"}
      />

      {/* ── Oracle Briefing ────────────────────────────────── */}
      {briefingData && (
        <OracleBriefing
          data={briefingData}
          visible={panelState === "briefing"}
          onAskAnother={handleAskAnother}
        />
      )}
    </>
  );
}
