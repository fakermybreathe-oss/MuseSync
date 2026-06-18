import React, { useEffect, useRef } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { Spring } from '../utils/spring';

const TRACK_WIDTH = 330;
const TRACK_HEIGHT = 14;
const THUMB_WIDTH = 90;
const THUMB_HEIGHT = 60;
const THUMB_RADIUS = 30;
const SCALE_REST = 0.6;
const SCALE_ACTIVE = 1.0;
const REFRACTION_REST = 0.4;
const REFRACTION_ACTIVE = 0.9;

const THUMB_WIDTH_REST = THUMB_WIDTH * SCALE_REST;
const X0 = THUMB_WIDTH_REST / 2;
const X100 = TRACK_WIDTH - THUMB_WIDTH_REST / 2;
const TRAVEL = X100 - X0;

export interface FluidSliderProps {
  value: number;
  onChange?: (val: number) => void;
  onChangeEnd?: (val: number) => void;
  width?: number;
  height?: number;
  thumbWidth?: number;
  thumbHeight?: number;
  colorStart?: string;
  colorEnd?: string;
}

export const FluidSlider: React.FC<FluidSliderProps> = ({ 
  value, 
  onChange,
  onChangeEnd,
  width = 330,
  height = 14,
  thumbWidth = 90,
  thumbHeight = 60,
  colorStart = '#D97706',
  colorEnd = '#F59E0B'
}) => {
  const thumbRadius = thumbHeight / 2;
  const thumbWidthRest = thumbWidth * 0.6;
  const x0 = thumbWidthRest / 2;
  const x100 = width - thumbWidthRest / 2;
  const travel = x100 - x0;
  
  const filterId = `fluid-slider-filter-${width}`;
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackFillRef = useRef<HTMLDivElement>(null);

  const state = useRef({
    isDragging: false,
    dragOffset: 0,
    velocityX: 0,
    lastX: 0,
    lastTime: 0,
  });

  const springs = useRef({
    x: new Spring(x0 + (value / 100) * travel, 180, 25), // 降低硬度(stiffness)，增加阻尼(damping)以减少回弹
    scale: new Spring(SCALE_REST, 400, 30),
    backgroundOpacity: new Spring(1.0, 300, 25),
    scaleRatio: new Spring(REFRACTION_REST, 300, 25),
  });

  // Sync prop to spring when not dragging
  useEffect(() => {
    if (!state.current.isDragging) {
      springs.current.x.setTarget(x0 + (value / 100) * travel);
    }
  }, [value, x0, travel]);

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

      const isActive = s.isDragging;
      if (isActive) {
        sp.scale.setTarget(SCALE_ACTIVE);
        sp.backgroundOpacity.setTarget(0.1);
        sp.scaleRatio.setTarget(REFRACTION_ACTIVE);
      } else {
        sp.scale.setTarget(SCALE_REST);
        sp.backgroundOpacity.setTarget(1.0);
        sp.scaleRatio.setTarget(REFRACTION_REST);
      }

      const x = s.isDragging ? sp.x.value : sp.x.update(dt);
      const scale = sp.scale.update(dt);
      const bgOpacity = sp.backgroundOpacity.update(dt);
      const scaleRatio = sp.scaleRatio.update(dt);

      if (thumbRef.current) {
        thumbRef.current.style.left = `${x - thumbWidth / 2}px`;
        thumbRef.current.style.transform = `scale(${scale})`;
        thumbRef.current.style.backgroundColor = `rgba(255, 255, 255, ${bgOpacity})`;
      }

      if (trackFillRef.current) {
        const ratio = Math.max(0, Math.min(1, (x - x0) / travel));
        trackFillRef.current.style.width = `${ratio * 100}%`;
      }

      const feDisplacementMap = document.getElementById(`${filterId}-displacementMap`);
      if (feDisplacementMap) {
        const baseScale = parseFloat(feDisplacementMap.getAttribute('data-base-scale') || '0');
        feDisplacementMap.setAttribute('scale', String(baseScale * scaleRatio));
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
    const s = state.current;
    s.isDragging = true;
    s.lastX = e.clientX;
    s.lastTime = performance.now();
    s.velocityX = 0;

    const isThumb = e.target === thumbRef.current;
    if (isThumb) {
      const thumbRect = thumbRef.current!.getBoundingClientRect();
      s.dragOffset = e.clientX - (thumbRect.left + thumbRect.width / 2);
    } else {
      // 点击了轨道其他区域
      s.dragOffset = 0;
      const parentRect = e.currentTarget.getBoundingClientRect();
      let newX = e.clientX - parentRect.left;
      newX = Math.max(x0, Math.min(x100, newX));
      
      springs.current.x.value = newX;
      springs.current.x.velocity = 0;
      
      const ratio = (newX - x0) / travel;
      if (onChange) onChange(Math.round(ratio * 100));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = state.current;
    if (!s.isDragging) return;

    const now = performance.now();
    const dt = Math.max(1, now - s.lastTime) / 1000;
    s.velocityX = (e.clientX - s.lastX) / dt;
    s.lastX = e.clientX;
    s.lastTime = now;

    const parentRect = e.currentTarget.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - s.dragOffset;
    newX = Math.max(x0, Math.min(x100, newX));

    springs.current.x.value = newX;
    springs.current.x.velocity = 0;

    const ratio = (newX - x0) / travel;
    if (onChange) onChange(Math.round(ratio * 100));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const s = state.current;
    s.isDragging = false;
    e.currentTarget.style.cursor = 'pointer';
    e.currentTarget.releasePointerCapture(e.pointerId);

    const newX = springs.current.x.value;
    const ratio = (newX - x0) / travel;
    if (onChangeEnd) onChangeEnd(Math.round(ratio * 100));
  };

  return (
    <div 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ position: 'relative', width: `${width}px`, height: `${thumbHeight}px`, cursor: 'pointer', touchAction: 'none' }}
    >
      <OpticsFilter id={filterId} width={thumbWidth} height={thumbHeight} radius={thumbRadius} />
      <div style={{
        position: 'absolute', left: 0, top: (thumbHeight - height) / 2,
        width: `${width}px`, height: `${height}px`,
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '100px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', overflow: 'hidden',
        pointerEvents: 'none' // 让外层响应点击
      }}>
        <div ref={trackFillRef} style={{
          height: '100%', width: `${value}%`, borderRadius: '100px',
          background: `linear-gradient(90deg, ${colorStart}, ${colorEnd})`,
          boxShadow: `0 0 10px ${colorStart}80`
        }} />
      </div>
      <div
        ref={thumbRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: `${thumbWidth}px`, height: `${thumbHeight}px`,
          borderRadius: `${thumbRadius}px`, backgroundColor: 'rgba(255, 255, 255, 1)',
          backdropFilter: `url(#${filterId})`, WebkitBackdropFilter: `url(#${filterId})`,
          transformOrigin: 'center center',
          transform: `scale(${SCALE_REST})`,
        }}
      />
    </div>
  );
};
