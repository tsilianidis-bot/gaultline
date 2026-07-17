/* ============================================================
   CinematicAudioEngine
   Procedural Web Audio API sound system for the FAULTLINE
   cinematic intro. Zero external audio files. All sounds are
   synthesized in real time.

   LAYER ARCHITECTURE
   ──────────────────
   Layer 1 — Seismic Rumble (FAULTLINE phase)
     Deep sub-bass oscillator (28–40 Hz), amplitude-modulated
     with a slow LFO. Filtered noise adds geological texture.
     Fades out during the transformation phase.

   Layer 2 — Atmospheric Drone (FAULTLINE phase)
     Two detuned sine oscillators (55 Hz + 57 Hz) creating a
     slow beating interference pattern. Conveys weight and depth.
     Crossfades into the intelligence drone.

   Layer 3 — Energy Swell (transformation phase)
     Filtered noise sweep from 200 Hz → 2000 Hz over 1.8s.
     Signals activation. Peaks at the moment the orb ignites.

   Layer 4 — Intelligence Drone (ASHA phase)
     Clean sine cluster (220 Hz + 275 Hz + 330 Hz) with very
     slow amplitude modulation. Futuristic, calm, intelligent.
     Fades in as the orb blooms.

   Layer 5 — Holographic Resonance (ASHA phase)
     High-frequency shimmer (2200–4400 Hz) with tremolo.
     Soft metallic texture. Gives the orb a "live" quality.

   Layer 6 — Crystalline Chimes (ASHA text reveals)
     Short plucked sine tones at harmonic intervals.
     Triggered individually for ASHA name, subtitle, tagline.

   Layer 7 — Pulse Heartbeat (ASHA breathing)
     Soft sub-bass pulse (60 Hz, 40ms) every ~2.5s.
     Synchronized with the visual orb breathing cycle.

   Layer 8 — System Online Tone (orb ignition moment)
     Rising frequency sweep (300 → 800 Hz, 0.4s) with a
     gentle harmonic overtone. Not sci-fi — elegant.

   Public API
   ──────────
   start()            — initialize AudioContext (must be called
                        from a user gesture or after first
                        interaction; browsers block autoplay)
   playFaultlinePhase() — start seismic + atmospheric layers
   playConvergePhase()  — begin energy swell, fade seismic
   playTransformPhase() — peak swell, prepare intelligence layers
   playAshaPhase()      — crossfade to intelligence soundscape
   playChime(n)         — trigger crystalline chime (n=0,1,2)
   playHeartbeat()      — trigger one orb pulse
   playSystemOnline()   — trigger ignition tone
   stop()               — fade everything out and close context
   ============================================================ */

type LayerKey =
  | "seismicRumble"
  | "atmosphericDrone"
  | "energySwell"
  | "intelligenceDrone"
  | "holographicShimmer"
  | "pulseHeartbeat";

interface Layer {
  gainNode: GainNode;
  sources: AudioNode[];
  active: boolean;
}

