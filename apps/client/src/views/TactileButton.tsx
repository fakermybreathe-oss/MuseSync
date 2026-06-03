import React, { useEffect, useRef } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { Spring } from '../utils/spring';

interface TactileButtonProps {
  label: string;
  width?: number;
  height?: number;
  radius?: number;
  color?: string;
  onClick?: () => void;
  accent?: string;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  label, width = 160, height = 64, radius = 32, color = '#F8FAFC', accent = '#D97706', onClick
}) => {
  // Use a unique ID for the filter based on label
  const filterId = `tactile-btn-filter-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const btnRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const isPressed = useRef(false);
  const springs = useRef({
    scaleY: new Spring(1, 500, 28),
    scaleX: new Spring(1, 500, 28),
    translateY: new Spring(0, 500, 28),
    glow: new Spring(0, 300, 20),
    ripple: new Spring(0, 200, 18),
    scale: new Spring(1.0, 300, 22),       
    bgOpacity: new Spring(0.05, 250, 20),   
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
        // Convert hex accent to rgb for shadow
        btnRef.current.style.boxShadow = `
          0 ${8 - ty * 0.5}px ${24 - ty}px rgba(0,0,0,${0.3 + glow * 0.2}),
          0 0 ${glow * 30}px ${accent}44,
          inset 0 1px 0 rgba(255,255,255,${0.1 - glow * 0.05}),
          inset 0 -2px 0 rgba(0,0,0,${0.2 + glow * 0.1})
        `;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      if (rippleRef.current) {
        const scale = ripple;
        rippleRef.current.style.transform = `scale(${scale})`;
        rippleRef.current.style.opacity = `${Math.max(0, 0.4 - ripple * 0.4)}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [accent]);

  const press = () => {
    isPressed.current = true;
    const sp = springs.current;
    sp.scaleY.setTarget(0.88);
    sp.scaleX.setTarget(1.06);
    sp.translateY.setTarget(4);
    sp.glow.setTarget(1);
    sp.scale.setTarget(1.05);
    sp.bgOpacity.setTarget(0.15);
    sp.ripple.value = 0;
    sp.ripple.velocity = 0;
    sp.ripple.setTarget(2.5);
  };

  const release = () => {
    if (!isPressed.current) return;
    isPressed.current = false;
    const sp = springs.current;
    sp.scaleY.setTarget(1);
    sp.scaleX.setTarget(1);
    sp.translateY.setTarget(0);
    sp.glow.setTarget(0);
    sp.scale.setTarget(1.0);
    sp.bgOpacity.setTarget(0.05);
    if (onClick) onClick();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <OpticsFilter id={filterId} width={width} height={height} radius={radius} />
      
      <div
        ref={rippleRef}
        style={{
          position: 'absolute', inset: '-10px',
          borderRadius: `${radius + 10}px`,
          border: `2px solid ${accent}`,
          opacity: 0,
          transformOrigin: 'center',
          pointerEvents: 'none',
        }}
      />

      <div
        ref={btnRef}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        style={{
          width: `${width}px`, height: `${height}px`,
          borderRadius: `${radius}px`,
          backdropFilter: `url(#${filterId})`,
          WebkitBackdropFilter: `url(#${filterId})`,
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
          transformOrigin: 'center center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
          borderRadius: `${radius}px ${radius}px 0 0`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        <div
          ref={bgRef}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,1)',
            pointerEvents: 'none',
          }}
        />

        <span style={{
            color: color, fontWeight: 700, fontSize: '15px',
            letterSpacing: '0.1em', position: 'relative', zIndex: 1,
        }}>
          {label}
        </span>
      </div>
    </div>
  );
};
