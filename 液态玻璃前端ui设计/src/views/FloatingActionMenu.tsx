import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { ParameterPanel } from '../components/ParameterPanel';
import { Spring } from '../utils/spring';

// 浮动操作菜单 — 点击展开，子按钮 staggered 弹出，OpticsFilter 玻璃质感
// rAF + Spring 驱动 DOM ref，禁止 setState 驱动动画
const MENU_ITEMS = [
  { icon: '✏️', label: 'Edit', color: '#818cf8' },
  { icon: '📤', label: 'Share', color: '#34d399' },
  { icon: '⭐', label: 'Star', color: '#f59e0b' },
  { icon: '🗑️', label: 'Delete', color: '#ef4444' },
];

export const FloatingActionMenu: React.FC = () => {
  const filterId = 'fab-filter';
  const mainBtnRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mainBgRef = useRef<HTMLDivElement>(null);
  const itemBgRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);

  const mainSprings = useRef({
    rotation: new Spring(0, 300, 24),
    scale: new Spring(0.9, 400, 28),
    bgOpacity: new Spring(0.8, 250, 20),
  });

  const itemSprings = useRef(
    MENU_ITEMS.map((_, i) => ({
      y: new Spring(0, 350 - i * 20, 26),
      scale: new Spring(0, 380 - i * 20, 26),
      opacity: new Spring(0, 280, 22),
      bgOpacity: new Spring(0.8, 280, 22),
    }))
  );

  const overlaySp = useRef(new Spring(0, 250, 20));

  useEffect(() => {
    let rafId: number;

    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;
      const sp = mainSprings.current;

      // 主按钮
      const rot = sp.rotation.update(dt);
      const mainScale = sp.scale.update(dt);
      const mainBgOp = sp.bgOpacity.update(dt);
      if (mainBtnRef.current) {
        mainBtnRef.current.style.transform = `rotate(${rot}deg) scale(${mainScale})`;
      }
      if (mainBgRef.current) {
        mainBgRef.current.style.opacity = `${mainBgOp}`;
      }

      // 子菜单项（staggered）
      itemSprings.current.forEach((isp, i) => {
        const y = isp.y.update(dt);
        const scale = isp.scale.update(dt);
        const opacity = isp.opacity.update(dt);
        const bgOp = isp.bgOpacity.update(dt);

        if (itemRefs.current[i]) {
          itemRefs.current[i]!.style.transform = `translateY(${y}px) scale(${Math.max(0, scale)})`;
          itemRefs.current[i]!.style.opacity = `${Math.max(0, opacity)}`;
          itemRefs.current[i]!.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
        }
        if (itemBgRefs.current[i]) {
          itemBgRefs.current[i]!.style.opacity = `${bgOp}`;
        }
        if (labelRefs.current[i]) {
          labelRefs.current[i]!.style.opacity = `${Math.max(0, opacity)}`;
          labelRefs.current[i]!.style.transform = `translateX(${(1 - opacity) * 12}px)`;
        }
      });

      // 背景蒙层
      const overlayOp = overlaySp.current.update(dt);
      if (overlayRef.current) {
        overlayRef.current.style.opacity = `${Math.max(0, overlayOp)}`;
        overlayRef.current.style.pointerEvents = overlayOp > 0.1 ? 'auto' : 'none';
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const toggle = () => {
    const opening = !isOpenRef.current;
    isOpenRef.current = opening;
    setIsOpen(opening);

    const sp = mainSprings.current;
    sp.rotation.setTarget(opening ? 45 : 0);
    sp.scale.value = 0.8;
    sp.scale.velocity = 0;
    sp.scale.setTarget(opening ? 1 : 0.9);
    sp.bgOpacity.setTarget(opening ? 0 : 0.8);

    overlaySp.current.setTarget(opening ? 0.5 : 0);

    // 子菜单 staggered 动画
    const ITEM_GAP = 72; // px between items
    MENU_ITEMS.forEach((_, i) => {
      const isp = itemSprings.current[i];
      const delay = opening ? i : MENU_ITEMS.length - 1 - i;

      setTimeout(() => {
        if (opening) {
          isp.y.setTarget(-(i + 1) * ITEM_GAP);
          isp.scale.setTarget(1);
          isp.opacity.setTarget(1);
          isp.bgOpacity.setTarget(0);
        } else {
          isp.y.setTarget(0);
          isp.scale.setTarget(0);
          isp.opacity.setTarget(0);
          isp.bgOpacity.setTarget(0.8);
        }
      }, delay * 40);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id={filterId} width={64} height={64} radius={32} />

      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Floating Action Menu</h1>
        <p style={{ color: '#555', maxWidth: '700px', fontSize: '1rem', lineHeight: 1.6 }}>
          点击展开，子按钮 staggered 弹出，主按钮旋转 45°，全部弹簧驱动，OpticsFilter 玻璃质感。
        </p>
      </div>

      <div style={{
        width: '100%', height: '500px',
        background: 'linear-gradient(160deg, #0d1117 0%, #161b22 100%)',
        borderRadius: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }} />

        {/* 示例内容卡片 */}
        <div style={{
          width: '60%', height: '60%',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.2)', fontSize: '14px',
        }}>
          Content area — click FAB to open menu
        </div>

        {/* 蒙层 */}
        <div
          ref={overlayRef}
          onClick={toggle}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            opacity: 0,
            pointerEvents: 'none',
            borderRadius: '16px',
          }}
        />

        {/* FAB 区域（右下角） */}
        <div style={{
          position: 'absolute', bottom: '32px', right: '32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* 子按钮列表 */}
          {MENU_ITEMS.map((item, i) => (
            <div key={i} style={{ position: 'absolute', bottom: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* 标签 */}
              <div
                ref={el => { labelRefs.current[i] = el; }}
                style={{
                  background: 'rgba(20,20,30,0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '13px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: 0,
                }}
              >
                {item.label}
              </div>

              {/* 子按钮 */}
              <div
                ref={el => { itemRefs.current[i] = el; }}
                style={{
                  width: '52px', height: '52px',
                  borderRadius: '50%',
                  backdropFilter: `url(#${filterId})`,
                  WebkitBackdropFilter: `url(#${filterId})`,
                  border: `1px solid ${item.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px',
                  cursor: 'pointer',
                  transform: 'translateY(0px) scale(0)',
                  opacity: 0,
                  transformOrigin: 'center bottom',
                  boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 20px ${item.color}22`,
                  overflow: 'hidden',
                }}
              >
                {/* 背景遮罩层 */}
                <div
                  ref={el => { itemBgRefs.current[i] = el; }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(255,255,255,0.9)',
                    pointerEvents: 'none',
                  }}
                />
                <span style={{ position: 'relative', zIndex: 1 }}>{item.icon}</span>
              </div>
            </div>
          ))}

          {/* 主按钮 */}
          <div
            ref={mainBtnRef}
            onClick={toggle}
            style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              border: `1px solid ${isOpen ? 'rgba(255,100,100,0.4)' : 'rgba(120,80,255,0.4)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transformOrigin: 'center',
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 30px ${isOpen ? 'rgba(255,80,80,0.2)' : 'rgba(120,80,255,0.2)'}`,
              fontSize: '28px',
              zIndex: 10,
              overflow: 'hidden',
            }}
          >
            {/* 背景遮罩层 */}
            <div
              ref={mainBgRef}
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

      <ParameterPanel />
    </div>
  );
};
