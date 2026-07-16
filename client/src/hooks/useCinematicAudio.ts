/**
 * useCinematicAudio — IMAX Documentary Sound Design
 *
 * Philosophy: Extreme dynamic range. Near-silence → massive seismic crescendo → silence.
 * The emotional impact comes entirely from contrast, not from sustained loudness.
 *
 * Scene architecture:
 *   Scene 1 — The Earth (0–5s): Near-silence. Faint wind. Tiny rock creaks. Sub-bass barely perceptible.
 *              Then: 10-15 second seismic build → massive crescendo → drop to silence → narrator.
 *   Scene 2 — Pressure Building (7s): Structural groans. Rolling deep bass. Seismic cracks.
 *   Scene 3 — Markets (7s): Geological rumble crossfades into digital pulse. Same frequency, different timbre.
 *   Scene 4 — FAULTLINE (8s): ASHA signature chord. Holographic shimmer. Intelligence heartbeat.
 *   Scene 5 — Final Declaration (5s): Deep resonance. Ambient tail into dashboard.
 *
 * Signal chain: sceneGain → duckGain → DynamicsCompressor → master → destination
 * Narrator ducking: duckGain ramps to 0.08 (near-silence) when narrator speaks, returns to 1.0 after.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type CinematicScene = 1 | 2 | 3 | 4 | 5 | 6;

interface AudioNodes {
  ctx: AudioContext;
  master: GainNode;
  duckGain: GainNode;
  sceneGain: GainNode;
  compressor: DynamicsCompressorNode;
  sources: AudioBufferSourceNode[];
  oscillators: OscillatorNode[];
  intervals: ReturnType<typeof setInterval>[];
  timeouts: ReturnType<typeof setTimeout>[];
}

// ── Utility: ramp a GainNode smoothly ────────────────────────
function rampGain(gain: GainNode, target: number, durationMs: number) {
  const ctx = gain.context;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
}

// ── Utility: exponential ramp (sounds more natural for fades) ─
function expRampGain(gain: GainNode, target: number, durationMs: number) {
  const ctx = gain.context;
  const now = ctx.currentTime;
  const safeTarget = Math.max(target, 0.0001);
  const safeFrom = Math.max(gain.gain.value, 0.0001);
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(safeFrom, now);
  gain.gain.exponentialRampToValueAtTime(safeTarget, now + durationMs / 1000);
}

// ── Utility: create pink noise buffer ────────────────────────
function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Paul Kellet's pink noise filter
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = pink;
    }
  }
  return buffer;
}

// ── Utility: create a rumble burst (sub-bass + noise layer) ──
function createRumbleBurst(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    freq?: number;       // sub-bass center frequency (Hz)
    duration?: number;   // burst duration (seconds)
    peakGain?: number;   // peak gain (0–1)
    attackMs?: number;   // attack time
    releaseMs?: number;  // release time
    noiseAmount?: number; // 0–1 noise mix
    stereoWidth?: number; // 0–1
  } = {}
) {
  const {
    freq = 28,
    duration = 2.0,
    peakGain = 0.6,
    attackMs = 300,
    releaseMs = 800,
    noiseAmount = 0.3,
    stereoWidth = 0.8,
  } = options;

  const now = ctx.currentTime;

  // Sub-bass oscillator
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  // Add slight frequency modulation for organic feel
  const freqLFO = ctx.createOscillator();
  freqLFO.type = "sine";
  freqLFO.frequency.value = 0.3 + Math.random() * 0.4;
  const freqLFOGain = ctx.createGain();
  freqLFOGain.gain.value = freq * 0.08;
  freqLFO.connect(freqLFOGain);
  freqLFOGain.connect(osc.frequency);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(peakGain, now + attackMs / 1000);
  oscGain.gain.setValueAtTime(peakGain, now + duration - releaseMs / 1000);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  // Low-pass filter for warmth
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 120;
  lpf.Q.value = 0.7;

  osc.connect(lpf);
  lpf.connect(oscGain);

  // Noise layer for texture
  if (noiseAmount > 0) {
    const noiseBuffer = createNoiseBuffer(ctx, duration + 0.1);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseLPF = ctx.createBiquadFilter();
    noiseLPF.type = "lowpass";
    noiseLPF.frequency.value = 200 + freq * 2;
    noiseLPF.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(peakGain * noiseAmount, now + attackMs / 1000);
    noiseGain.gain.setValueAtTime(peakGain * noiseAmount, now + duration - releaseMs / 1000);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSource.connect(noiseLPF);
    noiseLPF.connect(noiseGain);
    noiseGain.connect(destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.1);
  }

  // Stereo panner for width
  const panner = ctx.createStereoPanner();
  panner.pan.value = (Math.random() * 2 - 1) * stereoWidth * 0.5;

  oscGain.connect(panner);
  panner.connect(destination);

  osc.start(now);
  osc.stop(now + duration);
  freqLFO.start(now);
  freqLFO.stop(now + duration);

  return { osc, freqLFO };
}

// ── Utility: structural creak / rock fracture sound ──────────
function createCreak(ctx: AudioContext, destination: AudioNode, intensity = 0.3) {
  const now = ctx.currentTime;
  const duration = 0.1 + Math.random() * 0.3;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  // Random frequency in the "creak" range
  const baseFreq = 80 + Math.random() * 200;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * (0.5 + Math.random()), now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(intensity, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 60;

  const distortion = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
  }
  distortion.curve = curve;

  osc.connect(distortion);
  distortion.connect(hpf);
  hpf.connect(gain);
  gain.connect(destination);

  osc.start(now);
  osc.stop(now + duration + 0.05);

  return osc;
}

export function useCinematicAudio() {
  const nodesRef = useRef<AudioNodes | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const currentSceneRef = useRef<CinematicScene>(1);
  const isDuckedRef = useRef(false);

  // ── Initialize AudioContext ───────────────────────────────
  const initAudio = useCallback(() => {
    if (nodesRef.current) return nodesRef.current;

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Film-quality signal chain
    // sceneGain → duckGain → compressor → master → destination
    const master = ctx.createGain();
    master.gain.value = 0.0; // Start silent — ramp in on first scene

    const duckGain = ctx.createGain();
    duckGain.gain.value = 1.0;

    const sceneGain = ctx.createGain();
    sceneGain.gain.value = 0;

    // Hollywood-grade compressor: high ratio, gentle knee, fast attack
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 4;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    sceneGain.connect(duckGain);
    duckGain.connect(compressor);
    compressor.connect(master);
    master.connect(ctx.destination);

    const nodes: AudioNodes = {
      ctx,
      master,
      duckGain,
      sceneGain,
      compressor,
      sources: [],
      oscillators: [],
      intervals: [],
      timeouts: [],
    };
    nodesRef.current = nodes;
    return nodes;
  }, []);

  // ── Unlock AudioContext ───────────────────────────────────
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
    nodes.sources.forEach(s => { try { s.stop(); } catch {} });
    nodes.sources = [];
    nodes.oscillators.forEach(o => { try { o.stop(); } catch {} });
    nodes.oscillators = [];
    nodes.intervals.forEach(clearInterval);
    nodes.intervals = [];
    nodes.timeouts.forEach(clearTimeout);
    nodes.timeouts = [];
  }, []);

  // ══════════════════════════════════════════════════════════
  // SCENE 1 — THE EARTH
  // Near-silence → 10-15 second seismic build → massive crescendo → silence
  // The most important scene. Everything else follows from this impact.
  // ══════════════════════════════════════════════════════════
  const playScene1 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;
    const now = ctx.currentTime;

    // ── Phase 1: 0–3s — Near-silence ──────────────────────
    // Faint wind. Barely perceptible sub-bass. Tiny rock creaks.
    // Master fades in from silence.
    rampGain(nodes.master, 0.15, 2000); // Very quiet start

    // Faint wind — narrow-band noise, barely audible
    const windBuffer = createNoiseBuffer(ctx, 20);
    const wind = ctx.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;

    const windBPF = ctx.createBiquadFilter();
    windBPF.type = "bandpass";
    windBPF.frequency.value = 800;
    windBPF.Q.value = 0.3;

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0, now);
    windGain.gain.linearRampToValueAtTime(0.04, now + 1.5); // Very faint

    wind.connect(windBPF);
    windBPF.connect(windGain);
    windGain.connect(sceneGain);
    wind.start(now);
    nodes.sources.push(wind);

    // Sub-bass presence — barely felt, not heard
    const subBass = ctx.createOscillator();
    subBass.type = "sine";
    subBass.frequency.value = 18; // Infrasonic — felt as vibration
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.08, now + 2);
    subBass.connect(subGain);
    subGain.connect(sceneGain);
    subBass.start(now);
    nodes.oscillators.push(subBass);

    // ── Phase 2: 3–6s — Rumble emerges ────────────────────
    // A low rumble slowly surfaces. Structural groans. Air pressure shifts.
    const t1 = setTimeout(() => {
      if (!nodesRef.current) return;
      const n = nodesRef.current;

      // First creak — subtle
      createCreak(n.ctx, n.sceneGain, 0.15);

      // Rumble layer 1 — 32 Hz, slow attack
      const r1 = createRumbleBurst(n.ctx, n.sceneGain, {
        freq: 32, duration: 4.0, peakGain: 0.25,
        attackMs: 1500, releaseMs: 1000, noiseAmount: 0.2
      });
      n.oscillators.push(r1.osc, r1.freqLFO);

      // Master starts rising
      rampGain(n.master, 0.35, 2000);

      // Second creak after 1.5s
      const t = setTimeout(() => {
        if (!nodesRef.current) return;
        createCreak(nodesRef.current.ctx, nodesRef.current.sceneGain, 0.2);
      }, 1500);
      n.timeouts.push(t);
    }, 3000);
    nodes.timeouts.push(t1);

    // ── Phase 3: 6–10s — Earth feels alive ────────────────
    // Deep rolling bass. Multiple layered rumbles. Tension increasing every second.
    const t2 = setTimeout(() => {
      if (!nodesRef.current) return;
      const n = nodesRef.current;

      // Rumble layer 2 — 22 Hz, more powerful
      const r2 = createRumbleBurst(n.ctx, n.sceneGain, {
        freq: 22, duration: 5.0, peakGain: 0.5,
        attackMs: 800, releaseMs: 1200, noiseAmount: 0.35
      });
      n.oscillators.push(r2.osc, r2.freqLFO);

      // Rumble layer 3 — 45 Hz, mid-bass presence
      const r3 = createRumbleBurst(n.ctx, n.sceneGain, {
        freq: 45, duration: 4.5, peakGain: 0.35,
        attackMs: 600, releaseMs: 1000, noiseAmount: 0.25
      });
      n.oscillators.push(r3.osc, r3.freqLFO);

      // Structural groans — 3 creaks in rapid succession
      createCreak(n.ctx, n.sceneGain, 0.35);
      setTimeout(() => { if (nodesRef.current) createCreak(nodesRef.current.ctx, nodesRef.current.sceneGain, 0.4); }, 400);
      setTimeout(() => { if (nodesRef.current) createCreak(nodesRef.current.ctx, nodesRef.current.sceneGain, 0.5); }, 900);

      // Master rising further
      rampGain(n.master, 0.6, 2500);

      // Wind intensifies
      rampGain(windGain, 0.12, 2000);
    }, 6000);
    nodes.timeouts.push(t2);

    // ── Phase 4: 10–15s — FULL SEISMIC EVENT ──────────────
    // Maximum intensity. Huge layered earthquake. Massive rolling impacts.
    // This is the LOUDEST moment in the entire intro.
    const t3 = setTimeout(() => {
      if (!nodesRef.current) return;
      const n = nodesRef.current;

      // Master to full cinematic level
      rampGain(n.master, 0.92, 800);

      // IMPACT 1 — massive sub-bass hit (14 Hz)
      const r4 = createRumbleBurst(n.ctx, n.sceneGain, {
        freq: 14, duration: 4.0, peakGain: 0.9,
        attackMs: 100, releaseMs: 2000, noiseAmount: 0.5, stereoWidth: 1.0
      });
      n.oscillators.push(r4.osc, r4.freqLFO);

      // IMPACT 2 — 28 Hz rolling wave
      const r5 = createRumbleBurst(n.ctx, n.sceneGain, {
        freq: 28, duration: 4.5, peakGain: 0.8,
        attackMs: 200, releaseMs: 1800, noiseAmount: 0.45
      });
      n.oscillators.push(r5.osc, r5.freqLFO);

      // IMPACT 3 — 55 Hz resonance (felt in chest)
      const r6 = createRumbleBurst(n.ctx, n.sceneGain, {
        freq: 55, duration: 3.5, peakGain: 0.6,
        attackMs: 150, releaseMs: 1500, noiseAmount: 0.3
      });
      n.oscillators.push(r6.osc, r6.freqLFO);

      // Multiple rock fractures
      for (let i = 0; i < 6; i++) {
        const delay = i * 180 + Math.random() * 100;
        const t = setTimeout(() => {
          if (nodesRef.current) createCreak(nodesRef.current.ctx, nodesRef.current.sceneGain, 0.6 + Math.random() * 0.3);
        }, delay);
        n.timeouts.push(t);
      }

      // Noise burst — the "dust and debris" layer
      const impactBuffer = createNoiseBuffer(n.ctx, 3.0);
      const impactNoise = n.ctx.createBufferSource();
      impactNoise.buffer = impactBuffer;

      const impactLPF = n.ctx.createBiquadFilter();
      impactLPF.type = "lowpass";
      impactLPF.frequency.value = 400;

      const impactGain = n.ctx.createGain();
      impactGain.gain.setValueAtTime(0.7, n.ctx.currentTime);
      impactGain.gain.exponentialRampToValueAtTime(0.0001, n.ctx.currentTime + 3.0);

      impactNoise.connect(impactLPF);
      impactLPF.connect(impactGain);
      impactGain.connect(n.sceneGain);
      impactNoise.start(n.ctx.currentTime);
      impactNoise.stop(n.ctx.currentTime + 3.1);
      n.sources.push(impactNoise);
    }, 10000);
    nodes.timeouts.push(t3);

    // ── Phase 5: 14–16s — DROP TO SILENCE ─────────────────
    // The earthquake ends. Only the narrator remains.
    // The silence should feel enormous.
    const t4 = setTimeout(() => {
      if (!nodesRef.current) return;
      const n = nodesRef.current;

      // Fast fade to near-silence — the "drop" is the impact
      expRampGain(n.master, 0.04, 600);

      // Wind fades out
      rampGain(windGain, 0.01, 800);

      // After silence settles, allow narrator to be heard clearly
      const t = setTimeout(() => {
        if (!nodesRef.current) return;
        // Very gentle ambient presence under narrator
        rampGain(nodesRef.current.master, 0.08, 1500);
      }, 1200);
      n.timeouts.push(t);
    }, 14000);
    nodes.timeouts.push(t4);

    // Ramp sceneGain to active
    rampGain(sceneGain, 1.0, 500);
  }, []);

  // ══════════════════════════════════════════════════════════
  // SCENE 2 — PRESSURE BUILDING
  // The seismograph awakens. Structural groans. Rolling deep bass.
  // Seismic cracks. Pressure accumulating.
  // ══════════════════════════════════════════════════════════
  const playScene2 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;
    const now = ctx.currentTime;

    rampGain(nodes.master, 0.55, 1200);
    rampGain(sceneGain, 1.0, 600);

    // Deep rolling bass — 25 Hz, slow pulse
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = 25;
    const bassLFO = ctx.createOscillator();
    bassLFO.type = "sine";
    bassLFO.frequency.value = 0.15; // Very slow pulse
    const bassLFOGain = ctx.createGain();
    bassLFOGain.gain.value = 0.3;
    bassLFO.connect(bassLFOGain);
    bassLFOGain.connect(bass.frequency);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(0.55, now + 1.5);
    bass.connect(bassGain);
    bassGain.connect(sceneGain);
    bass.start(now);
    bassLFO.start(now);
    nodes.oscillators.push(bass, bassLFO);

    // Pressure pulse — rhythmic low-frequency throb
    const pulseLFO = ctx.createOscillator();
    pulseLFO.type = "sine";
    pulseLFO.frequency.value = 0.8; // ~1 pulse per 1.25 seconds
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.25;
    pulseLFO.connect(pulseDepth);
    pulseDepth.connect(bassGain.gain);
    pulseLFO.start(now);
    nodes.oscillators.push(pulseLFO);

    // Structural groans — periodic
    const groanInterval = setInterval(() => {
      if (!nodesRef.current) return;
      const n = nodesRef.current;
      createCreak(n.ctx, n.sceneGain, 0.25 + Math.random() * 0.2);
    }, 1200 + Math.random() * 600);
    nodes.intervals.push(groanInterval);

    // Mid-bass resonance layer — 65 Hz
    const mid = ctx.createOscillator();
    mid.type = "triangle";
    mid.frequency.value = 65;
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0, now);
    midGain.gain.linearRampToValueAtTime(0.2, now + 2.0);

    const midLPF = ctx.createBiquadFilter();
    midLPF.type = "lowpass";
    midLPF.frequency.value = 150;

    mid.connect(midLPF);
    midLPF.connect(midGain);
    midGain.connect(sceneGain);
    mid.start(now);
    nodes.oscillators.push(mid);

    // Air pressure shift — filtered noise swell
    const airBuffer = createNoiseBuffer(ctx, 8);
    const air = ctx.createBufferSource();
    air.buffer = airBuffer;

    const airBPF = ctx.createBiquadFilter();
    airBPF.type = "bandpass";
    airBPF.frequency.value = 150;
    airBPF.Q.value = 0.8;

    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0, now);
    airGain.gain.linearRampToValueAtTime(0.18, now + 2.5);
    airGain.gain.linearRampToValueAtTime(0.08, now + 7.0);

    air.connect(airBPF);
    airBPF.connect(airGain);
    airGain.connect(sceneGain);
    air.start(now);
    nodes.sources.push(air);
  }, []);

  // ══════════════════════════════════════════════════════════
  // SCENE 3 — GEOLOGY → MARKETS
  // The geological rumble crossfades into a digital pulse.
  // Same frequency. Different timbre. The parallel becomes audible.
  // ══════════════════════════════════════════════════════════
  const playScene3 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;
    const now = ctx.currentTime;

    rampGain(nodes.master, 0.6, 1000);
    rampGain(sceneGain, 1.0, 500);

    // Geological rumble — fading out
    const geo = ctx.createOscillator();
    geo.type = "sine";
    geo.frequency.value = 28;
    const geoGain = ctx.createGain();
    geoGain.gain.setValueAtTime(0.45, now);
    geoGain.gain.linearRampToValueAtTime(0.1, now + 4.0); // Fades as market sound rises
    geo.connect(geoGain);
    geoGain.connect(sceneGain);
    geo.start(now);
    nodes.oscillators.push(geo);

    // Digital pulse — rising in
    // Same 28 Hz but square wave — geological becomes digital
    const digital = ctx.createOscillator();
    digital.type = "square";
    digital.frequency.value = 28;

    const digitalLPF = ctx.createBiquadFilter();
    digitalLPF.type = "lowpass";
    digitalLPF.frequency.value = 80; // Tame the square wave harmonics

    const digitalGain = ctx.createGain();
    digitalGain.gain.setValueAtTime(0, now);
    digitalGain.gain.linearRampToValueAtTime(0.35, now + 3.5); // Rises as geo fades

    digital.connect(digitalLPF);
    digitalLPF.connect(digitalGain);
    digitalGain.connect(sceneGain);
    digital.start(now);
    nodes.oscillators.push(digital);

    // Data stream shimmer — high-frequency texture
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 3200;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(0.04, now + 2.5);

    const shimmerLFO = ctx.createOscillator();
    shimmerLFO.type = "sine";
    shimmerLFO.frequency.value = 4.5;
    const shimmerLFOGain = ctx.createGain();
    shimmerLFOGain.gain.value = 0.03;
    shimmerLFO.connect(shimmerLFOGain);
    shimmerLFOGain.connect(shimmerGain.gain);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(sceneGain);
    shimmer.start(now);
    shimmerLFO.start(now);
    nodes.oscillators.push(shimmer, shimmerLFO);

    // Residual creaks — the geology isn't fully gone
    const creak1 = setTimeout(() => {
      if (nodesRef.current) createCreak(nodesRef.current.ctx, nodesRef.current.sceneGain, 0.2);
    }, 1000);
    const creak2 = setTimeout(() => {
      if (nodesRef.current) createCreak(nodesRef.current.ctx, nodesRef.current.sceneGain, 0.15);
    }, 3500);
    nodes.timeouts.push(creak1, creak2);
  }, []);

  // ══════════════════════════════════════════════════════════
  // SCENE 4 — FAULTLINE ALIVE
  // ASHA signature chord. Holographic shimmer. Intelligence heartbeat.
  // Powerful but restrained — the system is awake.
  // ══════════════════════════════════════════════════════════
  const playScene4 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;
    const now = ctx.currentTime;

    rampGain(nodes.master, 0.65, 1500);
    rampGain(sceneGain, 1.0, 800);

    // ASHA signature chord — Dm9 (D2–A2–D3–F3–A3–C4)
    // Staggered entry — each note blooms in sequence
    const chordFreqs = [73.4, 110, 146.8, 174.6, 220, 261.6];
    const chordDelays = [0, 0.3, 0.6, 0.9, 1.2, 1.5];

    chordFreqs.forEach((freq, i) => {
      const delay = chordDelays[i];
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      // Slight detuning for warmth
      const detune = (Math.random() - 0.5) * 4;
      osc.detune.value = detune;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.4);
      gain.gain.setValueAtTime(0.12, now + 7.5);
      gain.gain.linearRampToValueAtTime(0, now + 8.5);

      osc.connect(gain);
      gain.connect(sceneGain);
      osc.start(now + delay);
      osc.stop(now + 9);
      nodes.oscillators.push(osc);
    });

    // Intelligence heartbeat — 55 Hz pulse, very subtle
    const heartbeat = ctx.createOscillator();
    heartbeat.type = "sine";
    heartbeat.frequency.value = 55;
    const heartGain = ctx.createGain();
    heartGain.gain.value = 0.15;

    const heartLFO = ctx.createOscillator();
    heartLFO.type = "sine";
    heartLFO.frequency.value = 1.2; // ~72 BPM — calm, alive
    const heartLFOGain = ctx.createGain();
    heartLFOGain.gain.value = 0.14;
    heartLFO.connect(heartLFOGain);
    heartLFOGain.connect(heartGain.gain);

    heartbeat.connect(heartGain);
    heartGain.connect(sceneGain);
    heartbeat.start(now);
    heartLFO.start(now);
    nodes.oscillators.push(heartbeat, heartLFO);

    // Holographic shimmer — 4–8 kHz texture
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 5800;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(0.025, now + 2.0);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(sceneGain);
    shimmer.start(now);
    nodes.oscillators.push(shimmer);

    // Confirmation pulses — Solfeggio frequencies
    const solfeggio = [528, 639, 741];
    solfeggio.forEach((freq, i) => {
      const t = setTimeout(() => {
        if (!nodesRef.current) return;
        const n = nodesRef.current;
        const pulse = n.ctx.createOscillator();
        pulse.type = "sine";
        pulse.frequency.value = freq;
        const pulseGain = n.ctx.createGain();
        pulseGain.gain.setValueAtTime(0.06, n.ctx.currentTime);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, n.ctx.currentTime + 1.2);
        pulse.connect(pulseGain);
        pulseGain.connect(n.sceneGain);
        pulse.start(n.ctx.currentTime);
        pulse.stop(n.ctx.currentTime + 1.3);
        n.oscillators.push(pulse);
      }, 2000 + i * 1200);
      nodes.timeouts.push(t);
    });
  }, []);

  // ══════════════════════════════════════════════════════════
  // SCENE 5 — FINAL DECLARATION
  // Deep resonance. The idea lands. Ambient tail into dashboard.
  // ══════════════════════════════════════════════════════════
  const playScene5 = useCallback((nodes: AudioNodes) => {
    const { ctx, sceneGain } = nodes;
    const now = ctx.currentTime;

    rampGain(nodes.master, 0.7, 1000);
    rampGain(sceneGain, 1.0, 600);

    // Final deep resonance — 18 Hz (infrasonic, felt not heard)
    const deep = ctx.createOscillator();
    deep.type = "sine";
    deep.frequency.value = 18;
    const deepGain = ctx.createGain();
    deepGain.gain.setValueAtTime(0, now);
    deepGain.gain.linearRampToValueAtTime(0.6, now + 1.5);
    deepGain.gain.setValueAtTime(0.6, now + 4.0);
    deepGain.gain.linearRampToValueAtTime(0.2, now + 5.5); // Fades as we enter dashboard

    deep.connect(deepGain);
    deepGain.connect(sceneGain);
    deep.start(now);
    nodes.oscillators.push(deep);

    // ASHA chord tail — D–A–D–F# bloom
    const finalChord = [73.4, 110, 146.8, 185.0];
    finalChord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.2 + 0.5);
      gain.gain.linearRampToValueAtTime(0, now + 5.5);
      osc.connect(gain);
      gain.connect(sceneGain);
      osc.start(now + i * 0.2);
      osc.stop(now + 6);
      nodes.oscillators.push(osc);
    });

    // Seismograph click continuation — the system is still monitoring
    const clickInterval = setInterval(() => {
      if (!nodesRef.current) return;
      const n = nodesRef.current;
      const click = n.ctx.createOscillator();
      click.type = "sine";
      click.frequency.value = 1200 + Math.random() * 400;
      const clickGain = n.ctx.createGain();
      clickGain.gain.setValueAtTime(0.04, n.ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, n.ctx.currentTime + 0.08);
      click.connect(clickGain);
      clickGain.connect(n.sceneGain);
      click.start(n.ctx.currentTime);
      click.stop(n.ctx.currentTime + 0.1);
      n.oscillators.push(click);
    }, 280 + Math.random() * 120);
    nodes.intervals.push(clickInterval);
  }, []);

  // ── Scene switcher ────────────────────────────────────────
  const playScene = useCallback((scene: CinematicScene) => {
    const nodes = nodesRef.current;
    if (!nodes || nodes.ctx.state !== "running") return;

    currentSceneRef.current = scene;

    // Fade out current scene
    expRampGain(nodes.sceneGain, 0.0001, 600);

    const t = setTimeout(() => {
      if (!nodesRef.current) return;
      stopScene();
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
          // Ambient tail — the documentary becomes reality
          rampGain(n.sceneGain, 0.3, 2000);
          rampGain(n.master, 0.15, 4000);
          break;
      }
    }, 550);

    if (nodesRef.current) {
      nodesRef.current.timeouts.push(t);
    }
  }, [stopScene, playScene1, playScene2, playScene3, playScene4, playScene5]);

  // ── Narrator ducking ──────────────────────────────────────
  // When narrator speaks: duck to 0.08 (near-silence — voice is the anchor)
  // When narrator pauses: seismic soundtrack swells back naturally
  const duckForNarration = useCallback((active: boolean) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    isDuckedRef.current = active;
    if (active) {
      // Fast duck — narrator starts, music immediately steps back
      expRampGain(nodes.duckGain, 0.08, 250);
    } else {
      // Slow swell — music returns naturally as narrator pauses
      rampGain(nodes.duckGain, 1.0, 1200);
    }
  }, []);

  // ── Mute toggle ───────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    setIsMuted(prev => {
      const next = !prev;
      if (next) {
        expRampGain(nodes.master, 0.0001, 300);
      } else {
        rampGain(nodes.master, 0.7, 300);
      }
      return next;
    });
  }, []);

  // ── Start audio ───────────────────────────────────────────
  const startAudio = useCallback(async (scene: CinematicScene = 1) => {
    const nodes = initAudio();

    if (nodes.ctx.state === "suspended") {
      setNeedsGesture(true);
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
      try { nodes.ctx.close(); } catch {}
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
