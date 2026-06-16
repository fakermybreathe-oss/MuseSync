import React, { useEffect, useRef } from 'react';
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

  // 轨道与滑块尺寸
  const TRACK_WIDTH = width;
  const TRACK_HEIGHT = height;
  const TRACK_RADIUS = radius ?? height / 2;

  // 自适应推导滑块名义尺寸 (基于 SwitchPrototype 黄金比例，确保 bounds 大于渲染大小)
  const THUMB_HEIGHT = height * 1.373;
  const THUMB_WIDTH = THUMB_HEIGHT * 1.587;
  const THUMB_RADIUS = THUMB_HEIGHT / 2;

  // 缩放比例与折射比率
  const REST_SCALE = 0.78;
  const ACTIVE_SCALE = 0.95;
  const REFRACTION_REST = 0.4;
  const REFRACTION_ACTIVE = 0.9;

  // scale-aware 的位移偏移量和行程
  const THUMB_REST_OFFSET = ((1 - REST_SCALE) * THUMB_WIDTH) / 2;
  const TRAVEL = TRACK_WIDTH - TRACK_HEIGHT - (THUMB_WIDTH - THUMB_HEIGHT) * REST_SCALE;
  const gapY = (TRACK_HEIGHT - THUMB_HEIGHT * REST_SCALE) / 2;
  const marginLeft = -THUMB_REST_OFFSET + gapY;

  const knobRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const state = useRef({
    isDragging: false,
    dragStartX: 0,
    dragStartRatio: 0,
    velocityX: 0,
    lastX: 0,
    lastTime: 0,
    committed: false,
  });

  // 弹簧系统配置
  const springs = useRef({
    xRatio: new Spring(isChecked ? 1 : 0, 300, 25),
    scale: new Spring(REST_SCALE, 350, 28),
    backgroundOpacity: new Spring(0.08, 300, 24), // 静止高透 -> 激活完全纯净高透
    trackColorT: new Spring(isChecked ? 1 : 0, 200, 22),
    opticsScaleRatio: new Spring(REFRACTION_REST, 300, 25),
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
      sp.backgroundOpacity.setTarget(isActive ? 0.02 : 0.08); 
      sp.opticsScaleRatio.setTarget(isActive ? REFRACTION_ACTIVE : REFRACTION_REST);

      const xRatio = s.isDragging ? sp.xRatio.value : sp.xRatio.update(dt);
      const scale = sp.scale.update(dt);
      const bgOpacity = sp.backgroundOpacity.update(dt);
      const trackColorT = sp.trackColorT.update(dt);
      const opticsScaleRatio = sp.opticsScaleRatio.update(dt);

      const clampedRatio = Math.max(0, Math.min(1, xRatio));
      const thumbX = marginLeft + clampedRatio * TRAVEL;

      if (knobRef.current) {
        knobRef.current.style.left = `${thumbX}px`;
        knobRef.current.style.transform = `translateY(-50%) scale(${scale})`;
        knobRef.current.style.backgroundColor = `rgba(255, 255, 255, ${bgOpacity})`;
      }

      if (trackRef.current) {
        trackRef.current.style.backgroundColor = lerpColor(TRACK_COLOR_OFF, TRACK_COLOR_ON, trackColorT);
      }

      const feDisplacementMap = document.getElementById(`${filterId}-displacementMap`);
      if (feDisplacementMap) {
        const baseScale = parseFloat(feDisplacementMap.getAttribute('data-base-scale') || '0');
        feDisplacementMap.setAttribute('scale', String(baseScale * opticsScaleRatio));
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [filterId, TRAVEL, marginLeft]);

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

    const targetIdx = newOn ? 1 : 0;
    if (safeOptions[targetIdx].id !== activeId) {
      onChange(safeOptions[targetIdx].id);
    } else {
      springs.current.xRatio.setTarget(newOn ? 1 : 0);
      springs.current.trackColorT.setTarget(newOn ? 1 : 0);
    }
  };

  const handleTrackClick = () => {
    if (state.current.isDragging) return;
    const newOn = !isChecked;
    const targetIdx = newOn ? 1 : 0;
    onChange(safeOptions[targetIdx].id);
  };

  return (
    <LiquidStateProvider initialState={{
      bezelWidth: 5,
      glassThickness: 86,
      specularOpacity: 0.35,
      specularSaturation: 1.2,
      refractionLevel: 1.15,
      blurLevel: 0.2,
    }}>
      <div style={{
        width: `${width}px`, height: `${height}px`, userSelect: 'none', position: 'relative'
      }}>
        {/* SVG 折光透镜滤镜 */}
        <OpticsFilter id={filterId} width={THUMB_WIDTH} height={THUMB_HEIGHT} radius={THUMB_RADIUS} surfaceType="convex_circle" />

        {/* 凹槽背景轨道（含内部文字） */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{
            width: '100%', height: '100%',
            borderRadius: `${TRACK_RADIUS}px`,
            backgroundColor: 'rgba(0,0,0,0.15)',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35), inset 0 1px 1px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)',
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
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontWeight: 800, fontSize: '0.75rem',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.03em',
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                opacity: (isChecked ? 1 : 0) === i ? 1.0 : 0.45,
                transition: 'opacity 0.22s ease'
              }} key={opt.id}>
                {opt.label}
              </div>
            ))}
          </div>

          {/* 动态玻璃折光滑块 (Thumb) */}
          <div
            ref={knobRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              /* 垂直居中：top 在轨道中央，translateY(-50%) 向上偏移 */
              top: TRACK_HEIGHT / 2,
              left: 0,
              width: `${THUMB_WIDTH}px`,
              height: `${THUMB_HEIGHT}px`,
              borderRadius: `${THUMB_RADIUS}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              cursor: 'grab',
              touchAction: 'none',
              transformOrigin: 'center center',
              /* 初始 transform */
              transform: `translateY(-50%) scale(${REST_SCALE})`,
              zIndex: 2,
              boxShadow: 'inset 0 1px 1.5px rgba(255,255,255,0.45), inset 0 -1px 1px rgba(0,0,0,0.1), 0 6px 16px rgba(0,0,0,0.22)'
            }}
          />
        </div>
      </div>
    </LiquidStateProvider>
  );
};
