/**
 * SizingCalculator.tsx
 * Interactive position sizing calculator.
 * Inputs: account size, risk %, entry price, stop-loss price, target price.
 * Outputs: shares/units, position size $, risk $, reward $, R/R ratio, % of account.
 *
 * Can be pre-seeded with entry/stop/target from signal data.
 */

import { useState, useCallback, useMemo } from "react";
import { Calculator, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, DollarSign, Percent, Target } from "lucide-react";

interface SizingCalculatorProps {
  /** Pre-seed entry price from signal */
  defaultEntry?: number;
  /** Pre-seed stop-loss price from signal */
  defaultStop?: number;
  /** Pre-seed target price from signal */
  defaultTarget?: number;
  /** Ticker symbol for display */
  ticker?: string;
  /** Asset type label */
  assetType?: "STOCK" | "CRYPTO" | "ETF";
  /** Whether to start expanded */
  defaultExpanded?: boolean;
  /** Compact inline mode (no card wrapper) */
  inline?: boolean;
}

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUSD(n: number): string {
  if (!isFinite(n) || n === 0) return "—";
  return "$" + fmt(Math.abs(n));
}

function riskColor(rr: number): string {
  if (rr >= 3) return "#00FF88";
  if (rr >= 2) return "#FFD700";
  if (rr >= 1) return "#FF9500";
  return "#FF2D55";
}

