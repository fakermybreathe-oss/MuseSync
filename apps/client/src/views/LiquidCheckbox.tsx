import React, { useEffect, useRef } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 液态复选框 — 勾选时 checkmark 路径弹性绘制，外框 OpticsFilter 玻璃质感
// rAF + Spring 直接驱动 SVG strokeDashoffset，禁止 setState 驱动动画
export const LiquidCheckbox: React.FC = () => {
  const filterId = 'checkbox-filter';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={56} height={56} radius={12} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Liquid Checkbox</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          勾选时 checkmark 路径弹性绘制，方框弹簧压缩回弹，完全物理驱动的勾选体验。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '2rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      }}>
        {/* 多个复选框演示 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[
            { label: '使用液态玻璃材质', defaultChecked: true },
            { label: '开启弹簧物理动画', defaultChecked: true },
            { label: '启用折射率计算', defaultChecked: false },
            { label: '显示法线置换贴图', defaultChecked: false },
          ].map((item, i) => (
            <CheckboxItem
              key={i}
              label={item.label}
              defaultChecked={item.defaultChecked}
              filterId={filterId}
            />
          ))}
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};

// 单个复选框子组件
const CheckboxItem: React.FC<{ label: string; defaultChecked: boolean; filterId: string }> = ({
  label, defaultChecked, filterId
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const checkedRef = useRef(defaultChecked);

  const springs = useRef({
    scaleBox: new Spring(defaultChecked ? 1 : 0.85, 600, 32),
    checkProgress: new Spring(defaultChecked ? 1 : 0, 280, 20),
    fillOpacity: new Spring(defaultChecked ? 1 : 0, 300, 22),
    glowR: new Spring(defaultChecked ? 12 : 0, 300, 22),
    bgOpacity: new Spring(defaultChecked ? 0 : 0.8, 250, 20),
  });

  // checkmark path 总长度（近似值）
  const DASH_LENGTH = 38;

  useEffect(() => {
    let rafId: number;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;

      const scaleBox = sp.scaleBox.update(dt);
      const progress = sp.checkProgress.update(dt);
      const fillOp = sp.fillOpacity.update(dt);
      const glowR = sp.glowR.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      if (boxRef.current) {
        boxRef.current.style.transform = `scale(${scaleBox})`;
        boxRef.current.style.boxShadow = `0 0 ${glowR}px rgba(80, 200, 120, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)`;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      if (svgRef.current) {
        const offset = DASH_LENGTH * (1 - progress);
        svgRef.current.style.strokeDashoffset = `${offset}`;
        svgRef.current.style.opacity = `${progress > 0.05 ? 1 : 0}`;
      }

      if (fillRef.current) {
        fillRef.current.style.opacity = `${fillOp}`;
        const s = 0.6 + fillOp * 0.4;
        fillRef.current.style.transform = `scale(${s})`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const toggle = () => {
    checkedRef.current = !checkedRef.current;
    const sp = springs.current;

    // 按下压缩感
    sp.scaleBox.value = 0.7;
    sp.scaleBox.velocity = 0;

    if (checkedRef.current) {
      sp.scaleBox.setTarget(1);
      sp.bgOpacity.setTarget(0);
      sp.checkProgress.setTarget(1);
      sp.fillOpacity.setTarget(1);
      sp.glowR.setTarget(12);
    } else {
      sp.scaleBox.setTarget(0.85);
      sp.bgOpacity.setTarget(0.8);
      sp.checkProgress.setTarget(0);
      sp.fillOpacity.setTarget(0);
      sp.glowR.setTarget(0);
    }
  };

  return (
    <div
      onClick={toggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      {/* 方框 */}
      <div
        ref={boxRef}
        style={{
          width: '56px', height: '56px',
          borderRadius: '12px',
          position: 'relative',
          backdropFilter: `url(#${filterId})`,
          WebkitBackdropFilter: `url(#${filterId})`,
          transformOrigin: 'center',
          flexShrink: 0,
          border: '1.5px solid rgba(255,255,255,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* 背景遮罩层 */}
        <div
          ref={bgRef}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.95)',
            pointerEvents: 'none',
          }}
        />

        {/* 填充色 */}
        <div
          ref={fillRef}
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(50, 200, 100, 0.5) 0%, rgba(80, 220, 140, 0.3) 100%)',
            opacity: defaultChecked ? 1 : 0,
            transformOrigin: 'center',
            borderRadius: '10px',
          }}
        />

        {/* Checkmark SVG */}
        <svg
          viewBox="0 0 56 56"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <path
            ref={svgRef}
            d="M 14 28 L 24 38 L 42 18"
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${DASH_LENGTH}`}
            strokeDashoffset={defaultChecked ? 0 : DASH_LENGTH}
            style={{ transition: 'none' }}
          />
        </svg>
      </div>

      {/* 标签文字 */}
      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '16px', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
};
