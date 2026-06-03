import React, { useEffect, useRef, useState } from 'react';
import { useLiquidState } from '../components/LiquidStateContext';
import { ParameterPanel } from '../components/ParameterPanel';
import { OpticsFilter } from '../components/OpticsFilter';
import { Spring } from '../utils/spring';

export const DynamicDock: React.FC = () => {
  const filterId = "dock-filter";
  const bubbleRef = useRef<HTMLDivElement>(null);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const state = useRef({
    isDragging: false,
    dragOffset: 0,
    x: 8,
    velocityX: 0,
    lastX: 0,
    lastTime: 0,
  });

  const springs = useRef({
    x: new Spring(8, 300, 20),
    scaleX: new Spring(1, 400, 30),
    scaleY: new Spring(1, 400, 30),
    shadowOffsetX: new Spring(0, 400, 30),
    shadowOffsetY: new Spring(4, 400, 30),
    shadowBlur: new Spring(12, 400, 30),
    shadowAlpha: new Spring(0.15, 300, 25),
  });

  const DOCK_ITEMS = ['Finder', 'Music', 'Safari', 'Mail'];
  const ITEM_WIDTH = 80;

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
      
      if (!s.isDragging) {
        // Snap to nearest item
        const targetX = 8 + activeIndex * ITEM_WIDTH;
        sp.x.setTarget(targetX);
      }
      
      if (s.isDragging) {
        sp.shadowOffsetX.setTarget(2);
        sp.shadowOffsetY.setTarget(12);
        sp.shadowBlur.setTarget(20);
        sp.shadowAlpha.setTarget(0.25);
      } else {
        sp.shadowOffsetX.setTarget(0);
        sp.shadowOffsetY.setTarget(4);
        sp.shadowBlur.setTarget(12);
        sp.shadowAlpha.setTarget(0.15);
      }

      const velocityMagnitude = Math.abs(sp.x.velocity) + Math.abs(s.velocityX);
      const squishAmount = Math.min(0.2, velocityMagnitude / 3000);
      if (velocityMagnitude > 50) {
        sp.scaleX.setTarget(1 + squishAmount);
        sp.scaleY.setTarget(1 - squishAmount * 0.5);
      } else {
        sp.scaleX.setTarget(1);
        sp.scaleY.setTarget(1);
      }

      const x = s.isDragging ? sp.x.value : sp.x.update(dt);
      const scaleX = sp.scaleX.update(dt);
      const scaleY = sp.scaleY.update(dt);
      const shadowOffsetX = sp.shadowOffsetX.update(dt);
      const shadowOffsetY = sp.shadowOffsetY.update(dt);
      const shadowBlur = sp.shadowBlur.update(dt);
      const shadowAlpha = sp.shadowAlpha.update(dt);

      if (bubbleRef.current) {
        // center thumb relative to its width (80px)
        bubbleRef.current.style.transform = `translateX(${x - 40}px) scale(${scaleX}, ${scaleY})`;
        bubbleRef.current.style.boxShadow = `
          ${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha}),
          inset ${shadowOffsetX * 0.3}px ${shadowOffsetY * 0.4}px 16px rgba(0, 0, 0, ${shadowAlpha * 0.6}),
          inset ${-shadowOffsetX * 0.3}px ${-shadowOffsetY * 0.4}px 16px rgba(255, 255, 255, ${shadowAlpha * 0.8})
        `;
      }

      if (s.isDragging) {
        s.velocityX *= 0.95;
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
    const s = state.current;
    s.isDragging = true;
    
    const thumbRect = bubbleRef.current!.getBoundingClientRect();
    s.dragOffset = e.clientX - (thumbRect.left + thumbRect.width / 2);
    
    s.lastX = e.clientX;
    s.lastTime = performance.now();
    s.velocityX = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    
    const now = performance.now();
    const dt = Math.max(1, now - s.lastTime) / 1000;
    s.velocityX = (e.clientX - s.lastX) / dt;
    s.lastX = e.clientX;
    s.lastTime = now;

    const parentRect = bubbleRef.current!.parentElement!.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - s.dragOffset;
    
    const maxX = 8 + (DOCK_ITEMS.length - 1) * ITEM_WIDTH;
    newX = Math.max(8, Math.min(maxX, newX));
    springs.current.x.value = newX;
    s.x = newX;

    const newIndex = Math.round((newX - 8) / ITEM_WIDTH);
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = state.current;
    s.isDragging = false;
    e.currentTarget.style.cursor = 'grab';
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={80} height={66} radius={33} />
      
      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Dynamic Dock</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          A macOS-like dock where the selection bubble is made of liquid glass.
        </p>
      </div>

      <div style={{ 
        width: '100%', height: '500px', 
        background: '#302213', 
        backgroundImage: 'radial-gradient(circle at 50% 100%, #302213 0%, #0d0a05 100%)',
        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        position: 'relative', overflow: 'hidden'
      }}>
        
        {/* Dynamic Dock Container */}
        <div style={{
          position: 'relative', height: '80px',
          background: 'rgba(0, 0, 0, 0.4)', borderRadius: '40px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', padding: '0 8px', zIndex: 1
        }}>
          
          {DOCK_ITEMS.map((item, i) => (
            <div 
              key={item}
              onClick={() => setActiveIndex(i)}
              style={{
                width: `${ITEM_WIDTH}px`, height: '100%', cursor: 'pointer', zIndex: 10, position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                opacity: activeIndex === i ? 1 : 0.5,
                color: '#fff', transition: 'all 0.3s ease',
                fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em'
              }}
            >
              <div style={{ 
                width: '26px', height: '26px', border: '2px solid currentColor', borderRadius: '8px',
                transform: activeIndex === i ? 'scale(1.15) translateY(-2px)' : 'scale(1) translateY(0)',
                filter: activeIndex === i ? 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' : 'none',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }} />
              <span style={{
                transform: activeIndex === i ? 'translateY(2px)' : 'translateY(0)',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}>{item}</span>
            </div>
          ))}

          {/* Liquid Glass Bubble */}
          <div 
            ref={bubbleRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute', top: '7px', left: 0,
              width: '80px', height: '66px', borderRadius: '33px',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              cursor: 'grab', touchAction: 'none', transformOrigin: 'center center'
            }}
          />
        </div>

      </div>
      
      <ParameterPanel />
    </div>
  );
};
