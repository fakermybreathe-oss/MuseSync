import React, { useRef } from 'react';
import { gsap } from 'gsap';

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
  const borderRef = useRef<HTMLSpanElement>(null);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const isReduced = prefersReducedMotion();
    const dur = isReduced ? 0 : 0.22;

    // 聚焦微挤压果冻形变效果，改用更具高品位阻尼的 power3.out
    if (!isReduced) {
      gsap.fromTo(shellRef.current,
        { scaleY: 0.97, translateY: 0 },
        { scaleY: 1.01, scaleX: 1.002, translateY: -0.5, duration: dur, ease: 'power3.out' }
      );
    } else {
      gsap.to(shellRef.current, { scaleX: 1.002, scaleY: 1.01, translateY: -0.5, duration: 0 });
    }

    gsap.to(borderRef.current, { opacity: 0.76, duration: dur, ease: 'power3.out' });

    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const isReduced = prefersReducedMotion();
    const dur = isReduced ? 0 : 0.22;

    gsap.to(shellRef.current, { scaleX: 1, scaleY: 1, translateY: 0, duration: dur, ease: 'power3.out' });
    gsap.to(borderRef.current, { opacity: 0, duration: dur, ease: 'power3.out' });

    onBlur?.(event);
  };

  return (
    <label className="auth-field">
      <span className="auth-field__label">{label}</span>
      <span className="auth-field__shell" ref={shellRef}>
        <span className="auth-field__border" ref={borderRef} aria-hidden="true" />
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
  const hoveredRef = useRef(false);
  const pressedRef = useRef(false);

  const setRestingTarget = () => {
    const isReduced = prefersReducedMotion();
    const dur = isReduced ? 0 : 0.28;
    const hoverScale = hoveredRef.current ? 1.006 : 1;

    gsap.to(buttonRef.current, {
      scaleX: hoverScale,
      scaleY: hoverScale,
      translateY: hoveredRef.current ? -0.8 : 0,
      duration: dur,
      ease: 'back.out(1.2)' // 升级为沉稳、极具重力感的阻尼回弹
    });
  };

  const press = (clientX?: number, clientY?: number) => {
    if (disabled || pressedRef.current) return;
    pressedRef.current = true;

    const isReduced = prefersReducedMotion();
    const dur = isReduced ? 0 : 0.12;

    // 挤压形变，略微减小形变幅度，使回弹过渡更显沉稳
    gsap.to(buttonRef.current, {
      scaleX: 1.025,
      scaleY: 0.94,
      translateY: 1.2,
      duration: dur,
      ease: 'power2.out'
    });

    // 动态生成基于指针点击位置的高级涟漪
    if (buttonRef.current && !isReduced) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = clientX !== undefined ? clientX - rect.left : rect.width / 2;
      const y = clientY !== undefined ? clientY - rect.top : rect.height / 2;

      const ripple = document.createElement('span');
      ripple.className = 'auth-button-ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      buttonRef.current.appendChild(ripple);

      gsap.fromTo(ripple,
        { scale: 0, opacity: 0.35 }, // 调低初始涟漪对比度
        {
          scale: 2.8, // 减小最大扩散尺度，使其更具内敛美
          opacity: 0,
          duration: 0.55, // 稍慢的优雅淡出
          ease: 'power3.out',
          onComplete: () => ripple.remove()
        }
      );
    }
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setRestingTarget();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    press(event.clientX, event.clientY);
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
      style={{
        ...buttonProps.style,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <span className="auth-liquid-button__label">{children}</span>
    </button>
  );
};
