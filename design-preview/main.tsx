import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { IntelligenceCoreExperience } from "../client/src/components/intelligence-core-visual/IntelligenceCoreExperience";
import {
  getPreviewModel,
  refreshPreviewAfterExpiry,
  schedulePreviewExpiry,
  transitionPreviewModel,
  type PreviewTransitionAction,
} from "./fixtures";
import "./preview.css";

const STATES = [
  { id: "unavailable", label: "Production-safe unavailable" },
  { id: "demo", label: "Mixed evidence demonstration" },
  { id: "degraded", label: "Degraded demonstration" },
  { id: "records", label: "Track Record demonstration" },
  { id: "transitions", label: "Evidence transition demonstration" },
];
function Preview() {
  const requested =
    new URLSearchParams(window.location.search).get("state") || "unavailable";
  const initial = STATES.some(item => item.id === requested)
    ? requested
    : "unavailable";
  const [state, setState] = useState(initial);
  const [model, setModel] = useState(() => getPreviewModel(initial));
  const [destination, setDestination] = useState("now");
  const [message, setMessage] = useState("");
  const [expiryPending, setExpiryPending] = useState(false);
  const sequence = useRef(0);
  const expiryTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (expiryTimer.current !== null)
        window.clearTimeout(expiryTimer.current);
    },
    []
  );
  const navigate = (id: string) => {
    setDestination(id);
    setMessage(
      `Host integration example: open /app/${id}. This isolated preview does not connect to production navigation or market APIs.`
    );
    if (id === "outlook")
      document
        .querySelector("[aria-label*='cenario']")
        ?.scrollIntoView({ block: "center", behavior: "auto" });
  };
  const transition = (action: PreviewTransitionAction) => {
    sequence.current += 1;
    setModel(previous =>
      transitionPreviewModel(previous, action, sequence.current)
    );
    setMessage(
      "Fictional snapshot supplied manually. Highlights show its admitted changes, not artificial live activity."
    );
  };
  const expire = () => {
    const deadline = Date.now() + 1100;
    setExpiryPending(true);
    setModel(previous => schedulePreviewExpiry(previous, deadline));
    setMessage(
      "Fictional source validity ends in about one second. Its actual elapsed deadline will make the retained observation stale."
    );
    expiryTimer.current = window.setTimeout(
      () => {
        setModel(previous => refreshPreviewAfterExpiry(previous));
        setExpiryPending(false);
        setMessage(
          "Fictional liquidity observation expired at its declared source deadline. The current pressure and regime claims are withheld."
        );
        expiryTimer.current = null;
      },
      Math.max(1, deadline - Date.now() + 25)
    );
  };
  const creditCurrent =
    model.domains.find(item => item.id === "credit")?.status === "current";
  const liquidityCurrent =
    model.domains.find(item => item.id === "liquidity")?.status === "current";
  return (
    <>
      <div className="preview-warning">
        ISOLATED VISUAL BUILD · NOT CONNECTED TO PRODUCTION · NO PROVIDER
        REQUESTS
      </div>
      <header className="preview-header">
        <a
          href="/"
          className="preview-brand"
          aria-label="FAULTLINE preview home"
        >
          <svg width="27" height="31" viewBox="0 0 27 31" aria-hidden="true">
            <path
              d="M2 28V3H24 M2 15H17 M10 3L7 12L15 18L11 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
          <span>
            FAULTLINE<span className="preview-brand-divider">/</span>
            <span className="preview-brand-descriptor">INTELLIGENCE</span>
          </span>
        </a>
        <nav aria-label="Existing FAULTLINE destination examples">
          {["now", "why", "outlook", "watch", "act"].map(id => (
            <button
              key={id}
              type="button"
              aria-current={destination === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              {id.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="preview-release">
          VISUAL REFINEMENT<span>PR #100 / approved baseline</span>
        </div>
      </header>
      <div className="preview-controls">
        <label htmlFor="preview-state">Preview setup</label>
        <select
          id="preview-state"
          value={state}
          onChange={event => {
            if (expiryTimer.current !== null) {
              window.clearTimeout(expiryTimer.current);
              expiryTimer.current = null;
            }
            setExpiryPending(false);
            setState(event.target.value);
            setModel(getPreviewModel(event.target.value));
            setMessage("");
            sequence.current = 0;
            const url = new URL(window.location.href);
            url.searchParams.set("state", event.target.value);
            window.history.replaceState(null, "", url);
          }}
        >
          {STATES.map(item => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <span>No merge. No flags. No deployment.</span>
      </div>
      {state === "transitions" && (
        <section
          className="preview-transition-controls"
          aria-label="Isolated fictional evidence transitions"
        >
          <div>
            <strong>Fictional snapshot controls</strong>
            <p>
              Manual source-backed fixture changes. No live market claims or
              looping activity.
            </p>
          </div>
          <div className="preview-transition-actions">
            <button
              type="button"
              onClick={() => transition("admit-credit")}
              disabled={creditCurrent || expiryPending}
            >
              Admit credit evidence
            </button>
            <button
              type="button"
              onClick={() => transition("regime")}
              disabled={
                !creditCurrent ||
                !liquidityCurrent ||
                expiryPending ||
                model.pressure.value === 65.1
              }
            >
              Change verified fixture regime
            </button>
            <button
              type="button"
              onClick={() => transition("relationship")}
              disabled={
                !creditCurrent ||
                !liquidityCurrent ||
                expiryPending ||
                model.relationships.length > 0
              }
            >
              Support an association
            </button>
            <button
              type="button"
              onClick={expire}
              disabled={!liquidityCurrent || expiryPending}
            >
              Expire liquidity observation
            </button>
          </div>
        </section>
      )}
      {message && (
        <div className="preview-host-message" role="status">
          {message}
        </div>
      )}
      <main>
        <IntelligenceCoreExperience
          key={state}
          model={model}
          onNavigate={navigate}
        />
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>
);
