import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 触感按钮 — 按下时弹簧压缩，释放时过冲弹跳，OpticsFilter 玻璃质感
// rAF + Spring 驱动 DOM 变换，禁止 setState 驱动动画
export const TactileButton: React.FC = () => {
  const filterId = 'tactile-btn-filter';
  const btnRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // 只用 useState 保存显示文字（低频，非动画）
  const [pressCount, setPressCount] = useState(0);

  const isPressed = useRef(false);
  const springs = useRef({
    scaleY: new Spring(1, 500, 28),
    scaleX: new Spring(1, 500, 28),
    translateY: new Spring(0, 500, 28),
    glow: new Spring(0, 300, 20),
    ripple: new Spring(0, 200, 18),
    scale: new Spring(0.9, 300, 22),       // 基础缩放：静止 0.9，交互 1.0
    bgOpacity: new Spring(0.8, 250, 20),   // 遮罩：静止时白色半透，按下全透露玻璃
  });

  useEffect(() => {
    let rafId: number;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;

      const sy = sp.scaleY.update(dt);
      const sx = sp.scaleX.update(dt);
      const ty = sp.translateY.update(dt);
      const glow = sp.glow.update(dt);
      const ripple = sp.ripple.update(dt);
      const baseScale = sp.scale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      if (btnRef.current) {
        btnRef.current.style.transform = `translateY(${ty}px) scale(${sx * baseScale}, ${sy * baseScale})`;
        btnRef.current.style.boxShadow = `
          0 ${8 - ty * 0.5}px ${24 - ty}px rgba(0,0,0,${0.15 + glow * 0.05}),
          0 0 ${glow * 40}px rgba(120, 80, 255, ${glow * 0.4}),
          inset 0 1px 0 rgba(255,255,255,${0.2 - glow * 0.1}),
          inset 0 -2px 0 rgba(0,0,0,${0.1 + glow * 0.05})
        `;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      if (rippleRef.current) {
        const scale = ripple;
        rippleRef.current.style.transform = `scale(${scale})`;
        rippleRef.current.style.opacity = `${Math.max(0, 0.5 - ripple * 0.5)}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const press = () => {
    isPressed.current = true;
    const sp = springs.current;
    // 按下：纵向压缩，横向展宽，向下位移，基础放大并显露玻璃
    sp.scaleY.setTarget(0.88);
    sp.scaleX.setTarget(1.06);
    sp.translateY.setTarget(4);
    sp.glow.setTarget(1);
    sp.scale.setTarget(1.0);
    sp.bgOpacity.setTarget(0);
    // 涟漪
    sp.ripple.value = 0;
    sp.ripple.velocity = 0;
    sp.ripple.setTarget(2.5);
  };

  const release = () => {
    if (!isPressed.current) return;
    isPressed.current = false;
    const sp = springs.current;
    // 释放：弹回，允许过冲，缩小并遮挡玻璃
    sp.scaleY.setTarget(1);
    sp.scaleX.setTarget(1);
    sp.translateY.setTarget(0);
    sp.glow.setTarget(0);
    sp.scale.setTarget(0.9);
    sp.bgOpacity.setTarget(0.8);
    setPressCount(c => c + 1);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={220} height={72} radius={36} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Tactile Button</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          按下时弹簧物理压缩，释放时过冲弹跳，模拟真实按键的触觉反馈。点击感受液态玻璃质感。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '2rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 装饰光晕 */}
        <div style={{
          position: 'absolute', width: '300px', height: '300px',
          borderRadius: '50%', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(120, 80, 255, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* 按键次数显示 */}
        <div style={{
          color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 500,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          已按下 <span style={{ color: 'rgba(180, 140, 255, 0.9)', fontWeight: 700, fontSize: '18px' }}>{pressCount}</span> 次
        </div>

        {/* 按钮容器 */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* 涟漪层 */}
          <div
            ref={rippleRef}
            style={{
              position: 'absolute', inset: '-10px',
              borderRadius: '46px',
              border: '2px solid rgba(180, 140, 255, 0.4)',
              opacity: 0,
              transformOrigin: 'center',
              pointerEvents: 'none',
            }}
          />

          {/* 液态玻璃按钮 */}
          <div
            ref={btnRef}
            onPointerDown={press}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
            style={{
              width: '220px', height: '72px',
              borderRadius: '36px',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              cursor: 'pointer',
              userSelect: 'none',
              touchAction: 'none',
              transformOrigin: 'center center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {/* 内部高光 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
              borderRadius: '36px 36px 0 0',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />

            {/* 背景遮罩层 */}
            <div
              ref={bgRef}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(255,255,255,0.9)',
                pointerEvents: 'none',
              }}
            />

            <span
              ref={labelRef}
              style={{
                color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '16px',
                letterSpacing: '0.08em', position: 'relative', zIndex: 1,
              }}
            >
              PRESS ME
            </span>
          </div>
        </div>

        {/* 多个按钮变体 */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Primary', 'Delete', 'Save'].map((label, i) => (
            <SmallTactileBtn key={label} label={label} color={['#7850ff', '#ff4040', '#20c040'][i]} />
          ))}
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};

// 小型触感按钮子组件（同样遵循 rAF + spring 规范）
const SmallTactileBtn: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  const btnRef = useRef<HTMLDivElement>(null);
  const sp = useRef({
    scaleY: new Spring(1, 500, 28),
    scaleX: new Spring(1, 500, 28),
    translateY: new Spring(0, 500, 28),
  });

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const s = sp.current;
      const sy = s.scaleY.update(dt);
      const sx = s.scaleX.update(dt);
      const ty = s.translateY.update(dt);
      if (btnRef.current) {
        btnRef.current.style.transform = `translateY(${ty}px) scale(${sx}, ${sy})`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const press = () => { sp.current.scaleY.setTarget(0.9); sp.current.scaleX.setTarget(1.05); sp.current.translateY.setTarget(3); };
  const release = () => { sp.current.scaleY.setTarget(1); sp.current.scaleX.setTarget(1); sp.current.translateY.setTarget(0); };

  return (
    <div
      ref={btnRef}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      style={{
        padding: '12px 24px',
        borderRadius: '100px',
        background: `${color}33`,
        border: `1px solid ${color}66`,
        color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '14px',
        cursor: 'pointer', userSelect: 'none', touchAction: 'none',
        transformOrigin: 'center center',
        boxShadow: `0 0 20px ${color}22`,
      }}
    >
      {label}
    </div>
  );
};
