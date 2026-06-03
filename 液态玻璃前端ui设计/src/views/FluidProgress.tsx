import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 流体进度条 — 填充端液态球弹簧延迟，轨道玻璃质感
// rAF + Spring 直接驱动 DOM ref，禁止 setState 驱动动画
export const FluidProgress: React.FC = () => {
  const filterId = 'progress-filter';
  const bubbleRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(65);

  const TARGET_PROGRESS = useRef(65); // 0-100

  const springs = useRef({
    progress: new Spring(65, 120, 16),
    bubbleX: new Spring(0, 80, 12),      // 液态球跟随但有延迟
    bubbleScaleX: new Spring(1, 300, 22),
    bubbleScaleY: new Spring(1, 300, 22),
    bubbleGlow: new Spring(0.4, 200, 18),
    scale: new Spring(0.8, 300, 22),
    bgOpacity: new Spring(0.8, 250, 20),
  });

  const TRACK_WIDTH = 500; // px

  useEffect(() => {
    let rafId: number;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;

      sp.progress.setTarget(TARGET_PROGRESS.current);
      const progress = sp.progress.update(dt);
      const fillX = (progress / 100) * TRACK_WIDTH;

      // 液态球跟随进度（延迟感）
      sp.bubbleX.setTarget(fillX);
      const bx = sp.bubbleX.update(dt);

      // 速度驱动 squish
      const vel = Math.abs(sp.bubbleX.velocity);
      const squish = Math.min(0.25, vel / 2000);
      if (vel > 30) {
        sp.bubbleScaleX.setTarget(1 + squish * 1.5);
        sp.bubbleScaleY.setTarget(1 - squish * 0.8);
      } else {
        sp.bubbleScaleX.setTarget(1);
        sp.bubbleScaleY.setTarget(1);
      }
      const sx = sp.bubbleScaleX.update(dt);
      const sy = sp.bubbleScaleY.update(dt);
      const glow = sp.bubbleGlow.update(dt);
      const baseScale = sp.scale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      // 更新 fill 宽度
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.max(0, fillX)}px`;
      }

      // 更新液态球位置与形变
      if (bubbleRef.current) {
        bubbleRef.current.style.transform =
          `translateX(${bx - 28}px) translateY(-50%) scale(${sx * baseScale}, ${sy * baseScale})`;
        bubbleRef.current.style.boxShadow =
          `0 0 ${glow * 30}px rgba(99, 179, 237, ${glow * 0.8}), 0 4px 16px rgba(0,0,0,0.3)`;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      setDisplayValue(Math.round(progress));
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const setProgress = (val: number) => {
    TARGET_PROGRESS.current = val;
    const sp = springs.current;
    const vel = sp.progress.velocity;
    if (Math.abs(vel) < 100) {
      // 快速切换时给 squish 初速度
      sp.bubbleScaleX.velocity = 2;
    }
    sp.bubbleGlow.setTarget(0.8);
    sp.scale.setTarget(1.0);
    sp.bgOpacity.setTarget(0);

    setTimeout(() => {
      sp.bubbleGlow.setTarget(0.4);
      sp.scale.setTarget(0.8);
      sp.bgOpacity.setTarget(0.8);
    }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={56} height={56} radius={28} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Fluid Progress Bar</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          进度条末端的液态球有弹簧延迟感，速度越快形变越剧烈，模拟液体在管道中流动。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(135deg, #0d1b2a 0%, #1b2838 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* 进度条区域 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', width: '100%', maxWidth: '560px' }}>
          {/* 百分比标签 */}
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '48px', fontWeight: 700, lineHeight: 1 }}>
            {displayValue}
            <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>%</span>
          </div>

          {/* 进度条轨道 */}
          <div style={{
            position: 'relative',
            width: `${TRACK_WIDTH}px`, height: '20px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '100px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
            overflow: 'visible',
          }}>
            {/* 填充层 */}
            <div
              ref={fillRef}
              style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                borderRadius: '100px',
                background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 70%, #93c5fd 100%)',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
                overflow: 'hidden',
              }}
            >
              {/* 流动光泽 */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                animation: 'flow 2s linear infinite',
              }} />
            </div>

            {/* 液态球（末端）*/}
            <div
              ref={bubbleRef}
              style={{
                position: 'absolute', top: '50%', left: 0,
                width: '56px', height: '56px',
                borderRadius: '50%',
                backdropFilter: `url(#${filterId})`,
                WebkitBackdropFilter: `url(#${filterId})`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                zIndex: 2,
                overflow: 'hidden',
              }}
            >
              {/* 背景遮罩层 */}
              <div
                ref={bgRef}
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(255,255,255,0.9)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* 控制按钮 */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
            {[0, 25, 50, 75, 100].map(v => (
              <button
                key={v}
                onClick={() => setProgress(v)}
                style={{
                  padding: '10px 20px', borderRadius: '100px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>

        {/* 多个进度条变体 */}
        {[
          { label: 'Download', value: 72, color: '#3b82f6' },
          { label: 'Upload', value: 45, color: '#8b5cf6' },
          { label: 'Storage', value: 88, color: '#ef4444' },
        ].map((item) => (
          <MiniProgress key={item.label} label={item.label} value={item.value} color={item.color} />
        ))}
      </div>

      {/* 流动光泽动画 */}
      <style>{`
        @keyframes flow {
          from { transform: translateX(-100%); }
          to { transform: translateX(200%); }
        }
      `}</style>

      <ParameterPanel />
    </div>
  );
};

// 迷你进度条子组件
const MiniProgress: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const sp = useRef(new Spring(value, 100, 14));

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const progress = sp.current.update(dt);
      if (fillRef.current) {
        fillRef.current.style.width = `${(progress / 100) * 240}px`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '340px' }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', width: '60px', textAlign: 'right' }}>{label}</span>
      <div style={{
        position: 'relative', width: '240px', height: '8px',
        background: 'rgba(255,255,255,0.06)', borderRadius: '100px',
        overflow: 'hidden',
      }}>
        <div ref={fillRef} style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          background: color, borderRadius: '100px',
          boxShadow: `0 0 8px ${color}88`,
        }} />
      </div>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', width: '30px' }}>{value}%</span>
    </div>
  );
};
