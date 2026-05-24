/**
 * WaitlistSection — Public founding access / waitlist form.
 * No login required. Calls trpc.user.requestFoundingAccess (publicProcedure).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.user.requestFoundingAccess.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message ?? "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    mutation.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      message: message.trim() || undefined,
    });
  };

  return (
    <section
      id="waitlist"
      aria-label="Join the FAULTLINE Waitlist"
      style={{
        padding: "72px 24px 80px",
        borderTop: "1px solid rgba(0,212,255,0.08)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "300px",
          background:
            "radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: "560px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Label */}
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            color: "rgba(0,212,255,0.6)",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          Early Access Program
        </p>

        {/* Heading */}
        <h2
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 700,
            color: "#E2E8F0",
            textAlign: "center",
            letterSpacing: "0.04em",
            marginBottom: "12px",
            lineHeight: 1.2,
          }}
        >
          Request Founding Access
        </h2>

        {/* Subtext */}
        <p
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "13px",
            color: "rgba(148,163,184,0.75)",
            textAlign: "center",
            lineHeight: 1.7,
            marginBottom: "40px",
          }}
        >
          FAULTLINE is in private beta. Founding members receive full platform
          access, early-adopter pricing, and priority feature input. Submit your
          details to join the waitlist.
        </p>

        {submitted ? (
          /* Success state */
          <div
            style={{
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: "12px",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(0,212,255,0.12)",
                border: "1px solid rgba(0,212,255,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10l4 4 8-8"
                  stroke="rgba(0,212,255,0.9)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                color: "rgba(0,212,255,0.9)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Request Received
            </p>
            <p
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "13px",
                color: "rgba(148,163,184,0.7)",
                lineHeight: 1.6,
              }}
            >
              Your founding access request has been logged. We review
              applications manually and will be in touch at{" "}
              <strong style={{ color: "#E2E8F0" }}>{email}</strong>.
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Name */}
              <div>
                <label
                  htmlFor="wl-name"
                  style={{
                    display: "block",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    color: "rgba(148,163,184,0.5)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Full Name
                </label>
                <input
                  id="wl-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={200}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "13px",
                    color: "#E2E8F0",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
                  }
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="wl-email"
                  style={{
                    display: "block",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    color: "rgba(148,163,184,0.5)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Email Address <span style={{ color: "rgba(255,45,85,0.7)" }}>*</span>
                </label>
                <input
                  id="wl-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "13px",
                    color: "#E2E8F0",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
                  }
                />
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="wl-message"
                  style={{
                    display: "block",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    color: "rgba(148,163,184,0.5)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Why FAULTLINE? <span style={{ color: "rgba(148,163,184,0.3)" }}>(optional)</span>
                </label>
                <textarea
                  id="wl-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your use case, background, or what you're looking for..."
                  rows={3}
                  maxLength={2000}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "13px",
                    color: "#E2E8F0",
                    outline: "none",
                    transition: "border-color 0.2s",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
                  }
                />
              </div>

              {/* Error */}
              {error && (
                <p
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px",
                    color: "rgba(255,45,85,0.8)",
                    padding: "8px 12px",
                    background: "rgba(255,45,85,0.06)",
                    border: "1px solid rgba(255,45,85,0.15)",
                    borderRadius: "6px",
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={mutation.isPending || !email.trim()}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: mutation.isPending
                    ? "rgba(0,212,255,0.2)"
                    : "rgba(0,212,255,0.15)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: mutation.isPending
                    ? "rgba(0,212,255,0.3)"
                    : "rgba(0,212,255,0.4)",
                  color: mutation.isPending
                    ? "rgba(0,212,255,0.5)"
                    : "rgba(0,212,255,0.9)",
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: "14px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: mutation.isPending || !email.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s cubic-bezier(0.23,1,0.32,1)",
                  boxShadow: mutation.isPending
                    ? "none"
                    : "0 0 20px rgba(0,212,255,0.12)",
                }}
                onMouseEnter={(e) => {
                  if (!mutation.isPending && email.trim()) {
                    e.currentTarget.style.background = "rgba(0,212,255,0.22)";
                    e.currentTarget.style.boxShadow = "0 0 30px rgba(0,212,255,0.2)";
                    e.currentTarget.style.transform = "scale(1.01)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0,212,255,0.15)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(0,212,255,0.12)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {mutation.isPending ? "Submitting..." : "Request Founding Access →"}
              </button>
            </div>

            {/* Fine print */}
            <p
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: "rgba(100,116,139,0.5)",
                textAlign: "center",
                marginTop: "16px",
                letterSpacing: "0.05em",
              }}
            >
              Applications reviewed manually · No spam · Unsubscribe anytime
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
