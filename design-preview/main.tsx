import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { IntelligenceCoreExperience } from "../client/src/components/intelligence-core-visual/IntelligenceCoreExperience";
import { getPreviewModel } from "./fixtures";
import "./preview.css";

const STATES = [
  { id: "unavailable", label: "Production-safe unavailable" },
  { id: "demo", label: "Mixed evidence demonstration" },
  { id: "degraded", label: "Degraded demonstration" },
  { id: "records", label: "Track Record demonstration" },
];
function Preview() {
  const initial =
    new URLSearchParams(window.location.search).get("state") || "unavailable";
  const [state, setState] = useState(
    STATES.some(item => item.id === initial) ? initial : "unavailable"
  );
  const [destination, setDestination] = useState("now");
  const [message, setMessage] = useState("");
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
          VISUAL DRAFT <span>release-r3 / 1cb5dee</span>
        </div>
      </header>
      <div className="preview-controls">
        <label htmlFor="preview-state">Preview setup</label>
        <select
          id="preview-state"
          value={state}
          onChange={event => {
            setState(event.target.value);
            setMessage("");
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
      {message && (
        <div className="preview-host-message" role="status">
          {message}
        </div>
      )}
      <main>
        <IntelligenceCoreExperience
          key={state}
          model={getPreviewModel(state)}
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
