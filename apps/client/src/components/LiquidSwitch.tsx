import React, { useEffect, useMemo, useRef } from 'react';
import { Spring } from '../utils/spring';
import { LiquidStateProvider } from './LiquidStateContext';
import { OpticsFilter } from './OpticsFilter';

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
  id,
  options,
  activeId,
  onChange,
  width,
  height,
  radius,
}) => {
  const filterId = useMemo(() => `switch-filter-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`, [id]);
  const safeOptions = useMemo(() => {
    if (options.length >= 2) return options;
    return [
      options[0] || { id: 'opt1', label: '1' },
      options[1] || { id: 'opt2', label: '2' },
    ];
  }, [options]);

  const isChecked = safeOptions.findIndex((option) => option.id === activeId) === 1;
  const trackWidth = width;
  const trackRadius = radius ?? height / 2;
  const thumbWidth = width / 2 - 4;
  const thumbHeight = height - 8;
  const thumbRadius = Math.max(4, trackRadius - 4);
  const travel = trackWidth - thumbWidth - 8;
  const marginLeft = 4;
  const ariaLabel = safeOptions.map((option) => option.label).join(' / ');

  const knobRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const state = useRef({
    isDragging: false,
    dragStartX: 0,
    dragStartRatio: isChecked ? 1 : 0,
    xDragRatio: isChecked ? 1 : 0,
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
      springs.current.xRatio.setTarget(isChecked ? 1 : 0);
      springs.current.trackColorT.setTarget(isChecked ? 1 : 0);
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

      const currentState = state.current;
      const currentSprings = springs.current;
      const isActive = currentState.isDragging;

      currentSprings.scale.setTarget(isActive ? ACTIVE_SCALE : REST_SCALE);
      currentSprings.backgroundOpacity.setTarget(isActive ? 0.05 : 0.15);
      currentSprings.opticsScaleRatio.setTarget(isActive ? REFRACTION_ACTIVE : REFRACTION_REST);

      const xRatio = currentState.isDragging
        ? currentSprings.xRatio.value
        : currentSprings.xRatio.update(dt);
      const scaleX = currentSprings.scaleX.update(dt);
      const scaleY = currentSprings.scaleY.update(dt);
      const baseScale = currentSprings.scale.update(dt);
      const backgroundOpacity = currentSprings.backgroundOpacity.update(dt);
      const trackColor = currentSprings.trackColorT.update(dt);
      const opticsScaleRatio = currentSprings.opticsScaleRatio.update(dt);
      const clampedRatio = Math.max(0, Math.min(1, xRatio));
      const thumbX = marginLeft + clampedRatio * travel;

      if (knobRef.current) {
        knobRef.current.style.transform =
          `translateX(${thumbX}px) scale(${scaleX * baseScale}, ${scaleY * baseScale})`;
        knobRef.current.style.backgroundColor = `rgba(255, 255, 255, ${backgroundOpacity})`;
      }

      if (trackRef.current) {
        trackRef.current.style.backgroundColor = lerpColor(TRACK_COLOR_OFF, TRACK_COLOR_ON, trackColor);
      }

      const displacementMap = document.getElementById(`${filterId}-displacementMap`);
      if (displacementMap) {
        const baseScale = parseFloat(displacementMap.getAttribute('data-base-scale') || '0');
        displacementMap.setAttribute('scale', String(baseScale * opticsScaleRatio));
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [filterId, marginLeft, travel]);

  const commitChecked = (newChecked: boolean) => {
    const targetOption = safeOptions[newChecked ? 1 : 0];
    springs.current.xRatio.setTarget(newChecked ? 1 : 0);
    springs.current.trackColorT.setTarget(newChecked ? 1 : 0);

    if (targetOption.id !== activeId) {
      onChange(targetOption.id);
    }
  };

  const releasePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);

    const currentState = state.current;
    currentState.isDragging = true;
    currentState.committed = false;
    currentState.dragStartX = e.clientX;
    currentState.dragStartRatio = springs.current.xRatio.value;
    currentState.xDragRatio = springs.current.xRatio.value;
    currentState.lastX = e.clientX;
    currentState.lastTime = performance.now();
    currentState.velocityX = 0;

    springs.current.scaleX.setTarget(0.92);
    springs.current.scaleY.setTarget(1.08);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const currentState = state.current;
    if (!currentState.isDragging) return;

    const now = performance.now();
    const dtMs = Math.max(1, now - currentState.lastTime);
    currentState.velocityX = (e.clientX - currentState.lastX) / (dtMs / 1000);
    currentState.lastX = e.clientX;
    currentState.lastTime = now;

    const dx = e.clientX - currentState.dragStartX;
    if (Math.abs(dx) > 3) currentState.committed = true;

    const rawRatio = currentState.dragStartRatio + dx / travel;
    const dampedRatio = dampedOverflow(rawRatio, 0, 1);
    currentState.xDragRatio = dampedRatio;
    springs.current.xRatio.value = dampedRatio;
    springs.current.xRatio.velocity = 0;
    springs.current.trackColorT.value = Math.max(0, Math.min(1, dampedRatio));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const currentState = state.current;
    if (!currentState.isDragging) return;

    currentState.isDragging = false;
    releasePointer(e);

    springs.current.scaleX.setTarget(1);
    springs.current.scaleY.setTarget(1);

    const newChecked = currentState.committed ? currentState.xDragRatio > 0.5 : !isChecked;
    const direction = currentState.velocityX > 0 ? 1 : -1;
    springs.current.scaleX.value = 1 + direction * 0.2;
    springs.current.scaleY.value = 0.8;

    commitChecked(newChecked);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    state.current.isDragging = false;
    releasePointer(e);
    springs.current.scaleX.setTarget(1);
    springs.current.scaleY.setTarget(1);
    springs.current.xRatio.setTarget(isChecked ? 1 : 0);
    springs.current.trackColorT.setTarget(isChecked ? 1 : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();

    if (e.key === 'ArrowLeft') {
      commitChecked(false);
      return;
    }

    if (e.key === 'ArrowRight') {
      commitChecked(true);
      return;
    }

    commitChecked(!isChecked);
  };

  return (
    <LiquidStateProvider
      initialState={{
        bezelWidth: 12,
        glassThickness: 118,
        specularOpacity: 0.5,
        specularSaturation: 1.0,
        refractionLevel: 0.58,
        blurLevel: 0,
      }}
    >
      <div
        data-switch-id={id}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          userSelect: 'none',
          position: 'relative',
        }}
      >
        <OpticsFilter
          id={filterId}
          width={thumbWidth}
          height={thumbHeight}
          radius={thumbRadius}
          surfaceType="convex_squircle"
        />

        <div
          ref={trackRef}
          role="switch"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-checked={isChecked}
          aria-valuetext={safeOptions[isChecked ? 1 : 0]?.label}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: `${trackRadius}px`,
            backgroundColor: lerpColor(TRACK_COLOR_OFF, TRACK_COLOR_ON, isChecked ? 1 : 0),
            boxShadow:
              'inset 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)',
            position: 'relative',
            cursor: 'pointer',
            display: 'flex',
            touchAction: 'none',
            outline: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              display: 'flex',
              pointerEvents: 'none',
            }}
          >
            {safeOptions.map((option, index) => (
              <div
                key={option.id}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 10px',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: option.label.length > 6 ? '0.72rem' : '0.8rem',
                  lineHeight: 1,
                  letterSpacing: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  opacity: (isChecked ? 1 : 0) === index ? 1 : 0.6,
                  transition: 'opacity 220ms ease',
                }}
              >
                {option.label}
              </div>
            ))}
          </div>

          <div
            ref={knobRef}
            data-liquid-glass-thumb
            style={{
              position: 'absolute',
              top: '4px',
              left: 0,
              width: `${thumbWidth}px`,
              height: `${thumbHeight}px`,
              borderRadius: `${thumbRadius}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              boxShadow:
                'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 2,
              cursor: 'pointer',
              touchAction: 'none',
              transformOrigin: 'center center',
              transform: `translateX(${marginLeft + (isChecked ? travel : 0)}px) scale(${REST_SCALE})`,
              willChange: 'transform, background-color',
            }}
          />
        </div>
      </div>
    </LiquidStateProvider>
  );
};
