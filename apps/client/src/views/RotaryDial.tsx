import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 旋转表盘 — 圆形旋转，惯性旋转+弹簧衰减，刻度盘显示
// rAF + Spring 驱动 DOM ref，禁止 setState 驱动动画
export const RotaryDial: React.FC = () => {
  const filterId = 'rotary-filter';
  const dialRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(0);

  const state = useRef({
    isDragging: false,
    startAngle: 0,
    startRot: 0,
    lastAngle: 0,
    lastTime: 0,
    angularVelocity: 0, // degrees/sec
  });

  const springs = useRef({
    rotation: new Spring(0, 60, 8),  // 低刚度，高惯性感
    scale: new Spring(0.9, 300, 24),
    bgOpacity: new Spring(0.8, 250, 20),
  });

  const getAngle = (e: PointerEvent | React.PointerEvent, center: { x: number; y: number }) => {
    const clientX = 'nativeEvent' in e ? e.nativeEvent.clientX : e.clientX;
    const clientY = 'nativeEvent' in e ? e.nativeEvent.clientY : e.clientY;
    return Math.atan2(clientY - center.y, clientX - center.x) * (180 / Math.PI);
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
      const s = state.current;

      if (!s.isDragging) {
        // 惯性：松手后 angularVelocity 衰减
        if (Math.abs(s.angularVelocity) > 0.5) {
          s.angularVelocity *= 0.96; // 摩擦衰减
          sp.rotation.value += s.angularVelocity * dt;
          sp.rotation.velocity = s.angularVelocity;
        }
      }

      const rot = sp.rotation.update(dt);
      const scale = sp.scale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      // 将旋转归一化为 0-360
      const normalized = ((rot % 360) + 360) % 360;
      const value = Math.round((normalized / 360) * 99);
      setDisplayValue(value);

      if (dialRef.current) {
        dialRef.current.style.transform = `rotate(${rot}deg) scale(${scale})`;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = dialRef.current!.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const s = state.current;
    s.isDragging = true;
    s.startAngle = getAngle(e, center);
    s.startRot = springs.current.rotation.value;
    s.lastAngle = s.startAngle;
    s.lastTime = performance.now();
    s.angularVelocity = 0;
    springs.current.scale.setTarget(1.0);
    springs.current.bgOpacity.setTarget(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    const rect = dialRef.current!.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const angle = getAngle(e, center);

    let delta = angle - s.startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    springs.current.rotation.value = s.startRot + delta;
    springs.current.rotation.velocity = 0;

    // 计算角速度
    const now = performance.now();
    const dt = Math.max(1, now - s.lastTime) / 1000;
    let angleDelta = angle - s.lastAngle;
    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;
    s.angularVelocity = angleDelta / dt;
    s.lastAngle = angle;
    s.lastTime = now;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = state.current;
    s.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    springs.current.scale.setTarget(0.9);
    springs.current.bgOpacity.setTarget(0.8);
    // 惯性旋转：把当前角速度传给 spring
    springs.current.rotation.velocity = s.angularVelocity * 0.3;
  };

  // 生成刻度
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const majorTick = [0, 10, 20, 30, 40, 50];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={180} height={180} radius={90} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Rotary Dial</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          圆形旋转表盘，松手后惯性继续旋转并自然衰减，完全物理驱动，OpticsFilter 玻璃盘面。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'radial-gradient(ellipse at 50% 40%, #1c1020 0%, #0a080f 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 外圈刻度环（固定不转） */}
        <div style={{ position: 'relative', width: '280px', height: '280px' }}>
          <svg
            viewBox="0 0 280 280"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {ticks.map((i) => {
              const angle = (i / 60) * 360 - 90;
              const rad = (angle * Math.PI) / 180;
              const isMajor = i % 10 === 0;
              const outerR = 130;
              const innerR = isMajor ? 116 : 122;
              const x1 = 140 + outerR * Math.cos(rad);
              const y1 = 140 + outerR * Math.sin(rad);
              const x2 = 140 + innerR * Math.cos(rad);
              const y2 = 140 + innerR * Math.sin(rad);
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={isMajor ? '2' : '1'}
                  strokeLinecap="round"
                />
              );
            })}
            {/* 指针标记（顶部固定） */}
            <polygon
              points="140,6 136,16 144,16"
              fill="rgba(180,130,255,0.9)"
              filter="drop-shadow(0 0 4px rgba(180,130,255,0.8))"
            />
          </svg>

          {/* 旋转表盘（OpticsFilter） */}
          <div
            ref={dialRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              top: '50px', left: '50px',
              width: '180px', height: '180px',
              borderRadius: '50%',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              cursor: 'grab',
              touchAction: 'none',
              transformOrigin: 'center center',
              border: '1.5px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            {/* 内部刻度孔 */}
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const r = 55;
              return (
                <div
                  key={deg}
                  style={{
                    position: 'absolute',
                    width: '10px', height: '10px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    left: `calc(50% + ${r * Math.sin(rad)}px - 5px)`,
                    top: `calc(50% - ${r * Math.cos(rad)}px - 5px)`,
                  }}
                />
              );
            })}
            {/* 中心轴 */}
            <div style={{
              width: '20px', height: '20px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)',
            }} />
          </div>
        </div>

        {/* 数值显示 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '56px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
            {String(displayValue).padStart(2, '0')}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', letterSpacing: '0.12em', marginTop: '4px' }}>
            ROTARY DIAL
          </div>
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};
