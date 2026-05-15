/* ============================================================
   FAULTLINE — Abstract Pressure Engine
   Canvas-based cinematic animation system.
   Renders: pressure waves, liquidity shockwaves, fracture lines,
   neural network overlay, energy pulses, volatility distortions.
   ============================================================ */

export interface PressureEngineConfig {
  canvas: HTMLCanvasElement;
  intensity?: number; // 0–1, controls overall energy level
}

// ── Types ─────────────────────────────────────────────────────

interface PressureWave {
  x: number; y: number;
  radius: number; maxRadius: number;
  opacity: number; speed: number;
  color: string; lineWidth: number;
  type: 'shockwave' | 'pulse' | 'ripple';
}

interface FractureLine {
  points: Array<{ x: number; y: number }>;
  opacity: number; maxOpacity: number;
  color: string; lineWidth: number;
  progress: number; speed: number;
  glowIntensity: number;
}

interface NeuralNode {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; opacity: number;
  color: string; pulsePhase: number;
  connections: number[];
}

interface EnergyParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  trail: Array<{ x: number; y: number }>;
}

interface FlowField {
  cols: number; rows: number;
  cellSize: number;
  angles: Float32Array;
  time: number;
}

// ── Color palette ─────────────────────────────────────────────
const COLORS = {
  electricBlue: '#00D4FF',
  electricBlueRgb: '0,212,255',
  crimson: '#FF2D55',
  crimsonRgb: '255,45,85',
  gold: '#FFD700',
  goldRgb: '255,215,0',
  orange: '#FF9500',
  orangeRgb: '255,149,0',
  graphite: '#1A1D24',
  deepBlue: '#0A1628',
};

