/**
 * FAULTLINE — Decision Ledger
 * Tracks every Ask Intelligence recommendation with verdict, confidence,
 * and outcome tracking. Supports manual user review AND automated evaluation
 * via the scheduled heartbeat engine.
 */
import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useSEO } from "@/hooks/useSEO";
import {
  CheckCircle, XCircle, Clock, BookOpen, BarChart2,
  TrendingUp, TrendingDown, Activity, ArrowLeft,
  ChevronDown, ChevronUp, Zap, User, AlertCircle, Minus,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────
const BG = "#050608";
const SURFACE = "rgba(10,12,18,0.98)";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#00D4FF";
const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };
const SANS: React.CSSProperties = { fontFamily: "'Rajdhani', sans-serif" };
const MONO_SM: React.CSSProperties = { ...MONO, fontSize: "11px", letterSpacing: "0.06em" };

// ── Types ─────────────────────────────────────────────────────

interface LedgerEntry {
  id: number;
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  verdict: string;
  opportunityScore: number;
  confidence: number;
  primaryDriver: string;
  expectedTimeframe: string;
  queryType: string;
  outcome: "pending" | "correct" | "incorrect" | "partially_correct" | "still_active";
  notes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  // New auto-evaluation fields (optional — may not exist on older entries)
  priceAtEntry?: number | null;
  priceAtResolution?: number | null;
  elapsedTimeframe?: string | null;
  evaluationNotes?: string | null;
  autoEvaluated?: boolean | null;
  evaluatedAt?: Date | null;
}

// ── Helpers ───────────────────────────────────────────────────

function verdictColor(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v.includes("STRONG BUY") || v.includes("BUY") || v.includes("ACCUMULATE")) return "#00FF88";
  if (v.includes("SELL") || v.includes("REDUCE") || v.includes("HIGH RISK")) return "#FF4444";
  if (v.includes("WAIT") || v.includes("HOLD") || v.includes("LOW CONVICTION")) return "#FFD700";
  return "#00D4FF";
}

function outcomeIcon(outcome: string) {
  if (outcome === "correct") return <CheckCircle size={14} style={{ color: "#00FF88" }} />;
  if (outcome === "incorrect") return <XCircle size={14} style={{ color: "#FF4444" }} />;
  if (outcome === "partially_correct") return <AlertCircle size={14} style={{ color: "#FFB800" }} />;
  if (outcome === "still_active") return <Activity size={14} style={{ color: "#00D4FF" }} />;
  return <Clock size={14} style={{ color: "#FFD700" }} />;
}

function outcomeLabel(outcome: string): string {
  if (outcome === "correct") return "CORRECT";
  if (outcome === "incorrect") return "INCORRECT";
  if (outcome === "partially_correct") return "PARTIAL";
  if (outcome === "still_active") return "ACTIVE";
  return "PENDING";
}

function outcomeColor(outcome: string): string {
  if (outcome === "correct") return "#00FF88";
  if (outcome === "incorrect") return "#FF4444";
  if (outcome === "partially_correct") return "#FFB800";
  if (outcome === "still_active") return "#00D4FF";
  return "#FFD700";
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function priceDelta(entry: number | null, resolution: number | null): { pct: string; color: string } | null {
  if (entry == null || resolution == null || entry === 0) return null;
  const pct = ((resolution - entry) / entry) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    pct: `${sign}${pct.toFixed(2)}%`,
    color: pct >= 0 ? "#00FF88" : "#FF4444",
  };
}

// ── Stats Card ────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{
      padding: "14px 16px",
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: "8px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    }}>
      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ ...MONO, fontSize: "20px", fontWeight: 700, color: color ?? "#F0F4FF" }}>{value}</div>
      {sub && <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>{sub}</div>}
    </div>
  );
}

// ── Auto-Evaluation Badge ─────────────────────────────────────

function EvalBadge({ autoEvaluated }: { autoEvaluated: boolean | null }) {
  if (autoEvaluated == null) return null;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "3px",
      padding: "2px 6px",
      background: autoEvaluated ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${autoEvaluated ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: "3px",
      ...MONO_SM,
      fontSize: "8px",
      color: autoEvaluated ? ACCENT : "rgba(255,255,255,0.3)",
      letterSpacing: "0.1em",
    }}>
      {autoEvaluated ? <Zap size={8} /> : <User size={8} />}
      {autoEvaluated ? "AUTO" : "MANUAL"}
    </span>
  );
}

// ── Ledger Entry Row ──────────────────────────────────────────

