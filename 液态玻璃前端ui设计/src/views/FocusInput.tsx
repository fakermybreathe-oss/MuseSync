import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 聚焦输入框 — focus 时玻璃边框高光弹入，OpticsFilter 输入框质感
// rAF + Spring 直接驱动 DOM ref，禁止 setState 驱动动画
export const FocusInput: React.FC = () => {
  const filterId = 'input-filter';
  const [inputValue, setInputValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [searchValue, setSearchValue] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={480} height={56} radius={16} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Focus Input</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          聚焦时玻璃高光边框弹簧扩散，输入框整体 OpticsFilter 材质，光标位置同步液态光晕。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1030 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 背景光效 */}
        <div style={{
          position: 'absolute', width: '500px', height: '300px',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse, rgba(120,80,255,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <LiquidInput
          filterId={filterId}
          placeholder="Email address"
          value={inputValue}
          onChange={setInputValue}
          icon="✉️"
          type="email"
          accentColor="#6366f1"
        />

        <LiquidInput
          filterId={filterId}
          placeholder="Password"
          value={passwordValue}
          onChange={setPasswordValue}
          icon="🔒"
          type="password"
          accentColor="#8b5cf6"
        />

        <LiquidInput
          filterId={filterId}
          placeholder="Search anything..."
          value={searchValue}
          onChange={setSearchValue}
          icon="🔍"
          type="text"
          accentColor="#06b6d4"
        />
      </div>

      <ParameterPanel />
    </div>
  );
};

// 单个液态输入框子组件
const LiquidInput: React.FC<{
  filterId: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon: string;
  type: string;
  accentColor: string;
}> = ({ filterId, placeholder, value, onChange, icon, type, accentColor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  const springs = useRef({
    glowOpacity: new Spring(0, 200, 18),
    glowScale: new Spring(0.9, 250, 22),
    borderOpacity: new Spring(0.08, 250, 22),
    scaleY: new Spring(1, 400, 28),
    scale: new Spring(0.95, 300, 22),
    bgOpacity: new Spring(0.8, 250, 20),
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

      const glowOp = sp.glowOpacity.update(dt);
      const glowS = sp.glowScale.update(dt);
      const borderOp = sp.borderOpacity.update(dt);
      const sy = sp.scaleY.update(dt);
      const baseScale = sp.scale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      if (glowRef.current) {
        glowRef.current.style.opacity = `${glowOp}`;
        glowRef.current.style.transform = `translateX(-50%) scaleX(${glowS})`;
      }

      if (borderRef.current) {
        borderRef.current.style.opacity = `${borderOp}`;
      }

      if (containerRef.current) {
        containerRef.current.style.transform = `scale(${baseScale}) scaleY(${sy})`;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleFocus = () => {
    isFocused.current = true;
    const sp = springs.current;
    sp.glowOpacity.setTarget(1);
    sp.glowScale.setTarget(1);
    sp.borderOpacity.setTarget(0.8);
    // 轻微弹入感
    sp.scaleY.value = 0.97;
    sp.scaleY.velocity = 0;
    sp.scaleY.setTarget(1);
    sp.scale.setTarget(1);
    sp.bgOpacity.setTarget(0);
  };

  const handleBlur = () => {
    isFocused.current = false;
    const sp = springs.current;
    sp.glowOpacity.setTarget(0);
    sp.glowScale.setTarget(0.9);
    sp.borderOpacity.setTarget(0.08);
    sp.scale.setTarget(0.95);
    sp.bgOpacity.setTarget(0.8);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '480px',
        transformOrigin: 'center center',
      }}
    >
      {/* 底部 glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          bottom: '-8px', left: '50%',
          width: '80%', height: '20px',
          background: `radial-gradient(ellipse, ${accentColor}88 0%, transparent 70%)`,
          filter: 'blur(8px)',
          pointerEvents: 'none',
          opacity: 0,
          transform: 'translateX(-50%) scaleX(0.9)',
        }}
      />

      {/* 动态边框高光 */}
      <div
        ref={borderRef}
        style={{
          position: 'absolute', inset: '-1px',
          borderRadius: '17px',
          background: `linear-gradient(135deg, ${accentColor} 0%, transparent 50%, ${accentColor} 100%)`,
          opacity: 0.08,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* 输入框背景（OpticsFilter） */}
      <div
        style={{
          position: 'relative',
          width: '480px', height: '56px',
          borderRadius: '16px',
          backdropFilter: `url(#${filterId})`,
          WebkitBackdropFilter: `url(#${filterId})`,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        {/* 背景遮罩层 */}
        <div
          ref={bgRef}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.9)',
            pointerEvents: 'none',
          }}
        />

        {/* 图标 */}
        <span style={{ paddingLeft: '18px', fontSize: '18px', flexShrink: 0, position: 'relative', zIndex: 1 }}>{icon}</span>

        {/* 原生 input（透明背景，内嵌于玻璃层） */}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none', outline: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '15px',
            padding: '0 16px',
            caretColor: accentColor,
            position: 'relative', zIndex: 1,
          }}
        />

        {/* 右侧状态指示 */}
        {value && (
          <div style={{
            width: '8px', height: '8px',
            borderRadius: '50%',
            background: accentColor,
            marginRight: '18px',
            flexShrink: 0,
            boxShadow: `0 0 8px ${accentColor}`,
          }} />
        )}
      </div>
    </div>
  );
};
