/*
   FAULTLINE — Universal Command Search (Cmd+K)
   Global keyboard-accessible search palette.
   Supports: page navigation, symbol intelligence, day trade search.
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, X, LayoutDashboard, Target, Telescope, Shield, Crosshair,
  Sparkles, Radio, Bell, Briefcase, Bitcoin, RotateCcw, Brain,
  Eye, AlertTriangle, Gauge, BarChart2, TrendingUp, FileText,
  MessageSquare, ArrowRight, Hash, Zap,
} from "lucide-react";
import { CANONICAL_DESTINATIONS, EXPERT_WORKSPACES, PERSISTENT_UTILITIES } from "@shared/routeRegistry";
import { getRouteIcon } from "@/lib/routeIcons";

// ── Types ─────────────────────────────────────────────────────
type CommandItem = {
  id: string;
  type: "page" | "symbol" | "action";
  label: string;
  description?: string;
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  keywords?: string[];
};

// ── Page commands ─────────────────────────────────────────────
const PAGE_COMMANDS: CommandItem[] = [
  ...CANONICAL_DESTINATIONS.map(destination => ({
    id: destination.id,
    type: "page" as const,
    label: destination.label,
    description: destination.question,
    icon: React.createElement(getRouteIcon(destination.icon), { size: 14 }),
    path: destination.path,
    keywords: [destination.id, destination.shortLabel.toLowerCase(), "market question"],
  })),
  ...PERSISTENT_UTILITIES.flatMap(utility => utility.path ? [{
    id: utility.id,
    type: "page" as const,
    label: utility.label,
    description: `${utility.kind === "route" ? "Open" : "Run"} ${utility.label}`,
    icon: React.createElement(getRouteIcon(utility.icon), { size: 14 }),
    path: utility.path,
    keywords: [utility.id, "utility"],
  }] : []),
  ...EXPERT_WORKSPACES.map(workspace => ({
    id: workspace.id,
    type: "page" as const,
    label: workspace.label,
    description: `${workspace.label} expert workspace`,
    icon: React.createElement(getRouteIcon(workspace.icon), { size: 14 }),
    path: workspace.path,
    keywords: [workspace.id, "expert workspace"],
  })),
];

// ── Quick stock symbols ───────────────────────────────────────
const QUICK_STOCKS = ["SPY", "NVDA", "PLTR", "TSLA", "AAPL", "META", "AMD", "MSFT", "AMZN", "GOOG"];
const QUICK_CRYPTO = ["BTC", "ETH", "SOL", "TAO", "ONDO", "DOGE", "LINK", "BNB"];

// ── Helpers ───────────────────────────────────────────────────
function matchesQuery(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false) ||
    (item.keywords?.some(k => k.includes(q)) ?? false)
  );
}

function isSymbolQuery(query: string): boolean {
  return /^[A-Z]{1,10}$/.test(query.trim().toUpperCase());
}

// ── CommandSearch component ───────────────────────────────────
interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandSearch({ isOpen, onClose }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build results list
  const results = React.useMemo(() => {
    const q = query.trim().toUpperCase();
    const items: CommandItem[] = [];

    // Symbol intelligence shortcut — if query looks like a ticker
    if (q.length >= 1 && isSymbolQuery(q)) {
      items.push({
        id: `symbol-stock-${q}`,
        type: "symbol",
        label: `${q} — Symbol Intelligence`,
        description: "Open full intelligence report for this stock",
        icon: <Telescope size={14} />,
        path: `/app/symbol-intelligence`,
        action: () => {
          navigate("/app/symbol-intelligence");
          // Dispatch event to pre-fill the search
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol: q, assetType: "stock" } }));
          }, 200);
        },
      });
      items.push({
        id: `symbol-daytrade-${q}`,
        type: "symbol",
        label: `${q} — Day Trade Setup`,
        description: "Open Day Trade Intelligence report for this symbol",
        icon: <Target size={14} />,
        action: () => {
          navigate("/app/day-trade-intelligence");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("dt-search", { detail: { symbol: q, assetType: "stock" } }));
          }, 200);
        },
      });
      items.push({
        id: `symbol-crypto-${q}`,
        type: "symbol",
        label: `${q} — Crypto Intelligence`,
        description: "Open crypto intelligence report for this symbol",
        icon: <Bitcoin size={14} />,
        action: () => {
          navigate("/app/symbol-intelligence");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol: q, assetType: "crypto" } }));
          }, 200);
        },
      });
    }

    // Page commands
    const pageMatches = PAGE_COMMANDS.filter(c => matchesQuery(c, query.toLowerCase()));
    items.push(...pageMatches);

    return items.slice(0, 12);
  }, [query, navigate]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[selectedIndex];
      if (item) executeItem(item);
    }
  }, [results, selectedIndex, onClose]);

  const executeItem = useCallback((item: CommandItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  }, [navigate, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
        }}
      />

      {/* Command palette */}
      <div style={{
        position: "fixed",
        top: "15%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(600px, 94vw)",
        background: "rgba(8,10,14,0.98)",
        border: "1px solid rgba(0,212,255,0.3)",
        borderRadius: "8px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,212,255,0.1)",
        zIndex: 9999,
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Search size={16} style={{ color: "#00D4FF", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, symbols, features..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#F0F4FF",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "14px",
              letterSpacing: "0.04em",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: "2px", display: "flex" }}
            >
              <X size={14} />
            </button>
          )}
          <kbd style={{
            padding: "2px 6px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "3px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            color: "#6B7280",
            flexShrink: 0,
          }}>
            ESC
          </kbd>
        </div>

        {/* Quick symbol chips (when no query) */}
        {!query && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", letterSpacing: "0.12em", marginBottom: "8px" }}>
              QUICK SYMBOLS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {[...QUICK_STOCKS.slice(0, 6), ...QUICK_CRYPTO.slice(0, 4)].map(sym => (
                <button
                  key={sym}
                  onClick={() => {
                    onClose();
                    navigate("/app/symbol-intelligence");
                    setTimeout(() => {
                      const assetType = QUICK_CRYPTO.includes(sym) ? "crypto" : "stock";
                      window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol: sym, assetType } }));
                    }, 200);
                  }}
                  style={{
                    padding: "3px 10px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "3px",
                    color: "#94A3B8",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {QUICK_CRYPTO.includes(sym) && <Zap size={9} style={{ color: "#9966FF" }} />}
                  {sym}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight: "360px", overflowY: "auto", padding: "6px" }}>
          {results.length === 0 ? (
            <div style={{
              padding: "24px",
              textAlign: "center",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              color: "#6B7280",
            }}>
              No results for "{query}"
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => executeItem(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 12px",
                  background: idx === selectedIndex ? "rgba(0,212,255,0.08)" : "transparent",
                  border: `1px solid ${idx === selectedIndex ? "rgba(0,212,255,0.2)" : "transparent"}`,
                  borderRadius: "5px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.1s",
                  marginBottom: "2px",
                }}
              >
                <span style={{
                  color: item.type === "symbol" ? "#FFD700" : idx === selectedIndex ? "#00D4FF" : "#6B7280",
                  flexShrink: 0,
                  display: "flex",
                }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12px",
                    color: idx === selectedIndex ? "#F0F4FF" : "#94A3B8",
                    fontWeight: idx === selectedIndex ? 600 : 400,
                    display: "block",
                  }}>
                    {item.label}
                  </span>
                  {item.description && (
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "10px",
                      color: "#6B7280",
                      display: "block",
                      marginTop: "1px",
                    }}>
                      {item.description}
                    </span>
                  )}
                </span>
                {idx === selectedIndex && (
                  <ArrowRight size={12} style={{ color: "#00D4FF", flexShrink: 0 }} />
                )}
                {item.type === "symbol" && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    color: "#FFD700",
                    background: "rgba(255,215,0,0.08)",
                    border: "1px solid rgba(255,215,0,0.2)",
                    borderRadius: "2px",
                    padding: "1px 5px",
                    flexShrink: 0,
                  }}>
                    SYMBOL
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          gap: "16px",
          alignItems: "center",
        }}>
          {[
            ["↑↓", "navigate"],
            ["↵", "select"],
            ["esc", "close"],
          ].map(([key, hint]) => (
            <span key={key} style={{ display: "flex", gap: "5px", alignItems: "center" }}>
              <kbd style={{
                padding: "1px 5px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "2px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: "#6B7280",
              }}>{key}</kbd>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151" }}>{hint}</span>
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151" }}>
            ⌘K to open
          </span>
        </div>
      </div>
    </>
  );
}

/** Hook to manage command search open state and keyboard shortcut */
export function useCommandSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
