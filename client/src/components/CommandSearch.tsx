/*
   FAULTLINE — Universal Command Search (Cmd+K)
   Searches the same consolidated hierarchy as the drawer and tools hub.
*/
import React, { useState, useEffect, useMemo, useRef, useCallback, type ElementType } from "react";
import { useLocation } from "wouter";
import {
  Activity, ArrowRight, BarChart2, Bell, Bitcoin, BookOpen, Brain, Briefcase,
  Crosshair, FileText, FlaskConical, Globe, GraduationCap, Gauge, HelpCircle,
  History, Map, MessageSquare, Newspaper, Radio, RotateCcw, Search, Settings,
  Shield, Sparkles, Target, Telescope, TrendingUp, User, Users, X, Zap,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSearchNavigationItems, type NavigationIconName, type NavigationItem } from "@shared/navigationHierarchy";

interface CommandItem {
  id: string;
  type: "page" | "symbol";
  label: string;
  description?: string;
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  keywords?: readonly string[];
}

const ICONS: Record<NavigationIconName, ElementType> = {
  activity: Activity,
  brain: Brain,
  network: Brain,
  telescope: Telescope,
  bell: Bell,
  crosshair: Crosshair,
  gauge: Gauge,
  "bar-chart": BarChart2,
  history: History,
  rotate: RotateCcw,
  newspaper: Newspaper,
  radio: Radio,
  bitcoin: Bitcoin,
  sparkles: Sparkles,
  target: Target,
  search: Search,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  "book-open": BookOpen,
  "file-text": FileText,
  user: User,
  help: HelpCircle,
  "graduation-cap": GraduationCap,
  map: Map,
  shield: Shield,
  users: Users,
  settings: Settings,
  "message-square": MessageSquare,
  zap: Zap,
  globe: Globe,
  flask: FlaskConical,
};

const QUICK_STOCKS = ["SPY", "NVDA", "PLTR", "TSLA", "AAPL", "META", "AMD", "MSFT", "AMZN", "GOOG"];
const QUICK_CRYPTO = ["BTC", "ETH", "SOL", "TAO", "ONDO", "DOGE", "LINK", "BNB"];
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function makePageCommand(item: NavigationItem): CommandItem {
  const Icon = ICONS[item.icon];
  return {
    id: item.id,
    type: "page",
    label: item.label,
    description: item.description,
    icon: <Icon size={14} />,
    path: item.path,
    keywords: item.keywords,
  };
}

function matchesQuery(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return item.label.toLowerCase().includes(normalized)
    || (item.description?.toLowerCase().includes(normalized) ?? false)
    || (item.keywords?.some(keyword => keyword.toLowerCase().includes(normalized)) ?? false);
}

