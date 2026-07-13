/**
 * FAULTLINE — Seismograph Intelligence
 *
 * Faithful reproduction of the approved concept image:
 *  - Pure black background
 *  - Single compact card centered on screen
 *  - Macro ticker row: 10Y Treasury | HY Spread | BTC
 *  - Regime probabilities: BULL / SOFT LAND / STAGFLATION / RECESSION / CRASH
 *  - Market Intelligence panel: systemic risk score + top AI engine insight
 *  - LIVE footer bar
 *  - Progressive disclosure: expand to see deeper analysis
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Info, ChevronDown, ChevronUp, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Color helpers ────────────────────────────────────────────────────────────

function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444"; // red — crisis
  if (score >= 65) return "#f97316"; // orange — high
  if (score >= 45) return "#f59e0b"; // amber — elevated
  if (score >= 25) return "#22c55e"; // green — moderate
  return "#10b981"; // emerald — low
}

function regimeBarColor(label: string): string {
  const l = label.toUpperCase();
  if (l.includes("BULL")) return "#22c55e";
  if (l.includes("SOFT")) return "#06b6d4";
  if (l.includes("STAG")) return "#f59e0b";
  if (l.includes("RECESSION")) return "#f97316";
  if (l.includes("CRASH")) return "#ef4444";
  return "#06b6d4";
}

function formatTsy(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(2) + "%";
}

function formatHyBps(bps: number | null): string {
  if (bps === null) return "—";
  return bps + "bps";
}

function formatBtc(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MacroTicker({
  tsy10y,
  tsy10yChange,
  hySpreadBps,
  btcPrice,
  btcChange24h,
}: {
  tsy10y: number | null;
  tsy10yChange: number | null;
  hySpreadBps: number | null;
  btcPrice: number | null;
  btcChange24h: number | null;
}) {
  const tsyUp = tsy10yChange !== null ? tsy10yChange > 0 : null;
  const btcUp = btcChange24h !== null ? btcChange24h > 0 : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(6,182,212,0.2)",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: "12px",
        letterSpacing: "0.04em",
      }}
    >
      {/* 10Y Treasury */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
        <span style={{ color: "rgba(6,182,212,0.6)", fontWeight: 500 }}>10Y Treasury</span>
        <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: "13px" }}>
          {formatTsy(tsy10y)}
        </span>
        {tsyUp !== null && (
          <span style={{ color: tsyUp ? "#ef4444" : "#22c55e", fontSize: "10px" }}>
            {tsyUp ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ color: "rgba(6,182,212,0.3)", padding: "0 12px" }}>|</div>

      {/* HY Spread */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "center" }}>
        <span style={{ color: "rgba(6,182,212,0.6)", fontWeight: 500 }}>HY Spread</span>
        <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: "13px" }}>
          {formatHyBps(hySpreadBps)}
        </span>
      </div>

      {/* Divider */}
      <div style={{ color: "rgba(6,182,212,0.3)", padding: "0 12px" }}>|</div>

      {/* BTC */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "flex-end" }}>
        <span style={{ color: "rgba(6,182,212,0.6)", fontWeight: 500 }}>BTC</span>
        <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: "13px" }}>
          {btcPrice !== null ? formatBtc(btcPrice) : "—"}
        </span>
        {btcUp !== null && (
          <span style={{ color: btcUp ? "#22c55e" : "#ef4444", fontSize: "10px" }}>
            {btcUp ? "▲" : "▼"}
          </span>
        )}
      </div>
    </div>
  );
}

function RegimeProbabilityRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "6px",
      }}
    >
      {/* Label */}
      <div
        style={{
          width: "90px",
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          fontWeight: 600,
          color: color,
          flexShrink: 0,
        }}
      >
        {label}
      </div>

      {/* Bar track */}
      <div
        style={{
          flex: 1,
          height: "6px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: "3px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dotted track overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)`,
          }}
        />
        {/* Fill */}
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: color,
            borderRadius: "3px",
            boxShadow: `0 0 6px ${color}80`,
            transition: "width 0.8s cubic-bezier(0.23,1,0.32,1)",
          }}
        />
      </div>

      {/* Percentage */}
      <div
        style={{
          width: "32px",
          textAlign: "right",
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: "12px",
          fontWeight: 700,
          color: color,
          flexShrink: 0,
        }}
      >
        {value}%
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SeismographIntelligence() {
  const [expanded, setExpanded] = useState(false);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [btcChange24h, setBtcChange24h] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  const { data: intel, isLoading, refetch } = trpc.seismograph.getUnifiedIntelligence.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch BTC price from coingecko via the signals proxy
  useEffect(() => {
    fetch("/api/signals/ticker/BTC")
      .then((r) => r.json())
      .then((d) => {
        if (d?.currentPrice) setBtcPrice(d.currentPrice);
        if (d?.priceChange24hPercent !== undefined) setBtcChange24h(d.priceChange24hPercent);
      })
      .catch(() => {});
  }, []);

  const formatUtc = (d: Date) =>
    d.toISOString().replace("T", " ").substring(0, 16) + " UTC";

  const dataDate = intel?.macroTicker?.dataMonth
    ? (() => {
        const [y, m] = intel.macroTicker.dataMonth.split("-");
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `AS OF ${months[parseInt(m) - 1].toUpperCase()} ${y}`;
      })()
    : `AS OF ${formatUtc(now)}`;

  const scoreColor = intel ? pressureColor(intel.currentScore) : "#06b6d4";
  const regimeProbs = intel?.regimeProbabilities5way;
  const macroTicker = intel?.macroTicker;

  // Top AI engine insight — highest-strength evidence family
  const topEngine = intel?.evidenceFamilies
    ? [...intel.evidenceFamilies].sort((a, b) => b.strength - a.strength)[0]
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Single centered card — matches concept image proportions */}
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          border: "1px solid rgba(6,182,212,0.35)",
          borderRadius: "8px",
          background: "rgba(0,8,20,0.95)",
          overflow: "hidden",
          boxShadow: "0 0 40px rgba(6,182,212,0.08), 0 0 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* ── Section 1: Macro Ticker Row ── */}
        {isLoading ? (
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid rgba(6,182,212,0.2)",
              display: "flex",
              gap: "16px",
              fontSize: "12px",
              color: "rgba(6,182,212,0.4)",
            }}
          >
            <span>10Y Treasury —</span>
            <span>|</span>
            <span>HY Spread —</span>
            <span>|</span>
            <span>BTC —</span>
          </div>
        ) : (
          <MacroTicker
            tsy10y={macroTicker?.tsy10y ?? null}
            tsy10yChange={macroTicker?.tsy10yChange ?? null}
            hySpreadBps={macroTicker?.hySpreadBps ?? null}
            btcPrice={btcPrice}
            btcChange24h={btcChange24h}
          />
        )}

        {/* ── Section 2: Regime Probabilities ── */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(6,182,212,0.15)",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "10px",
                letterSpacing: "0.12em",
                fontWeight: 700,
                color: "#06b6d4",
              }}
            >
              <span>REGIME PROBABILITIES</span>
              <Info size={10} style={{ color: "rgba(6,182,212,0.5)", cursor: "pointer" }} />
            </div>
            <div
              style={{
                fontSize: "9px",
                letterSpacing: "0.06em",
                color: "rgba(6,182,212,0.45)",
              }}
            >
              {dataDate}
            </div>
          </div>

          {/* Probability bars */}
          {isLoading ? (
            <div style={{ color: "rgba(6,182,212,0.3)", fontSize: "11px", padding: "8px 0" }}>
              Loading intelligence...
            </div>
          ) : regimeProbs ? (
            <>
              <RegimeProbabilityRow label="BULL" value={regimeProbs.bull} color="#22c55e" />
              <RegimeProbabilityRow label="SOFT LAND" value={regimeProbs.softLanding} color="#06b6d4" />
              <RegimeProbabilityRow label="STAGFLATION" value={regimeProbs.stagflation} color="#f59e0b" />
              <RegimeProbabilityRow label="RECESSION" value={regimeProbs.recession} color="#f97316" />
              <RegimeProbabilityRow label="CRASH" value={regimeProbs.crash} color="#ef4444" />
            </>
          ) : (
            <div style={{ color: "rgba(6,182,212,0.3)", fontSize: "11px", padding: "8px 0" }}>
              No data available
            </div>
          )}
        </div>

        {/* ── Section 3: Market Intelligence Panel ── */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(6,182,212,0.15)",
            background: "rgba(6,182,212,0.03)",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            {/* Brain icon */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                border: "1px solid rgba(6,182,212,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: "rgba(6,182,212,0.06)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2" />
              </svg>
            </div>

            {/* Title + score */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "2px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                    color: "#06b6d4",
                  }}
                >
                  MARKET INTELLIGENCE
                </span>
                {intel && (
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: 800,
                      color: scoreColor,
                      lineHeight: 1,
                      textShadow: `0 0 12px ${scoreColor}60`,
                    }}
                  >
                    {intel.currentScore}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(6,182,212,0.55)",
                  lineHeight: 1.4,
                }}
              >
                {intel
                  ? `Systemic risk composite at ${intel.currentScore} — ${intel.currentStressLevel} stress`
                  : "Loading..."}
              </div>
            </div>

            {/* Expand/collapse toggle */}
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(6,182,212,0.5)",
                padding: "2px",
                flexShrink: 0,
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Top engine insight */}
          {topEngine && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 12px",
                background: "rgba(6,182,212,0.05)",
                borderRadius: "6px",
                border: "1px solid rgba(6,182,212,0.12)",
              }}
            >
              {/* AI badge */}
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  border: "1px solid rgba(6,182,212,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "8px",
                  fontWeight: 800,
                  color: "#06b6d4",
                  letterSpacing: "0.05em",
                }}
              >
                AI
              </div>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#06b6d4",
                    marginBottom: "2px",
                  }}
                >
                  {topEngine.name}{" "}
                  <span style={{ color: "rgba(6,182,212,0.5)", fontWeight: 400 }}>
                    ({topEngine.strength.toFixed(1)}/10):
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(6,182,212,0.7)",
                    lineHeight: 1.5,
                  }}
                >
                  {topEngine.currentValue}
                </div>
              </div>
            </div>
          )}

          {/* Expanded: additional intelligence */}
          {expanded && intel && (
            <div style={{ marginTop: "12px" }}>
              {/* Today's story */}
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(6,182,212,0.65)",
                  lineHeight: 1.6,
                  marginBottom: "12px",
                  padding: "10px 12px",
                  background: "rgba(6,182,212,0.03)",
                  borderRadius: "6px",
                  borderLeft: "2px solid rgba(6,182,212,0.3)",
                }}
              >
                {intel.todayStory}
              </div>

              {/* Key developments */}
              {intel.keyDevelopments.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  {intel.keyDevelopments.slice(0, 3).map((d, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "8px",
                        fontSize: "10px",
                        color: "rgba(6,182,212,0.6)",
                        marginBottom: "4px",
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: "#06b6d4", flexShrink: 0 }}>›</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* All evidence families */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  marginBottom: "12px",
                }}
              >
                {intel.evidenceFamilies.map((f, i) => {
                  const signalColor =
                    f.signal === "bullish" || f.signal === "recovering"
                      ? "#22c55e"
                      : f.signal === "bearish"
                      ? "#f97316"
                      : f.signal === "stressed"
                      ? "#ef4444"
                      : "#06b6d4";
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(6,182,212,0.04)",
                        borderRadius: "5px",
                        border: "1px solid rgba(6,182,212,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          letterSpacing: "0.08em",
                          color: "rgba(6,182,212,0.5)",
                          marginBottom: "3px",
                          fontWeight: 600,
                        }}
                      >
                        {f.name.toUpperCase()}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {/* Strength bar */}
                        <div
                          style={{
                            flex: 1,
                            height: "3px",
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: "2px",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(f.strength / 10) * 100}%`,
                              background: signalColor,
                              borderRadius: "2px",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            color: signalColor,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {f.signal}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top analog */}
              {intel.topAnalog && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "rgba(6,182,212,0.04)",
                    borderRadius: "6px",
                    border: "1px solid rgba(6,182,212,0.1)",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                      color: "rgba(6,182,212,0.5)",
                      marginBottom: "4px",
                      fontWeight: 700,
                    }}
                  >
                    CLOSEST HISTORICAL ANALOG
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#06b6d4",
                      fontWeight: 600,
                      marginBottom: "2px",
                    }}
                  >
                    {intel.topAnalog.label}{" "}
                    <span style={{ color: "rgba(6,182,212,0.5)", fontWeight: 400 }}>
                      ({intel.topAnalog.similarity}% similarity)
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "rgba(6,182,212,0.6)",
                      lineHeight: 1.5,
                      marginBottom: "6px",
                    }}
                  >
                    {intel.topAnalog.description}
                  </div>
                  {/* Forward returns */}
                  <div style={{ display: "flex", gap: "16px" }}>
                    {[
                      { label: "3M", val: intel.topAnalog.avgReturn3m },
                      { label: "6M", val: intel.topAnalog.avgReturn6m },
                      { label: "12M", val: intel.topAnalog.avgReturn12m },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div
                          style={{
                            fontSize: "9px",
                            color: "rgba(6,182,212,0.4)",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {label} RETURN
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color:
                              val === null
                                ? "rgba(6,182,212,0.3)"
                                : val >= 0
                                ? "#22c55e"
                                : "#ef4444",
                          }}
                        >
                          {val !== null
                            ? `${val > 0 ? "+" : ""}${val}%`
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invalidation */}
              {intel.evolution.invalidationConditions.length > 0 && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "rgba(239,68,68,0.04)",
                    borderRadius: "5px",
                    border: "1px solid rgba(239,68,68,0.12)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                      color: "rgba(239,68,68,0.6)",
                      marginBottom: "4px",
                      fontWeight: 700,
                    }}
                  >
                    INVALIDATION CONDITIONS
                  </div>
                  {intel.evolution.invalidationConditions.slice(0, 2).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "10px",
                        color: "rgba(239,68,68,0.7)",
                        marginBottom: "2px",
                        lineHeight: 1.4,
                      }}
                    >
                      › {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            fontSize: "9px",
            letterSpacing: "0.08em",
            color: "rgba(6,182,212,0.45)",
          }}
        >
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 4px #22c55e",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ color: "#22c55e", fontWeight: 700 }}>LIVE</span>
            <span style={{ color: "rgba(6,182,212,0.3)" }}>
              {intel ? `${intel.memory.observationCount}/10` : "—"}
            </span>
          </div>

          {/* Center: MACRO INTEL */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
            <div>
              <div style={{ fontWeight: 700, color: "rgba(6,182,212,0.5)", fontSize: "9px" }}>
                MACRO INTEL
              </div>
              <div style={{ fontSize: "8px", color: "rgba(6,182,212,0.3)" }}>
                MACROECONOMIC INTELLIGENCE PLATFORM
              </div>
            </div>
          </div>

          {/* Right: data timestamp + refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>DATA AS OF {formatUtc(now).split(" ").slice(1).join(" ")}</span>
            <button
              onClick={() => refetch()}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(6,182,212,0.4)",
                padding: 0,
              }}
            >
              <RefreshCw size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
