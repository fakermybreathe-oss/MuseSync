import React, { useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════
 * RainCanvas — 全屏物理雨滴特效
 *
 * 三层视觉分离：
 *   1. 背景细雨 (far rain)    — 快速加速的细线，营造窗外纵深
 *   2. 现有 UI (DOM)           — 中间层，不受影响
 *   3. 近景玻璃水滴 (droplets) — 物理模拟的贴玻璃水滴
 *
 * 技术要点：
 *   • 离屏 Canvas 预渲染水滴 sprite，避免每帧 arc/shadowBlur
 *   • 粒子数量硬性上限，防内存溢出
 *   • requestAnimationFrame 正确清理
 * ═══════════════════════════════════════════════════════════ */

/* ─── 配置常量 ─── */
const FAR_RAIN_MAX = 120;       // 背景细雨最大数量
const DROPLET_STATIC_MAX = 60;  // 静止水滴最大数量
const DROPLET_SLIDING_MAX = 20; // 滑动水滴最大数量
const TRAIL_MAX = 200;          // 水痕印章最大数量
const SPAWN_INTERVAL_MS = 80;   // 新水滴生成间隔

/* ─── 类型定义 ─── */
interface FarRainDrop {
  x: number;
  y: number;
  speed: number;
  acceleration: number;
  length: number;
  opacity: number;
  thickness: number;
}

interface GlassDroplet {
  x: number;
  y: number;
  radius: number;
  /** 是否正在滑动 */
  sliding: boolean;
  speed: number;
  /** 滑动开始前的静止倒计时（帧数） */
  stillFrames: number;
  opacity: number;
  /** 泪滴拉伸因子 */
  stretchFactor: number;
}

interface TrailStamp {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

/* ─── 离屏 Sprite 缓存 ─── */
let _spriteCache: Map<string, HTMLCanvasElement> | null = null;

/**
 * 创建一个离屏 Canvas 并绘制水滴 sprite（带高光弧线）。
 * 使用 drawImage 代替每帧 arc + shadowBlur，大幅提升性能。
 */
function getDropletSprite(radius: number, isSliding: boolean): HTMLCanvasElement {
  if (!_spriteCache) _spriteCache = new Map();
  const key = `${radius.toFixed(1)}-${isSliding ? 's' : 'r'}`;
  const cached = _spriteCache.get(key);
  if (cached) return cached;

  const pad = 4;
  const w = (radius * 2 + pad * 2) * (isSliding ? 1.2 : 1);
  const h = (radius * 2 + pad * 2) * (isSliding ? 2.2 : 1.4);
  const off = document.createElement('canvas');
  off.width = Math.ceil(w * 2); // 2x 分辨率
  off.height = Math.ceil(h * 2);
  const ctx = off.getContext('2d')!;
  ctx.scale(2, 2);

  const cx = w / 2;
  const cy = h / 2;

  if (isSliding) {
    /* 泪滴形：上尖下圆，bezier 曲线 */
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 1.6);
    ctx.bezierCurveTo(
      cx + radius * 0.3, cy - radius * 0.8,
      cx + radius * 0.85, cy + radius * 0.2,
      cx, cy + radius * 1.0
    );
    ctx.bezierCurveTo(
      cx - radius * 0.85, cy + radius * 0.2,
      cx - radius * 0.3, cy - radius * 0.8,
      cx, cy - radius * 1.6
    );
    ctx.closePath();
  } else {
    /* 静止态：竖椭圆（重力下垂） */
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 0.85, radius * 1.2, 0, 0, Math.PI * 2);
    ctx.closePath();
  }

  /* 填充：极透明，带微弱折射感 */
  const grad = ctx.createRadialGradient(
    cx - radius * 0.25, cy - radius * 0.35, 0,
    cx, cy, radius * 1.3
  );
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(0.4, 'rgba(200, 220, 240, 0.15)');
  grad.addColorStop(0.75, 'rgba(150, 190, 220, 0.08)');
  grad.addColorStop(1, 'rgba(100, 160, 200, 0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  /* 边缘微光 */
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  /* 顶部高光弧 — 模拟光源折射 */
  ctx.beginPath();
  const hlY = isSliding ? cy - radius * 1.0 : cy - radius * 0.6;
  ctx.ellipse(cx, hlY, radius * 0.4, radius * 0.2, 0, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  _spriteCache.set(key, off);
  return off;
}

/* ─── 随机工具 ─── */
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

/* ─── 创建粒子工厂 ─── */
function createFarRain(canvasW: number): FarRainDrop {
  return {
    x: rand(0, canvasW),
    y: rand(-100, -10),
    speed: rand(4, 9),
    acceleration: rand(0.02, 0.06),
    length: rand(12, 28),
    opacity: rand(0.08, 0.25),
    thickness: rand(0.5, 1.5),
  };
}

function createStaticDroplet(canvasW: number, canvasH: number): GlassDroplet {
  return {
    x: rand(10, canvasW - 10),
    y: rand(10, canvasH - 10),
    radius: rand(2, 7),
    sliding: false,
    speed: 0,
    stillFrames: Math.floor(rand(120, 600)), // 2~10 秒后可能开始滑动
    opacity: rand(0.4, 0.85),
    stretchFactor: 1,
  };
}

function createSlidingDroplet(canvasW: number): GlassDroplet {
  return {
    x: rand(20, canvasW - 20),
    y: rand(-20, 60),
    radius: rand(4, 9),
    sliding: true,
    speed: rand(0.3, 1.2),
    stillFrames: 0,
    opacity: rand(0.5, 0.9),
    stretchFactor: 1,
  };
}

/* ═══════════════════════════════════════════════════════════
 * React 组件
 * ═══════════════════════════════════════════════════════════ */
const RainCanvas: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef<{
    farRain: FarRainDrop[];
    staticDroplets: GlassDroplet[];
    slidingDroplets: GlassDroplet[];
    trails: TrailStamp[];
    lastSpawn: number;
    w: number;
    h: number;
    dpr: number;
  } | null>(null);

  /* 初始化所有粒子 */
  const initParticles = useCallback((w: number, h: number) => {
    const farRain: FarRainDrop[] = [];
    for (let i = 0; i < FAR_RAIN_MAX * 0.6; i++) {
      const drop = createFarRain(w);
      drop.y = rand(0, h); // 初始帧分散
      farRain.push(drop);
    }

    const staticDroplets: GlassDroplet[] = [];
    for (let i = 0; i < DROPLET_STATIC_MAX * 0.7; i++) {
      staticDroplets.push(createStaticDroplet(w, h));
    }

    return {
      farRain,
      staticDroplets,
      slidingDroplets: [] as GlassDroplet[],
      trails: [] as TrailStamp[],
      lastSpawn: performance.now(),
      w,
      h,
      dpr: window.devicePixelRatio || 1,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!stateRef.current) {
        stateRef.current = initParticles(w, h);
      } else {
        stateRef.current.w = w;
        stateRef.current.h = h;
        stateRef.current.dpr = dpr;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    /* ─── 主渲染循环 ─── */
    const tick = (now: number) => {
      const s = stateRef.current!;
      const { w, h } = s;

      ctx.clearRect(0, 0, w, h);

      /* ═══ 第一层：背景细雨 ═══ */
      for (let i = s.farRain.length - 1; i >= 0; i--) {
        const r = s.farRain[i];
        r.speed += r.acceleration;
        r.y += r.speed;
        r.length = r.speed * 2.5;

        // 下半屏淡出
        const fadeStart = h * 0.6;
        if (r.y > fadeStart) {
          r.opacity *= 0.985;
        }

        if (r.y > h + 20 || r.opacity < 0.01) {
          s.farRain[i] = createFarRain(w);
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + 0.3, r.y - r.length);
        ctx.strokeStyle = `rgba(180, 210, 240, ${r.opacity})`;
        ctx.lineWidth = r.thickness;
        ctx.stroke();
      }

      // 补充细雨
      while (s.farRain.length < FAR_RAIN_MAX) {
        s.farRain.push(createFarRain(w));
      }

      /* ═══ 第二层：水痕蒸发 ═══ */
      for (let i = s.trails.length - 1; i >= 0; i--) {
        const t = s.trails[i];
        t.opacity -= 0.003;
        if (t.opacity <= 0) {
          s.trails.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.ellipse(t.x, t.y, t.radius * 0.7, t.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 240, ${t.opacity * 0.15})`;
        ctx.fill();
        // 折射边缘微光
        ctx.strokeStyle = `rgba(255, 255, 255, ${t.opacity * 0.08})`;
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }

      /* ═══ 第三层：玻璃水滴 ═══ */

      // --- 静止水滴 ---
      for (let i = s.staticDroplets.length - 1; i >= 0; i--) {
        const d = s.staticDroplets[i];

        // 倒计时到零后有概率开始滑动
        d.stillFrames--;
        if (d.stillFrames <= 0 && s.slidingDroplets.length < DROPLET_SLIDING_MAX) {
          if (Math.random() < 0.15) {
            d.sliding = true;
            d.speed = rand(0.2, 0.8);
            s.slidingDroplets.push(d);
            s.staticDroplets.splice(i, 1);
            continue;
          }
          d.stillFrames = Math.floor(rand(60, 300)); // 重置等待
        }

        // 绘制离屏 sprite
        const sprite = getDropletSprite(d.radius, false);
        const sw = sprite.width / 2;
        const sh = sprite.height / 2;
        ctx.globalAlpha = d.opacity;
        ctx.drawImage(sprite, d.x - sw / 2, d.y - sh / 2, sw, sh);
        ctx.globalAlpha = 1;
      }

      // 补充静止水滴
      if (now - s.lastSpawn > SPAWN_INTERVAL_MS && s.staticDroplets.length < DROPLET_STATIC_MAX) {
        s.staticDroplets.push(createStaticDroplet(w, h));
        s.lastSpawn = now;
      }

      // --- 滑动水滴 ---
      for (let i = s.slidingDroplets.length - 1; i >= 0; i--) {
        const d = s.slidingDroplets[i];
        const gravity = 0.012;
        d.speed += gravity;
        d.y += d.speed;
        d.stretchFactor = 1 + d.speed * 0.15;

        // 微弱横向漂移（模拟不完美玻璃表面）
        d.x += Math.sin(d.y * 0.02) * 0.15;

        // 留下水痕
        if (s.trails.length < TRAIL_MAX && Math.random() < 0.4) {
          s.trails.push({
            x: d.x + rand(-1, 1),
            y: d.y - d.radius * 0.5,
            radius: d.radius * rand(0.6, 1.0),
            opacity: 0.6,
          });
        }

        // 出界移除
        if (d.y > h + 30) {
          s.slidingDroplets.splice(i, 1);
          continue;
        }

        // 绘制泪滴 sprite
        const sprite = getDropletSprite(d.radius, true);
        const sw = sprite.width / 2;
        const sh = (sprite.height / 2) * d.stretchFactor;
        ctx.globalAlpha = d.opacity;
        ctx.drawImage(sprite, d.x - sw / 2, d.y - sh / 2, sw, sh);
        ctx.globalAlpha = 1;
      }

      // 定期补充新的滑动水滴（从顶部）
      if (s.slidingDroplets.length < DROPLET_SLIDING_MAX * 0.5 && Math.random() < 0.02) {
        s.slidingDroplets.push(createSlidingDroplet(w));
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="rain-canvas"
      aria-hidden="true"
    />
  );
});

RainCanvas.displayName = 'RainCanvas';

export { RainCanvas };
