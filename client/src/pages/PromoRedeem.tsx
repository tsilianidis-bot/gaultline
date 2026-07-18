/**
 * PromoRedeem — /promo/:code
 *
 * Public landing page for promotional campaigns (e.g. FACEBOOK30).
 * Handles: code validation → login gate → redemption → success.
 *
 * Design principles:
 * - Never shows redemption count, remaining slots, or cap.
 * - Expired/exhausted code shows only "This promotional offer has ended."
 * - No payment method required messaging is prominent.
 * - Requires login before redemption (Manus OAuth).
 */
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RedeemState = "loading" | "valid" | "invalid" | "already_redeemed" | "redeeming" | "success" | "error";

export default function PromoRedeem() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<RedeemState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{ trialExpiresAt: string; trialDays: number } | null>(null);

  const upperCode = (code ?? "").toUpperCase();

  // 1. Validate the code
  const { data: validation, isLoading: validating } = trpc.promo.validateCode.useQuery(
    { code: upperCode },
    { enabled: !!upperCode, retry: false }
  );

  // 2. Check if user already redeemed
  const { data: myRedemption } = trpc.promo.myRedemption.useQuery(undefined, {
    enabled: !!user,
  });

  // 3. Redeem mutation
  const redeemMutation = trpc.promo.redeemCode.useMutation({
    onSuccess: (data) => {
      setSuccessData({ trialExpiresAt: data.trialExpiresAt, trialDays: data.trialDays });
      setState("success");
    },
    onError: (err) => {
      if (err.message.includes("already redeemed") || err.message.includes("already been used")) {
        setState("already_redeemed");
      } else if (err.message.includes("ended")) {
        setState("invalid");
      } else {
        setErrorMsg(err.message);
        setState("error");
      }
    },
  });

  // Determine state based on validation + auth
  useEffect(() => {
    if (validating || authLoading) return;
    if (!validation) return;

    if (!validation.valid) {
      setState("invalid");
      return;
    }

    if (user && myRedemption) {
      setState("already_redeemed");
      return;
    }

    if (state !== "already_redeemed" && state !== "success") {
      setState("valid");
    }
  }, [validation, validating, authLoading, myRedemption]);

  const handleRedeem = () => {
    if (!user) {
      // Redirect to login, return here after
      // Store return path and redirect to login
      sessionStorage.setItem("promoReturnCode", upperCode);
      window.location.href = getLoginUrl();
      return;
    }
    setState("redeeming");
    redeemMutation.mutate({ code: upperCode });
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ── Render ────────────────────────────────────────────────────

  if (state === "loading" || validating || authLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-[#8899aa] text-sm font-mono tracking-widest">VERIFYING OFFER</p>
        </div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-light text-white tracking-wide mb-2">Offer Unavailable</h1>
            <p className="text-[#8899aa] leading-relaxed">This promotional offer has ended.</p>
          </div>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="border-[#1e3a5f] text-cyan-400 hover:bg-[#0d1f35]"
          >
            Visit FAULTLINE
          </Button>
        </div>
      </div>
    );
  }

  if (state === "already_redeemed") {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-light text-white tracking-wide mb-2">Already Active</h1>
            <p className="text-[#8899aa] leading-relaxed">
              You have already redeemed this promotional offer. Your trial access is active.
            </p>
            {myRedemption?.trialExpiresAt && (
              <p className="text-cyan-400/70 text-sm mt-2">
                Trial expires: {formatDate(myRedemption.trialExpiresAt.toString())}
              </p>
            )}
          </div>
          <Button
            onClick={() => navigate("/dashboard")}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
          >
            Open FAULTLINE
          </Button>
        </div>
      </div>
    );
  }

  if (state === "success" && successData) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center space-y-8">
          {/* Success icon */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="relative w-20 h-20 rounded-full border border-cyan-400/40 bg-cyan-400/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="space-y-3">
            <Badge className="bg-cyan-400/10 text-cyan-400 border-cyan-400/20 text-xs tracking-widest font-mono">
              ACCESS ACTIVATED
            </Badge>
            <h1 className="text-3xl font-light text-white tracking-wide">Welcome to FAULTLINE</h1>
            <p className="text-[#8899aa] leading-relaxed">
              Your {successData.trialDays}-day premium trial is now active. You have full access to the
              intelligence platform — no credit card, no automatic billing.
            </p>
            <p className="text-cyan-400/70 text-sm">
              Trial expires: {formatDate(successData.trialExpiresAt)}
            </p>
          </div>

          {/* What you get */}
          <div className="bg-[#0d1520] border border-[#1e3a5f]/50 rounded-xl p-6 text-left space-y-3">
            <p className="text-xs text-[#8899aa] font-mono tracking-widest uppercase mb-4">Your Access Includes</p>
            {[
              "Pressure Index™ — Real-time systemic risk scoring",
              "ASHA Intelligence Engine — Ask anything about the markets",
              "Signals Screener — Institutional-grade stock and crypto signals",
              "Situation Room — Macro stress simulation",
              "Market Seismograph — Structural fault detection",
              "Historical Analogs — Pattern matching across 25 years",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                <span className="text-sm text-[#aabbcc]">{item}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold py-3 text-base"
            >
              Enter FAULTLINE
            </Button>
            <p className="text-xs text-[#556677]">
              No credit card required. Trial expires automatically — no charges ever.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main redemption page (state === "valid" or "redeeming" or "error") ──
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-10">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono text-cyan-400/70 tracking-widest uppercase">Limited Offer</span>
          </div>
          <h1 className="text-4xl font-light text-white tracking-wide leading-tight">
            Free 30-Day<br />
            <span className="text-cyan-400">FAULTLINE Access</span>
          </h1>
          <p className="text-[#8899aa] leading-relaxed max-w-sm mx-auto">
            Full premium access to the macroeconomic intelligence platform.
            No credit card. No automatic billing. Trial expires automatically.
          </p>
        </div>

        {/* Promo code badge */}
        <div className="flex justify-center">
          <div className="bg-[#0d1520] border border-cyan-400/20 rounded-xl px-8 py-5 text-center">
            <p className="text-xs text-[#8899aa] font-mono tracking-widest uppercase mb-2">Promo Code</p>
            <p className="text-3xl font-mono font-bold text-cyan-400 tracking-widest">{upperCode}</p>
          </div>
        </div>

        {/* What you get */}
        <div className="bg-[#0d1520] border border-[#1e3a5f]/50 rounded-xl p-6 space-y-3">
          <p className="text-xs text-[#8899aa] font-mono tracking-widest uppercase mb-4">30 Days of Full Access</p>
          {[
            ["Pressure Index™", "Real-time systemic risk scoring across 6 macro vectors"],
            ["ASHA Intelligence", "Ask any market question — get an institutional-grade briefing"],
            ["Signals Screener", "Stock and crypto signals with regime-aware context"],
            ["Situation Room", "Macro stress simulation and portfolio scenario analysis"],
            ["Market Seismograph", "Structural fault detection before markets move"],
            ["Historical Analogs", "Pattern matching across 25 years of macro history"],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              <div>
                <span className="text-sm text-white font-medium">{title}</span>
                <span className="text-sm text-[#8899aa]"> — {desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-4">
          {state === "error" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 text-center">
              {errorMsg || "Something went wrong. Please try again."}
            </div>
          )}

          {!user ? (
            <div className="space-y-3">
              <Button
                onClick={handleRedeem}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold py-4 text-base"
              >
                Create Account & Activate Free Trial
              </Button>
              <p className="text-xs text-[#556677] text-center">
                You'll be asked to create a free account, then your 30-day trial activates instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleRedeem}
                disabled={state === "redeeming"}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold py-4 text-base disabled:opacity-60"
              >
                {state === "redeeming" ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Activating Trial...
                  </span>
                ) : (
                  "Activate Free 30-Day Trial"
                )}
              </Button>
              <p className="text-xs text-[#556677] text-center">
                Signed in as <span className="text-[#8899aa]">{user.email || user.name}</span>
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 pt-2">
            {["No credit card", "No auto-billing", "Cancel anytime"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-cyan-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs text-[#556677]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#445566]">
          getfaultline.live — Macroeconomic Risk Intelligence
        </p>
      </div>
    </div>
  );
}
