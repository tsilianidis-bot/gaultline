import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const html = read("client/index.html");
const app = read("client/src/App.tsx");
const player = read("client/src/components/WebsitePressureIntro.tsx");

describe("cinematic first-paint shell", () => {
  it("paints the requested static market poster before React begins and contains no duplicate video", () => {
    const shell = html.indexOf('id="cinematic-first-paint"');
    const rootElement = html.indexOf('<div id="root"></div>');
    const appModule = html.indexOf('<script type="module" src="/src/main.tsx">');
    const shellMarkup = html.slice(shell, rootElement);

    expect(shell).toBeGreaterThan(-1);
    expect(shell).toBeLessThan(rootElement);
    expect(rootElement).toBeLessThan(appModule);
    expect(html).toContain('/media/brand-cinematic/cinematic-intro-market-poster.webp');
    expect(html).toContain('fetchpriority="high"');
    expect(html).toContain('SKIP INTRO →');
    expect(shellMarkup).not.toContain('<video');
  });

  it("mirrors the existing presentation-only guard and fails open", () => {
    expect(html).toContain('"fl_cinematic_completed_v1"');
    expect(html).toContain('"faultline_demo_session"');
    expect(html).toContain('"/blog"');
    expect(html).toContain('"/app/dashboard"');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).toContain('localStorage.setItem(COMPLETED_KEY, "1")');
    expect(html).toContain('window.setTimeout(dismiss, 10000)');
    expect(html).toContain('faultline:cinematic-shell-skip');
    expect(app).toContain("const CINEMATIC_COMPLETED_KEY = 'fl_cinematic_completed_v1'");
    expect(app).toContain('if (isDemoPath()) return false');
  });

  it("hands the shell to one player frame, then starts the existing homepage work", () => {
    expect(app).toContain('const websitePressureIntroModule = import("./components/WebsitePressureIntro")');
    expect(app).toContain('const [cinematicFrameReady, setCinematicFrameReady]');
    expect(app).toContain("window.dispatchEvent(new Event('faultline:cinematic-shell-dismiss'))");
    expect(app).toContain('onReady={handleCinematicFrameReady}');
    expect(app).toContain('if (introActive && cinematicFrameReady && !isProductPath)');
    expect(app).toContain('{cinematicFrameReady && <>');
    expect(app).toContain('handleCinematicFrameReady();');

    expect(player).toContain('onReady?: () => void');
    expect(player).toContain('onLoadedData={signalReady}');
    expect(player).toContain('onPlaying={() => { clearDeadline(); setPlaying(true); signalReady(); }}');
    expect(player).toContain('/media/brand-cinematic/cinematic-intro-market-desktop.mp4');
    expect(player).toContain('/media/brand-cinematic/cinematic-intro-market-mobile.mp4');
  });

  it("does not treat a saved first-visit completion as a Skip during explicit replay", () => {
    expect(app).toContain('if (!introActive || storyReplay || cinematicFrameReady) return;');
    expect(app).toContain('[introActive, storyReplay, cinematicFrameReady, skipLoadingStory]');
  });

  it("prefers sound-on effects and preserves autoplay with a clear browser-policy fallback", () => {
    expect(player).toContain('const [muted, setMuted] = useState(false)');
    expect(player).toContain('video.muted = false;');
    expect(player).toContain('error.name === "NotAllowedError"');
    expect(player).toContain('setSoundBlocked(true)');
    expect(player).toContain('Tap for sound');
  });
});
