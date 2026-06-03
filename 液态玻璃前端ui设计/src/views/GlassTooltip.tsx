import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 玻璃提示框 — hover 时弹簧弹入，OpticsFilter 玻璃气泡效果
// rAF + Spring 直接驱动 DOM ref，禁止 setState 驱动动画
export const GlassTooltip: React.FC = () => {
  const filterId = 'tooltip-filter';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={180} height={52} radius={26} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Glass Tooltip</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          悬停时弹簧弹入，液态玻璃气泡浮现，箭头与主体同步弹性联动。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(135deg, #13111c 0%, #1a1625 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      }}>
        {/* 不同方向的 Tooltip 演示 */}
        <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
          <TooltipItem label="Send Email" tooltipText="Ctrl + E" position="top" filterId={filterId} icon="✉️" />
          <TooltipItem label="Download" tooltipText="Save file" position="top" filterId={filterId} icon="⬇️" />
          <TooltipItem label="Settings" tooltipText="Preferences" position="top" filterId={filterId} icon="⚙️" />
        </div>

        <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
          <TooltipItem label="Share" tooltipText="Copy link" position="bottom" filterId={filterId} icon="🔗" />
          <TooltipItem label="Delete" tooltipText="Remove item" position="bottom" filterId={filterId} icon="🗑️" color="#ff4444" />
          <TooltipItem label="Star" tooltipText="Add to favorites" position="bottom" filterId={filterId} icon="⭐" color="#f59e0b" />
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};

// 单个 Tooltip 子组件
const TooltipItem: React.FC<{
  label: string;
  tooltipText: string;
  position: 'top' | 'bottom';
  filterId: string;
  icon: string;
  color?: string;
}> = ({ label, tooltipText, position, filterId, icon, color = '#7850ff' }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const bgTopRef = useRef<HTMLDivElement>(null);
  const bgBottomRef = useRef<HTMLDivElement>(null);
  const isHovering = useRef(false);

  const springs = useRef({
    scaleY: new Spring(0, 400, 28),
    opacity: new Spring(0, 300, 22),
    translateY: new Spring(position === 'top' ? 8 : -8, 400, 28),
    btnScale: new Spring(1, 500, 30),
    bgOpacity: new Spring(1, 250, 20),
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
      const op = sp.opacity.update(dt);
      const ty = sp.translateY.update(dt);
      const bs = sp.btnScale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      if (tooltipRef.current) {
        tooltipRef.current.style.transform =
          `translateX(-50%) translateY(${ty}px) scaleY(${Math.max(0, sy)})`;
        tooltipRef.current.style.opacity = `${Math.max(0, op)}`;
        tooltipRef.current.style.pointerEvents = sy > 0.5 ? 'auto' : 'none';
      }

      if (arrowRef.current) {
        arrowRef.current.style.opacity = `${Math.max(0, op)}`;
        arrowRef.current.style.transform =
          `translateX(-50%) translateY(${ty * 0.5}px) scale(${Math.max(0, sy)})`;
      }

      if (btnRef.current) {
        btnRef.current.style.transform = `scale(${bs})`;
      }

      if (bgTopRef.current) {
        bgTopRef.current.style.opacity = `${bgOp}`;
      }
      if (bgBottomRef.current) {
        bgBottomRef.current.style.opacity = `${bgOp}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [position]);

  const showTooltip = () => {
    isHovering.current = true;
    const sp = springs.current;
    sp.scaleY.setTarget(1);
    sp.opacity.setTarget(1);
    sp.translateY.setTarget(0);
    sp.btnScale.setTarget(1.08);
    sp.bgOpacity.setTarget(0);
  };

  const hideTooltip = () => {
    isHovering.current = false;
    const sp = springs.current;
    sp.scaleY.setTarget(0);
    sp.opacity.setTarget(0);
    sp.translateY.setTarget(position === 'top' ? 8 : -8);
    sp.btnScale.setTarget(1);
    sp.bgOpacity.setTarget(1);
  };

  const isTop = position === 'top';

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
    >
      {/* Tooltip（上方） */}
      {isTop && (
        <>
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '180px', height: '52px',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              borderRadius: '26px',
              transformOrigin: 'bottom center',
              opacity: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              zIndex: 10,
              overflow: 'hidden',
            }}
          >
            {/* 背景遮罩层 */}
            <div
              ref={bgTopRef}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(255,255,255,0.95)',
                pointerEvents: 'none',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600, position: 'relative', zIndex: 1 }}>
              {tooltipText}
            </span>
          </div>
          {/* 箭头 */}
          <div
            ref={arrowRef}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 5px)',
              left: '50%',
              width: '10px', height: '8px',
              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
              background: 'rgba(255,255,255,0.12)',
              transformOrigin: 'top center',
              opacity: 0,
            }}
          />
        </>
      )}

      {/* 触发按钮 */}
      <div
        ref={btnRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        style={{
          width: '64px', height: '64px',
          borderRadius: '18px',
          background: `${color}22`,
          border: `1px solid ${color}44`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
          cursor: 'pointer',
          transformOrigin: 'center',
          boxShadow: `0 0 20px ${color}22`,
        }}
      >
        <span style={{ fontSize: '24px' }}>{icon}</span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{label}</span>

      {/* Tooltip（下方） */}
      {!isTop && (
        <>
          {/* 箭头 */}
          <div
            ref={arrowRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 28px)',
              left: '50%',
              width: '10px', height: '8px',
              clipPath: 'polygon(50% 0%, 0 100%, 100% 100%)',
              background: 'rgba(255,255,255,0.12)',
              transformOrigin: 'bottom center',
              opacity: 0,
            }}
          />
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 36px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '180px', height: '52px',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              borderRadius: '26px',
              transformOrigin: 'top center',
              opacity: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              zIndex: 10,
              overflow: 'hidden',
            }}
          >
            {/* 背景遮罩层 */}
            <div
              ref={bgBottomRef}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(255,255,255,0.95)',
                pointerEvents: 'none',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600, position: 'relative', zIndex: 1 }}>
              {tooltipText}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
