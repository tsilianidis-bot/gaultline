/* ============================================================
   useCinematicAudio
   ─────────────────────────────────────────────────────────────
   Complete cinematic sound design layer for FAULTLINE intro.
   Pure Web Audio API — no external files, no CDN dependencies.
   Everything is synthesized procedurally in the browser.

   SCENE DESIGN:
   Scene 1 — Earth / Tectonic
     Sub-bass drone (18–40 Hz) + filtered wind noise + earth tremor LFO
   Scene 2 — Pressure Building
     Deep rumble + pressure pulse train + seismic click ticks + resonance swell
   Scene 3 — Geology → Market Intelligence
     Geological rumble crossfades into digital pulse (same freq, different timbre)
     Data stream shimmer + signal emergence tones
   Scene 4 — FAULTLINE Comes Alive
     ASHA signature chord (soft holographic) + interface confirmation pulses
     Gentle harmonic swell
   Scene 5 — Enter FAULTLINE
     Final deep resonance + ambient tail that continues under dashboard

   AUTOPLAY:
   AudioContext starts suspended. On first user gesture the context resumes
   and sound begins. A `needsGesture` flag is exposed so the UI can show
   a subtle "SOUND ON" prompt without breaking immersion.

   NARRATION DUCKING:
   Call duckForNarration(true) when narration starts, false when it ends.
   All scene audio ducks to 15% volume during narration.

   MUTE:
   toggleMute() / isMuted exposed. Mute ramps master gain to 0.
   ============================================================ */

import { useRef, useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────
export type CinematicScene = 1 | 2 | 3 | 4 | 5 | 6;

interface AudioNodes {
  ctx: AudioContext;
  master: GainNode;
  duckGain: GainNode;
  sceneGain: GainNode;
  // Active oscillators / sources that need cleanup
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
  intervals: ReturnType<typeof setInterval>[];
  timeouts: ReturnType<typeof setTimeout>[];
}

// ── Utility: create pink-ish noise buffer ─────────────────────
function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = sampleRate * seconds;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  // Paul Kellet's pink noise approximation
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < frameCount; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

// ── Utility: looping noise source ────────────────────────────
function createLoopingNoise(
  ctx: AudioContext,
  destination: AudioNode,
  gainValue: number,
  lowFreq: number,
  highFreq: number,
  seconds = 3
): { source: AudioBufferSourceNode; gain: GainNode } {
  const buffer = createNoiseBuffer(ctx, seconds);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = (lowFreq + highFreq) / 2;
  filter.Q.value = 0.5;

  const gain = ctx.createGain();
  gain.gain.value = gainValue;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start();
  return { source, gain };
}

// ── Utility: sub-bass drone oscillator ───────────────────────
function createDrone(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  gainValue: number,
  type: OscillatorType = "sine"
): { osc: OscillatorNode; gain: GainNode } {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.value = gainValue;

  osc.connect(gain);
  gain.connect(destination);
  osc.start();
  return { osc, gain };
}

// ── Utility: one-shot tone ────────────────────────────────────
function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  gainPeak: number,
  attackMs: number,
  decayMs: number,
  type: OscillatorType = "sine"
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + attackMs / 1000);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (attackMs + decayMs) / 1000);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + (attackMs + decayMs) / 1000 + 0.05);
}

// ── Utility: soft click (seismic tick) ───────────────────────
function playClick(ctx: AudioContext, destination: AudioNode, gainValue = 0.08) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

// ── Utility: ramp gain ────────────────────────────────────────
function rampGain(node: GainNode, target: number, durationMs: number) {
  const ctx = node.context;
  node.gain.cancelScheduledValues(ctx.currentTime);
  node.gain.setValueAtTime(node.gain.value, ctx.currentTime);
  node.gain.linearRampToValueAtTime(target, ctx.currentTime + durationMs / 1000);
}

