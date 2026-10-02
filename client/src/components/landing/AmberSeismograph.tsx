/**
 * Amber-gold seismograph trace.
 *
 * A subtle, decorative trace drawn behind the hero and the Pentagonal
 * Thesis section. It is deterministic (seeded, no data), aria-hidden,
 * and separate from the existing cyan SeismicUnderlay, which it does not
 * replace or restyle. Motion is a slow horizontal drift; with
 * prefers-reduced-motion the trace is static.
 */
import React from "react";

const WIDTH = 1440;
const HEIGHT = 120;

function hash01(n: number): number {
  let x = Math.imul(n | 0, 374761393) + 668265263;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** One tile of trace; drawn twice side by side for a seamless loop. */
export function amberTracePath(seed = 7, width = WIDTH, height = HEIGHT): string {
  const mid = height / 2;
  const points: string[] = [];
  const burstEvery = 300;
  for (let x = 0; x <= width; x += 3) {
    const k = Math.floor(x / burstEvery);
    const center = k * burstEvery + 90 + hash01(k * 17 + seed) * 120;
    const d = x - center;
    let y = (hash01(Math.floor(x / 3) + seed) - 0.5) * 2.2;
    if (d > -14 && d < 60) {
      const env = d < 0 ? 1 + d / 14 : Math.exp(-d / 18);
      const gain = 0.6 + hash01(k * 5 + seed) * 0.6;
      y += Math.sin(d * 0.9) * 30 * env * gain;
    }
    // Keep the tile edges on the baseline so the loop joins cleanly.
    if (x < 6 || x > width - 6) y = 0;
    points.push(`${x},${(mid + y).toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
}

const PATH = amberTracePath();

export default function AmberSeismograph({ className = "", opacity = 0.34 }: { className?: string; opacity?: number }) {
  return (
    <div aria-hidden="true" data-amber-seismograph className={`fl-amber pointer-events-none overflow-hidden ${className}`}>
      <style>{`
        @keyframes fl-amber-drift { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .fl-amber-track { animation: fl-amber-drift 90s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .fl-amber-track { animation: none !important; transform: none !important; } }
      `}</style>
      <div className="fl-amber-track flex h-full w-[200%]">
        {[0, 1].map((i) => (
          <svg key={i} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-1/2 shrink-0" style={{ opacity }}>
            <defs>
              <linearGradient id={`fl-amber-grad-${i}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#C8963E" stopOpacity="0.2" />
                <stop offset="0.5" stopColor="#E8B04B" stopOpacity="1" />
                <stop offset="1" stopColor="#C8963E" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d={PATH} fill="none" stroke={`url(#fl-amber-grad-${i})`} strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
          </svg>
        ))}
      </div>
    </div>
  );
}
