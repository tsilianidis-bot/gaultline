/* ============================================================
   FAULTLINE — Mobile Layout
   Bottom nav shell for the Core PWA experience.
   6 tabs: Pulse / Signals / Crypto / Watchlist / Rotation / Account
   ============================================================ */
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, TrendingUp, Star, RotateCcw, LogIn, Share, X,
  Bitcoin, User,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { PRICING_PLANS } from "../../../shared/tiers";

// ── iOS Add-to-Home-Screen banner ─────────────────────────────
function iOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIOS && isSafari && !isStandalone;
}

function A2HSBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const dismissed = sessionStorage.getItem("faultline_a2hs_dismissed");
    if (!dismissed && iOSSafari()) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
      style={{ background: "rgba(0,212,255,0.08)", borderBottom: "1px solid rgba(0,212,255,0.15)" }}
    >
      <Share size={16} className="text-[#00D4FF] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono font-bold text-white">Install FAULTLINE</div>
        <div className="text-[9px] font-mono text-[#64748B] leading-tight">
          Tap <span className="text-[#00D4FF]">Share</span> then <span className="text-[#00D4FF]">Add to Home Screen</span>
        </div>
      </div>
      <button
        onClick={() => { sessionStorage.setItem("faultline_a2hs_dismissed", "1"); setVisible(false); }}
        className="p-1 text-[#64748B] flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Nav items (6 tabs) ────────────────────────────────────────
const NAV_ITEMS = [
  { path: "/mobile",           label: "Pulse",    Icon: Activity },
  { path: "/mobile/signals",   label: "Signals",  Icon: TrendingUp },
  { path: "/mobile/crypto",    label: "Crypto",   Icon: Bitcoin },
  { path: "/mobile/rotation",  label: "Rotation", Icon: RotateCcw },
  { path: "/mobile/watchlist", label: "Watch",    Icon: Star },
  { path: "/mobile/account",   label: "Account",  Icon: User },
];

// ── Upgrade gate for free-tier users ─────────────────────────
function CoreGate() {
  const { user, loading } = useAuth();
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  if (loading || tierQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050608]">
        <div className="w-8 h-8 rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF] animate-spin" />
      </div>
    );
  }

  const tier = tierQuery.data?.tier ?? "free";
  const hasAccess = tier === "core" || tier === "premium" || tier === "founding";

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050608] px-6 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-[#00D4FF]/30 flex items-center justify-center mb-6">
          <LogIn size={28} className="text-[#00D4FF]" />
        </div>
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-2">FAULTLINE CORE</div>
        <h2 className="text-xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-[#A8B8CC] text-sm mb-8 leading-relaxed">
          Access the FAULTLINE Core mobile experience. Sign in to continue.
        </p>
        <a
          href={getLoginUrl()}
          className="w-full max-w-xs py-3 text-center font-mono font-bold text-sm tracking-widest rounded-lg bg-[#00D4FF] text-[#050608]"
          style={{ boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}
        >
          SIGN IN
        </a>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050608] px-6 text-center">
        <div
          className="w-16 h-16 rounded-full border-2 border-[#22D3EE]/30 flex items-center justify-center mb-6"
          style={{ boxShadow: "0 0 30px rgba(34,211,238,0.1)" }}
        >
          <Activity size={28} className="text-[#22D3EE]" />
        </div>
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#22D3EE]/60 mb-2">CORE ACCESS REQUIRED</div>
        <h2 className="text-xl font-bold text-white mb-3">Upgrade to Core</h2>
        <p className="text-[#A8B8CC] text-sm mb-2 leading-relaxed">
          The FAULTLINE Core mobile app requires a Core subscription.
        </p>
        <p className="text-[#22D3EE] text-sm font-mono font-bold mb-8">{PRICING_PLANS.core.priceLabel}</p>
        <div className="w-full max-w-xs space-y-3">
          <a
            href="/mobile/upgrade"
            className="block w-full py-3 text-center font-mono font-bold text-sm tracking-widest rounded-lg"
            style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", color: "#22D3EE" }}
          >
            VIEW PLANS
          </a>
          <a
            href="/app"
            className="block w-full py-3 text-center font-mono text-xs tracking-widest rounded-lg text-[#64748B]"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            BACK TO FULL PLATFORM
          </a>
        </div>
      </div>
    );
  }

  return null; // has access — render children
}

// ── Mobile Layout ─────────────────────────────────────────────
interface MobileLayoutProps {
  children: ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const tier = tierQuery.data?.tier ?? "free";
  const hasAccess = !!user && (tier === "core" || tier === "premium" || tier === "founding");

  // Account tab is always accessible (sign-in prompt shown inside)
  const isAccountTab = location === "/mobile/account" || location === "/mobile/upgrade";

  // Show gate if no access (except on account/upgrade pages)
  const gateContent = !loading && !tierQuery.isLoading && !hasAccess && !isAccountTab;

  return (
    <div
      className="flex flex-col bg-[#050608] text-white"
      style={{
        height: "100dvh",
        maxWidth: "480px",
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* iOS Add-to-Home-Screen banner */}
      <A2HSBanner />

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          background: "rgba(5,6,8,0.95)",
          borderBottom: "1px solid rgba(0,212,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border border-[#00D4FF]/40 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#00D4FF]" style={{ boxShadow: "0 0 6px #00D4FF" }} />
          </div>
          <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-white">FAULTLINE</span>
          <span className="text-[9px] font-mono tracking-widest text-[#22D3EE] bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.25)] px-1.5 py-0.5 rounded-full">
            CORE
          </span>
        </div>
        <a href="/app" className="text-[9px] font-mono tracking-widest text-[#64748B] hover:text-[#A8B8CC] transition-colors">
          FULL PLATFORM →
        </a>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: "touch" }}>
        {gateContent ? <CoreGate /> : children}
      </div>

      {/* Bottom nav — 6 tabs */}
      <div
        className="flex-shrink-0 flex items-stretch"
        style={{
          background: "rgba(5,6,8,0.97)",
          borderTop: "1px solid rgba(0,212,255,0.08)",
          backdropFilter: "blur(16px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = path === "/mobile"
            ? location === "/mobile"
            : location.startsWith(path);
          return (
            <Link key={path} href={path} className="flex-1">
              <div
                className="flex flex-col items-center justify-center py-2 gap-0.5 transition-all duration-200"
                style={{ opacity: isActive ? 1 : 0.45 }}
              >
                <div
                  className="relative"
                  style={{
                    color: isActive ? "#00D4FF" : "#64748B",
                    filter: isActive ? "drop-shadow(0 0 6px rgba(0,212,255,0.6))" : "none",
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  {isActive && (
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: "#00D4FF", boxShadow: "0 0 6px #00D4FF" }}
                    />
                  )}
                </div>
                <span
                  className="text-[8px] font-mono tracking-wider"
                  style={{ color: isActive ? "#00D4FF" : "#64748B" }}
                >
                  {label.toUpperCase()}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
