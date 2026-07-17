/* ============================================================
   AshaAmbientEngine
   Procedural Web Audio API ambient sound bed for the Ask ASHA
   page. Gives the impression that ASHA is continuously
   processing live market intelligence.

   DESIGN PRINCIPLES
   ─────────────────
   • Subtle, calming, intelligent, premium
   • Never intrusive — user should barely notice it consciously
   • Feels like a living system, not background music
   • All sounds synthesized — no external files

   LAYERS
   ──────
   1. Intelligence Drone
      Clean harmonic cluster (220/275/330 Hz) with very slow
      amplitude modulation (0.07 Hz). The same sonic identity
      established during the cinematic ASHA reveal.

   2. Holographic Shimmer
      High-frequency shimmer (3300 Hz) with 4.5 Hz tremolo.
      Gives the orb a "live" quality.

   3. Data Flow Texture
      Low-level bandpass noise (800 Hz, narrow Q) with slow
      amplitude variation. Suggests data moving through the
      system.

   4. Heartbeat Pulse
      Soft sub-bass pulse (65→38 Hz) every 3.2 seconds.
      Synchronized with the visual orb breathing cycle.

   PUBLIC API
   ──────────
   start(volume?)     — initialize and begin ambient layers
   stop(fadeTime?)    — fade out and close
   setVolume(v)       — adjust master volume (0–1)
   triggerHeartbeat() — fire one manual heartbeat pulse
   get isRunning      — boolean
   ============================================================ */

export class AshaAmbientEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private stopped = false;

  // ── Utility ──────────────────────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx) throw new Error("AshaAmbientEngine: not started");
    return this.ctx;
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
    gain.gain.setValueAtTime(current, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(target, 0.0001), t + duration);
  }

  private createNoiseBuffer(duration = 4): AudioBuffer {
    const ctx = this.getCtx();
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ── Layers ────────────────────────────────────────────────────

  private buildIntelligenceDrone() {
    const ctx = this.getCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(this.masterGain!);

    const freqs = [220, 275, 330];
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

    // Very slow amplitude modulation
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    lfo.start();

    this.fadeGain(gainNode, 0.18, 2.5);
    return [...oscs, lfo];
  }

  private buildHolographicShimmer() {
    const ctx = this.getCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 3300;

    const tremolo = ctx.createOscillator();
    tremolo.type = "sine";
    tremolo.frequency.value = 4.5;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.35;
    tremolo.connect(tremoloGain);
    tremoloGain.connect(gainNode.gain);

    osc.connect(gainNode);
    osc.start();
    tremolo.start();

    this.fadeGain(gainNode, 0.045, 3.0, 1.0);
    return [osc, tremolo];
  }

  private buildDataFlowTexture() {
    const ctx = this.getCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(this.masterGain!);

    const buffer = this.createNoiseBuffer(4);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 3.5;

    // Slow amplitude variation (0.12 Hz)
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    lfo.start();

    source.connect(filter);
    filter.connect(gainNode);
    source.start();

    this.fadeGain(gainNode, 0.08, 2.0, 1.5);
    return [source, lfo];
  }

  // ── Heartbeat ─────────────────────────────────────────────────

  triggerHeartbeat() {
    if (!this.ctx || this.stopped) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.16, t + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // ── Public API ────────────────────────────────────────────────

  start(masterVolume = 0.45) {
    if (this.started) return;
    this.started = true;
    this.stopped = false;

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
      this.fadeGain(this.masterGain, masterVolume, 2.0);

      this.buildIntelligenceDrone();
      this.buildHolographicShimmer();
      this.buildDataFlowTexture();

      // Heartbeat every 3.2 seconds
      this.heartbeatTimer = setInterval(() => this.triggerHeartbeat(), 3200);
      // First heartbeat after 1.5s
      setTimeout(() => this.triggerHeartbeat(), 1500);
    } catch (e) {
      console.warn("[AshaAmbientEngine] Web Audio API not available:", e);
    }
  }

  stop(fadeTime = 1.5) {
    if (this.stopped || !this.ctx) return;
    this.stopped = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.masterGain) {
      this.expFadeGain(this.masterGain, 0.0001, fadeTime);
    }

    setTimeout(() => {
      try { this.ctx?.close(); } catch {}
      this.ctx = null;
      this.masterGain = null;
      this.started = false;
    }, (fadeTime + 0.2) * 1000);
  }

  setVolume(v: number) {
    if (!this.masterGain || !this.ctx) return;
    this.fadeGain(this.masterGain, Math.max(0, Math.min(1, v)), 0.5);
  }

  get isRunning(): boolean {
    return !!this.ctx && !this.stopped && this.ctx.state !== "closed";
  }
}