export class CinematicAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layers: Partial<Record<LayerKey, Layer>> = {};
  private started = false;
  private stopped = false;

  // ── Utility ──────────────────────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx) throw new Error("AudioContext not initialized. Call start() first.");
    return this.ctx;
  }

  private createGain(value: number, destination?: AudioNode): GainNode {
    const ctx = this.getCtx();
    const g = ctx.createGain();
    g.gain.setValueAtTime(value, ctx.currentTime);
    g.connect(destination ?? this.masterGain!);
    return g;
  }

  private fadeGain(gain: GainNode, target: number, duration: number, delay = 0) {
    const ctx = this.getCtx();
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(target, t + duration);
  }

  private expFadeGain(gain: GainNode, target: number, duration: number, delay = 0) {
    const ctx = this.getCtx();
    const t = ctx.currentTime + delay;
    const current = Math.max(gain.gain.value, 0.0001);
    const safeTarget = Math.max(target, 0.0001);
    gain.gain.setValueAtTime(current, t);
    gain.gain.exponentialRampToValueAtTime(safeTarget, t + duration);
  }

  // ── Noise buffer ──────────────────────────────────────────────

  private createNoiseBuffer(duration = 2): AudioBuffer {
    const ctx = this.getCtx();
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createLoopingNoise(filterFreq: number, filterQ: number, gain: number): {
    source: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gainNode: GainNode;
  } {
    const ctx = this.getCtx();
    const buffer = this.createNoiseBuffer(4);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain!);

    return { source, filter, gainNode };
  }

  // ── Layer management ──────────────────────────────────────────

  private setLayer(key: LayerKey, gainNode: GainNode, sources: AudioNode[]) {
    this.layers[key] = { gainNode, sources, active: true };
  }

  private stopLayer(key: LayerKey, fadeOut = 0.8) {
    const layer = this.layers[key];
    if (!layer || !layer.active) return;
    layer.active = false;
    this.fadeGain(layer.gainNode, 0, fadeOut);
    setTimeout(() => {
      layer.sources.forEach(s => {
        try { (s as AudioBufferSourceNode).stop?.(); } catch {}
      });
    }, (fadeOut + 0.1) * 1000);
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initialize the AudioContext. Must be called from a user gesture
   * (click, keydown) or the browser will block audio.
   */
  start(masterVolume = 0.55) {
    if (this.started) return;
    this.started = true;
    this.stopped = false;

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
      // Fade master in gently
      this.fadeGain(this.masterGain, masterVolume, 1.2);
    } catch (e) {
      console.warn("[CinematicAudioEngine] Web Audio API not available:", e);
    }
  }

  /**
   * Phase 1 — FAULTLINE identity.
   * Starts seismic rumble + atmospheric drone.
   */
  playFaultlinePhase() {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;

    // ── Seismic rumble ──────────────────────────────────────────
    {
      const gainNode = this.createGain(0);

      // Sub-bass oscillator
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 32;

      // Slow amplitude LFO (0.18 Hz)
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);

      // Geological noise texture
      const { source: noiseSource, gainNode: noiseGain } = this.createLoopingNoise(55, 0.8, 0.18);

      osc1.connect(gainNode);
      osc1.start();
      lfo.start();
      noiseSource.start();

      this.fadeGain(gainNode, 0.45, 1.6);
      this.setLayer("seismicRumble", gainNode, [osc1, lfo, noiseSource]);
    }

    // ── Atmospheric drone ───────────────────────────────────────
    {
      const gainNode = this.createGain(0);

      // Two detuned sines — slow beating interference
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 55;

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 57.2; // 2.2 Hz beat frequency

      const g1 = ctx.createGain(); g1.gain.value = 0.5;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      osc1.connect(g1); g1.connect(gainNode);
      osc2.connect(g2); g2.connect(gainNode);
      osc1.start();
      osc2.start();

      this.fadeGain(gainNode, 0.3, 2.0);
      this.setLayer("atmosphericDrone", gainNode, [osc1, osc2]);
    }
  }

  /**
   * Phase 2 — Converge / transformation begins.
   * Energy swell starts. Seismic begins fading.
   */
  playConvergePhase() {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;

    // Fade seismic rumble down
    const seismic = this.layers["seismicRumble"];
    if (seismic) this.expFadeGain(seismic.gainNode, 0.0001, 2.2);

    // ── Energy swell ────────────────────────────────────────────
    {
      const gainNode = this.createGain(0);

      // Filtered noise sweep upward
      const buffer = this.createNoiseBuffer(3);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(2200, ctx.currentTime + 2.2);
      filter.Q.value = 1.8;

      source.connect(filter);
      filter.connect(gainNode);
      source.start();

      this.fadeGain(gainNode, 0.28, 1.0);
      this.setLayer("energySwell", gainNode, [source]);
    }
  }

  /**
   * Phase 3 — Transform (logo dissolves).
   * Swell peaks. Atmospheric drone begins crossfading to intelligence.
   */
  playTransformPhase() {
    if (!this.ctx || this.stopped) return;

    // Peak the swell
    const swell = this.layers["energySwell"];
    if (swell) this.fadeGain(swell.gainNode, 0.42, 0.6);

    // Atmospheric drone fades out
    const atmo = this.layers["atmosphericDrone"];
    if (atmo) this.expFadeGain(atmo.gainNode, 0.0001, 1.8);
  }

  /**
   * Phase 4 — ASHA reveal.
   * Intelligence drone fades in. Holographic shimmer appears.
   * Energy swell fades out. System online tone fires.
   */
  playAshaPhase() {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;

    // Fade out energy swell
    const swell = this.layers["energySwell"];
    if (swell) this.expFadeGain(swell.gainNode, 0.0001, 1.4);

    // System online tone
    this.playSystemOnline();

    // ── Intelligence drone ──────────────────────────────────────
    {
      const gainNode = this.createGain(0);

      // Harmonic cluster: root + perfect fifth + major third
      const freqs = [220, 330, 275];
      const oscs = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.45 : 0.28;
        osc.connect(g);
        g.connect(gainNode);
        osc.start();
        return osc;
      });

      // Very slow amplitude modulation (0.08 Hz)
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);
      lfo.start();

      this.fadeGain(gainNode, 0.22, 2.0);
      this.setLayer("intelligenceDrone", gainNode, [...oscs, lfo]);
    }

    // ── Holographic shimmer ─────────────────────────────────────
    {
      const gainNode = this.createGain(0);

      // High-frequency shimmer with tremolo
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 3300;

      // Tremolo at 4.5 Hz
      const tremolo = ctx.createOscillator();
      tremolo.type = "sine";
      tremolo.frequency.value = 4.5;
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.value = 0.4;
      tremolo.connect(tremoloGain);
      tremoloGain.connect(gainNode.gain);

      osc.connect(gainNode);
      osc.start();
      tremolo.start();

      this.fadeGain(gainNode, 0.06, 2.5, 0.8);
      this.setLayer("holographicShimmer", gainNode, [osc, tremolo]);
    }
  }

  /**
   * Trigger one orb heartbeat pulse.
   * Soft sub-bass thump (60 Hz, 40ms attack, 200ms decay).
   */
  playHeartbeat() {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.28, t + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /**
   * Trigger the system online tone at orb ignition.
   * Rising frequency sweep with harmonic overtone.
   */
  playSystemOnline() {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;

    // Main sweep
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.55);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.22, t + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.7);

    // Harmonic overtone (fifth above)
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(420, t);
    osc2.frequency.exponentialRampToValueAtTime(1320, t + 0.55);

    const gainNode2 = ctx.createGain();
    gainNode2.gain.setValueAtTime(0, t);
    gainNode2.gain.linearRampToValueAtTime(0.09, t + 0.1);
    gainNode2.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

    osc2.connect(gainNode2);
    gainNode2.connect(this.masterGain!);
    osc2.start(t);
    osc2.stop(t + 0.7);
  }

  /**
   * Trigger a crystalline chime for text reveals.
   * n=0: ASHA name (A4 = 440 Hz)
   * n=1: subtitle (E5 = 659 Hz)
   * n=2: tagline (B4 = 494 Hz, softer)
   */
  playChime(n: 0 | 1 | 2) {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;

    const configs = [
      { freq: 440, gain: 0.18, decay: 1.4 },
      { freq: 659, gain: 0.12, decay: 1.1 },
      { freq: 494, gain: 0.08, decay: 0.9 },
    ];
    const cfg = configs[n];

    // Fundamental
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = cfg.freq;

    // Overtone (+1 octave, softer)
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = cfg.freq * 2;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(cfg.gain, t + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + cfg.decay);

    const gainNode2 = ctx.createGain();
    gainNode2.gain.setValueAtTime(0, t);
    gainNode2.gain.linearRampToValueAtTime(cfg.gain * 0.35, t + 0.012);
    gainNode2.gain.exponentialRampToValueAtTime(0.0001, t + cfg.decay * 0.7);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);
    osc2.connect(gainNode2);
    gainNode2.connect(this.masterGain!);

    osc.start(t); osc.stop(t + cfg.decay + 0.05);
    osc2.start(t); osc2.stop(t + cfg.decay * 0.7 + 0.05);
  }

  /**
   * Fade out all layers and close the AudioContext.
   * Call this when the cinematic completes or is skipped.
   */
  stop(fadeTime = 1.2) {
    if (this.stopped || !this.ctx) return;
    this.stopped = true;

    if (this.masterGain) {
      this.expFadeGain(this.masterGain, 0.0001, fadeTime);
    }

    setTimeout(() => {
      try { this.ctx?.close(); } catch {}
      this.ctx = null;
      this.masterGain = null;
      this.layers = {};
      this.started = false;
    }, (fadeTime + 0.2) * 1000);
  }

  /**
   * Returns true if the AudioContext is running.
   */
  get isRunning(): boolean {
    return !!this.ctx && !this.stopped && this.ctx.state !== "closed";
  }
}

// ── Singleton for the cinematic intro ─────────────────────────
export const cinematicAudio = new CinematicAudioEngine();
