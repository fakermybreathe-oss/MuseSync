import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LiquidGlassPanel } from '../components/LiquidGlassPanel';
import { AuthLiquidButton, AuthLiquidField } from '../components/AuthLiquidControls';
import {
  SIGNUP_CONFIRMATION_MESSAGE,
  toChineseAuthMessage
} from '../auth/authMessages';

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

  const handlePanelPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.style.setProperty('--auth-pointer-x', `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty('--auth-pointer-y', `${y.toFixed(2)}%`);
  };

  return (
    <main className="auth-shell">
      <LiquidGlassPanel
        id="auth-liquid-panel"
        className="auth-panel"
        width={460}
        height={520}
        radius={28}
        aria-labelledby="auth-title"
        onPointerMove={handlePanelPointerMove}
        onPointerLeave={(event) => {
          event.currentTarget.style.removeProperty('--auth-pointer-x');
          event.currentTarget.style.removeProperty('--auth-pointer-y');
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
            minLength={6}
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
