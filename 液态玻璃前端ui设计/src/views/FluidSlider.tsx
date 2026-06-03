import React, { useEffect, useRef, useState } from 'react';
import { useLiquidState } from '../components/LiquidStateContext';
import { ParameterPanel } from '../components/ParameterPanel';
import { OpticsFilter } from '../components/OpticsFilter';
import { Spring } from '../utils/spring';

/* ──────────────────────────────────────────────────────────
 * 常量定义 —— 与原始参考设计完全对齐
 * ────────────────────────────────────────────────────────── */
const TRACK_WIDTH = 330;          // 轨道宽度
const TRACK_HEIGHT = 14;          // 轨道高度
const THUMB_WIDTH = 90;           // 滑块宽度
const THUMB_HEIGHT = 60;          // 滑块高度
const THUMB_RADIUS = 30;          // 滑块圆角
const SCALE_REST = 0.6;           // 静止时缩放比例
const SCALE_ACTIVE = 1.0;         // 按压/拖拽时缩放比例
const REFRACTION_REST = 0.4;      // 静止时折射率系数
const REFRACTION_ACTIVE = 0.9;    // 按压时折射率系数

/* 考虑 scale 缩放后的可见宽度与位置范围 */
const THUMB_WIDTH_REST = THUMB_WIDTH * SCALE_REST;  // 54px
const X0 = THUMB_WIDTH_REST / 2;                     // 最左侧 x 坐标（27px）
const X100 = TRACK_WIDTH - THUMB_WIDTH_REST / 2;     // 最右侧 x 坐标（303px）
const TRAVEL = X100 - X0;                            // 有效滑动距离

export const FluidSlider: React.FC = () => {
  const filterId = "fluid-slider-filter";
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackFillRef = useRef<HTMLDivElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);

  const [value, setValue] = useState(50);
  const [forceActive, setForceActive] = useState(false);

  /* 交互状态 —— 使用 ref 避免高频渲染 */
  const state = useRef({
    isDragging: false,
    forceActive: false,
    dragOffset: 0,
    velocityX: 0,
    lastX: 0,
    lastTime: 0,
  });

  /* 弹簧系统 —— 所有动画参数由弹簧驱动 */
  const springs = useRef({
    /** 滑块 x 中心坐标 */
    x: new Spring(X0 + TRAVEL * 0.5, 300, 20),
    /** 统一缩放比例：静止 0.6 → 按压 1.0 */
    scale: new Spring(SCALE_REST, 400, 30),
    /** 背景不透明度：静止 1.0（纯白）→ 按压 0.1（近透明，显示玻璃效果） */
    backgroundOpacity: new Spring(1.0, 300, 25),
    /** 折射率增强系数：静止 0.4 → 按压 0.9 */
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
        sp.scale.setTarget(SCALE_ACTIVE);
        sp.backgroundOpacity.setTarget(0.1);
        sp.scaleRatio.setTarget(REFRACTION_ACTIVE);
      } else {
        sp.scale.setTarget(SCALE_REST);
        sp.backgroundOpacity.setTarget(1.0);
        sp.scaleRatio.setTarget(REFRACTION_REST);
      }

      /* 更新所有弹簧 */
      const x = s.isDragging ? sp.x.value : sp.x.update(dt);
      const scale = sp.scale.update(dt);
      const bgOpacity = sp.backgroundOpacity.update(dt);
      const scaleRatio = sp.scaleRatio.update(dt);

      /* 通过 DOM ref 直接更新样式 —— 避免 React 重渲染 */
      if (thumbRef.current) {
        thumbRef.current.style.left = `${x - THUMB_WIDTH / 2}px`;
        thumbRef.current.style.transform = `scale(${scale})`;
        thumbRef.current.style.backgroundColor =
          `rgba(255, 255, 255, ${bgOpacity})`;
      }

      /* 更新轨道填充进度 */
      if (trackFillRef.current) {
        const ratio = Math.max(0, Math.min(1, (x - X0) / TRAVEL));
        trackFillRef.current.style.width = `${ratio * 100}%`;
      }

      /* 动态更新 SVG feDisplacementMap 的 scale 属性（折射率增强） */
      const feDisplacementMap = document.getElementById(`${filterId}-displacementMap`);
      if (feDisplacementMap) {
        const baseScale = parseFloat(
          feDisplacementMap.getAttribute('data-base-scale') || '0'
        );
        feDisplacementMap.setAttribute(
          'scale',
          String(baseScale * scaleRatio)
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

    const parentRect = thumbRef.current!.parentElement!.getBoundingClientRect();
    const thumbRect = thumbRef.current!.getBoundingClientRect();

    /* dragOffset：指针相对于 thumb 可见中心的偏移 */
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

    const parentRect = thumbRef.current!.parentElement!.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - s.dragOffset;

    /* 限制在有效范围内 */
    newX = Math.max(X0, Math.min(X100, newX));

    springs.current.x.value = newX;
    springs.current.x.velocity = 0;

    /* 用 ref 方式更新 React state 以供外部读取 */
    const ratio = (newX - X0) / TRAVEL;
    setValue(Math.round(ratio * 100));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = state.current;
    s.isDragging = false;
    e.currentTarget.style.cursor = 'grab';
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: '100%', maxWidth: '800px', margin: '0 auto'
    }}>
      {/* SVG 光学滤镜 —— 使用 OpticsFilter 组件 */}
      <OpticsFilter id={filterId} width={THUMB_WIDTH} height={THUMB_HEIGHT} radius={THUMB_RADIUS} />

      {/* 标题区域 */}
      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>
          Fluid Slider
        </h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          液态玻璃滑块 —— 拖拽时 thumb 放大并变透明，松开后缩小恢复，折射率随交互状态动态调整。
        </p>
      </div>

      {/* 展示区域 */}
      <div style={{
        width: '100%', height: '500px',
        background: '#0d2746',
        backgroundImage: 'radial-gradient(circle at 50% 50%, #0d2746 0%, #050b14 100%)',
        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        position: 'relative', overflow: 'hidden'
      }}>

        {/* 数值指示 */}
        <div style={{
          position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.6)', fontSize: '1.2rem', fontWeight: 600,
          fontVariantNumeric: 'tabular-nums'
        }}>
          {value}%
        </div>

        {/* 滑块容器 */}
        <div style={{ position: 'relative', width: `${TRACK_WIDTH}px`, height: `${THUMB_HEIGHT}px` }}>

          {/* 轨道 */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: (THUMB_HEIGHT - TRACK_HEIGHT) / 2,
            width: `${TRACK_WIDTH}px`,
            height: `${TRACK_HEIGHT}px`,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '100px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            {/* 轨道填充 */}
            <div
              ref={trackFillRef}
              style={{
                height: '100%',
                width: `${value}%`,
                borderRadius: '100px',
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
              }}
            />
          </div>

          {/* 液态玻璃滑块 Thumb */}
          <div
            ref={thumbRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              top: 0,
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
              transform: `scale(${SCALE_REST})`
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
