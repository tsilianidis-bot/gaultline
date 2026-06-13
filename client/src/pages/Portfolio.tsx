/* ============================================================
   FAULTLINE — Portfolio Monitor
   Real-time P&L tracking with AI-powered position guidance.
   Yahoo Finance 15-min delayed quotes + FAULTLINE pressure engine.
   Design: Palantir Noir — void black, neon accents.
   ============================================================ */
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { useState, useCallback, useEffect } from "react";
import {
  Plus, Trash2, Edit3, ChevronDown, ChevronUp, RefreshCw,
  TrendingUp, TrendingDown, Minus, Lock, AlertTriangle,
  BarChart2, Brain, Zap, X, Check, Info,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { PremiumGateFull } from "@/components/PremiumGate";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { PreflightTrigger } from "@/components/MarketPreflight";
import PortfolioIntelligence from "@/components/PortfolioIntelligence";

// ── Types (inferred from tRPC) ────────────────────────────────
type LivePosition = {
  id: number;
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
  assetType: string;
  notes: string | null;
  openedAt: Date;
  currentPrice: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketState: string;
  isDelayed: boolean;
  quoteError: string | null;
  totalCost: number;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number | null, prefix = "$", decimals = 2): string => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  return `${sign}${prefix}${abs.toFixed(decimals)}`;
};

const fmtPct = (n: number | null): string => {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
};

const pnlColor = (n: number | null): string => {
  if (n == null) return "#6B7280";
  if (n > 0) return "#00FF88";
  if (n < 0) return "#FF2D55";
  return "#6B7280";
};

const ACTION_COLORS: Record<string, string> = {
  "Add":            "#00FF88",
  "Hold":           "#00D4FF",
  "Watch / No Add": "#FF9500",
  "Trim":           "#FF9500",
  "Exit Watch":     "#FF2D55",
  "Sell Bias":      "#FF2D55",
};

const ASSET_TYPE_OPTIONS = ["Stock", "ETF", "Crypto", "Other"] as const;

