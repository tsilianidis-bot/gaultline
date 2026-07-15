/* ============================================================
   AshaHeroSection — FAULTLINE Intelligence Command Center
   
   Single source of truth: all data from EngineContext.
   Live ticker: /api/signals/quotes (existing endpoint).
   No new calculations. No duplicate logic.
   
   Layout:
   ┌─────────────────────────────────────────────────────────┐
   │  13-instrument macro ticker strip (live)                │
   ├──────────────────────────┬──────────────────────────────┤
   │  Intelligence Panel      │  ASHA Figure + Market Globe  │
   │  • Pressure Index score  │  (hero image)                │
   │  • Verdict               │                              │
   │  • Regime probabilities  │                              │
   │  • Market Intelligence   │                              │
   │  • Analog + Trans. Risk  │                              │
   │  • Ask FAULTLINE CTA     │                              │
   └──────────────────────────┴──────────────────────────────┘
   ============================================================ */
import { useState, useEffect, useCallback } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { Link } from "wouter";

// ── Instrument definitions (ticker → display label) ───────────
// Mapped to symbols available in the existing /api/signals/quotes cache.
// Crypto (BTC-USD etc.) may not be in the stock cache; we fall back gracefully.
const MACRO_INSTRUMENTS = [
  { symbol: "SPY",  label: "S&P 500",      type: "equity" },
  { symbol: "QQQ",  label: "NASDAQ",       type: "equity" },
  { symbol: "IWM",  label: "RUSSELL",      type: "equity" },
  { symbol: "IBIT", label: "BTC ETF",      type: "crypto" },
  { symbol: "MSTR", label: "MSTR",         type: "crypto" },
  { symbol: "GLD",  label: "GOLD",         type: "commodity" },
  { symbol: "XOM",  label: "OIL/ENERGY",   type: "commodity" },
  { symbol: "TLT",  label: "10Y TREASURY", type: "macro" },
  { symbol: "HYG",  label: "HY SPREAD",    type: "macro" },
  { symbol: "UUP",  label: "DXY",          type: "macro" },
  { symbol: "XLK",  label: "TECH",         type: "sector" },
  { symbol: "XLF",  label: "FINANCIALS",   type: "sector" },
  { symbol: "XLP",  label: "DEFENSIVES",   type: "sector" },
] as const;

interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