// ── Utility ───────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max)); }
/** Convert a 6-digit hex color (#RRGGBB) to an rgba() string. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}
function noise(x: number, y: number, t: number) {
  return Math.sin(x * 0.3 + t) * Math.cos(y * 0.2 + t * 0.7) +
    Math.sin(x * 0.7 - t * 0.5) * Math.cos(y * 0.5 + t * 0.3) * 0.5;
}

// ── Main Engine Class ─────────────────────────────────────────
export class PressureEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf: number = 0;
  private time: number = 0;
  private intensity: number;
  private width: number = 0;
  private height: number = 0;

  private waves: PressureWave[] = [];
  private fractures: FractureLine[] = [];
  private nodes: NeuralNode[] = [];
  private particles: EnergyParticle[] = [];
  private flowField: FlowField | null = null;

  private lastWaveTime: number = 0;
  private lastFractureTime: number = 0;
  private lastParticleTime: number = 0;

  // Off-screen buffer for glow compositing
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;

  constructor(config: PressureEngineConfig) {
    this.canvas = config.canvas;
    this.ctx = this.canvas.getContext('2d')!;
    this.intensity = config.intensity ?? 0.6;

    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;

    this.resize();
    this.initNeuralNetwork();
    this.initFlowField();
    this.spawnInitialWaves();
  }

  // ── Init ───────────────────────────────────────────────────

  resize() {
    this.width = this.canvas.offsetWidth || window.innerWidth;
    this.height = this.canvas.offsetHeight || window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    if (this.flowField) this.initFlowField();
    if (this.nodes.length > 0) this.initNeuralNetwork();
  }

  private initNeuralNetwork() {
    const count = Math.min(40, Math.floor((this.width * this.height) / 18000));
    this.nodes = Array.from({ length: count }, (_, i) => ({
      x: rand(0, this.width),
      y: rand(0, this.height),
      vx: rand(-0.15, 0.15),
      vy: rand(-0.12, 0.12),
      radius: rand(1.5, 3.5),
      opacity: rand(0.2, 0.6),
      color: Math.random() > 0.7 ? COLORS.electricBlue : Math.random() > 0.5 ? COLORS.gold : COLORS.crimson,
      pulsePhase: rand(0, Math.PI * 2),
      connections: [],
    }));
    // Pre-compute connections (nearest 3)
    this.nodes.forEach((node, i) => {
      const distances = this.nodes
        .map((n, j) => ({ j, d: Math.hypot(n.x - node.x, n.y - node.y) }))
        .filter(({ j }) => j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(({ j }) => j);
      node.connections = distances;
    });
  }

  private initFlowField() {
    const cellSize = 40;
    const cols = Math.ceil(this.width / cellSize) + 1;
    const rows = Math.ceil(this.height / cellSize) + 1;
    this.flowField = {
      cols, rows, cellSize, time: 0,
      angles: new Float32Array(cols * rows),
    };
  }

  private spawnInitialWaves() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.spawnWave(), i * 600);
    }
  }

  // ── Spawn helpers ──────────────────────────────────────────

  private spawnWave() {
    const cx = rand(this.width * 0.2, this.width * 0.8);
    const cy = rand(this.height * 0.2, this.height * 0.8);
    const maxR = rand(this.width * 0.3, this.width * 0.7);
    const type = Math.random() > 0.6 ? 'shockwave' : Math.random() > 0.5 ? 'pulse' : 'ripple';
    const colorRoll = Math.random();
    const color = colorRoll > 0.6 ? COLORS.electricBlue : colorRoll > 0.3 ? COLORS.crimson : COLORS.gold;
    this.waves.push({
      x: cx, y: cy, radius: 0, maxRadius: maxR,
      opacity: type === 'shockwave' ? 0.7 : 0.4,
      speed: type === 'shockwave' ? rand(1.5, 2.5) : rand(0.6, 1.2),
      color, lineWidth: type === 'shockwave' ? rand(1.5, 3) : rand(0.5, 1.5),
      type,
    });
  }

  private spawnFracture() {
    const startX = rand(this.width * 0.1, this.width * 0.9);
    const startY = rand(this.height * 0.1, this.height * 0.9);
    const segments = randInt(4, 10);
    const points: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let angle = rand(0, Math.PI * 2);
    for (let i = 0; i < segments; i++) {
      angle += rand(-0.8, 0.8);
      const len = rand(20, 80);
      const last = points[points.length - 1];
      points.push({
        x: last.x + Math.cos(angle) * len,
        y: last.y + Math.sin(angle) * len,
      });
    }
    const colorRoll = Math.random();
    const color = colorRoll > 0.5 ? COLORS.electricBlue : colorRoll > 0.25 ? COLORS.crimson : COLORS.gold;
    this.fractures.push({
      points, opacity: 0, maxOpacity: rand(0.3, 0.7),
      color, lineWidth: rand(0.5, 1.5),
      progress: 0, speed: rand(0.008, 0.02),
      glowIntensity: rand(4, 12),
    });
  }

  private spawnParticle() {
    // Spawn along flow field or from a random edge
    const edge = Math.random() > 0.5;
    let x: number, y: number;
    if (edge) {
      const side = randInt(0, 4);
      if (side === 0) { x = rand(0, this.width); y = 0; }
      else if (side === 1) { x = this.width; y = rand(0, this.height); }
      else if (side === 2) { x = rand(0, this.width); y = this.height; }
      else { x = 0; y = rand(0, this.height); }
    } else {
      x = rand(0, this.width);
      y = rand(0, this.height);
    }
    const angle = noise(x * 0.005, y * 0.005, this.time * 0.001) * Math.PI * 2;
    const speed = rand(0.3, 1.2);
    const colorRoll = Math.random();
    const color = colorRoll > 0.6 ? COLORS.electricBlue : colorRoll > 0.3 ? COLORS.crimson : COLORS.gold;
    const life = rand(120, 300);
    this.particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life, maxLife: life, size: rand(0.8, 2.2), color, trail: [],
    });
  }

  // ── Update ─────────────────────────────────────────────────

  private update() {
    this.time++;

    // Spawn waves
    if (this.time - this.lastWaveTime > rand(80, 180)) {
      this.spawnWave();
      this.lastWaveTime = this.time;
    }

    // Spawn fractures
    if (this.time - this.lastFractureTime > rand(60, 140)) {
      this.spawnFracture();
      this.lastFractureTime = this.time;
    }

    // Spawn particles
    if (this.time - this.lastParticleTime > 4) {
      if (this.particles.length < 120) this.spawnParticle();
      this.lastParticleTime = this.time;
    }

    // Update waves
    this.waves = this.waves.filter(w => {
      w.radius += w.speed;
      w.opacity = Math.max(0, w.opacity * (1 - w.radius / w.maxRadius) * 1.01);
      return w.radius < w.maxRadius && w.opacity > 0.005;
    });

    // Update fractures
    this.fractures = this.fractures.filter(f => {
      f.progress = Math.min(1, f.progress + f.speed);
      if (f.progress < 0.5) {
        f.opacity = lerp(0, f.maxOpacity, f.progress * 2);
      } else {
        f.opacity = lerp(f.maxOpacity, 0, (f.progress - 0.5) * 2);
      }
      return f.opacity > 0.005;
    });

    // Update neural nodes
    this.nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      // Soft boundary bounce
      if (node.x < 0 || node.x > this.width) node.vx *= -1;
      if (node.y < 0 || node.y > this.height) node.vy *= -1;
      node.x = Math.max(0, Math.min(this.width, node.x));
      node.y = Math.max(0, Math.min(this.height, node.y));
      node.pulsePhase += 0.03;
    });

    // Update particles
    this.particles = this.particles.filter(p => {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 12) p.trail.shift();

      // Flow field influence
      if (this.flowField) {
        const col = Math.floor(p.x / this.flowField.cellSize);
        const row = Math.floor(p.y / this.flowField.cellSize);
        const idx = row * this.flowField.cols + col;
        const angle = this.flowField.angles[idx] ?? 0;
        p.vx += Math.cos(angle) * 0.02;
        p.vy += Math.sin(angle) * 0.02;
      }

      // Speed limit
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > 1.5) { p.vx *= 1.5 / spd; p.vy *= 1.5 / spd; }

      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      return p.life > 0 && p.x > -20 && p.x < this.width + 20 && p.y > -20 && p.y < this.height + 20;
    });

    // Update flow field
    if (this.flowField) {
      this.flowField.time += 0.004;
      for (let r = 0; r < this.flowField.rows; r++) {
        for (let c = 0; c < this.flowField.cols; c++) {
          const x = c * this.flowField.cellSize;
          const y = r * this.flowField.cellSize;
          this.flowField.angles[r * this.flowField.cols + c] =
            noise(x * 0.003, y * 0.003, this.flowField.time) * Math.PI * 2;
        }
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────

  private draw() {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // Background — deep atmospheric gradient
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    bg.addColorStop(0, '#0A0E1A');
    bg.addColorStop(0.4, '#060810');
    bg.addColorStop(1, '#020305');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Atmospheric depth fog layers
    this.drawAtmosphere(ctx, W, H);

    // Neural network connections
    this.drawNeuralConnections(ctx);

    // Flow field visualization (very subtle)
    this.drawFlowField(ctx, W, H);

    // Pressure waves
    this.drawWaves(ctx);

    // Fracture lines
    this.drawFractures(ctx);

    // Energy particles
    this.drawParticles(ctx);

    // Neural nodes (on top)
    this.drawNeuralNodes(ctx);

    // Vignette
    this.drawVignette(ctx, W, H);
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const t = this.time * 0.002;

    // Slow-moving atmospheric blobs
    const blobs = [
      { x: W * (0.3 + Math.sin(t * 0.7) * 0.1), y: H * (0.4 + Math.cos(t * 0.5) * 0.1), r: W * 0.35, color: COLORS.electricBlueRgb, a: 0.04 },
      { x: W * (0.7 + Math.cos(t * 0.6) * 0.08), y: H * (0.6 + Math.sin(t * 0.4) * 0.08), r: W * 0.3, color: COLORS.crimsonRgb, a: 0.03 },
      { x: W * (0.5 + Math.sin(t * 0.3) * 0.15), y: H * (0.3 + Math.cos(t * 0.8) * 0.12), r: W * 0.25, color: COLORS.goldRgb, a: 0.025 },
    ];

    blobs.forEach(blob => {
      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      grad.addColorStop(0, `rgba(${blob.color},${blob.a})`);
      grad.addColorStop(1, `rgba(${blob.color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    });
  }

  private drawFlowField(ctx: CanvasRenderingContext2D, W: number, H: number) {
    if (!this.flowField) return;
    // Very subtle flow field visualization — just faint directional marks
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = COLORS.electricBlue;
    ctx.lineWidth = 0.5;
    const step = this.flowField.cellSize * 2;
    for (let y = step; y < H; y += step) {
      for (let x = step; x < W; x += step) {
        const col = Math.floor(x / this.flowField.cellSize);
        const row = Math.floor(y / this.flowField.cellSize);
        const angle = this.flowField.angles[row * this.flowField.cols + col] ?? 0;
        const len = 8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawNeuralConnections(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.nodes.forEach((node, i) => {
      node.connections.forEach(j => {
        const other = this.nodes[j];
        if (!other) return;
        const dist = Math.hypot(other.x - node.x, other.y - node.y);
        const maxDist = 200;
        if (dist > maxDist) return;
        const alpha = (1 - dist / maxDist) * 0.15 * node.opacity;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      });
    });
    ctx.restore();
  }

  private drawNeuralNodes(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.nodes.forEach(node => {
      const pulse = 0.5 + 0.5 * Math.sin(node.pulsePhase);
      const r = node.radius * (0.8 + pulse * 0.4);
      const alpha = node.opacity * (0.5 + pulse * 0.5);

      // Glow
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 4);
      glow.addColorStop(0, hexToRgba(node.color, alpha * 0.3));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.globalAlpha = alpha;
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private drawWaves(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.waves.forEach(wave => {
      ctx.globalAlpha = wave.opacity * this.intensity;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = wave.lineWidth;

      if (wave.type === 'shockwave') {
        // Sharp expanding ring with inner glow
        ctx.shadowColor = wave.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner ring
        if (wave.radius > 10) {
          ctx.globalAlpha = wave.opacity * 0.3 * this.intensity;
          ctx.lineWidth = wave.lineWidth * 0.5;
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, wave.radius * 0.85, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (wave.type === 'pulse') {
        // Filled radial pulse
        const grad = ctx.createRadialGradient(wave.x, wave.y, 0, wave.x, wave.y, wave.radius);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0)');
        grad.addColorStop(0.9, hexToRgba(wave.color, wave.opacity * (40 / 255)));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Ripple — multiple thin rings
        for (let k = 0; k < 3; k++) {
          const r = wave.radius - k * 8;
          if (r <= 0) continue;
          ctx.globalAlpha = wave.opacity * (1 - k * 0.3) * this.intensity;
          ctx.lineWidth = wave.lineWidth * (1 - k * 0.3);
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
    ctx.restore();
  }

  private drawFractures(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.fractures.forEach(f => {
      if (f.points.length < 2) return;
      const totalLen = f.points.length - 1;
      const drawUpTo = Math.floor(f.progress * totalLen);

      ctx.globalAlpha = f.opacity;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = f.lineWidth;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = f.glowIntensity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(f.points[0].x, f.points[0].y);
      for (let i = 1; i <= drawUpTo && i < f.points.length; i++) {
        ctx.lineTo(f.points[i].x, f.points[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Bright tip glow
      if (drawUpTo < f.points.length - 1) {
        const tip = f.points[drawUpTo];
        ctx.globalAlpha = f.opacity * 0.8;
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, f.lineWidth * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.particles.forEach(p => {
      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio < 0.2 ? lifeRatio * 5 : lifeRatio > 0.8 ? (1 - lifeRatio) * 5 : 1;

      // Trail
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5;
        ctx.globalAlpha = alpha * 0.3;
        ctx.stroke();
      }

      // Core
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.3, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Public API ─────────────────────────────────────────────

  start() {
    const loop = () => {
      this.update();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  triggerShockwave(x?: number, y?: number) {
    this.waves.push({
      x: x ?? this.width * 0.5,
      y: y ?? this.height * 0.5,
      radius: 0,
      maxRadius: Math.max(this.width, this.height) * 0.8,
      opacity: 0.9,
      speed: 3,
      color: COLORS.electricBlue,
      lineWidth: 2.5,
      type: 'shockwave',
    });
  }
}
