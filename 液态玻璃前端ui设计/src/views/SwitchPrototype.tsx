import React, { useEffect, useRef, useState } from 'react';
import { useLiquidState } from '../components/LiquidStateContext';
import { ParameterPanel } from '../components/ParameterPanel';
import { OpticsFilter } from '../components/OpticsFilter';
import { Spring } from '../utils/spring';

/* ──────────────────────────────────────────────────────────
 * 常量定义 —— 与原始参考设计完全对齐
 * ────────────────────────────────────────────────────────── */
const TRACK_WIDTH = 160;           // 轨道宽度
const TRACK_HEIGHT = 67;           // 轨道高度
const TRACK_RADIUS = TRACK_HEIGHT / 2; // 轨道圆角（33.5）
const THUMB_WIDTH = 146;           // 滑块宽度
const THUMB_HEIGHT = 92;           // 滑块高度
const THUMB_RADIUS = 46;           // 滑块圆角

const REST_SCALE = 0.65;           // 静止时缩放比例
const ACTIVE_SCALE = 0.9;          // 按压/拖拽时缩放比例
const REFRACTION_REST = 0.4;       // 静止时折射率系数
const REFRACTION_ACTIVE = 0.9;     // 按压时折射率系数

/* scale-aware 的位移偏移量 */
const THUMB_REST_OFFSET = ((1 - REST_SCALE) * THUMB_WIDTH) / 2;

/* 有效滑动距离，考虑了 thumb 缩放后超出轨道的部分 */
const TRAVEL = TRACK_WIDTH - TRACK_HEIGHT - (THUMB_WIDTH - THUMB_HEIGHT) * REST_SCALE;

/* 轨道颜色 —— off/on 状态 RGBA 分量 */
const TRACK_COLOR_OFF = { r: 148, g: 148, b: 159, a: 0.47 };
const TRACK_COLOR_ON = { r: 59, g: 191, b: 78, a: 0.93 };

