import React from 'react';
import { LiquidStateProvider } from './components/LiquidStateContext';
import { MuseSyncPlayer } from './views/MuseSyncPlayer';
import { LyricSyncPreview } from './views/LyricSyncPreview';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AuthPage } from './views/AuthPage';
import { OpticsFilter } from './components/OpticsFilter';

import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const getRoute = () => {
  const hash = window.location.hash.replace('#', '') || '/app';
  return hash.split('?')[0];
};

const AppRoutes: React.FC = () => {
  const [route, setRoute] = React.useState(getRoute);
  const isLyricDemo = new URLSearchParams(window.location.search).get('lyrics-demo') === '1';
  const { user, signOut } = useAuth();

  React.useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const content = route === '/login'
    ? <AuthPage />
    : (
      <ProtectedRoute>
        {route === '/lyrics' || isLyricDemo ? <LyricSyncPreview /> : <MuseSyncPlayer />}
      </ProtectedRoute>
    );

  return (
    <LiquidStateProvider>
      {user && route !== '/login' && (
        <div className="session-signout-container">
          <LiquidStateProvider
            initialState={{
              surfaceType: 'convex_squircle',
              bezelWidth: 12,
              glassThickness: 118,
              specularOpacity: 0.5,
              specularSaturation: 1,
              refractionLevel: 0.58,
              blurLevel: 0,
            }}
          >
            <OpticsFilter id="app-signout" width={88} height={36} radius={18} />
            <button type="button" onClick={signOut} className="session-signout">
              <span className="session-signout__highlight" />
              <span className="session-signout__label">退出登录</span>
            </button>
          </LiquidStateProvider>
        </div>
      )}
      {content}
    </LiquidStateProvider>
  );
};


export default App;
