/* ============================================================
   ASHA — Persistent Floating Ask ASHA Panel
   Appears on every page. Regime-reactive orb trigger.
   Page-context aware: injects current page data into every query.
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useAshaContext } from "@/contexts/AshaContext";
import AshaOrb, { AshaRegimeState } from "./AshaOrb";
import { X, Send, ChevronDown, Eye, Zap, RotateCcw } from "lucide-react";

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

// ── Message type ──────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  confidence?: "high" | "moderate" | "low";
  sources?: string[];
  enginesConsulted?: string[];
  lastUpdated?: string;
  showTransparency?: boolean;
}

interface AshaPanelProps {
  // No props needed — reads from AshaContext
}

function confidenceColor(c?: "high" | "moderate" | "low") {
  if (c === "high") return "#00FF88";
  if (c === "low") return "#FF6B35";
  return "#FFB347";
}

function TransparencyPanel({ msg }: { msg: Message }) {
  return (
    <div style={{
      marginTop: "8px",
      padding: "10px 12px",
      background: "rgba(0,212,255,0.04)",
      border: "1px solid rgba(0,229,255,0.18)",
      borderRadius: "5px",
      fontSize: "9px",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {msg.confidence && (
        <div style={{ marginBottom: "5px" }}>
          <span style={{ color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>CONFIDENCE: </span>
          <span style={{ color: confidenceColor(msg.confidence), fontWeight: 700 }}>{msg.confidence.toUpperCase()}</span>
        </div>
      )}
      {msg.enginesConsulted && msg.enginesConsulted.length > 0 && (
        <div style={{ marginBottom: "5px" }}>
          <span style={{ color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>ENGINES: </span>
          <span style={{ color: "#94A3B8" }}>{msg.enginesConsulted.join(", ")}</span>
        </div>
      )}
      {msg.sources && msg.sources.length > 0 && (
        <div style={{ marginBottom: "5px" }}>
          <span style={{ color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>SOURCES: </span>
          <span style={{ color: "#94A3B8" }}>{msg.sources.join(", ")}</span>
        </div>
      )}
      {msg.lastUpdated && (
        <div>
          <span style={{ color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>UPDATED: </span>
          <span style={{ color: "#94A3B8" }}>{new Date(msg.lastUpdated).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}

export default function AshaPanel({}: AshaPanelProps) {
  const { output } = useEngine();
  const { pageContext } = useAshaContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const askMutation = trpc.asha.ask.useMutation();

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await askMutation.mutateAsync({
        userMessage: text.trim(),
        history,
        pageContext: fullPageContext,
      });
      const assistantMsg: Message = {
        role: "assistant",
        content: response.reply,
        confidence: response.confidence,
        sources: response.sources,
        enginesConsulted: response.enginesConsulted,
        lastUpdated: response.lastUpdated,
        showTransparency: false,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I encountered an issue accessing the intelligence systems. Please try again in a moment.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleTransparency = (index: number) => {
    setMessages(prev => prev.map((m, i) =>
      i === index ? { ...m, showTransparency: !m.showTransparency } : m
    ));
  };

  const clearChat = () => setMessages([]);

  return (
    <>
      {/* ── Floating trigger button ──────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {!open && (
          <button
            onClick={() => setOpen(true)}
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
            <AshaOrb regimeState={regimeState} size={28} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: "#00E5FF",
              textTransform: "uppercase",
            }}>Ask ASHA</span>
          </button>
        )}
      </div>

      {/* ── Chat panel ──────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "min(420px, calc(100vw - 32px))",
            height: "min(580px, calc(100vh - 100px))",
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
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderBottom: "1px solid rgba(0,229,255,0.18)",
            background: "rgba(0,0,0,0.3)",
          }}>
            <AshaOrb regimeState={regimeState} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#00E5FF", lineHeight: 1 }}>ASHA</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(0,229,255,0.55)", textTransform: "uppercase" }}>Spirit of FAULTLINE</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Clear conversation"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.4)", padding: "4px", transition: "color 0.15s ease" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.4)"; }}
                >
                  <RotateCcw size={12} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.4)", padding: "4px", transition: "color 0.15s ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.4)"; }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <div>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "rgba(148,163,184,0.6)", lineHeight: 1.6, marginBottom: "14px" }}>
                  Here is what is building beneath the surface. Ask me anything about current market conditions, the engines, or what deserves your attention.
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
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "88%",
                  padding: "9px 12px",
                  borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  background: msg.role === "user" ? "rgba(0,229,255,0.18)" : "rgba(255,255,255,0.14)",
                  border: msg.role === "user" ? "1px solid rgba(0,229,255,0.32)" : "1px solid rgba(255,255,255,0.11)",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "12px",
                  lineHeight: 1.65,
                  color: msg.role === "user" ? "#E2E8F0" : "rgba(226,232,240,0.9)",
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>

                {/* Transparency toggle for ASHA responses */}
                {msg.role === "assistant" && (msg.confidence || msg.enginesConsulted) && (
                  <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={() => toggleTransparency(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "7px",
                        letterSpacing: "0.1em",
                        color: "rgba(100,116,139,0.4)",
                        textTransform: "uppercase",
                        padding: "2px 0",
                        transition: "color 0.12s ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,229,255,0.65)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.4)"; }}
                    >
                      <Eye size={9} />
                      {msg.showTransparency ? "Hide sources" : "Show sources"}
                      <ChevronDown size={8} style={{ transform: msg.showTransparency ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
                    </button>
                    {msg.confidence && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: confidenceColor(msg.confidence), letterSpacing: "0.1em" }}>
                        {msg.confidence.toUpperCase()} CONFIDENCE
                      </span>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && msg.showTransparency && <TransparencyPanel msg={msg} />}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                <AshaOrb regimeState={regimeState} size={18} />
                <div style={{ display: "flex", gap: "4px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "#00E5FF",
                      animation: `asha-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
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
              placeholder="Ask ASHA anything…"
              disabled={loading}
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
              onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,229,255,0.50)"; }}
              onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,229,255,0.25)"; }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${input.trim() && !loading ? "rgba(0,229,255,0.45)" : "rgba(255,255,255,0.11)"}`,
                borderRadius: "5px",
                padding: "8px 10px",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                color: input.trim() && !loading ? "#00E5FF" : "rgba(100,116,139,0.3)",
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
        @keyframes asha-panel-open {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes asha-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
