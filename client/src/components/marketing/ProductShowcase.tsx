import { useState } from "react";
import { ArrowRight, Check, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getVerifiedCapturePath,
  SHOWCASE_EVIDENCE,
  type ShowcaseId,
} from "./showcaseEvidence";
import "./product-showcase.css";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65D6E5]";

export default function ProductShowcase() {
  const [activeId, setActiveId] = useState<ShowcaseId>(SHOWCASE_EVIDENCE[0].id);
  const [failedCaptureIds, setFailedCaptureIds] = useState<Set<ShowcaseId>>(
    () => new Set()
  );
  const active =
    SHOWCASE_EVIDENCE.find(item => item.id === activeId) ??
    SHOWCASE_EVIDENCE[0];
  const verifiedPath = getVerifiedCapturePath(active);
  const capturePath = failedCaptureIds.has(active.id) ? null : verifiedPath;
  const isPending = capturePath === null;

  const handleImageError = () =>
    setFailedCaptureIds(previous => new Set(previous).add(active.id));

  return (
    <section
      id="product-showcase"
      className="product-showcase"
      aria-labelledby="product-showcase-title"
    >
      <div className="product-showcase__shell">
        <header className="product-showcase__intro product-showcase__reveal">
          <p className="product-showcase__kicker">
            EVIDENCE-GATED PRODUCT GALLERY
          </p>
          <h2 id="product-showcase-title">
            Understand the intelligence. See the evidence.
          </h2>
          <p>
            Each view is held to the same capture standard: operational
            behavior, source provenance, timing, and public-safe review must be
            recorded before a product image can be shown.
          </p>
        </header>

        <div className="product-showcase__layout product-showcase__reveal">
          <div
            className="product-showcase__choices"
            role="group"
            aria-label="Product evidence views"
          >
            {SHOWCASE_EVIDENCE.map((item, index) => {
              const selected = item.id === active.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`product-showcase__choice ${selected ? "is-selected" : ""} ${FOCUS_RING}`}
                  onClick={() => setActiveId(item.id)}
                  aria-pressed={selected}
                  aria-controls="product-showcase-stage"
                >
                  <span
                    className="product-showcase__choice-index"
                    aria-hidden="true"
                  >
                    0{index + 1}
                  </span>
                  <span>{item.label}</span>
                  <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>

          <article
            id="product-showcase-stage"
            className="product-showcase__stage"
            aria-live="polite"
          >
            <div className="product-showcase__stage-head">
              <div>
                <p className="product-showcase__eyebrow">{active.eyebrow}</p>
                <h3>{active.title}</h3>
              </div>
              <span
                className={`product-showcase__status ${isPending ? "is-pending" : "is-verified"}`}
              >
                {isPending ? "VERIFIED CAPTURE PENDING" : "VERIFIED CAPTURE"}
              </span>
            </div>

            {capturePath ? (
              <div className="product-showcase__capture">
                <p className="product-showcase__note">
                  {active.verification.observationClassification?.toUpperCase()}{" "}
                  · Observation: {active.verification.observationAt} · Captured:{" "}
                  {active.verification.capturedAt}
                </p>
                <img
                  src={capturePath}
                  alt={active.imageAlt}
                  width={1600}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                  onError={handleImageError}
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className={`product-showcase__expand ${FOCUS_RING}`}
                    >
                      <Maximize2 aria-hidden="true" size={16} /> Expand verified
                      capture
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    className="product-showcase__dialog"
                    showCloseButton
                  >
                    <DialogHeader>
                      <DialogTitle>{active.title}</DialogTitle>
                      <DialogDescription>
                        Verified product capture ·{" "}
                        {active.verification.observationClassification} ·
                        Observation: {active.verification.observationAt} ·
                        Captured: {active.verification.capturedAt}
                      </DialogDescription>
                    </DialogHeader>
                    <img
                      src={capturePath}
                      alt={active.imageAlt}
                      width={1600}
                      height={1000}
                      loading="lazy"
                      decoding="async"
                      onError={handleImageError}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div
                className="product-showcase__placeholder"
                aria-label="Temporary design placeholder; verified capture pending"
              >
                <div
                  className="product-showcase__placeholder-mark"
                  aria-hidden="true"
                >
                  FL
                </div>
                <p className="product-showcase__placeholder-label">
                  TEMPORARY DESIGN PLACEHOLDER
                </p>
                <h4>{active.placeholderTitle}</h4>
                <p>{active.placeholderBody}</p>
                <p className="product-showcase__intent">
                  <strong>Intent only:</strong> {active.intent}
                </p>
              </div>
            )}

            <div className="product-showcase__stage-footer">
              <div>
                <p className="product-showcase__requirements-title">
                  VERIFICATION REQUIRED BEFORE DISPLAY
                </p>
                <ul className="product-showcase__requirements">
                  {active.verificationRequirements.map(requirement => (
                    <li key={requirement}>
                      <Check aria-hidden="true" size={15} strokeWidth={1.6} />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="/pressure-index"
                className={`product-showcase__cta ${FOCUS_RING}`}
              >
                Explore the public reading{" "}
                <ArrowRight aria-hidden="true" size={16} />
              </a>
            </div>
          </article>
        </div>

        <p className="product-showcase__note product-showcase__reveal">
          Candidate architecture and pending capabilities are intent
          descriptions, not promises. They remain subject to source and
          uncertainty review; no image expands until its complete verification
          record passes.
        </p>
      </div>
    </section>
  );
}
