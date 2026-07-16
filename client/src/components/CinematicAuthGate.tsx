/* ============================================================
   CinematicAuthGate
   Shown when the user presses ENTER FAULTLINE but is not yet
   authenticated. Matches the cinematic aesthetic exactly —
   dark background, same typography, no redirect, no white flash.

   Flow:
     Unauthenticated → CinematicAuthGate → OAuth sign-in
     → redirect back → auth resolves → ASHA greeting (with name)

   This component never shows a personalized greeting. It holds
   the experience in the cinematic aesthetic until identity is
   confirmed, then calls onAuthenticated() so the parent can
   proceed to AshaLiveBriefing with the real user name.
   ============================================================ */
import { useState, useEffect } from "react";
import { useAuth } from "../_core/hooks/useAuth";
import { getLoginUrl } from "../const";
import AshaOrb from "./AshaOrb";

interface CinematicAuthGateProps {
  /** Called once auth resolves and user is confirmed */
  onAuthenticated: () => void;
}

export default function CinematicAuthGate({ onAuthenticated }: CinematicAuthGateProps) {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // If auth resolves to authenticated, proceed immediately
  useEffect(() => {
    if (!loading && user) {
      setVisible(false);
      setTimeout(() => onAuthenticated(), 600);
    }
  }, [loading, user, onAuthenticated]);

  const handleSignIn = () => {
    setSigningIn(true);
    // Store a flag so after OAuth redirect we skip the cinematic
    // and go straight to ASHA greeting
    try {
      sessionStorage.setItem("fl_post_auth_asha", "1");
    } catch {}
    window.location.href = getLoginUrl();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to FAULTLINE"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, rgba(0,229,255,0.04) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Corner brackets */}
      {[
        { top: "12px", left: "12px", borderTop: "1px solid rgba(0,229,255,0.25)", borderLeft: "1px solid rgba(0,229,255,0.25)" },
        { top: "12px", right: "12px", borderTop: "1px solid rgba(0,229,255,0.25)", borderRight: "1px solid rgba(0,229,255,0.25)" },
        { bottom: "12px", left: "12px", borderBottom: "1px solid rgba(0,229,255,0.25)", borderLeft: "1px solid rgba(0,229,255,0.25)" },
        { bottom: "12px", right: "12px", borderBottom: "1px solid rgba(0,229,255,0.25)", borderRight: "1px solid rgba(0,229,255,0.25)" },
      ].map((s, i) => (
        <div key={i} aria-hidden="true" style={{
          position: "absolute", width: "24px", height: "24px", ...s, opacity: 0.5,
        }} />
      ))}

      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "28px",
        maxWidth: "420px", width: "100%",
        position: "relative",
      }}>
        {/* ASHA Orb — calm state, not personalized */}
        <AshaOrb regimeState="calm" size={56} isListening={false} />

        {/* FAULTLINE wordmark */}
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: "clamp(28px, 6vw, 48px)",
          fontWeight: 700,
          letterSpacing: "0.2em",
          background: "linear-gradient(135deg, #00E5FF, rgba(0,229,255,0.6))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>FAULTLINE</div>

        {/* Message */}
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "clamp(14px, 2vw, 16px)",
          lineHeight: 1.7,
          color: "rgba(255,255,255,0.65)",
          textAlign: "center",
        }}>
          Sign in to continue.<br />
          ASHA will greet you once your identity is confirmed.
        </div>

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={signingIn || loading}
          style={{
            background: "transparent",
            border: "1px solid rgba(0,229,255,0.5)",
            borderRadius: "4px",
            padding: "14px 48px",
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.3em",
            color: signingIn ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.9)",
            cursor: signingIn ? "default" : "pointer",
            transition: "all 0.2s ease",
            width: "100%",
          }}
          onMouseEnter={e => {
            if (!signingIn) {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.08)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.8)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.5)";
          }}
        >
          {signingIn ? "REDIRECTING…" : loading ? "CHECKING…" : "SIGN IN / SIGN UP"}
        </button>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", width: "100%",
        }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px", letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.2)",
          }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Continue without account */}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => onAuthenticated(), 600);
          }}
          style={{
            background: "transparent",
            border: "none",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.25)",
            cursor: "pointer",
            padding: "4px",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}
        >
          CONTINUE AS GUEST →
        </button>

        {/* Status line */}
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px", letterSpacing: "0.15em",
          color: "rgba(0,229,255,0.3)",
        }}>
          ASHA · FAULTLINE INTELLIGENCE LAYER
        </div>
      </div>
    </div>
  );
}
