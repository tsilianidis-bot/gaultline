/* ============================================================
   SeismicWave — shared multi-layer animated seismograph canvas
   Used by Dashboard and CinematicIntro.
   Props:
     color  — hex color string (e.g. "#00E5FF")
     score  — pressure score 0–10 (drives amplitude and frequency)
     height — canvas height in px (default 52)
   ============================================================ */
import { useRef, useEffect } from "react";

interface SeismicWaveProps {
  color: string;
  score: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SeismicWave({ color, score, height = 52, className, style }: SeismicWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;
    const amplitude = 10 + score * 3;
    const freq1 = 0.022 + score * 0.003;
    const freq2 = 0.015 + score * 0.002;
    const freq3 = 0.035 + score * 0.005;
    let animId: number;

    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || height;

    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth || 400;
      canvas.height = canvas.offsetHeight || height;
    });
    ro.observe(canvas);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Layer 1 — deep glow (widest)
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq1 + t) * amplitude * Math.sin(x * 0.007 + t * 0.25) * 1.6;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + "18";
      ctx.lineWidth = 10;
      ctx.stroke();

      // Layer 2 — mid glow
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq2 + t * 0.85) * (amplitude * 0.7) * Math.sin(x * 0.01 + t * 0.4);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + "28";
      ctx.lineWidth = 5;
      ctx.stroke();

      // Layer 3 — sharp primary line
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq1 + t) * amplitude * Math.sin(x * 0.007 + t * 0.25);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + "D0";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Layer 4 — high-freq noise overlay
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq3 + t * 1.3) * (amplitude * 0.25);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + "50";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();

      t += 0.038;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [color, score, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: `${height}px`, display: "block", opacity: 0.9, ...style }}
    />
  );
}
