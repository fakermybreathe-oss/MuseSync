import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from './OpticsFilter';
import { Spring } from '../utils/spring';
import { LiquidStateProvider } from './LiquidStateContext';

interface FluidInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  width?: number;
  height?: number;
  radius?: number;
}

export const FluidInput: React.FC<FluidInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = '搜索...',
  width = 400,
  height = 48,
  radius = 24,
}) => {
  const filterId = 'fluid-input-optics-filter';
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // 物理弹簧定义：高刚度 (600)、适度阻尼 (28)，用于生成高频、轻微且极速衰减的打字微物理振动
  const springs = useRef({
    scale: new Spring(1, 300, 22),       // 基础缩放弹簧
    scaleY: new Spring(1, 350, 25),      // 纵向按压形变
    vibrationX: new Spring(0, 600, 28),  // 打字横向微震动弹簧
    vibrationY: new Spring(0, 600, 28),  // 打字纵向微震动弹簧
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

      const baseScale = sp.scale.update(dt);
      const sy = sp.scaleY.update(dt);
      const vx = sp.vibrationX.update(dt);
      const vy = sp.vibrationY.update(dt);

      if (containerRef.current) {
        // 合成物理动画矩阵：缩放变形 + 抖动位移
        containerRef.current.style.transform = `scale(${baseScale}) scaleY(${sy}) translate(${vx}px, ${vy}px)`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // 核心交互：打字输入触发微振动 (micro-vibration)
  const triggerVibration = () => {
    const sp = springs.current;
    
    // 随机冲击方向，每次输入赋予一个初始的位移冲击量
    const force = 3.2; // 限制最大微振位移为 3.2px 左右，保证视觉上的灵动且不影响看字
    sp.vibrationX.value = (Math.random() - 0.5) * force;
    sp.vibrationY.value = (Math.random() - 0.5) * force;
    
    // 给弹簧瞬间注入速度冲击，产生衰减振荡效果
    sp.vibrationX.velocity = (Math.random() - 0.5) * 160;
    sp.vibrationY.velocity = (Math.random() - 0.5) * 160;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    triggerVibration();
  };

  const handleFocus = () => {
    setIsFocused(true);
    const sp = springs.current;
    // 聚焦时产生一个向前Q弹收缩感 (Press Down) 并平稳回弹
    sp.scale.setTarget(1.02); // 聚焦时玻璃框稍微放大，突出重点
    sp.scaleY.value = 0.94;    // 轻微物理拍扁
    sp.scaleY.setTarget(1.0);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const sp = springs.current;
    sp.scale.setTarget(1.0);
  };

  return (
    <LiquidStateProvider initialState={{
      surfaceType: 'convex_circle',
      bezelWidth: 7,
      glassThickness: 170,
      refractionLevel: 1.50,
      specularOpacity: 0.57,
      specularSaturation: 1.00, // 恢复饱和度为 1.00，允许背景暖色自然穿透
      blurLevel: 0.0,
    }}>
      <div
        ref={containerRef}
        className="search-input-wrapper"
        style={{
          position: 'relative',
          transformOrigin: 'center center',
        }}
      >
        {/* 电脑端才渲染高精 Optics SVG 滤镜，手机端走常规 blur 以获得极致流畅度 */}
        <div className="desktop-optics-filter">
          <OpticsFilter id={filterId} width={width} height={height} radius={radius} surfaceType="convex_circle" />
        </div>

        <div
          className="search-glass-panel"
          style={{
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
            boxShadow: isFocused 
              ? '0 12px 32px rgba(0,0,0,0.4), 0 0 0 2px rgba(255, 255, 255, 0.45), inset 0 1px 1px var(--ms-glass-highlight)' 
              : undefined, // 不覆盖默认 CSS，让默认磨砂阴影生效
            border: isFocused ? '1px solid rgba(255, 255, 255, 0.45)' : undefined, // 聚焦高亮白晶边，不聚焦时用 CSS border
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              width: '18px',
              height: '18px',
              color: 'var(--ms-text-secondary)',
              marginRight: '10px',
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ms-text-primary)',
              fontSize: '1rem',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
    </LiquidStateProvider>
  );
};