export function SizingCalculator({
  defaultEntry,
  defaultStop,
  defaultTarget,
  ticker,
  assetType = "STOCK",
  defaultExpanded = false,
  inline = false,
}: SizingCalculatorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || inline);

  // Inputs
  const [accountSize, setAccountSize] = useState("25000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState(defaultEntry != null ? String(defaultEntry) : "");
  const [stop, setStop] = useState(defaultStop != null ? String(defaultStop) : "");
  const [target, setTarget] = useState(defaultTarget != null ? String(defaultTarget) : "");

  // Derived calculations
  const calc = useMemo(() => {
    const acc = parseFloat(accountSize);
    const rPct = parseFloat(riskPct);
    const entryN = parseFloat(entry);
    const stopN = parseFloat(stop);
    const targetN = parseFloat(target);

    if (!isFinite(acc) || acc <= 0) return null;
    if (!isFinite(rPct) || rPct <= 0 || rPct > 100) return null;
    if (!isFinite(entryN) || entryN <= 0) return null;
    if (!isFinite(stopN) || stopN <= 0) return null;
    if (stopN >= entryN) return null; // stop must be below entry for long

    const riskPerShare = entryN - stopN;
    const maxRiskDollars = acc * (rPct / 100);
    const shares = Math.floor(maxRiskDollars / riskPerShare);
    if (shares <= 0) return null;

    const positionSize = shares * entryN;
    const actualRisk = shares * riskPerShare;
    const pctOfAccount = (positionSize / acc) * 100;

    let reward: number | null = null;
    let rr: number | null = null;
    let rewardPct: number | null = null;
    if (isFinite(targetN) && targetN > entryN) {
      reward = shares * (targetN - entryN);
      rr = reward / actualRisk;
      rewardPct = ((targetN - entryN) / entryN) * 100;
    }

    const stopPct = ((entryN - stopN) / entryN) * 100;

    return { shares, positionSize, actualRisk, pctOfAccount, reward, rr, stopPct, rewardPct };
  }, [accountSize, riskPct, entry, stop, target]);

  const handleNumberInput = useCallback(
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
    },
    []
  );

  const inputStyle: React.CSSProperties = {
    background: "rgba(0,212,255,0.04)",
    border: "1px solid rgba(0,212,255,0.15)",
    borderRadius: "6px",
    padding: "8px 10px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "12px",
    color: "#E2E8F0",
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "9px",
    color: "rgba(100,116,139,0.7)",
    letterSpacing: "0.1em",
    marginBottom: "4px",
    display: "block",
  };

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Inputs grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
        {/* Account Size */}
        <div>
          <label style={labelStyle}>ACCOUNT SIZE ($)</label>
          <input
            type="number"
            value={accountSize}
            onChange={handleNumberInput(setAccountSize)}
            placeholder="25000"
            min="100"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)")}
          />
        </div>

        {/* Risk % */}
        <div>
          <label style={labelStyle}>RISK PER TRADE (%)</label>
          <input
            type="number"
            value={riskPct}
            onChange={handleNumberInput(setRiskPct)}
            placeholder="1"
            min="0.1"
            max="10"
            step="0.1"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)")}
          />
        </div>

        {/* Entry */}
        <div>
          <label style={labelStyle}>ENTRY PRICE ($)</label>
          <input
            type="number"
            value={entry}
            onChange={handleNumberInput(setEntry)}
            placeholder="0.00"
            min="0.001"
            step="0.01"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)")}
          />
        </div>

        {/* Stop Loss */}
        <div>
          <label style={labelStyle}>STOP LOSS ($)</label>
          <input
            type="number"
            value={stop}
            onChange={handleNumberInput(setStop)}
            placeholder="0.00"
            min="0.001"
            step="0.01"
            style={{
              ...inputStyle,
              borderColor: stop && parseFloat(stop) >= parseFloat(entry || "0") ? "rgba(255,45,85,0.4)" : "rgba(0,212,255,0.15)",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,45,85,0.4)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)")}
          />
        </div>

        {/* Target */}
        <div>
          <label style={labelStyle}>TARGET PRICE ($)</label>
          <input
            type="number"
            value={target}
            onChange={handleNumberInput(setTarget)}
            placeholder="0.00 (optional)"
            min="0.001"
            step="0.01"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,255,136,0.4)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)")}
          />
        </div>
      </div>

      {/* Stop above entry warning */}
      {stop && entry && parseFloat(stop) >= parseFloat(entry) && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 12px",
          background: "rgba(255,45,85,0.06)",
          border: "1px solid rgba(255,45,85,0.2)",
          borderRadius: "6px",
        }}>
          <AlertTriangle size={12} style={{ color: "#FF2D55", flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55" }}>
            STOP MUST BE BELOW ENTRY FOR A LONG POSITION
          </span>
        </div>
      )}

      {/* Results */}
      {calc ? (
        <div style={{
          background: "rgba(0,212,255,0.03)",
          border: "1px solid rgba(0,212,255,0.12)",
          borderRadius: "8px",
          padding: "16px",
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            color: "#00D4FF",
            letterSpacing: "0.12em",
            marginBottom: "12px",
          }}>
            SIZING RESULTS
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
            {/* Shares */}
            <ResultCard
              icon={<Calculator size={12} />}
              label={assetType === "CRYPTO" ? "UNITS" : "SHARES"}
              value={calc.shares.toLocaleString()}
              color="#00D4FF"
            />

            {/* Position Size */}
            <ResultCard
              icon={<DollarSign size={12} />}
              label="POSITION SIZE"
              value={fmtUSD(calc.positionSize)}
              sub={`${fmt(calc.pctOfAccount, 1)}% of account`}
              color={calc.pctOfAccount > 25 ? "#FF9500" : "#00D4FF"}
            />

            {/* Risk $ */}
            <ResultCard
              icon={<AlertTriangle size={12} />}
              label="MAX RISK"
              value={fmtUSD(calc.actualRisk)}
              sub={`${fmt(calc.stopPct, 1)}% below entry`}
              color="#FF2D55"
            />

            {/* Reward / R:R */}
            {calc.reward != null && calc.rr != null && (
              <>
                <ResultCard
                  icon={<TrendingUp size={12} />}
                  label="POTENTIAL REWARD"
                  value={fmtUSD(calc.reward)}
                  sub={`+${fmt(calc.rewardPct ?? 0, 1)}% from entry`}
                  color="#00FF88"
                />
                <ResultCard
                  icon={<Target size={12} />}
                  label="RISK / REWARD"
                  value={`${fmt(calc.rr, 1)}:1`}
                  sub={calc.rr >= 2 ? "Acceptable" : calc.rr >= 1 ? "Marginal" : "Poor"}
                  color={riskColor(calc.rr)}
                  highlight
                />
              </>
            )}

            {/* % of account */}
            <ResultCard
              icon={<Percent size={12} />}
              label="% OF ACCOUNT"
              value={`${fmt(calc.pctOfAccount, 1)}%`}
              sub={calc.pctOfAccount > 20 ? "High concentration" : calc.pctOfAccount > 10 ? "Moderate" : "Conservative"}
              color={calc.pctOfAccount > 20 ? "#FF9500" : "#00D4FF"}
            />
          </div>

          {/* Risk warning */}
          {calc.pctOfAccount > 25 && (
            <div style={{
              marginTop: "10px",
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 12px",
              background: "rgba(255,149,0,0.06)",
              border: "1px solid rgba(255,149,0,0.2)",
              borderRadius: "6px",
            }}>
              <AlertTriangle size={11} style={{ color: "#FF9500", flexShrink: 0 }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF9500" }}>
                POSITION EXCEEDS 25% OF ACCOUNT — CONSIDER REDUCING SIZE
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          textAlign: "center",
          padding: "16px",
          background: "rgba(0,212,255,0.02)",
          border: "1px dashed rgba(0,212,255,0.1)",
          borderRadius: "8px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          color: "rgba(100,116,139,0.5)",
          letterSpacing: "0.08em",
        }}>
          ENTER ENTRY + STOP PRICE TO CALCULATE
        </div>
      )}

      <div style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: "10px",
        color: "rgba(100,116,139,0.4)",
        textAlign: "center",
        lineHeight: 1.5,
      }}>
        Sizing is for educational purposes only. Not financial advice. Always use your own judgment and risk management.
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div style={{
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(0,212,255,0.12)",
      borderRadius: "12px",
      overflow: "hidden",
    }}>
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,212,255,0.04)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Calculator size={14} style={{ color: "#00D4FF" }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            color: "#00D4FF",
            letterSpacing: "0.12em",
          }}>
            POSITION SIZING CALCULATOR
            {ticker && (
              <span style={{ color: "rgba(100,116,139,0.6)", marginLeft: "8px" }}>
                — {ticker}
              </span>
            )}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {calc && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              color: "#00FF88",
              background: "rgba(0,255,136,0.08)",
              border: "1px solid rgba(0,255,136,0.2)",
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.08em",
            }}>
              {calc.shares.toLocaleString()} {assetType === "CRYPTO" ? "UNITS" : "SHS"} · {fmtUSD(calc.positionSize)}
            </span>
          )}
          {expanded
            ? <ChevronUp size={14} style={{ color: "rgba(100,116,139,0.5)" }} />
            : <ChevronDown size={14} style={{ color: "rgba(100,116,139,0.5)" }} />
          }
        </div>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div style={{ padding: "0 18px 18px 18px", borderTop: "1px solid rgba(0,212,255,0.08)" }}>
          <div style={{ paddingTop: "16px" }}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  highlight?: boolean;
}

function ResultCard({ icon, label, value, sub, color, highlight }: ResultCardProps) {
  return (
    <div style={{
      background: highlight ? `${color}08` : "rgba(255,255,255,0.02)",
      border: `1px solid ${highlight ? color + "25" : "rgba(255,255,255,0.06)"}`,
      borderRadius: "8px",
      padding: "10px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
        <span style={{ color: "rgba(100,116,139,0.5)" }}>{icon}</span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "8px",
          color: "rgba(100,116,139,0.6)",
          letterSpacing: "0.1em",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "16px",
        fontWeight: 700,
        color,
        lineHeight: 1,
        marginBottom: sub ? "4px" : 0,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "10px",
          color: "rgba(100,116,139,0.5)",
          marginTop: "3px",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}
