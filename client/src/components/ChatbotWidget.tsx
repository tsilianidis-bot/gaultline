/**
 * FAULTLINE AI Market Intelligence Concierge
 * Floating bottom-right chat widget for all public pages.
 *
 * Improvements:
 * - Chatbot Improvement 1: Live market context (regime, pressure score) injected into every message
 * - Chatbot Improvement 2: Conversation history persisted in localStorage — survives page refreshes
 * - Chatbot Improvement 3: Context-aware proactive welcome message based on current page
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { MessageCircle, X, Send, Loader2, Bot, ChevronDown, Mail, AlertCircle } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { useLocation } from "wouter";

// ── Visitor ID ────────────────────────────────────────────────────────────────
function getVisitorId(): string {
  const KEY = "faultline_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── History Persistence ───────────────────────────────────────────────────────
const HISTORY_KEY = "faultline_chat_history_v1";
const SESSION_ID_KEY = "faultline_chat_session_id_v1";
const MAX_PERSISTED_MESSAGES = 20; // keep last 20 messages in localStorage

function loadPersistedHistory(): Message[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ id: string; role: string; content: string; timestamp: string }>;
    return parsed.map(m => ({
      id: m.id,
      role: m.role as "user" | "bot",
      content: m.content,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]): void {
  try {
    const toSave = messages.slice(-MAX_PERSISTED_MESSAGES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
  } catch {}
}

function loadPersistedSessionId(): number | null {
  try {
    const raw = localStorage.getItem(SESSION_ID_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function saveSessionId(id: number): void {
  try { localStorage.setItem(SESSION_ID_KEY, String(id)); } catch {}
}

// ── Context-aware proactive welcome messages ──────────────────────────────────
function getProactiveWelcome(pathname: string, regimeLabel?: string): string {
  const regime = regimeLabel ? ` The current market regime is: **${regimeLabel}**.` : "";
  if (pathname.includes("/pressure")) {
    return `Hi! I'm the FAULTLINE AI Concierge.${regime} You're looking at the Pressure Index — want me to explain what the current score means for your portfolio?`;
  }
  if (pathname.includes("/signals")) {
    return `Hi! I'm the FAULTLINE AI Concierge.${regime} You're on the Signals page. Want me to explain how FAULTLINE scores stocks and crypto, or help you understand a specific signal?`;
  }
  if (pathname.includes("/diagnostic")) {
    return `Hi! I'm the FAULTLINE AI Concierge.${regime} You're using Diagnostic AI. Want me to explain what the 4-timeframe analysis means, or walk you through the current regime reading?`;
  }
  if (pathname.includes("/day-trade")) {
    return `Hi! I'm the FAULTLINE AI Concierge.${regime} You're on Day Trade Intelligence. Want me to explain how the Execution Score works or what makes a high-probability setup?`;
  }
  if (pathname.includes("/situation-room")) {
    return `Hi! I'm the FAULTLINE AI Concierge.${regime} You're in the Situation Room. Want me to explain how the Trade Preflight Simulator works?`;
  }
  if (pathname.includes("/discover") || pathname.includes("/command-center")) {
    return `Hi! I'm the FAULTLINE AI Concierge.${regime} You're on the Ask FAULTLINE page. I can help explain the platform, pricing, or answer questions about current market conditions.`;
  }
  return `Hi! I'm the FAULTLINE AI Concierge.${regime} I can explain our Pressure Index, Signals, Situation Room, Diagnostic AI, and pricing plans. What would you like to know?`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

const DISCLAIMER = "FAULTLINE provides market intelligence and risk analysis, not personalized financial advice.";

// ── Lead Capture Form ─────────────────────────────────────────────────────────
function LeadCaptureForm({
  sessionId,
  visitorId,
  leadScore,
  planInterest,
  onCaptured,
}: {
  sessionId: number;
  visitorId: string;
  leadScore: number;
  planInterest?: string;
  onCaptured: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const captureMutation = trpc.chatbot.captureLead.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      trackEvent("chatbot_lead_captured", { lead_score: leadScore, plan_interest: planInterest });
      setTimeout(onCaptured, 1500);
    },
  });

  if (submitted) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
        <p className="text-emerald-400 text-xs font-mono">✓ Got it! We'll be in touch.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0A1520] border border-cyan-400/20 rounded-lg p-3 space-y-2">
      <p className="text-xs text-slate-300 font-mono leading-relaxed">
        Want me to send you the best FAULTLINE plan for your use case?
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 bg-[#050A10] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50 font-mono"
          onKeyDown={e => {
            if (e.key === "Enter" && email.includes("@")) {
              captureMutation.mutate({ sessionId, visitorId, email, planInterest, leadScore });
            }
          }}
        />
        <button
          onClick={() => {
            if (email.includes("@")) {
              captureMutation.mutate({ sessionId, visitorId, email, planInterest, leadScore });
            }
          }}
          disabled={captureMutation.isPending || !email.includes("@")}
          className="px-2 py-1.5 bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/30 rounded text-cyan-400 disabled:opacity-40 transition-colors"
        >
          {captureMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Mail className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isBot = msg.role === "bot";
  return (
    <div className={`flex gap-2 ${isBot ? "items-start" : "items-start flex-row-reverse"}`}>
      {isBot && (
        <div className="w-6 h-6 rounded-full bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-cyan-400" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed font-mono ${
          isBot
            ? "bg-[#0A1520] border border-white/5 text-slate-200"
            : "bg-cyan-400/15 border border-cyan-400/20 text-cyan-100"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export default function ChatbotWidget() {
  const [location] = useLocation();

  // Live market context from engine
  const engine = (() => {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useEngine();
    } catch {
      return null;
    }
  })();

  // Fetch BTC cycle data from crypto intelligence (public, lightweight)
  const { data: cryptoData } = trpc.crypto.getSignals.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Only fetch when widget is open to avoid unnecessary requests
  });

  // Build live context object for server
  const liveContext = engine ? {
    regimeLabel:      engine.output.regime.label,
    pressureScore:    engine.output.overall.score * 10, // engine score is 0-10, convert to 0-100
    pressureLevel:    engine.output.overall.riskLevel,
    crashProbability: engine.output.probability.crashProbability,
    bullProbability:  engine.output.probability.bullProbability,
    currentPage:      location,
    // BTC cycle state from crypto intelligence
    ...(cryptoData?.btcDashboard ? {
      btcCyclePhase:      cryptoData.btcDashboard.marketCyclePhase.phase,
      btcCycleConfidence: cryptoData.btcDashboard.marketCyclePhase.confidence,
      ...(cryptoData.btcDashboard.accumulationAnalysis ? {
        btcAccumulationAnalysis: {
          directAnswer:          cryptoData.btcDashboard.accumulationAnalysis.directAnswer,
          confidenceLabel:       cryptoData.btcDashboard.accumulationAnalysis.confidenceLabel,
          keyEvidence:           cryptoData.btcDashboard.accumulationAnalysis.keyEvidence,
          bullCycleConfirmation: cryptoData.btcDashboard.accumulationAnalysis.bullCycleConfirmation,
          invalidationSignals:   cryptoData.btcDashboard.accumulationAnalysis.invalidationSignals,
          tradingBias:           cryptoData.btcDashboard.accumulationAnalysis.tradingBias,
        },
      } : {}),
    } : {}),
  } : undefined;

  // ── History persistence: load from localStorage on mount ──────────────────
  const [messages, setMessages] = useState<Message[]>(() => {
    const persisted = loadPersistedHistory();
    if (persisted.length > 0) return persisted;
    // Build context-aware welcome message
    const welcomeContent = getProactiveWelcome(
      typeof window !== "undefined" ? window.location.pathname : "/",
      engine?.output.regime.label,
    );
    return [{
      id: "welcome",
      role: "bot" as const,
      content: welcomeContent,
      timestamp: new Date(),
    }];
  });

  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(() => loadPersistedSessionId());
  const [isTyping, setIsTyping] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadScore, setLeadScore] = useState(0);
  const [planInterest, setPlanInterest] = useState<string | undefined>();
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visitorId = useRef(getVisitorId()).current;

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const startSession = trpc.chatbot.startSession.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      saveSessionId(data.sessionId);
    },
  });

  const sendMessage = trpc.chatbot.sendMessage.useMutation({
    onSuccess: (data) => {
      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        role: "bot",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
      setLeadScore(data.leadScore);

      // Show lead capture if high intent and not yet captured
      if (data.askForEmail && !leadCaptured && !showLeadCapture) {
        setShowLeadCapture(true);
      }

      // Track analytics events
      trackEvent("chatbot_message_sent", { intent: data.intent, lead_score: data.leadScore });
      if (data.intent === "signup") trackEvent("chatbot_signup_clicked");
      if (data.intent === "pricing") trackEvent("chatbot_pricing_clicked");
      if (data.intent === "upgrade") trackEvent("chatbot_upgrade_clicked");

      // Increment unread if closed
      if (!isOpen) setUnread(prev => prev + 1);
    },
    onError: () => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "bot",
          content: "I'm having a moment. Please try again.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, showLeadCapture]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setUnread(0);
    trackEvent("chatbot_opened", { page: window.location.pathname });

    // Start session if not started (or if persisted session was lost)
    if (!sessionId && !startSession.isPending) {
      startSession.mutate({ visitorId, pageUrl: window.location.href });
    }
  }, [sessionId, startSession, visitorId]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !sessionId || isTyping) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setShowLeadCapture(false);

    // Pass live market context with every message (Improvement 1)
    sendMessage.mutate({ sessionId, visitorId, message: text, liveContext });
  }, [input, sessionId, isTyping, sendMessage, visitorId, liveContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button — on mobile, raised above the 72px bottom nav bar */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#050A10] border border-cyan-400/40 shadow-lg shadow-cyan-400/10 flex items-center justify-center hover:border-cyan-400/70 hover:shadow-cyan-400/20 transition-all duration-200 active:scale-95 group md:bottom-6"
        style={{ bottom: 'calc(72px + 16px)' }}
        aria-label="Open FAULTLINE AI Concierge"
      >
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-cyan-400" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat panel — on mobile, positioned above the raised FAB */}
      {isOpen && (
        <div
          className="fixed right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-[#050A10] shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
          style={{ height: "520px", bottom: 'calc(72px + 16px + 56px + 12px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#080F1A]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100 font-mono tracking-wide">FAULTLINE AI</p>
                <p className="text-[10px] text-cyan-400/70 font-mono">Market Intelligence Concierge</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Clear history button */}
              <button
                onClick={() => {
                  try { localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(SESSION_ID_KEY); } catch {}
                  const welcomeContent = getProactiveWelcome(window.location.pathname, engine?.output.regime.label);
                  setMessages([{ id: "welcome", role: "bot", content: welcomeContent, timestamp: new Date() }]);
                  setSessionId(null);
                  setLeadCaptured(false);
                  setShowLeadCapture(false);
                  startSession.mutate({ visitorId, pageUrl: window.location.href });
                }}
                className="text-slate-600 hover:text-slate-400 transition-colors text-[9px] font-mono"
                title="Clear chat history"
              >
                CLEAR
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {isTyping && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-cyan-400" />
                </div>
                <div className="bg-[#0A1520] border border-white/5 rounded-lg px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {showLeadCapture && !leadCaptured && sessionId && (
              <LeadCaptureForm
                sessionId={sessionId}
                visitorId={visitorId}
                leadScore={leadScore}
                planInterest={planInterest}
                onCaptured={() => {
                  setShowLeadCapture(false);
                  setLeadCaptured(true);
                }}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Disclaimer */}
          <div className="px-4 py-1.5 border-t border-white/5 bg-[#080F1A]">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-2.5 h-2.5 text-amber-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-600 font-mono leading-relaxed">{DISCLAIMER}</p>
            </div>
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/5 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? "Ask about Pressure Index, Signals, pricing..." : "Connecting..."}
              disabled={!sessionId || isTyping}
              className="flex-1 bg-[#0A1520] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/40 font-mono disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !sessionId || isTyping}
              className="w-8 h-8 rounded-lg bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/30 flex items-center justify-center text-cyan-400 disabled:opacity-40 transition-all active:scale-95"
            >
              {isTyping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
