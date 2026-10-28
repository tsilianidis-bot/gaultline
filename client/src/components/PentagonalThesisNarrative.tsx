/**
 * One narrative presentation of the shared Pentagonal Thesis.
 * Surfaces pass a symbol or, when they have none, read the selected stock.
 * The component does not invent a second conclusion.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTickerStore } from "@/contexts/TickerStore";
import type { PentagonalThesis, ThesisEvidenceItem, ThesisSectionId } from "@shared/pentagonalThesis";

const SECTION_ORDER: ThesisSectionId[] = ["happening", "why", "next", "watch", "do"];

function stamp(value: string | null): string {
  if (!value) return "No timestamp";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "No timestamp";
  return new Date(parsed).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function EvidenceList({ items }: { items: ThesisEvidenceItem[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
      {items.map(entry => (
        <article key={entry.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
          <p style={{ margin: 0, color: "#E7EEF6", fontSize: 13, lineHeight: 1.55 }}>{entry.statement}</p>
          <p style={{ margin: "6px 0 0", color: "#8EA0B5", fontSize: 10, letterSpacing: "0.04em" }}>
            {entry.kind} · {entry.epistemic} · {entry.source} · {stamp(entry.timestamp)}
            {entry.stale || entry.missing ? " · not used as a driver" : entry.driver ? " · used in this read" : ""}
          </p>
        </article>
      ))}
    </div>
  );
}

export function PentagonalThesisNarrative({
  symbol,
  surface,
  compact = false,
  thesis: provided,
}: {
  symbol?: string | null;
  surface: string;
  compact?: boolean;
  thesis?: PentagonalThesis | null;
}) {
  const store = useTickerStore();
  const [typed, setTyped] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const stored = store.current?.assetType === "stock" ? store.current.ticker : null;
  const active = (symbol ?? stored ?? chosen ?? "").trim().toUpperCase();
  const query = trpc.pentagonalThesis.forSymbol.useQuery(
    { symbol: active },
    { enabled: provided == null && active.length > 0, staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const thesis = (provided ?? query.data) as PentagonalThesis | undefined;

  return (
    <section
      data-pentagonal-thesis={surface}
      style={{
        background: "#050608",
        border: "1px solid rgba(255,215,0,0.28)",
        borderRadius: 12,
        padding: compact ? 14 : 18,
        color: "#E7EEF6",
      }}
    >
      <p style={{ margin: 0, color: "#FFD700", fontFamily: "IBM Plex Mono, monospace", fontSize: 10, letterSpacing: "0.16em" }}>
        PENTAGONAL THESIS
      </p>
      <h2 style={{ margin: "8px 0 0", fontSize: compact ? 18 : 22, lineHeight: 1.25 }}>
        {thesis?.headline ?? (active ? "Reading the shared stock thesis…" : "Pick a stock to read the shared thesis.")}
      </h2>
      {!symbol && !stored && (
        <form
          onSubmit={event => {
            event.preventDefault();
            const next = typed.trim().toUpperCase();
            if (next) setChosen(next);
          }}
          style={{ display: "flex", gap: 8, marginTop: 12 }}
        >
          <input
            aria-label="Stock symbol"
            value={typed}
            onChange={event => setTyped(event.target.value.toUpperCase())}
            placeholder="Symbol"
            style={{
              flex: 1,
              background: "#0B1016",
              color: "#F4F7FB",
              border: "1px solid rgba(0,212,255,0.35)",
              borderRadius: 8,
              padding: "8px 10px",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          />
          <button type="submit" style={{ background: "transparent", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.45)", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
            Read
          </button>
        </form>
      )}
      {query.isError && (
        <p style={{ color: "#E7C27A", fontSize: 13, lineHeight: 1.5 }}>
          The shared thesis could not be loaded. No substitute conclusion is shown.
        </p>
      )}
      {thesis && (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {SECTION_ORDER.map(id => {
            const part = thesis.sections[id];
            const partItems = thesis.items.filter(entry => entry.section === id);
            return (
              <article key={id}>
                <h3 style={{ margin: 0, color: "#00D4FF", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>{part.title}</h3>
                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: "#D5DEE8" }}>{part.summary}</p>
                <p data-thesis-attribution={surface} style={{ margin: "6px 0 0", color: "#8EA0B5", fontSize: 10, letterSpacing: "0.04em", lineHeight: 1.45 }}>
                  {partItems.length
                    ? partItems.map(entry => `${entry.kind} · ${entry.epistemic} · ${entry.source} · ${stamp(entry.timestamp)}`).join(" | ")
                    : "No attributed item"}
                </p>
                {id === "next" && thesis.sections.next.scenarios.map(scenario => (
                  <details key={scenario.id} style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", color: "#FFD700" }}>{scenario.title} · {scenario.confidence} evidence</summary>
                    <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55 }}>{scenario.narrative}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#C9D5E3" }}>{scenario.invalidation}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8EA0B5" }}>{scenario.assumptions.join(" ")}</p>
                  </details>
                ))}
                {!compact && (
                  <details>
                    <summary style={{ cursor: "pointer", color: "#8EA0B5", fontSize: 11, marginTop: 6 }}>Evidence</summary>
                    <EvidenceList items={partItems} />
                  </details>
                )}
              </article>
            );
          })}
          <details open={!compact}>
            <summary style={{ cursor: "pointer", color: "#FFD700" }}>What this read does not have</summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#C9D5E3", fontSize: 13, lineHeight: 1.5 }}>
              {thesis.gaps.map(entry => <li key={entry.field}>{entry.reason}</li>)}
            </ul>
          </details>
          {thesis.persistence && (
            <p style={{ margin: 0, color: "#8EA0B5", fontSize: 11 }}>{thesis.persistence.reason}</p>
          )}
        </div>
      )}
    </section>
  );
}
