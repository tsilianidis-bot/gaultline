import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  Clock3,
  LockKeyhole,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { navigateToLogin } from "@/const";
import { Button } from "@/components/ui/button";

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * /invite is reached only after the server has exchanged /invite/:token for an
 * HttpOnly claim cookie. No raw invitation token is read, rendered, or sent to
 * OAuth from this client route.
 */
export default function VipInviteRedeem() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activatedUntil, setActivatedUntil] = useState<Date | string | null>(
    null
  );

  const { data: claim, isLoading: claimLoading } =
    trpc.vipInvitation.claimStatus.useQuery(undefined, {
      retry: false,
      staleTime: 0,
    });
  const { data: guestAccess } = trpc.vipInvitation.myGuestAccess.useQuery(
    undefined,
    {
      enabled: Boolean(user),
      retry: false,
    }
  );
  const redeem = trpc.vipInvitation.redeem.useMutation({
    onSuccess: data => {
      setActivatedUntil(data.expiresAt);
      setResult("success");
    },
    onError: error => {
      setErrorMessage(
        error.message || "This private invitation is unavailable."
      );
      setResult("error");
    },
  });

  useEffect(() => {
    if (guestAccess?.active) setActivatedUntil(guestAccess.expiresAt);
  }, [guestAccess]);

  if (claimLoading || authLoading) {
    return (
      <main className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <p className="font-mono text-xs tracking-[0.2em] text-cyan-300/60">
          VERIFYING PRIVATE INVITATION…
        </p>
      </main>
    );
  }

  if (!claim?.available && result !== "success" && !activatedUntil) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white flex items-center justify-center px-5">
        <section className="max-w-md text-center rounded-2xl border border-slate-700/70 bg-[#0d1520] p-8 space-y-5">
          <CircleAlert className="mx-auto text-slate-400" size={36} />
          <h1 className="font-['Rajdhani'] text-3xl tracking-wide">
            INVITATION UNAVAILABLE
          </h1>
          <p className="text-sm leading-6 text-slate-400">
            This private invitation has expired, been revoked, or was already
            used.
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="border-slate-600 text-slate-200"
          >
            RETURN TO FAULTLINE
          </Button>
        </section>
      </main>
    );
  }

  if (result === "success" || activatedUntil) {
    return (
      <main className="min-h-screen bg-[#080c14] text-white flex items-center justify-center px-5 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-cyan-400/25 bg-[#0d1520] p-7 sm:p-10 text-center space-y-6">
          <CheckCircle2 className="mx-auto text-cyan-300" size={44} />
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-[0.2em] text-cyan-300">
              VIP GUEST ACCESS ACTIVE
            </p>
            <h1 className="font-['Rajdhani'] text-3xl sm:text-4xl tracking-wide">
              WELCOME TO FAULTLINE
            </h1>
          </div>
          <p className="text-sm leading-6 text-slate-300">
            Your complimentary member access is active through{" "}
            <span className="text-cyan-200">
              {activatedUntil
                ? formatDate(activatedUntil)
                : "your scheduled expiry"}
            </span>
            . No payment method was requested and no subscription was created.
          </p>
          <p className="text-xs leading-5 text-slate-500">
            Market intelligence may be delayed, stale, or unavailable. FAULTLINE
            labels evidence status where it is displayed.
          </p>
          <Button
            onClick={() => navigate("/app")}
            className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-semibold"
          >
            ENTER FAULTLINE <ArrowRight className="ml-2" size={16} />
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080c14] text-white flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-cyan-400/20 bg-[#0d1520] p-7 sm:p-10 space-y-7">
        <header className="text-center space-y-3">
          <ShieldCheck className="mx-auto text-cyan-300" size={40} />
          <p className="font-mono text-[11px] tracking-[0.2em] text-cyan-300">
            PRIVATE VIP INVITATION
          </p>
          <h1 className="font-['Rajdhani'] text-3xl sm:text-4xl tracking-wide">
            30 DAYS OF MEMBER ACCESS
          </h1>
          <p className="text-sm leading-6 text-slate-400">
            Sign in with your own email through FAULTLINE’s existing secure
            authentication flow. This invitation is personal, single-use, and
            expires if not redeemed.
          </p>
        </header>
        <div className="rounded-xl border border-slate-700/70 bg-black/15 p-4 space-y-3 text-sm text-slate-300">
          <div className="flex gap-3">
            <Clock3 className="mt-0.5 text-cyan-300 shrink-0" size={17} />
            <span>
              Access begins after redemption and ends automatically 30 days
              later.
            </span>
          </div>
          <div className="flex gap-3">
            <LockKeyhole className="mt-0.5 text-cyan-300 shrink-0" size={17} />
            <span>
              No payment method, checkout, or automatic billing is involved.
            </span>
          </div>
        </div>
        {result === "error" && (
          <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-center text-sm text-red-200">
            {errorMessage}
          </p>
        )}
        {!user ? (
          <Button
            onClick={() => navigateToLogin()}
            className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-semibold py-6"
          >
            SIGN IN TO ACTIVATE ACCESS
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-xs text-slate-500">
              Signed in as {user.email || user.name || "your account"}
            </p>
            <Button
              disabled={redeem.isPending}
              onClick={() => redeem.mutate()}
              className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-semibold py-6"
            >
              {redeem.isPending ? "ACTIVATING…" : "ACTIVATE 30-DAY ACCESS"}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
