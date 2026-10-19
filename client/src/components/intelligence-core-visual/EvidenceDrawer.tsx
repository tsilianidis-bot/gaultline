import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, FileSearch, Link2, X } from "lucide-react";
import { useRef } from "react";
import type { CoreDomain, IntelligenceCoreViewModel } from "./types";
import { observationLabel, StatusBadge } from "./CoreTopology";
import "./evidence-refinement.css";

export interface EvidenceSelection {
  title: string;
  ids: string[];
  domain?: CoreDomain;
}
function safeSourceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function ObservationTimestamp({ value }: { value: string | null }) {
  const label = observationLabel(value);
  if (!value || !Number.isFinite(Date.parse(value))) return <>{label}</>;

  return <time dateTime={value}>{label}</time>;
}

export function EvidenceDrawer({
  selection,
  model,
  onClose,
}: {
  selection: EvidenceSelection | null;
  model: IntelligenceCoreViewModel;
  onClose: () => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  // Resolve by ID on every render so a drawer opened from an older interaction
  // never presents a retained domain snapshot after the sanitized model updates.
  const selectedDomainId = selection?.domain?.id;
  const domain = selectedDomainId
    ? model.domains.find(item => item.id === selectedDomainId)
    : undefined;
  const selectedIds = domain?.evidenceIds || selection?.ids || [];
  const evidence = model.evidence.filter(item => selectedIds.includes(item.id));
  const relationships = model.relationships.filter(
    item =>
      domain &&
      item.supported &&
      (item.from === domain.id || item.to === domain.id)
  );
  return (
    <Dialog.Root
      open={Boolean(selection)}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fic-drawer-overlay" />
        <Dialog.Content
          className="fic fic-drawer"
          onOpenAutoFocus={() => {
            const activeElement = document.activeElement;
            if (
              activeElement instanceof HTMLElement &&
              !activeElement.closest(".fic-drawer")
            ) {
              opener.current = activeElement;
            }
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <header className="fic-drawer-header">
            <span className="fic-micro">EVIDENCE / INTELLIGENCE LINEAGE</span>
            <Dialog.Close
              className="fic-icon-button"
              aria-label="Close evidence panel"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Title className="fic-drawer-title">
            {selection?.title || "Evidence"}
          </Dialog.Title>
          <Dialog.Description className="fic-drawer-description">
            Source observations and analytical context, kept separate from
            current market claims.
          </Dialog.Description>
          {model.mode === "demonstration" && (
            <div className="fic-demo-notice">
              DEMONSTRATION ONLY — every observation here is a fictional design
              fixture, not live or historical market evidence.
            </div>
          )}
          {domain && (
            <div className="fic-drawer-domain">
              <StatusBadge status={domain.status} />
              <h3>What this means</h3>
              <p>
                {domain.assessment ||
                  "Not supplied by canonical Core. This is not an all-clear signal."}
              </p>
              <h3>Why it matters</h3>
              <p>{domain.significance}</p>
              <h3>Market context</h3>
              <p>
                {domain.context ||
                  "No evidence-supported market relationship has been connected."}
              </p>
              <dl className="fic-detail-facts">
                <div className="fic-detail-fact">
                  <dt>Last source observation</dt>
                  <dd>
                    <ObservationTimestamp value={domain.observationAt} />
                  </dd>
                </div>
                <div className="fic-detail-fact fic-detail-fact--evidence-quality">
                  <dt>Evidence quality</dt>
                  <dd>
                    <StatusBadge status={domain.status} />
                  </dd>
                </div>
                <div className="fic-detail-fact fic-detail-fact--confidence">
                  <dt>Calibrated confidence</dt>
                  <dd>
                    {domain.confidence ?? "Not supplied by canonical Core"}
                  </dd>
                </div>
                <div className="fic-detail-fact">
                  <dt>Developing since</dt>
                  <dd>
                    {domain.developingSince ? (
                      <ObservationTimestamp value={domain.developingSince} />
                    ) : (
                      "Not supplied by canonical Core"
                    )}
                  </dd>
                </div>
                <div className="fic-detail-fact">
                  <dt>Historical comparison</dt>
                  <dd>
                    {domain.historicalComparison ||
                      "Not supplied by canonical Core"}
                  </dd>
                </div>
                <div className="fic-detail-fact fic-detail-fact--conditions">
                  <dt>Confirmation conditions</dt>
                  <dd>
                    {domain.confirmationConditions?.length
                      ? domain.confirmationConditions.join(" · ")
                      : "Not supplied by canonical Core"}
                  </dd>
                </div>
                <div className="fic-detail-fact fic-detail-fact--conditions">
                  <dt>Invalidation conditions</dt>
                  <dd>
                    {domain.invalidationConditions?.length
                      ? domain.invalidationConditions.join(" · ")
                      : "Not supplied by canonical Core"}
                  </dd>
                </div>
                <div className="fic-detail-fact fic-detail-fact--pressure-contribution">
                  <dt>Pressure contribution</dt>
                  <dd>
                    {domain.pressureContribution ??
                      "Not supplied by canonical Core"}
                  </dd>
                </div>
                <div className="fic-detail-fact fic-detail-fact--previous-observation">
                  <dt>Previous observation</dt>
                  <dd>
                    {domain.previousObservation ??
                      "Not supplied by canonical Core"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          <div className="fic-drawer-section-heading">
            <h3>Supporting evidence</h3>
            <span className="fic-micro">{evidence.length} CONNECTED</span>
          </div>
          {evidence.length === 0 ? (
            <div className="fic-evidence-empty">
              <FileSearch size={26} strokeWidth={1.3} />
              <h4>No verified evidence connected</h4>
              <p>
                When an admitted source observation is available, its value,
                original timestamp, classification and lineage will appear here.
                Missing data is not a zero or a neutral signal.
              </p>
            </div>
          ) : (
            evidence.map(item => {
              const url = safeSourceUrl(item.sourceUrl);
              return (
                <article className="fic-evidence-item" key={item.id}>
                  <div className="fic-evidence-top">
                    <StatusBadge status={item.status} />
                    <span className="fic-micro">{item.id}</span>
                  </div>
                  <h4>{item.label}</h4>
                  <div className="fic-evidence-value">
                    {item.value ?? "Value withheld"}
                  </div>
                  <p>{item.explanation}</p>
                  <dl className="fic-detail-facts">
                    <div className="fic-detail-fact">
                      <dt>Source</dt>
                      <dd>{item.source || "Source unavailable"}</dd>
                    </div>
                    <div className="fic-detail-fact">
                      <dt>Observation</dt>
                      <dd>
                        <ObservationTimestamp value={item.observationAt} />
                      </dd>
                    </div>
                    <div
                      className={`fic-detail-fact fic-detail-fact--validity fic-detail-fact--${item.status}`}
                    >
                      <dt>Evidence validity deadline</dt>
                      <dd>
                        {item.validUntil ? (
                          <ObservationTimestamp value={item.validUntil} />
                        ) : (
                          "Not supplied by canonical Core"
                        )}
                      </dd>
                    </div>
                  </dl>
                  {url && (
                    <a
                      className="fic-evidence-link"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Inspect original source <ArrowUpRight size={15} />
                    </a>
                  )}
                </article>
              );
            })
          )}
          {relationships.length > 0 && (
            <section className="fic-relationship-list">
              <h3>Evidence-supported relationships</h3>
              {relationships.map(item => (
                <article key={item.id}>
                  <span
                    className={`fic-micro fic-relationship-kind is-${item.kind}`}
                  >
                    <Link2 size={13} />{" "}
                    {item.kind === "causal"
                      ? "CAUSAL · EVIDENCE-SUPPORTED"
                      : "ASSOCIATION · NOT CAUSATION"}
                  </span>
                  <p>{item.explanation}</p>
                  <span className="fic-source-reference">
                    {item.evidenceIds.length > 0
                      ? `Evidence: ${item.evidenceIds.join(", ")}`
                      : "No evidence identifiers were supplied."}
                  </span>
                </article>
              ))}
            </section>
          )}
          <footer className="fic-drawer-footer">
            Observation time is not request time. Delayed, stale, modeled and
            degraded inputs are never presented as verified current
            measurements.
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
