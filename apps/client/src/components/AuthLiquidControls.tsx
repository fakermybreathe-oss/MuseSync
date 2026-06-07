import React, { useEffect, useRef } from 'react';
import { Spring } from '../utils/spring';

type AuthLiquidFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
};

type AuthLiquidButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const AuthLiquidField: React.FC<AuthLiquidFieldProps> = ({
  label,
  onBlur,
  onFocus,
  ...inputProps
}) => {
  const shellRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const borderRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const springs = useRef({
    scaleX: new Spring(1, 360, 26),
    scaleY: new Spring(1, 360, 26),
    translateY: new Spring(0, 360, 26),
    glowOpacity: new Spring(0, 220, 20),
    glowScale: new Spring(0.76, 250, 22),
    borderOpacity: new Spring(0, 250, 22)
  });

  const applyFrame = () => {
    const state = springs.current;

    if (shellRef.current) {
      shellRef.current.style.transform = `translateY(${state.translateY.value}px) scale(${state.scaleX.value}, ${state.scaleY.value})`;
    }

    if (glowRef.current) {
      glowRef.current.style.opacity = `${state.glowOpacity.value}`;
      glowRef.current.style.transform = `scaleX(${state.glowScale.value})`;
    }

    if (borderRef.current) {
      borderRef.current.style.opacity = `${state.borderOpacity.value}`;
    }
  };

  const runAnimation = () => {
    if (reducedMotionRef.current) {
      const state = springs.current;
      Object.values(state).forEach((spring) => {
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
      const state = springs.current;

      Object.values(state).forEach((spring) => spring.update(dt));
      applyFrame();

      if (Object.values(state).every((spring) => spring.isSettled())) {
        animationRef.current = null;
        return;
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const state = springs.current;
    state.scaleX.setTarget(1.004);
    state.scaleY.value = 0.98;
    state.scaleY.velocity = 0;
    state.scaleY.setTarget(1.012);
    state.translateY.setTarget(-1);
    state.glowOpacity.setTarget(1);
    state.glowScale.setTarget(1);
    state.borderOpacity.setTarget(0.76);
    runAnimation();
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const state = springs.current;
    state.scaleX.setTarget(1);
    state.scaleY.setTarget(1);
    state.translateY.setTarget(0);
    state.glowOpacity.setTarget(0);
    state.glowScale.setTarget(0.76);
    state.borderOpacity.setTarget(0);
    runAnimation();
    onBlur?.(event);
  };

  return (
    <label className="auth-field">
      <span className="auth-field__label">{label}</span>
      <span className="auth-field__shell" ref={shellRef}>
        <span className="auth-field__border" ref={borderRef} aria-hidden="true" />
        <span className="auth-field__glow" ref={glowRef} aria-hidden="true" />
        <input
          {...inputProps}
          onBlur={handleBlur}
          onFocus={handleFocus}
        />
      </span>
    </label>
  );
};

export const AuthLiquidButton: React.FC<AuthLiquidButtonProps> = ({
  children,
  className = '',
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
  variant = 'secondary',
  ...buttonProps
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const pressedRef = useRef(false);
  const hoveredRef = useRef(false);
  const springs = useRef({
    scaleX: new Spring(1, 500, 28),
    scaleY: new Spring(1, 500, 28),
    translateY: new Spring(0, 500, 28),
    rippleScale: new Spring(0, 220, 18),
    rippleOpacity: new Spring(0, 220, 18)
  });

  const applyFrame = () => {
    const state = springs.current;

    if (buttonRef.current) {
      buttonRef.current.style.transform = `translateY(${state.translateY.value}px) scale(${state.scaleX.value}, ${state.scaleY.value})`;
    }

    if (rippleRef.current) {
      rippleRef.current.style.transform = `scale(${state.rippleScale.value})`;
      rippleRef.current.style.opacity = `${Math.max(0, state.rippleOpacity.value)}`;
    }
  };

  const runAnimation = () => {
    if (reducedMotionRef.current) {
      const state = springs.current;
      Object.values(state).forEach((spring) => {
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
      const state = springs.current;

      Object.values(state).forEach((spring) => spring.update(dt));
      applyFrame();

      if (Object.values(state).every((spring) => spring.isSettled())) {
        animationRef.current = null;
        return;
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const setRestingTarget = () => {
    const state = springs.current;
    const hoverScale = hoveredRef.current ? 1.008 : 1;
    state.scaleX.setTarget(hoverScale);
    state.scaleY.setTarget(hoverScale);
    state.translateY.setTarget(hoveredRef.current ? -1 : 0);
    state.rippleOpacity.setTarget(0);
    runAnimation();
  };

  const press = () => {
    if (disabled || pressedRef.current) return;
    pressedRef.current = true;
    const state = springs.current;
    state.scaleX.setTarget(1.035);
    state.scaleY.setTarget(0.92);
    state.translateY.setTarget(2);
    state.rippleScale.value = 0.35;
    state.rippleScale.velocity = 0;
    state.rippleScale.setTarget(1.45);
    state.rippleOpacity.value = 0.42;
    state.rippleOpacity.velocity = 0;
    state.rippleOpacity.setTarget(0);
    runAnimation();
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setRestingTarget();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    press();
    onPointerDown?.(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    release();
    onPointerUp?.(event);
  };

  const handlePointerEnter = (event: React.PointerEvent<HTMLButtonElement>) => {
    hoveredRef.current = true;
    if (!pressedRef.current) setRestingTarget();
    onPointerEnter?.(event);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>) => {
    hoveredRef.current = false;
    release();
    if (!pressedRef.current) setRestingTarget();
    onPointerLeave?.(event);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    hoveredRef.current = false;
    release();
    onPointerCancel?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      press();
    }
    onKeyDown?.(event);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      release();
    }
    onKeyUp?.(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    hoveredRef.current = false;
    release();
    setRestingTarget();
    onBlur?.(event);
  };

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      className={`auth-liquid-button ${variant === 'primary' ? 'auth-liquid-button--primary' : ''} ${className}`.trim()}
      disabled={disabled}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
    >
      <span className="auth-liquid-button__ripple" ref={rippleRef} aria-hidden="true" />
      <span className="auth-liquid-button__label">{children}</span>
    </button>
  );
};
