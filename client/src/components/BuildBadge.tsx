/**
 * BuildBadge — fixed bottom-right badge showing the deployed commit hash and build time.
 * Fetches from /api/build-info which reads BUILD_COMMIT + BUILD_TIME env vars injected at deploy time.
 * Allows Richard to confirm which version is live at getfaultline.live.
 *
 * IMPORTANT: z-index is set to 40 (below the mobile bottom tab bar at z-50) and
 * bottom is offset above the tab bar (~60px) so it never intercepts tab bar taps.
 */

import { useEffect, useState } from "react";

interface BuildInfo {
  commit: string;
  buildTime: string;
  nodeEnv: string;
}

function formatBuildTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").substring(0, 16) + " UTC";
  } catch {
    return iso;
  }
}

export function BuildBadge() {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/build-info")
      .then((r) => r.json())
      .then((d: BuildInfo) => setInfo(d))
      .catch(() => setInfo({ commit: "unknown", buildTime: "", nodeEnv: "unknown" }));
  }, []);

  if (!info) return null;

  const commit = info.commit === "dev" ? "dev" : info.commit.substring(0, 7);

  return (
    <div
      style={{
        position: "fixed",
        /* Sit above the mobile bottom tab bar (~60px) + device safe-area.
           On desktop (no tab bar) this just floats 60px from the bottom edge. */
        bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
        right: 0,
        /* Below the mobile tab bar (z-50) and all overlays — purely informational */
        zIndex: 40,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: "10px",
        lineHeight: 1.4,
        userSelect: "none",
        pointerEvents: "auto",
      }}
    >
      {expanded ? (
        <div
          onClick={() => setExpanded(false)}
          style={{
            background: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(0,229,255,0.3)",
            borderRadius: "6px 0 0 0",
            padding: "6px 10px",
            color: "rgba(0,229,255,0.9)",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>FAULTLINE BUILD</div>
          <div>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>commit </span>
            <span style={{ color: "#00e5ff", fontWeight: 700 }}>{commit}</span>
          </div>
          {info.buildTime && (
            <div>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>built  </span>
              <span style={{ color: "#a0f0a0" }}>{formatBuildTime(info.buildTime)}</span>
            </div>
          )}
          <div>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>env    </span>
            <span style={{ color: "rgba(255,200,100,0.8)" }}>{info.nodeEnv}</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.25)", marginTop: 2, fontSize: 9 }}>click to collapse</div>
        </div>
      ) : (
        <div
          onClick={() => setExpanded(true)}
          title={`Build: ${commit}${info.buildTime ? ` | ${formatBuildTime(info.buildTime)}` : ""}`}
          style={{
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(0,229,255,0.2)",
            borderRadius: "4px 0 0 0",
            padding: "3px 7px",
            color: "rgba(0,229,255,0.6)",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            letterSpacing: "0.05em",
          }}
        >
          {commit}
        </div>
      )}
    </div>
  );
}