function LedgerRow({ entry, onUpdateOutcome }: {
  entry: LedgerEntry;
  onUpdateOutcome: (id: number, outcome: "correct" | "incorrect" | "pending" | "partially_correct" | "still_active", notes?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const vc = verdictColor(entry.verdict);
  const delta = priceDelta(entry.priceAtEntry ?? null, entry.priceAtResolution ?? null);

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: "8px",
      overflow: "hidden",
      transition: "border-color 0.15s ease",
    }}>
      {/* Main row */}
      <div style={{
        padding: "12px 16px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: "12px",
        cursor: "pointer",
      }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Outcome icon */}
        <div style={{ flexShrink: 0 }}>
          {outcomeIcon(entry.outcome)}
        </div>

        {/* Verdict + ticker + date */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "2px" }}>
            {entry.ticker && (
              <span style={{
                ...MONO, fontSize: "10px", fontWeight: 700,
                color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em",
                padding: "1px 6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px",
              }}>
                {entry.ticker}
              </span>
            )}
            <span style={{ ...SANS, fontSize: "14px", fontWeight: 700, color: vc, letterSpacing: "0.06em" }}>
              {entry.verdict}
            </span>
            {/* Outcome badge */}
            <span style={{
              ...MONO_SM, fontSize: "8px",
              color: outcomeColor(entry.outcome),
              padding: "1px 5px",
              background: `${outcomeColor(entry.outcome)}15`,
              border: `1px solid ${outcomeColor(entry.outcome)}30`,
              borderRadius: "3px",
              letterSpacing: "0.1em",
            }}>
              {outcomeLabel(entry.outcome)}
            </span>
            {entry.autoEvaluated != null && <EvalBadge autoEvaluated={entry.autoEvaluated} />}
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>
              {formatDate(entry.createdAt)}
            </span>
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: "rgba(255,255,255,0.4)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {entry.primaryDriver}
          </div>
        </div>

        {/* Scores + price delta */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {delta && (
            <div style={{ textAlign: "center" }}>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "8px" }}>MOVE</div>
              <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: delta.color }}>{delta.pct}</div>
            </div>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "8px" }}>OPP</div>
            <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: entry.opportunityScore >= 65 ? "#00FF88" : entry.opportunityScore >= 40 ? "#FFD700" : "#FF4444" }}>
              {entry.opportunityScore}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "8px" }}>CONF</div>
            <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: entry.confidence >= 70 ? "#00FF88" : entry.confidence >= 45 ? "#FFD700" : "#FF4444" }}>
              {entry.confidence}%
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <div style={{ flexShrink: 0 }}>
          {expanded
            ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
            : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          }
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Primary driver */}
          <div style={{
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: "5px",
          }}>
            <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "4px", fontSize: "9px" }}>PRIMARY DRIVER</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC", lineHeight: 1.5 }}>
              {entry.primaryDriver}
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>TIMEFRAME</div>
              <div style={{ ...MONO_SM, color: "#F0F4FF", fontSize: "11px" }}>{entry.expectedTimeframe}</div>
            </div>
            {entry.elapsedTimeframe && (
              <div>
                <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>ELAPSED</div>
                <div style={{ ...MONO_SM, color: "#F0F4FF", fontSize: "11px" }}>{entry.elapsedTimeframe}</div>
              </div>
            )}
            <div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>ASSET TYPE</div>
              <div style={{ ...MONO_SM, color: "#F0F4FF", fontSize: "11px" }}>{entry.assetType?.toUpperCase() ?? "MACRO"}</div>
            </div>
            <div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>QUERY TYPE</div>
              <div style={{ ...MONO_SM, color: "#F0F4FF", fontSize: "11px" }}>{entry.queryType.toUpperCase()}</div>
            </div>
            {entry.resolvedAt && (
              <div>
                <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>RESOLVED</div>
                <div style={{ ...MONO_SM, color: "#F0F4FF", fontSize: "11px" }}>{formatDate(entry.resolvedAt)}</div>
              </div>
            )}
          </div>

          {/* Price tracking row */}
          {(entry.priceAtEntry != null || entry.priceAtResolution != null) && (
            <div style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: "5px",
            }}>
              <div>
                <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>PRICE AT ENTRY</div>
                <div style={{ ...MONO, fontSize: "13px", fontWeight: 700, color: "#F0F4FF" }}>
                  {formatPrice(entry.priceAtEntry)}
                </div>
              </div>
              {entry.priceAtResolution != null && (
                <>
                  <div style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.15)" }}>→</div>
                  <div>
                    <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>PRICE AT RESOLUTION</div>
                    <div style={{ ...MONO, fontSize: "13px", fontWeight: 700, color: "#F0F4FF" }}>
                      {formatPrice(entry.priceAtResolution)}
                    </div>
                  </div>
                  {delta && (
                    <div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px" }}>MOVE</div>
                      <div style={{ ...MONO, fontSize: "13px", fontWeight: 700, color: delta.color }}>
                        {delta.pct}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Auto-evaluation notes */}
          {entry.evaluationNotes && (
            <div style={{
              padding: "10px 12px",
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.12)",
              borderRadius: "5px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <Zap size={10} style={{ color: ACCENT }} />
                <div style={{ ...MONO_SM, color: ACCENT, fontSize: "9px", letterSpacing: "0.1em" }}>
                  AUTO-EVALUATION NOTES
                  {entry.evaluatedAt && (
                    <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: "8px" }}>
                      {formatDate(entry.evaluatedAt)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                {entry.evaluationNotes}
              </div>
            </div>
          )}

          {/* User notes */}
          <div>
            <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", marginBottom: "4px", fontSize: "9px" }}>YOUR NOTES</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add your own notes about this recommendation..."
              rows={2}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "5px",
                padding: "8px 10px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "12px",
                color: "#C8D0DC",
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Outcome buttons */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "9px", letterSpacing: "0.1em" }}>OVERRIDE:</span>
            <button
              onClick={() => onUpdateOutcome(entry.id, "correct", notes)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "5px 10px",
                background: entry.outcome === "correct" ? "rgba(0,255,136,0.15)" : "rgba(0,255,136,0.05)",
                border: `1px solid ${entry.outcome === "correct" ? "rgba(0,255,136,0.4)" : "rgba(0,255,136,0.15)"}`,
                borderRadius: "4px", cursor: "pointer",
                ...MONO_SM, color: "#00FF88", fontSize: "10px",
                transition: "all 0.15s ease",
              }}
            >
              <CheckCircle size={10} />
              CORRECT
            </button>
            <button
              onClick={() => onUpdateOutcome(entry.id, "partially_correct", notes)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "5px 10px",
                background: entry.outcome === "partially_correct" ? "rgba(255,184,0,0.15)" : "rgba(255,184,0,0.05)",
                border: `1px solid ${entry.outcome === "partially_correct" ? "rgba(255,184,0,0.4)" : "rgba(255,184,0,0.15)"}`,
                borderRadius: "4px", cursor: "pointer",
                ...MONO_SM, color: "#FFB800", fontSize: "10px",
                transition: "all 0.15s ease",
              }}
            >
              <AlertCircle size={10} />
              PARTIAL
            </button>
            <button
              onClick={() => onUpdateOutcome(entry.id, "incorrect", notes)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "5px 10px",
                background: entry.outcome === "incorrect" ? "rgba(255,68,68,0.15)" : "rgba(255,68,68,0.05)",
                border: `1px solid ${entry.outcome === "incorrect" ? "rgba(255,68,68,0.4)" : "rgba(255,68,68,0.15)"}`,
                borderRadius: "4px", cursor: "pointer",
                ...MONO_SM, color: "#FF4444", fontSize: "10px",
                transition: "all 0.15s ease",
              }}
            >
              <XCircle size={10} />
              INCORRECT
            </button>
            <button
              onClick={() => onUpdateOutcome(entry.id, "still_active", notes)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "5px 10px",
                background: entry.outcome === "still_active" ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.05)",
                border: `1px solid ${entry.outcome === "still_active" ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.15)"}`,
                borderRadius: "4px", cursor: "pointer",
                ...MONO_SM, color: ACCENT, fontSize: "10px",
                transition: "all 0.15s ease",
              }}
            >
              <Activity size={10} />
              STILL ACTIVE
            </button>
            {entry.outcome !== "pending" && (
              <button
                onClick={() => onUpdateOutcome(entry.id, "pending", notes)}
                style={{
                  padding: "5px 10px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "4px", cursor: "pointer",
                  ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px",
                }}
              >
                RESET
              </button>
            )}
          </div>

          {/* Disclaimer: user always has final say */}
          <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
            Auto-evaluation is conservative and informational only. Your manual override always takes precedence.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function DecisionLedger() {
  useSEO({
    title: "FAULTLINE — Decision Ledger",
    description: "Track every Ask Intelligence recommendation and build an accuracy audit trail.",
  });

  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "pending" | "correct" | "incorrect" | "partially_correct" | "still_active">("all");

  const { data: entries = [], refetch } = trpc.smartDiscovery.getLedger.useQuery(
    { limit: 200 },
    { enabled: !!user }
  );
  const { data: stats } = trpc.smartDiscovery.getLedgerStats.useQuery(
    undefined,
    { enabled: !!user }
  );
  const updateMutation = trpc.smartDiscovery.updateOutcome.useMutation({
    onSuccess: () => void refetch(),
  });

  const handleUpdateOutcome = (id: number, outcome: "correct" | "incorrect" | "pending" | "partially_correct" | "still_active", notes?: string) => {
    updateMutation.mutate({ id, outcome, notes });
  };

  const filteredEntries = (entries as LedgerEntry[]).filter(e => {
    if (filter === "all") return true;
    return e.outcome === filter;
  });

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ ...MONO_SM, color: ACCENT }}>LOADING...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: "16px" }}>
        <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.4)" }}>Sign in to access the Decision Ledger.</div>
        <a href={getLoginUrl()} style={{
          padding: "10px 24px",
          background: "rgba(0,212,255,0.1)",
          border: "1px solid rgba(0,212,255,0.3)",
          borderRadius: "5px",
          color: ACCENT,
          ...MONO_SM,
          textDecoration: "none",
        }}>
          SIGN IN
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => navigate("/app/discover")}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "none", border: "none", cursor: "pointer",
            ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px",
            marginBottom: "12px", padding: 0,
          }}
        >
          <ArrowLeft size={10} />
          BACK TO ASK
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <BookOpen size={16} style={{ color: ACCENT }} />
          <div>
            <div style={{ ...SANS, fontSize: "22px", fontWeight: 800, color: "#F0F4FF", letterSpacing: "0.08em" }}>
              DECISION LEDGER
            </div>
            <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>
              Ask Intelligence recommendation history · auto-evaluated every 6h · manual override always wins
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px", marginBottom: "20px" }}>
          <StatCard label="TOTAL" value={stats.total} sub="recommendations" />
          <StatCard
            label="WIN RATE"
            value={stats.winRate != null ? `${stats.winRate}%` : "—"}
            sub={`${stats.resolved} resolved`}
            color={stats.winRate != null ? (stats.winRate >= 60 ? "#00FF88" : stats.winRate >= 40 ? "#FFD700" : "#FF4444") : "rgba(255,255,255,0.4)"}
          />
          <StatCard label="CORRECT" value={stats.correct} color="#00FF88" />
          <StatCard label="PARTIAL" value={(stats as any).partiallyCorrect ?? 0} color="#FFB800" />
          <StatCard label="INCORRECT" value={stats.incorrect} color="#FF4444" />
          <StatCard label="ACTIVE" value={(stats as any).stillActive ?? 0} color={ACCENT} />
          <StatCard label="PENDING" value={stats.pending} color="#FFD700" />
        </div>
      )}

      {/* Accuracy by asset class */}
      {stats && stats.byAsset && stats.byAsset.length > 0 && (
        <div style={{
          padding: "12px 16px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: "8px",
          marginBottom: "16px",
        }}>
          <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", marginBottom: "10px", fontSize: "9px", letterSpacing: "0.12em" }}>ACCURACY BY ASSET CLASS</div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {stats.byAsset.map((a: { asset: string; accuracy: number; total: number }) => (
              <div key={a.asset} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>{a.asset.toUpperCase()}</span>
                <span style={{ ...MONO, fontSize: "12px", fontWeight: 700, color: a.accuracy >= 60 ? "#00FF88" : a.accuracy >= 40 ? "#FFD700" : "#FF4444" }}>
                  {a.accuracy}%
                </span>
                <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "9px" }}>({a.total})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {(["all", "pending", "correct", "partially_correct", "still_active", "incorrect"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              background: filter === f ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${filter === f ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "4px",
              cursor: "pointer",
              ...MONO_SM,
              color: filter === f ? ACCENT : "rgba(255,255,255,0.35)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {f === "partially_correct" ? "PARTIAL" : f === "still_active" ? "ACTIVE" : f}
          </button>
        ))}
      </div>

      {/* Entries */}
      {filteredEntries.length === 0 ? (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: "8px",
        }}>
          <BookOpen size={24} style={{ color: "rgba(255,255,255,0.15)", marginBottom: "12px" }} />
          <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)" }}>
            {filter === "all"
              ? "No recommendations logged yet. Ask a question to get started."
              : `No ${filter === "partially_correct" ? "partially correct" : filter === "still_active" ? "still active" : filter} recommendations.`
            }
          </div>
          {filter === "all" && (
            <button
              onClick={() => navigate("/app/discover")}
              style={{
                marginTop: "16px",
                padding: "8px 20px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "5px",
                cursor: "pointer",
                ...MONO_SM,
                color: ACCENT,
                fontSize: "11px",
              }}
            >
              ASK FAULTLINE
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredEntries.map(entry => (
            <LedgerRow
              key={entry.id}
              entry={entry}
              onUpdateOutcome={handleUpdateOutcome}
            />
          ))}
        </div>
      )}
    </div>
  );
}
