import React, { useEffect, useRef } from 'react';
import { Spring } from '../utils/spring';

type ElasticProfile = 'button' | 'input';

const useElasticMotion = <T extends HTMLElement>(profile: ElasticProfile) => {
  const ref = useRef<T | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const pressedRef = useRef(false);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const springs = useRef({
    scaleX: new Spring(1, profile === 'button' ? 520 : 420, 29),
    scaleY: new Spring(1, profile === 'button' ? 520 : 420, 29),
    translateY: new Spring(0, 460, 28),
    rotate: new Spring(0, 240, 24)
  });

  const applyFrame = () => {
    if (!ref.current) return;
    const state = springs.current;
    ref.current.style.transform = [
      `translateY(${state.translateY.value}px)`,
      `rotate(${state.rotate.value}deg)`,
      `scale(${state.scaleX.value}, ${state.scaleY.value})`
    ].join(' ');
  };

  const runAnimation = () => {
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

  const settle = () => {
    const state = springs.current;
    const elevated = hoveredRef.current || focusedRef.current;
    state.scaleX.setTarget(elevated ? 1.006 : 1);
    state.scaleY.setTarget(elevated ? 1.006 : 1);
    state.translateY.setTarget(elevated ? -1 : 0);
    state.rotate.setTarget(0);
    runAnimation();
  };

  const press = (clientX?: number) => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    const state = springs.current;
    state.scaleX.setTarget(profile === 'button' ? 1.036 : 1.018);
    state.scaleY.setTarget(profile === 'button' ? 0.92 : 0.965);
    state.translateY.setTarget(2);
    if (clientX !== undefined && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const x = (clientX - rect.left) / Math.max(rect.width, 1);
      state.rotate.setTarget((x - 0.5) * 1.2);
    }
    runAnimation();
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    settle();
  };

  return {
    ref,
    enter: () => {
      hoveredRef.current = true;
      if (!pressedRef.current) settle();
    },
    leave: () => {
      hoveredRef.current = false;
      release();
      settle();
    },
    focus: () => {
      focusedRef.current = true;
      settle();
    },
    blur: () => {
      focusedRef.current = false;
      release();
      settle();
    },
    press,
    release
  };
};

export const ElasticGlassInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  onBlur,
  onFocus,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  ...props
}) => {
  const {
    ref,
    blur,
    enter,
    focus,
    leave,
    press,
    release
  } = useElasticMotion<HTMLInputElement>('input');

  return (
    <input
      {...props}
      ref={ref}
      onBlur={(event) => {
        blur();
        onBlur?.(event);
      }}
      onFocus={(event) => {
        focus();
        onFocus?.(event);
      }}
      onPointerCancel={(event) => {
        leave();
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        press(event.clientX);
        onPointerDown?.(event);
      }}
      onPointerEnter={(event) => {
        enter();
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        leave();
        onPointerLeave?.(event);
      }}
      onPointerUp={(event) => {
        release();
        onPointerUp?.(event);
      }}
    />
  );
};

export const ElasticGlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  disabled,
  onBlur,
  onFocus,
  onKeyDown,
  onKeyUp,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  ...props
}) => {
  const {
    ref,
    blur,
    enter,
    focus,
    leave,
    press,
    release
  } = useElasticMotion<HTMLButtonElement>('button');

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled}
      onBlur={(event) => {
        blur();
        onBlur?.(event);
      }}
      onFocus={(event) => {
        focus();
        onFocus?.(event);
      }}
      onKeyDown={(event) => {
        if (!disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) press();
        onKeyDown?.(event);
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') release();
        onKeyUp?.(event);
      }}
      onPointerCancel={(event) => {
        leave();
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        if (!disabled) press(event.clientX);
        onPointerDown?.(event);
      }}
      onPointerEnter={(event) => {
        if (!disabled) enter();
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        leave();
        onPointerLeave?.(event);
      }}
      onPointerUp={(event) => {
        release();
        onPointerUp?.(event);
      }}
    />
  );
};
