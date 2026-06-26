/**
 * FAULTLINE Method™ Glossary
 * Searchable reference for all proprietary platform terminology.
 */
import { useState, useMemo } from "react";
import { Search, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryTerm } from "../../../shared/faultlineGlossary";
import { useSEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";

const CATEGORY_COLORS: Record<GlossaryTerm["category"], string> = {
  method:   "#00D4FF",
  regime:   "#F59E0B",
  pressure: "#FF2D55",
  signal:   "#00FF88",
  risk:     "#FF8C00",
};

function TermCard({ term }: { term: GlossaryTerm }) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[term.category];

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${expanded ? color + "40" : "rgba(255,255,255,0.05)"}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "6px",
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              fontWeight: 700,
              color,
            }}>
              {term.term}
            </span>
            {term.badge && term.badge !== term.term && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: "#4B5563",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "2px",
                padding: "1px 5px",
              }}>
                {term.badge}
              </span>
            )}
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              color: color + "80",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              background: color + "10",
              border: `1px solid ${color}20`,
              borderRadius: "2px",
              padding: "1px 5px",
            }}>
              {term.category}
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            color: "#6B7280",
            lineHeight: 1.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: expanded ? "normal" : "nowrap",
          }}>
            {term.definition}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {expanded
            ? <ChevronUp size={14} style={{ color: "#4B5563" }} />
            : <ChevronDown size={14} style={{ color: "#4B5563" }} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.04)", marginBottom: "2px" }} />

          <Row label="What it means" value={term.definition} color={color} />
          <Row label="Why it matters" value={term.whyItMatters} color={color} />
          <Row label="What triggered it" value={term.triggeredBy} color={color} />
          <Row label="What to watch next" value={term.watchNext} color={color} />

          {term.relatedTerms && term.relatedTerms.length > 0 && (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>
                Related Terms
              </div>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {term.relatedTerms.map(rid => {
                  const rel = GLOSSARY.find(t => t.id === rid);
                  if (!rel) return null;
                  const relColor = CATEGORY_COLORS[rel.category];
                  return (
                    <span key={rid} style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "10px",
                      color: relColor,
                      background: relColor + "10",
                      border: `1px solid ${relColor}30`,
                      borderRadius: "3px",
                      padding: "2px 7px",
                    }}>
                      {rel.term}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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

export default function Glossary() {
  useSEO({
    title: "FAULTLINE Method™ Glossary — Proprietary Market Terminology",
    description: "Complete reference for all FAULTLINE Method™ proprietary terms: S.O.B.™ Signals of Breakdown, Regime Shift, Changing Tide, Building Pressure, and more.",
  });

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryTerm["category"] | "all">("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return GLOSSARY.filter(term => {
      const matchesCategory = activeCategory === "all" || term.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        term.term.toLowerCase().includes(q) ||
        term.definition.toLowerCase().includes(q) ||
        term.whyItMatters.toLowerCase().includes(q) ||
        (term.badge ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  return (
    <div style={{ minHeight: "100vh", background: "#080B12", color: "#F0F4FF" }}>
      <PageHeader
        title="FAULTLINE Method™ Glossary"
        subtitle="Proprietary market terminology — click any term to expand"
      />

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px 16px" }}>

        {/* Intro */}
        <div style={{
          background: "rgba(0,212,255,0.04)",
          border: "1px solid rgba(0,212,255,0.15)",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <BookOpen size={14} style={{ color: "#00D4FF" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#00D4FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              The FAULTLINE Method™
            </span>
          </div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF", lineHeight: 1.7, margin: 0 }}>
            Markets move through changing conditions and evolving regimes. Rather than relying on headlines or emotions, FAULTLINE continuously monitors multiple dimensions of the market and translates complex information into clear, actionable awareness. Every term below is part of that framework. Click any term to learn what it means, why it matters, what triggered it, and what to watch next.
          </p>
          <div style={{ marginTop: "12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#00D4FF", fontWeight: 700, letterSpacing: "0.1em" }}>
            Understand. Adapt. Navigate.
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <Search size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
          <input
            type="text"
            placeholder="Search terms..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              padding: "10px 12px 10px 34px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              color: "#F0F4FF",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
          <button
            onClick={() => setActiveCategory("all")}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              padding: "4px 10px",
              borderRadius: "3px",
              border: `1px solid ${activeCategory === "all" ? "#00D4FF" : "rgba(255,255,255,0.08)"}`,
              background: activeCategory === "all" ? "rgba(0,212,255,0.1)" : "transparent",
              color: activeCategory === "all" ? "#00D4FF" : "#4B5563",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            All ({GLOSSARY.length})
          </button>
          {GLOSSARY_CATEGORIES.map(cat => {
            const count = GLOSSARY.filter(t => t.category === cat.id).length;
            const color = CATEGORY_COLORS[cat.id];
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  padding: "4px 10px",
                  borderRadius: "3px",
                  border: `1px solid ${isActive ? color : "rgba(255,255,255,0.08)"}`,
                  background: isActive ? color + "15" : "transparent",
                  color: isActive ? color : "#4B5563",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Terms list */}
        {filtered.length === 0 ? (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#4B5563", textAlign: "center", padding: "40px" }}>
            No terms match your search.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(term => (
              <TermCard key={term.id} term={term} />
            ))}
          </div>
        )}

        {/* Footer note */}
        <div style={{ marginTop: "32px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", textAlign: "center", lineHeight: 1.6 }}>
          FAULTLINE Method™ terminology is proprietary. Terms reflect the platform's analytical framework and do not constitute financial advice. All market conditions described are for informational and educational purposes only.
        </div>
      </div>
    </div>
  );
}
