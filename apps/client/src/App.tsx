import React from 'react';
import { LiquidStateProvider } from './components/LiquidStateContext';
import { MuseSyncPlayer } from './views/MuseSyncPlayer';
import { LyricSyncPreview } from './views/LyricSyncPreview';

function App() {
  const isLyricDemo = new URLSearchParams(window.location.search).get('lyrics-demo') === '1';

  return (
    <LiquidStateProvider>
      {isLyricDemo ? <LyricSyncPreview /> : <MuseSyncPlayer />}
    </LiquidStateProvider>
  );
}

export default App;
