/**
 * FaultlineTerm — Inline clickable proprietary term with popover tooltip.
 *
 * Usage:
 *   <FaultlineTerm id="sob" />
 *   <FaultlineTerm id="regime-shift">Regime Shift</FaultlineTerm>
 *   <FaultlineTerm id="building-pressure" variant="badge" />
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { getGlossaryTerm, type GlossaryTerm } from "../../../shared/faultlineGlossary";
import { ExternalLink, Info, X } from "lucide-react";
import { useLocation } from "wouter";

interface FaultlineTermProps {
  id: string;
  children?: React.ReactNode;
  /** "inline" = underlined text | "badge" = pill badge | "icon" = just an info icon */
  variant?: "inline" | "badge" | "icon";
  className?: string;
}

const CATEGORY_COLORS: Record<GlossaryTerm["category"], string> = {
  method:   "#00D4FF",
  regime:   "#F59E0B",
  pressure: "#FF2D55",
  signal:   "#00FF88",
  risk:     "#FF8C00",
};

export default function FaultlineTerm({ id, children, variant = "inline", className }: FaultlineTermProps) {
  const term = getGlossaryTerm(id);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [, navigate] = useLocation();

  // Position popover relative to trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const popW = 340;
    let left = rect.left + scrollX;
    if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + scrollY + 8, left });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!term) {
    // Fallback: just render children or id
    return <span className={className}>{children ?? id}</span>;
  }

  const color = CATEGORY_COLORS[term.category];
  const label = children ?? (term.badge ?? term.term);

  const trigger = (
    <button
      ref={triggerRef}
      onClick={() => setOpen(o => !o)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        verticalAlign: "baseline",
      }}
      aria-label={`Learn about ${term.term}`}
    >
      {variant === "badge" ? (
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          color,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          borderRadius: "3px",
          padding: "2px 7px",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          transition: "background 0.15s",
        }}>
          {label}
        </span>
      ) : variant === "icon" ? (
        <Info size={12} style={{ color, opacity: 0.7 }} />
      ) : (
        <span style={{
          fontFamily: "inherit",
          fontSize: "inherit",
          color,
          borderBottom: `1px dashed ${color}60`,
          paddingBottom: "1px",
          transition: "border-color 0.15s",
        }}>
          {label}
        </span>
      )}
    </button>
  );

  const popover = open ? createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        width: "340px",
        zIndex: 9999,
        background: "#0A0E1A",
        border: `1px solid ${color}40`,
        borderRadius: "8px",
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${color}20`,
        overflow: "hidden",
        animation: "fl-fade-in 0.15s ease",
      }}
    >
      {/* Header */}
      <div style={{
        background: `${color}12`,
        borderBottom: `1px solid ${color}25`,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color, letterSpacing: "0.05em" }}>
            {term.term}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "2px" }}>
            FAULTLINE Method™ · {term.category}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4B5563", padding: "2px", flexShrink: 0 }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Row label="What it means" value={term.definition} color={color} />
        <Row label="Why it matters" value={term.whyItMatters} color={color} />
        <Row label="What triggered it" value={term.triggeredBy} color={color} />
        <Row label="What to watch next" value={term.watchNext} color={color} />
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid rgba(255,255,255,0.04)`,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {term.relatedTerms && term.relatedTerms.length > 0 && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {term.relatedTerms.slice(0, 3).map(rid => {
              const rel = getGlossaryTerm(rid);
              if (!rel) return null;
              return (
                <button
                  key={rid}
                  onClick={() => { setOpen(false); navigate("/app/glossary"); }}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                    color: "#4B5563", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)", borderRadius: "2px",
                    padding: "2px 5px", cursor: "pointer",
                  }}
                >
                  {rel.term}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={() => { setOpen(false); navigate("/app/glossary"); }}
          style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: color,
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "3px", marginLeft: "auto",
          }}
        >
          Full Glossary <ExternalLink size={9} />
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {trigger}
      {popover}
    </>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF", lineHeight: 1.6 }}>
        {value}
      </div>
    </div>
  );
}
