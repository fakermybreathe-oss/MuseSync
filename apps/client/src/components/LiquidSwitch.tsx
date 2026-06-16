import React, { useEffect, useRef } from 'react';
import { Spring } from '../utils/spring';

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

const TRACK_COLOR_OFF = { r: 20, g: 20, b: 25, a: 0.32 };     // 极透中性暗
const TRACK_COLOR_ON = { r: 217, g: 119, b: 6, a: 0.18 };    // 落日暖琥珀

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
  options, activeId, onChange, width, height, radius
}) => {
  // 确保至少有 2 个选项
  const safeOptions = options.length >= 2 ? options : [
    options[0] || { id: 'opt1', label: '1' },
    options[1] || { id: 'opt2', label: '2' }
  ];
  const isChecked = safeOptions.findIndex(o => o.id === activeId) === 1;

  // 轨道和滑块计算尺寸
  const TRACK_WIDTH = width;
  const TRACK_HEIGHT = height;
  const TRACK_RADIUS = radius ?? height / 2;
  
  const THUMB_WIDTH = (width / 2) - 4; // 两侧间距
  const THUMB_HEIGHT = height - 8;     // 上下间距
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

  // 弹簧系统配置
  const springs = useRef({
    xRatio: new Spring(isChecked ? 1 : 0, 300, 30),
    scale: new Spring(1.0, 320, 26), // 滑块 Z 轴下陷（Sinking）阻尼
    trackColorT: new Spring(isChecked ? 1 : 0, 200, 22),
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

      // 按压/拖拽时滑块 Z 轴凹陷（0.91），松开时反弹回 1.0
      sp.scale.setTarget(s.isDragging ? 0.91 : 1.0);

      const xRatio = s.isDragging ? sp.xRatio.value : sp.xRatio.update(dt);
      const scale = sp.scale.update(dt);
      const trackColorT = sp.trackColorT.update(dt);

      const clampedRatio = Math.max(0, Math.min(1, xRatio));
      const thumbX = MARGIN_LEFT + clampedRatio * TRAVEL;

      if (knobRef.current) {
        // 合并 translateX 和 scale 变换，保证动画物理表现不冲突
        knobRef.current.style.transform = `translateX(${thumbX}px) scale(${scale})`;
      }

      if (trackRef.current) {
        trackRef.current.style.backgroundColor = lerpColor(TRACK_COLOR_OFF, TRACK_COLOR_ON, trackColorT);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [TRAVEL, MARGIN_LEFT]);

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

  return (
    <div style={{
      width: `${width}px`, height: `${height}px`, userSelect: 'none', position: 'relative'
    }}>
      {/* 凹槽背景轨道（Sinking into the canvas 物理凹陷底座） */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '100%', height: '100%',
          borderRadius: `${TRACK_RADIUS}px`,
          backgroundColor: 'rgba(10, 10, 15, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset 0 3px 8px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.05)',
          position: 'relative', cursor: 'pointer',
          display: 'flex', touchAction: 'none',
          overflow: 'hidden'
        }}
      >
        {/* 文字排版层，z-index 为 1 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', pointerEvents: 'none'
        }}>
          {safeOptions.map((opt, i) => (
            <div key={opt.id} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', fontWeight: 800, fontSize: '0.75rem',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.05em',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              opacity: (isChecked ? 1 : 0) === i ? 1.0 : 0.45,
              transition: 'opacity 0.22s cubic-bezier(0.25, 1, 0.5, 1)'
            }}>
              {opt.label}
            </div>
          ))}
        </div>

        {/* 弹簧支撑滑块 (Spring-loaded toggle sinking into the canvas)，z-index 为 2 */}
        <div
          ref={knobRef}
          style={{
            position: 'absolute', top: '4px', left: 0,
            width: `${THUMB_WIDTH}px`, height: `${THUMB_HEIGHT}px`,
            borderRadius: `${THUMB_RADIUS}px`,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1.2px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(16px) saturate(110%)',
            WebkitBackdropFilter: 'blur(16px) saturate(110%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1.5px 1px rgba(255, 255, 255, 0.35), inset 0 -1.5px 1.5px rgba(0, 0, 0, 0.15)',
            zIndex: 2,
            transformOrigin: 'center center',
            transform: `translateX(${MARGIN_LEFT}px) scale(1.0)`
          }}
        >
          {/* 反光 Bezel 边缘，折射玻璃侧边细节 */}
          <div style={{
            position: 'absolute', top: '1px', left: '10%', right: '10%', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
            pointerEvents: 'none'
          }} />
        </div>
      </div>
    </div>
  );
};
