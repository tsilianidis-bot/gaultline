/**
 * Emergency-only audio controller. It has no normal-state activation path:
 * callers must explicitly declare `EMERGENCY`, and each activation plays a
 * single bounded cue with no loop or overlap.
 */
export class EmergencyAlertAudio {
  private context: AudioContext | null = null;
  private active = false;
  private lastTriggeredAt = 0;
  private readonly cooldownMs = 30_000;

  trigger(severity: string): boolean {
    if (severity !== "EMERGENCY" || this.active || Date.now() - this.lastTriggeredAt < this.cooldownMs) return false;
    this.active = true;
    this.lastTriggeredAt = Date.now();

    try {
      const context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.context = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1180, start);
      oscillator.frequency.exponentialRampToValueAtTime(880, start + 0.62);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.10, start + 0.10);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.78);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.8);
      oscillator.onended = () => this.close();
      return true;
    } catch {
      this.close();
      return false;
    }
  }

  stop(): void {
    this.close();
  }

  private close(): void {
    try { void this.context?.close(); } catch { /* audio shutdown is best-effort */ }
    this.context = null;
    this.active = false;
  }
}
