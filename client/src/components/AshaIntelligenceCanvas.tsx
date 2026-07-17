/* ============================================================
   AshaIntelligenceCanvas
   Premium canvas-rendered ASHA reveal animation.
   Zero component-library orbs. Zero floating bubbles.
   One living intelligence rendered entirely in 2D canvas.

   Animation timeline (driven by elapsed seconds):
     0.0–1.2s  : Sparse dust particles drift. Almost black.
     1.2–3.5s  : Particles begin converging toward center.
     3.5–5.0s  : Particles compress into a brilliant point.
     5.0–6.2s  : Point ignites → orb blooms into full size.
     6.2–end   : Orb breathes. Filaments orbit. Wisps drift.
                 Continuous organic motion.
   Exit (dissolve):
     Orb brightens → explodes into thousands of particles
     that stream outward and fade. ~1.4s total.
   ============================================================ */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

// ── Public handle ──────────────────────────────────────────────
export interface AshaCanvasHandle {
  /** Trigger the exit dissolve. Calls onDissolveComplete ~1400ms later. */
  dissolve(): void;
}

interface Props {
  onDissolveComplete?: () => void;
  /** 0–1 playback speed multiplier. Default 1. */
  speed?: number;
}

// ── Constants ──────────────────────────────────────────────────
const TWO_PI = Math.PI * 2;
const CYAN   = { r: 0,   g: 212, b: 255 };
const GOLD   = { r: 255, g: 215, b:   0 };
const WHITE  = { r: 240, g: 248, b: 255 };

