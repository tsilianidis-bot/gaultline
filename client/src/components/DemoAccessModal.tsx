import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

interface DemoAccessModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DemoAccessModal({ open, onClose }: DemoAccessModalProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const validateToken = trpc.demo.validateToken.useMutation();

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setToken("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = token.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an access code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await validateToken.mutateAsync({ token: trimmed });
      if (result.valid) {
        onClose();
        navigate("/demo");
      } else {
        setError(result.reason ?? "Invalid access code.");
      }
    } catch {
      setError("Unable to verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(5,6,8,0.92)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8"
        style={{
          background: "rgba(10,14,20,0.98)",
          border: "1px solid rgba(0,212,255,0.2)",
          boxShadow: "0 0 60px rgba(0,212,255,0.08), 0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l14 14M16 2L2 16" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
          <span className="font-mono text-xs tracking-[0.3em] text-[#00D4FF]/70">FAULTLINE</span>
        </div>

        <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Demo Access</h2>
        <p className="text-sm text-white/40 font-mono mb-6 leading-relaxed">
          Enter your single-use access code to explore the full platform — no account required.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="text"
              value={token}
              onChange={(e) => { setToken(e.target.value.toUpperCase()); setError(""); }}
              placeholder="FL-ALPHA-1234"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl font-mono text-sm tracking-widest text-white placeholder-white/20 outline-none transition-all"
              style={{
                background: "rgba(0,212,255,0.04)",
                border: error ? "1px solid rgba(255,80,80,0.6)" : "1px solid rgba(0,212,255,0.2)",
                boxShadow: error ? "0 0 12px rgba(255,80,80,0.08)" : "none",
              }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.border = "1px solid rgba(0,212,255,0.5)";
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.border = "1px solid rgba(0,212,255,0.2)";
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="mt-2 text-xs font-mono text-red-400 tracking-wide">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full py-3.5 rounded-xl font-mono font-black text-sm tracking-widest transition-all duration-150 active:scale-[0.97]"
            style={{
              background: loading || !token.trim() ? "rgba(0,212,255,0.2)" : "#00D4FF",
              color: loading || !token.trim() ? "rgba(0,212,255,0.4)" : "#050608",
              cursor: loading || !token.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "VERIFYING..." : "ENTER PLATFORM →"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] font-mono text-white/20 tracking-wide">
          Access codes are single-use and expire immediately after use.
        </p>
      </div>
    </div>
  );
}
