/* ============================================================
   FAULTLINE — Decision Engine
   The unified decision support center.
   Merges Situation Room + Trade Preflight into one experience.

   Workflow: Security → Action → Timeframe → Analysis

   The user never needs to know whether the answer came from
   Situation Room or Trade Preflight — the engine decides.
   ============================================================ */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Crosshair, Zap, Shield } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import SituationRoom from "./SituationRoom";
import TradePreflight from "./TradePreflight";
import DisclaimerBanner from "@/components/DisclaimerBanner";

const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const RAJDHANI = "'Rajdhani', sans-serif";

type DecisionTab = "situation-room" | "trade-preflight";

const TABS: { id: DecisionTab; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "situation-room",
    label: "Situation Room",
    icon: Crosshair,
    description: "Portfolio-level decision analysis — should I take risk today?",
  },
  {
    id: "trade-preflight",
    label: "Trade Preflight",
    icon: Shield,
    description: "Pre-trade stress test — is this specific move supported by the regime?",
  },
];

export default function DecisionEngine() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<DecisionTab>("situation-room");

  // Read tab from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as DecisionTab;
    if (hash && TABS.find(t => t.id === hash)) {
      setActiveTab(hash);
    }
  }, [location]);

  useSEO({
    title: "Decision Engine — FAULTLINE",
    description: "FAULTLINE Decision Engine: portfolio-level situation analysis and pre-trade stress testing in one unified workflow. Know what to risk — and when to step aside.",
  });

  const handleTabChange = (tab: DecisionTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/app/decision-engine#${tab}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050608", fontFamily: SANS }}>
      {/* ── Page Header ── */}
      <div style={{
        borderBottom: "1px solid rgba(0, 212, 255, 0.1)",
        background: "rgba(10, 12, 16, 0.95)",
        padding: "16px 20px 0",
      }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{
            width: "28px", height: "28px",
            background: "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)",
            borderRadius: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(0, 212, 255, 0.3)",
            flexShrink: 0,
          }}>
            <Crosshair size={16} color="white" />
          </div>
          <div>
            <div style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: "18px", color: "#F0F4FF", letterSpacing: "0.06em" }}>
              DECISION ENGINE
            </div>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Know What to Risk — and When to Step Aside
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #00D4FF" : "2px solid transparent",
                  color: isActive ? "#00D4FF" : "#6B7280",
                  fontFamily: MONO,
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: "-1px",
                }}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div>
        {activeTab === "situation-room" && <SituationRoom />}
        {activeTab === "trade-preflight" && <TradePreflight />}
      </div>
      <DisclaimerBanner variant="full" />
    </div>
  );
}