function rgba(c: { r: number; g: number; b: number }, a: number) {
  return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

// ── Dust star ─────────────────────────────────────────────────
interface Star {
  x: number; y: number;
  r: number; a: number;
  twinkleOffset: number; twinkleSpeed: number;
}

// ── Converging particle ───────────────────────────────────────
interface Particle {
  // world position
  x: number; y: number;
  // start position (relative to center)
  sx: number; sy: number;
  // color mix (0=cyan, 1=white)
  colorMix: number;
  // base opacity
  baseAlpha: number;
  // size
  r: number;
  // phase offset for shimmer
  shimmer: number;
}

// ── Filament ──────────────────────────────────────────────────
interface Filament {
  angle: number;       // current angle (radians)
  angularSpeed: number;
  orbitRadius: number; // distance from orb center
  length: number;      // arc length in radians
  alpha: number;
  width: number;
  colorMix: number;    // 0=cyan, 1=gold
}

// ── Wisp ──────────────────────────────────────────────────────
interface Wisp {
  angle: number;
  angularSpeed: number;
  orbitRadius: number;
  r: number;
  alpha: number;
  shimmer: number;
}

// ── Pulse ring ────────────────────────────────────────────────
interface PulseRing {
  startTime: number;
  duration: number;
  maxRadius: number;
}

// ── Main component ─────────────────────────────────────────────
const AshaIntelligenceCanvas = forwardRef<AshaCanvasHandle, Props>(
  ({ onDissolveComplete, speed = 1 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({
      dissolving: false,
      dissolveStart: 0,
      startTime: 0,
      animId: 0,
    });

    useImperativeHandle(ref, () => ({
      dissolve() {
        stateRef.current.dissolving = true;
        stateRef.current.dissolveStart = performance.now();
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;

      // ── Resize ─────────────────────────────────────────────
      function resize() {
        canvas!.width  = canvas!.offsetWidth  * devicePixelRatio;
        canvas!.height = canvas!.offsetHeight * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      // ── Seed particles ─────────────────────────────────────
      const W = () => canvas.offsetWidth;
      const H = () => canvas.offsetHeight;

      const STAR_COUNT = 120;
      const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.2,
        a: 0.08 + Math.random() * 0.25,
        twinkleOffset: Math.random() * TWO_PI,
        twinkleSpeed:  0.4 + Math.random() * 0.8,
      }));

      const PARTICLE_COUNT = 340;
      const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
        const angle = Math.random() * TWO_PI;
        const dist  = 0.25 + Math.random() * 0.42; // fraction of min(W,H)/2
        return {
          x: 0, y: 0,
          sx: Math.cos(angle) * dist,
          sy: Math.sin(angle) * dist,
          colorMix: Math.random(),
          baseAlpha: 0.4 + Math.random() * 0.5,
          r: 0.8 + Math.random() * 1.6,
          shimmer: Math.random() * TWO_PI,
        };
      });

      const FILAMENT_COUNT = 9;
      const filaments: Filament[] = Array.from({ length: FILAMENT_COUNT }, (_, i) => ({
        angle: (i / FILAMENT_COUNT) * TWO_PI + Math.random() * 0.4,
        angularSpeed: (0.18 + Math.random() * 0.14) * (Math.random() < 0.5 ? 1 : -1),
        orbitRadius: 0.055 + Math.random() * 0.035,
        length: 0.25 + Math.random() * 0.55,
        alpha: 0.25 + Math.random() * 0.35,
        width: 0.8 + Math.random() * 1.4,
        colorMix: Math.random(),
      }));

      const WISP_COUNT = 18;
      const wisps: Wisp[] = Array.from({ length: WISP_COUNT }, () => ({
        angle: Math.random() * TWO_PI,
        angularSpeed: (0.28 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1),
        orbitRadius: 0.07 + Math.random() * 0.05,
        r: 1.2 + Math.random() * 1.8,
        alpha: 0.15 + Math.random() * 0.25,
        shimmer: Math.random() * TWO_PI,
      }));

      // Pulse rings — emitted every ~2.5s during orb phase
      const pulseRings: PulseRing[] = [];
      let lastPulseTime = 0;

      // Dissolve particles — seeded when dissolve() is called
      interface DissolveParticle {
        angle: number; speed: number; r: number; alpha: number; colorMix: number;
      }
      const dissolveParticles: DissolveParticle[] = Array.from({ length: 600 }, () => ({
        angle: Math.random() * TWO_PI,
        speed: 0.12 + Math.random() * 0.28,
        r: 0.6 + Math.random() * 1.8,
        alpha: 0.6 + Math.random() * 0.4,
        colorMix: Math.random(),
      }));

      stateRef.current.startTime = performance.now();

      // ── Render loop ────────────────────────────────────────
      function draw(now: number) {
        stateRef.current.animId = requestAnimationFrame(draw);

        const w = W(), h = H();
        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);
        const elapsed = ((now - stateRef.current.startTime) / 1000) * speed;

        ctx.clearRect(0, 0, w, h);

        // ── Background ───────────────────────────────────────
        ctx.fillStyle = "#020305";
        ctx.fillRect(0, 0, w, h);

        // ── Stars ────────────────────────────────────────────
        for (const s of stars) {
          const twinkle = 0.7 + 0.3 * Math.sin(now * 0.001 * s.twinkleSpeed + s.twinkleOffset);
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.r, 0, TWO_PI);
          ctx.fillStyle = rgba(WHITE, s.a * twinkle);
          ctx.fill();
        }

        // ── Phase timing ─────────────────────────────────────
        // t0: dust drift        0.0–1.2
        // t1: converge          1.2–3.5  → t in [0,1]
        // t2: compress          3.5–5.0  → t in [0,1]
        // t3: ignite/bloom      5.0–6.2  → t in [0,1]
        // t4: orb alive         6.2+

        const convergeT  = clamp((elapsed - 1.2) / 2.3, 0, 1);
        const compressT  = clamp((elapsed - 3.5) / 1.5, 0, 1);
        const bloomT     = clamp((elapsed - 5.0) / 1.2, 0, 1);
        const orbAlive   = elapsed > 6.2;

        // ── Converging particles ─────────────────────────────
        if (!stateRef.current.dissolving) {
          const particleAlpha = orbAlive ? 0 : 1 - easeOut(bloomT);
          if (particleAlpha > 0.01) {
            for (const p of particles) {
              const halfMin = minDim * 0.5;
              // Start position
              const startX = cx + p.sx * halfMin;
              const startY = cy + p.sy * halfMin;
              // Converge toward center
              const ct = easeInOut(convergeT);
              const midX = lerp(startX, cx, ct);
              const midY = lerp(startY, cy, ct);
              // Compress tighter
              const cmp = easeOut(compressT);
              const px = lerp(midX, cx, cmp);
              const py = lerp(midY, cy, cmp);

              p.x = px; p.y = py;

              const shimmer = 0.7 + 0.3 * Math.sin(now * 0.002 + p.shimmer);
              const alpha = p.baseAlpha * shimmer * particleAlpha;
              if (alpha < 0.01) continue;

              const col = p.colorMix < 0.5 ? CYAN : WHITE;
              ctx.beginPath();
              ctx.arc(px, py, p.r, 0, TWO_PI);
              ctx.fillStyle = rgba(col, alpha);
              ctx.fill();
            }
          }
        }

        // ── Brilliant compression point ───────────────────────
        if (compressT > 0.3 && bloomT < 0.99 && !stateRef.current.dissolving) {
          const pointAlpha = easeOut(clamp((compressT - 0.3) / 0.7, 0, 1)) * (1 - easeOut(bloomT));
          const pointR = lerp(0, 3, easeOut(compressT)) * (1 - easeOut(bloomT) * 0.7);
          if (pointAlpha > 0.01) {
            // Outer glow
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, pointR * 12);
            grd.addColorStop(0,   rgba(WHITE, pointAlpha * 0.9));
            grd.addColorStop(0.2, rgba(CYAN,  pointAlpha * 0.6));
            grd.addColorStop(1,   rgba(CYAN,  0));
            ctx.beginPath();
            ctx.arc(cx, cy, pointR * 12, 0, TWO_PI);
            ctx.fillStyle = grd;
            ctx.fill();
            // Core
            ctx.beginPath();
            ctx.arc(cx, cy, pointR, 0, TWO_PI);
            ctx.fillStyle = rgba(WHITE, pointAlpha);
            ctx.fill();
          }
        }

        // ── Orb ───────────────────────────────────────────────
        if (bloomT > 0.05) {
          const orbRadius = minDim * 0.055 * easeOut(bloomT);

          // Breathing: ~2.5s cycle
          const breathPhase = (now * 0.001 * 0.4) % 1; // 0→1 every 2.5s
          const breathe = 0.75 + 0.25 * Math.sin(breathPhase * TWO_PI);
          const orbAlpha = easeOut(bloomT) * (stateRef.current.dissolving ? 0 : 1);

          if (orbAlpha > 0.01) {
            // Outer ambient glow — large, very soft
            const glowR = orbRadius * 6 * breathe;
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
            glow.addColorStop(0,    rgba(CYAN, 0.18 * breathe * orbAlpha));
            glow.addColorStop(0.35, rgba(CYAN, 0.08 * breathe * orbAlpha));
            glow.addColorStop(1,    rgba(CYAN, 0));
            ctx.beginPath();
            ctx.arc(cx, cy, glowR, 0, TWO_PI);
            ctx.fillStyle = glow;
            ctx.fill();

            // Mid glow
            const midGlowR = orbRadius * 2.8 * breathe;
            const midGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, midGlowR);
            midGlow.addColorStop(0,   rgba(WHITE, 0.35 * breathe * orbAlpha));
            midGlow.addColorStop(0.5, rgba(CYAN,  0.22 * breathe * orbAlpha));
            midGlow.addColorStop(1,   rgba(CYAN,  0));
            ctx.beginPath();
            ctx.arc(cx, cy, midGlowR, 0, TWO_PI);
            ctx.fillStyle = midGlow;
            ctx.fill();

            // Core orb body
            const coreGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
            coreGrd.addColorStop(0,   rgba(WHITE, 0.95 * orbAlpha));
            coreGrd.addColorStop(0.4, rgba(CYAN,  0.85 * orbAlpha));
            coreGrd.addColorStop(0.8, rgba(CYAN,  0.55 * orbAlpha));
            coreGrd.addColorStop(1,   rgba(CYAN,  0.15 * orbAlpha));
            ctx.beginPath();
            ctx.arc(cx, cy, orbRadius, 0, TWO_PI);
            ctx.fillStyle = coreGrd;
            ctx.fill();

            // Inner bright core
            ctx.beginPath();
            ctx.arc(cx, cy, orbRadius * 0.28, 0, TWO_PI);
            ctx.fillStyle = rgba(WHITE, 0.9 * orbAlpha);
            ctx.fill();
          }

          // ── Pulse rings ─────────────────────────────────────
          if (orbAlive && !stateRef.current.dissolving) {
            if (now - lastPulseTime > 2500) {
              pulseRings.push({ startTime: now, duration: 2200, maxRadius: minDim * 0.38 });
              lastPulseTime = now;
            }
            for (let i = pulseRings.length - 1; i >= 0; i--) {
              const pr = pulseRings[i];
              const pt = clamp((now - pr.startTime) / pr.duration, 0, 1);
              if (pt >= 1) { pulseRings.splice(i, 1); continue; }
              const pRadius = easeOut(pt) * pr.maxRadius;
              const pAlpha  = (1 - pt) * 0.22 * easeOut(bloomT);
              ctx.beginPath();
              ctx.arc(cx, cy, pRadius, 0, TWO_PI);
              ctx.strokeStyle = rgba(CYAN, pAlpha);
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          }

          // ── Filaments ────────────────────────────────────────
          if (orbAlive && !stateRef.current.dissolving) {
            const filAlpha = clamp((elapsed - 6.2) / 1.5, 0, 1) * easeOut(bloomT);
            for (const f of filaments) {
              f.angle += f.angularSpeed * 0.016; // ~60fps delta
              const fr = minDim * f.orbitRadius;
              const startAngle = f.angle;
              const endAngle   = f.angle + f.length * (f.angularSpeed > 0 ? 1 : -1);

              const col = f.colorMix < 0.5 ? CYAN : GOLD;
              const breathMod = 0.7 + 0.3 * Math.sin(now * 0.001 * 0.5 + f.angle);

              ctx.beginPath();
              ctx.arc(cx, cy, fr, startAngle, endAngle, f.angularSpeed < 0);
              ctx.strokeStyle = rgba(col, f.alpha * filAlpha * breathMod);
              ctx.lineWidth = f.width;
              ctx.lineCap = "round";
              ctx.stroke();
            }
          }

          // ── Wisps ─────────────────────────────────────────────
          if (orbAlive && !stateRef.current.dissolving) {
            const wispAlpha = clamp((elapsed - 6.8) / 1.2, 0, 1);
            for (const w of wisps) {
              w.angle += w.angularSpeed * 0.016;
              const wr = minDim * w.orbitRadius;
              const wx = cx + Math.cos(w.angle) * wr;
              const wy = cy + Math.sin(w.angle) * wr;
              const shimmer = 0.5 + 0.5 * Math.sin(now * 0.003 + w.shimmer);
              ctx.beginPath();
              ctx.arc(wx, wy, w.r, 0, TWO_PI);
              ctx.fillStyle = rgba(CYAN, w.alpha * wispAlpha * shimmer);
              ctx.fill();
            }
          }
        }

        // ── Dissolve exit ─────────────────────────────────────
        if (stateRef.current.dissolving) {
          const dt = (now - stateRef.current.dissolveStart) / 1400; // 0→1 over 1.4s
          const t  = clamp(dt, 0, 1);

          // Orb brightens then fades
          if (t < 0.35) {
            const bt = t / 0.35;
            const orbRadius = minDim * 0.055;
            const brightGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius * 10 * bt);
            brightGlow.addColorStop(0,   rgba(WHITE, 0.9 * bt));
            brightGlow.addColorStop(0.3, rgba(CYAN,  0.5 * bt));
            brightGlow.addColorStop(1,   rgba(CYAN,  0));
            ctx.beginPath();
            ctx.arc(cx, cy, orbRadius * 10 * bt, 0, TWO_PI);
            ctx.fillStyle = brightGlow;
            ctx.fill();
          }

          // Particles stream outward
          const minDimNow = Math.min(W(), H());
          for (const dp of dissolveParticles) {
            const dist = easeOut(t) * dp.speed * minDimNow * 0.8;
            const px = cx + Math.cos(dp.angle) * dist;
            const py = cy + Math.sin(dp.angle) * dist;
            const alpha = dp.alpha * (1 - t);
            if (alpha < 0.01) continue;
            const col = dp.colorMix < 0.6 ? CYAN : WHITE;
            ctx.beginPath();
            ctx.arc(px, py, dp.r * (1 - t * 0.5), 0, TWO_PI);
            ctx.fillStyle = rgba(col, alpha);
            ctx.fill();
          }

          if (t >= 1) {
            cancelAnimationFrame(stateRef.current.animId);
            onDissolveComplete?.();
          }
        }
      }

      stateRef.current.animId = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(stateRef.current.animId);
        ro.disconnect();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    );
  }
);

AshaIntelligenceCanvas.displayName = "AshaIntelligenceCanvas";
export default AshaIntelligenceCanvas;
