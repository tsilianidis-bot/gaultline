/* ============================================================
   FAULTLINE — TickerActionMenu
   Universal quick-action menu for any ticker/coin mention
   across the entire site.

   Usage:
     <TickerChip ticker="NVDA" />
     <TickerChip ticker="BTC" assetType="crypto" />
     <TickerActionMenu ticker="AAPL" trigger={<span>AAPL</span>} />
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, TrendingUp, BookOpen, Plus, Check, ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

export type AssetType = "stock" | "crypto" | "etf" | "auto";

interface TickerActionMenuProps {
  ticker: string;
  assetType?: AssetType;
  /** Custom trigger element. Defaults to a styled chip. */
  trigger?: React.ReactNode;
  /** Additional CSS class for the trigger wrapper */
  className?: string;
  /** If true, show only the ticker text with a subtle down-caret */
  compact?: boolean;
  /** Name of the asset (used for watchlist add) */
  name?: string;
}

// ── Helpers ───────────────────────────────────────────────────

const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "SHIB",
  "DOT", "LINK", "MATIC", "LTC", "BCH", "XLM", "ALGO", "ATOM", "FTM",
  "NEAR", "APT", "ARB", "OP", "SUI", "INJ", "TIA", "SEI", "PYTH",
  "WIF", "BONK", "PEPE", "FLOKI", "MEME", "TURBO", "TON", "ICP",
]);

function resolveAssetType(ticker: string, assetType: AssetType): "stock" | "crypto" {
  if (assetType === "crypto") return "crypto";
  if (assetType === "stock" || assetType === "etf") return "stock";
  return CRYPTO_SYMBOLS.has(ticker.toUpperCase()) ? "crypto" : "stock";
}

// ── Main Component ────────────────────────────────────────────

export function TickerActionMenu({
  ticker,
  assetType = "auto",
  trigger,
  className = "",
  compact = false,
  name,
}: TickerActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const resolved = resolveAssetType(ticker, assetType);
  const sym = ticker.toUpperCase();
  const displayName = name ?? sym;

  // Watchlist state
  const [inWatchlist, setInWatchlist] = useState(false);

  // Use the unified mobileWatchlist.addItem for both stocks and crypto
  const addToWatchlist = trpc.mobileWatchlist.addItem.useMutation({
    onSuccess: (data) => {
      if (data.duplicate) {
        toast(`${sym} is already in your watchlist`);
      } else {
        setInWatchlist(true);
        toast.success(`${sym} added to watchlist`);
      }
    },
    onError: () => toast.error("Could not add to watchlist"),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSearch = useCallback(() => {
    setOpen(false);
    if (resolved === "crypto") {
      navigate(`/crypto-search?symbol=${sym}`);
    } else {
      navigate(`/signals?search=${sym}`);
    }
  }, [resolved, sym, navigate]);

  const handleFullReading = useCallback(() => {
    setOpen(false);
    navigate(`/signal-outlook?symbol=${sym}&type=${resolved}`);
  }, [resolved, sym, navigate]);

  const handleSignalOutlook = useCallback(() => {
    setOpen(false);
    navigate(`/signal-outlook?symbol=${sym}&type=${resolved}`);
  }, [resolved, sym, navigate]);

  const handleAddWatchlist = useCallback(() => {
    setOpen(false);
    if (!user) {
      toast.error("Sign in to use watchlists");
      return;
    }
    if (inWatchlist) {
      toast(`${sym} is already in your watchlist`);
      return;
    }
    addToWatchlist.mutate({
      symbol: sym,
      name: displayName,
      type: resolved,
    });
  }, [user, inWatchlist, resolved, sym, displayName, addToWatchlist]);

  const defaultTrigger = compact ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontFamily: "monospace",
        fontWeight: 700,
        fontSize: "inherit",
        color: "#00D4FF",
        cursor: "pointer",
        borderBottom: "1px dashed rgba(0,212,255,0.4)",
        paddingBottom: 1,
        transition: "color 0.15s",
      }}
    >
      {sym}
      <ChevronDown size={10} style={{ opacity: 0.6 }} />
    </span>
  ) : (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "monospace",
        fontWeight: 700,
        fontSize: 12,
        color: "#00D4FF",
        background: "rgba(0,212,255,0.08)",
        border: "1px solid rgba(0,212,255,0.25)",
        borderRadius: 4,
        padding: "2px 7px",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.15)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.08)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.25)";
      }}
    >
      {sym}
      <ChevronDown size={9} style={{ opacity: 0.7 }} />
    </span>
  );

  return (
    <span
      ref={menuRef}
      className={className}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      <span
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {trigger ?? defaultTrigger}
      </span>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 9999,
            background: "#0D1117",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.1)",
            minWidth: 210,
            overflow: "hidden",
            animation: "tickerMenuFadeIn 0.15s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: "8px 12px 6px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#00D4FF" }}>{sym}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
              padding: "1px 5px", borderRadius: 3,
              background: resolved === "crypto" ? "rgba(168,85,247,0.15)" : "rgba(0,212,255,0.1)",
              color: resolved === "crypto" ? "#A855F7" : "#00D4FF",
            }}>
              {resolved === "crypto" ? "CRYPTO" : "STOCK"}
            </span>
          </div>

          {/* Actions */}
          <div style={{ padding: "4px 0" }}>
            <MenuItem icon={<Search size={13} />} label="Search This Asset" onClick={handleSearch} />
            <MenuItem icon={<BookOpen size={13} />} label="View Full Reading" onClick={handleFullReading} />
            <MenuItem icon={<TrendingUp size={13} />} label="Run Signal Outlook" onClick={handleSignalOutlook} />
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "3px 0" }} />
            <MenuItem
              icon={inWatchlist ? <Check size={13} color="#00FF88" /> : <Plus size={13} />}
              label={inWatchlist ? "In Watchlist" : "Add to Watchlist"}
              onClick={handleAddWatchlist}
              accent={inWatchlist ? "#00FF88" : undefined}
            />
          </div>
        </div>
      )}
    </span>
  );
}

// ── Menu Item ─────────────────────────────────────────────────

function MenuItem({
  icon, label, onClick, accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "7px 12px",
        background: hovered ? "rgba(0,212,255,0.06)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: accent ?? (hovered ? "#E2E8F0" : "#94A3B8"),
        fontSize: 12,
        fontFamily: "inherit",
        textAlign: "left",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <span style={{ color: accent ?? (hovered ? "#00D4FF" : "#64748B"), flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── TickerChip (convenience wrapper) ─────────────────────────

/**
 * Drop-in replacement for any inline ticker mention.
 * Renders as a styled chip with a quick-action dropdown.
 *
 * <TickerChip ticker="NVDA" />
 * <TickerChip ticker="BTC" assetType="crypto" compact />
 */
export function TickerChip({
  ticker,
  assetType = "auto",
  compact = false,
  className = "",
  name,
}: {
  ticker: string;
  assetType?: AssetType;
  compact?: boolean;
  className?: string;
  name?: string;
}) {
  return (
    <TickerActionMenu
      ticker={ticker}
      assetType={assetType}
      compact={compact}
      className={className}
      name={name}
    />
  );
}

// ── CSS animation (injected once) ────────────────────────────
if (typeof document !== "undefined") {
  const styleId = "ticker-action-menu-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes tickerMenuFadeIn {
        from { opacity: 0; transform: translateY(-6px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
}
