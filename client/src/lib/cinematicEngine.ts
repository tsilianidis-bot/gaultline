/**
 * FAULTLINE Cinematic Engine
 * Canvas 2D rendering engine for the cinematic intro.
 *
 * Architecture:
 *   - CinematicEngine: main render loop, camera, scene management
 *   - ParticleSystem: physics-based particles with lifecycle
 *   - AtmosphereLayer: volumetric fog, dust, light rays
 *   - EarthRenderer: planetary sphere, rotation, ocean shimmer, clouds
 *   - TectonicRenderer: fault lines, energy flow, pressure rings, magma
 *   - DataRenderer: market data streams, network nodes, signal pulses
 *   - AshaRenderer: particle convergence, energy assembly, materialization
 *
 * Performance target: 60fps on any modern device.
 * No WebGL, no external dependencies, no startup latency.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CinematicScene = 1 | 2 | 3 | 4 | 5 | 6;

export interface CinematicEngineOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pressureScore?: number; // 0–10
  regime?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;       // 0–1
  maxLife: number;    // seconds
  age: number;        // seconds
  size: number;
  color: string;
  alpha: number;
  type: ParticleType;
  data?: Record<string, number>;
}

type ParticleType =
  | "dust"
  | "data"
  | "seismic"
  | "magma"
  | "asha"
  | "network"
  | "pressure"
  | "star";

interface FaultLine {
  points: { x: number; y: number }[];
  energy: number;       // 0–1 current energy
  targetEnergy: number;
  glowPhase: number;
  crackProgress: number; // 0–1
}

interface SeismicWave {
  cx: number;
  cy: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
  color: string;
  born: number;
}

interface NetworkNode {
  x: number;
  y: number;
  label: string;
  pulse: number;
  connections: number[];
  alpha: number;
  size: number;
}

interface DataStream {
  x: number;
  y: number;
  chars: string[];
  speed: number;
  alpha: number;
  color: string;
  offset: number;
}

interface Camera {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  zoom: number;
  targetZoom: number;
  rotation: number;
  targetRotation: number;
  shake: number;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// ── CinematicEngine ───────────────────────────────────────────────────────────

export class CinematicEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private cx: number;
  private cy: number;
  private pressureScore: number;
  private regime: string;

  private scene: CinematicScene = 1;
  private sceneTime: number = 0;
  private totalTime: number = 0;
  private lastTimestamp: number = 0;
  private rafId: number = 0;
  private running: boolean = false;

  // Scene transition
  private sceneAlpha: number = 1;
  private transitioning: boolean = false;
  private transitionProgress: number = 0;
  private nextScene: CinematicScene | null = null;

  // Camera
  private camera: Camera = {
    x: 0, y: 0, targetX: 0, targetY: 0,
    zoom: 1, targetZoom: 1,
    rotation: 0, targetRotation: 0,
    shake: 0,
  };

  // Particles
  private particles: Particle[] = [];
  private maxParticles: number = 600;

  // Earth
  private earthRotation: number = 0;
  private cloudOffset: number = 0;
  private earthGlow: number = 0;
  private tectonicPulse: number = 0;

  // Fault lines
  private faultLines: FaultLine[] = [];

  // Seismic waves
  private seismicWaves: SeismicWave[] = [];
  private nextWaveTime: number = 0;

  // Data layer
  private dataStreams: DataStream[] = [];
  private networkNodes: NetworkNode[] = [];
  private dataAlpha: number = 0;

  // ASHA
  private ashaProgress: number = 0; // 0–1 materialization
  private ashaParticles: Particle[] = [];

  // Atmosphere
  private fogLayers: { x: number; y: number; r: number; alpha: number; speed: number; phase: number }[] = [];
  private dustMotes: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
  private lightRays: { angle: number; length: number; alpha: number; width: number; phase: number }[] = [];

  // Noise field (pre-computed for performance)
  private noiseField: Float32Array;
  private noiseW = 64;
  private noiseH = 64;

  constructor(options: CinematicEngineOptions) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext("2d")!;
    this.width = options.width;
    this.height = options.height;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.pressureScore = options.pressureScore ?? 6.5;
    this.regime = options.regime ?? "ELEVATED RISK";

    this.noiseField = new Float32Array(this.noiseW * this.noiseH);
    this.generateNoise();
    this.initScene1();
  }

  // ── Noise ──────────────────────────────────────────────────────────────────

  private generateNoise(): void {
    for (let i = 0; i < this.noiseField.length; i++) {
      this.noiseField[i] = Math.random();
    }
  }

  private sampleNoise(x: number, y: number, t: number): number {
    const nx = Math.floor(((x / this.width) * this.noiseW + t * 2) % this.noiseW);
    const ny = Math.floor(((y / this.height) * this.noiseH + t) % this.noiseH);
    const idx = ((ny + this.noiseH) % this.noiseH) * this.noiseW + ((nx + this.noiseW) % this.noiseW);
    return this.noiseField[idx];
  }

  // ── Scene initialization ───────────────────────────────────────────────────

  private initScene1(): void {
    // Fault line network — 5 major fault lines
    this.faultLines = [];
    const faultConfigs = [
      { points: [{ x: 0.1, y: 0.45 }, { x: 0.35, y: 0.52 }, { x: 0.6, y: 0.48 }, { x: 0.85, y: 0.55 }] },
      { points: [{ x: 0.2, y: 0.35 }, { x: 0.45, y: 0.42 }, { x: 0.7, y: 0.38 }] },
      { points: [{ x: 0.15, y: 0.6 }, { x: 0.4, y: 0.58 }, { x: 0.65, y: 0.62 }, { x: 0.9, y: 0.57 }] },
      { points: [{ x: 0.3, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.7, y: 0.65 }] },
      { points: [{ x: 0.05, y: 0.55 }, { x: 0.25, y: 0.48 }, { x: 0.55, y: 0.55 }, { x: 0.8, y: 0.45 }] },
    ];
    faultConfigs.forEach(cfg => {
      this.faultLines.push({
        points: cfg.points.map(p => ({ x: p.x * this.width, y: p.y * this.height })),
        energy: 0,
        targetEnergy: rand(0.2, 0.6),
        glowPhase: rand(0, Math.PI * 2),
        crackProgress: 0,
      });
    });

    // Atmosphere fog layers
    this.fogLayers = [];
    for (let i = 0; i < 8; i++) {
      this.fogLayers.push({
        x: rand(0, this.width),
        y: rand(0, this.height),
        r: rand(200, 500),
        alpha: rand(0.02, 0.08),
        speed: rand(0.01, 0.04),
        phase: rand(0, Math.PI * 2),
      });
    }

    // Dust motes
    this.dustMotes = [];
    for (let i = 0; i < 120; i++) {
      this.dustMotes.push({
        x: rand(0, this.width),
        y: rand(0, this.height),
        vx: rand(-0.3, 0.3),
        vy: rand(-0.1, 0.05),
        size: rand(0.5, 2),
        alpha: rand(0.1, 0.4),
      });
    }

    // Light rays
    this.lightRays = [];
    for (let i = 0; i < 6; i++) {
      this.lightRays.push({
        angle: rand(-0.3, 0.3),
        length: rand(0.4, 0.8) * this.height,
        alpha: rand(0.02, 0.06),
        width: rand(40, 120),
        phase: rand(0, Math.PI * 2),
      });
    }

    // Initial particles
    this.spawnParticles("dust", 80);
    this.spawnParticles("star", 40);
  }

  private initScene2(): void {
    this.seismicWaves = [];
    this.nextWaveTime = 0;
    this.spawnParticles("seismic", 60);
    this.spawnParticles("pressure", 40);
  }

  private initScene3(): void {
    this.dataAlpha = 0;
    this.initDataLayer();
    this.spawnParticles("data", 100);
  }

  private initScene4(): void {
    this.ashaProgress = 0;
    this.ashaParticles = [];
    this.spawnAshaParticles();
  }

  private initScene5(): void {
    this.spawnParticles("data", 80);
    this.spawnParticles("network", 40);
  }

  private initDataLayer(): void {
    // Data streams — falling terminal characters
    this.dataStreams = [];
    const dataChars = "0123456789ABCDEF+-×÷=∑∆∇∞%$€£¥↑↓←→◆●■▲▼";
    const marketTerms = ["SPX", "VIX", "DXY", "TLT", "GLD", "BTC", "RISK", "PRESSURE", "REGIME", "SIGNAL", "FAULT", "SEISMIC"];
    for (let i = 0; i < 20; i++) {
      const chars: string[] = [];
      const len = Math.floor(rand(8, 24));
      for (let j = 0; j < len; j++) {
        if (Math.random() < 0.15) {
          chars.push(marketTerms[Math.floor(Math.random() * marketTerms.length)]);
        } else {
          chars.push(dataChars[Math.floor(Math.random() * dataChars.length)]);
        }
      }
      this.dataStreams.push({
        x: rand(0, this.width),
        y: rand(-this.height, 0),
        chars,
        speed: rand(40, 120),
        alpha: rand(0.3, 0.8),
        color: Math.random() < 0.7 ? "#00FF88" : "#00CCFF",
        offset: 0,
      });
    }

    // Network nodes
    this.networkNodes = [];
    const nodeLabels = ["PRESSURE", "SEISMOGRAPH", "ASHA", "REGIME", "ANALOG", "VOLATILITY", "CREDIT", "LIQUIDITY", "MOMENTUM", "SENTIMENT"];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(0.2, 0.4) * Math.min(this.width, this.height);
      this.networkNodes.push({
        x: this.cx + Math.cos(angle) * r,
        y: this.cy + Math.sin(angle) * r,
        label: nodeLabels[i],
        pulse: rand(0, Math.PI * 2),
        connections: [(i + 1) % 10, (i + 2) % 10, (i + 4) % 10],
        alpha: 0,
        size: rand(4, 8),
      });
    }
  }

  private spawnAshaParticles(): void {
    this.ashaParticles = [];
    for (let i = 0; i < 300; i++) {
      // Start at random positions around the edges
      const angle = rand(0, Math.PI * 2);
      const dist = rand(0.3, 0.8) * Math.min(this.width, this.height);
      this.ashaParticles.push({
        x: this.cx + Math.cos(angle) * dist,
        y: this.cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        life: 1,
        maxLife: rand(2, 5),
        age: 0,
        size: rand(1, 4),
        color: Math.random() < 0.6 ? "#00CCFF" : Math.random() < 0.5 ? "#00FF88" : "#8B5CF6",
        alpha: rand(0.3, 0.9),
        type: "asha",
        data: { angle, dist, targetX: this.cx, targetY: this.cy - 20 },
      });
    }
  }

  // ── Particle system ────────────────────────────────────────────────────────

  private spawnParticles(type: ParticleType, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push(this.createParticle(type));
    }
  }

  private createParticle(type: ParticleType): Particle {
    switch (type) {
      case "dust":
        return {
          x: rand(0, this.width), y: rand(0, this.height),
          vx: rand(-0.5, 0.5), vy: rand(-0.3, 0.1),
          life: 1, maxLife: rand(8, 20), age: rand(0, 10),
          size: rand(0.5, 2.5), color: "#FFFFFF",
          alpha: rand(0.05, 0.25), type,
        };
      case "star":
        return {
          x: rand(0, this.width), y: rand(0, this.height * 0.5),
          vx: 0, vy: 0,
          life: 1, maxLife: rand(3, 8), age: rand(0, 5),
          size: rand(0.5, 1.5), color: "#FFFFFF",
          alpha: rand(0.1, 0.6), type,
          data: { twinklePhase: rand(0, Math.PI * 2), twinkleSpeed: rand(0.5, 2) },
        };
      case "seismic":
        return {
          x: rand(0, this.width), y: rand(this.height * 0.3, this.height * 0.8),
          vx: rand(-2, 2), vy: rand(-3, -0.5),
          life: 1, maxLife: rand(1, 3), age: 0,
          size: rand(1, 4), color: "#FF6600",
          alpha: rand(0.4, 0.9), type,
        };
      case "magma":
        return {
          x: rand(this.width * 0.1, this.width * 0.9),
          y: rand(this.height * 0.5, this.height * 0.9),
          vx: rand(-1, 1), vy: rand(-2, -0.3),
          life: 1, maxLife: rand(0.5, 2), age: 0,
          size: rand(2, 6), color: `hsl(${rand(10, 40)}, 100%, 60%)`,
          alpha: rand(0.5, 1), type,
        };
      case "data":
        return {
          x: rand(0, this.width), y: rand(0, this.height),
          vx: rand(-1, 1), vy: rand(-1, 1),
          life: 1, maxLife: rand(2, 6), age: 0,
          size: rand(1, 3), color: Math.random() < 0.7 ? "#00FF88" : "#00CCFF",
          alpha: rand(0.3, 0.8), type,
        };
      case "network":
        return {
          x: rand(0, this.width), y: rand(0, this.height),
          vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5),
          life: 1, maxLife: rand(3, 8), age: 0,
          size: rand(1, 2), color: "#8B5CF6",
          alpha: rand(0.2, 0.6), type,
        };
      case "pressure":
        return {
          x: rand(0, this.width), y: rand(this.height * 0.3, this.height * 0.7),
          vx: rand(-3, 3), vy: rand(-1, 1),
          life: 1, maxLife: rand(0.5, 1.5), age: 0,
          size: rand(2, 5), color: `hsl(${rand(180, 220)}, 100%, 70%)`,
          alpha: rand(0.4, 0.9), type,
        };
      case "asha":
        return {
          x: rand(0, this.width), y: rand(0, this.height),
          vx: 0, vy: 0,
          life: 1, maxLife: rand(2, 5), age: 0,
          size: rand(1, 3), color: "#00CCFF",
          alpha: rand(0.3, 0.8), type,
        };
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.life = 1 - p.age / p.maxLife;

      if (p.life <= 0) {
        // Respawn certain types
        if (p.type === "dust" || p.type === "star") {
          Object.assign(p, this.createParticle(p.type));
        } else {
          this.particles.splice(i, 1);
        }
        continue;
      }

      // Physics
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      // Type-specific behavior
      if (p.type === "dust") {
        // Gentle drift with noise
        const n = this.sampleNoise(p.x, p.y, this.totalTime * 0.05);
        p.vx += (n - 0.5) * 0.01;
        p.vy += (n - 0.5) * 0.005;
        p.vx *= 0.99;
        p.vy *= 0.99;
        // Wrap around screen
        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
        if (p.y < 0) p.y = this.height;
        if (p.y > this.height) p.y = 0;
      } else if (p.type === "star") {
        // Twinkle
        if (p.data) {
          p.data.twinklePhase += dt * p.data.twinkleSpeed;
          p.alpha = (0.2 + 0.4 * Math.sin(p.data.twinklePhase)) * p.life;
        }
      } else if (p.type === "seismic") {
        p.vy += 0.05 * dt * 60; // Gravity
        p.alpha = p.life * 0.9;
      } else if (p.type === "magma") {
        p.vy -= 0.02 * dt * 60; // Buoyancy
        p.size *= (1 + 0.01 * dt * 60); // Expand
        p.alpha = p.life * 0.8;
      } else if (p.type === "data") {
        p.alpha = p.life * 0.7;
      } else if (p.type === "pressure") {
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha = p.life * 0.8;
      }
    }
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  private updateCamera(dt: number): void {
    const t = this.sceneTime;

    // Scene-specific camera behavior
    switch (this.scene) {
      case 1: {
        // Slow push toward Earth center
        this.camera.targetX = Math.sin(t * 0.05) * 15;
        this.camera.targetY = Math.cos(t * 0.03) * 10;
        this.camera.targetZoom = 1 + t * 0.008;
        break;
      }
      case 2: {
        // Orbit — circular motion
        this.camera.targetX = Math.sin(t * 0.08) * 25;
        this.camera.targetY = Math.cos(t * 0.06) * 20;
        this.camera.targetZoom = 1.05 + Math.sin(t * 0.1) * 0.05;
        break;
      }
      case 3: {
        // Depth pull — zoom out to reveal data layer
        this.camera.targetX = Math.sin(t * 0.04) * 10;
        this.camera.targetY = Math.cos(t * 0.03) * 8;
        this.camera.targetZoom = 1.1 - t * 0.01;
        break;
      }
      case 4: {
        // Slow convergence toward ASHA center
        this.camera.targetX = 0;
        this.camera.targetY = -20 * this.ashaProgress;
        this.camera.targetZoom = 1 + this.ashaProgress * 0.08;
        break;
      }
      case 5: {
        // Slow pull back — reveal the full system
        this.camera.targetX = 0;
        this.camera.targetY = 0;
        this.camera.targetZoom = 1 - t * 0.005;
        break;
      }
    }

    // Smooth interpolation
    this.camera.x = lerp(this.camera.x, this.camera.targetX, dt * 2);
    this.camera.y = lerp(this.camera.y, this.camera.targetY, dt * 2);
    this.camera.zoom = lerp(this.camera.zoom, this.camera.targetZoom, dt * 1.5);
    this.camera.rotation = lerp(this.camera.rotation, this.camera.targetRotation, dt * 1);

    // Decay shake
    this.camera.shake *= 0.9;
  }

  public addCameraShake(intensity: number): void {
    this.camera.shake = Math.min(this.camera.shake + intensity, 20);
  }

  // ── Apply camera transform ─────────────────────────────────────────────────

  private applyCameraTransform(): void {
    const ctx = this.ctx;
    const shake = this.camera.shake;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

    ctx.translate(this.cx + this.camera.x + sx, this.cy + this.camera.y + sy);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.rotate(this.camera.rotation);
    ctx.translate(-this.cx, -this.cy);
  }

  // ── Rendering layers ───────────────────────────────────────────────────────

  private renderBackground(): void {
    const ctx = this.ctx;
    const t = this.totalTime;

    // Deep void — animated radial gradient
    const bgGrad = ctx.createRadialGradient(
      this.cx + Math.sin(t * 0.05) * 50,
      this.cy + Math.cos(t * 0.04) * 40,
      0,
      this.cx, this.cy, this.width * 0.8
    );

    // Color shifts with scene
    const scene = this.scene;
    if (scene === 1 || scene === 2) {
      bgGrad.addColorStop(0, `hsla(220, 40%, 8%, 1)`);
      bgGrad.addColorStop(0.4, `hsla(210, 50%, 4%, 1)`);
      bgGrad.addColorStop(1, `hsla(0, 0%, 0%, 1)`);
    } else if (scene === 3) {
      const blend = clamp(this.dataAlpha, 0, 1);
      bgGrad.addColorStop(0, `hsla(${lerp(220, 180, blend)}, 40%, ${lerp(8, 5, blend)}%, 1)`);
      bgGrad.addColorStop(0.4, `hsla(${lerp(210, 190, blend)}, 50%, ${lerp(4, 3, blend)}%, 1)`);
      bgGrad.addColorStop(1, `hsla(0, 0%, 0%, 1)`);
    } else if (scene === 4) {
      bgGrad.addColorStop(0, `hsla(260, 50%, 6%, 1)`);
      bgGrad.addColorStop(0.4, `hsla(240, 60%, 3%, 1)`);
      bgGrad.addColorStop(1, `hsla(0, 0%, 0%, 1)`);
    } else {
      bgGrad.addColorStop(0, `hsla(200, 60%, 5%, 1)`);
      bgGrad.addColorStop(0.4, `hsla(210, 50%, 3%, 1)`);
      bgGrad.addColorStop(1, `hsla(0, 0%, 0%, 1)`);
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private renderStars(): void {
    const ctx = this.ctx;
    const stars = this.particles.filter(p => p.type === "star");
    for (const star of stars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
      ctx.fill();
    }
  }

  private renderAtmosphere(): void {
    const ctx = this.ctx;
    const t = this.totalTime;

    // Volumetric fog layers — each moves independently (parallax)
    for (const fog of this.fogLayers) {
      fog.x += fog.speed * 0.5;
      if (fog.x > this.width + fog.r) fog.x = -fog.r;

      // Breathing alpha
      const breathe = Math.sin(t * 0.3 + fog.phase) * 0.3 + 0.7;

      const grad = ctx.createRadialGradient(fog.x, fog.y, 0, fog.x, fog.y, fog.r);
      grad.addColorStop(0, `rgba(100,160,255,${fog.alpha * breathe})`);
      grad.addColorStop(1, `rgba(100,160,255,0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(fog.x - fog.r, fog.y - fog.r, fog.r * 2, fog.r * 2);
    }

    // Light rays from top
    ctx.save();
    for (const ray of this.lightRays) {
      const breathe = Math.sin(t * 0.2 + ray.phase) * 0.4 + 0.6;
      const rayAlpha = ray.alpha * breathe;

      ctx.save();
      ctx.translate(this.cx + Math.sin(t * 0.05) * 30, 0);
      ctx.rotate(ray.angle + Math.sin(t * 0.03 + ray.phase) * 0.05);

      const rayGrad = ctx.createLinearGradient(0, 0, 0, ray.length);
      rayGrad.addColorStop(0, `rgba(180,220,255,${rayAlpha})`);
      rayGrad.addColorStop(0.5, `rgba(180,220,255,${rayAlpha * 0.3})`);
      rayGrad.addColorStop(1, `rgba(180,220,255,0)`);

      ctx.fillStyle = rayGrad;
      ctx.fillRect(-ray.width / 2, 0, ray.width, ray.length);
      ctx.restore();
    }
    ctx.restore();

    // Dust motes
    for (const mote of this.dustMotes) {
      mote.x += mote.vx;
      mote.y += mote.vy;
      if (mote.x < 0) mote.x = this.width;
      if (mote.x > this.width) mote.x = 0;
      if (mote.y < 0) mote.y = this.height;
      if (mote.y > this.height) mote.y = 0;

      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${mote.alpha})`;
      ctx.fill();
    }
  }

  private renderEarth(): void {
    const ctx = this.ctx;
    const t = this.totalTime;
    const earthR = Math.min(this.width, this.height) * 0.38;
    const earthX = this.cx;
    const earthY = this.cy + 30;

    // Scene alpha — earth fades in scene 3 as data takes over
    let earthAlpha = 1;
    if (this.scene === 3) earthAlpha = clamp(1 - this.dataAlpha * 0.7, 0.3, 1);
    if (this.scene >= 4) earthAlpha = 0;

    if (earthAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = earthAlpha;

    // Outer glow — atmospheric halo
    const haloR = earthR * 1.25;
    const haloGrad = ctx.createRadialGradient(earthX, earthY, earthR * 0.9, earthX, earthY, haloR);
    haloGrad.addColorStop(0, `rgba(80,140,255,0.25)`);
    haloGrad.addColorStop(0.5, `rgba(60,100,200,0.08)`);
    haloGrad.addColorStop(1, `rgba(40,80,160,0)`);
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Tectonic glow — beneath the crust, pulsing with pressure
    this.tectonicPulse = lerp(this.tectonicPulse, this.earthGlow, 0.05);
    const tectonicIntensity = 0.15 + this.tectonicPulse * 0.4 + Math.sin(t * 0.8) * 0.05;
    const tecGrad = ctx.createRadialGradient(
      earthX + Math.sin(t * 0.2) * earthR * 0.2,
      earthY + Math.cos(t * 0.15) * earthR * 0.2,
      0,
      earthX, earthY, earthR
    );
    tecGrad.addColorStop(0, `rgba(255,100,20,${tectonicIntensity})`);
    tecGrad.addColorStop(0.4, `rgba(200,60,10,${tectonicIntensity * 0.6})`);
    tecGrad.addColorStop(0.75, `rgba(100,30,5,${tectonicIntensity * 0.2})`);
    tecGrad.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.save();
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = tecGrad;
    ctx.fillRect(earthX - earthR, earthY - earthR, earthR * 2, earthR * 2);
    ctx.restore();

    // Earth body — deep ocean base
    const earthGrad = ctx.createRadialGradient(
      earthX - earthR * 0.3, earthY - earthR * 0.3, 0,
      earthX, earthY, earthR
    );
    earthGrad.addColorStop(0, `hsl(210, 70%, 30%)`);
    earthGrad.addColorStop(0.3, `hsl(200, 65%, 20%)`);
    earthGrad.addColorStop(0.7, `hsl(190, 55%, 12%)`);
    earthGrad.addColorStop(1, `hsl(180, 40%, 6%)`);

    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Continent shapes — simplified tectonic plates
    ctx.save();
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.clip();

    this.earthRotation += 0.00015; // Very slow rotation
    const rot = this.earthRotation;

    // Draw simplified continent blobs
    const continents = [
      { cx: 0.3, cy: 0.4, rx: 0.18, ry: 0.25, rot: 0.3 },
      { cx: 0.55, cy: 0.35, rx: 0.12, ry: 0.2, rot: -0.2 },
      { cx: 0.7, cy: 0.55, rx: 0.15, ry: 0.18, rot: 0.5 },
      { cx: 0.45, cy: 0.65, rx: 0.1, ry: 0.12, rot: 0.1 },
      { cx: 0.2, cy: 0.6, rx: 0.08, ry: 0.1, rot: -0.3 },
    ];

    for (const c of continents) {
      const cx = earthX - earthR + (c.cx + Math.sin(rot + c.rot) * 0.05) * earthR * 2;
      const cy = earthY - earthR + c.cy * earthR * 2;
      const rx = c.rx * earthR;
      const ry = c.ry * earthR;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot * 0.3 + c.rot);

      const contGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
      contGrad.addColorStop(0, `rgba(80,120,60,0.85)`);
      contGrad.addColorStop(0.6, `rgba(60,90,45,0.7)`);
      contGrad.addColorStop(1, `rgba(40,65,30,0)`);
      ctx.fillStyle = contGrad;

      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ocean shimmer — animated highlight
    const shimmerX = earthX - earthR * 0.4 + Math.sin(t * 0.3) * earthR * 0.1;
    const shimmerY = earthY - earthR * 0.3 + Math.cos(t * 0.2) * earthR * 0.1;
    const shimmerGrad = ctx.createRadialGradient(shimmerX, shimmerY, 0, shimmerX, shimmerY, earthR * 0.6);
    shimmerGrad.addColorStop(0, `rgba(150,200,255,0.12)`);
    shimmerGrad.addColorStop(0.5, `rgba(100,160,220,0.05)`);
    shimmerGrad.addColorStop(1, `rgba(80,140,200,0)`);
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(earthX - earthR, earthY - earthR, earthR * 2, earthR * 2);

    // Cloud layer — moves faster than rotation
    this.cloudOffset += 0.0003;
    const cloudAlpha = 0.25 + Math.sin(t * 0.1) * 0.05;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + this.cloudOffset * (1 + i * 0.1);
      const dist = earthR * (0.3 + Math.sin(angle * 2.3) * 0.15);
      const cx2 = earthX + Math.cos(angle) * dist;
      const cy2 = earthY + Math.sin(angle) * dist * 0.5;
      const cr = earthR * (0.08 + Math.sin(angle * 1.7) * 0.04);

      const cloudGrad = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr);
      cloudGrad.addColorStop(0, `rgba(255,255,255,${cloudAlpha})`);
      cloudGrad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, cr, cr * 0.4, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // clip

    // Specular highlight — light source
    const specGrad = ctx.createRadialGradient(
      earthX - earthR * 0.35, earthY - earthR * 0.35, 0,
      earthX - earthR * 0.2, earthY - earthR * 0.2, earthR * 0.7
    );
    specGrad.addColorStop(0, `rgba(255,255,255,0.12)`);
    specGrad.addColorStop(0.4, `rgba(200,230,255,0.04)`);
    specGrad.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.fill();

    // Edge darkening — limb darkening effect
    const limbGrad = ctx.createRadialGradient(earthX, earthY, earthR * 0.7, earthX, earthY, earthR);
    limbGrad.addColorStop(0, `rgba(0,0,0,0)`);
    limbGrad.addColorStop(0.7, `rgba(0,0,0,0.1)`);
    limbGrad.addColorStop(1, `rgba(0,0,0,0.6)`);
    ctx.fillStyle = limbGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderFaultLines(): void {
    const ctx = this.ctx;
    const t = this.totalTime;

    // Fade in scene 3 as data takes over
    let faultAlpha = 1;
    if (this.scene === 3) faultAlpha = clamp(1 - this.dataAlpha * 0.8, 0.2, 1);
    if (this.scene >= 4) faultAlpha = 0;
    if (faultAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = faultAlpha;

    for (const fault of this.faultLines) {
      // Update energy
      fault.energy = lerp(fault.energy, fault.targetEnergy, 0.02);
      if (Math.abs(fault.energy - fault.targetEnergy) < 0.01) {
        fault.targetEnergy = rand(0.2, 0.9);
      }
      fault.glowPhase += 0.02;

      const energy = fault.energy;
      const glow = (Math.sin(fault.glowPhase) * 0.3 + 0.7) * energy;

      if (fault.points.length < 2) continue;

      // Glow layer — wide soft glow
      ctx.beginPath();
      ctx.moveTo(fault.points[0].x, fault.points[0].y);
      for (let i = 1; i < fault.points.length; i++) {
        const prev = fault.points[i - 1];
        const curr = fault.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.strokeStyle = `rgba(255,${Math.floor(80 + energy * 80)},0,${glow * 0.3})`;
      ctx.lineWidth = 8 + energy * 12;
      ctx.lineCap = "round";
      ctx.stroke();

      // Core line — bright center
      ctx.beginPath();
      ctx.moveTo(fault.points[0].x, fault.points[0].y);
      for (let i = 1; i < fault.points.length; i++) {
        const prev = fault.points[i - 1];
        const curr = fault.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.strokeStyle = `rgba(255,${Math.floor(120 + energy * 100)},20,${glow * 0.8})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Energy flow particles along the fault line
      if (energy > 0.4 && Math.random() < 0.15) {
        const segIdx = Math.floor(Math.random() * (fault.points.length - 1));
        const p0 = fault.points[segIdx];
        const p1 = fault.points[segIdx + 1];
        const t2 = Math.random();
        this.particles.push({
          x: lerp(p0.x, p1.x, t2),
          y: lerp(p0.y, p1.y, t2),
          vx: (p1.x - p0.x) * 0.02,
          vy: (p1.y - p0.y) * 0.02 - 0.5,
          life: 1, maxLife: rand(0.5, 1.5), age: 0,
          size: rand(1, 3),
          color: `hsl(${rand(10, 40)}, 100%, ${rand(50, 80)}%)`,
          alpha: energy * 0.8,
          type: "magma",
        });
      }
    }

    ctx.restore();
  }

  private renderSeismicWaves(): void {
    const ctx = this.ctx;
    const t = this.totalTime;

    // Spawn new waves periodically
    if (t > this.nextWaveTime && (this.scene === 1 || this.scene === 2)) {
      const fault = this.faultLines[Math.floor(Math.random() * this.faultLines.length)];
      if (fault && fault.points.length > 0) {
        const pt = fault.points[Math.floor(Math.random() * fault.points.length)];
        this.seismicWaves.push({
          cx: pt.x,
          cy: pt.y,
          radius: 0,
          maxRadius: rand(100, 300),
          speed: rand(60, 120),
          alpha: rand(0.4, 0.8),
          color: this.scene === 2 ? "#00CCFF" : "#FF6600",
          born: t,
        });
        this.nextWaveTime = t + rand(0.8, 2.5);
      }
    }

    // Render and update waves
    for (let i = this.seismicWaves.length - 1; i >= 0; i--) {
      const wave = this.seismicWaves[i];
      const age = t - wave.born;
      wave.radius = age * wave.speed;

      if (wave.radius > wave.maxRadius) {
        this.seismicWaves.splice(i, 1);
        continue;
      }

      const progress = wave.radius / wave.maxRadius;
      const alpha = wave.alpha * (1 - progress) * (1 - progress);

      ctx.beginPath();
      ctx.arc(wave.cx, wave.cy, wave.radius, 0, Math.PI * 2);
      ctx.strokeStyle = wave.color.replace(")", `,${alpha})`).replace("rgb", "rgba").replace("#", "rgba(").replace("rgba(00CCFF)", "rgba(0,204,255,").replace("rgba(FF6600)", "rgba(255,102,0,");

      // Fix color parsing
      if (wave.color === "#00CCFF") {
        ctx.strokeStyle = `rgba(0,204,255,${alpha})`;
      } else if (wave.color === "#FF6600") {
        ctx.strokeStyle = `rgba(255,102,0,${alpha})`;
      }

      ctx.lineWidth = 2 - progress * 1.5;
      ctx.stroke();

      // Inner ring
      if (wave.radius > 20) {
        ctx.beginPath();
        ctx.arc(wave.cx, wave.cy, wave.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = wave.color === "#00CCFF"
          ? `rgba(0,204,255,${alpha * 0.4})`
          : `rgba(255,102,0,${alpha * 0.4})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  private renderDataLayer(): void {
    const ctx = this.ctx;
    const t = this.totalTime;

    if (this.dataAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.dataAlpha;

    // Data streams — falling characters
    for (const stream of this.dataStreams) {
      stream.offset += stream.speed * 0.016; // Approximate dt
      if (stream.offset > this.height + 200) {
        stream.y = rand(-200, 0);
        stream.offset = 0;
        stream.x = rand(0, this.width);
      }

      ctx.font = "11px 'Courier New', monospace";
      for (let i = 0; i < stream.chars.length; i++) {
        const charY = stream.y + stream.offset + i * 16;
        if (charY < -20 || charY > this.height + 20) continue;

        const charAlpha = stream.alpha * (1 - i / stream.chars.length) * 0.8;
        const isBright = i === 0;
        ctx.fillStyle = isBright
          ? `rgba(255,255,255,${charAlpha * 1.5})`
          : stream.color.replace(")", `,${charAlpha})`).replace("#00FF88", "rgba(0,255,136,").replace("#00CCFF", "rgba(0,204,255,");

        if (stream.color === "#00FF88") {
          ctx.fillStyle = isBright ? `rgba(255,255,255,${charAlpha * 1.5})` : `rgba(0,255,136,${charAlpha})`;
        } else {
          ctx.fillStyle = isBright ? `rgba(255,255,255,${charAlpha * 1.5})` : `rgba(0,204,255,${charAlpha})`;
        }

        ctx.fillText(stream.chars[i], stream.x, charY);
      }
    }

    // Network nodes and connections
    for (let i = 0; i < this.networkNodes.length; i++) {
      const node = this.networkNodes[i];
      node.alpha = lerp(node.alpha, 1, 0.02);
      node.pulse += 0.05;

      // Connections
      for (const connIdx of node.connections) {
        const conn = this.networkNodes[connIdx];
        if (!conn) continue;

        const connAlpha = node.alpha * conn.alpha * 0.3;
        if (connAlpha <= 0) continue;

        // Animated signal pulse along connection
        const pulseT = (Math.sin(t * 2 + node.pulse) * 0.5 + 0.5);
        const px = lerp(node.x, conn.x, pulseT);
        const py = lerp(node.y, conn.y, pulseT);

        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(conn.x, conn.y);
        ctx.strokeStyle = `rgba(0,204,255,${connAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Signal dot
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,136,${connAlpha * 2})`;
        ctx.fill();
      }

      // Node circle
      const pulseSize = node.size + Math.sin(t * 3 + node.pulse) * 1.5;
      const nodeGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, pulseSize * 3);
      nodeGrad.addColorStop(0, `rgba(0,204,255,${node.alpha * 0.8})`);
      nodeGrad.addColorStop(1, `rgba(0,204,255,0)`);
      ctx.fillStyle = nodeGrad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseSize * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,255,${node.alpha})`;
      ctx.fill();

      // Label
      if (node.alpha > 0.3) {
        ctx.font = "9px 'Courier New', monospace";
        ctx.fillStyle = `rgba(0,204,255,${node.alpha * 0.7})`;
        ctx.fillText(node.label, node.x + pulseSize + 4, node.y + 3);
      }
    }

    ctx.restore();
  }

  private renderParticles(): void {
    const ctx = this.ctx;

    for (const p of this.particles) {
      if (p.type === "star") continue; // Rendered separately
      if (p.alpha <= 0) continue;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

      if (p.type === "magma") {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, p.color.replace("hsl", "hsla").replace(")", `,${p.alpha})`));
        grad.addColorStop(1, p.color.replace("hsl", "hsla").replace(")", `,0)`));
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = `rgba(${this.hexToRgb(p.color)},${p.alpha})`;
      }
      ctx.fill();
    }
  }

  private renderAshaScene(): void {
    const ctx = this.ctx;
    const t = this.totalTime;

    if (this.scene !== 4 && this.scene !== 5 && this.scene !== 6) return;

    // Update ASHA progress
    if (this.scene === 4) {
      this.ashaProgress = clamp(this.ashaProgress + 0.003, 0, 1);
    }

    const progress = this.ashaProgress;

    // Update ASHA particles — converge toward center
    for (const p of this.ashaParticles) {
      if (!p.data) continue;
      p.age += 0.016;

      const targetX = p.data.targetX + Math.sin(t * 2 + p.data.angle) * 20 * (1 - progress);
      const targetY = p.data.targetY + Math.cos(t * 1.5 + p.data.angle) * 20 * (1 - progress);

      // Converge speed increases with progress
      const convergeSpeed = 0.01 + progress * 0.08;
      p.x = lerp(p.x, targetX, convergeSpeed);
      p.y = lerp(p.y, targetY, convergeSpeed);

      // Orbit when close
      if (progress > 0.5) {
        const orbitR = 60 * (1 - progress) + 20;
        const orbitSpeed = 0.5 + progress;
        p.data.angle += 0.02 * orbitSpeed;
        p.data.targetX = this.cx + Math.cos(p.data.angle) * orbitR;
        p.data.targetY = this.cy - 20 + Math.sin(p.data.angle) * orbitR * 0.5;
      }

      // Render particle
      const distToCenter = Math.sqrt((p.x - this.cx) ** 2 + (p.y - (this.cy - 20)) ** 2);
      const proximityAlpha = clamp(1 - distToCenter / 300, 0, 1);
      const finalAlpha = p.alpha * proximityAlpha * (0.3 + progress * 0.7);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace("#", "rgba(").replace("00CCFF", "0,204,255,").replace("00FF88", "0,255,136,").replace("8B5CF6", "139,92,246,");

      // Simplified color handling
      if (p.color === "#00CCFF") ctx.fillStyle = `rgba(0,204,255,${finalAlpha})`;
      else if (p.color === "#00FF88") ctx.fillStyle = `rgba(0,255,136,${finalAlpha})`;
      else ctx.fillStyle = `rgba(139,92,246,${finalAlpha})`;

      ctx.fill();
    }

    // ASHA orb — materializes as progress increases
    if (progress > 0.3) {
      const orbAlpha = (progress - 0.3) / 0.7;
      const orbR = 40 + Math.sin(t * 2) * 3;

      // Outer energy field
      const fieldGrad = ctx.createRadialGradient(this.cx, this.cy - 20, 0, this.cx, this.cy - 20, orbR * 4);
      fieldGrad.addColorStop(0, `rgba(0,204,255,${orbAlpha * 0.3})`);
      fieldGrad.addColorStop(0.4, `rgba(139,92,246,${orbAlpha * 0.15})`);
      fieldGrad.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.fillStyle = fieldGrad;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy - 20, orbR * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core orb
      const orbGrad = ctx.createRadialGradient(
        this.cx - orbR * 0.3, this.cy - 20 - orbR * 0.3, 0,
        this.cx, this.cy - 20, orbR
      );
      orbGrad.addColorStop(0, `rgba(200,240,255,${orbAlpha})`);
      orbGrad.addColorStop(0.3, `rgba(0,204,255,${orbAlpha * 0.9})`);
      orbGrad.addColorStop(0.7, `rgba(80,0,200,${orbAlpha * 0.6})`);
      orbGrad.addColorStop(1, `rgba(0,0,0,0)`);

      ctx.beginPath();
      ctx.arc(this.cx, this.cy - 20, orbR, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      // Pulse rings
      for (let i = 0; i < 3; i++) {
        const ringPhase = (t * 1.5 + i * 1.2) % 3;
        const ringR = orbR + ringPhase * 60;
        const ringAlpha = orbAlpha * (1 - ringPhase / 3) * 0.5;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy - 20, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,204,255,${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ASHA text — appears at high progress
      if (progress > 0.7) {
        const textAlpha = (progress - 0.7) / 0.3;
        ctx.save();
        ctx.font = `bold ${Math.floor(18 + progress * 8)}px 'Courier New', monospace`;
        ctx.fillStyle = `rgba(0,204,255,${textAlpha})`;
        ctx.textAlign = "center";
        ctx.fillText("ASHA", this.cx, this.cy - 20 + orbR + 24);
        ctx.font = `${Math.floor(10 + progress * 4)}px 'Courier New', monospace`;
        ctx.fillStyle = `rgba(0,255,136,${textAlpha * 0.7})`;
        ctx.fillText("ADAPTIVE SEISMIC HAZARD ANALYZER", this.cx, this.cy - 20 + orbR + 42);
        ctx.restore();
      }
    }
  }

  private renderVignette(): void {
    const ctx = this.ctx;

    const vigGrad = ctx.createRadialGradient(
      this.cx, this.cy, this.height * 0.2,
      this.cx, this.cy, this.height * 0.9
    );
    vigGrad.addColorStop(0, `rgba(0,0,0,0)`);
    vigGrad.addColorStop(0.6, `rgba(0,0,0,0.2)`);
    vigGrad.addColorStop(1, `rgba(0,0,0,0.85)`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private renderScanlines(): void {
    const ctx = this.ctx;

    // Subtle CRT scanlines
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let y = 0; y < this.height; y += 4) {
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, y, this.width, 1);
    }
    ctx.restore();
  }

  // ── Hex to RGB helper ──────────────────────────────────────────────────────

  private hexToRgb(hex: string): string {
    if (hex.startsWith("#")) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r},${g},${b}`;
    }
    return "255,255,255";
  }

  // ── Scene transitions ──────────────────────────────────────────────────────

  public setScene(scene: CinematicScene): void {
    if (scene === this.scene) return;

    this.transitioning = true;
    this.transitionProgress = 0;
    this.nextScene = scene;

    // Initialize next scene
    switch (scene) {
      case 2: this.initScene2(); break;
      case 3: this.initScene3(); break;
      case 4: this.initScene4(); break;
      case 5: this.initScene5(); break;
    }
  }

  private updateTransition(dt: number): void {
    if (!this.transitioning || this.nextScene === null) return;

    this.transitionProgress += dt * 2; // 0.5 second transition

    if (this.transitionProgress >= 1) {
      this.scene = this.nextScene;
      this.sceneTime = 0;
      this.nextScene = null;
      this.transitioning = false;
      this.sceneAlpha = 1;
    } else {
      // Glitch flash at midpoint
      if (this.transitionProgress > 0.4 && this.transitionProgress < 0.6) {
        this.sceneAlpha = 0.3 + Math.random() * 0.4;
      } else {
        this.sceneAlpha = 1;
      }
    }
  }

  // ── Scene-specific updates ─────────────────────────────────────────────────

  private updateScene(dt: number): void {
    switch (this.scene) {
      case 1: {
        // Increase tectonic glow with time
        this.earthGlow = clamp(this.sceneTime * 0.03, 0, 0.8);

        // Add magma particles when glow is high
        if (this.earthGlow > 0.3 && Math.random() < 0.15) {
          this.spawnParticles("magma", 1);
        }
        break;
      }
      case 2: {
        // Intense seismic activity
        this.earthGlow = 0.7 + Math.sin(this.sceneTime * 2) * 0.2;
        if (Math.random() < 0.3) this.spawnParticles("seismic", 2);
        if (Math.random() < 0.1) this.spawnParticles("magma", 1);
        if (Math.random() < 0.1) this.spawnParticles("pressure", 2);
        break;
      }
      case 3: {
        // Fade in data layer
        this.dataAlpha = clamp(this.dataAlpha + dt * 0.4, 0, 1);
        this.earthGlow = lerp(this.earthGlow, 0.2, dt * 0.5);

        // Update data streams
        for (const stream of this.dataStreams) {
          stream.offset += stream.speed * dt;
          if (stream.offset > this.height + 200) {
            stream.y = rand(-200, 0);
            stream.offset = 0;
            stream.x = rand(0, this.width);
          }
        }
        break;
      }
      case 4: {
        // ASHA materializing
        this.ashaProgress = clamp(this.ashaProgress + dt * 0.15, 0, 1);
        this.dataAlpha = lerp(this.dataAlpha, 0.4, dt * 0.3);
        break;
      }
      case 5: {
        // Full system — all layers
        this.dataAlpha = lerp(this.dataAlpha, 0.6, dt * 0.2);
        this.ashaProgress = clamp(this.ashaProgress, 0.8, 1);
        break;
      }
    }
  }

  // ── Main render loop ───────────────────────────────────────────────────────

  private render(timestamp: number): void {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05); // Cap at 50ms
    this.lastTimestamp = timestamp;
    this.totalTime += dt;
    this.sceneTime += dt;

    // Update
    this.updateCamera(dt);
    this.updateParticles(dt);
    this.updateTransition(dt);
    this.updateScene(dt);

    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply scene alpha for transitions
    ctx.save();
    if (this.sceneAlpha < 1) {
      ctx.globalAlpha = this.sceneAlpha;
    }

    // Apply camera transform
    ctx.save();
    this.applyCameraTransform();

    // Render layers (back to front)
    this.renderBackground();
    this.renderStars();
    this.renderAtmosphere();
    this.renderEarth();
    this.renderFaultLines();
    this.renderSeismicWaves();
    this.renderDataLayer();
    this.renderAshaScene();
    this.renderParticles();

    ctx.restore(); // Camera transform

    // Post-processing (no camera transform)
    this.renderVignette();
    this.renderScanlines();

    ctx.restore(); // Scene alpha

    this.rafId = requestAnimationFrame(ts => this.render(ts));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(ts => this.render(ts));
  }

  public stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cx = width / 2;
    this.cy = height / 2;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public setPressureScore(score: number): void {
    this.pressureScore = score;
    this.earthGlow = score / 10;
  }

  public triggerSeismicEvent(): void {
    this.addCameraShake(8);
    this.spawnParticles("seismic", 15);
    this.spawnParticles("magma", 8);
  }
}
