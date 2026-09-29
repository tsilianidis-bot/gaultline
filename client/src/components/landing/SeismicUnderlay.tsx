/**
 * Landing-only seismic underlay.
 * Canvas traces sit behind hero and closing content.
 * Decorative: aria-hidden. Static when the user prefers reduced motion.
 * The loop pauses off-screen and while the tab is hidden.
 */
import { useEffect, useRef } from "react";

interface SeismicUnderlayProps {
  className?: string;
  /** 0–1 visual strength. Footer uses a quieter trace. */
  intensity?: number;
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
    let step = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const narrow = rect.width < 760;
      dpr = Math.min(narrow ? 1.5 : 2, window.devicePixelRatio || 1);
      step = narrow ? 2 : 1;
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
    };

    const sample = (x: number, t: number, freq: number, speed: number, phase: number) => {
      const u = x / Math.max(width, 1);
      const travel = u * Math.PI * 2 * freq - t * speed + phase;
      const packet = Math.exp(-Math.pow(((u * 5.5 + phase) % 5.5) - 2.4, 2));
      const swell = 0.62 + 0.38 * Math.sin(u * Math.PI * 2 * 1.4 + phase);
      return (
        Math.sin(travel) * swell +
        Math.sin(travel * 2.35 + 0.6) * 0.22 * (0.45 + packet) +
        Math.sin(travel * 0.47 + phase) * 0.28
      );
    };

    const strokeTrace = (
      t: number,
      amp: number,
      freq: number,
      speed: number,
      phase: number,
      yShift: number,
      color: string,
      lineWidth: number,
    ) => {
      ctx.beginPath();
      const mid = height * (0.56 + yShift);
      for (let x = 0; x <= width; x += step) {
        const y = mid + sample(x, t, freq, speed, phase) * amp * intensity;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * dpr;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    };

    const draw = (time: number) => {
      const t = reduced ? 1.4 : time / 1000;
      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      ctx.moveTo(0, height * 0.56);
      ctx.lineTo(width, height * 0.56);
      ctx.strokeStyle = "rgba(232,244,255,0.08)";
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();

      const tick = 72 * dpr;
      ctx.strokeStyle = "rgba(0,212,255,0.05)";
      ctx.lineWidth = 1;
      for (let x = tick; x < width; x += tick) {
        ctx.beginPath();
        ctx.moveTo(x, height * 0.72);
        ctx.lineTo(x, height * 0.78);
        ctx.stroke();
      }

      const amp = height * (width < 760 * dpr ? 0.11 : 0.145);
      strokeTrace(t, amp * 1.15, 3.2, 0.33, 0.4, 0.03, "rgba(0,212,255,0.16)", 7);
      strokeTrace(t, amp * 0.72, 4.6, 0.22, 2.1, -0.06, "rgba(0,255,136,0.22)", 1.4);
      strokeTrace(t, amp, 3.2, 0.33, 0.4, 0.0, "rgba(186,244,255,0.88)", 1.35);
      if (step === 1) {
        strokeTrace(t, amp * 0.28, 9.5, 0.55, 1.1, 0.01, "rgba(0,212,255,0.35)", 0.7);
      }

      if (!reduced) {
        const scan = ((t * 0.045) % 1) * width;
        const grad = ctx.createLinearGradient(scan, 0, scan, height);
        grad.addColorStop(0, "rgba(0,212,255,0)");
        grad.addColorStop(0.45, "rgba(0,212,255,0.28)");
        grad.addColorStop(1, "rgba(0,212,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.25 * dpr;
        ctx.beginPath();
        ctx.moveTo(scan, height * 0.12);
        ctx.lineTo(scan, height * 0.9);
        ctx.stroke();
      }
    };

    const kick = () => {
      cancelAnimationFrame(raf);
      if (!alive) return;
      if (reduced || !onScreen || document.hidden) {
        draw(0);
        return;
      }
      const frame = (time: number) => {
        if (!alive || reduced || !onScreen || document.hidden) return;
        draw(time);
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
