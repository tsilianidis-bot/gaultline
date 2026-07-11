/**
 * FAULTLINE — First Briefing (9-Step Onboarding Flow)
 * ============================================================
 * Revised flow order:
 *  0  Welcome to FAULTLINE
 *  1  Understand Today's Market  (NEW — live data)
 *  2  Investor Type
 *  3  Risk Tolerance
 *  4  Markets & Investment Interests
 *  5  How to Read the Core Numbers  (NEW — educational)
 *  6  Watchlist Setup
 *  7  Your Personalized FAULTLINE Setup
 *  8  Enter Dashboard
 *
 * Preserves all existing profile persistence, skip behavior,
 * auth, routing, and analytics.
 * ============================================================
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/hooks/useAnalytics";

// ── Design tokens (matching FAULTLINE dashboard) ──────────────
const ACCENT = "#00D4FF";
const BG = "#0A0C10";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.07)";
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const MONO_SM: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: "0.08em" };
const SANS: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };

// ── Total step count ──────────────────────────────────────────
const TOTAL_STEPS = 8; // 0-indexed; steps 0–8

// ── Investor types ────────────────────────────────────────────
// Internal `id` values are preserved from the original schema.
// Only visible `label` values have been updated where safe.
const INVESTOR_TYPES = [
  { id: "retail",            label: "Active Retail Investor",  desc: "Self-directed, long-term focus" },
  { id: "long_term",         label: "Long-Term Investor",       desc: "Buy-and-hold, multi-year horizon" },
  { id: "retirement",        label: "Retirement Investor",      desc: "Capital preservation, income focus" },
  { id: "swing_trader",      label: "Swing Trader",             desc: "Multi-day to multi-week positions" },
  { id: "active_trader",     label: "Active Trader",            desc: "Frequent trades, technical analysis" },
  { id: "day_trader",        label: "Day Trader",               desc: "Intraday positions, high frequency" },
  { id: "options_trader",    label: "Options Trader",           desc: "Derivatives and hedging strategies" },
  { id: "institutional",     label: "Institutional",            desc: "Professional / fund management" },
  { id: "financial_advisor", label: "Financial Advisor / Planner", desc: "Client-facing, portfolio oversight" },
  { id: "wealth_manager",    label: "Wealth Manager",           desc: "High-net-worth portfolio management" },
];

// ── Risk profiles ─────────────────────────────────────────────
const RISK_PROFILES = [
  {
    id: "conservative",
    label: "Conservative",
    desc: "Capital preservation first",
    explanation: "Prioritizes capital preservation, lower volatility, and earlier risk warnings.",
    color: "#00FF88",
  },
  {
    id: "moderate",
    label: "Moderate",
    desc: "Balanced growth and safety",
    explanation: "Balances growth opportunities with meaningful downside protection.",
    color: "#FFD700",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    desc: "Maximum growth, high tolerance",
    explanation: "Accepts greater volatility in pursuit of stronger growth.",
    color: "#FF9500",
  },
  {
    id: "speculative",
    label: "Speculative",
    desc: "High risk, asymmetric upside",
    explanation: "Accepts significant risk and rapid market movement in pursuit of outsized returns.",
    color: "#FF4444",
  },
];

// ── Interest areas ────────────────────────────────────────────
const INTEREST_AREAS = [
  "US Equities", "Crypto", "Options", "Macro / Rates", "International", "Commodities",
  "ETFs", "Small Cap", "Growth", "Value", "Dividends", "Sector Rotation",
  "Fixed Income", "Currencies (FX)", "Real Estate (REITs)", "Biotech / Healthcare",
  "Bonds", "Mutual Funds", "Annuities", "Retirement Planning", "Income Investing",
];

// ── Watchlist suggestions ─────────────────────────────────────
const WATCHLIST_SUGGESTIONS = [
  "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META", "GOOGL", "SPY",
  "QQQ", "BTC", "ETH", "AMD", "PLTR", "COIN", "SOFI", "MSTR",
];

// ── Personalization priorities by investor type ───────────────
function getPersonalizationPriorities(
  investorType: string | null,
  riskProfile: string | null,
  interests: string[]
): string[] {
  const type = investorType ?? "retail";
  const risk = riskProfile ?? "moderate";

  if (type === "day_trader") {
    return [
      "Intraday risk shifts and volatility conditions",
      "Market breadth and liquidity changes",
      "Short-term opportunity signals",
      "Faster invalidation triggers",
      "Real-time pressure index changes",
    ];
  }
  if (type === "financial_advisor" || type === "wealth_manager") {
    return [
      "Client-friendly market explanations",
      "Macro and regime context for portfolio conversations",
      "Downside-risk communication and early warnings",
      "Long-term portfolio conditions",
      "Rates and fixed-income developments",
    ];
  }
  if (type === "retirement" || interests.includes("Retirement Planning")) {
    return [
      "Capital preservation signals",
      "Long-term regime changes",
      "Fixed income and rate developments",
      "Downside-risk warnings",
      "Portfolio-preservation conditions",
    ];
  }
  if (type === "swing_trader" || type === "active_trader") {
    return [
      "Regime shifts and trend changes",
      "Volatility and breadth conditions",
      "Medium-term opportunity signals",
      "Risk-on / risk-off environment changes",
      "Credit and liquidity conditions",
    ];
  }
  if (type === "options_trader") {
    return [
      "Volatility regime and VIX conditions",
      "Crash risk and tail-risk signals",
      "Breadth and liquidity changes",
      "Short-term regime shifts",
      "Systemic pressure spikes",
    ];
  }

  // Default: long-term / retail / institutional
  const base = [
    "Medium- and long-term regime changes",
    risk === "conservative" ? "Downside-risk warnings and early caution signals" : "Growth and opportunity conditions",
  ];
  if (interests.includes("Crypto")) base.push("Crypto market regime and risk conditions");
  if (interests.includes("Fixed Income") || interests.includes("Bonds")) base.push("Interest-rate and fixed-income developments");
  if (interests.includes("Dividends") || interests.includes("Income Investing")) base.push("Yield and income conditions");
  if (interests.includes("ETFs")) base.push("Broad market ETF conditions and regime alignment");
  base.push("Reduced emphasis on intraday trading noise");
  return base;
}

// ── Pressure level helpers ────────────────────────────────────
function pressureLabel(score: number): string {
  if (score >= 80) return "Critical Stress";
  if (score >= 65) return "High Stress";
  if (score >= 45) return "Elevated Stress";
  if (score >= 25) return "Moderate";
  return "Low Risk";
}
function pressureColor(score: number): string {
  if (score >= 80) return "#FF2D55";
  if (score >= 65) return "#FF4444";
  if (score >= 45) return "#FF9500";
  if (score >= 25) return "#FFD700";
  return "#00FF88";
}
function trendArrow(trend: string): string {
  if (trend === "rising") return "↑";
  if (trend === "falling") return "↓";
  return "→";
}
function trendColor(trend: string): string {
  if (trend === "rising") return "#FF9500";
  if (trend === "falling") return "#00FF88";
  return "#94A3B8";
}

// ── Component ─────────────────────────────────────────────────
interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [investorType, setInvestorType] = useState<string | null>(null);
  const [riskProfile, setRiskProfile] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [customTicker, setCustomTicker] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const savePreferences = trpc.dailyBrief.savePreferences.useMutation();

  // Live market data for Step 1
  const pressureQuery = trpc.pressure.getCurrentPressure.useQuery(undefined, {
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Track first briefing started
  useEffect(() => {
    trackEvent("first_briefing_started", { event_category: "onboarding" });
  }, []);

  // Track step views
  useEffect(() => {
    const stepEvents: Record<number, string> = {
      1: "market_overview_viewed",
      2: "investor_type_step_viewed",
      3: "risk_tolerance_step_viewed",
      4: "interests_step_viewed",
      5: "core_numbers_explained",
      6: "watchlist_step_viewed",
      7: "personalization_summary_viewed",
    };
    if (stepEvents[step]) {
      trackEvent(stepEvents[step], { event_category: "onboarding", step });
    }
  }, [step]);

  const progress = (step / TOTAL_STEPS) * 100;

  const toggleInterest = (item: string) => {
    setInterests(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const toggleWatchlist = (ticker: string) => {
    setWatchlist(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]);
  };

  const addCustomTicker = () => {
    const t = customTicker.trim().toUpperCase();
    if (t && !watchlist.includes(t)) {
      setWatchlist(prev => [...prev, t]);
      setCustomTicker("");
    }
  };

  const handleSkip = () => {
    trackEvent("first_briefing_skipped", { event_category: "onboarding", step });
    onComplete();
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await savePreferences.mutateAsync({
        investorType: investorType ?? "retail",
        riskProfile: riskProfile ?? "moderate",
        interests,
        watchlistTickers: watchlist,
        onboardingComplete: true,
      });
      trackEvent("first_briefing_completed", {
        event_category: "onboarding",
        investor_type: investorType ?? "retail",
        risk_profile: riskProfile ?? "moderate",
        interests_count: interests.length,
        watchlist_count: watchlist.length,
      });
      onComplete();
    } catch {
      onComplete();
    }
    setIsSaving(false);
  };

  const canProceed = () => {
    if (step === 2) return !!investorType;
    if (step === 3) return !!riskProfile;
    return true;
  };

  const goNext = () => {
    if (step === 2 && investorType) trackEvent("investor_type_selected", { investor_type: investorType, event_category: "onboarding" });
    if (step === 3 && riskProfile) trackEvent("risk_tolerance_selected", { risk_profile: riskProfile, event_category: "onboarding" });
    if (step === 4) trackEvent("interests_selected", { count: interests.length, event_category: "onboarding" });
    if (step === 6) trackEvent("watchlist_setup_completed", { count: watchlist.length, event_category: "onboarding" });
    setStep(s => s + 1);
  };

  // ── Shared button styles ──────────────────────────────────────
  const primaryBtn: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    background: ACCENT,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    ...MONO,
    fontSize: "12px",
    fontWeight: 700,
    color: "#000",
    letterSpacing: "0.1em",
    transition: "opacity 0.15s",
  };
  const secondaryBtn: React.CSSProperties = {
    padding: "10px 16px",
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: "6px",
    cursor: "pointer",
    ...SANS,
    fontSize: "13px",
    color: "rgba(255,255,255,0.4)",
    transition: "all 0.15s",
  };
  const continueBtn: React.CSSProperties = {
    flex: 1,
    padding: "10px",
    background: canProceed() ? ACCENT : "rgba(255,255,255,0.05)",
    border: `1px solid ${canProceed() ? ACCENT : BORDER}`,
    borderRadius: "6px",
    cursor: canProceed() ? "pointer" : "default",
    ...MONO,
    fontSize: "12px",
    fontWeight: 700,
    color: canProceed() ? "#000" : "rgba(255,255,255,0.2)",
    letterSpacing: "0.08em",
    transition: "all 0.15s",
  };

  // ── Live pressure data for Step 1 ─────────────────────────────
  const pd = pressureQuery.data;
  const pressureScore = pd?.overallPressure ?? null;
  const regime = pd?.regime ?? null;
  const pressureTrend = pd?.vectors?.[0]?.trend ?? "stable";

  // Derive bull/crash from pressure score (same formula used across the platform)
  const bullProb = pressureScore !== null ? Math.round(Math.max(5, 100 - pressureScore * 1.1)) : null;
  const crashProb = pressureScore !== null ? Math.round(Math.min(95, pressureScore * 0.85)) : null;

  // Primary drivers from top vectors
  const topDrivers = pd?.vectors
    ?.filter(v => v.score >= 50)
    ?.sort((a, b) => b.score - a.score)
    ?.slice(0, 3)
    ?.map(v => v.label) ?? [];

  // ── Personalization summary ───────────────────────────────────
  const priorities = getPersonalizationPriorities(investorType, riskProfile, interests);
  const investorLabel = INVESTOR_TYPES.find(t => t.id === investorType)?.label ?? "—";
  const riskLabel = RISK_PROFILES.find(r => r.id === riskProfile)?.label ?? "—";

  const summaryText = investorType && riskProfile
    ? `Your FAULTLINE experience is configured for a ${riskLabel.toLowerCase()}-risk ${investorLabel.toLowerCase()}${interests.length > 0 ? ` focused on ${interests.slice(0, 3).join(", ")}${interests.length > 3 ? `, and ${interests.length - 3} more areas` : ""}` : ""}.`
    : "Your FAULTLINE experience will be personalized based on your selections.";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(12px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      overflowY: "auto",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "560px",
        background: BG,
        border: `1px solid ${BORDER}`,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        margin: "auto",
      }}>
        {/* Progress bar */}
        <div style={{ height: "2px", background: "rgba(255,255,255,0.06)" }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${ACCENT}, #0080FF)`,
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Step counter */}
        <div style={{ padding: "12px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {step > 0 ? (
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>
              STEP {step} OF {TOTAL_STEPS}
            </span>
          ) : <span />}
          <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "9px" }}>
            FIRST BRIEFING
          </span>
        </div>

        <div style={{ padding: "20px 24px 24px", maxHeight: "80vh", overflowY: "auto" }}>

          {/* ══════════════════════════════════════════════════════
              STEP 0 — WELCOME TO FAULTLINE
          ══════════════════════════════════════════════════════ */}
          {step === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ ...MONO, fontSize: "28px", fontWeight: 800, letterSpacing: "0.12em", color: "#F0F4FF", marginBottom: "6px" }}>
                FAULT<span style={{ color: ACCENT }}>LINE</span>
              </div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", fontSize: "10px", marginBottom: "20px" }}>
                INSTITUTIONAL INTELLIGENCE
              </div>
              <p style={{ ...SANS, fontSize: "18px", fontWeight: 600, color: "#F0F4FF", lineHeight: 1.5, marginBottom: "10px" }}>
                See what's building beneath the surface.
              </p>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: "24px" }}>
                FAULTLINE explains the hidden market conditions shaping risk, opportunity, and regime changes before they become obvious in price action.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "left", marginBottom: "28px" }}>
                {[
                  "Personalized Daily Market Brief",
                  "Risk-adjusted opportunity scoring",
                  "Watchlist intelligence monitoring",
                  "Regime-aware intelligence",
                  "Time-horizon emphasis matching your style",
                  "Market and asset-class focus",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: ACCENT, fontSize: "12px", flexShrink: 0 }}>✓</span>
                    <span style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                style={primaryBtn}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                BEGIN FIRST BRIEFING →
              </button>
              <button
                onClick={handleSkip}
                style={{
                  marginTop: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  ...SANS,
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.25)",
                  textDecoration: "underline",
                  width: "100%",
                }}
              >
                Skip setup
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 1 — UNDERSTAND TODAY'S MARKET
          ══════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>TODAY'S MARKET</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                Understand Today's Market
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                These four readings describe the current market environment. FAULTLINE interprets them together rather than relying on one number alone.
              </p>

              {pressureQuery.isLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.3)", ...SANS, fontSize: "13px" }}>
                  Loading live market data…
                </div>
              ) : pressureQuery.isError || pressureScore === null ? (
                <div style={{
                  padding: "16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6,
                }}>
                  Current readings are temporarily unavailable. You will see live values when you enter the dashboard.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  {/* Pressure Index */}
                  <div style={{ padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", fontSize: "9px", letterSpacing: "0.15em" }}>PRESSURE INDEX</div>
                      <span style={{ ...MONO_SM, color: trendColor(pressureTrend), fontSize: "10px" }}>
                        {trendArrow(pressureTrend)} {pressureTrend.charAt(0).toUpperCase() + pressureTrend.slice(1)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ ...MONO, fontSize: "24px", fontWeight: 700, color: pressureColor(pressureScore) }}>
                        {Math.round(pressureScore)}
                      </span>
                      <span style={{ ...SANS, fontSize: "13px", color: pressureColor(pressureScore), fontWeight: 600 }}>
                        — {pressureLabel(pressureScore)}
                      </span>
                    </div>
                    <p style={{ ...SANS, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                      How much hidden systemic stress is building beneath the market.
                      {topDrivers.length > 0 && ` Primary drivers: ${topDrivers.join(", ")}.`}
                    </p>
                  </div>

                  {/* Market Regime */}
                  <div style={{ padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                    <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", fontSize: "9px", letterSpacing: "0.15em", marginBottom: "6px" }}>MARKET REGIME</div>
                    <div style={{ ...MONO, fontSize: "16px", fontWeight: 700, color: ACCENT, marginBottom: "4px" }}>
                      {regime ?? "—"}
                    </div>
                    <p style={{ ...SANS, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                      Whether the overall environment currently favors offense, caution, defense, or crisis positioning.
                    </p>
                  </div>

                  {/* Bull / Crash row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div style={{ padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", fontSize: "9px", letterSpacing: "0.12em", marginBottom: "6px" }}>BULL CONTINUATION</div>
                      <div style={{ ...MONO, fontSize: "22px", fontWeight: 700, color: "#00FF88", marginBottom: "4px" }}>
                        {bullProb !== null ? `${bullProb}%` : "—"}
                      </div>
                      <p style={{ ...SANS, fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4, margin: 0 }}>
                        How supportive conditions are for the existing trend to continue.
                      </p>
                    </div>
                    <div style={{ padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", fontSize: "9px", letterSpacing: "0.12em", marginBottom: "6px" }}>CRASH RISK</div>
                      <div style={{ ...MONO, fontSize: "22px", fontWeight: 700, color: "#FF4444", marginBottom: "4px" }}>
                        {crashProb !== null ? `${crashProb}%` : "—"}
                      </div>
                      <p style={{ ...SANS, fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4, margin: 0 }}>
                        Current evidence supporting the possibility of a meaningful breakdown.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div style={{
                padding: "12px 14px",
                background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.12)",
                borderRadius: "6px",
                marginBottom: "20px",
              }}>
                <p style={{ ...SANS, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
                  These readings describe different parts of the same market environment. FAULTLINE interprets them together rather than relying on one number alone.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep(0)} style={secondaryBtn}>← Back</button>
                <button onClick={goNext} style={{ ...continueBtn, background: ACCENT, border: `1px solid ${ACCENT}`, color: "#000" }}>
                  CONTINUE BRIEFING →
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 2 — INVESTOR TYPE
          ══════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>INVESTOR PROFILE</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                How do you invest?
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                This helps FAULTLINE emphasize the timeframes, risks, and intelligence most relevant to how you use the market.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {INVESTOR_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setInvestorType(type.id)}
                    style={{
                      padding: "12px 14px",
                      background: investorType === type.id ? "rgba(0,212,255,0.1)" : SURFACE,
                      border: `1px solid ${investorType === type.id ? "rgba(0,212,255,0.4)" : BORDER}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ ...SANS, fontSize: "13px", fontWeight: 600, color: investorType === type.id ? ACCENT : "#F0F4FF", marginBottom: "3px" }}>
                      {type.label}
                    </div>
                    <div style={{ ...SANS, fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 3 — RISK TOLERANCE
          ══════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>RISK TOLERANCE</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                What is your risk tolerance?
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                Risk tolerance changes how strongly FAULTLINE emphasizes warnings, opportunity conditions, and volatility.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {RISK_PROFILES.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => setRiskProfile(profile.id)}
                    style={{
                      padding: "14px 16px",
                      background: riskProfile === profile.id
                        ? `rgba(${profile.color === '#00FF88' ? '0,255,136' : profile.color === '#FFD700' ? '255,215,0' : profile.color === '#FF9500' ? '255,149,0' : '255,68,68'},0.08)`
                        : SURFACE,
                      border: `1px solid ${riskProfile === profile.id ? profile.color + '40' : BORDER}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: profile.color, flexShrink: 0, marginTop: "5px" }} />
                    <div>
                      <div style={{ ...SANS, fontSize: "14px", fontWeight: 600, color: riskProfile === profile.id ? profile.color : "#F0F4FF", marginBottom: "2px" }}>
                        {profile.label}
                      </div>
                      <div style={{ ...SANS, fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>
                        {profile.explanation}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 4 — MARKETS & INVESTMENT INTERESTS
          ══════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>MARKET FOCUS</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                What markets do you focus on?
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                Choose the markets, assets, and planning areas you want FAULTLINE to emphasize.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {INTEREST_AREAS.map(area => (
                  <button
                    key={area}
                    onClick={() => toggleInterest(area)}
                    style={{
                      padding: "7px 12px",
                      background: interests.includes(area) ? "rgba(0,212,255,0.1)" : SURFACE,
                      border: `1px solid ${interests.includes(area) ? "rgba(0,212,255,0.35)" : BORDER}`,
                      borderRadius: "20px",
                      cursor: "pointer",
                      ...SANS,
                      fontSize: "12px",
                      color: interests.includes(area) ? ACCENT : "rgba(255,255,255,0.55)",
                      transition: "all 0.15s",
                    }}
                  >
                    {area}
                  </button>
                ))}
              </div>
              {interests.length > 0 && (
                <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px", marginTop: "12px" }}>
                  {interests.length} selected
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 5 — HOW TO READ THE CORE NUMBERS
          ══════════════════════════════════════════════════════ */}
          {step === 5 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>READING THE PLATFORM</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                How to Read the Core Numbers
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                Every major score in FAULTLINE now explains what it means, why it is at its current level, and what to watch next.
              </p>

              {/* Four definitions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {[
                  {
                    label: "PRESSURE INDEX",
                    color: "#FF9500",
                    range: "0 – 100",
                    definition: "How much hidden systemic stress is building beneath the market.",
                    detail: "Below 25 = Low Risk · 25–45 = Moderate · 45–65 = Elevated · 65–80 = High · 80+ = Critical",
                  },
                  {
                    label: "MARKET REGIME",
                    color: ACCENT,
                    range: "5 regimes",
                    definition: "Whether the overall environment currently favors offense, caution, defense, or crisis positioning.",
                    detail: "Low Risk → Moderate → Elevated Stress → Late-Cycle Fragility → Critical Systemic Stress",
                  },
                  {
                    label: "BULL CONTINUATION",
                    color: "#00FF88",
                    range: "0 – 100%",
                    definition: "How supportive current conditions are for the existing bullish trend to continue.",
                    detail: "Not a guaranteed price forecast. High values indicate supportive macro conditions, not certainty.",
                  },
                  {
                    label: "CRASH RISK",
                    color: "#FF4444",
                    range: "0 – 100%",
                    definition: "How much current evidence supports the possibility of a meaningful market breakdown.",
                    detail: "Based on historical analog matching, pressure levels, and regime classification.",
                  },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ ...MONO_SM, color: item.color, fontSize: "9px", letterSpacing: "0.15em" }}>{item.label}</div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "9px" }}>{item.range}</div>
                    </div>
                    <p style={{ ...SANS, fontSize: "13px", color: "#F0F4FF", lineHeight: 1.5, marginBottom: "6px", fontWeight: 500 }}>
                      {item.definition}
                    </p>
                    <p style={{ ...SANS, fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.5, margin: 0 }}>
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* How they work together */}
              <div style={{
                padding: "14px 16px",
                background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.12)",
                borderRadius: "8px",
                marginBottom: "20px",
              }}>
                <div style={{ ...MONO_SM, color: ACCENT, fontSize: "9px", letterSpacing: "0.15em", marginBottom: "10px" }}>HOW THEY WORK TOGETHER</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    "High pressure with bullish prices may signal hidden fragility.",
                    "Low pressure with an improving regime may support risk-taking.",
                    "Rising crash risk with weakening regime conditions increases caution.",
                    "No single score should be interpreted alone.",
                    "Historical comparisons provide context, not certainty.",
                  ].map((point, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ color: ACCENT, fontSize: "10px", flexShrink: 0, marginTop: "2px" }}>·</span>
                      <span style={{ ...SANS, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Example (labeled as example only) */}
              <div style={{
                padding: "12px 14px",
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: "8px",
                marginBottom: "20px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "0.15em" }}>EXAMPLE READING</div>
                  <div style={{ ...MONO_SM, color: "#FF9500", fontSize: "8px", letterSpacing: "0.1em", padding: "2px 6px", background: "rgba(255,149,0,0.1)", border: "1px solid rgba(255,149,0,0.2)", borderRadius: "3px" }}>
                    EXAMPLE ONLY
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Pressure", value: "68", sub: "Elevated Stress", color: "#FF9500" },
                    { label: "Regime", value: "Elevated", sub: "Stress", color: ACCENT },
                    { label: "Bull Prob", value: "34%", sub: "Weakening", color: "#FFD700" },
                    { label: "Crash Risk", value: "58%", sub: "Elevated", color: "#FF4444" },
                  ].map((item, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ ...MONO, fontSize: "18px", fontWeight: 700, color: item.color }}>{item.value}</div>
                      <div style={{ ...SANS, fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>{item.label} · {item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep(4)} style={secondaryBtn}>← Back</button>
                <button onClick={goNext} style={{ ...continueBtn, background: ACCENT, border: `1px solid ${ACCENT}`, color: "#000" }}>
                  PERSONALIZE MY MARKET VIEW →
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 6 — WATCHLIST SETUP
          ══════════════════════════════════════════════════════ */}
          {step === 6 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>WATCHLIST</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                Add tickers to your watchlist
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "16px", lineHeight: 1.5 }}>
                Your watchlist helps FAULTLINE connect broad market conditions to the assets you actually follow.
              </p>
              {/* Custom ticker input */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                <input
                  value={customTicker}
                  onChange={e => setCustomTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && addCustomTicker()}
                  placeholder="Add ticker (e.g. NVDA)"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "6px",
                    ...MONO,
                    fontSize: "12px",
                    color: "#F0F4FF",
                    outline: "none",
                  }}
                />
                <button
                  onClick={addCustomTicker}
                  style={{
                    padding: "9px 14px",
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    ...MONO,
                    fontSize: "11px",
                    color: ACCENT,
                  }}
                >
                  ADD
                </button>
              </div>
              {/* Suggestions */}
              <div style={{ ...SANS, fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>Popular tickers:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {WATCHLIST_SUGGESTIONS.map(ticker => (
                  <button
                    key={ticker}
                    onClick={() => toggleWatchlist(ticker)}
                    style={{
                      padding: "5px 10px",
                      background: watchlist.includes(ticker) ? "rgba(0,212,255,0.1)" : SURFACE,
                      border: `1px solid ${watchlist.includes(ticker) ? "rgba(0,212,255,0.35)" : BORDER}`,
                      borderRadius: "4px",
                      cursor: "pointer",
                      ...MONO,
                      fontSize: "11px",
                      fontWeight: 700,
                      color: watchlist.includes(ticker) ? ACCENT : "rgba(255,255,255,0.5)",
                      transition: "all 0.15s",
                    }}
                  >
                    {ticker}
                  </button>
                ))}
              </div>
              {watchlist.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {watchlist.map(t => (
                    <span
                      key={t}
                      onClick={() => toggleWatchlist(t)}
                      style={{
                        padding: "4px 8px",
                        background: "rgba(0,212,255,0.08)",
                        border: "1px solid rgba(0,212,255,0.2)",
                        borderRadius: "4px",
                        ...MONO,
                        fontSize: "10px",
                        color: ACCENT,
                        cursor: "pointer",
                      }}
                    >
                      {t} ×
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 7 — YOUR PERSONALIZED FAULTLINE SETUP
          ══════════════════════════════════════════════════════ */}
          {step === 7 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>YOUR SETUP</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                Your Personalized FAULTLINE
              </h2>

              {/* Summary sentence */}
              <div style={{
                padding: "14px 16px",
                background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: "8px",
                marginBottom: "16px",
              }}>
                <p style={{ ...SANS, fontSize: "14px", color: "#F0F4FF", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  {summaryText}
                </p>
              </div>

              {/* Profile summary */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px", padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                {[
                  { label: "INVESTOR TYPE",  value: investorLabel },
                  { label: "RISK PROFILE",   value: riskLabel },
                  { label: "INTERESTS",      value: interests.length > 0 ? `${interests.length} selected` : "None" },
                  { label: "WATCHLIST",      value: watchlist.length > 0 ? `${watchlist.length} ticker${watchlist.length > 1 ? "s" : ""}` : "None" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{label}</span>
                    <span style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* FAULTLINE will prioritize */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "0.15em", marginBottom: "10px" }}>
                  FAULTLINE WILL PRIORITIZE:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {priorities.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ color: ACCENT, fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>✓</span>
                      <span style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep(6)} style={secondaryBtn}>← Back</button>
                <button onClick={goNext} style={{ ...continueBtn, background: ACCENT, border: `1px solid ${ACCENT}`, color: "#000" }}>
                  CONTINUE →
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 8 — ENTER DASHBOARD
          ══════════════════════════════════════════════════════ */}
          {step === 8 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>✓</div>
              <div style={{ ...MONO, fontSize: "18px", fontWeight: 700, color: ACCENT, letterSpacing: "0.1em", marginBottom: "12px" }}>
                YOU'RE READY
              </div>
              <p style={{ ...SANS, fontSize: "16px", fontWeight: 600, color: "#F0F4FF", lineHeight: 1.5, marginBottom: "8px" }}>
                You're ready to read the market with FAULTLINE.
              </p>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: "24px" }}>
                Every major score now explains what it means, why it is at its current level, how it is changing, and what to watch next.
              </p>

              {/* Final profile summary */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left", marginBottom: "24px", padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                {[
                  { label: "INVESTOR TYPE",  value: investorLabel },
                  { label: "RISK PROFILE",   value: riskLabel },
                  { label: "INTERESTS",      value: interests.length > 0 ? `${interests.length} selected` : "None" },
                  { label: "WATCHLIST",      value: watchlist.length > 0 ? watchlist.slice(0, 4).join(", ") + (watchlist.length > 4 ? ` +${watchlist.length - 4}` : "") : "None" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{label}</span>
                    <span style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleComplete}
                disabled={isSaving}
                style={{
                  ...primaryBtn,
                  background: isSaving ? "rgba(0,212,255,0.3)" : ACCENT,
                  cursor: isSaving ? "default" : "pointer",
                  marginBottom: "10px",
                }}
              >
                {isSaving ? "SAVING..." : "ENTER FAULTLINE →"}
              </button>
              <button
                onClick={() => setStep(7)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  ...SANS,
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.3)",
                  textDecoration: "underline",
                  width: "100%",
                }}
              >
                Review My Setup
              </button>
            </div>
          )}

          {/* ── Navigation (steps 2–4 and 6) ── */}
          {(step === 2 || step === 3 || step === 4 || step === 6) && (
            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setStep(s => s - 1)} style={secondaryBtn}>← Back</button>
              <button
                onClick={goNext}
                disabled={!canProceed()}
                style={continueBtn}
              >
                {step === 4 ? "CONTINUE →" : step === 6 ? "REVIEW SETUP →" : "CONTINUE →"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
