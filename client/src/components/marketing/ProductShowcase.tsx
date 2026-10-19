import { useState } from "react";
import { ArrowRight, Maximize2, Minus, Plus } from "lucide-react";
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
  type ShowcaseEvidence,
} from "./showcaseEvidence";
import "./product-showcase.css";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65D6E5]";

function VerifiedCapture({
  evidence,
  onError,
}: {
  evidence: ShowcaseEvidence;
  onError: () => void;
}) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [zoom, setZoom] = useState(1);
  const gate = evidence.verification;
  const path =
    viewport === "desktop" ? gate.actualCapturePath! : gate.mobileCapturePath!;
  const width = viewport === "desktop" ? gate.desktopWidth! : gate.mobileWidth!;
  const height =
    viewport === "desktop" ? gate.desktopHeight! : gate.mobileHeight!;
  const selectViewport = (value: "desktop" | "mobile") => {
    setViewport(value);
    setZoom(1);
  };

  return (
    <div className="product-showcase__capture">
      <p className="product-showcase__provenance">
        {gate.observationClassification?.toUpperCase()} · Observation:{" "}
        {gate.observationAt} · Captured: {gate.capturedAt}
        <br />
        Source: {gate.sourceBranch} · Commit: {gate.sourceSha}
      </p>
      <div
        role="group"
        aria-label="Screenshot viewport"
        className="product-showcase__viewport-controls"
      >
        <button
          type="button"
          className={FOCUS_RING}
          aria-pressed={viewport === "desktop"}
          onClick={() => selectViewport("desktop")}
        >
          Desktop capture
        </button>
        <button
          type="button"
          className={FOCUS_RING}
          aria-pressed={viewport === "mobile"}
          onClick={() => selectViewport("mobile")}
        >
          Mobile capture
        </button>
      </div>
      <img
        key={path}
        src={path}
        alt={`${evidence.imageAlt} ${viewport} capture.`}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onError={onError}
        className={
          viewport === "mobile" ? "product-showcase__mobile-image" : undefined
        }
      />
      <Dialog onOpenChange={() => setZoom(1)}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={`product-showcase__expand ${FOCUS_RING}`}
          >
            <Maximize2 aria-hidden="true" size={16} /> Expand verified capture
          </button>
        </DialogTrigger>
        <DialogContent className="product-showcase__dialog" showCloseButton>
          <DialogHeader>
            <DialogTitle>{evidence.title}</DialogTitle>
            <DialogDescription>
              Verified {viewport} product capture ·{" "}
              {gate.observationClassification} · Observation:{" "}
              {gate.observationAt} · Captured: {gate.capturedAt}. Source commit:{" "}
              {gate.sourceSha}.
            </DialogDescription>
          </DialogHeader>
          <div
            role="group"
            aria-label="Screenshot zoom"
            className="product-showcase__zoom-controls"
          >
            <button
              type="button"
              className={FOCUS_RING}
              disabled={zoom === 1}
              onClick={() => setZoom(value => Math.max(1, value - 0.25))}
              aria-label="Zoom out"
            >
              <Minus aria-hidden="true" size={15} />
            </button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className={FOCUS_RING}
              disabled={zoom === 2}
              onClick={() => setZoom(value => Math.min(2, value + 0.25))}
              aria-label="Zoom in"
            >
              <Plus aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              className={FOCUS_RING}
              onClick={() => setZoom(1)}
            >
              Reset zoom
            </button>
          </div>
          <div
            className="product-showcase__zoom-area"
            tabIndex={0}
            role="region"
            aria-label="Expanded screenshot; scroll to inspect when zoomed"
          >
            <img
              src={path}
              alt={`${evidence.imageAlt} ${viewport} capture.`}
              width={width}
              height={height}
              loading="lazy"
              decoding="async"
              onError={onError}
              style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
            Explore what each view is designed to clarify. Actual product
            captures appear only after source, operational and privacy
            qualification; pending views stay visibly labeled.
          </p>
        </header>
        <div className="product-showcase__layout product-showcase__reveal">
          <div
            className="product-showcase__choices"
            role="group"
            aria-label="Product evidence views"
          >
            {SHOWCASE_EVIDENCE.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`product-showcase__choice ${item.id === active.id ? "is-selected" : ""} ${FOCUS_RING}`}
                onClick={() => setActiveId(item.id)}
                aria-pressed={item.id === active.id}
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
            ))}
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
            {active.benefit && (
              <p className="product-showcase__benefit">
                <strong>
                  {isPending
                    ? "Intended investor benefit: "
                    : "Investor benefit: "}
                </strong>
                {active.benefit}
              </p>
            )}
            <div key={active.id} className="product-showcase__selection">
              {capturePath ? (
                <VerifiedCapture evidence={active} onError={handleImageError} />
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
                  {active.promotionBlockers && (
                    <div className="product-showcase__blockers">
                      <p>WHAT PREVENTS PROMOTION</p>
                      <ul>
                        {active.promotionBlockers.map(blocker => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="product-showcase__stage-footer">
              <div>
                <p className="product-showcase__requirements-title">
                  {isPending
                    ? "VERIFICATION REQUIRED BEFORE DISPLAY"
                    : "QUALIFICATION RECORDED"}
                </p>
                <ul className="product-showcase__requirements">
                  {active.verificationRequirements.map(requirement => (
                    <li key={requirement}>
                      <ArrowRight
                        aria-hidden="true"
                        size={15}
                        strokeWidth={1.6}
                      />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={active.publicDemoHref ?? "/pressure-index"}
                className={`product-showcase__cta ${FOCUS_RING}`}
              >
                {active.publicDemoLabel ?? "Explore the public reading"}
                <ArrowRight aria-hidden="true" size={16} />
              </a>
            </div>
          </article>
        </div>
        <p className="product-showcase__note product-showcase__reveal">
          Pending capabilities describe intent, not operational availability. A
          page render or fixture test is not source verification. No image
          expands before its complete desktop/mobile capture qualification
          passes.
        </p>
      </div>
    </section>
  );
}
