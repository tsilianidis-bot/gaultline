/**
 * FAULTLINE — ASHA Intelligence Center
 * Route: /app/asha-intelligence
 *
 * The memory and reasoning center of FAULTLINE.
 * Shows ASHA's ongoing market observations, session context,
 * conversation history, and follow-up intelligence.
 * This is not a chat inbox. It is the record of an ongoing
 * relationship with market intelligence.
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useLocation } from "wouter";
import AshaOrb from "@/components/AshaOrb";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatTime(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "10px",
      letterSpacing: "0.22em",
      color: "rgba(0,229,255,0.5)",
      textTransform: "uppercase",
      marginBottom: "14px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}>
      <div style={{ height: "1px", width: "20px", background: "rgba(0,229,255,0.3)" }} />
      {text}
    </div>
  );
}

function EmptyState({ icon, title, subtitle, ctaLabel, ctaPath }: {
  icon: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaPath?: string;
}) {
  const [, navigate] = useLocation();
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      textAlign: "center",
      gap: "12px",
    }}>
      <div style={{ fontSize: "32px", opacity: 0.4 }}>{icon}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "rgba(240,244,255,0.6)" }}>{title}</div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(100,116,139,0.7)", maxWidth: "280px", lineHeight: 1.5 }}>{subtitle}</div>
      {ctaLabel && ctaPath && (
        <button
          onClick={() => navigate(ctaPath)}
          style={{
            marginTop: "8px",
            background: "rgba(0,229,255,0.08)",
            border: "1px solid rgba(0,229,255,0.3)",
            borderRadius: "4px",
            padding: "8px 18px",
            color: "#00E5FF",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.12em",
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function IntelCard({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(10,13,20,0.95) 0%, rgba(6,8,14,0.92) 100%)",
      border: `1px solid ${accent ? `${accent}20` : "rgba(255,255,255,0.08)"}`,
      borderTop: `1px solid ${accent ? `${accent}35` : "rgba(255,255,255,0.12)"}`,
      borderRadius: "6px",
      padding: "18px",
      marginBottom: "12px",
    }}>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AshaIntelligenceCenter() {
  const [, navigate] = useLocation();
  const { output } = useEngine();
  const { overall, regime } = output;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedConv, setExpandedConv] = useState<number | null>(null);

  // Backend data
  const { data: todayConv, isLoading: loadingConv } = trpc.ashaMemory.getTodayConversation.useQuery();
  const { data: timeline, isLoading: loadingTimeline } = trpc.ashaMemory.getIntelligenceTimeline.useQuery();
  const { data: symbols } = trpc.ashaMemory.getRecentSymbols.useQuery();
  const { data: topics } = trpc.ashaMemory.getRecentTopics.useQuery();
  const { data: thesis, isLoading: loadingThesis } = trpc.ashaMemory.synthesizeMarketThesis.useQuery();
  const { data: followUps, isLoading: loadingFollowUps } = trpc.ashaMemory.getFollowUpQuestions.useQuery();
  const { data: whatChanged } = trpc.ashaMemory.getWhatChangedSummary.useQuery({
    currentPressureScore: overall.score,
    currentRegime: regime.label,
  });
  const { data: stats } = trpc.ashaMemory.getSessionStats.useQuery();

  // Regime color
  const color = overall.score >= 7 ? "#FF2D55" : overall.score >= 4.5 ? "#FF9500" : "#00E5FF";
  const regimeState = overall.score >= 7 ? "critical" : overall.score >= 4.5 ? "rising" : "calm";

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const hasAnyHistory = (todayConv?.totalMessages ?? 0) > 0 || (timeline?.entries?.length ?? 0) > 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070910",
      color: "#F0F6FF",
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(7,9,16,0.96)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${color}22`,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <AshaOrb regimeState={regimeState} size={28} isListening={false} />
        <div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F6FF", lineHeight: 1 }}>
            ASHA Intelligence
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,229,255,0.5)", letterSpacing: "0.15em", marginTop: "2px" }}>
            MEMORY · REASONING · CONTINUITY
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate("/app/discover")}
          style={{
            background: `${color}12`,
            border: `1px solid ${color}35`,
            borderRadius: "4px",
            padding: "7px 14px",
            color,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.12em",
            cursor: "pointer",
          }}
        >
          ASK ASHA →
        </button>
      </div>

      <div style={{ padding: "20px", maxWidth: "680px", margin: "0 auto" }}>

        {/* ── What Changed Since Your Last Visit ── */}
        {whatChanged?.summary && (
          <IntelCard accent="#00E5FF">
            <SectionLabel text="What Changed Since Your Last Visit" />
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "14px",
              color: "rgba(240,244,255,0.85)",
              lineHeight: 1.7,
              marginBottom: "10px",
            }}>
              {whatChanged.summary}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.55)" }}>
                Last visit: {whatChanged.lastVisit ? formatRelativeTime(whatChanged.lastVisit) : "—"}
              </div>
              <button
                onClick={() => copyText(whatChanged.summary!, "whatchanged")}
                style={{ background: "transparent", border: "none", color: "rgba(0,229,255,0.4)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", cursor: "pointer", letterSpacing: "0.1em" }}
              >
                {copiedId === "whatchanged" ? "COPIED" : "COPY"}
              </button>
            </div>
          </IntelCard>
        )}

        {/* ── Current Market Thesis ── */}
        <IntelCard accent={color}>
          <SectionLabel text="Current Market Thesis" />
          {loadingThesis ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(100,116,139,0.5)", padding: "12px 0" }}>
              ASHA is synthesizing your recent conversations...
            </div>
          ) : thesis?.thesis ? (
            <>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "14px",
                color: "rgba(240,244,255,0.9)",
                lineHeight: 1.7,
                borderLeft: `2px solid ${color}50`,
                paddingLeft: "14px",
                marginBottom: "12px",
              }}>
                {thesis.thesis}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.45)" }}>
                  Synthesized from your last 7 days · {formatRelativeTime(thesis.generatedAt)}
                </div>
                <button
                  onClick={() => copyText(thesis.thesis!, "thesis")}
                  style={{ background: "transparent", border: "none", color: "rgba(0,229,255,0.4)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", cursor: "pointer", letterSpacing: "0.1em" }}
                >
                  {copiedId === "thesis" ? "COPIED" : "COPY"}
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              icon="🧠"
              title="No thesis yet"
              subtitle="Ask ASHA a few market questions and she will synthesize your current market perspective here."
              ctaLabel="ASK ASHA →"
              ctaPath="/app/discover"
            />
          )}
        </IntelCard>

        {/* ── Today's Active Conversation ── */}
        <IntelCard>
          <SectionLabel text="Today's Active Conversation" />
          {loadingConv ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(100,116,139,0.5)", padding: "12px 0" }}>
              Loading conversation history...
            </div>
          ) : (todayConv?.conversations?.length ?? 0) > 0 ? (
            <>
              {todayConv!.conversations.slice(0, 5).map((conv) => (
                <div key={conv.id} style={{ marginBottom: "16px" }}>
                  {/* Conversation header */}
                  <div
                    onClick={() => setExpandedConv(expandedConv === conv.id ? null : conv.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.1em" }}>
                        {formatTime(conv.startedAt)} · {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""}
                        {conv.symbols.length > 0 && ` · ${conv.symbols.slice(0, 3).join(", ")}`}
                      </div>
                      {conv.messages[0]?.role === "user" && (
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(240,244,255,0.75)", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {conv.messages[0].content.slice(0, 100)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)" }}>
                      {expandedConv === conv.id ? "▲" : "▼"}
                    </div>
                  </div>

                  {/* Expanded messages */}
                  {expandedConv === conv.id && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {conv.messages.map((msg) => (
                        <div key={msg.id} style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "flex-start",
                        }}>
                          <div style={{
                            flexShrink: 0,
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: msg.role === "user" ? "rgba(255,255,255,0.08)" : `${color}20`,
                            border: `1px solid ${msg.role === "user" ? "rgba(255,255,255,0.12)" : `${color}35`}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "9px",
                            color: msg.role === "user" ? "rgba(255,255,255,0.5)" : color,
                            fontFamily: "'IBM Plex Mono', monospace",
                            letterSpacing: "0.05em",
                          }}>
                            {msg.role === "user" ? "YOU" : "A"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontFamily: msg.role === "user" ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif",
                              fontSize: msg.role === "user" ? "12px" : "13px",
                              color: msg.role === "user" ? "rgba(240,244,255,0.65)" : "rgba(240,244,255,0.88)",
                              lineHeight: 1.6,
                            }}>
                              {msg.content.slice(0, 600)}{msg.content.length > 600 ? "..." : ""}
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)", marginTop: "4px" }}>
                              {formatTime(msg.timestamp)}
                              {msg.confidenceScore != null && msg.role === "assistant" && (
                                <span style={{ marginLeft: "8px", color: msg.confidenceScore >= 70 ? "#00FF88" : msg.confidenceScore >= 40 ? "#FF9500" : "#FF2D55" }}>
                                  {Math.round(msg.confidenceScore)}% confidence
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => navigate("/app/discover")}
                        style={{
                          alignSelf: "flex-start",
                          marginTop: "4px",
                          background: `${color}10`,
                          border: `1px solid ${color}30`,
                          borderRadius: "4px",
                          padding: "6px 14px",
                          color,
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: "10px",
                          letterSpacing: "0.12em",
                          cursor: "pointer",
                        }}
                      >
                        CONTINUE THIS CONVERSATION →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <EmptyState
              icon="💬"
              title="No conversations today"
              subtitle="ASHA has been observing markets. Ask her anything to begin today's intelligence session."
              ctaLabel="START CONVERSATION →"
              ctaPath="/app/discover"
            />
          )}
        </IntelCard>

        {/* ── Follow-up Questions Suggested by ASHA ── */}
        <IntelCard accent="#00E5FF">
          <SectionLabel text="Follow-up Questions Suggested by ASHA" />
          {loadingFollowUps ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(100,116,139,0.5)", padding: "8px 0" }}>
              ASHA is generating follow-up questions...
            </div>
          ) : (followUps?.questions?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {followUps!.questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/app/discover?q=${encodeURIComponent(q)}`)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    background: "rgba(0,229,255,0.04)",
                    border: "1px solid rgba(0,229,255,0.14)",
                    borderRadius: "4px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.08)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.28)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.04)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.14)";
                  }}
                >
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(0,229,255,0.5)", flexShrink: 0, marginTop: "1px" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(240,244,255,0.8)", lineHeight: 1.5 }}>
                    {q}
                  </div>
                  <div style={{ flexShrink: 0, color: "rgba(0,229,255,0.4)", fontSize: "11px", marginLeft: "auto" }}>→</div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="❓"
              title="No follow-ups yet"
              subtitle="After your first conversation, ASHA will suggest questions that deepen your market understanding."
              ctaLabel="ASK ASHA →"
              ctaPath="/app/discover"
            />
          )}
        </IntelCard>

        {/* ── Intelligence Timeline ── */}
        <IntelCard>
          <SectionLabel text="Intelligence Timeline — Last 7 Days" />
          {loadingTimeline ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(100,116,139,0.5)", padding: "8px 0" }}>
              Loading intelligence timeline...
            </div>
          ) : (timeline?.entries?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {timeline!.entries.slice(0, 12).map((entry, i) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    gap: "14px",
                    padding: "12px 0",
                    borderBottom: i < Math.min(timeline!.entries.length, 12) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => navigate(`/app/discover?q=${encodeURIComponent(entry.question ?? "")}`)}
                >
                  {/* Timeline dot + line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: "16px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}60`, flexShrink: 0 }} />
                    {i < Math.min(timeline!.entries.length, 12) - 1 && (
                      <div style={{ flex: 1, width: "1px", background: "rgba(255,255,255,0.08)", marginTop: "4px" }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: "4px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginBottom: "4px" }}>
                      {formatRelativeTime(entry.startedAt)}
                      {entry.symbols.length > 0 && (
                        <span style={{ marginLeft: "8px", color: `${color}80` }}>{entry.symbols.slice(0, 3).join(" · ")}</span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(240,244,255,0.8)", lineHeight: 1.5, marginBottom: entry.answerSummary ? "6px" : "0" }}>
                      {entry.question}
                    </div>
                    {entry.answerSummary && (
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "rgba(100,116,139,0.65)", lineHeight: 1.5, borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: "10px" }}>
                        {entry.answerSummary.slice(0, 200)}{entry.answerSummary.length > 200 ? "..." : ""}
                      </div>
                    )}
                    {entry.topics.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                        {entry.topics.slice(0, 3).map((t) => (
                          <span key={t} style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: "10px",
                            color: "rgba(0,229,255,0.5)",
                            background: "rgba(0,229,255,0.06)",
                            border: "1px solid rgba(0,229,255,0.14)",
                            borderRadius: "3px",
                            padding: "2px 7px",
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📅"
              title="No history yet"
              subtitle="Your intelligence timeline will appear here as you ask ASHA questions over time."
              ctaLabel="BEGIN →"
              ctaPath="/app/discover"
            />
          )}
        </IntelCard>

        {/* ── Two-column: Symbols + Topics ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>

          {/* Symbols Recently Analyzed */}
          <div style={{
            background: "linear-gradient(135deg, rgba(10,13,20,0.95) 0%, rgba(6,8,14,0.92) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "6px",
            padding: "16px",
          }}>
            <SectionLabel text="Symbols Analyzed" />
            {(symbols?.symbols?.length ?? 0) > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {symbols!.symbols.slice(0, 8).map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => navigate(`/app/symbol/${s.symbol}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: color }}>{s.symbol}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>{s.count}×</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.4)", lineHeight: 1.5 }}>
                No symbols discussed yet
              </div>
            )}
          </div>

          {/* Recently Explained Topics */}
          <div style={{
            background: "linear-gradient(135deg, rgba(10,13,20,0.95) 0%, rgba(6,8,14,0.92) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "6px",
            padding: "16px",
          }}>
            <SectionLabel text="Topics Discussed" />
            {(topics?.topics?.length ?? 0) > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {topics!.topics.slice(0, 8).map((t) => (
                  <button
                    key={t.topic}
                    onClick={() => navigate(`/app/discover?q=${encodeURIComponent(t.topic)}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "rgba(240,244,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{t.topic}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", flexShrink: 0 }}>{t.count}×</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.4)", lineHeight: 1.5 }}>
                No topics discussed yet
              </div>
            )}
          </div>
        </div>

        {/* ── Session Stats ── */}
        {stats && (
          <div style={{
            background: "linear-gradient(135deg, rgba(10,13,20,0.95) 0%, rgba(6,8,14,0.92) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "6px",
            padding: "16px",
            marginBottom: "12px",
          }}>
            <SectionLabel text="Your Intelligence History" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0" }}>
              {[
                { label: "QUESTIONS", value: stats.totalQuestions.toString() },
                { label: "SESSIONS", value: stats.totalSessions.toString() },
                { label: "SYMBOLS", value: stats.uniqueSymbols.toString() },
                { label: "TOPICS", value: stats.uniqueTopics.toString() },
              ].map(({ label, value }, i) => (
                <div key={label} style={{
                  textAlign: "center",
                  padding: "10px 8px",
                  borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color, textShadow: `0 0 14px ${color}60`, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", letterSpacing: "0.12em", marginTop: "3px" }}>{label}</div>
                </div>
              ))}
            </div>
            {stats.firstSession && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.35)", textAlign: "center", marginTop: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                ASHA has been your intelligence layer since {formatDate(stats.firstSession)}
              </div>
            )}
          </div>
        )}

        {/* ── Footer CTA ── */}
        <div style={{
          textAlign: "center",
          padding: "24px 0 40px",
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.15em", marginBottom: "14px" }}>
            ASHA CONTINUES OBSERVING MARKETS WHILE YOU ARE AWAY
          </div>
          <button
            onClick={() => navigate("/app/discover")}
            style={{
              background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
              border: `1px solid ${color}40`,
              borderRadius: "4px",
              padding: "12px 28px",
              color,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.15em",
              cursor: "pointer",
              boxShadow: `0 0 20px ${color}15`,
            }}
          >
            CONTINUE YOUR CONVERSATION WITH ASHA →
          </button>
        </div>

      </div>
    </div>
  );
}
