/* ============================================================
   FAULTLINE Core — Watchlist Tab
   Add tickers and crypto, view basic signal status.
   Persisted to DB via tRPC mobileWatchlist procedures.
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Star, Search, X } from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────
function getSignalColor(signal: string): string {
  switch (signal) {
    case "BUY": return "#34D399";
    case "SELL": return "#FF2D55";
    case "HOLD": return "#FFD700";
    case "WATCH": return "#00D4FF";
    case "AVOID": return "#FF9500";
    default: return "#64748B";
  }
}

function getRiskLabel(changePercent: number): string {
  if (changePercent <= -3) return "HIGH RISK";
  if (changePercent <= -1) return "ELEVATED";
  if (changePercent >= 2) return "BULLISH";
  return "NEUTRAL";
}

function getRiskColor(label: string): string {
  if (label === "HIGH RISK") return "#FF2D55";
  if (label === "ELEVATED") return "#FF9500";
  if (label === "BULLISH") return "#34D399";
  return "#64748B";
}

// ── Watchlist item card ───────────────────────────────────────
interface WatchlistItemCardProps {
  id: number;
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  price?: number;
  changePercent?: number;
  signal?: string;
  onRemove: (id: number) => void;
}

function WatchlistItemCard({ id, symbol, name, type, price, changePercent, signal, onRemove }: WatchlistItemCardProps) {
  const signalColor = getSignalColor(signal ?? "HOLD");
  const changeColor = (changePercent ?? 0) >= 0 ? "#34D399" : "#FF2D55";
  const riskLabel = getRiskLabel(changePercent ?? 0);
  const riskColor = getRiskColor(riskLabel);

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Badge */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${signalColor}15`, border: `1px solid ${signalColor}25` }}
      >
        <span className="text-[9px] font-mono font-bold" style={{ color: signalColor }}>
          {symbol.slice(0, 4)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-white truncate">{symbol}</span>
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "#64748B" }}
          >
            {type.toUpperCase()}
          </span>
          {signal && (
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${signalColor}15`, color: signalColor }}
            >
              {signal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-[#64748B] truncate">{name}</span>
          {changePercent !== undefined && (
            <span className="text-[9px] font-mono font-bold" style={{ color: changeColor }}>
              {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
            </span>
          )}
          <span className="text-[8px] font-mono" style={{ color: riskColor }}>{riskLabel}</span>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(id)}
        className="p-1.5 rounded-lg transition-colors flex-shrink-0"
        style={{ color: "#64748B" }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Add item modal ────────────────────────────────────────────
interface AddItemModalProps {
  onClose: () => void;
  onAdd: (symbol: string, name: string, type: "stock" | "crypto") => Promise<void>;
}

function AddItemModal({ onClose, onAdd }: AddItemModalProps) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"stock" | "crypto">("stock");
  const [adding, setAdding] = useState(false);

  const handleSubmit = async () => {
    if (!symbol.trim() || !name.trim()) return;
    setAdding(true);
    try {
      await onAdd(symbol.trim(), name.trim(), type);
      onClose();
    } catch {
      toast.error("Failed to add to watchlist");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[480px] rounded-t-2xl p-6 pb-8 space-y-4"
        style={{ background: "#0C0F16", border: "1px solid rgba(0,212,255,0.12)", borderBottom: "none" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-0.5">ADD TO WATCHLIST</div>
            <h3 className="text-base font-bold text-white">Track a ticker or crypto</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        {/* Type toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["stock", "crypto"] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 py-2 text-[10px] font-mono tracking-widest transition-colors"
              style={{
                background: type === t ? "rgba(0,212,255,0.15)" : "transparent",
                color: type === t ? "#00D4FF" : "#64748B",
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Symbol input */}
        <div>
          <label className="text-[9px] font-mono tracking-widest text-[#64748B] mb-1.5 block">
            {type === "stock" ? "TICKER SYMBOL" : "CRYPTO SYMBOL"}
          </label>
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder={type === "stock" ? "e.g. NVDA" : "e.g. BTC"}
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white placeholder:text-[#3D4F63] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            autoFocus
          />
        </div>

        {/* Name input */}
        <div>
          <label className="text-[9px] font-mono tracking-widest text-[#64748B] mb-1.5 block">DISPLAY NAME</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === "stock" ? "e.g. NVIDIA Corp" : "e.g. Bitcoin"}
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white placeholder:text-[#3D4F63] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!symbol.trim() || !name.trim() || adding}
          className="w-full py-3 rounded-lg font-mono font-bold text-sm tracking-widest transition-all"
          style={{
            background: symbol && name ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${symbol && name ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.06)"}`,
            color: symbol && name ? "#00D4FF" : "#3D4F63",
          }}
        >
          {adding ? "ADDING..." : "ADD TO WATCHLIST"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MobileWatchlist() {
  const [showAdd, setShowAdd] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, { price: number; changePercent: number }>>({});

  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.mobileWatchlist.getItems.useQuery(undefined, {
    staleTime: 30_000,
  });

  const addItem = trpc.mobileWatchlist.addItem.useMutation({
    onSuccess: (result) => {
      if (result.duplicate) {
        toast.info("Already in your watchlist");
      } else {
        toast.success("Added to watchlist");
      }
      utils.mobileWatchlist.getItems.invalidate();
    },
    onError: () => toast.error("Failed to add item"),
  });

  const removeItem = trpc.mobileWatchlist.removeItem.useMutation({
    onMutate: async ({ id }) => {
      await utils.mobileWatchlist.getItems.cancel();
      const prev = utils.mobileWatchlist.getItems.getData();
      utils.mobileWatchlist.getItems.setData(undefined, old => old?.filter(i => i.id !== id) ?? []);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.mobileWatchlist.getItems.setData(undefined, ctx.prev);
      toast.error("Failed to remove item");
    },
    onSettled: () => utils.mobileWatchlist.getItems.invalidate(),
  });

  // Fetch live quotes for stock items
  const stockSymbols = useMemo(() => items.filter(i => i.type === "stock").map(i => i.symbol), [items]);

  useEffect(() => {
    if (stockSymbols.length === 0) return;
    fetch("/api/signals/quotes")
      .then(r => r.json())
      .then((data: { quotes?: { ticker: string; price: number; changePercent: number }[] }) => {
        const map: Record<string, { price: number; changePercent: number }> = {};
        (data.quotes ?? []).forEach(q => { map[q.ticker] = { price: q.price, changePercent: q.changePercent }; });
        setQuotes(map);
      })
      .catch(() => {});
  }, [stockSymbols.length]);

  const handleAdd = async (symbol: string, name: string, type: "stock" | "crypto") => {
    await addItem.mutateAsync({ symbol, name, type });
  };

  const handleRemove = (id: number) => {
    removeItem.mutate({ id });
  };

  const stockItems = items.filter(i => i.type === "stock");
  const cryptoItems = items.filter(i => i.type === "crypto");

  return (
    <>
      <div className="px-4 py-4 pb-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-0.5">WATCHLIST</div>
            <div className="text-xs font-mono text-[#64748B]">
              {items.length} {items.length === 1 ? "item" : "items"} tracked
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono tracking-widest transition-colors"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
          >
            <Plus size={12} />
            ADD
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF] animate-spin" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)" }}
            >
              <Star size={22} className="text-[#00D4FF]/40" />
            </div>
            <div className="text-sm font-mono text-[#64748B] mb-1">No items yet</div>
            <div className="text-[11px] font-mono text-[#3D4F63]">Tap ADD to track a ticker or crypto</div>
          </div>
        )}

        {/* Stock items */}
        {stockItems.length > 0 && (
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#64748B]/60 mb-2">STOCKS</div>
            <div className="space-y-2">
              {stockItems.map(item => (
                <WatchlistItemCard
                  key={item.id}
                  id={item.id}
                  symbol={item.symbol}
                  name={item.name}
                  type="stock"
                  price={quotes[item.symbol]?.price}
                  changePercent={quotes[item.symbol]?.changePercent}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>
        )}

        {/* Crypto items */}
        {cryptoItems.length > 0 && (
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#64748B]/60 mb-2">CRYPTO</div>
            <div className="space-y-2">
              {cryptoItems.map(item => (
                <WatchlistItemCard
                  key={item.id}
                  id={item.id}
                  symbol={item.symbol}
                  name={item.name}
                  type="crypto"
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick add suggestions */}
        {items.length < 3 && (
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-[9px] font-mono tracking-widest text-[#64748B] mb-3">QUICK ADD</div>
            <div className="flex flex-wrap gap-2">
              {["NVDA", "MSFT", "TSLA", "BTC", "ETH"].map(sym => (
                <button
                  key={sym}
                  onClick={() => {
                    const isCrypto = sym === "BTC" || sym === "ETH";
                    const names: Record<string, string> = { NVDA: "NVIDIA", MSFT: "Microsoft", TSLA: "Tesla", BTC: "Bitcoin", ETH: "Ethereum" };
                    handleAdd(sym, names[sym] ?? sym, isCrypto ? "crypto" : "stock");
                  }}
                  className="px-2.5 py-1 rounded-full text-[9px] font-mono tracking-widest transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#A8B8CC" }}
                >
                  + {sym}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </>
  );
}
