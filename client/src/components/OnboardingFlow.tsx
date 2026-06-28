import { useState } from "react";
import { trpc } from "@/lib/trpc";

// ── Design tokens (matching SmartDiscovery) ───────────────────
const ACCENT = "#00D4FF";
const BG = "#0A0C10";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.07)";
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const MONO_SM: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: "0.08em" };
const SANS: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };

// ── Onboarding step definitions ───────────────────────────────
const INVESTOR_TYPES = [
  { id: "retail", label: "Retail Investor", desc: "Self-directed, long-term focus" },
  { id: "active_trader", label: "Active Trader", desc: "Frequent trades, technical analysis" },
  { id: "swing_trader", label: "Swing Trader", desc: "Multi-day to multi-week positions" },
  { id: "day_trader", label: "Day Trader", desc: "Intraday positions, high frequency" },
  { id: "institutional", label: "Institutional", desc: "Professional / fund management" },
  { id: "options_trader", label: "Options Trader", desc: "Derivatives and hedging strategies" },
];

const RISK_PROFILES = [
  { id: "conservative", label: "Conservative", desc: "Capital preservation first", color: "#00FF88" },
  { id: "moderate", label: "Moderate", desc: "Balanced growth and safety", color: "#FFD700" },
  { id: "aggressive", label: "Aggressive", desc: "Maximum growth, high tolerance", color: "#FF9500" },
  { id: "speculative", label: "Speculative", desc: "High risk, asymmetric upside", color: "#FF4444" },
];

const INTEREST_AREAS = [
  "US Equities", "Crypto", "Options", "Macro / Rates", "International", "Commodities",
  "ETFs", "Small Cap", "Growth", "Value", "Dividends", "Sector Rotation",
  "Fixed Income", "Currencies (FX)", "Real Estate (REITs)", "Biotech / Healthcare",
];

