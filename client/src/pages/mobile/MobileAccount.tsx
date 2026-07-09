/* ============================================================
   FAULTLINE Trader — Account Tab
   User profile, tier badge, usage summary, upgrade CTA,
   manage billing, logout, and app version.
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { PRICING_PLANS, TIER_META } from "../../../../shared/tiers";
import {
  User, Crown, Zap, TrendingUp, BarChart2, LogOut, ExternalLink,
  ChevronRight, RefreshCw, Shield, Star, Activity, Lock,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function tierColor(tier: string): string {
  if (tier === "founding") return "#FFD700";
  if (tier === "premium")  return "#00D4FF";
  if (tier === "core")     return "#22D3EE";
  return "#64748B";
}

function tierLabel(tier: string): string {
  if (tier === "founding") return "FOUNDING";
  if (tier === "premium")  return "POWER";
  if (tier === "core")     return "CORE"; // Core tier
  return "FREE";
}

function tierIcon(tier: string) {
  if (tier === "founding") return <Crown size={14} />;
  if (tier === "premium")  return <Zap size={14} />;
  if (tier === "core")     return <Activity size={14} />;
  return <Lock size={14} />;
}

// ── UsageBar ─────────────────────────────────────────────────
function UsageBar({
  label, used, limit, color = "#00D4FF",
}: {
  label: string;
  used: number;
  limit: number | null;
  color?: string;
}) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5">
        <span className="text-[11px] font-mono text-[#A8B8CC]">{label}</span>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>UNLIMITED</span>
      </div>
    );
  }
  const pct = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  const isExhausted = remaining === 0;
  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono text-[#A8B8CC]">{label}</span>
        <span className="text-[11px] font-mono" style={{ color: isExhausted ? "#FF2D55" : "#A8B8CC" }}>
          {used}/{limit}
        </span>
      </div>
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isExhausted ? "#FF2D55" : color,
            boxShadow: isExhausted ? "0 0 6px rgba(255,45,85,0.5)" : `0 0 6px ${color}80`,
          }}
        />
      </div>
      {isExhausted && (
        <p className="text-[9px] font-mono text-[#FF2D55] mt-1">Limit reached — resets tomorrow</p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function MobileAccount() {
  const { user, loading: authLoading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const usageQuery  = trpc.mobileUsage.getUsageSummary.useQuery(undefined, { enabled: !!user });
  const tierQuery   = trpc.user.getAccessTier.useQuery(undefined, { enabled: !!user });
  const logoutMut   = trpc.auth.logout.useMutation();
  const portalMut   = trpc.billing.createPortalSession.useMutation();

  const tier    = tierQuery.data?.tier ?? "free";
  const usage   = usageQuery.data?.usage;
  const limits  = usageQuery.data?.limits;
  const isPro   = tier === "premium" || tier === "founding";
  const isPaid  = tier === "core" || isPro;
  const color   = tierColor(tier);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutMut.mutateAsync();
    window.location.href = "/";
  };

  const handleBillingPortal = async () => {
    try {
      const { url } = await portalMut.mutateAsync({ origin: window.location.origin });
      if (url) window.open(url, "_blank");
    } catch {
      window.open("/app/account", "_blank");
    }
  };

  // ── Not signed in ─────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-[#00D4FF]/30 flex items-center justify-center mb-6">
          <User size={28} className="text-[#00D4FF]" />
        </div>
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-2">ACCOUNT</div>
        <h2 className="text-xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-[#A8B8CC] text-sm mb-8 leading-relaxed">
          Sign in to view your account, subscription, and usage.
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

  const isLoading = authLoading || usageQuery.isLoading || tierQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <RefreshCw size={20} className="text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-4 pb-8">

      {/* ── Profile card ──────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15`, border: `1px solid ${color}40` }}
          >
            <User size={22} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-white truncate">{user?.name ?? "User"}</div>
            <div className="text-[11px] font-mono text-[#64748B] truncate">{user?.email ?? ""}</div>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest flex-shrink-0"
            style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
          >
            {tierIcon(tier)}
            {tierLabel(tier)}
          </div>
        </div>

        {/* Plan name */}
        <div className="text-[10px] font-mono text-[#64748B]">
          {tier === "founding" && "Founding Member — Rate locked for life"}
          {tier === "premium"  && `FAULTLINE Power — ${PRICING_PLANS.premium.priceLabel}`}
          {tier === "core"     && `FAULTLINE Trader — ${PRICING_PLANS.core.priceLabel}`}
          {tier === "free"     && "Observer — Free access"}
        </div>
      </div>

      {/* ── Usage summary ─────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-[10px] font-mono tracking-[0.2em] text-[#64748B] mb-3">TODAY'S USAGE</div>

        <UsageBar
          label="Stock Signals"
          used={usage?.stockSignalsViewed ?? 0}
          limit={limits?.stockSignals ?? null}
          color={color}
        />
        <UsageBar
          label="Crypto Signals"
          used={usage?.cryptoSignalsViewed ?? 0}
          limit={limits?.cryptoSignals ?? null}
          color={color}
        />
        <UsageBar
          label="Signal Outlooks"
          used={usage?.signalOutlooksRun ?? 0}
          limit={limits?.signalOutlooks ?? null}
          color={color}
        />

        <div className="flex items-center justify-between py-2.5 mt-0.5">
          <span className="text-[11px] font-mono text-[#A8B8CC]">Situation Room (month)</span>
          {limits?.situationRoom === null ? (
            <span className="text-[11px] font-mono font-bold" style={{ color }}>UNLIMITED</span>
          ) : (
            <span className="text-[11px] font-mono text-[#A8B8CC]">
              {usage?.situationRoomCount ?? 0}/{limits?.situationRoom ?? 0}
            </span>
          )}
        </div>
      </div>

      {/* ── Upgrade CTA (non-pro users) ───────────────────── */}
      {!isPro && (
        <a
          href="/mobile/upgrade"
          className="block rounded-xl p-4 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(34,211,238,0.04) 100%)",
            border: "1px solid rgba(0,212,255,0.25)",
          }}
        >
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#00D4FF]/60 mb-1">
            {isPaid ? "UPGRADE TO PRO" : "UPGRADE TO CORE"}
          </div>
          <div className="text-[13px] font-bold text-white mb-1">
            {isPaid ? "Unlock unlimited access" : "Unlock the full mobile experience"}
          </div>
          <div className="text-[11px] font-mono text-[#00D4FF]">
            {isPaid
              ? `${PRICING_PLANS.premium.priceLabel} — Full intelligence suite (Power)`
              : `${PRICING_PLANS.core.priceLabel} — Signals, Crypto, Watchlist`}
          </div>
          <div className="flex items-center justify-center gap-1 mt-2 text-[10px] font-mono text-[#00D4FF]/60">
            VIEW PLANS <ChevronRight size={12} />
          </div>
        </a>
      )}

      {/* ── Actions ───────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Manage billing (paid users) */}
        {isPaid && (
          <button
            onClick={handleBillingPortal}
            disabled={portalMut.isPending}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left border-b border-white/5 active:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-[#64748B]" />
              <span className="text-[13px] text-white">Manage Subscription</span>
            </div>
            <div className="flex items-center gap-1 text-[#64748B]">
              {portalMut.isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <ExternalLink size={14} />
              )}
            </div>
          </button>
        )}

        {/* Full platform link */}
        <a
          href="/app"
          className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 active:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <BarChart2 size={16} className="text-[#64748B]" />
            <span className="text-[13px] text-white">Full Platform</span>
          </div>
          <ExternalLink size={14} className="text-[#64748B]" />
        </a>

        {/* Upgrade plans */}
        <a
          href="/mobile/upgrade"
          className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 active:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Star size={16} className="text-[#64748B]" />
            <span className="text-[13px] text-white">Plans & Pricing</span>
          </div>
          <ChevronRight size={14} className="text-[#64748B]" />
        </a>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-between px-4 py-3.5 active:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut size={16} className="text-[#FF2D55]" />
            <span className="text-[13px] text-[#FF2D55]">
              {loggingOut ? "Signing out..." : "Sign Out"}
            </span>
          </div>
        </button>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="text-center pt-2 pb-4">
        <div className="text-[9px] font-mono text-[#64748B] tracking-widest">FAULTLINE PWA</div>
        <div className="text-[9px] font-mono text-[#3A4A5C] mt-0.5">
          Subscriptions managed via web checkout
        </div>
        <div className="text-[9px] font-mono text-[#3A4A5C] mt-0.5">
          Not financial advice. For informational purposes only.
        </div>
      </div>
    </div>
  );
}
