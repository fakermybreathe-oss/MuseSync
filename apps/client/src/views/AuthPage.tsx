import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LiquidGlassPanel } from '../components/LiquidGlassPanel';
import { AuthLiquidButton, AuthLiquidField } from '../components/AuthLiquidControls';
import {
  SIGNUP_CONFIRMATION_MESSAGE,
  toChineseAuthMessage
} from '../auth/authMessages';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

type AuthMessage = {
  text: string;
  tone: 'info' | 'success' | 'error';
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const AuthPage: React.FC = () => {
  const {
    user,
    authCallbackMessage,
    clearAuthCallbackMessage,
    isConfigured,
    signInWithPassword,
    signUpWithPassword,
    sendMagicLink
  } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<AuthMessage | null>(() => (
    authCallbackMessage
      ? { text: authCallbackMessage, tone: 'error' }
      : null
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const quickToRefs = useRef<{
    xTo: gsap.QuickToFunc | null;
    yTo: gsap.QuickToFunc | null;
  }>({ xTo: null, yTo: null });

  // 1. 全局与背景动画挂载
  useGSAP(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 背景流光极光泡无限游动
    if (!isReduced) {
      const blobs = ['.auth-aurora-blob--1', '.auth-aurora-blob--2', '.auth-aurora-blob--3', '.auth-aurora-blob--4'];
      blobs.forEach((blob, i) => {
        gsap.to(blob, {
          x: () => `random(${-80 - i * 15}, ${80 + i * 15})`,
          y: () => `random(${-80 - i * 15}, ${80 + i * 15})`,
          scale: () => `random(0.85, 1.25)`,
          duration: () => `random(${12 + i * 3}, ${18 + i * 4})`,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          repeatRefresh: true
        });
      });

      // 晶莹液态水球气泡不规则浮沉、微幅偏摆动效
      const bubbles = ['.auth-glass-bubble--1', '.auth-glass-bubble--2', '.auth-glass-bubble--3', '.auth-glass-bubble--4'];
      bubbles.forEach((bubble, i) => {
        gsap.to(bubble, {
          y: () => `random(${-25 - i * 5}, ${25 + i * 5})`,
          x: () => `random(${-20 - i * 5}, ${20 + i * 5})`,
          scale: () => `random(0.92, 1.08)`,
          duration: () => `random(${7 + i * 2}, ${11 + i * 2})`,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          repeatRefresh: true
        });
      });
    }

    // 2. 卡片与表单控件交错进场
    const dur = isReduced ? 0 : 0.85;
    const staggerDur = isReduced ? 0 : 0.06;

    // 卡片本身淡入
    gsap.fromTo(cardRef.current,
      { autoAlpha: 0, y: isReduced ? 0 : 45, scale: isReduced ? 1 : 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: dur, ease: 'power3.out' }
    );

    // 卡片内控件 Stagger 进场
    const cardContentSelectors = [
      '.auth-kicker',
      '#auth-title',
      '.auth-panel p',
      '.auth-alert',
      '.auth-form > *',
      '.auth-actions',
      '.auth-message'
    ];

    if (!isReduced) {
      gsap.fromTo(cardContentSelectors,
        { autoAlpha: 0, y: 15, scaleY: 1.08 },
        {
          autoAlpha: 1,
          y: 0,
          scaleY: 1,
          duration: 0.6,
          stagger: staggerDur,
          ease: 'power2.out',
          delay: 0.15
        }
      );
    } else {
      gsap.to(cardContentSelectors, { autoAlpha: 1, y: 0, scaleY: 1, duration: 0 });
    }

    // 3. 初始化 3D 卡片视差倾斜 quickTo 动画通道
    if (cardRef.current) {
      quickToRefs.current.xTo = gsap.quickTo(cardRef.current, 'rotationY', { duration: 0.4, ease: 'power2.out' });
      quickToRefs.current.yTo = gsap.quickTo(cardRef.current, 'rotationX', { duration: 0.4, ease: 'power2.out' });
    }
  }, { scope: containerRef });

  useEffect(() => {
    if (user) {
      window.location.hash = '#/app';
    }
  }, [user]);

  useEffect(() => {
    if (authCallbackMessage) {
      clearAuthCallbackMessage();
    }
  }, [authCallbackMessage, clearAuthCallbackMessage]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setMessage({ text: '请先输入邮箱', tone: 'error' });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setMessage({ text: '邮箱格式不正确', tone: 'error' });
      return;
    }

    if (password.length < 6) {
      setMessage({ text: '密码至少需要 6 位', tone: 'error' });
      return;
    }

    setIsSubmitting(true);
    const error = mode === 'signin'
      ? await signInWithPassword(normalizedEmail, password)
      : await signUpWithPassword(normalizedEmail, password);
    setIsSubmitting(false);

    if (error) {
      setMessage({ text: toChineseAuthMessage(error), tone: 'error' });
      return;
    }

    setMessage({
      text: mode === 'signin' ? '登录成功，正在进入同频舱' : SIGNUP_CONFIRMATION_MESSAGE,
      tone: 'success'
    });
  };

  const handleMagicLink = async () => {
    setMessage(null);
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setMessage({ text: '请先输入邮箱', tone: 'error' });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setMessage({ text: '邮箱格式不正确', tone: 'error' });
      return;
    }

    setIsSubmitting(true);
    const error = await sendMagicLink(normalizedEmail);
    setIsSubmitting(false);
    setMessage({
      text: error ? toChineseAuthMessage(error) : '邮箱登录链接已发送，请检查收件箱',
      tone: error ? 'error' : 'success'
    });
  };

  // 3D 卡片倾斜与高光流体指针跟随
  const handlePanelPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.style.setProperty('--auth-pointer-x', `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty('--auth-pointer-y', `${y.toFixed(2)}%`);

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const relX = event.clientX - rect.left - rect.width / 2;
    const relY = event.clientY - rect.top - rect.height / 2;
    const rotX = -(relY / (rect.height / 2)) * 6; // 最大纵向倾斜 6 度
    const rotY = (relX / (rect.width / 2)) * 6;   // 最大横向倾斜 6 度

    quickToRefs.current.xTo?.(rotY);
    quickToRefs.current.yTo?.(rotX);
  };

  const handlePanelPointerLeave = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.removeProperty('--auth-pointer-x');
    event.currentTarget.style.removeProperty('--auth-pointer-y');

    // 旋转归位
    quickToRefs.current.xTo?.(0);
    quickToRefs.current.yTo?.(0);
  };

  return (
    <main className="auth-shell" ref={containerRef}>
      {/* 极光动效背景层 */}
      <div className="auth-background-aurora" aria-hidden="true">
        <div className="auth-aurora-blob auth-aurora-blob--1" />
        <div className="auth-aurora-blob auth-aurora-blob--2" />
        <div className="auth-aurora-blob auth-aurora-blob--3" />
        <div className="auth-aurora-blob auth-aurora-blob--4" />

        {/* 晶莹液态水球气泡 */}
        <div className="auth-glass-bubble auth-glass-bubble--1" />
        <div className="auth-glass-bubble auth-glass-bubble--2" />
        <div className="auth-glass-bubble auth-glass-bubble--3" />
        <div className="auth-glass-bubble auth-glass-bubble--4" />
      </div>

      <LiquidGlassPanel
        id="auth-liquid-panel"
        className="auth-panel"
        ref={cardRef as any}
        width={460}
        height={520}
        radius={28}
        aria-labelledby="auth-title"
        interactive={false} // 关闭内置的物理弹簧以使用更流畅的 GSAP quickTo 视差
        onPointerMove={handlePanelPointerMove}
        onPointerLeave={handlePanelPointerLeave}
        style={{
          visibility: 'hidden', // 配合 GSAP autoAlpha 防止入场前闪烁
          transformStyle: 'preserve-3d',
          willChange: 'transform'
        }}
      >
        <div className="auth-kicker">MuseSync 账号</div>
        <h1 id="auth-title">{mode === 'signin' ? '登录你的同频舱' : '创建你的同频舱账号'}</h1>
        <p>注册后会保存你的昵称和头像，下次登录可以直接继续创建或加入房间。</p>

        {!isConfigured && (
          <div className="auth-alert">
            Supabase 环境变量缺失。请先在 apps/client/.env.local 配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <AuthLiquidField
            label="邮箱"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!isConfigured || isSubmitting}
            placeholder="输入你的邮箱"
            required
          />

          <AuthLiquidField
            label="密码"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!isConfigured || isSubmitting}
            placeholder="至少 6 位密码"
            required
          />

          <AuthLiquidButton
            variant="primary"
            type="submit"
            disabled={!isConfigured || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? '处理中...' : mode === 'signin' ? '登录' : '创建账号'}
          </AuthLiquidButton>
        </form>

        <div className="auth-actions">
          <AuthLiquidButton type="button" onClick={handleMagicLink} disabled={!isConfigured || isSubmitting}>
            发送邮箱登录链接
          </AuthLiquidButton>
          <AuthLiquidButton
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setMessage(null);
            }}
            disabled={isSubmitting}
          >
            {mode === 'signin' ? '注册新账号' : '使用已有账号'}
          </AuthLiquidButton>
        </div>

        {message && (
          <div className={`auth-message is-${message.tone}`} role="status" aria-live="polite">
            {message.text}
          </div>
        )}
      </LiquidGlassPanel>
    </main>
  );
};
