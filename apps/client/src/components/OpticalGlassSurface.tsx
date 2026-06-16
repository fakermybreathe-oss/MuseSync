import React, { useEffect, useLayoutEffect, useRef, useState, forwardRef } from 'react';
import { OpticsFilter } from './OpticsFilter';
import { Spring } from '../utils/spring';

type OpticalGlassStyle = React.CSSProperties & {
  '--optic-filter': string;
  '--optic-radius': string;
  '--optic-edge-depth': string;
};

type OpticalGlassSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section';
  id: string;
  radius: number;
  edgeDepth?: number;
  fallbackWidth?: number;
  fallbackHeight?: number;
  surfaceType?: string;
  interactive?: boolean;
};

export const OpticalGlassSurface = forwardRef<HTMLElement, OpticalGlassSurfaceProps>(({
  as = 'div',
  id,
  radius,
  edgeDepth = 18,
  fallbackWidth = 320,
  fallbackHeight = 120,
  surfaceType = 'convex_squircle',
  interactive = true,
  className = '',
  children,
  onBlur,
  onFocus,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  style,
  ...elementProps
}, ref) => {
  const localRef = useRef<HTMLElement | null>(null);
  
  // 兼容外部传入的 ref 或者是 React 19 的 ref 属性
  const surfaceRef = (ref || localRef) as React.MutableRefObject<HTMLElement | null>;

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const pressedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const springs = useRef({
    rotateX: new Spring(0, 180, 22),
    rotateY: new Spring(0, 180, 22),
    scaleX: new Spring(1, 420, 28),
    scaleY: new Spring(1, 420, 28),
    translateY: new Spring(0, 420, 28)
  });
  const [size, setSize] = useState({
    width: fallbackWidth,
    height: fallbackHeight
  });

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const updateSize = (width: number, height: number) => {
      const nextWidth = Math.max(1, Math.round(width));
      const nextHeight = Math.max(1, Math.round(height));
      setSize((current) => (
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize(surface.clientWidth, surface.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [surfaceRef]);

  const applyFrame = () => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const state = springs.current;
    surface.style.transform = [
      'perspective(1000px)',
      `translateY(${state.translateY.value}px)`,
      `rotateX(${state.rotateX.value}deg)`,
      `rotateY(${state.rotateY.value}deg)`,
      `scale(${state.scaleX.value}, ${state.scaleY.value})`
    ].join(' ');
  };

  const runAnimation = () => {
    if (!interactive) return;

    if (reducedMotionRef.current) {
      Object.values(springs.current).forEach((spring) => {
        spring.value = spring.target;
        spring.velocity = 0;
      });
      applyFrame();
      return;
    }

    if (animationRef.current !== null) return;
    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(Math.max((time - lastTimeRef.current) / 1000, 1 / 120), 0.032);
      lastTimeRef.current = time;
      Object.values(springs.current).forEach((spring) => spring.update(dt));
      applyFrame();

      if (Object.values(springs.current).every((spring) => spring.isSettled())) {
        animationRef.current = null;
        return;
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const setRestingShape = () => {
    const state = springs.current;
    state.scaleX.setTarget(1);
    state.scaleY.setTarget(1);
    state.translateY.setTarget(0);
    if (!pressedRef.current) {
      state.rotateX.setTarget(0);
      state.rotateY.setTarget(0);
    }
    runAnimation();
  };

  const targetsInteractiveChild = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target;
    return target instanceof Element
      && target !== event.currentTarget
      && Boolean(target.closest('button, input, select, textarea, a, label'));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (interactive && !pressedRef.current && !targetsInteractiveChild(event)) {
      const rect = event.currentTarget.getBoundingClientRect();
      const normalizedX = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const normalizedY = (event.clientY - rect.top) / Math.max(rect.height, 1);
      const state = springs.current;
      state.rotateX.setTarget((0.5 - normalizedY) * 2.2);
      state.rotateY.setTarget((normalizedX - 0.5) * 2.2);
      event.currentTarget.style.setProperty('--optic-pointer-x', `${(normalizedX * 100).toFixed(2)}%`);
      event.currentTarget.style.setProperty('--optic-pointer-y', `${(normalizedY * 100).toFixed(2)}%`);
      runAnimation();
    }
    onPointerMove?.(event);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (interactive && !targetsInteractiveChild(event)) {
      pressedRef.current = true;
      const state = springs.current;
      state.scaleX.setTarget(1.018);
      state.scaleY.setTarget(0.982);
      state.translateY.setTarget(2);
      runAnimation();
    }
    onPointerDown?.(event);
  };

  const release = () => {
    pressedRef.current = false;
    setRestingShape();
  };

  const handlePointerEnter = (event: React.PointerEvent<HTMLElement>) => {
    if (interactive && !pressedRef.current) {
      springs.current.scaleX.setTarget(1.004);
      springs.current.scaleY.setTarget(1.004);
      springs.current.translateY.setTarget(-1);
      runAnimation();
    }
    onPointerEnter?.(event);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLElement>) => {
    release();
    event.currentTarget.style.removeProperty('--optic-pointer-x');
    event.currentTarget.style.removeProperty('--optic-pointer-y');
    onPointerLeave?.(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    release();
    onPointerUp?.(event);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLElement>) => {
    release();
    onPointerCancel?.(event);
  };

  const surfaceStyle: OpticalGlassStyle = {
    '--optic-filter': `url(#${id})`,
    '--optic-radius': `${radius}px`,
    '--optic-edge-depth': `${edgeDepth}px`,
    ...style
  };

  return React.createElement(
    as,
    {
      ...elementProps,
      ref: surfaceRef,
      className: `optical-glass-surface ${className}`.trim(),
      style: surfaceStyle,
      onBlur,
      onFocus,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp
    },
    <>
      <OpticsFilter
        id={id}
        width={size.width}
        height={size.height}
        radius={Math.min(radius, size.width / 2, size.height / 2)}
        surfaceType={surfaceType}
      />
      {children}
    </>
  );
});

OpticalGlassSurface.displayName = 'OpticalGlassSurface';
