/* ============================================================
   FAULTLINE Membership — Upgrade Tab
   Pricing cards, feature comparison, Stripe checkout,
   and Founding Member upsell.
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { PRICING_PLANS } from "../../../../shared/tiers";
import {
  Check, Zap, Crown, Activity, Lock, RefreshCw, ChevronLeft, Star,
} from "lucide-react";

// ── Plan definitions ──────────────────────────────────────────
const PLANS = [
  {
    id: "founding" as const,
    name: "Founding Member",
    badge: "FOUNDING RATE — LOCKED",
    price: PRICING_PLANS.founding.priceLabel,
    color: "#FFD700",
    glow: "rgba(255,215,0,0.12)",
    icon: <Crown size={18} />,
    features: [
      "Founding-member access to FAULTLINE",
      "Founding Member badge",
      "Locked $49 monthly rate while active",
      "Core market intelligence and monitoring",
    ],
    locked: [],
  },
  {
    id: "core" as const,
    name: "Trader",
    badge: "PRIMARY EXPERIENCE",
    price: PRICING_PLANS.core.priceLabel,
    color: "#00D4FF",
    glow: "rgba(0,212,255,0.15)",
    icon: <Activity size={18} />,
    features: [
      "Market intelligence and monitoring",
      "Signals, watch tools, and interpretation",
      "Decision support for active investors",
      "Full investor workflow",
    ],
    locked: [],
  },
  {
    id: "premium" as const,
    name: "Power",
    badge: "FULL PROFESSIONAL TOOLSET",
    price: PRICING_PLANS.premium.priceLabel,
    color: "#A78BFA",
    glow: "rgba(167,139,250,0.15)",
    icon: <Zap size={18} />,
    features: [
      "Everything in Trader",
      "Advanced analysis and research",
      "Deepest intelligence experience",
      "Full professional toolset",
    ],
    locked: [],
  },
];

// ── PlanCard ──────────────────────────────────────────────────
function PlanCard({
  plan,
  currentTier,
  onSelect,
  loading,
}: {
  plan: typeof PLANS[number];
  currentTier: string;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const isCurrent = currentTier === plan.id || (currentTier === "founding" && plan.id === "founding");
  const isDowngrade =
    (currentTier === "premium" && plan.id === "core") ||
    (currentTier === "founding" && (plan.id === "core" || plan.id === "premium"));

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{
        background: `linear-gradient(135deg, ${plan.glow} 0%, rgba(5,6,8,0.8) 100%)`,
        border: `1px solid ${plan.color}${isCurrent ? "60" : "25"}`,
        boxShadow: isCurrent ? `0 0 20px ${plan.glow}` : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: plan.color }}>{plan.icon}</span>
            <span className="text-[15px] font-bold text-white">{plan.name}</span>
            {isCurrent && (
              <span
                className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40` }}
              >
                CURRENT
              </span>
            )}
          </div>
          <div
            className="text-[9px] font-mono tracking-[0.2em]"
            style={{ color: `${plan.color}80` }}
          >
            {plan.badge}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-bold text-white">{plan.price}</div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-1.5 mb-4">
        {plan.features.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <Check size={12} style={{ color: plan.color, flexShrink: 0 }} />
            <span className="text-[11px] text-[#A8B8CC]">{f}</span>
          </div>
        ))}
        {plan.locked.map((f) => (
          <div key={f} className="flex items-center gap-2 opacity-40">
            <Lock size={12} className="text-[#64748B] flex-shrink-0" />
            <span className="text-[11px] text-[#64748B]">{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {isCurrent ? (
        <div
          className="w-full py-2.5 text-center text-[11px] font-mono font-bold tracking-widest rounded-lg"
          style={{ background: `${plan.color}10`, border: `1px solid ${plan.color}30`, color: plan.color }}
        >
          ACTIVE PLAN
        </div>
      ) : isDowngrade ? (
        <div className="text-[9px] font-mono text-[#64748B] text-center py-2">
          Manage via billing portal to downgrade
        </div>
      ) : (
        <button
          onClick={() => onSelect(plan.id)}
          disabled={loading}
          className="w-full py-2.5 text-center text-[11px] font-mono font-bold tracking-widest rounded-lg transition-all active:scale-95"
          style={{
            background: plan.color,
            color: "#050608",
            boxShadow: `0 0 16px ${plan.glow}`,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <RefreshCw size={14} className="inline animate-spin" />
          ) : (
            `GET ${plan.name.toUpperCase()} — ${plan.price}`
          )}
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function MobileUpgrade() {
  const { user, loading: authLoading } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, { enabled: !!user });

  const tier = tierQuery.data?.tier ?? "free";

  const handleSelect = (planId: string) => {
    const name = PLANS.find((plan) => plan.id === planId)?.name ?? "Selected membership";
    alert(`${name} is displayed at its current public rate. Checkout will remain unavailable until its Stripe price configuration is independently verified.`);
  };

  if (authLoading || tierQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <RefreshCw size={20} className="text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 pb-8">

      {/* Header */}
      <div className="mb-5">
        <a href="/mobile/account" className="flex items-center gap-1 text-[#64748B] text-[11px] font-mono mb-4">
          <ChevronLeft size={14} /> BACK
        </a>
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-1">FAULTLINE PLANS</div>
        <h1 className="text-[20px] font-bold text-white mb-1">Upgrade Your Intelligence</h1>
        <p className="text-[12px] text-[#64748B] leading-relaxed">
          Choose the level of intelligence you need. Checkout activates only after the displayed Stripe price is independently verified.
        </p>
      </div>

      {/* Plan cards */}
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          currentTier={tier}
          onSelect={handleSelect}
          loading={loadingPlan === plan.id}
        />
      ))}

      {/* Disclaimer */}
      <div
        className="rounded-xl p-4 mt-2"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-start gap-2">
          <Star size={12} className="text-[#64748B] flex-shrink-0 mt-0.5" />
          <div className="text-[10px] font-mono text-[#64748B] leading-relaxed">
            Founding Member, Trader, and Power are monthly memberships. Existing subscriptions remain managed through the billing portal.
            Payments are processed securely by Stripe only after a matching price configuration is verified. FAULTLINE is not a registered investment
            adviser. All content is for informational purposes only.
          </div>
        </div>
      </div>
    </div>
  );
}
