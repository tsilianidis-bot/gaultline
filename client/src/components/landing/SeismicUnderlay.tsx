/**
 * Landing-only seismograph underlay.
 * A calm baseline with fine jitter and tight bursts, scrolled in layers.
 * Decorative: aria-hidden. One static frame when reduced motion is requested.
 * The loop pauses off-screen and while the tab is hidden.
 */
import { useEffect, useRef } from "react";

interface SeismicUnderlayProps {
  className?: string;
  /** 0–1 visual strength. The closing section uses a quieter trace. */
  intensity?: number;
}

function hash01(n: number): number {
  let x = Math.imul(n | 0, 374761393) + 668265263;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Stepped value noise. Held across ~1.2px so the baseline ticks instead of curving. */
function micro(cssX: number, seed: number): number {
  const i = Math.floor(cssX / 1.2);
  const fine = hash01(i + seed) - 0.5;
  const grain = hash01(Math.floor(cssX / 2.8) * 11 + seed) - 0.5;
  return fine * 0.82 + grain * 0.28;
}

/** Triangle spike. Corners stay sharp; there is no curved lobe. */
function spike(dx: number, center: number, half: number, amp: number): number {
  const d = Math.abs(dx - center);
  if (d >= half) return 0;
  return (1 - d / half) * amp;
}

/**
 * A fault-line packet: a few clean triangular peaks and valleys,
 * then a short jagged ring, then silence.
 */
function packet(cssX: number, seed: number, spacing: number): number {
  const k = Math.floor(cssX / spacing);
  let y = 0;
  for (let n = k - 1; n <= k + 1; n += 1) {
    const center = (n + 0.2 + hash01(n * 17 + seed) * 0.6) * spacing;
    const dx = cssX - center;
    if (dx < -16 || dx > 52) continue;
    const flip = hash01(n * 19 + seed) > 0.5 ? -1 : 1;
    const gain = 0.78 + hash01(n * 3 + seed) * 0.4;
    for (let i = 0; i < 6; i += 1) {
      const at = -8 + i * 5.4 + (hash01(n * 31 + i * 7 + seed) - 0.5) * 1.2;
      const half = 1.55 + hash01(n * 11 + i + seed) * 0.7;
      const amp = (1 - i * 0.13) * (i % 2 === 0 ? 1 : -1) * flip * gain;
      y += spike(dx, at, half, amp);
    }
    if (dx > 22 && dx < 50) {
      const step = Math.floor(dx / 1.6);
      const env = Math.exp(-(dx - 22) / 9);
      y += (hash01(step * 13 + n * 53 + seed) - 0.5) * 1.35 * env * flip;
    }
  }
  return y;
}

interface TraceSpec {
  seed: number;
  speed: number;
  spacing: number;
  jitterAmp: number;
  burstAmp: number;
  yPx: number;
  color: string;
  glow: string | null;
  width: number;
}

export default function SeismicUnderlay({ className, intensity = 1 }: SeismicUnderlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    let onScreen = true;
    let raf = 0;
    let alive = true;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let narrow = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      narrow = rect.width < 760;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
    };

    const strokeTrace = (spec: TraceSpec, scrollTime: number, mid: number) => {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 1) {
        const cssX = x / dpr;
        const world = cssX + scrollTime * spec.speed;
        const amp =
          micro(world, spec.seed) * spec.jitterAmp +
          packet(world, spec.seed, spec.spacing) * spec.burstAmp;
        const y = Math.round(mid + spec.yPx * dpr + amp * dpr * intensity);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineJoin = "miter";
      ctx.miterLimit = 2;
      ctx.lineCap = "butt";
      if (spec.glow) {
        ctx.strokeStyle = spec.glow;
        ctx.lineWidth = 1.6 * dpr;
        ctx.stroke();
      }
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = spec.width * dpr;
      ctx.stroke();
    };

    const draw = (time: number) => {
      const t = reduced ? 0 : time / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      const mid = (narrow ? 0.8 : 0.57) * height;
      ctx.strokeStyle = "rgba(0,212,255,0.08)";
      ctx.lineWidth = Math.max(1, dpr);
      for (const offset of [-72, 0, 72]) {
        const y = Math.round(mid + offset * dpr);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const tick = Math.round(48 * dpr);
      ctx.strokeStyle = "rgba(186,244,255,0.18)";
      ctx.lineWidth = Math.max(1, dpr);
      for (let x = tick; x < width; x += tick) {
        ctx.beginPath();
        ctx.moveTo(x, Math.round(mid - 4 * dpr));
        ctx.lineTo(x, Math.round(mid + 4 * dpr));
        ctx.stroke();
      }

      const spacing = narrow ? 420 : 268;
      const traces: TraceSpec[] = [
        {
          seed: 19,
          speed: 16,
          spacing: spacing + 140,
          jitterAmp: narrow ? 0.9 : 1.15,
          burstAmp: narrow ? 14 : 22,
          yPx: -18,
          color: "rgba(0,212,255,0.30)",
          glow: null,
          width: 1,
        },
        {
          seed: 4,
          speed: 26,
          spacing,
          jitterAmp: narrow ? 2.1 : 2.6,
          burstAmp: narrow ? 44 : 108,
          yPx: 0,
          color: "rgba(236,252,255,0.96)",
          glow: "rgba(0,212,255,0.10)",
          width: 1.35,
        },
      ];
      if (!narrow) {
        traces.splice(1, 0, {
          seed: 41,
          speed: 38,
          spacing: spacing + 40,
          jitterAmp: 1.05,
          burstAmp: 18,
          yPx: 16,
          color: "rgba(120,255,196,0.24)",
          glow: null,
          width: 1,
        });
      }

      for (const spec of traces) strokeTrace(spec, t, mid);

      const scan = (reduced ? 0.72 : (t * 0.028) % 1) * width;
      ctx.strokeStyle = "rgba(0,212,255,0.18)";
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      ctx.moveTo(Math.round(scan), Math.round(mid - (narrow ? 48 : 92) * dpr));
      ctx.lineTo(Math.round(scan), Math.round(mid + (narrow ? 48 : 92) * dpr));
      ctx.stroke();
    };

    const kick = () => {
      cancelAnimationFrame(raf);
      if (!alive) return;
      if (reduced || !onScreen || document.hidden) {
        draw(0);
        return;
      }
      const frame = (now: number) => {
        if (!alive || reduced || !onScreen || document.hidden) return;
        draw(now);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        kick();
      },
      { threshold: 0.02 },
    );
    io.observe(canvas);

    const onVis = () => kick();
    const onMotion = () => {
      reduced = media.matches;
      kick();
    };
    document.addEventListener("visibilitychange", onVis);
    media.addEventListener("change", onMotion);

    resize();
    kick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      media.removeEventListener("change", onMotion);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
    />
  );
}