function isSymbolQuery(query: string): boolean {
  return /^[A-Z]{1,10}$/.test(query.trim().toUpperCase());
}

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandSearch({ isOpen, onClose }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const pageCommands = useMemo(() => getSearchNavigationItems(isAdmin).map(makePageCommand), [isAdmin]);

  useEffect(() => {
    if (!isOpen) {
      if (returnFocusRef.current) {
        returnFocusRef.current.focus();
        returnFocusRef.current = null;
      }
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setSelectedIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const symbol = query.trim().toUpperCase();
    const items: CommandItem[] = [];

    if (symbol && isSymbolQuery(symbol)) {
      items.push(
        {
          id: `symbol-stock-${symbol}`,
          type: "symbol",
          label: `${symbol} — Symbol Intelligence`,
          description: "Open the full intelligence report for this stock.",
          icon: <Telescope size={14} />,
          action: () => {
            navigate("/app/symbol-intelligence");
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol, assetType: "stock" } })), 200);
          },
        },
        {
          id: `symbol-daytrade-${symbol}`,
          type: "symbol",
          label: `${symbol} — Day Trade Setup`,
          description: "Open Day Trade Intelligence for this symbol.",
          icon: <Target size={14} />,
          action: () => {
            navigate("/app/day-trade-intelligence");
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("dt-search", { detail: { symbol, assetType: "stock" } })), 200);
          },
        },
        {
          id: `symbol-crypto-${symbol}`,
          type: "symbol",
          label: `${symbol} — Crypto Intelligence`,
          description: "Open Symbol Intelligence with crypto context.",
          icon: <Bitcoin size={14} />,
          action: () => {
            navigate("/app/symbol-intelligence");
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol, assetType: "crypto" } })), 200);
          },
        },
      );
    }

    items.push(...pageCommands.filter(item => matchesQuery(item, query)));
    return items.slice(0, 12);
  }, [query, pageCommands, navigate]);

  const executeItem = useCallback((item: CommandItem) => {
    onClose();
    if (item.action) item.action();
    else if (item.path) navigate(item.path);
  }, [navigate, onClose]);

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length) setSelectedIndex(index => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) setSelectedIndex(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[selectedIndex];
      if (item) executeItem(item);
    }
  }, [results, selectedIndex, executeItem]);

  useEffect(() => setSelectedIndex(0), [query]);

  if (!isOpen) return null;

  return <>
    <button aria-label="Close search" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", border: "none", zIndex: 9998, cursor: "default" }} />
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search FAULTLINE" style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", width: "min(600px, 94vw)", background: "rgba(8,10,14,0.98)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 8, boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,212,255,0.1)", zIndex: 9999, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Search size={16} style={{ color: "#00D4FF", flexShrink: 0 }} aria-hidden="true" />
        <input ref={inputRef} id="faultline-command-search-input" aria-label="Search navigation and symbols" className="faultline-nav-focus" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={handleInputKeyDown} placeholder="Search navigation, symbols, features…" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#F0F4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, letterSpacing: "0.04em" }} />
        {query && <button className="faultline-nav-focus" onClick={() => setQuery("")} aria-label="Clear search" style={{ background: "none", border: "none", cursor: "pointer", color: "#8A9AB0", padding: 2, display: "flex" }}><X size={14} /></button>}
        <kbd style={{ padding: "2px 6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8A9AB0", flexShrink: 0 }}>ESC</kbd>
      </div>

      {!query && <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#8A9AB0", letterSpacing: "0.12em", marginBottom: 8 }}>QUICK SYMBOLS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[...QUICK_STOCKS.slice(0, 6), ...QUICK_CRYPTO.slice(0, 4)].map(symbol => <button key={symbol} className="faultline-nav-focus" onClick={() => {
            onClose();
            navigate("/app/symbol-intelligence");
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("si-search", { detail: { symbol, assetType: QUICK_CRYPTO.includes(symbol) ? "crypto" : "stock" } })), 200);
          }} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, color: "#94A3B8", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>{QUICK_CRYPTO.includes(symbol) && <Zap size={9} style={{ color: "#9966FF" }} />}{symbol}</button>)}
        </div>
      </div>}

      <div style={{ maxHeight: "360px", overflowY: "auto", padding: 6 }}>
        {results.length === 0 ? <div style={{ padding: 24, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8A9AB0" }}>No results for “{query}”</div> : results.map((item, index) => <button key={item.id} className="faultline-nav-focus" onClick={() => executeItem(item)} onMouseEnter={() => setSelectedIndex(index)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: index === selectedIndex ? "rgba(0,212,255,0.08)" : "transparent", border: `1px solid ${index === selectedIndex ? "rgba(0,212,255,0.2)" : "transparent"}`, borderRadius: 5, cursor: "pointer", textAlign: "left", marginBottom: 2 }}>
          <span style={{ color: item.type === "symbol" ? "#FFD700" : index === selectedIndex ? "#00D4FF" : "#8A9AB0", flexShrink: 0, display: "flex" }}>{item.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: index === selectedIndex ? "#F0F4FF" : "#94A3B8", fontWeight: index === selectedIndex ? 600 : 400, display: "block" }}>{item.label}</span>{item.description && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8A9AB0", display: "block", marginTop: 1 }}>{item.description}</span>}</span>
          {index === selectedIndex && <ArrowRight size={12} style={{ color: "#00D4FF", flexShrink: 0 }} aria-hidden="true" />}
          {item.type === "symbol" && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#FFD700", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 2, padding: "1px 5px", flexShrink: 0 }}>SYMBOL</span>}
        </button>)}
      </div>

      <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 16, alignItems: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#8A9AB0" }}><span>↑↓ navigate</span><span>↵ select</span><span>esc close</span><span style={{ marginLeft: "auto" }}>⌘K</span></div>
    </div>
  </>;
}

/** Hook to manage command search open state and keyboard shortcut. */
export function useCommandSearch() {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(open => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
