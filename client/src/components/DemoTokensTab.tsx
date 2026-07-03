import { useState } from "react";
import { trpc } from "@/lib/trpc";

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const HEADING: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h2 style={{ ...HEADING, fontSize: "16px", fontWeight: 700, color: "rgba(226,232,240,0.9)", marginBottom: "4px" }}>{title}</h2>
      <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.05em" }}>{sub}</p>
    </div>
  );
}

export default function DemoTokensTab() {
  const utils = trpc.useUtils();
  const { data: tokens, isLoading } = trpc.demo.listTokens.useQuery(undefined, { staleTime: 10_000 });
  const [count, setCount] = useState(3);
  const [generated, setGenerated] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = trpc.demo.generateTokens.useMutation({
    onSuccess: (data) => {
      setGenerated(data.tokens);
      utils.demo.listTokens.invalidate();
    },
  });

  const copyToken = (t: string) => {
    navigator.clipboard.writeText(t).then(() => {
      setCopied(t);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const available = tokens?.filter(t => !t.used).length ?? 0;
  const used = tokens?.filter(t => t.used).length ?? 0;

  return (
    <div style={{ maxWidth: "700px" }}>
      <SectionHeader title="Demo Access Tokens" sub="Single-use access codes for password-gated demo mode" />

      {/* Stats row */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <div style={{ flex: 1, padding: "14px 18px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "8px" }}>
          <p style={{ ...MONO, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(0,212,255,0.5)", marginBottom: "4px" }}>AVAILABLE</p>
          <p style={{ ...HEADING, fontSize: "28px", fontWeight: 700, color: "rgba(0,255,136,0.9)" }}>{available}</p>
        </div>
        <div style={{ flex: 1, padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}>
          <p style={{ ...MONO, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: "4px" }}>USED</p>
          <p style={{ ...HEADING, fontSize: "28px", fontWeight: 700, color: "rgba(100,116,139,0.6)" }}>{used}</p>
        </div>
        <div style={{ flex: 1, padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}>
          <p style={{ ...MONO, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: "4px" }}>TOTAL</p>
          <p style={{ ...HEADING, fontSize: "28px", fontWeight: 700, color: "rgba(226,232,240,0.8)" }}>{tokens?.length ?? 0}</p>
        </div>
      </div>

      {/* Generator */}
      <div style={{ padding: "20px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "10px", marginBottom: "24px" }}>
        <p style={{ ...MONO, fontSize: "11px", letterSpacing: "0.15em", color: "rgba(0,212,255,0.7)", marginBottom: "12px" }}>GENERATE NEW TOKENS</p>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: generated.length > 0 ? "16px" : "0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setCount(Math.max(1, count - 1))}
              style={{ ...MONO, width: "28px", height: "28px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", background: "transparent", color: "rgba(226,232,240,0.6)", cursor: "pointer", fontSize: "16px" }}
            >-</button>
            <span style={{ ...MONO, fontSize: "18px", fontWeight: 700, color: "rgba(226,232,240,0.9)", minWidth: "24px", textAlign: "center" }}>{count}</span>
            <button
              onClick={() => setCount(Math.min(20, count + 1))}
              style={{ ...MONO, width: "28px", height: "28px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", background: "transparent", color: "rgba(226,232,240,0.6)", cursor: "pointer", fontSize: "16px" }}
            >+</button>
          </div>
          <button
            onClick={() => generate.mutate({ count })}
            disabled={generate.isPending}
            style={{
              ...MONO, fontSize: "11px", letterSpacing: "0.12em", padding: "8px 20px",
              background: generate.isPending ? "rgba(0,212,255,0.1)" : "rgba(0,212,255,0.15)",
              border: "1px solid rgba(0,212,255,0.3)", borderRadius: "6px",
              color: generate.isPending ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.9)",
              cursor: generate.isPending ? "not-allowed" : "pointer", transition: "all 0.15s",
            }}
          >
            {generate.isPending ? "GENERATING..." : `GENERATE ${count} TOKEN${count !== 1 ? "S" : ""}`}
          </button>
        </div>
        {generated.length > 0 && (
          <div style={{ padding: "12px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px" }}>
            <p style={{ ...MONO, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(0,255,136,0.6)", marginBottom: "8px" }}>NEWLY GENERATED — CLICK TO COPY</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {generated.map(t => (
                <button
                  key={t}
                  onClick={() => copyToken(t)}
                  style={{
                    ...MONO, fontSize: "12px", letterSpacing: "0.12em", padding: "6px 14px",
                    background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)",
                    borderRadius: "4px", color: copied === t ? "rgba(0,255,136,1)" : "rgba(0,255,136,0.8)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {copied === t ? "COPIED!" : t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Token list */}
      <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ ...MONO, fontSize: "10px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.6)" }}>ALL TOKENS</p>
          <button
            onClick={() => utils.demo.listTokens.invalidate()}
            style={{ ...MONO, fontSize: "9px", letterSpacing: "0.1em", padding: "4px 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", color: "rgba(100,116,139,0.5)", cursor: "pointer" }}
          >REFRESH</button>
        </div>
        {isLoading ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.4)" }}>LOADING...</p>
          </div>
        ) : !tokens || tokens.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.4)" }}>No tokens yet. Generate some above.</p>
          </div>
        ) : (
          <div>
            {tokens.map(t => (
              <div
                key={t.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  opacity: t.used ? 0.45 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: t.used ? "rgba(100,116,139,0.4)" : "rgba(0,255,136,0.8)",
                    flexShrink: 0, display: "inline-block",
                  }} />
                  <span style={{ ...MONO, fontSize: "13px", letterSpacing: "0.12em", color: t.used ? "rgba(100,116,139,0.5)" : "rgba(226,232,240,0.9)" }}>
                    {t.token}
                  </span>
                  {!t.used && (
                    <button
                      onClick={() => copyToken(t.token)}
                      style={{
                        ...MONO, fontSize: "9px", letterSpacing: "0.1em", padding: "2px 8px",
                        background: "transparent", border: "1px solid rgba(0,212,255,0.2)",
                        borderRadius: "3px", color: copied === t.token ? "rgba(0,212,255,1)" : "rgba(0,212,255,0.5)",
                        cursor: "pointer",
                      }}
                    >
                      {copied === t.token ? "COPIED" : "COPY"}
                    </button>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ ...MONO, fontSize: "9px", letterSpacing: "0.1em", color: t.used ? "rgba(255,80,80,0.6)" : "rgba(0,255,136,0.6)" }}>
                    {t.used ? "USED" : "AVAILABLE"}
                  </span>
                  {t.usedAt && (
                    <p style={{ ...MONO, fontSize: "8px", color: "rgba(100,116,139,0.4)", marginTop: "2px" }}>
                      {new Date(t.usedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