/** 在两个颜色之间按 t (0~1) 做线性插值 */
function lerpColor(
  c0: typeof TRACK_COLOR_OFF,
  c1: typeof TRACK_COLOR_ON,
  t: number
): string {
  const r = Math.round(c0.r + (c1.r - c0.r) * t);
  const g = Math.round(c0.g + (c1.g - c0.g) * t);
  const b = Math.round(c0.b + (c1.b - c0.b) * t);
  const a = c0.a + (c1.a - c0.a) * t;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/** 阻尼越界效果 —— 超出边界后以 1/22 速率滑动 */
function dampedOverflow(raw: number, min: number, max: number): number {
  if (raw < min) return min + (raw - min) / 22;
  if (raw > max) return max + (raw - max) / 22;
  return raw;
}

export const SwitchPrototype: React.FC = () => {
  const filterId = "switch-filter";
  const knobRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [isOn, setIsOn] = useState(false);
  const [forceActive, setForceActive] = useState(false);

  /* 交互状态 —— 使用 ref 避免高频渲染 */
  const state = useRef({
    isDragging: false,
    forceActive: false,
    dragStartX: 0,       // 按下时指针的 clientX
    dragStartRatio: 0,   // 按下时的 xRatio 值
    velocityX: 0,
    lastX: 0,
    lastTime: 0,
    committed: false,    // 拖拽过程中是否产生了有效位移（区分 click 和 drag）
  });

  /* 弹簧系统 —— 所有动画参数由弹簧驱动 */
  const springs = useRef({
    /** x 比例值：0 = 关闭（左）, 1 = 开启（右） */
    xRatio: new Spring(0, 300, 20),
    /** 统一缩放比例：静止 0.65 → 按压 0.9 */
    scale: new Spring(REST_SCALE, 400, 30),
    /** 背景不透明度：静止 1.0（纯白）→ 按压 0.1（近透明，显示玻璃效果） */
    backgroundOpacity: new Spring(1.0, 300, 25),
    /** 轨道颜色插值：0 = off 色, 1 = on 色 */
    trackColorT: new Spring(0, 200, 20),
    /** 折射率增强系数 */
    scaleRatio: new Spring(REFRACTION_REST, 300, 25),
  });

  /* ── 动画循环 ── */
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

      /* 根据拖拽状态或 forceActive 强制状态设置弹簧目标值 */
      const isActive = s.isDragging || s.forceActive;
      if (isActive) {
        sp.scale.setTarget(ACTIVE_SCALE);
        sp.backgroundOpacity.setTarget(0.1);
        sp.scaleRatio.setTarget(REFRACTION_ACTIVE);
      } else {
        sp.scale.setTarget(REST_SCALE);
        sp.backgroundOpacity.setTarget(1.0);
        sp.scaleRatio.setTarget(REFRACTION_REST);
      }

      /* 更新所有弹簧 */
      const xRatio = s.isDragging ? sp.xRatio.value : sp.xRatio.update(dt);
      const scale = sp.scale.update(dt);
      const bgOpacity = sp.backgroundOpacity.update(dt);
      const trackColorT = sp.trackColorT.update(dt);
      sp.scaleRatio.update(dt);

      /* 从 xRatio 计算实际 x 位置 */
      const clampedRatio = Math.max(0, Math.min(1, xRatio));
      
      const marginLeft = -THUMB_REST_OFFSET + (TRACK_HEIGHT - THUMB_HEIGHT * REST_SCALE) / 2;
      const thumbX = marginLeft + clampedRatio * TRAVEL;

      /* 通过 DOM ref 直接更新样式 —— 避免 React 重渲染 */
      if (knobRef.current) {
        knobRef.current.style.left = `${thumbX}px`;
        knobRef.current.style.transform =
          `translateY(-50%) scale(${scale})`;
        knobRef.current.style.backgroundColor =
          `rgba(255, 255, 255, ${bgOpacity})`;
      }

      /* 动态更新 SVG feDisplacementMap 的 scale 属性 */
      const feDisplacementMap = document.getElementById(`${filterId}-displacementMap`);
      if (feDisplacementMap) {
        const baseScale = parseFloat(
          feDisplacementMap.getAttribute('data-base-scale') || '0'
        );
        feDisplacementMap.setAttribute('scale', String(baseScale * sp.scaleRatio.value));
      }

      /* 更新轨道背景色 —— 在 off/on 颜色之间插值 */
      if (trackRef.current) {
        trackRef.current.style.backgroundColor = lerpColor(
          TRACK_COLOR_OFF,
          TRACK_COLOR_ON,
          trackColorT
        );
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  /* ── 指针事件处理 ── */
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';

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

    /* 计算指针偏移对应的 ratio 变化量 */
    const dx = e.clientX - s.dragStartX;
    if (Math.abs(dx) > 3) s.committed = true;

    const rawRatio = s.dragStartRatio + dx / TRAVEL;

    /* 应用阻尼越界效果 */
    const dampedRatio = dampedOverflow(rawRatio, 0, 1);

    springs.current.xRatio.value = dampedRatio;
    springs.current.xRatio.velocity = 0;

    /* 实时更新轨道颜色弹簧目标 */
    const clampedRatio = Math.max(0, Math.min(1, dampedRatio));
    springs.current.trackColorT.value = clampedRatio;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = state.current;
    s.isDragging = false;
    e.currentTarget.style.cursor = 'grab';
    e.currentTarget.releasePointerCapture(e.pointerId);

    const currentRatio = springs.current.xRatio.value;

    if (!s.committed) {
      /* 没有明显拖拽，视为点击切换 */
      const newOn = !isOn;
      setIsOn(newOn);
      springs.current.xRatio.setTarget(newOn ? 1 : 0);
      springs.current.trackColorT.setTarget(newOn ? 1 : 0);
    } else {
      /* 有拖拽，按最终 ratio 判断开关状态 */
      const newOn = currentRatio > 0.5;
      setIsOn(newOn);
      springs.current.xRatio.setTarget(newOn ? 1 : 0);
      springs.current.trackColorT.setTarget(newOn ? 1 : 0);
    }
  };

  const handleTrackClick = () => {
    if (state.current.isDragging) return;
    const newOn = !isOn;
    setIsOn(newOn);
    springs.current.xRatio.setTarget(newOn ? 1 : 0);
    springs.current.trackColorT.setTarget(newOn ? 1 : 0);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: '100%', maxWidth: '800px', margin: '0 auto'
    }}>
      {/* SVG 光学滤镜 —— 使用 OpticsFilter 组件 */}
      <OpticsFilter id={filterId} width={THUMB_WIDTH} height={THUMB_HEIGHT} radius={THUMB_RADIUS} surfaceType="lip" />

      {/* 标题区域 */}
      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>
          Switch Prototype
        </h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          液态玻璃开关 —— 支持拖拽和点击切换，具有 scale 缩放动画、背景透明度过渡和轨道颜色弹簧插值。
        </p>
      </div>

      {/* 展示区域 */}
      <div style={{
        width: '100%', height: '500px',
        background: '#111',
        backgroundImage: 'radial-gradient(circle at 50% 50%, #333 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        position: 'relative', overflow: 'hidden'
      }}>

        {/* 开关轨道 */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{
            width: `${TRACK_WIDTH}px`,
            height: `${TRACK_HEIGHT}px`,
            borderRadius: `${TRACK_RADIUS}px`,
            backgroundColor: lerpColor(TRACK_COLOR_OFF, TRACK_COLOR_ON, 0),
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.1)',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {/* 液态玻璃开关旋钮 */}
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
              backgroundColor: 'rgba(255, 255, 255, 1)',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              cursor: 'grab',
              touchAction: 'none',
              transformOrigin: 'center center',
              /* 初始 transform —— 会被动画循环覆盖 */
              transform: `translateY(-50%) scale(${REST_SCALE})`
            }}
          />
        </div>

        {/* Force active checkbox */}
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '12px', color: '#888', cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px'
          }}>
            <input 
              type="checkbox" 
              checked={forceActive}
              onChange={(e) => {
                setForceActive(e.target.checked);
                state.current.forceActive = e.target.checked;
              }}
            />
            Force active
          </label>
        </div>

      </div>

      {/* 参数面板 */}
      <ParameterPanel />
    </div>
  );
};
