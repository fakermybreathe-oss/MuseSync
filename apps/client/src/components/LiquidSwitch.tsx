import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from './OpticsFilter';
import { Spring } from '../utils/spring';
import { LiquidStateProvider } from './LiquidStateContext';

export interface SwitchOption {
  id: string;
  label: string;
}

interface LiquidSwitchProps {
  id: string;
  options: SwitchOption[];
  activeId: string;
  onChange: (id: string) => void;
  width: number;
  height: number;
  radius?: number;
}

const REST_SCALE = 1.15;
const ACTIVE_SCALE = 1.7;
const REFRACTION_REST = 0.5;
const REFRACTION_ACTIVE = 1.0;

const TRACK_COLOR_OFF = { r: 148, g: 148, b: 159, a: 0.47 };
const TRACK_COLOR_ON = { r: 59, g: 191, b: 78, a: 0.93 };

function lerpColor(c0: typeof TRACK_COLOR_OFF, c1: typeof TRACK_COLOR_ON, t: number): string {
  const r = Math.round(c0.r + (c1.r - c0.r) * t);
  const g = Math.round(c0.g + (c1.g - c0.g) * t);
  const b = Math.round(c0.b + (c1.b - c0.b) * t);
  const a = c0.a + (c1.a - c0.a) * t;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function dampedOverflow(raw: number, min: number, max: number): number {
  if (raw < min) return min + (raw - min) / 22;
  if (raw > max) return max + (raw - max) / 22;
  return raw;
}

export const LiquidSwitch: React.FC<LiquidSwitchProps> = ({
  id, options, activeId, onChange, width, height, radius
}) => {
  const filterId = `switch-filter-${id}`;
  
  // 确保至少有 2 个选项
  const safeOptions = options.length >= 2 ? options : [
    options[0] || { id: 'opt1', label: '1' },
    options[1] || { id: 'opt2', label: '2' }
  ];
  const isChecked = safeOptions.findIndex(o => o.id === activeId) === 1;

  // Track 和 Thumb 尺寸
  const TRACK_WIDTH = width;
  const TRACK_HEIGHT = height;
  const TRACK_RADIUS = radius ?? height / 2;
  
  const THUMB_WIDTH = (width / 2) - 4; // 两侧留白
  const THUMB_HEIGHT = height - 8;     // 上下留白
  const THUMB_RADIUS = Math.max(4, TRACK_RADIUS - 4);

  const TRAVEL = TRACK_WIDTH - THUMB_WIDTH - 8;
  const MARGIN_LEFT = 4;

  const knobRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const state = useRef({
    isDragging: false,
    dragStartX: 0,
    dragStartRatio: 0,
    velocityX: 0,
    lastX: 0,
    lastTime: 0,
    committed: false,
  });

  const springs = useRef({
    xRatio: new Spring(isChecked ? 1 : 0, 300, 35),
    scaleX: new Spring(1, 350, 40),
    scaleY: new Spring(1, 350, 40),
    scale: new Spring(REST_SCALE, 300, 35),
    backgroundOpacity: new Spring(0.15, 300, 35), 
    trackColorT: new Spring(isChecked ? 1 : 0, 200, 25),
    opticsScaleRatio: new Spring(REFRACTION_REST, 300, 35),
  });

  useEffect(() => {
    if (!state.current.isDragging) {
      const target = isChecked ? 1 : 0;
      springs.current.xRatio.setTarget(target);
      springs.current.trackColorT.setTarget(target);
    }
  }, [isChecked]);

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
      sp.scale.setTarget(isActive ? ACTIVE_SCALE : REST_SCALE);
      sp.backgroundOpacity.setTarget(isActive ? 0.05 : 0.15); 
      sp.opticsScaleRatio.setTarget(isActive ? REFRACTION_ACTIVE : REFRACTION_REST);

      const xRatio = s.isDragging ? sp.xRatio.value : sp.xRatio.update(dt);
      const scaleX = sp.scaleX.update(dt);
      const scaleY = sp.scaleY.update(dt);
      const baseScale = sp.scale.update(dt);
      const bgOpacity = sp.backgroundOpacity.update(dt);
      const trackColorT = sp.trackColorT.update(dt);
      sp.opticsScaleRatio.update(dt);

      const clampedRatio = Math.max(0, Math.min(1, xRatio));
      const thumbX = MARGIN_LEFT + clampedRatio * TRAVEL;

      if (knobRef.current) {
        knobRef.current.style.transform = `translateX(${thumbX}px) scale(${scaleX * baseScale}, ${scaleY * baseScale})`;
        knobRef.current.style.backgroundColor = `rgba(255, 255, 255, ${bgOpacity})`;
      }

      if (trackRef.current) {
        trackRef.current.style.backgroundColor = lerpColor(TRACK_COLOR_OFF, TRACK_COLOR_ON, trackColorT);
      }

      const feDisplacementMap = document.getElementById(`${filterId}-displacementMap`);
      if (feDisplacementMap) {
        const bScale = parseFloat(feDisplacementMap.getAttribute('data-base-scale') || '0');
        feDisplacementMap.setAttribute('scale', String(bScale * sp.opticsScaleRatio.value));
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [filterId, TRAVEL, MARGIN_LEFT]);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const s = state.current;
    s.isDragging = true;
    s.committed = false;
    s.dragStartX = e.clientX;
    s.dragStartRatio = springs.current.xRatio.value;
    s.lastX = e.clientX;
    s.lastTime = performance.now();
    s.velocityX = 0;

    // 按下时发生微小形变，配合 ACTIVE_SCALE 显得饱满
    springs.current.scaleX.setTarget(0.92);
    springs.current.scaleY.setTarget(1.08);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    const now = performance.now();
    const dtMs = Math.max(1, now - s.lastTime);
    s.velocityX = (e.clientX - s.lastX) / (dtMs / 1000);
    s.lastX = e.clientX;
    s.lastTime = now;

    const dx = e.clientX - s.dragStartX;
    if (Math.abs(dx) > 3) s.committed = true;

    const rawRatio = s.dragStartRatio + dx / TRAVEL;
    const dampedRatio = dampedOverflow(rawRatio, 0, 1);

    springs.current.xRatio.value = dampedRatio;
    springs.current.xRatio.velocity = 0;
    springs.current.trackColorT.value = Math.max(0, Math.min(1, dampedRatio));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = state.current;
    s.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    springs.current.scaleX.setTarget(1);
    springs.current.scaleY.setTarget(1);

    const currentRatio = springs.current.xRatio.value;
    let newOn = isChecked;

    if (!s.committed) {
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        newOn = clickX > TRACK_WIDTH / 2;
      }
    } else {
      newOn = currentRatio > 0.5;
    }

    // 果冻弹回效果增强
    const dir = s.velocityX > 0 ? 1 : -1;
    springs.current.scaleX.value = 1 + dir * 0.2;
    springs.current.scaleY.value = 0.8;

    const targetIdx = newOn ? 1 : 0;
    if (safeOptions[targetIdx].id !== activeId) {
      onChange(safeOptions[targetIdx].id);
    } else {
      springs.current.xRatio.setTarget(newOn ? 1 : 0);
      springs.current.trackColorT.setTarget(newOn ? 1 : 0);
    }
  };

  return (
    <LiquidStateProvider initialState={{
      bezelWidth: 12,
      glassThickness: 118,
      specularOpacity: 0.5,
      specularSaturation: 1.0,
      refractionLevel: 0.58,
      blurLevel: 0,
    }}>
      <div style={{
        width: `${width}px`, height: `${height}px`, userSelect: 'none', position: 'relative'
      }}>
        <OpticsFilter id={filterId} width={THUMB_WIDTH} height={THUMB_HEIGHT} radius={THUMB_RADIUS} surfaceType="convex_squircle" />

        {/* 背景轨道（含内部文字） */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            width: '100%', height: '100%',
            borderRadius: `${TRACK_RADIUS}px`,
            backgroundColor: 'rgba(0,0,0,0.15)',
            boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)',
            position: 'relative', cursor: 'pointer',
            display: 'flex', touchAction: 'none'
          }}
        >
          {/* 文案层，z-index 为 1，位于滑块底层 */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            display: 'flex', pointerEvents: 'none'
          }}>
            {safeOptions.map((opt, i) => (
              <div key={opt.id} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontWeight: 700, fontSize: '0.8rem',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                opacity: (isChecked ? 1 : 0) === i ? 1 : 0.6,
                transition: 'opacity 0.3s ease'
              }}>
                {opt.label}
              </div>
            ))}
          </div>

          {/* 动态玻璃滑块 (Thumb)，z-index 为 2，覆盖在文字上方产生液态透镜效果 */}
          <div
            ref={knobRef}
            style={{
              position: 'absolute', top: '4px', left: 0,
              width: `${THUMB_WIDTH}px`, height: `${THUMB_HEIGHT}px`,
              borderRadius: `${THUMB_RADIUS}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 2,
              transformOrigin: 'center center',
              transform: `translateX(${MARGIN_LEFT}px) scale(${REST_SCALE})`
            }}
          />
        </div>
      </div>
    </LiquidStateProvider>
  );
};

