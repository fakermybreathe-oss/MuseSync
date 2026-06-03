import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 分段标签 — 滑动指示器用 Spring 横向弹性滑动，OpticsFilter 玻璃效果
// rAF + Spring 直接驱动 DOM ref，禁止 setState 驱动动画
const TABS_DATA = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export const SegmentedTabs: React.FC = () => {
  const filterId = 'seg-tabs-filter';
  const indicatorRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [contentText, setContentText] = useState('日视图数据统计');

  const springs = useRef({
    x: new Spring(0, 350, 28),
    width: new Spring(0, 350, 28),
    scaleX: new Spring(1, 500, 35),
    scaleY: new Spring(1, 500, 35),
    scale: new Spring(0.8, 300, 22),       // 基础缩放
    bgOpacity: new Spring(0.8, 250, 20),   // 遮罩透明度
  });

  const activeIdxRef = useRef(0);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTabMetrics = (idx: number) => {
    const container = tabsContainerRef.current;
    if (!container) return { x: 0, w: 80 };
    const tabs = container.querySelectorAll('[data-tab]');
    const tab = tabs[idx] as HTMLElement;
    if (!tab) return { x: 0, w: 80 };
    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    return {
      x: tabRect.left - containerRect.left,
      w: tabRect.width,
    };
  };

  useEffect(() => {
    let rafId: number;
    let initialized = false;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = springs.current;

      const x = sp.x.update(dt);
      const w = sp.width.update(dt);
      const sx = sp.scaleX.update(dt);
      const sy = sp.scaleY.update(dt);
      const baseScale = sp.scale.update(dt);
      const bgOp = sp.bgOpacity.update(dt);

      if (indicatorRef.current) {
        indicatorRef.current.style.transform =
          `translateX(${x}px) scale(${sx * baseScale}, ${sy * baseScale})`;
        indicatorRef.current.style.width = `${w}px`;
      }
      if (bgRef.current) {
        bgRef.current.style.opacity = `${bgOp}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    // 等待 DOM 渲染完成后初始化
    const initTimer = setTimeout(() => {
      const metrics = getTabMetrics(0);
      const sp = springs.current;
      sp.x.value = metrics.x;
      sp.x.setTarget(metrics.x);
      sp.width.value = metrics.w;
      sp.width.setTarget(metrics.w);
      initialized = true;
    }, 50);

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(initTimer);
      if (moveTimer.current) clearTimeout(moveTimer.current);
    };
  }, []);

  const handleTabClick = (idx: number) => {
    const metrics = getTabMetrics(idx);
    const sp = springs.current;
    const prevMetrics = getTabMetrics(activeIdxRef.current);

    // 根据滑动方向给予 squish
    const dir = idx > activeIdxRef.current ? 1 : -1;
    sp.scaleX.setTarget(1 + dir * 0.08);
    sp.scaleY.setTarget(0.92);

    setTimeout(() => {
      sp.scaleX.setTarget(1);
      sp.scaleY.setTarget(1);
    }, 80);

    sp.x.setTarget(metrics.x);
    sp.width.setTarget(metrics.w);
    
    // 触发玻璃显露状态
    sp.scale.setTarget(1.0);
    sp.bgOpacity.setTarget(0);
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => {
      sp.scale.setTarget(0.8);
      sp.bgOpacity.setTarget(0.8);
    }, 400);

    activeIdxRef.current = idx;
    setActiveIndex(idx);

    const labels = ['日视图数据统计', '周视图汇总报告', '月度趋势分析', '年度绩效总览'];
    setContentText(labels[idx]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={120} height={44} radius={22} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Segmented Tabs</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          切换时指示器通过弹簧物理滑动，速度感与方向感真实模拟液态滑动。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(160deg, #0a0a0a 0%, #1a1020 100%)',
        borderRadius: '16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2.5rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 背景光晕 */}
        <div style={{
          position: 'absolute', width: '400px', height: '200px',
          top: '20%', left: '50%', transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse, rgba(80, 120, 255, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* 分段控件容器 */}
        <div
          ref={tabsContainerRef}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '100px',
            padding: '4px',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* 液态玻璃滑动指示器 */}
          <div
            ref={indicatorRef}
            style={{
              position: 'absolute', top: '4px', left: '0',
              height: 'calc(100% - 8px)',
              borderRadius: '100px',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              zIndex: 1,
              overflow: 'hidden',
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
          </div>

          {/* Tab 按钮 */}
          {TABS_DATA.map((tab, i) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => handleTabClick(i)}
              style={{
                position: 'relative', zIndex: 2,
                padding: '10px 28px',
                background: 'transparent', border: 'none',
                cursor: 'pointer', borderRadius: '100px',
                color: activeIndex === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                fontWeight: activeIndex === i ? 700 : 500,
                fontSize: '14px',
                transition: 'color 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容展示区 */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          padding: '2rem 3rem',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          minWidth: '340px',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
            {TABS_DATA[activeIndex].label.toUpperCase()} VIEW
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '18px', fontWeight: 600 }}>
            {contentText}
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {[85, 62, 91, 78].map((v, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '40px', height: `${v * 0.6}px`,
                  background: `hsl(${200 + i * 40}, 80%, 60%)`,
                  borderRadius: '4px 4px 0 0',
                  marginBottom: '4px',
                }} />
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{v}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ParameterPanel />
    </div>
  );
};
