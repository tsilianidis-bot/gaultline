import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { trackIntroEvent, type IntroMode } from "@/lib/introAnalytics";
import "./WebsitePressureIntro.css";

export interface WebsitePressureIntroProps {
  onComplete: () => void;
  onReveal?: () => void;
  onReady?: () => void;
  mode?: IntroMode;
}

type ExitReason = "completed" | "skipped" | "video_error" | "playback_failed" | "load_timeout" | "reduced_motion" | "static_overview";
const POSTER = "/media/brand-cinematic/cinematic-intro-market-poster.webp";
const DESKTOP = "/media/brand-cinematic/cinematic-intro-market-desktop.mp4";
const MOBILE = "/media/brand-cinematic/cinematic-intro-market-mobile.mp4";
const REDUCED = "(prefers-reduced-motion: reduce)";
const CROSSFADE_MS = 180;
const LOAD_DEADLINE_MS = 5000;

export default function WebsitePressureIntro({ onComplete, onReveal, onReady, mode = "first_visit" }: WebsitePressureIntroProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onComplete, onReveal, onReady });
  const finished = useRef(false);
  const impressionSent = useRef(false);
  const readinessSent = useRef(false);
  const resumeOnVisible = useRef(false);
  const sourceKind = useRef<"desktop" | "mobile" | "none">("none");
  const deadline = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia(REDUCED).matches);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => { callbacks.current = { onComplete, onReveal, onReady }; }, [onComplete, onReveal, onReady]);
  const signalReady = useCallback(() => {
    setReady(true);
    if (!readinessSent.current) {
      readinessSent.current = true;
      callbacks.current.onReady?.();
    }
  }, []);
  const clearDeadline = useCallback(() => {
    window.clearTimeout(deadline.current);
    deadline.current = undefined;
  }, []);

  const finish = useCallback((reason: ExitReason) => {
    if (finished.current) return;
    finished.current = true;
    clearDeadline();
    const video = videoRef.current;
    video?.pause(); // Retain the final identity frame during the crossfade.
    const failed = ["video_error", "playback_failed", "load_timeout"].includes(reason);
    trackIntroEvent(failed ? "intro_failed" : reason === "completed" ? "intro_completed" : "intro_skipped", {
      mode, reason, elapsed_seconds: Math.round((video?.currentTime ?? 0) * 10) / 10,
      muted: video?.muted ?? true, source: sourceKind.current,
    });
    callbacks.current.onReveal?.(); // Reveal the already-mounted homepage in the same interaction.
    setExiting(true);
    if (failed || reason === "reduced_motion") callbacks.current.onComplete();
    else exitTimer.current = window.setTimeout(() => callbacks.current.onComplete(), reducedMotion ? 0 : CROSSFADE_MS);
  }, [clearDeadline, mode, reducedMotion]);

  const armDeadline = useCallback(() => {
    clearDeadline();
    if (!finished.current) deadline.current = window.setTimeout(() => finish("load_timeout"), LOAD_DEADLINE_MS);
  }, [clearDeadline, finish]);

  useEffect(() => {
    if (!impressionSent.current) {
      impressionSent.current = true;
      trackIntroEvent("intro_impression", { mode, muted: false, source: "none" });
    }
    if (reducedMotion) {
      if (mode === "first_visit") finish("reduced_motion");
      return;
    }
    // Prefer effects with sound. Browser policy may require a muted first play;
    // preserve automatic video playback and offer an explicit sound gesture.
    const frame = window.requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video || finished.current) return;
      const mobile = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
      sourceKind.current = mobile ? "mobile" : "desktop";
      video.muted = false;
      video.volume = 1;
      video.src = mobile ? MOBILE : DESKTOP;
      armDeadline();
      void video.play().catch((error: unknown) => {
        if (finished.current) return;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          video.muted = true;
          setMuted(true);
          setSoundBlocked(true);
          void video.play().catch(() => finish("playback_failed"));
        } else finish("playback_failed");
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, reducedMotion, finish, armDeadline]);

  useEffect(() => {
    const query = window.matchMedia(REDUCED);
    const change = () => {
      setReducedMotion(query.matches);
      if (query.matches) finish("reduced_motion");
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, [finish]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const video = videoRef.current;
    const focusTimer = window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(exitTimer.current);
      clearDeadline();
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [clearDeadline]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); finish("skipped"); } };
    const onHidden = () => {
      const video = videoRef.current;
      if (document.hidden) {
        resumeOnVisible.current = !!video && !video.paused && !finished.current;
        clearDeadline();
        video?.pause();
      } else if (resumeOnVisible.current && video && !finished.current) {
        resumeOnVisible.current = false;
        armDeadline();
        void video.play().catch(() => finish("playback_failed"));
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHidden);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onHidden); };
  }, [finish, clearDeadline, armDeadline]);

  const togglePause = () => {
    const video = videoRef.current;
    if (!video || finished.current) return;
    if (video.paused) { armDeadline(); void video.play().catch(() => finish("playback_failed")); }
    else { clearDeadline(); video.pause(); }
  };
  const toggleSound = () => {
    const video = videoRef.current;
    if (!video || finished.current) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    setSoundBlocked(false);
    if (!video.muted && video.paused) {
      void video.play().catch(() => {
        video.muted = true;
        setMuted(true);
        setSoundBlocked(true);
      });
    }
  };
  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []).filter(el => el.getClientRects().length > 0);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls[controls.length - 1], active = document.activeElement;
    if (!controls.some(el => el === active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <section ref={dialogRef} className={`website-pressure-intro${ready ? " website-pressure-intro--video-ready" : ""}${exiting ? " website-pressure-intro--exiting" : ""}`}
      role="dialog" aria-modal="true" aria-labelledby="website-pressure-intro-title" onKeyDown={trapFocus}>
      <div className="website-pressure-intro__poster" aria-hidden="true"><img src={POSTER} alt="" /></div>
      {!reducedMotion && <video ref={videoRef} className="website-pressure-intro__video" autoPlay playsInline preload="metadata" poster={POSTER} muted={muted}
        onLoadedData={signalReady}
        onPlaying={() => { clearDeadline(); setPlaying(true); signalReady(); }}
        onPause={() => setPlaying(false)} onWaiting={armDeadline}
        onEnded={() => finish("completed")} onError={() => finish("video_error")} />}
      <div className="website-pressure-intro__scrim" aria-hidden="true" />
      <button type="button" className="website-pressure-intro__skip" disabled={exiting} onClick={() => finish("skipped")} aria-label="Skip intro">SKIP INTRO <span aria-hidden="true">→</span></button>
      <div className={reducedMotion ? "website-pressure-intro__brand" : "sr-only"}>
        <h1 ref={headingRef} id="website-pressure-intro-title" className="website-pressure-intro__wordmark" tabIndex={-1}>FAULT<span>LINE</span></h1>
      </div>
      <div className="website-pressure-intro__controls" aria-label="Opening presentation controls">
        {reducedMotion ? <>
          <p className="website-pressure-intro__status">Reduced motion · static story overview</p>
          <button type="button" className="website-pressure-intro__button website-pressure-intro__button--primary" onClick={() => finish("static_overview")}>Continue to FAULTLINE</button>
        </> : <>
          <button type="button" className="website-pressure-intro__button" disabled={exiting} onClick={togglePause} aria-label={playing ? "Pause opening" : "Play opening"}>{playing ? "Pause opening" : "Play opening"}</button>
          <button type="button" className={`website-pressure-intro__button${soundBlocked ? " website-pressure-intro__button--primary" : ""}`} disabled={exiting || !ready} onClick={toggleSound} aria-pressed={!muted} aria-label={soundBlocked ? "Tap for sound" : muted ? "Turn sound on" : "Mute sound"}>{soundBlocked ? "Tap for sound" : `Sound: ${muted ? "off" : "on"}`}</button>
        </>}
      </div>
    </section>
  );
}
