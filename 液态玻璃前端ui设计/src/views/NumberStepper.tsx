import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 数字步进器 — 按 +/- 时数字弹出动画，两侧按钮 OpticsFilter 玻璃质感
// rAF + Spring 驱动 DOM ref 动画，禁止 setState 驱动高频动画
export const NumberStepper: React.FC = () => {
  const filterId = 'stepper-filter';
  const [displayValue, setDisplayValue] = useState(42);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={64} height={64} radius={32} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Number Stepper</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          按 +/- 时数字通过弹簧弹出切换，按钮按下弹簧压缩，快速连按时累积 squish 形变。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(160deg, #0c0c14 0%, #1a1228 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      }}>
        {/* 主步进器 */}
        <StepperWidget
          filterId={filterId}
          initialValue={42}
          min={0}
          max={999}
          label="数量"
          color="#818cf8"
          large
        />

        {/* 小型变体 */}
        <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-end' }}>
          <StepperWidget filterId={filterId} initialValue={3} min={1} max={10} label="评分" color="#f59e0b" />
          <StepperWidget filterId={filterId} initialValue={16} min={8} max={72} label="字号" color="#34d399" step={2} />
          <StepperWidget filterId={filterId} initialValue={50} min={0} max={100} label="音量" color="#60a5fa" />
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};

// 单个步进器子组件
const StepperWidget: React.FC<{
  filterId: string;
  initialValue: number;
  min: number;
  max: number;
  label: string;
  color: string;
  step?: number;
  large?: boolean;
}> = ({ filterId, initialValue, min, max, label, color, step = 1, large = false }) => {
  const valueRef = useRef(initialValue);
  const numberContainerRef = useRef<HTMLDivElement>(null);
  const currentNumRef = useRef<HTMLDivElement>(null);
  const nextNumRef = useRef<HTMLDivElement>(null);
  const minusBtnRef = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLDivElement>(null);
  const minusBgRef = useRef<HTMLDivElement>(null);
  const plusBgRef = useRef<HTMLDivElement>(null);
  const [displayVal, setDisplayVal] = useState(initialValue);

  const springs = useRef({
    // 数字切换动画
    currentY: new Spring(0, 350, 26),
    nextY: new Spring(60, 350, 26),
    nextOpacity: new Spring(0, 300, 22),
    // 按钮按压
    minusScale: new Spring(0.85, 600, 32),
    plusScale: new Spring(0.85, 600, 32),
    minusBgOpacity: new Spring(0.8, 250, 20),
    plusBgOpacity: new Spring(0.8, 250, 20),
  });

  const isAnimating = useRef(false);

  useEffect(() => {
    let rafId: number;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;

      const cy = sp.currentY.update(dt);
      const ny = sp.nextY.update(dt);
      const nop = sp.nextOpacity.update(dt);
      const ms = sp.minusScale.update(dt);
      const ps = sp.plusScale.update(dt);
      const mBgOp = sp.minusBgOpacity.update(dt);
      const pBgOp = sp.plusBgOpacity.update(dt);

      if (currentNumRef.current) {
        currentNumRef.current.style.transform = `translateY(${cy}px)`;
        currentNumRef.current.style.opacity = `${Math.max(0, 1 - Math.abs(cy) / 60)}`;
      }

      if (nextNumRef.current) {
        nextNumRef.current.style.transform = `translateY(${ny}px)`;
        nextNumRef.current.style.opacity = `${Math.max(0, nop)}`;
      }

      if (minusBtnRef.current) {
        minusBtnRef.current.style.transform = `scale(${ms})`;
      }
      if (plusBtnRef.current) {
        plusBtnRef.current.style.transform = `scale(${ps})`;
      }
      if (minusBgRef.current) {
        minusBgRef.current.style.opacity = `${mBgOp}`;
      }
      if (plusBgRef.current) {
        plusBgRef.current.style.opacity = `${pBgOp}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const animateNumber = (newVal: number, dir: 1 | -1) => {
    if (isAnimating.current) {
      // 快速连按：直接跳到目标
      setDisplayVal(newVal);
      valueRef.current = newVal;
      return;
    }

    const sp = springs.current;
    isAnimating.current = true;

    // 设置 next 为新值的文字
    if (nextNumRef.current) {
      nextNumRef.current.textContent = String(newVal);
    }

    // dir=1(+): 当前向上飞出，新值从下进入
    // dir=-1(-): 当前向下飞出，新值从上进入
    sp.currentY.setTarget(dir * -60);
    sp.nextY.value = dir * 60;
    sp.nextY.velocity = 0;
    sp.nextY.setTarget(0);
    sp.nextOpacity.value = 0;
    sp.nextOpacity.velocity = 0;
    sp.nextOpacity.setTarget(1);

    setTimeout(() => {
      // 切换显示值，重置弹簧
      setDisplayVal(newVal);
      valueRef.current = newVal;
      sp.currentY.value = 0;
      sp.currentY.velocity = 0;
      sp.nextY.value = dir * 60;
      sp.nextOpacity.value = 0;
      isAnimating.current = false;
    }, 350);
  };

  const increment = () => {
    const newVal = Math.min(max, valueRef.current + step);
    if (newVal === valueRef.current) return;
    const sp = springs.current;
    sp.plusScale.value = 0.7;
    sp.plusScale.velocity = 0;
    sp.plusScale.setTarget(1.0);
    sp.plusBgOpacity.setTarget(0);
    
    setTimeout(() => {
      sp.plusScale.setTarget(0.85);
      sp.plusBgOpacity.setTarget(0.8);
    }, 400);

    animateNumber(newVal, 1);
  };

  const decrement = () => {
    const newVal = Math.max(min, valueRef.current - step);
    if (newVal === valueRef.current) return;
    const sp = springs.current;
    sp.minusScale.value = 0.7;
    sp.minusScale.velocity = 0;
    sp.minusScale.setTarget(1.0);
    sp.minusBgOpacity.setTarget(0);

    setTimeout(() => {
      sp.minusScale.setTarget(0.85);
      sp.minusBgOpacity.setTarget(0.8);
    }, 400);

    animateNumber(newVal, -1);
  };

  const size = large ? 64 : 48;
  const fontSize = large ? '3rem' : '1.8rem';
  const padding = large ? '0 20px' : '0 12px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: large ? '16px' : '10px' }}>
        {/* 减号按钮 */}
        <div
          ref={minusBtnRef}
          onClick={decrement}
          style={{
            width: `${size}px`, height: `${size}px`,
            borderRadius: '50%',
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transformOrigin: 'center',
            color: 'rgba(255,255,255,0.7)', fontSize: large ? '24px' : '18px', fontWeight: 300,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          {/* 背景遮罩层 */}
          <div
            ref={minusBgRef}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.9)',
              pointerEvents: 'none',
            }}
          />
          <span style={{ position: 'relative', zIndex: 1 }}>−</span>
        </div>

        {/* 数字显示区域 */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          width: large ? '140px' : '80px',
          height: large ? '80px' : '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* 当前数字 */}
          <div
            ref={currentNumRef}
            style={{
              position: 'absolute',
              color: 'rgba(255,255,255,0.9)',
              fontSize, fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {displayVal}
          </div>

          {/* 下一个数字（动画中） */}
          <div
            ref={nextNumRef}
            style={{
              position: 'absolute',
              color: color,
              fontSize, fontWeight: 700,
              textAlign: 'center',
              opacity: 0,
            }}
          >
            {displayVal}
          </div>
        </div>

        {/* 加号按钮 */}
        <div
          ref={plusBtnRef}
          onClick={increment}
          style={{
            width: `${size}px`, height: `${size}px`,
            borderRadius: '50%',
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
            border: `1px solid ${color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transformOrigin: 'center',
            color: color, fontSize: large ? '24px' : '18px', fontWeight: 300,
            boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 20px ${color}22, inset 0 1px 0 rgba(255,255,255,0.1)`,
            overflow: 'hidden',
          }}
        >
          {/* 背景遮罩层 */}
          <div
            ref={plusBgRef}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.9)',
              pointerEvents: 'none',
            }}
          />
          <span style={{ position: 'relative', zIndex: 1 }}>+</span>
        </div>
      </div>
    </div>
  );
};
