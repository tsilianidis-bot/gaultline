/* ============================================================
   FAULTLINE — Crypto Hub
   Unified crypto intelligence: Analysis, Signals, Watchlist
   Merges CryptoSearch + CryptoSignals + CryptoWatchlist into
   one cohesive experience.
   Design: Palantir Noir — void black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bitcoin, Radio, Bookmark, Search } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import CryptoSearch from "./CryptoSearch";
import CryptoSignals from "./CryptoSignals";
import CryptoWatchlist from "./CryptoWatchlist";

const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const RAJDHANI = "'Rajdhani', sans-serif";

type CryptoTab = "analysis" | "signals" | "watchlist";

const TABS: { id: CryptoTab; label: string; shortLabel: string; icon: React.ElementType; description: string }[] = [
  {
    id: "analysis",
    label: "Analysis",
    shortLabel: "Analysis",
    icon: Search,
    description: "Deep-dive intelligence on any digital asset",
  },
  {
    id: "signals",
    label: "Signals",
    shortLabel: "Signals",
    icon: Radio,
    description: "Live crypto trading signals across all categories",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    shortLabel: "Watchlist",
    icon: Bookmark,
    description: "Your saved tokens with live signal labels",
  },
];

export default function CryptoHub() {
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<CryptoTab>("analysis");

  // Read tab from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as CryptoTab;
    if (hash && TABS.find(t => t.id === hash)) {
      setActiveTab(hash);
    }
  }, [location]);

  useSEO({
    title: "Crypto Hub — FAULTLINE",
    description: "Institutional-grade crypto intelligence: deep analysis, live signals, and watchlist management for Bitcoin, Ethereum, and all major digital assets.",
  });

  const handleTabChange = (tab: CryptoTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/app/crypto#${tab}`);
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
            background: "linear-gradient(135deg, #F7931A 0%, #FF6B00 100%)",
            borderRadius: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(247, 147, 26, 0.3)",
            flexShrink: 0,
          }}>
            <Bitcoin size={16} color="white" />
          </div>
          <div>
            <div style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: "18px", color: "#F0F4FF", letterSpacing: "0.06em" }}>
              CRYPTO HUB
            </div>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Digital Asset Intelligence
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0", borderBottom: "none" }}>
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
                  borderBottom: isActive ? "2px solid #F7931A" : "2px solid transparent",
                  color: isActive ? "#F7931A" : "#6B7280",
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
        {activeTab === "analysis" && <CryptoSearch />}
        {activeTab === "signals" && <CryptoSignals />}
        {activeTab === "watchlist" && <CryptoWatchlist />}
      </div>
    </div>
  );
}
