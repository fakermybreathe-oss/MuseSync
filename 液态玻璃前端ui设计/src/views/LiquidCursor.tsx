import React, { useEffect, useRef } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 液态光标组件 — 全局鼠标跟随，弹簧物理 + OpticsFilter 玻璃质感
// 使用 rAF + Spring 驱动 DOM ref，禁止 setState 驱动动画
// 核心模式：scale + bgOpacity — 静止时缩小且白色背景遮挡，移动时放大且背景透明露出玻璃
export const LiquidCursor: React.FC = () => {
  const filterId = 'liquid-cursor-filter';
  const cursorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const mousePos = useRef({ x: 400, y: 250 });
  const isMoving = useRef(false);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const springs = useRef({
    x: new Spring(400, 150, 16),
    y: new Spring(250, 150, 16),
    scaleX: new Spring(0.7, 300, 22),
    scaleY: new Spring(0.7, 300, 22),
    trailX: new Spring(400, 80, 12),
    trailY: new Spring(250, 80, 12),
    // 核心：scale + bgOpacity 弹簧
    scale: new Spring(0.7, 300, 22),       // 静止时 0.7，移动时 1.0
    bgOpacity: new Spring(0.85, 250, 20),  // 静止时 0.85（白色遮挡），移动时 0（透明露出玻璃）
  });

  useEffect(() => {
    let rafId: number;
    const container = containerRef.current;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container?.getBoundingClientRect();
      if (!rect) return;
      mousePos.current.x = e.clientX - rect.left;
      mousePos.current.y = e.clientY - rect.top;

      // 标记移动中 → 放大 + 透明背景
      if (!isMoving.current) {
        isMoving.current = true;
        springs.current.scale.setTarget(1.0);
        springs.current.bgOpacity.setTarget(0);
      }

      // 重置静止定时器
      if (moveTimer.current) clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => {
        isMoving.current = false;
        springs.current.scale.setTarget(0.7);
        springs.current.bgOpacity.setTarget(0.85);
      }, 300);
    };

    container?.addEventListener('mousemove', onMouseMove);

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;
      const { x: mx, y: my } = mousePos.current;

      sp.x.setTarget(mx);
      sp.y.setTarget(my);
      sp.trailX.setTarget(mx);
      sp.trailY.setTarget(my);

      const cx = sp.x.update(dt);
      const cy = sp.y.update(dt);
      const tx = sp.trailX.update(dt);
      const ty = sp.trailY.update(dt);

      // 根据速度计算 squish
      const vx = sp.x.velocity;
      const vy = sp.y.velocity;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const squish = Math.min(0.3, speed / 1800);
      const angle = Math.atan2(vy, vx);

      if (speed > 30) {
        sp.scaleX.setTarget(1 + squish * 1.2);
        sp.scaleY.setTarget(1 - squish * 0.6);
      } else {
        sp.scaleX.setTarget(1);
        sp.scaleY.setTarget(1);
      }

      const sx = sp.scaleX.update(dt);
      const sy = sp.scaleY.update(dt);
      const baseScale = sp.scale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      if (cursorRef.current) {
        cursorRef.current.style.transform =
          `translate(${cx - 45}px, ${cy - 45}px) rotate(${angle}rad) scale(${sx * baseScale}, ${sy * baseScale}) rotate(${-angle}rad)`;
      }

      // 背景遮罩层
      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      if (trailRef.current) {
        trailRef.current.style.transform =
          `translate(${tx - 22}px, ${ty - 22}px)`;
        const trailSpeed = Math.sqrt(sp.trailX.velocity ** 2 + sp.trailY.velocity ** 2);
        trailRef.current.style.opacity = `${Math.min(0.8, trailSpeed / 400)}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      container?.removeEventListener('mousemove', onMouseMove);
      if (moveTimer.current) clearTimeout(moveTimer.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={90} height={90} radius={45} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Liquid Cursor</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          一个基于弹簧物理的液态光标。静止时缩小且背景遮罩隐藏玻璃效果，移动时放大且背景透明露出液态玻璃。速度越快形变越大。
        </p>
      </div>

      {/* 演示区域 */}
      <div
        ref={containerRef}
        style={{
          width: '100%', height: '500px',
          background: 'radial-gradient(ellipse at 30% 40%, #1a1a2e 0%, #0d0d1a 100%)',
          backgroundImage: `
            radial-gradient(ellipse at 30% 40%, #1a1a2e 0%, #0d0d1a 100%),
            radial-gradient(circle at 70% 60%, rgba(138, 43, 226, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(0, 120, 255, 0.12) 0%, transparent 40%)
          `,
          borderRadius: '16px',
          position: 'relative', overflow: 'hidden',
          cursor: 'none',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        {/* 装饰网格 */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* 装饰卡片 */}
        {[
          { left: '10%', top: '15%', w: '140px', h: '80px', label: 'hover me' },
          { left: '55%', top: '60%', w: '180px', h: '60px', label: 'drag cursor' },
          { left: '65%', top: '15%', w: '120px', h: '120px', label: '⬆' },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: card.left, top: card.top,
              width: card.w, height: card.h,
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)', fontSize: '13px',
            }}
          >
            {card.label}
          </div>
        ))}

        {/* 尾迹光晕 */}
        <div
          ref={trailRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '44px', height: '44px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(120, 80, 255, 0.4) 0%, transparent 70%)',
            pointerEvents: 'none',
            filter: 'blur(8px)',
            opacity: 0,
          }}
        />

        {/* 液态玻璃光标球 */}
        <div
          ref={cursorRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '90px', height: '90px',
            borderRadius: '50%',
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
            pointerEvents: 'none',
            transformOrigin: 'center center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            overflow: 'hidden',
          }}
        >
          {/* 白色背景遮罩 — 静止时不透明遮挡玻璃，移动时透明露出 OpticsFilter */}
          <div
            ref={bgRef}
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};
