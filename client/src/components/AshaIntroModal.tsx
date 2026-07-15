/* ============================================================
   ASHA — First-Login Introduction Modal
   Appears once on first login. Stored in localStorage.
   Elegant, cinematic, not theatrical.
   ============================================================ */
import { useState, useEffect, useRef } from "react";
import AshaOrb from "./AshaOrb";

const STORAGE_KEY = "faultline_asha_intro_seen_v1";

const INTRO_LINES = [
  "I am ASHA, the Spirit of FAULTLINE.",
  "I observe the forces moving beneath the market's surface, connect the signals others view separately, and translate them into clarity.",
  "I will show you what is happening, why it is happening, how long it has been building, and what the evidence suggests may happen next.",
  "I do not offer certainty. I reveal pressure, probability, history, and change.",
  "Let me show you what is building beneath the surface.",
];

interface AshaIntroModalProps {
  onDismiss?: () => void;
}

export default function AshaIntroModal({ onDismiss }: AshaIntroModalProps) {
  const [visible, setVisible] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [done, setDone] = useState(false);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Small delay so the app loads first
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!visible || done) return;
    if (lineIndex >= INTRO_LINES.length) {
      setDone(true);
      return;
    }

    const line = INTRO_LINES[lineIndex];
    if (charIndex < line.length) {
      typingRef.current = setTimeout(() => {
        setCurrentLine(prev => prev + line[charIndex]);
        setCharIndex(c => c + 1);
      }, 28);
    } else {
      // Line complete — pause then move to next
      lineRef.current = setTimeout(() => {
        setDisplayedLines(prev => [...prev, line]);
        setCurrentLine("");
        setCharIndex(0);
        setLineIndex(l => l + 1);
      }, 600);
    }

    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
      if (lineRef.current) clearTimeout(lineRef.current);
    };
  }, [visible, lineIndex, charIndex, done]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(12px)",
        animation: "asha-fade-in 0.6s cubic-bezier(0.23,1,0.32,1) both",
      }}
      onClick={done ? handleDismiss : undefined}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "90%",
          padding: "40px 36px",
          background: "rgba(6,10,20,0.95)",
          border: "1px solid rgba(0,212,255,0.18)",
          borderRadius: "12px",
          boxShadow: "0 0 80px rgba(0,212,255,0.08), 0 32px 64px rgba(0,0,0,0.6)",
          position: "relative",
          animation: "asha-modal-rise 0.7s cubic-bezier(0.23,1,0.32,1) 0.2s both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
          <AshaOrb regimeState="calm" size={52} />
          <div>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "22px",
              color: "#00D4FF",
              letterSpacing: "0.05em",
              lineHeight: 1,
              marginBottom: "4px",
            }}>ASHA</div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px",
              letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
            }}>The Spirit of FAULTLINE</div>
          </div>
        </div>

        {/* Typewriter text */}
        <div style={{ minHeight: "160px" }}>
          {displayedLines.map((line, i) => (
            <p
              key={i}
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "14px",
                lineHeight: 1.65,
                color: i === displayedLines.length - 1 && !currentLine ? "#E2E8F0" : "rgba(148,163,184,0.7)",
                marginBottom: "10px",
                transition: "color 0.4s ease",
              }}
            >
              {line}
            </p>
          ))}
          {currentLine && (
            <p style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "14px",
              lineHeight: 1.65,
              color: "#E2E8F0",
              marginBottom: "10px",
            }}>
              {currentLine}
              <span style={{
                display: "inline-block",
                width: "2px",
                height: "14px",
                background: "#00D4FF",
                marginLeft: "2px",
                verticalAlign: "text-bottom",
                animation: "asha-cursor-blink 0.8s step-end infinite",
              }} />
            </p>
          )}
        </div>

        {/* CTA */}
        {done && (
          <div style={{ marginTop: "24px", animation: "asha-fade-in 0.5s ease both" }}>
            <button
              onClick={handleDismiss}
              style={{
                width: "100%",
                padding: "12px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: "6px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "#00D4FF",
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.15)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.5)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.3)";
              }}
            >
              Enter FAULTLINE
            </button>
            <p style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px",
              color: "rgba(100,116,139,0.4)",
              textAlign: "center",
              marginTop: "10px",
              letterSpacing: "0.1em",
            }}>
              This introduction will not appear again
            </p>
          </div>
        )}

        {/* Skip */}
        {!done && (
          <button
            onClick={handleDismiss}
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              background: "transparent",
              border: "none",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px",
              letterSpacing: "0.12em",
              color: "rgba(100,116,139,0.4)",
              cursor: "pointer",
              textTransform: "uppercase",
              padding: "4px 8px",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,0.4)"; }}
          >
            Skip
          </button>
        )}
      </div>

      <style>{`
        @keyframes asha-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes asha-modal-rise {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes asha-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
