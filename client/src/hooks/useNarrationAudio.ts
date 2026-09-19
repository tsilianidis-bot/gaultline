import { useCallback, useEffect, useRef, useState } from "react";

// Narration files lived on Manus object storage and are not bundled.
const NARRATION_URLS: Record<number, string> = {};

// Narration volume relative to the synthesized soundscape
// The synthesized audio is ducked to 0.15 during narration, so the voice
// sits clearly above the ambient bed without overwhelming it.
const NARRATION_VOLUME = 0.92;

export function useNarrationAudio() {
  const audioRefs = useRef<Record<number, HTMLAudioElement>>({});
  const currentRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const mutedRef = useRef(false);

  // ── Preload all five scenes ───────────────────────────────
  useEffect(() => {
    Object.entries(NARRATION_URLS).forEach(([scene, url]) => {
      if (!url) return;
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.volume = NARRATION_VOLUME;
      audioRefs.current[Number(scene)] = audio;
    });

    return () => {
      // Stop and release all audio on unmount
      Object.values(audioRefs.current).forEach(a => {
        a.pause();
        a.src = "";
      });
      audioRefs.current = {};
      currentRef.current = null;
    };
  }, []);

  // ── Play narration for a given scene ─────────────────────
  const playNarration = useCallback((scene: number) => {
    // Stop any currently playing narration
    if (currentRef.current) {
      currentRef.current.pause();
      currentRef.current.currentTime = 0;
    }

    const audio = audioRefs.current[scene];
    if (!audio) return;

    audio.volume = mutedRef.current ? 0 : NARRATION_VOLUME;
    audio.currentTime = 0;

    // Play — handle autoplay policy gracefully
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked — will play on next user interaction
        // The global unlock in CinematicIntro will call unlockNarration()
      });
    }

    currentRef.current = audio;
  }, []);

  // ── Stop current narration ────────────────────────────────
  const stopNarration = useCallback(() => {
    if (currentRef.current) {
      currentRef.current.pause();
      currentRef.current.currentTime = 0;
      currentRef.current = null;
    }
  }, []);

  // ── Unlock narration after user gesture ──────────────────
  // Call this when the AudioContext unlocks — it will resume
  // any narration that was blocked by autoplay policy.
  const unlockNarration = useCallback((scene: number) => {
    const audio = audioRefs.current[scene];
    if (!audio || audio.currentTime > 0.1) return; // already playing
    audio.volume = mutedRef.current ? 0 : NARRATION_VOLUME;
    audio.play().catch(() => {});
    currentRef.current = audio;
  }, []);

  // ── Mute / unmute narration ───────────────────────────────
  const setNarrationMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    setIsMuted(muted);
    Object.values(audioRefs.current).forEach(a => {
      a.volume = muted ? 0 : NARRATION_VOLUME;
    });
  }, []);

  return {
    playNarration,
    stopNarration,
    unlockNarration,
    setNarrationMuted,
    isMuted,
  };
}
