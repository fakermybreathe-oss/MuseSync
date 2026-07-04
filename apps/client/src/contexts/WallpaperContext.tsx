import React, { createContext, useContext, useState } from 'react';

export interface Wallpaper {
  id: string;
  name: string;
  url: string;
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'ocean', name: '蔚蓝深海', url: '/ocean-4k.jpg' },
  { id: 'cyberpunk', name: '霓虹都市', url: '/cyberpunk-4k.jpg' },
  { id: 'forest', name: '暮光之森', url: '/forest-4k.jpg' },
  { id: 'sunset', name: '落日余晖', url: '/sunset-4k.jpg' }
];

interface WallpaperContextType {
  currentWallpaper: Wallpaper;
  setWallpaper: (id: string) => void;
  nextWallpaper: () => void;
}

const WallpaperContext = createContext<WallpaperContextType | undefined>(undefined);

export const WallpaperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentWallpaper, setCurrentWallpaper] = useState<Wallpaper>(() => {
    // 优先从 localStorage 恢复用户偏好
    const saved = localStorage.getItem('musesync-wallpaper');
    if (saved) {
      const found = WALLPAPERS.find(w => w.id === saved);
      if (found) return found;
    }
    return WALLPAPERS[0];
  });

  const setWallpaper = (id: string) => {
    const found = WALLPAPERS.find(w => w.id === id);
    if (found) {
      setCurrentWallpaper(found);
      localStorage.setItem('musesync-wallpaper', id);
    }
  };

  const nextWallpaper = () => {
    const currentIndex = WALLPAPERS.findIndex(w => w.id === currentWallpaper.id);
    const nextIndex = (currentIndex + 1) % WALLPAPERS.length;
    const next = WALLPAPERS[nextIndex];
    setCurrentWallpaper(next);
    localStorage.setItem('musesync-wallpaper', next.id);
  };

  return (
    <WallpaperContext.Provider value={{ currentWallpaper, setWallpaper, nextWallpaper }}>
      {children}
    </WallpaperContext.Provider>
  );
};

export const useWallpaper = () => {
  const context = useContext(WallpaperContext);
  if (context === undefined) {
    throw new Error('useWallpaper must be used within a WallpaperProvider');
  }
  return context;
};
