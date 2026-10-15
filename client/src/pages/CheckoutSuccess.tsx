/**
 * FAULTLINE — Checkout Success Page
 * ============================================================
 * Reached after a successful Stripe checkout.
 * URL: /checkout/success?session_id=cs_...&plan=core
 *
 * 1. Reads session_id and plan from the URL.
 * 2. Signed in: calls billing.verifyCheckoutSession (owner-only) to confirm payment.
 *    Signed out: shows "Sign in to verify your access" and NO payment status — the session
 *    lookup is protected, and being signed out is not a payment failure. The sign-in link
 *    remembers this URL so the app returns here after sign-in.
 * 3. Fires the GA4 `purchase` event exactly once.
 * 4. Shows a confirmation UI and redirects to /app/account.
 * ============================================================
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { trackPurchaseConfirmed } from "@/hooks/useAnalytics";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { POST_LOGIN_RETURN_KEY, encodeReturnPath } from "@shared/checkoutReturn";

const PLAN_LABELS: Record<string, string> = {
  core: "FAULTLINE Core",
  core_annual: "FAULTLINE Core (Annual)",
  premium: "FAULTLINE Trader",
  premium_annual: "FAULTLINE Trader (Annual)",
  founding: "FAULTLINE Founding Member",
  lifetime: "FAULTLINE Founding Lifetime",
};

export default function CheckoutSuccess() {
  const [, navigate] = useLocation();
  const purchaseFired = useRef(false);

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") ?? "";
  const planFromUrl = params.get("plan") ?? "";

  const { user, loading: authLoading, offline } = useAuth();
  const signedOut = !authLoading && !user && !offline;

  // Signed in on this page already: any remembered return destination has served its purpose.
  useEffect(() => {
    if (!user) return;
    try { localStorage.removeItem(POST_LOGIN_RETURN_KEY); } catch {}
  }, [user]);

  // Verify the session with Stripe via tRPC — only for a signed-in visitor (the lookup is owner-only;
  // firing it signed-out would just trigger the global "redirect to login" handler and lose this page).
  const { data, isLoading: queryLoading, isError } = trpc.billing.verifyCheckoutSession.useQuery(
    { sessionId },
    {
      enabled: Boolean(sessionId) && Boolean(user),
      retry: 2,
      staleTime: Infinity,
    }
  );

  // Fire purchase event once when payment is confirmed
  useEffect(() => {
    if (purchaseFired.current) return;
    if (!data) return;
    if (data.paymentStatus !== "paid") return;

    purchaseFired.current = true;
    const plan = data.planId ?? planFromUrl;
    const value = data.amountTotal ? data.amountTotal / 100 : 0;

    trackPurchaseConfirmed({
      transactionId: sessionId,
      value,
      currency: (data.currency ?? "usd").toUpperCase(),
      plan,
    });
  }, [data, sessionId, planFromUrl]);

  // Auto-redirect to account after 5 seconds on success
  useEffect(() => {
    if (!data || data.paymentStatus !== "paid") return;
    const timer = setTimeout(() => navigate("/app/account"), 5000);
    return () => clearTimeout(timer);
  }, [data, navigate]);

  const isLoading = authLoading || (Boolean(user) && Boolean(sessionId) && queryLoading);

  const rememberReturnDestination = () => {
    try {
      const entry = encodeReturnPath(`${window.location.pathname}${window.location.search}`);
      if (entry) localStorage.setItem(POST_LOGIN_RETURN_KEY, entry);
    } catch {
      /* storage unavailable — sign-in still works, the visitor just lands on /app */
    }
  };
  // Where "Sign in" goes. Empty when OAuth is not configured (staging) — fall back to the account page's own gate.
  const signInHref = getLoginUrl() || "/app/account";

  const planLabel = PLAN_LABELS[data?.planId ?? planFromUrl] ?? "FAULTLINE";

  return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {isLoading && (
          <div className="space-y-4">
            <div className="w-12 h-12 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin mx-auto" />
            <p className="text-[#A8B8CC] font-mono text-sm tracking-widest">CONFIRMING PAYMENT…</p>
          </div>
        )}

        {signedOut && (
          <div className="space-y-6" data-testid="checkout-signed-out">
            <div className="w-16 h-16 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Sign in to verify your access</h1>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">
                Sign in with the account you used at checkout and we'll confirm your plan. Being signed out doesn't affect your purchase.
              </p>
            </div>
            <a
              href={signInHref}
              onClick={rememberReturnDestination}
              data-testid="checkout-sign-in-link"
              className="inline-block px-6 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-[#050608] font-mono font-bold text-sm tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97]"
            >
              SIGN IN →
            </a>
          </div>
        )}

        {!signedOut && !isLoading && (isError || !data) && (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Verification Failed</h1>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">
                We couldn't verify your payment. If you were charged, please{" "}
                <a href="mailto:jt@getfaultline.live" className="text-[#00D4FF] hover:underline">contact support</a>.
              </p>
            </div>
            <button
              onClick={() => navigate("/app/account")}
              className="px-6 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-[#050608] font-mono font-bold text-sm tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97]"
            >
              GO TO ACCOUNT →
            </button>
          </div>
        )}

        {!signedOut && !isLoading && data && data.paymentStatus === "paid" && (
          <div className="space-y-6">
            {/* Success icon */}
            <div className="w-16 h-16 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Confirmation text */}
            <div>
              <div className="inline-block text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 border border-[#00D4FF]/20 px-4 py-1.5 rounded-full mb-4">
                PAYMENT CONFIRMED
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Welcome to {planLabel}
              </h1>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">
                Your access has been activated. You'll be redirected to your account in a moment.
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate("/app/account")}
              className="w-full px-6 py-4 bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-[#050608] font-mono font-black text-sm tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97]"
            >
              ENTER FAULTLINE →
            </button>

            <p className="text-[#A8B8CC]/40 text-xs font-mono">
              Redirecting automatically in 5 seconds…
            </p>
          </div>
        )}

        {!signedOut && !isLoading && data && data.paymentStatus !== "paid" && (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Payment Pending</h1>
              <p className="text-[#A8B8CC] text-sm leading-relaxed">
                Your payment is being processed. Check your account in a few minutes.
              </p>
            </div>
            <button
              onClick={() => navigate("/app/account")}
              className="px-6 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-[#050608] font-mono font-bold text-sm tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97]"
            >
              GO TO ACCOUNT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
