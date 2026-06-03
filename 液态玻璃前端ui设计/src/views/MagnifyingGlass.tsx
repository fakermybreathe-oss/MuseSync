import React, { useEffect, useRef } from 'react';
import { useLiquidState } from '../components/LiquidStateContext';
import { ParameterPanel } from '../components/ParameterPanel';
import { OpticsFilter } from '../components/OpticsFilter';
import { Spring } from '../utils/spring';

export const MagnifyingGlass: React.FC = () => {
  const filterId = "lens-filter";
  const glassRef = useRef<HTMLDivElement>(null);
  
  const springs = useRef({
    scale: new Spring(0.85, 400, 25),
    scaleX: new Spring(1, 400, 30),
    scaleY: new Spring(1, 400, 30),
    shadowOffsetX: new Spring(0, 400, 30),
    shadowOffsetY: new Spring(4, 400, 30),
    shadowBlur: new Spring(12, 400, 30),
    shadowAlpha: new Spring(0.15, 300, 25),
  });
  
  const state = useRef({
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    velocityX: 0, velocityY: 0,
    lastX: 0, lastY: 0, lastTime: 0,
    x: 400, y: 150
  });

  useEffect(() => {
    let animationFrameId: number;
    
    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const s = state.current;
      const sp = springs.current;
      
      if (s.isDragging) {
        sp.scale.setTarget(1.0);
        sp.shadowOffsetX.setTarget(4);
        sp.shadowOffsetY.setTarget(16);
        sp.shadowBlur.setTarget(24);
        sp.shadowAlpha.setTarget(0.22);
      } else {
        sp.scale.setTarget(0.85);
        sp.shadowOffsetX.setTarget(0);
        sp.shadowOffsetY.setTarget(4);
        sp.shadowBlur.setTarget(12);
        sp.shadowAlpha.setTarget(0.15);
      }

      const velocityMagnitude = Math.sqrt(s.velocityX ** 2 + s.velocityY ** 2);
      const squishAmount = Math.min(0.15, velocityMagnitude / 3000);

      if (velocityMagnitude > 50) {
        const vxNorm = s.velocityX / velocityMagnitude;
        const vyNorm = s.velocityY / velocityMagnitude;
        sp.scaleX.setTarget(1 + squishAmount * Math.abs(vxNorm) - squishAmount * 0.5 * Math.abs(vyNorm));
        sp.scaleY.setTarget(1 + squishAmount * Math.abs(vyNorm) - squishAmount * 0.5 * Math.abs(vxNorm));
      } else {
        sp.scaleX.setTarget(1);
        sp.scaleY.setTarget(1);
      }

      const scale = sp.scale.update(dt);
      const scaleX = sp.scaleX.update(dt);
      const scaleY = sp.scaleY.update(dt);
      const shadowOffsetX = sp.shadowOffsetX.update(dt);
      const shadowOffsetY = sp.shadowOffsetY.update(dt);
      const shadowBlur = sp.shadowBlur.update(dt);
      const shadowAlpha = sp.shadowAlpha.update(dt);

      if (glassRef.current) {
        glassRef.current.style.transform = `scale(${scale * scaleX}, ${scale * scaleY})`;
        glassRef.current.style.boxShadow = `
          ${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha}),
          inset ${shadowOffsetX * 0.3}px ${shadowOffsetY * 0.4}px 16px rgba(0, 0, 0, ${shadowAlpha * 0.6}),
          inset ${-shadowOffsetX * 0.3}px ${-shadowOffsetY * 0.4}px 16px rgba(255, 255, 255, ${shadowAlpha * 0.8})
        `;
        glassRef.current.style.left = `${s.x}px`;
        glassRef.current.style.top = `${s.y}px`;
      }

      if (!s.isDragging) {
        s.velocityX *= 0.95;
        s.velocityY *= 0.95;
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
    const s = state.current;
    s.isDragging = true;
    
    const rect = glassRef.current!.getBoundingClientRect();
    const currentScale = springs.current.scale.value;
    
    s.dragOffset.x = (e.clientX - rect.left) / currentScale;
    s.dragOffset.y = (e.clientY - rect.top) / currentScale;
    
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastTime = performance.now();
    s.velocityX = 0;
    s.velocityY = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    
    const now = performance.now();
    const dt = Math.max(1, now - s.lastTime) / 1000;
    s.velocityX = (e.clientX - s.lastX) / dt;
    s.velocityY = (e.clientY - s.lastY) / dt;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastTime = now;

    const parentRect = glassRef.current!.parentElement!.getBoundingClientRect();
    s.x = e.clientX - parentRect.left - s.dragOffset.x;
    s.y = e.clientY - parentRect.top - s.dragOffset.y;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    state.current.isDragging = false;
    e.currentTarget.style.cursor = 'grab';
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={200} height={140} radius={70} />
      
      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Magnifying Glass</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          Drag the capsule to bend the page. This uses the completely ported Snell's Law optics engine and Spring Physics.
        </p>
      </div>

      <div style={{ 
        width: '100%', height: '500px', 
        background: '#fff', 
        borderRadius: '16px', display: 'flex', alignItems: 'stretch',
        boxShadow: '0 24px 48px rgba(0,0,0,0.08)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #E5E5E5'
      }}>
        <div style={{ flex: 1, padding: '40px' }}>
            <div style={{ fontSize: '0.7rem', color: 'red', fontWeight: 700, letterSpacing: '2px', marginBottom: '1rem' }}>— OPTICS STUDY</div>
            <h2 style={{ fontSize: '3.5rem', fontWeight: 800, margin: '0 0 1rem 0', lineHeight: 1.0, letterSpacing: '-1.5px', color: '#111' }}>Liquid Glass—<br/>Precision Lens</h2>
        </div>
        <div style={{ width: '400px', height: '100%', position: 'relative' }}>
          <img 
            src="https://images.unsplash.com/photo-1579380656108-f98e4df8ea62?q=80&w=800&auto=format&fit=crop" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            alt="Abstract" draggable={false}
          />
        </div>

        {/* The Glass Lens */}
        <div 
          ref={glassRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            width: '200px', height: '140px', borderRadius: '70px',
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
            cursor: 'grab',
            left: '400px', top: '150px',
            transformOrigin: 'center center',
            touchAction: 'none',
            userSelect: 'none'
          }}
        />
      </div>
      
      <ParameterPanel />
    </div>
  );
};
