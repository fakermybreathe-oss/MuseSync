import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { LiquidGlassPanel } from '../components/LiquidGlassPanel';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isConfigured } = useAuth();

  useEffect(() => {
    if (!isLoading && isConfigured && !user && window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
  }, [isConfigured, isLoading, user]);

  if (isLoading) {
    return (
      <main className="auth-shell">
        <LiquidGlassPanel id="route-loading-panel" className="auth-panel auth-panel--compact" width={420} height={220} radius={24}>
          <div className="auth-kicker">MuseSync</div>
          <h1>正在恢复登录状态</h1>
        </LiquidGlassPanel>
      </main>
    );
  }

  if (!isConfigured) {
    return (
      <main className="auth-shell">
        <LiquidGlassPanel id="route-config-panel" className="auth-panel auth-panel--compact" width={460} height={260} radius={24}>
          <div className="auth-kicker">需要配置</div>
          <h1>Supabase 尚未连接</h1>
          <p>请在 apps/client/.env.local 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。</p>
        </LiquidGlassPanel>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
