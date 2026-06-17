import React, { useEffect, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { LiquidSwitch } from '../components/LiquidSwitch';
import type { Track, Platform, PlatformAuth, PlaylistFolder } from '../types';

interface PlaylistPanelProps {
  visible: boolean;
  onClose: () => void;
  neteaseFolders: PlaylistFolder[];
  qqFolders: PlaylistFolder[];
  neteaseAuth: PlatformAuth;
  qqAuth: PlatformAuth;
  onSelectTrack: (track: Track) => void;
  activePlatform: Platform;
  onPlatformChange: (p: Platform) => void;
  isLoading?: boolean;
  activeFolderId: string | null;
  folderTracks: Track[];
  onFolderClick: (folder: PlaylistFolder) => void;
  onBackClick: () => void;
  isLoadingTracks?: boolean;
}

const fmtDuration = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const getPanelMetrics = () => {
  if (typeof window === 'undefined') {
    return {
      compact: false,
      width: 380,
      height: 560,
      radius: 24,
      top: 80,
      right: 48,
      left: undefined as number | undefined,
      switchWidth: 300,
      switchHeight: 44,
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const compact = viewportWidth <= 768;

  if (!compact) {
    return {
      compact,
      width: 380,
      height: Math.min(560, Math.max(360, viewportHeight - 180)),
      radius: 24,
      top: 80,
      right: 48,
      left: undefined as number | undefined,
      switchWidth: 300,
      switchHeight: 44,
    };
  }

  const inset = viewportWidth <= 390 ? 12 : 16;
  const top = 140;
  const bottomReserve = 166;
  const width = Math.max(288, viewportWidth - inset * 2);
  const availableHeight = Math.max(260, viewportHeight - top - bottomReserve);
  const height = Math.min(560, availableHeight);

  return {
    compact,
    width,
    height,
    radius: 26,
    top,
    right: inset,
    left: inset,
    switchWidth: Math.max(236, Math.min(300, width - 44)),
    switchHeight: 40,
  };
};

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  visible, onClose, neteaseFolders, qqFolders,
  neteaseAuth, qqAuth, onSelectTrack, activePlatform, onPlatformChange, isLoading,
  activeFolderId, folderTracks, onFolderClick, onBackClick, isLoadingTracks
}) => {
  const panelFilterId = 'playlist-panel-filter';
  const [panelMetrics, setPanelMetrics] = useState(getPanelMetrics);
  const folders = activePlatform === 'netease' ? neteaseFolders : qqFolders;
  const isLoggedIn = activePlatform === 'netease' ? neteaseAuth.loggedIn : qqAuth.loggedIn;
  const emptyStateHeight = panelMetrics.compact ? 220 : 300;

  useEffect(() => {
    const syncPanelMetrics = () => setPanelMetrics(getPanelMetrics());
    syncPanelMetrics();
    window.addEventListener('resize', syncPanelMetrics);
    return () => window.removeEventListener('resize', syncPanelMetrics);
  }, []);

  return (
    <>
      {/* 背景遮罩 */}
      {visible && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'var(--ms-glass-bg)',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* 悬浮面板：独立的液态玻璃框，位于右侧 switch 下方 */}
      <div className="playlist-panel-frame" style={{
        position: 'fixed',
        top: `${panelMetrics.top}px`,
        right: `${panelMetrics.right}px`,
        ...(panelMetrics.left !== undefined ? { left: `${panelMetrics.left}px` } : {}),
        width: `${panelMetrics.width}px`,
        height: `${panelMetrics.height}px`,
        maxHeight: panelMetrics.compact ? `${panelMetrics.height}px` : 'calc(100vh - 180px)',
        zIndex: 201,
        transform: visible ? 'translateY(0) scale(1)' : `translateY(${panelMetrics.compact ? '-10px' : '-20px'}) scale(${panelMetrics.compact ? 0.98 : 1})`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
      }}>
        <OpticsFilter id={panelFilterId} width={panelMetrics.width} height={panelMetrics.height} radius={panelMetrics.radius} />

        <div style={{
          width: '100%', height: '100%',
          backdropFilter: `url(#${panelFilterId})`,
          WebkitBackdropFilter: `url(#${panelFilterId})`,
          background: 'var(--ms-surface-dark)',
          border: '1px solid var(--ms-glass-border)',
          borderRadius: `${panelMetrics.radius}px`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 1px var(--ms-glass-highlight)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 头部 */}
          <div style={{
            padding: panelMetrics.compact ? '16px 18px' : '24px',
            borderBottom: '1px solid var(--ms-glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {activeFolderId && (
                <button onClick={onBackClick} style={{
                  background: 'transparent', border: 'none', color: 'var(--ms-text-primary)',
                  cursor: 'pointer', fontSize: '1.4rem', padding: '0 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px'
                }}>
                  ‹
                </button>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {activeFolderId ? '歌单内容' : '收藏歌单'}
              </h3>
            </div>
            <button className="playlist-panel-close" onClick={onClose} style={{
              background: 'var(--ms-glass-bg-light)', border: '1px solid var(--ms-glass-border)',
              borderRadius: '50%', width: '32px', height: '32px',
              color: 'var(--ms-text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontFamily: 'inherit',
            }}>
              ✕
            </button>
          </div>

          {/* 平台切换 Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: panelMetrics.compact ? '12px 16px' : '16px 24px' }}>
            <LiquidSwitch
              id="playlist-platform"
              options={[
                { id: 'netease', label: '网易云音乐' },
                { id: 'qq', label: 'QQ音乐' }
              ]}
              activeId={activePlatform}
              onChange={(id) => onPlatformChange(id as Platform)}
              width={panelMetrics.switchWidth}
              height={panelMetrics.switchHeight}
              radius={panelMetrics.switchHeight / 2}
            />
          </div>

          {/* 列表区域 (开启 GPU 加速隔离，并加入强力 key 重建机制以斩断一切幽灵 DOM 驻留) */}
          <div
            key={`${activePlatform}-${activeFolderId || 'root'}`}
            className="lyrics-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: panelMetrics.compact ? '0 16px 18px' : '0 24px 24px',
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          >
            {!isLoggedIn ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: `${emptyStateHeight}px`, gap: '12px',
              }}>
                <div style={{ fontSize: '2rem', opacity: 0.3 }}>🔒</div>
                <p style={{ color: 'var(--ms-text-muted)', fontSize: '0.9rem' }}>请先登录{activePlatform === 'netease' ? '网易云' : 'QQ音乐'}</p>
              </div>
            ) : activeFolderId ? (
              /* ================== 二级目录 (歌曲列表) ================== */
              isLoadingTracks ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: `${emptyStateHeight}px`, gap: '12px',
                }}>
                  <div style={{ fontSize: '2rem', opacity: 0.6, animation: 'spin 1s linear infinite' }}>🌀</div>
                  <p style={{ color: 'var(--ms-text-muted)', fontSize: '0.9rem' }}>正在获取歌曲...</p>
                </div>
              ) : folderTracks.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ms-text-secondary)', fontSize: '0.85rem' }}>
                  歌单内暂无歌曲或加载失败
                </div>
              ) : (
                folderTracks.map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => onSelectTrack(track)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ms-glass-bg-light)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--ms-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {track.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ms-text-secondary)' }}>
                        {track.artist}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ms-text-muted)', flexShrink: 0 }}>
                      {fmtDuration(track.duration)}
                    </span>
                  </div>
                ))
              )
            ) : (
              /* ================== 一级目录 (文件夹列表) ================== */
              isLoading ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: `${emptyStateHeight}px`, gap: '12px',
                }}>
                  <div style={{ fontSize: '2rem', opacity: 0.6, animation: 'spin 1s linear infinite' }}>🌀</div>
                  <p style={{ color: 'var(--ms-text-muted)', fontSize: '0.9rem' }}>正在同步您的歌单...</p>
                </div>
              ) : folders.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ms-text-secondary)', fontSize: '0.85rem' }}>
                  您在当前平台没有收藏歌单，或获取失败
                </div>
              ) : (
                folders.map((folder, idx) => (
                  <div
                    key={`${folder.id}-${idx}`}
                    onClick={() => onFolderClick(folder)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ms-glass-bg-light)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <img
                      src={folder.coverUrl}
                      referrerPolicy="no-referrer"
                      style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.9rem', fontWeight: 600, color: 'var(--ms-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {folder.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ms-text-secondary)', marginTop: '4px' }}>
                        共 {folder.trackCount} 首
                      </div>
                    </div>
                    <span style={{ fontSize: '1.4rem', color: 'var(--ms-text-muted)', opacity: 0.5, flexShrink: 0, paddingRight: '8px' }}>
                      ›
                    </span>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
};
