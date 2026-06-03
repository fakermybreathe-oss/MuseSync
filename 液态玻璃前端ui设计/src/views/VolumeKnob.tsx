import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 音量旋钮 — 圆形旋转交互，Spring 驱动旋转角度 + 惯性，OpticsFilter 旋钮质感
// rAF + Spring 驱动 DOM ref，禁止 setState 驱动动画
export const VolumeKnob: React.FC = () => {
  const filterId = 'volume-filter';
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const [displayVolume, setDisplayVolume] = useState(60);

  const state = useRef({
    isDragging: false,
    startAngle: 0,
    startRot: -120 + 60 * 2.4, // initial rotation for 60%
    lastAngle: 0,
    lastTime: 0,
  });

  // 旋转范围：-120° 到 +120°（对应 0-100%）
  const MIN_ROT = -120;
  const MAX_ROT = 120;
  const ROT_RANGE = MAX_ROT - MIN_ROT;

  const springs = useRef({
    rotation: new Spring(-120 + 60 * 2.4, 200, 18),
    scale: new Spring(0.9, 400, 28),
    glow: new Spring(0, 250, 20),
    bgOpacity: new Spring(0.8, 250, 20),
  });

  const rotToVolume = (rot: number) => Math.round(((rot - MIN_ROT) / ROT_RANGE) * 100);

  // 极坐标：鼠标相对于旋钮中心的角度
  const getAngleFromEvent = (e: PointerEvent, center: { x: number; y: number }) => {
    return Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
  };

  useEffect(() => {
    let rafId: number;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;

      const rot = sp.rotation.update(dt);
      const scale = sp.scale.update(dt);
      const glow = sp.glow.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      setDisplayVolume(Math.max(0, Math.min(100, rotToVolume(rot))));

      if (knobRef.current) {
        knobRef.current.style.transform = `rotate(${rot}deg) scale(${scale})`;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      // 更新 SVG 圆弧进度
      if (arcRef.current) {
        const progress = (rot - MIN_ROT) / ROT_RANGE;
        const totalAngle = 240; // -120 to +120
        const sweepDeg = progress * totalAngle - totalAngle / 2; // centered
        // 在 SVG 中绘制圆弧
        const R = 60;
        const CX = 80;
        const CY = 80;
        const startDeg = -150;
        const endDeg = startDeg + progress * 300;
        const startRad = (startDeg * Math.PI) / 180;
        const endRad = (endDeg * Math.PI) / 180;
        const x1 = CX + R * Math.cos(startRad);
        const y1 = CY + R * Math.sin(startRad);
        const x2 = CX + R * Math.cos(endRad);
        const y2 = CY + R * Math.sin(endRad);
        const largeArc = progress * 300 > 180 ? 1 : 0;
        if (progress > 0.01) {
          arcRef.current.setAttribute('d', `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`);
          arcRef.current.style.opacity = '1';
        } else {
          arcRef.current.style.opacity = '0';
        }
      }

      if (glowRef.current) {
        glowRef.current.style.opacity = `${glow}`;
        glowRef.current.style.transform = `translate(-50%, -50%) scale(${0.8 + glow * 0.4})`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = knobRef.current!.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const s = state.current;
    s.isDragging = true;
    s.startAngle = getAngleFromEvent(e.nativeEvent, center);
    s.startRot = springs.current.rotation.value;
    s.lastAngle = s.startAngle;
    s.lastTime = performance.now();
    springs.current.scale.setTarget(1.0);
    springs.current.glow.setTarget(1);
    springs.current.bgOpacity.setTarget(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    const rect = knobRef.current!.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const angle = getAngleFromEvent(e.nativeEvent, center);
    let delta = angle - s.startAngle;
    // 处理角度跨越 ±180 的情况
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const newRot = Math.max(MIN_ROT, Math.min(MAX_ROT, s.startRot + delta));
    springs.current.rotation.value = newRot;
    springs.current.rotation.velocity = 0;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    state.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    springs.current.scale.setTarget(0.9);
    springs.current.glow.setTarget(0.3);
    springs.current.bgOpacity.setTarget(0.8);
    setTimeout(() => springs.current.glow.setTarget(0), 600);
  };

  // 滚轮调节
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY / 10;
    const sp = springs.current;
    const newRot = Math.max(MIN_ROT, Math.min(MAX_ROT, sp.rotation.value + delta));
    sp.rotation.setTarget(newRot);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={120} height={120} radius={60} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Volume Knob</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          旋转式音量旋钮，拖拽或滚轮调节，弹簧物理驱动旋转角度，极坐标精确跟踪。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'radial-gradient(ellipse at 50% 30%, #1a0e2e 0%, #0a0a12 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 光晕 */}
        <div
          ref={glowRef}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '300px', height: '300px',
            background: 'radial-gradient(circle, rgba(150, 100, 255, 0.2) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', opacity: 0,
          }}
        />

        {/* 旋钮区域 */}
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
          {/* SVG 圆弧进度环 */}
          <svg
            viewBox="0 0 160 160"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {/* 背景轨道 */}
            <path
              d="M 26 124 A 60 60 0 1 1 134 124"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* 进度弧 */}
            <path
              ref={arcRef}
              fill="none"
              stroke="url(#vol-grad)"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ opacity: 0, filter: 'drop-shadow(0 0 4px rgba(150,100,255,0.8))' }}
            />
            <defs>
              <linearGradient id="vol-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>

          {/* 旋钮本体（OpticsFilter） */}
          <div
            ref={knobRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{
              position: 'absolute',
              top: '20px', left: '20px',
              width: '120px', height: '120px',
              borderRadius: '50%',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              cursor: 'grab',
              touchAction: 'none',
              transformOrigin: 'center center',
              border: '1.5px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              paddingTop: '12px',
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
            {/* 指针标记 */}
            <div
              ref={pointerRef}
              style={{
                width: '4px', height: '24px',
                borderRadius: '2px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                position: 'relative', zIndex: 1,
              }}
            />
          </div>
        </div>

        {/* 音量数值显示 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
            {displayVolume}
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', letterSpacing: '0.1em' }}>
            VOLUME
          </div>
        </div>

        {/* 音量条可视化 */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '48px' }}>
          {Array.from({ length: 24 }, (_, i) => {
            const barH = 8 + i * 1.8;
            const active = (i / 24) * 100 <= displayVolume;
            return (
              <div
                key={i}
                style={{
                  width: '4px', height: `${barH}px`,
                  borderRadius: '2px',
                  background: active
                    ? `hsl(${250 + i * 4}, 70%, 65%)`
                    : 'rgba(255,255,255,0.06)',
                  transition: 'background 0.1s',
                }}
              />
            );
          })}
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};
