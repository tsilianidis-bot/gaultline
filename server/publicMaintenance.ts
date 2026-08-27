/**
 * Temporary public presentation boundary.
 *
 * This gate deliberately leaves API, scheduled, auth, storage, and asset routes untouched.
 * Set FAULTLINE_MAINTENANCE_MODE=false in the deployment environment to resume normal public
 * SPA delivery without changing any intelligence, database, or application behavior.
 */
export const PUBLIC_MAINTENANCE_ACTIVE = process.env.FAULTLINE_MAINTENANCE_MODE !== "false";

const NON_PUBLIC_PREFIXES = ["/api/", "/assets/", "/manus-storage/"];
const NON_PAGE_PATHS = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml", "/manifest.json"]);

export function shouldServePublicMaintenance(method: string, path: string): boolean {
  if (!PUBLIC_MAINTENANCE_ACTIVE) return false;
  if (method !== "GET" && method !== "HEAD") return false;
  if (NON_PAGE_PATHS.has(path)) return false;
  return !NON_PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

export function renderPublicMaintenancePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>FAULTLINE — Maintenance</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #050608; color: #e8f5fa; font-family: "IBM Plex Sans", Arial, sans-serif; }
    main { position: relative; min-height: 100vh; display: grid; place-items: center; overflow: hidden; padding: 32px 24px; isolation: isolate; }
    main::before { content: ""; position: absolute; z-index: -2; width: min(880px, 92vw); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, rgba(0, 212, 255, .13), rgba(0, 212, 255, 0) 68%); filter: blur(8px); }
    main::after { content: ""; position: absolute; z-index: -1; inset: 0; opacity: .3; background-image: linear-gradient(rgba(0, 212, 255, .08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, .08) 1px, transparent 1px); background-size: 72px 72px; mask-image: radial-gradient(ellipse at center, #000 0%, transparent 72%); }
    .panel { width: min(650px, 100%); border: 1px solid rgba(0, 212, 255, .23); background: rgba(8, 14, 20, .9); box-shadow: 0 0 90px rgba(0, 212, 255, .08), inset 0 1px 0 rgba(255, 255, 255, .04); padding: clamp(40px, 8vw, 76px) clamp(28px, 7vw, 70px); text-align: center; }
    .mark { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 44px; color: #00d4ff; font-family: "IBM Plex Mono", "Courier New", monospace; font-size: 11px; font-weight: 700; letter-spacing: .26em; }
    .mark::before { content: ""; display: block; width: 8px; height: 8px; border: 1px solid #00d4ff; box-shadow: 0 0 14px #00d4ff; transform: rotate(45deg); }
    h1 { margin: 0 0 24px; color: #f0fbff; font-size: clamp(28px, 5vw, 44px); font-weight: 600; letter-spacing: -.025em; line-height: 1.12; }
    p { max-width: 510px; margin: 0 auto; color: #a8bcc5; font-size: clamp(16px, 2.6vw, 18px); line-height: 1.66; }
    p + p { margin-top: 18px; }
    .status { display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 42px; color: #6c8996; font-family: "IBM Plex Mono", "Courier New", monospace; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; }
    .status i { width: 6px; height: 6px; border-radius: 50%; background: #00d4ff; box-shadow: 0 0 10px rgba(0, 212, 255, .85); }
    @media (max-width: 480px) { main { padding: 18px; } .panel { padding: 48px 26px; } .mark { margin-bottom: 34px; } }
  </style>
</head>
<body>
  <main>
    <section class="panel" aria-labelledby="maintenance-title">
      <div class="mark" aria-label="FAULTLINE">FAULTLINE</div>
      <h1 id="maintenance-title">FAULTLINE is temporarily undergoing system maintenance and infrastructure upgrades.</h1>
      <p>We’re working to restore full market intelligence functionality as quickly as possible.</p>
      <p>No user action is required. Please check back shortly.</p>
      <div class="status" aria-label="Maintenance in progress"><i></i> System maintenance</div>
    </section>
  </main>
</body>
</html>`;
}
