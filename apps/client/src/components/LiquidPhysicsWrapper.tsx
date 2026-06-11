import React, { useRef, useEffect } from 'react';
import { Spring } from '../utils/spring';

interface LiquidPhysicsWrapperProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  disabled?: boolean;
  title?: string;
}

export const LiquidPhysicsWrapper: React.FC<LiquidPhysicsWrapperProps> = ({
  children,
  style,
  className,
  onClick,
  onPointerDown,
  onPointerUp,
  disabled = false,
  title,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 初始化物理弹簧量：stiffness 刚度，damping 阻尼
  const springs = useRef({
    scale: new Spring(1, 350, 22),
    scaleX: new Spring(1, 400, 20),
    scaleY: new Spring(1, 400, 20),
    rotateX: new Spring(0, 300, 22),
    rotateY: new Spring(0, 300, 22),
    translateY: new Spring(0, 400, 24),
  });

  const state = useRef({
    isHovered: false,
    isPressed: false,
  });

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      // 限制时间片，防止后台挂起恢复后发生弹簧爆炸
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;

      const sp = springs.current;

      // 更新物理模型
      const baseScale = sp.scale.update(dt);
      const sx = sp.scaleX.update(dt);
      const sy = sp.scaleY.update(dt);
      const rx = sp.rotateX.update(dt);
      const ry = sp.rotateY.update(dt);
      const ty = sp.translateY.update(dt);

      if (containerRef.current) {
        // 直接在 style.transform 上修改以求最高效率
        containerRef.current.style.transform = `
          perspective(300px)
          translateY(${ty}px)
          scale(${baseScale * sx}, ${baseScale * sy})
          rotateX(${rx}deg)
          rotateY(${ry}deg)
        `;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePointerEnter = () => {
    if (disabled) return;
    state.current.isHovered = true;
    springs.current.scale.setTarget(1.05); // hover 略微放大
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !state.current.isHovered) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // 计算鼠标距离中心的相对比例 (-1 到 1)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = (x / rect.width) * 2 - 1;
    const dy = (y / rect.height) * 2 - 1;

    // 设定 3D 旋转角度
    const maxRotate = 8; // 最大偏转角度（度）
    springs.current.rotateY.setTarget(dx * maxRotate);
    springs.current.rotateX.setTarget(-dy * maxRotate);
  };

  const handlePointerLeave = () => {
    state.current.isHovered = false;
    state.current.isPressed = false;
    
    // 弹回原样
    springs.current.scale.setTarget(1.0);
    springs.current.scaleX.setTarget(1.0);
    springs.current.scaleY.setTarget(1.0);
    springs.current.rotateX.setTarget(0);
    springs.current.rotateY.setTarget(0);
    springs.current.translateY.setTarget(0);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    state.current.isPressed = true;
    
    // 点击：压缩高度，向左右横展，并向下位移
    springs.current.scaleY.setTarget(0.86);
    springs.current.scaleX.setTarget(1.06);
    springs.current.translateY.setTarget(3);
    
    if (onPointerDown) onPointerDown(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!state.current.isPressed) return;
    state.current.isPressed = false;
    
    // 恢复
    springs.current.scaleY.setTarget(1.0);
    springs.current.scaleX.setTarget(1.0);
    springs.current.translateY.setTarget(0);
    
    if (onPointerUp) onPointerUp(e);
  };

  return (
    <div
      ref={containerRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={onClick}
      className={className}
      title={title}
      style={{
        ...style,
        transformOrigin: 'center center',
        willChange: 'transform',
        touchAction: 'none',
        transition: 'background-color 0.3s, border-color 0.3s, box-shadow 0.3s', // 排除 transform，以防干扰 rAF 物理渲染
      }}
      {...rest}
    >
      {children}
    </div>
  );
};