const WATCHLIST_SUGGESTIONS = [
  "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META", "GOOGL", "SPY",
  "QQQ", "BTC", "ETH", "AMD", "PLTR", "COIN", "SOFI", "MSTR",
];

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

  const TOTAL_STEPS = 5; // Welcome, Investor Type, Risk Profile, Interests, Watchlist
  const progress = ((step) / TOTAL_STEPS) * 100;

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
      onComplete();
    } catch {
      onComplete(); // proceed even if save fails
    }
    setIsSaving(false);
  };

  const canProceed = () => {
    if (step === 1) return !!investorType;
    if (step === 2) return !!riskProfile;
    return true;
  };

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
    }}>
      <div style={{
        width: "100%",
        maxWidth: "540px",
        background: BG,
        border: `1px solid ${BORDER}`,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
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
          {step > 0 && (
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>
              STEP {step} OF {TOTAL_STEPS}
            </span>
          )}
          {step === 0 && <span />}
          <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "9px" }}>
            FAULTLINE SETUP
          </span>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ ...MONO, fontSize: "28px", fontWeight: 800, letterSpacing: "0.12em", color: "#F0F4FF", marginBottom: "6px" }}>
                FAULT<span style={{ color: ACCENT }}>LINE</span>
              </div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", fontSize: "10px", marginBottom: "24px" }}>
                INSTITUTIONAL INTELLIGENCE V3.0
              </div>
              <p style={{ ...SANS, fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: "12px" }}>
                Welcome. FAULTLINE is an institutional market intelligence platform built to help you understand what the market is actually doing — before making decisions.
              </p>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: "28px" }}>
                This 2-minute setup personalizes your Daily Brief, risk filters, and intelligence scoring to match your investor profile.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "left", marginBottom: "28px" }}>
                {[
                  "Personalized Daily Market Brief",
                  "Risk-adjusted opportunity scoring",
                  "Watchlist intelligence monitoring",
                  "Regime-aware recommendations",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: ACCENT, fontSize: "12px" }}>✓</span>
                    <span style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                style={{
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
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                BEGIN SETUP →
              </button>
              <button
                onClick={onComplete}
                style={{
                  marginTop: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  ...SANS,
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.25)",
                  textDecoration: "underline",
                }}
              >
                Skip setup
              </button>
            </div>
          )}

          {/* ── Step 1: Investor Type ── */}
          {step === 1 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>INVESTOR PROFILE</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                How do you invest?
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                This calibrates FAULTLINE's time horizon, signal weighting, and opportunity scoring to match your style.
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

          {/* ── Step 2: Risk Profile ── */}
          {step === 2 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>RISK TOLERANCE</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                What is your risk tolerance?
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                FAULTLINE will filter and weight recommendations based on your risk profile.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {RISK_PROFILES.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => setRiskProfile(profile.id)}
                    style={{
                      padding: "14px 16px",
                      background: riskProfile === profile.id ? `rgba(${profile.color === '#00FF88' ? '0,255,136' : profile.color === '#FFD700' ? '255,215,0' : profile.color === '#FF9500' ? '255,149,0' : '255,68,68'},0.08)` : SURFACE,
                      border: `1px solid ${riskProfile === profile.id ? profile.color + '40' : BORDER}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: profile.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ ...SANS, fontSize: "14px", fontWeight: 600, color: riskProfile === profile.id ? profile.color : "#F0F4FF", marginBottom: "2px" }}>
                        {profile.label}
                      </div>
                      <div style={{ ...SANS, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{profile.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Interests ── */}
          {step === 3 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>MARKET FOCUS</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                What markets do you focus on?
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "20px", lineHeight: 1.5 }}>
                Select all that apply. Your Daily Brief will prioritize these areas.
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

          {/* ── Step 4: Watchlist ── */}
          {step === 4 && (
            <div>
              <div style={{ ...MONO_SM, color: ACCENT, fontSize: "10px", letterSpacing: "0.15em", marginBottom: "8px" }}>WATCHLIST</div>
              <h2 style={{ ...SANS, fontSize: "20px", fontWeight: 700, color: "#F0F4FF", marginBottom: "6px" }}>
                Add tickers to your watchlist
              </h2>
              <p style={{ ...SANS, fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "16px", lineHeight: 1.5 }}>
                FAULTLINE will monitor these and include them in your Daily Brief intelligence.
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

          {/* ── Step 5: Complete ── */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>✓</div>
              <div style={{ ...MONO, fontSize: "18px", fontWeight: 700, color: ACCENT, letterSpacing: "0.1em", marginBottom: "8px" }}>
                SETUP COMPLETE
              </div>
              <p style={{ ...SANS, fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: "10px" }}>
                Your FAULTLINE profile has been configured. Your Daily Brief, risk filters, and intelligence scoring are now personalized.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left", marginBottom: "24px", padding: "14px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>INVESTOR TYPE</span>
                  <span style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{INVESTOR_TYPES.find(t => t.id === investorType)?.label ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>RISK PROFILE</span>
                  <span style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{RISK_PROFILES.find(r => r.id === riskProfile)?.label ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>INTERESTS</span>
                  <span style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{interests.length > 0 ? `${interests.length} selected` : "None"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>WATCHLIST</span>
                  <span style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{watchlist.length > 0 ? watchlist.slice(0, 4).join(", ") + (watchlist.length > 4 ? ` +${watchlist.length - 4}` : "") : "None"}</span>
                </div>
              </div>
              <button
                onClick={handleComplete}
                disabled={isSaving}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: isSaving ? "rgba(0,212,255,0.3)" : ACCENT,
                  border: "none",
                  borderRadius: "6px",
                  cursor: isSaving ? "default" : "pointer",
                  ...MONO,
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#000",
                  letterSpacing: "0.1em",
                  transition: "opacity 0.15s",
                }}
              >
                {isSaving ? "SAVING..." : "ENTER FAULTLINE →"}
              </button>
            </div>
          )}

          {/* ── Navigation buttons (steps 1-4) ── */}
          {step >= 1 && step <= 4 && (
            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: "10px 16px",
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  ...SANS,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.4)",
                  transition: "all 0.15s",
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                style={{
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
                }}
              >
                {step === 4 ? "REVIEW →" : "CONTINUE →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