// ── Add/Edit Position Form ────────────────────────────────────
interface PositionFormProps {
  initial?: {
    id?: number;
    ticker?: string;
    name?: string;
    shares?: number;
    costBasis?: number;
    assetType?: string;
    notes?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

function PositionForm({ initial, onClose, onSaved }: PositionFormProps) {
  const isEdit = !!initial?.id;
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [shares, setShares] = useState(initial?.shares?.toString() ?? "");
  const [costBasis, setCostBasis] = useState(initial?.costBasis?.toString() ?? "");
  const [assetType, setAssetType] = useState<typeof ASSET_TYPE_OPTIONS[number]>(
    (initial?.assetType as any) ?? "Stock"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const addMutation = trpc.portfolio.addPosition.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });
  const updateMutation = trpc.portfolio.updatePosition.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(costBasis);
    if (!ticker.trim()) return setError("Ticker is required");
    if (!name.trim()) return setError("Name is required");
    if (isNaN(sharesNum) || sharesNum <= 0) return setError("Shares must be a positive number");
    if (isNaN(costNum) || costNum <= 0) return setError("Cost basis must be a positive number");

    if (isEdit && initial?.id) {
      updateMutation.mutate({
        id: initial.id,
        ticker: ticker.trim().toUpperCase(),
        name: name.trim(),
        shares: sharesNum,
        costBasis: costNum,
        assetType,
        notes: notes.trim() || undefined,
      });
    } else {
      addMutation.mutate({
        ticker: ticker.trim().toUpperCase(),
        name: name.trim(),
        shares: sharesNum,
        costBasis: costNum,
        assetType,
        notes: notes.trim() || undefined,
      });
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "4px",
    padding: "8px 10px",
    color: "#F0F4FF",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "12px",
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "9px",
    color: "#6B7280",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "4px",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "rgba(10, 12, 16, 0.99)",
        border: "1px solid rgba(0, 212, 255, 0.2)",
        borderRadius: "8px",
        padding: "24px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 0 40px rgba(0, 212, 255, 0.1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF", letterSpacing: "0.08em", margin: 0 }}>
            {isEdit ? "EDIT POSITION" : "ADD POSITION"}
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6B7280", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Ticker *</label>
              <input
                style={inputStyle}
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={20}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Asset Type</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={assetType}
                onChange={e => setAssetType(e.target.value as any)}
              >
                {ASSET_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Apple Inc."
              maxLength={120}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Shares *</label>
              <input
                style={inputStyle}
                type="number"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder="100"
                min="0.00000001"
                step="any"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Avg Cost / Share *</label>
              <input
                style={inputStyle}
                type="number"
                value={costBasis}
                onChange={e => setCostBasis(e.target.value)}
                placeholder="150.00"
                min="0.0001"
                step="any"
                required
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              style={inputStyle}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Core long-term hold"
              maxLength={500}
            />
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#FF2D55", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>
              <AlertTriangle size={12} />
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "10px", borderRadius: "4px",
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "#6B7280", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.08em",
              }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                flex: 1, padding: "10px", borderRadius: "4px",
                background: isPending ? "rgba(0,212,255,0.2)" : "rgba(0,212,255,0.15)",
                border: "1px solid rgba(0,212,255,0.4)",
                color: "#00D4FF", cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.08em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              {isPending ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> SAVING…</> : <><Check size={11} /> {isEdit ? "SAVE CHANGES" : "ADD POSITION"}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Position Card ─────────────────────────────────────────────
interface PositionCardProps {
  position: LivePosition;
  onEdit: () => void;
  onDelete: () => void;
}

function PositionCard({ position: p, onEdit, onDelete }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch AI guidance for this position — eager (loads in background for badge)
  const guidanceQuery = trpc.portfolio.getPositionGuidance.useQuery(
    { ticker: p.ticker, name: p.name, assetType: p.assetType as any },
    { staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const pnl = p.unrealizedPnl;
  const pnlPct = p.unrealizedPnlPct;

  const actionColor = guidanceQuery.data?.action
    ? ACTION_COLORS[guidanceQuery.data.action] ?? "#6B7280"
    : "#6B7280";

  return (
    <div style={{
      background: "rgba(15, 17, 22, 0.9)",
      border: `1px solid ${expanded ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: "8px",
      overflow: "hidden",
      transition: "border-color 0.2s ease",
    }}>
      {/* Card header */}
      <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px", alignItems: "start" }}>
        {/* Left: ticker + name */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: "#F0F4FF", letterSpacing: "0.06em" }}>
              {p.ticker}
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
              color: "#6B7280", letterSpacing: "0.12em",
              padding: "1px 5px", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "3px",
            }}>
              {p.assetType}
            </span>
            {p.marketState === "REGULAR" && (
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 6px #00FF88", display: "inline-block" }} title="Market open" />
            )}
            {p.isDelayed && p.currentPrice != null && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#4B5563", letterSpacing: "0.08em" }}>15m delay</span>
            )}
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#6B7280" }}>
            {p.name}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", marginTop: "2px" }}>
            {p.shares} shares @ {fmt(p.costBasis)} avg
          </div>
          {/* AI action badge — shown directly on card */}
          {guidanceQuery.data?.action && (
            <div style={{
              marginTop: "6px",
              display: "inline-flex", alignItems: "center", gap: "4px",
              padding: "2px 8px", borderRadius: "3px",
              background: `${ACTION_COLORS[guidanceQuery.data.action] ?? "#6B7280"}18`,
              border: `1px solid ${ACTION_COLORS[guidanceQuery.data.action] ?? "#6B7280"}44`,
            }}>
              <Brain size={9} style={{ color: ACTION_COLORS[guidanceQuery.data.action] ?? "#6B7280" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: ACTION_COLORS[guidanceQuery.data.action] ?? "#6B7280", letterSpacing: "0.08em" }}>
                {guidanceQuery.data.action}
              </span>
            </div>
          )}
          {guidanceQuery.isLoading && (
            <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <RefreshCw size={9} style={{ color: "#374151", animation: "spin 1s linear infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151" }}>AI loading…</span>
            </div>
          )}
        </div>

        {/* Center: price + day change */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "22px", fontWeight: 700, color: "#F0F4FF", letterSpacing: "0.04em" }}>
            {p.currentPrice != null ? fmt(p.currentPrice) : "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "2px" }}>
            {p.dayChangePct != null ? (
              <>
                {p.dayChangePct > 0 ? <TrendingUp size={10} style={{ color: "#00FF88" }} /> :
                 p.dayChangePct < 0 ? <TrendingDown size={10} style={{ color: "#FF2D55" }} /> :
                 <Minus size={10} style={{ color: "#6B7280" }} />}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: pnlColor(p.dayChangePct) }}>
                  {fmtPct(p.dayChangePct)} today
                </span>
              </>
            ) : (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563" }}>no quote</span>
            )}
          </div>
        </div>

        {/* Right: P&L + actions */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", fontWeight: 700, color: pnlColor(pnl) }}>
            {pnl != null ? (pnl >= 0 ? "+" : "") + fmt(pnl) : "—"}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: pnlColor(pnlPct), marginTop: "1px" }}>
            {fmtPct(pnlPct)}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={onEdit}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", padding: "3px 6px", cursor: "pointer", color: "#6B7280", transition: "all 0.15s ease" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#00D4FF"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <Edit3 size={11} />
            </button>
            {showDeleteConfirm ? (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                  style={{ background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.4)", borderRadius: "3px", padding: "3px 8px", cursor: "pointer", color: "#FF2D55", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px" }}
                >
                  CONFIRM
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", padding: "3px 6px", cursor: "pointer", color: "#6B7280" }}
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", padding: "3px 6px", cursor: "pointer", color: "#6B7280", transition: "all 0.15s ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF2D55"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,45,85,0.3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Market value row */}
      <div style={{
        padding: "8px 16px",
        background: "rgba(0,0,0,0.2)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "8px",
      }}>
        {[
          { label: "MARKET VALUE", value: fmt(p.marketValue) },
          { label: "TOTAL COST", value: fmt(p.totalCost) },
          { label: "DAY CHANGE", value: p.dayChange != null ? (p.dayChange >= 0 ? "+" : "") + fmt(p.dayChange) : "—", color: pnlColor(p.dayChange) },
        ].map(item => (
          <div key={item.label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", letterSpacing: "0.12em", marginBottom: "2px" }}>{item.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: item.color ?? "#94A3B8" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* AI Guidance toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", padding: "8px 16px",
          background: expanded ? "rgba(0,212,255,0.05)" : "transparent",
          border: "none", borderTop: "1px solid rgba(255,255,255,0.04)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "background 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Brain size={11} style={{ color: expanded ? "#00D4FF" : "#4B5563" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: expanded ? "#00D4FF" : "#4B5563", letterSpacing: "0.12em" }}>
            AI GUIDANCE
          </span>
          {guidanceQuery.data?.action && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
              color: actionColor, padding: "1px 6px",
              border: `1px solid ${actionColor}44`,
              borderRadius: "3px", background: `${actionColor}11`,
            }}>
              {guidanceQuery.data.action}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={12} style={{ color: "#6B7280" }} /> : <ChevronDown size={12} style={{ color: "#6B7280" }} />}
      </button>

      {/* AI Guidance expanded panel */}
      {expanded && (
        <div style={{ padding: "16px", borderTop: "1px solid rgba(0,212,255,0.08)" }}>
          {guidanceQuery.isLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#4B5563", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>
              <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
              Generating AI guidance…
            </div>
          ) : guidanceQuery.data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Action + conviction */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div style={{
                  padding: "4px 12px", borderRadius: "4px",
                  background: `${actionColor}18`,
                  border: `1px solid ${actionColor}44`,
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                  color: actionColor, letterSpacing: "0.06em",
                }}>
                  {guidanceQuery.data.action}
                </div>
                <div style={{
                  padding: "4px 12px", borderRadius: "4px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                  color: "#94A3B8",
                }}>
                  {guidanceQuery.data.conviction} Conviction
                </div>
                <div style={{
                  padding: "4px 12px", borderRadius: "4px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                  color: "#94A3B8",
                }}>
                  {guidanceQuery.data.timeframe} View
                </div>
              </div>

              {/* Score bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                {[
                  { label: "Asset Signal",  value: guidanceQuery.data.scores.assetSignalScore },
                  { label: "Market Regime", value: guidanceQuery.data.scores.marketRegimeScore },
                  { label: "Pressure Idx",  value: guidanceQuery.data.scores.pressureIndexScore },
                  { label: "Momentum",      value: guidanceQuery.data.scores.momentumScore },
                  { label: "Sector",        value: guidanceQuery.data.scores.sectorStrengthScore },
                  { label: "Composite",     value: guidanceQuery.data.scores.compositeScore },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#6B7280", letterSpacing: "0.1em" }}>{s.label.toUpperCase()}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: s.value >= 65 ? "#00FF88" : s.value >= 40 ? "#FF9500" : "#FF2D55" }}>{s.value}</span>
                    </div>
                    <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                      <div style={{
                        height: "100%", borderRadius: "2px",
                        width: `${s.value}%`,
                        background: s.value >= 65 ? "#00FF88" : s.value >= 40 ? "#FF9500" : "#FF2D55",
                        transition: "width 0.6s cubic-bezier(0.23,1,0.32,1)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* AI interpretation */}
              {guidanceQuery.data.aiInterpretation && (
                <div style={{ padding: "10px 12px", background: "rgba(0,212,255,0.04)", borderLeft: "2px solid rgba(0,212,255,0.3)", borderRadius: "0 4px 4px 0" }}>
                  <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6, margin: 0 }}>
                    {guidanceQuery.data.aiInterpretation}
                  </p>
                </div>
              )}

              {/* Key drivers */}
              {guidanceQuery.data.keyDrivers?.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "6px" }}>KEY DRIVERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {guidanceQuery.data.keyDrivers.map((d, i) => (
                      <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                        <span style={{ color: "#374151", fontSize: "10px", marginTop: "1px", flexShrink: 0 }}>›</span>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested behavior */}
              {guidanceQuery.data.suggestedBehavior && (
                <div style={{ display: "flex", gap: "8px", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Zap size={12} style={{ color: "#FF9500", flexShrink: 0, marginTop: "1px" }} />
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>
                    {guidanceQuery.data.suggestedBehavior}
                  </span>
                </div>
              )}

              {/* Cross-link to Signals page for this ticker */}
              <Link
                href={`/app/signals?ticker=${encodeURIComponent(p.ticker)}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  background: "rgba(0,212,255,0.05)",
                  border: "1px solid rgba(0,212,255,0.15)",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.10)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,212,255,0.30)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.05)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,212,255,0.15)";
                }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00D4FF", letterSpacing: "0.1em" }}>
                  VIEW FULL SIGNAL ANALYSIS — {p.ticker}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#00D4FF" }}>→</span>
              </Link>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.08em" }}>
                NOT FINANCIAL ADVICE — FAULTLINE AI GUIDANCE IS FOR INFORMATIONAL PURPOSES ONLY
              </div>
            </div>
          ) : (
            <div style={{ color: "#FF2D55", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>
              Failed to load AI guidance
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary Header ────────────────────────────────────────────
function SummaryHeader({ summary }: { summary: NonNullable<any> }) {
  const pnl = summary.totalPnl;
  const pnlPct = summary.totalPnlPct;
  const dayChange = summary.totalDayChange;

  return (
    <div style={{
      background: "rgba(10, 12, 16, 0.95)",
      border: "1px solid rgba(0,212,255,0.12)",
      borderRadius: "8px",
      padding: "20px 24px",
      marginBottom: "20px",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }} className="sm:grid-cols-4">
        {[
          { label: "TOTAL VALUE", value: fmt(summary.totalValue), color: "#F0F4FF" },
          { label: "TOTAL P&L", value: (pnl >= 0 ? "+" : "") + fmt(pnl) + ` (${fmtPct(pnlPct)})`, color: pnlColor(pnl) },
          { label: "DAY CHANGE", value: (dayChange >= 0 ? "+" : "") + fmt(dayChange), color: pnlColor(dayChange) },
          { label: "FAULTLINE PRESSURE", value: `${summary.pressureScore}/100`, color: summary.pressureScore >= 65 ? "#FF2D55" : summary.pressureScore >= 40 ? "#FF9500" : "#00FF88" },
        ].map(item => (
          <div key={item.label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "4px" }}>{item.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "18px", fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 6px #00D4FF" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.1em" }}>
            REGIME: {summary.pressureRegime} · {summary.positionCount} POSITION{summary.positionCount !== 1 ? "S" : ""} · QUOTES 15-MIN DELAYED
          </span>
        </div>
        <Link
          href="/app/signals"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            color: "#00D4FF",
            letterSpacing: "0.1em",
            textDecoration: "none",
            opacity: 0.75,
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.75")}
        >
          OPEN SIGNALS ENGINE →
        </Link>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
function PortfolioInner() {
  useSEO(PAGE_SEO.portfolio);
  const { user, loading: authLoading } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editPosition, setEditPosition] = useState<LivePosition | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = getLoginUrl();
    }
  }, [user, authLoading]);

  const portfolioQuery = trpc.portfolio.getLivePortfolio.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000, // auto-refresh every 60s
    staleTime: 55_000,
  });

  const deleteMutation = trpc.portfolio.deletePosition.useMutation({
    onSuccess: () => portfolioQuery.refetch(),
  });

  const handleRefresh = useCallback(() => {
    setLastRefresh(Date.now());
    portfolioQuery.refetch();
  }, [portfolioQuery]);

  const handleSaved = useCallback(() => {
    portfolioQuery.refetch();
  }, [portfolioQuery]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050608" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#4B5563", letterSpacing: "0.15em" }}>
          AUTHENTICATING…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050608", flexDirection: "column", gap: "16px" }}>
        <Lock size={32} style={{ color: "#374151" }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#4B5563", letterSpacing: "0.15em" }}>
          LOGIN REQUIRED
        </div>
      </div>
    );
  }

  const { positions = [], summary } = portfolioQuery.data ?? {};

  return (
    <div style={{ minHeight: "100vh", background: "#050608" }}>
      <PageHeader
        title="Portfolio Monitor"
        subtitle="Track real-time P&L across your positions with AI-powered guidance and FAULTLINE pressure context."
        badge="LIVE"
        badgeColor="green"
        rightSlot={
          <PreflightTrigger
            currentPage="portfolio"
            actionKey="viewed_portfolio"
          />
        }
      />
      <div style={{ padding: "20px 16px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleRefresh}
              disabled={portfolioQuery.isFetching}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 12px", borderRadius: "4px",
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "#6B7280", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#00D4FF"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <RefreshCw size={11} style={{ animation: portfolioQuery.isFetching ? "spin 1s linear infinite" : "none" }} />
              REFRESH
            </button>
            <button
              onClick={() => { setEditPosition(null); setShowForm(true); }}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 14px", borderRadius: "4px",
                background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                color: "#00D4FF", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={12} />
              ADD POSITION
            </button>
          </div>
        </div>

        {/* ── Portfolio Intelligence™ ─────────────────────────────── */}
        <PortfolioIntelligence />

        {/* Summary */}
        {summary && <SummaryHeader summary={summary} />}

        {/* Loading state */}
        {portfolioQuery.isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: "120px", borderRadius: "8px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {portfolioQuery.isError && (
          <div style={{
            padding: "20px", borderRadius: "8px",
            background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.2)",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <AlertTriangle size={16} style={{ color: "#FF2D55", flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FF2D55" }}>
              Failed to load portfolio: {portfolioQuery.error?.message}
            </span>
          </div>
        )}

        {/* Empty state */}
        {!portfolioQuery.isLoading && !portfolioQuery.isError && positions.length === 0 && (
          <div style={{
            padding: "60px 20px", textAlign: "center",
            border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "8px",
          }}>
            <BarChart2 size={40} style={{ color: "#1F2937", margin: "0 auto 16px" }} />
            <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: "#374151", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              NO POSITIONS YET
            </h3>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#4B5563", margin: "0 0 20px" }}>
              Add your first position to start monitoring P&L and receiving AI guidance.
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "10px 20px", borderRadius: "4px",
                background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                color: "#00D4FF", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.08em",
              }}
            >
              <Plus size={13} />
              ADD FIRST POSITION
            </button>
          </div>
        )}

        {/* Position cards */}
        {positions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {positions.map(pos => (
              <PositionCard
                key={pos.id}
                position={pos as LivePosition}
                onEdit={() => { setEditPosition(pos as LivePosition); setShowForm(true); }}
                onDelete={() => deleteMutation.mutate({ id: pos.id })}
              />
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {positions.length > 0 && (
          <div style={{ marginTop: "24px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <Info size={11} style={{ color: "#374151", flexShrink: 0, marginTop: "1px" }} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.06em", lineHeight: 1.6, margin: 0 }}>
                QUOTES ARE 15-MINUTE DELAYED VIA YAHOO FINANCE. FAULTLINE AI GUIDANCE IS GENERATED FROM MACRO RISK DATA AND IS NOT PERSONALIZED FINANCIAL ADVICE. PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS. CONSULT A LICENSED FINANCIAL ADVISOR BEFORE MAKING INVESTMENT DECISIONS.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <PositionForm
          initial={editPosition ? {
            id: editPosition.id,
            ticker: editPosition.ticker,
            name: editPosition.name,
            shares: editPosition.shares,
            costBasis: editPosition.costBasis,
            assetType: editPosition.assetType,
            notes: editPosition.notes ?? undefined,
          } : undefined}
          onClose={() => { setShowForm(false); setEditPosition(null); }}
          onSaved={handleSaved}
        />
      )}

            {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
      </div>{/* /maxWidth */}
      </div>{/* /padding */}
    </div>
  );
}
// ── Premium Gate Wrapper ──────────────────────────────────────
export default function Portfolio() {
  return (
    <PremiumGateFull variant="portfolio">
      <PortfolioInner />
    </PremiumGateFull>
  );
}