// ── Live macro ticker strip ───────────────────────────────────
function MacroTickerStrip() {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/signals/quotes");
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, QuoteData> = {};
      if (Array.isArray(data.quotes)) {
        for (const q of data.quotes) {
          map[q.ticker] = {
            symbol: q.ticker,
            price: q.price ?? 0,
            change: q.change ?? 0,
            changePercent: q.changePercent ?? 0,
          };
        }
      }
      setQuotes(map);
    } catch {
      // silent — graceful degradation
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    const iv = setInterval(fetchQuotes, 30_000);
    return () => clearInterval(iv);
  }, [fetchQuotes]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.95)",
      borderBottom: "1px solid rgba(0,229,255,0.07)",
      overflowX: "auto",
      scrollbarWidth: "none",
    }}>
      <div style={{
        display: "flex",
        minWidth: "max-content",
      }}>
        {MACRO_INSTRUMENTS.map((inst) => {
          const q = quotes[inst.symbol];
          const isUp = (q?.changePercent ?? 0) >= 0;
          const color = loading || !q
            ? "rgba(255,255,255,0.25)"
            : isUp ? "#00FF88" : "#FF3B5C";

          return (
            <div key={inst.symbol} style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 14px",
              borderRight: "1px solid rgba(255,255,255,0.04)",
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 500,
              }}>{inst.label}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.88)",
                letterSpacing: "0.03em",
              }}>
                {loading || !q
                  ? "—"
                  : q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {q && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  fontWeight: 600,
                  color,
                }}>
                  {isUp ? "▲" : "▼"} {Math.abs(q.changePercent).toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Intelligence panel (left column) — all data from EngineContext ──
function AshaIntelPanel() {
  const { output } = useEngine();

  // All values from the single EngineOutput source of truth
  const score       = output.overall.score;
  const regime      = output.regime.label;
  const summary     = output.narrative.summary;
  const prob        = output.probability;
  const topAnalog   = output.analogs[0] ?? null;

  // Derive a verdict label from regime code
  const verdictMap: Record<string, string> = {
    CRITICAL_SYSTEMIC:    "RISK-OFF",
    LATE_CYCLE_FRAGILITY: "CAUTION",
    ELEVATED_STRESS:      "SELECTIVE",
    MODERATE_RISK:        "SELECTIVE",
    LOW_RISK:             "RISK-ON",
  };
  const verdict = verdictMap[output.regime.code] ?? "SELECTIVE";

  const scoreColor  = score >= 7 ? "#FF3B5C" : score >= 4.5 ? "#FFAA00" : "#00E5FF";
  const verdictColor = verdict === "RISK-ON" ? "#00FF88" : verdict === "RISK-OFF" ? "#FF3B5C" : "#00E5FF";

  // Regime probability bars — mapped from ProbabilityOutput
  const regimeBars = [
    { label: "BULL",        value: prob.bullProbability,        color: "#00FF88" },
    { label: "SOFT LAND",   value: prob.softLandingProbability, color: "#00E5FF" },
    { label: "STAGFLATION", value: prob.stagflationProbability, color: "#FFAA00" },
    { label: "RECESSION",   value: prob.recessionProbability,   color: "#FF6B35" },
    { label: "CRASH",       value: prob.crashProbability,       color: "#FF3B5C" },
  ];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      padding: "24px 22px",
    }}>
      {/* ── Pressure Index + Verdict ── */}
      <div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: "rgba(0,229,255,0.55)",
          marginBottom: "8px",
          fontWeight: 600,
        }}>PRESSURE INDEX</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "56px",
            fontWeight: 700,
            color: scoreColor,
            lineHeight: 1,
            textShadow: `0 0 24px ${scoreColor}35`,
          }}>{score.toFixed(1)}</span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "14px",
            color: "rgba(255,255,255,0.25)",
            alignSelf: "flex-end",
            paddingBottom: "6px",
          }}>/10</span>
          <div style={{ marginLeft: "4px", alignSelf: "flex-end", paddingBottom: "4px" }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px",
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.28)",
              marginBottom: "2px",
            }}>VERDICT</div>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "20px",
              fontWeight: 700,
              color: verdictColor,
              letterSpacing: "0.08em",
            }}>{verdict}</div>
          </div>
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.3)",
          marginTop: "4px",
          letterSpacing: "0.08em",
        }}>{regime}</div>
      </div>

      {/* ── Regime probability bars ── */}
      <div>
        <div style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}>
          {regimeBars.map(({ label, value, color }) => {
            const pct = Math.round(value * 100);
            return (
              <div key={label} style={{ minWidth: "54px" }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "7px",
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}>{label}</div>
                <div style={{
                  height: "3px",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "2px",
                  overflow: "hidden",
                  marginBottom: "4px",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: "2px",
                    transition: "width 1s cubic-bezier(0.23,1,0.32,1)",
                  }} />
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  fontWeight: 700,
                  color,
                }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Market Intelligence narrative ── */}
      <div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: "rgba(0,229,255,0.55)",
          marginBottom: "8px",
          fontWeight: 600,
        }}>MARKET INTELLIGENCE</div>
        <p style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "13px",
          lineHeight: 1.65,
          color: "rgba(255,255,255,0.78)",
          margin: 0,
        }}>{summary}</p>
      </div>

      {/* ── Key risks ── */}
      {output.narrative.keyRisks.length > 0 && (
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.14em",
            color: "rgba(255,170,0,0.6)",
            marginBottom: "8px",
            fontWeight: 600,
          }}>WATCH</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {output.narrative.keyRisks.slice(0, 3).map((risk, i) => (
              <div key={i} style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}>
                <span style={{ color: "#FFAA00", fontSize: "8px", marginTop: "3px", flexShrink: 0 }}>●</span>
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.5,
                }}>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Seismograph analog + transition risk ── */}
      {topAnalog && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "12px",
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.14em",
            color: "rgba(0,229,255,0.45)",
            marginBottom: "5px",
          }}>SEISMOGRAPH</div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.1em",
              }}>ANALOG </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                color: "#00E5FF",
                fontWeight: 600,
              }}>{topAnalog.era} {topAnalog.year}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "rgba(255,255,255,0.35)",
                marginLeft: "6px",
              }}>{topAnalog.similarity}%</span>
            </div>
            <div>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.1em",
              }}>TRANSITION RISK </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                color: prob.crashProbability > 0.3 ? "#FFAA00" : "rgba(255,255,255,0.55)",
                fontWeight: 600,
              }}>{Math.round(prob.crashProbability * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Ask FAULTLINE CTA ── */}
      <Link href="/app/ask-asha">
        <div
          role="button"
          tabIndex={0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            border: "1px solid rgba(0,229,255,0.28)",
            borderRadius: "4px",
            background: "rgba(0,229,255,0.04)",
            cursor: "pointer",
            transition: "all 0.18s ease",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: "#00E5FF",
            fontWeight: 600,
            width: "fit-content",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(0,229,255,0.09)";
            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,229,255,0.5)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(0,229,255,0.04)";
            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,229,255,0.28)";
          }}
        >
          ASK ASHA →
        </div>
      </Link>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────
export default function AshaHeroSection() {
  const ASHA_IMG = "/manus-storage/asha-hero-globe_372b539f.png";

  return (
    <div style={{ background: "#000", borderBottom: "1px solid rgba(0,229,255,0.06)" }}>
      {/* ── 13-instrument live ticker strip ── */}
      <MacroTickerStrip />

      {/* ── Hero: two-column on desktop, stacked on mobile ── */}
      <div
        className="asha-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,400px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left: intelligence panel */}
        <div style={{
          borderRight: "1px solid rgba(0,229,255,0.05)",
          background: "linear-gradient(135deg, rgba(0,229,255,0.015) 0%, transparent 55%)",
        }}>
          <AshaIntelPanel />
        </div>

        {/* Right: ASHA figure */}
        <div
          className="asha-hero-figure"
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: "420px",
          }}
        >
          {/* Ambient glow */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 80% 80% at 50% 55%, rgba(0,229,255,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 1,
          }} />
          <img
            src={ASHA_IMG}
            alt="ASHA — FAULTLINE Intelligence"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
              opacity: 0.9,
            }}
          />
          {/* ASHA label */}
          <div style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            pointerEvents: "none",
            zIndex: 2,
          }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.24em",
              color: "rgba(255,255,255,0.88)",
              textShadow: "0 0 18px rgba(0,229,255,0.35)",
            }}>ASHA</div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px",
              letterSpacing: "0.12em",
              color: "rgba(0,229,255,0.55)",
              marginTop: "3px",
            }}>Your guide through noise. Illuminating what matters.</div>
          </div>
        </div>
      </div>

      {/* ── Responsive overrides ── */}
      <style>{`
        @media (max-width: 768px) {
          .asha-hero-grid {
            grid-template-columns: 1fr !important;
          }
          .asha-hero-figure {
            min-height: 260px !important;
          }
        }
      `}</style>
    </div>
  );
}