// ── Main hook ─────────────────────────────────────────────────
export function useCinematicAudio() {
  const nodesRef = useRef<AudioNodes | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const currentSceneRef = useRef<CinematicScene>(1);
  const isDuckedRef = useRef(false);

  // ── Initialize AudioContext on first call ─────────────────
  const initAudio = useCallback(() => {
    if (nodesRef.current) return nodesRef.current;

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Master → duck → scene chain
    const master = ctx.createGain();
    master.gain.value = 0.85;

    const duckGain = ctx.createGain();
    duckGain.gain.value = 1.0;

    const sceneGain = ctx.createGain();
    sceneGain.gain.value = 0;

    // Add a subtle compressor for cinematic feel
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.25;

    sceneGain.connect(duckGain);
    duckGain.connect(compressor);
    compressor.connect(master);
    master.connect(ctx.destination);

    const nodes: AudioNodes = {
      ctx,
      master,
      duckGain,
      sceneGain,
      sources: [],
      intervals: [],
      timeouts: [],
    };
    nodesRef.current = nodes;
    return nodes;
  }, []);

  // ── Unlock AudioContext on user gesture ───────────────────
  const unlock = useCallback(async () => {
    const nodes = initAudio();
    if (nodes.ctx.state === "suspended") {
      try {
        await nodes.ctx.resume();
        setNeedsGesture(false);
        setAudioReady(true);
      } catch {}
    } else if (nodes.ctx.state === "running") {
      setNeedsGesture(false);
      setAudioReady(true);
    }
  }, [initAudio]);

  // ── Stop all active scene sources ────────────────────────
  const stopScene = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    nodes.sources.forEach(s => {
      try { s.stop(); } catch {}
    });
    nodes.sources = [];
    nodes.intervals.forEach(clearInterval);
    nodes.intervals = [];
    nodes.timeouts.forEach(clearTimeout);
    nodes.timeouts = [];
  }, []);

  // ── Scene 1: The Earth ────────────────────────────────────
  // Almost silence. Soft wind. Distant atmosphere. Very subtle
  // low-frequency earth rumbles. Something enormous slowly shifting.
  const playScene1 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;

    // Fade scene gain in slowly
    rampGain(sceneGain, 1, 2500);

    // Sub-bass drone — felt more than heard
    const { osc: bass, gain: bassGain } = createDrone(ctx, sceneGain, 28, 0.0, "sine");
    rampGain(bassGain, 0.18, 3000);
    nodes.sources.push(bass);

    // Second harmonic for warmth
    const { osc: bass2, gain: bass2Gain } = createDrone(ctx, sceneGain, 56, 0.0, "sine");
    rampGain(bass2Gain, 0.06, 4000);
    nodes.sources.push(bass2);

    // Wind noise — very low, filtered
    const { source: wind, gain: windGain } = createLoopingNoise(ctx, sceneGain, 0.0, 80, 400, 4);
    rampGain(windGain, 0.12, 4000);
    nodes.sources.push(wind);

    // Distant atmosphere — higher frequency shimmer
    const { source: atmos, gain: atmosGain } = createLoopingNoise(ctx, sceneGain, 0.0, 600, 1200, 5);
    rampGain(atmosGain, 0.025, 5000);
    nodes.sources.push(atmos);

    // Slow LFO tremor on the bass — imperceptible movement
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.08; // very slow
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(bass.frequency);
    lfo.start();
    nodes.sources.push(lfo);
  }, []);

  // ── Scene 2: Pressure Building ────────────────────────────
  // Deep subterranean rumbles. Low-frequency pressure pulses.
  // Seismic clicks. Structural creaks. Soft resonance increasing.
  const playScene2 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;

    rampGain(sceneGain, 1, 1500);

    // Deep rumble — lower than scene 1
    const { osc: rumble, gain: rumbleGain } = createDrone(ctx, sceneGain, 22, 0.0, "sine");
    rampGain(rumbleGain, 0.22, 2000);
    nodes.sources.push(rumble);

    // Pressure pulse — slow rhythmic LFO on rumble amplitude
    const pulseLFO = ctx.createOscillator();
    pulseLFO.type = "sine";
    pulseLFO.frequency.value = 0.18; // ~1 pulse per 5.5 seconds
    const pulseLFOGain = ctx.createGain();
    pulseLFOGain.gain.value = 0.1;
    pulseLFO.connect(pulseLFOGain);
    pulseLFOGain.connect(rumbleGain.gain);
    pulseLFO.start();
    nodes.sources.push(pulseLFO);

    // Rock stress noise — mid-low band
    const { source: stress, gain: stressGain } = createLoopingNoise(ctx, sceneGain, 0.0, 120, 600, 3);
    rampGain(stressGain, 0.09, 2500);
    nodes.sources.push(stress);

    // Seismic click train — tiny ticks synced to "recording"
    let clickCount = 0;
    const clickInterval = setInterval(() => {
      if (!nodesRef.current) return;
      // Irregular timing — not perfectly metronomic
      const jitter = Math.random() * 0.4 + 0.6;
      const t = nodes.timeouts.length;
      const delay = Math.floor(jitter * 800);
      const timeout = setTimeout(() => {
        if (nodesRef.current && !isDuckedRef.current) {
          playClick(ctx, sceneGain, 0.04 + Math.random() * 0.04);
        }
      }, delay);
      nodes.timeouts.push(timeout);
      clickCount++;
      if (clickCount > 20) clearInterval(clickInterval);
    }, 900 + Math.random() * 600);
    nodes.intervals.push(clickInterval);

    // Resonance swell — slowly building harmonic
    const { osc: swell, gain: swellGain } = createDrone(ctx, sceneGain, 44, 0.0, "triangle");
    rampGain(swellGain, 0.07, 5000);
    nodes.sources.push(swell);

    // Structural creak — occasional low moan
    const creakInterval = setInterval(() => {
      if (!nodesRef.current || isDuckedRef.current) return;
      const freq = 60 + Math.random() * 40;
      playTone(ctx, sceneGain, freq, 0.06, 600, 1800, "sawtooth");
    }, 3200 + Math.random() * 1800);
    nodes.intervals.push(creakInterval);
  }, []);

  // ── Scene 3: Geology → Market Intelligence ────────────────
  // Geological rumble evolves into digital pulse.
  // Same frequency, different timbre. Transition feels magical.
  const playScene3 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;

    rampGain(sceneGain, 1, 1200);

    // Carry the geological rumble forward but soften it
    const { osc: geo, gain: geoGain } = createDrone(ctx, sceneGain, 22, 0.0, "sine");
    rampGain(geoGain, 0.14, 1500);
    // Slowly fade geological element
    nodes.timeouts.push(setTimeout(() => rampGain(geoGain, 0.04, 3500), 2000));
    nodes.sources.push(geo);

    // Digital pulse emerges — same frequency, square wave
    const { osc: digital, gain: digitalGain } = createDrone(ctx, sceneGain, 22, 0.0, "square");
    // Low-pass filter to soften the square wave
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 180;
    lpf.Q.value = 1.2;
    digital.disconnect();
    digital.connect(lpf);
    lpf.connect(digitalGain);
    digitalGain.connect(sceneGain);
    nodes.timeouts.push(setTimeout(() => rampGain(digitalGain, 0.12, 3000), 1800));
    nodes.sources.push(digital);

    // Data stream shimmer — high-frequency gentle noise
    const { source: shimmer, gain: shimmerGain } = createLoopingNoise(ctx, sceneGain, 0.0, 2000, 6000, 2);
    nodes.timeouts.push(setTimeout(() => rampGain(shimmerGain, 0.018, 2500), 1500));
    nodes.sources.push(shimmer);

    // Signal emergence tones — soft ascending pings
    const signalFreqs = [220, 330, 440, 550];
    signalFreqs.forEach((freq, i) => {
      nodes.timeouts.push(setTimeout(() => {
        if (!nodesRef.current || isDuckedRef.current) return;
        playTone(ctx, sceneGain, freq, 0.04, 400, 1200, "sine");
      }, 2000 + i * 900));
    });

    // Soft electronic pulse rhythm
    let pulseCount = 0;
    const pulseInterval = setInterval(() => {
      if (!nodesRef.current || isDuckedRef.current) return;
      playTone(ctx, sceneGain, 110, 0.05, 80, 600, "sine");
      pulseCount++;
      if (pulseCount > 8) clearInterval(pulseInterval);
    }, 850);
    nodes.intervals.push(pulseInterval);
  }, []);

  // ── Scene 4: FAULTLINE Comes Alive ───────────────────────
  // ASHA signature chord. Holographic tones. Interface pulses.
  // Calm, intelligent, reassuring. Never robotic.
  const playScene4 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;

    rampGain(sceneGain, 1, 1000);

    // ASHA signature chord — Dm9 voicing (D-F-A-C-E)
    // Soft, intelligent, slightly mysterious
    const ashaFreqs = [
      { freq: 73.4, gain: 0.10 },  // D2
      { freq: 110.0, gain: 0.08 }, // A2
      { freq: 146.8, gain: 0.07 }, // D3
      { freq: 174.6, gain: 0.06 }, // F3
      { freq: 220.0, gain: 0.05 }, // A3
      { freq: 261.6, gain: 0.04 }, // C4
    ];
    ashaFreqs.forEach(({ freq, gain: g }, i) => {
      const { osc, gain: gainNode } = createDrone(ctx, sceneGain, freq, 0.0, "sine");
      // Stagger entry for chord bloom effect
      nodes.timeouts.push(setTimeout(() => rampGain(gainNode, g, 1200), i * 180));
      nodes.sources.push(osc);
    });

    // Holographic shimmer — very high, very quiet
    const { source: holo, gain: holoGain } = createLoopingNoise(ctx, sceneGain, 0.0, 4000, 8000, 2);
    rampGain(holoGain, 0.012, 2000);
    nodes.sources.push(holo);

    // Interface confirmation pulses — gentle, spaced
    const confirmFreqs = [528, 639, 741]; // Solfeggio-inspired
    confirmFreqs.forEach((freq, i) => {
      nodes.timeouts.push(setTimeout(() => {
        if (!nodesRef.current || isDuckedRef.current) return;
        playTone(ctx, sceneGain, freq, 0.035, 300, 1400, "sine");
      }, 1200 + i * 1400));
    });

    // Gentle harmonic swell — slow rise
    const { osc: swellOsc, gain: swellGain } = createDrone(ctx, sceneGain, 36.7, 0.0, "triangle");
    rampGain(swellGain, 0.08, 4000);
    nodes.sources.push(swellOsc);

    // Intelligence pulse — very subtle rhythmic heartbeat
    let heartCount = 0;
    const heartInterval = setInterval(() => {
      if (!nodesRef.current || isDuckedRef.current) return;
      playTone(ctx, sceneGain, 55, 0.06, 60, 400, "sine");
      heartCount++;
      if (heartCount > 10) clearInterval(heartInterval);
    }, 1600);
    nodes.intervals.push(heartInterval);
  }, []);

  // ── Scene 5: Enter FAULTLINE ──────────────────────────────
  // Final deep resonance. Ambient tail continues under dashboard.
  // The documentary never ended — it became reality.
  const playScene5 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;

    rampGain(sceneGain, 1, 800);

    // Final deep resonance — the most powerful moment
    const { osc: finalBass, gain: finalBassGain } = createDrone(ctx, sceneGain, 18, 0.0, "sine");
    rampGain(finalBassGain, 0.28, 1200);
    // Swell and hold
    nodes.timeouts.push(setTimeout(() => rampGain(finalBassGain, 0.18, 2000), 2000));
    nodes.sources.push(finalBass);

    // ASHA chord — carry forward from scene 4
    const { osc: asha, gain: ashaGain } = createDrone(ctx, sceneGain, 73.4, 0.0, "sine");
    rampGain(ashaGain, 0.09, 1500);
    nodes.sources.push(asha);

    // Seismograph continues naturally
    let seisCount = 0;
    const seisInterval = setInterval(() => {
      if (!nodesRef.current || isDuckedRef.current) return;
      playClick(ctx, sceneGain, 0.03 + Math.random() * 0.03);
      seisCount++;
      if (seisCount > 15) clearInterval(seisInterval);
    }, 600 + Math.random() * 400);
    nodes.intervals.push(seisInterval);

    // Ambient tail — barely noticeable, continues under dashboard
    const { source: ambient, gain: ambientGain } = createLoopingNoise(ctx, sceneGain, 0.0, 100, 500, 4);
    rampGain(ambientGain, 0.06, 2000);
    nodes.sources.push(ambient);

    // Final confirmation tone — the "FAULTLINE is alive" moment
    nodes.timeouts.push(setTimeout(() => {
      if (!nodesRef.current || isDuckedRef.current) return;
      // Chord bloom: D-A-D-F#
      [73.4, 110, 146.8, 185].forEach((freq, i) => {
        setTimeout(() => {
          if (!nodesRef.current) return;
          playTone(ctx, sceneGain, freq, 0.06, 500, 2500, "sine");
        }, i * 120);
      });
    }, 1000));
  }, []);

  // ── Play scene ────────────────────────────────────────────
  const playScene = useCallback((scene: CinematicScene) => {
    const nodes = nodesRef.current;
    if (!nodes || nodes.ctx.state !== "running") return;

    currentSceneRef.current = scene;

    // Fade out current scene, then switch
    rampGain(nodes.sceneGain, 0, 800);

    const t = setTimeout(() => {
      if (!nodesRef.current) return;
      stopScene();
      // Re-create sceneGain after stopScene clears sources
      const n = nodesRef.current;
      if (!n) return;
      n.sceneGain.gain.value = 0;

      switch (scene) {
        case 1: playScene1(n); break;
        case 2: playScene2(n); break;
        case 3: playScene3(n); break;
        case 4: playScene4(n); break;
        case 5: playScene5(n); break;
        case 6:
          // Fade to ambient tail — the documentary becomes reality
          rampGain(n.sceneGain, 0.3, 2000);
          rampGain(n.master, 0.2, 4000);
          break;
      }
    }, 700);

    // Store timeout in nodes so it gets cleared on unmount
    if (nodesRef.current) {
      nodesRef.current.timeouts.push(t);
    }
  }, [stopScene, playScene1, playScene2, playScene3, playScene4, playScene5]);

  // ── Narration ducking ─────────────────────────────────────
  const duckForNarration = useCallback((active: boolean) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    isDuckedRef.current = active;
    rampGain(nodes.duckGain, active ? 0.15 : 1.0, active ? 400 : 800);
  }, []);

  // ── Mute toggle ───────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    setIsMuted(prev => {
      const next = !prev;
      rampGain(nodes.master, next ? 0 : 0.85, 300);
      return next;
    });
  }, []);

  // ── Start audio (call on first scene) ────────────────────
  const startAudio = useCallback(async (scene: CinematicScene = 1) => {
    const nodes = initAudio();

    if (nodes.ctx.state === "suspended") {
      // Browser blocked autoplay — set flag for UI
      setNeedsGesture(true);
      // Try to resume anyway (may work on some browsers)
      try {
        await nodes.ctx.resume();
        setNeedsGesture(false);
        setAudioReady(true);
        playScene(scene);
      } catch {
        // Will unlock on first user gesture
      }
    } else {
      setAudioReady(true);
      playScene(scene);
    }
  }, [initAudio, playScene]);

  // ── Unlock on user gesture ────────────────────────────────
  const unlockAndPlay = useCallback(async () => {
    await unlock();
    const nodes = nodesRef.current;
    if (nodes && nodes.ctx.state === "running") {
      playScene(currentSceneRef.current);
    }
  }, [unlock, playScene]);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      stopScene();
      try {
        nodes.ctx.close();
      } catch {}
      nodesRef.current = null;
    };
  }, [stopScene]);

  return {
    startAudio,
    playScene,
    duckForNarration,
    toggleMute,
    unlockAndPlay,
    isMuted,
    needsGesture,
    audioReady,
  };
}
