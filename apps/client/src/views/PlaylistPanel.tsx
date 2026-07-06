import React, { useCallback, useEffect, useRef, useState } from 'react';
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

interface PanelStateProps {
  icon: string;
  children: React.ReactNode;
  minHeight: number;
  spinning?: boolean;
}

interface LiftPreviewMotion {
  top: number;
  sourceX: number;
  sourceY: number;
  scale: number;
}

const DETAIL_EXIT_MS = 260;
const LIFT_EXIT_MS = 420;

const DEFAULT_LIFT_PREVIEW_MOTION: LiftPreviewMotion = {
  top: 8,
  sourceX: 180,
  sourceY: 30,
  scale: 0.48,
};

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

const staggerStyle = (index: number): React.CSSProperties =>
  ({ '--stagger': `${Math.min(index, 10) * 26}ms` } as React.CSSProperties);

const PanelState: React.FC<PanelStateProps> = ({ icon, children, minHeight, spinning = false }) => (
  <div className="playlist-panel-state" style={{ minHeight }}>
    <div className={`playlist-panel-state__icon${spinning ? ' is-spinning' : ''}`}>{icon}</div>
    <p>{children}</p>
  </div>
);

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  visible, onClose, neteaseFolders, qqFolders,
  neteaseAuth, qqAuth, onSelectTrack, activePlatform, onPlatformChange, isLoading,
  activeFolderId, folderTracks, onFolderClick, onBackClick, isLoadingTracks
}) => {
  const panelFilterId = 'playlist-panel-filter';
  const backTimerRef = useRef<number | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const [panelMetrics, setPanelMetrics] = useState(getPanelMetrics);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [liftedCardId, setLiftedCardId] = useState<string | null>(null);
  const [liftPreviewMotion, setLiftPreviewMotion] = useState<LiftPreviewMotion>(DEFAULT_LIFT_PREVIEW_MOTION);
  const [isLiftPreviewVisible, setIsLiftPreviewVisible] = useState(false);
  const folders = activePlatform === 'netease' ? neteaseFolders : qqFolders;
  const isLoggedIn = activePlatform === 'netease' ? neteaseAuth.loggedIn : qqAuth.loggedIn;
  const emptyStateHeight = panelMetrics.compact ? 220 : 300;
  const activeFolder = activeFolderId ? folders.find(folder => folder.id === activeFolderId) : null;
  const isDetailOpen = Boolean(activeFolderId);
  const activeFolderName = activeFolder?.name || '歌单内容';
  const activeFolderCover = activeFolder?.coverUrl || folderTracks[0]?.coverUrl || '';
  const activeFolderCount = activeFolder?.trackCount ?? folderTracks.length;
  const hasLiftedFolder = liftedCardId?.startsWith('folder-') ?? false;
  const hasLiftedTrack = liftedCardId?.startsWith('track-') ?? false;

  const clearBackTimer = useCallback(() => {
    if (backTimerRef.current !== null) {
      window.clearTimeout(backTimerRef.current);
      backTimerRef.current = null;
    }
  }, []);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
  }, []);

  const clearLiftedCard = useCallback(() => {
    clearPreviewTimer();
    setIsLiftPreviewVisible(false);
    setLiftedCardId(null);
  }, [clearPreviewTimer]);

  const showLiftedCard = useCallback((cardId: string, sourceElement?: HTMLElement) => {
    clearPreviewTimer();
    if (!sourceElement && liftedCardId === cardId) {
      setIsLiftPreviewVisible(true);
      return;
    }

    let nextMotion = DEFAULT_LIFT_PREVIEW_MOTION;
    if (sourceElement) {
      const stage = sourceElement.closest('.playlist-stage') as HTMLElement | null;
      const stageRect = stage?.getBoundingClientRect();
      const sourceRect = sourceElement.getBoundingClientRect();
      if (stageRect) {
        const compact = window.innerWidth <= 768;
        const previewHeight = compact ? 118 : 152;
        const previewLeft = compact ? -72 : -235;
        const previewWidth = Math.min(compact ? 356 : 540, stageRect.width + Math.abs(previewLeft) - 4);
        const sourceCenterY = sourceRect.top - stageRect.top + sourceRect.height / 2;
        const centeredTop = sourceCenterY - previewHeight / 2;
        const maxTop = Math.max(8, stageRect.height - previewHeight - 8);
        const top = Math.min(maxTop, Math.max(8, centeredTop));
        const scaleFromSource = sourceRect.width / previewWidth;
        const clampedScale = Math.max(compact ? 0.64 : 0.52, Math.min(compact ? 0.84 : 0.72, scaleFromSource));
        nextMotion = {
          top,
          sourceX: sourceRect.left - stageRect.left - previewLeft + (sourceRect.width - previewWidth * clampedScale) / 2,
          sourceY: sourceRect.top - stageRect.top - top + (sourceRect.height - previewHeight * clampedScale) / 2,
          scale: clampedScale,
        };
      }
    }
    setLiftPreviewMotion(nextMotion);
    setIsLiftPreviewVisible(false);
    setLiftedCardId(cardId);
    previewFrameRef.current = window.requestAnimationFrame(() => {
      setIsLiftPreviewVisible(true);
      previewFrameRef.current = null;
    });
  }, [clearPreviewTimer, liftedCardId]);

  const keepLiftPreview = useCallback(() => {
    clearPreviewTimer();
    if (liftedCardId) {
      setIsLiftPreviewVisible(true);
    }
  }, [clearPreviewTimer, liftedCardId]);

  const hideLiftedCard = useCallback((cardId: string, delay = 120) => {
    clearPreviewTimer();
    previewTimerRef.current = window.setTimeout(() => {
      setIsLiftPreviewVisible(false);
      previewTimerRef.current = window.setTimeout(() => {
        setLiftedCardId(currentId => currentId === cardId ? null : currentId);
        previewTimerRef.current = null;
      }, LIFT_EXIT_MS);
    }, delay);
  }, [clearPreviewTimer]);

  const holdLiftedCardForTouch = useCallback((cardId: string) => {
    hideLiftedCard(cardId, 900);
  }, [hideLiftedCard]);

  const resetLiftPreviewPointer = useCallback((target: HTMLElement) => {
    target.style.setProperty('--lift-tilt-x', '0deg');
    target.style.setProperty('--lift-tilt-y', '0deg');
    target.style.setProperty('--lift-glint-x', '28%');
    target.style.setProperty('--lift-glint-y', '18%');
  }, []);

  const handleLiftPreviewPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty('--lift-tilt-x', `${(-y * 3.2).toFixed(2)}deg`);
    target.style.setProperty('--lift-tilt-y', `${(x * 4.6).toFixed(2)}deg`);
    target.style.setProperty('--lift-glint-x', `${Math.round((x + 0.5) * 100)}%`);
    target.style.setProperty('--lift-glint-y', `${Math.round((y + 0.5) * 100)}%`);
  }, []);

  const handleLiftPreviewPointerLeave = useCallback((event: React.PointerEvent<HTMLButtonElement>, cardId: string) => {
    resetLiftPreviewPointer(event.currentTarget);
    hideLiftedCard(cardId);
  }, [hideLiftedCard, resetLiftPreviewPointer]);

  useEffect(() => {
    const syncPanelMetrics = () => setPanelMetrics(getPanelMetrics());
    syncPanelMetrics();
    window.addEventListener('resize', syncPanelMetrics);
    return () => window.removeEventListener('resize', syncPanelMetrics);
  }, []);

  useEffect(() => () => {
    clearBackTimer();
    clearPreviewTimer();
  }, [clearBackTimer, clearPreviewTimer]);

  const handleBackClick = useCallback(() => {
    if (!activeFolderId) {
      onBackClick();
      return;
    }

    if (isDetailClosing) return;

    setIsDetailClosing(true);
    clearLiftedCard();
    clearBackTimer();
    backTimerRef.current = window.setTimeout(() => {
      setIsDetailClosing(false);
      backTimerRef.current = null;
      onBackClick();
    }, DETAIL_EXIT_MS);
  }, [activeFolderId, clearBackTimer, clearLiftedCard, isDetailClosing, onBackClick]);

  const handleClose = useCallback(() => {
    clearBackTimer();
    clearLiftedCard();
    setIsDetailClosing(false);
    onClose();
  }, [clearBackTimer, clearLiftedCard, onClose]);

  const handlePlatformChange = useCallback((id: string) => {
    clearBackTimer();
    clearLiftedCard();
    setIsDetailClosing(false);
    onPlatformChange(id as Platform);
  }, [clearBackTimer, clearLiftedCard, onPlatformChange]);

  const handleFolderClick = useCallback((folder: PlaylistFolder) => {
    clearBackTimer();
    clearLiftedCard();
    setIsDetailClosing(false);
    onFolderClick(folder);
  }, [clearBackTimer, clearLiftedCard, onFolderClick]);

  const getLiftHandlers = useCallback((cardId: string) => ({
    onPointerEnter: (event: React.PointerEvent<HTMLButtonElement>) => showLiftedCard(cardId, event.currentTarget),
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => showLiftedCard(cardId, event.currentTarget),
    onPointerLeave: () => hideLiftedCard(cardId),
    onPointerCancel: () => hideLiftedCard(cardId),
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== 'mouse') {
        holdLiftedCardForTouch(cardId);
      }
    },
    onFocus: (event: React.FocusEvent<HTMLButtonElement>) => showLiftedCard(cardId, event.currentTarget),
    onBlur: () => hideLiftedCard(cardId),
  }), [hideLiftedCard, holdLiftedCardForTouch, showLiftedCard]);

  const layerPadding = panelMetrics.compact ? '0 16px 18px' : '0 24px 24px';
  const liftedFolder = hasLiftedFolder
    ? folders.find(folder => `folder-${folder.platform}-${folder.id}` === liftedCardId) ?? null
    : null;
  const liftedTrack = hasLiftedTrack
    ? folderTracks.find((track, idx) => `track-${track.platform}-${track.id}-${idx}` === liftedCardId) ?? null
    : null;
  const liftedPreview = liftedFolder ? {
    id: liftedCardId ?? '',
    kind: 'folder',
    coverUrl: liftedFolder.coverUrl,
    title: liftedFolder.name,
    subtitle: `共 ${liftedFolder.trackCount} 首`,
    kicker: '我的歌单',
    primaryLabel: '播放歌单',
    secondaryLabel: '详情',
  } : liftedTrack ? {
    id: liftedCardId ?? '',
    kind: 'track',
    coverUrl: liftedTrack.coverUrl,
    title: liftedTrack.title,
    subtitle: liftedTrack.artist,
    kicker: '歌曲',
    primaryLabel: '播放歌曲',
    secondaryLabel: fmtDuration(liftedTrack.duration),
  } : null;

  return (
    <>
      {visible && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'var(--ms-glass-bg)',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

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

        <div className="playlist-panel-glass" style={{
          width: '100%', height: '100%',
          backdropFilter: `url(#${panelFilterId})`,
          WebkitBackdropFilter: `url(#${panelFilterId})`,
          background: 'var(--ms-surface-dark)',
          border: '1px solid var(--ms-glass-border)',
          borderRadius: `${panelMetrics.radius}px`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 1px var(--ms-glass-highlight)',
          display: 'flex', flexDirection: 'column',
          overflow: 'visible',
        }}>
          <div className="playlist-panel-header" style={{
            padding: panelMetrics.compact ? '16px 18px' : '24px',
            borderBottom: '1px solid var(--ms-glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              {activeFolderId && (
                <button
                  className="playlist-panel-back"
                  onClick={handleBackClick}
                  type="button"
                  aria-label="返回歌单列表"
                >
                  ‹
                </button>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeFolderId ? activeFolderName : '收藏歌单'}
              </h3>
            </div>
            <button className="playlist-panel-close" onClick={handleClose} type="button" aria-label="关闭歌单面板" style={{
              background: 'var(--ms-glass-bg-light)', border: '1px solid var(--ms-glass-border)',
              borderRadius: '50%', width: '32px', height: '32px',
              color: 'var(--ms-text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontFamily: 'inherit',
            }}>
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: panelMetrics.compact ? '12px 16px' : '16px 24px' }}>
            <LiquidSwitch
              id="playlist-platform"
              options={[
                { id: 'netease', label: '网易云音乐' },
                { id: 'qq', label: 'QQ音乐' }
              ]}
              activeId={activePlatform}
              onChange={handlePlatformChange}
              width={panelMetrics.switchWidth}
              height={panelMetrics.switchHeight}
              radius={panelMetrics.switchHeight / 2}
            />
          </div>

            <div className={`playlist-stage${isDetailOpen ? ' is-detail-open' : ''}${liftedPreview ? ' has-lift-preview' : ''}`}>
            <div
              className="playlist-stage-layer playlist-root-layer lyrics-scroll"
              style={{ padding: layerPadding }}
              aria-hidden={isDetailOpen}
            >
              {!isLoggedIn ? (
                <PanelState icon="🔒" minHeight={emptyStateHeight}>
                  请先登录{activePlatform === 'netease' ? '网易云' : 'QQ音乐'}
                </PanelState>
              ) : isLoading ? (
                <PanelState icon="🌀" minHeight={emptyStateHeight} spinning>
                  正在同步您的歌单...
                </PanelState>
              ) : folders.length === 0 ? (
                <PanelState icon="—" minHeight={emptyStateHeight}>
                  您在当前平台没有收藏歌单，或获取失败
                </PanelState>
              ) : (
                <div className={`playlist-folder-stack${hasLiftedFolder ? ' has-lifted-card' : ''}`}>
                  {folders.map((folder, idx) => {
                    const cardId = `folder-${folder.platform}-${folder.id}`;
                    return (
                      <button
                        key={`${folder.id}-${idx}`}
                        type="button"
                        className={`playlist-folder-card${liftedCardId === cardId ? ' is-lifted' : ''}`}
                        onClick={() => handleFolderClick(folder)}
                        style={staggerStyle(idx)}
                        aria-label={`打开歌单 ${folder.name}`}
                        {...getLiftHandlers(cardId)}
                      >
                        <span className="playlist-card-cover-wrap playlist-folder-card__cover-wrap">
                          <img
                            src={folder.coverUrl}
                            alt={folder.name}
                            referrerPolicy="no-referrer"
                            className="playlist-folder-card__cover"
                          />
                          <span className="playlist-card-play-mark" aria-hidden="true">▶</span>
                        </span>
                        <span className="playlist-card-copy">
                          <span className="playlist-card-kicker">我的歌单</span>
                          <span className="playlist-card-title">{folder.name}</span>
                          <span className="playlist-card-subtitle">共 {folder.trackCount} 首</span>
                          <span className="playlist-card-actions" aria-hidden="true">
                            <span>展开歌单</span>
                            <span>详情</span>
                          </span>
                        </span>
                        <span className="playlist-card-chevron">›</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isDetailOpen && (
              <div
                className={`playlist-stage-layer playlist-detail-layer lyrics-scroll${isDetailClosing ? ' is-closing' : ''}`}
                style={{ padding: layerPadding }}
              >
                <section className="playlist-detail-hero" aria-label="当前歌单">
                  <div className="playlist-detail-cover-shell">
                    {activeFolderCover ? (
                      <img
                        src={activeFolderCover}
                        alt={activeFolderName}
                        referrerPolicy="no-referrer"
                        className="playlist-detail-cover"
                      />
                    ) : (
                      <div className="playlist-detail-cover playlist-detail-cover--empty">MS</div>
                    )}
                  </div>
                  <div className="playlist-detail-copy">
                    <span>{activePlatform === 'netease' ? '网易云音乐' : 'QQ音乐'}</span>
                    <h4>{activeFolderName}</h4>
                    <p>{activeFolderCount} 首歌曲</p>
                  </div>
                </section>

                {isLoadingTracks ? (
                  <PanelState icon="🌀" minHeight={emptyStateHeight} spinning>
                    正在获取歌曲...
                  </PanelState>
                ) : folderTracks.length === 0 ? (
                  <PanelState icon="—" minHeight={emptyStateHeight}>
                    歌单内暂无歌曲或加载失败
                  </PanelState>
                ) : (
                  <div className={`playlist-track-stack${hasLiftedTrack ? ' has-lifted-card' : ''}`}>
                    {folderTracks.map((track, idx) => {
                      const cardId = `track-${track.platform}-${track.id}-${idx}`;
                      return (
                        <button
                          key={`${track.id}-${idx}`}
                          type="button"
                          className={`playlist-track-card${liftedCardId === cardId ? ' is-lifted' : ''}`}
                          onClick={() => onSelectTrack(track)}
                          style={staggerStyle(idx)}
                          aria-label={`播放 ${track.title}`}
                          {...getLiftHandlers(cardId)}
                        >
                          <span className="playlist-card-cover-wrap playlist-track-card__cover-wrap">
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              className="playlist-track-card__cover"
                            />
                            <span className="playlist-card-play-mark" aria-hidden="true">▶</span>
                          </span>
                          <span className="playlist-card-copy">
                            <span className="playlist-card-kicker">歌曲</span>
                            <span className="playlist-card-title">{track.title}</span>
                            <span className="playlist-card-subtitle">{track.artist}</span>
                            <span className="playlist-card-actions" aria-hidden="true">
                              <span>播放歌曲</span>
                              <span>{fmtDuration(track.duration)}</span>
                            </span>
                          </span>
                          <span className="playlist-track-duration mono">{fmtDuration(track.duration)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {liftedPreview && (
              <button
                type="button"
                className={`playlist-lift-preview playlist-lift-preview--${liftedPreview.kind}${isLiftPreviewVisible ? ' is-visible' : ' is-leaving'}`}
                style={{
                  top: `${liftPreviewMotion.top}px`,
                  '--lift-source-x': `${liftPreviewMotion.sourceX}px`,
                  '--lift-source-y': `${liftPreviewMotion.sourceY}px`,
                  '--lift-source-scale': liftPreviewMotion.scale,
                } as React.CSSProperties}
                onPointerEnter={keepLiftPreview}
                onPointerMove={handleLiftPreviewPointerMove}
                onPointerLeave={event => handleLiftPreviewPointerLeave(event, liftedPreview.id)}
                onFocus={keepLiftPreview}
                onBlur={() => hideLiftedCard(liftedPreview.id)}
                onClick={() => {
                  if (liftedFolder) {
                    handleFolderClick(liftedFolder);
                    return;
                  }
                  if (liftedTrack) {
                    onSelectTrack(liftedTrack);
                  }
                }}
                aria-label={liftedPreview.title}
              >
                <span className="playlist-lift-inner">
                <span className="playlist-lift-backplate" aria-hidden="true" />
                <span className="playlist-lift-cover-wrap">
                  <img
                    src={liftedPreview.coverUrl}
                    alt={liftedPreview.title}
                    referrerPolicy="no-referrer"
                    className="playlist-lift-cover"
                  />
                  <span className="playlist-lift-play-mark" aria-hidden="true">▶</span>
                </span>
                <span className="playlist-lift-copy">
                  <span className="playlist-lift-kicker">{liftedPreview.kicker}</span>
                  <span className="playlist-lift-title">{liftedPreview.title}</span>
                  <span className="playlist-lift-subtitle">{liftedPreview.subtitle}</span>
                  <span className="playlist-lift-actions" aria-hidden="true">
                    <span>{liftedPreview.primaryLabel}</span>
                    <span>{liftedPreview.secondaryLabel}</span>
                  </span>
                </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .playlist-panel-glass {
          position: relative;
          isolation: isolate;
          overflow: visible;
        }

        .playlist-panel-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          border-radius: inherit;
          background:
            radial-gradient(circle at 18% 8%, rgba(34, 211, 238, 0.16), transparent 34%),
            radial-gradient(circle at 82% 22%, rgba(217, 119, 6, 0.16), transparent 32%),
            linear-gradient(135deg, rgba(255,255,255,0.08), transparent 42%, rgba(255,255,255,0.03));
        }

        .playlist-panel-glass > * {
          position: relative;
          z-index: 1;
        }

        .playlist-panel-header {
          flex-shrink: 0;
        }

        .playlist-panel-back {
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.055);
          color: var(--ms-text-primary);
          cursor: pointer;
          display: grid;
          place-items: center;
          font: inherit;
          font-size: 1.45rem;
          line-height: 1;
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.22),
            0 8px 20px rgba(0,0,0,0.18);
          transition:
            transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
            background 220ms ease,
            border-color 220ms ease;
        }

        .playlist-panel-back:hover,
        .playlist-panel-back:focus-visible,
        .playlist-panel-close:hover,
        .playlist-panel-close:focus-visible {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
          outline: none;
        }

        .playlist-stage {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: visible;
          perspective: 1550px;
          transform-style: preserve-3d;
          --playlist-card-overhang: 222px;
        }

        .playlist-stage::before {
          content: '';
          position: absolute;
          inset: -8px -12px -8px -228px;
          z-index: 5;
          pointer-events: none;
          opacity: 0;
          background:
            radial-gradient(circle at 24% 46%, rgba(255,255,255,0.18), transparent 34%),
            linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025) 36%, transparent 70%);
          mix-blend-mode: screen;
          transition: opacity 220ms ease;
        }

        .playlist-stage.has-lift-preview::before {
          opacity: 0.48;
        }

        .playlist-stage-layer {
          position: absolute;
          inset: 0 0 0 calc(var(--playlist-card-overhang) * -1);
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          transform-style: preserve-3d;
          backface-visibility: hidden;
          mask-image: linear-gradient(to bottom, transparent, black 6%, black 92%, transparent);
          -webkit-mask-image: linear-gradient(to bottom, transparent, black 6%, black 92%, transparent);
        }

        .playlist-stage-layer > .playlist-folder-stack,
        .playlist-stage-layer > .playlist-track-stack,
        .playlist-stage-layer > .playlist-detail-hero,
        .playlist-stage-layer > .playlist-panel-state {
          margin-left: var(--playlist-card-overhang);
        }

        .playlist-root-layer {
          z-index: 1;
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
          filter: blur(0) saturate(1);
          transition:
            transform 520ms cubic-bezier(0.16, 1, 0.3, 1),
            opacity 420ms ease,
            filter 420ms ease;
        }

        .playlist-stage.is-detail-open .playlist-root-layer {
          pointer-events: none;
          opacity: 0.26;
          transform: translate3d(-18px, -8px, -92px) rotateY(-5deg) scale(0.94);
          filter: blur(1.8px) saturate(0.82);
        }

        .playlist-detail-layer {
          z-index: 2;
          animation: playlist-detail-float-in 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .playlist-detail-layer.is-closing {
          pointer-events: none;
          animation: playlist-detail-float-out ${DETAIL_EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        .playlist-folder-stack,
        .playlist-track-stack {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 2px;
          padding-bottom: 8px;
          transition:
            transform 360ms cubic-bezier(0.19, 1, 0.22, 1),
            opacity 220ms ease;
        }

        .playlist-folder-card,
        .playlist-track-card {
          width: 100%;
          min-width: 0;
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 16px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.105), rgba(255,255,255,0.035)),
            rgba(10, 10, 14, 0.14);
          color: var(--ms-text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          text-align: left;
          font: inherit;
          position: relative;
          overflow: hidden;
          transform: translate3d(0, 0, 0);
          transform-origin: center;
          box-shadow:
            0 12px 28px rgba(0,0,0,0.18),
            inset 0 1px 1px rgba(255,255,255,0.2),
            inset 0 -1px 1px rgba(0,0,0,0.18);
          transition:
            transform 320ms cubic-bezier(0.19, 1, 0.22, 1),
            background 240ms ease,
            border-color 240ms ease,
            box-shadow 240ms ease;
          backface-visibility: hidden;
        }

        .playlist-folder-card {
          min-height: 76px;
          animation: playlist-folder-settle 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--stagger);
        }

        .playlist-track-card {
          min-height: 66px;
          opacity: 0;
          animation: playlist-track-float-in 540ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--stagger);
          content-visibility: auto;
          contain-intrinsic-size: 66px;
        }

        .playlist-folder-card::before,
        .playlist-track-card::before,
        .playlist-detail-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          background:
            radial-gradient(circle at 18% 0%, rgba(255,255,255,0.28), transparent 36%),
            linear-gradient(180deg, rgba(255,255,255,0.12), transparent 52%);
          opacity: 0.72;
          transition: opacity 240ms ease;
        }

        .playlist-folder-card:hover,
        .playlist-folder-card:focus-visible,
        .playlist-track-card:hover,
        .playlist-track-card:focus-visible {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055)),
            rgba(10, 10, 14, 0.18);
          border-color: rgba(255, 255, 255, 0.26);
          box-shadow:
            0 20px 38px rgba(0,0,0,0.28),
            0 0 26px rgba(34,211,238,0.13),
            inset 0 1px 1px rgba(255,255,255,0.32),
            inset 0 -1px 1px rgba(0,0,0,0.16);
          outline: none;
        }

        .playlist-folder-card:hover,
        .playlist-folder-card:focus-visible {
          transform: translate3d(0, -1px, 12px) rotateX(0.4deg);
        }

        .playlist-track-card:hover,
        .playlist-track-card:focus-visible {
          transform: translate3d(0, -1px, 14px) scale(1.002);
        }

        .playlist-folder-card:hover::before,
        .playlist-folder-card:focus-visible::before,
        .playlist-track-card:hover::before,
        .playlist-track-card:focus-visible::before,
        .playlist-detail-hero:hover::before {
          opacity: 0.95;
        }

        .playlist-folder-card__cover,
        .playlist-track-card__cover,
        .playlist-detail-cover {
          object-fit: cover;
          flex-shrink: 0;
          background: rgba(255,255,255,0.08);
        }

        .playlist-folder-card__cover {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.22);
        }

        .playlist-track-card__cover {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          box-shadow: 0 8px 18px rgba(0,0,0,0.22);
        }

        .playlist-card-copy {
          position: relative;
          z-index: 1;
          flex: 1;
          min-width: 0;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: center;
          transform: translate3d(0, 0, 0);
          transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .playlist-card-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--ms-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0 1px 8px rgba(0,0,0,0.32);
          transition: color 260ms ease;
        }

        .playlist-card-subtitle {
          margin-top: 4px;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.58);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 260ms ease;
        }

        .playlist-card-chevron,
        .playlist-track-duration {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          color: var(--ms-text-muted);
        }

        .playlist-card-chevron {
          font-size: 1.45rem;
          padding-right: 4px;
          opacity: 0.68;
        }

        .playlist-track-duration {
          font-size: 0.7rem;
        }

        .playlist-folder-stack,
        .playlist-track-stack {
          perspective: 1200px;
          transform-style: preserve-3d;
          isolation: isolate;
        }

        .playlist-stage.has-lift-preview .playlist-folder-stack.has-lifted-card,
        .playlist-stage.has-lift-preview .playlist-track-stack.has-lifted-card {
          transform: translate3d(42px, 2px, -112px) rotateY(-10deg) scale(0.92);
          opacity: 0.7;
        }

        .playlist-folder-stack.has-lifted-card .playlist-folder-card:not(.is-lifted),
        .playlist-track-stack.has-lifted-card .playlist-track-card:not(.is-lifted) {
          opacity: 0.28;
          transform: translate3d(30px, 0, -94px) rotateY(-8deg) scale(0.91);
        }

        .playlist-folder-card,
        .playlist-track-card {
          transform-origin: center left;
          transition:
            transform 320ms cubic-bezier(0.19, 1, 0.22, 1),
            opacity 220ms ease,
            background 300ms ease,
            border-color 300ms ease,
            box-shadow 360ms ease;
        }

        .playlist-card-cover-wrap {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          display: block;
          overflow: hidden;
          background: rgba(255,255,255,0.08);
          box-shadow:
            0 12px 26px rgba(0,0,0,0.28),
            inset 0 1px 1px rgba(255,255,255,0.18);
          transform: translate3d(0, 0, 0);
          transition:
            border-radius 540ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 540ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 360ms ease;
        }

        .playlist-folder-card__cover-wrap {
          width: 56px;
          height: 56px;
          border-radius: 12px;
        }

        .playlist-track-card__cover-wrap {
          width: 46px;
          height: 46px;
          border-radius: 12px;
        }

        .playlist-folder-card__cover,
        .playlist-track-card__cover {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          transition: transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .playlist-card-play-mark {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,0.94);
          font-size: 2.1rem;
          line-height: 1;
          text-shadow: 0 4px 18px rgba(0,0,0,0.5);
          background:
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.26), transparent 28%),
            linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.26));
          opacity: 0;
          transition: opacity 260ms ease;
        }

        .playlist-card-kicker,
        .playlist-card-title,
        .playlist-card-subtitle,
        .playlist-card-actions {
          display: block;
        }

        .playlist-card-kicker {
          color: rgba(255,255,255,0.56);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          opacity: 0;
          height: 14px;
          margin-bottom: 2px;
          pointer-events: none;
          transition: opacity 240ms ease;
        }

        .playlist-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
          opacity: 0;
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          min-height: 30px;
          transform-origin: left center;
          pointer-events: none;
          transition: opacity 260ms ease;
        }

        .playlist-card-actions span {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 0 13px;
          color: rgba(255,255,255,0.88);
          background: rgba(255,255,255,0.11);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.2),
            0 8px 18px rgba(0,0,0,0.16);
          font-size: 0.68rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .playlist-card-actions span:first-child {
          color: rgba(10,10,14,0.92);
          background: rgba(255,255,255,0.86);
          border-color: rgba(255,255,255,0.72);
        }

        .playlist-folder-card.is-lifted,
        .playlist-track-card.is-lifted {
          opacity: 0.12;
          transform: translate3d(16px, 0, -76px) rotateY(-7deg) scale(0.93);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow:
            0 8px 18px rgba(0,0,0,0.16),
            inset 0 1px 1px rgba(255,255,255,0.08);
        }

        .playlist-lift-preview {
          position: absolute;
          left: -235px;
          width: min(540px, calc(100% + 231px));
          height: 152px;
          --lift-tilt-x: 0deg;
          --lift-tilt-y: 0deg;
          --lift-glint-x: 28%;
          --lift-glint-y: 18%;
          z-index: 8;
          appearance: none;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: var(--ms-text-primary);
          cursor: pointer;
          display: block;
          padding: 0;
          text-align: left;
          font: inherit;
          overflow: visible;
          opacity: 0;
          pointer-events: none;
          transform-origin: 92% 52%;
          transform: translate3d(var(--lift-source-x), var(--lift-source-y), -118px) rotateX(10deg) rotateY(-30deg) scale(var(--lift-source-scale));
          transform-style: preserve-3d;
          transition:
            opacity 150ms ease,
            transform 420ms cubic-bezier(0.2, 1.06, 0.22, 1);
          box-shadow: none;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        .playlist-lift-preview.is-visible {
          opacity: 1;
          pointer-events: auto;
          transform: translate3d(-78px, -7px, 192px) rotateX(calc(2deg + var(--lift-tilt-x))) rotateY(calc(-8deg + var(--lift-tilt-y))) scale(1.015);
        }

        .playlist-lift-preview.is-leaving {
          opacity: 0;
          pointer-events: none;
          transform: translate3d(var(--lift-source-x), var(--lift-source-y), -84px) rotateX(10deg) rotateY(-26deg) scale(var(--lift-source-scale));
        }

        .playlist-lift-preview::before {
          display: none;
        }

        .playlist-lift-inner {
          position: absolute;
          inset: 0;
          display: block;
          transform-style: preserve-3d;
          transform-origin: 74% 52%;
          opacity: 0.72;
          transform: translate3d(76px, 0, 0) rotateY(-5deg) scale(0.66);
          transition:
            opacity 420ms cubic-bezier(0.2, 1.06, 0.22, 1),
            transform 420ms cubic-bezier(0.2, 1.06, 0.22, 1);
          will-change: transform, opacity;
        }

        .playlist-lift-preview.is-visible .playlist-lift-inner {
          opacity: 1;
          transform: translate3d(0, 0, 0) rotateY(0deg) scale(1);
        }

        .playlist-lift-preview.is-leaving .playlist-lift-inner {
          opacity: 0.72;
          transform: translate3d(76px, 0, 0) rotateY(-5deg) scale(0.66);
        }

        .playlist-lift-preview::after {
          content: '';
          position: absolute;
          left: 68px;
          right: 34px;
          bottom: -38px;
          height: 42px;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(ellipse at center, rgba(38, 82, 92, 0.22), rgba(38, 82, 92, 0));
          transform: translate3d(0, 0, -58px) rotateX(72deg);
          opacity: 0.28;
        }

        .playlist-lift-backplate {
          position: absolute;
          left: 118px;
          right: 0;
          top: 0;
          bottom: 0;
          z-index: 1;
          border: 1px solid rgba(255,255,255,0.5);
          border-radius: 28px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0.09)),
            radial-gradient(circle at 18% 12%, rgba(34,211,238,0.13), transparent 32%),
            radial-gradient(circle at 94% 88%, rgba(217,119,6,0.1), transparent 34%),
            rgba(34, 43, 45, 0.28);
          backdrop-filter: blur(12px) saturate(1.22);
          -webkit-backdrop-filter: blur(12px) saturate(1.22);
          box-shadow:
            0 18px 46px rgba(28, 70, 82, 0.2),
            0 0 0 1px rgba(255,255,255,0.16),
            inset 0 1px 1.5px rgba(255,255,255,0.58),
            inset 0 -1px 2px rgba(36, 62, 66, 0.18);
          opacity: 0.72;
          overflow: hidden;
          contain: paint;
          transform: translate3d(54px, 0, 10px) scaleX(0.92);
          transform-origin: left center;
          transition:
            opacity 260ms ease,
            transform 420ms cubic-bezier(0.2, 1.06, 0.22, 1);
          will-change: transform, opacity;
        }

        .playlist-lift-backplate::before {
          content: '';
          position: absolute;
          inset: -1px;
          pointer-events: none;
          background:
            radial-gradient(circle at var(--lift-glint-x) var(--lift-glint-y), rgba(255,255,255,0.46), rgba(255,255,255,0.12) 22%, transparent 48%),
            linear-gradient(115deg, rgba(255,255,255,0.2), transparent 38%, rgba(255,255,255,0.08) 68%, transparent);
          opacity: 0.8;
          transition: opacity 220ms ease;
        }

        .playlist-lift-backplate::after {
          content: '';
          position: absolute;
          inset: 1px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: inherit;
          pointer-events: none;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.34),
            inset 0 -1px 0 rgba(20,42,48,0.1);
        }

        .playlist-lift-preview.is-visible .playlist-lift-backplate {
          opacity: 1;
          transform: translate3d(0, 0, 42px) scaleX(1);
        }

        .playlist-lift-preview.is-leaving .playlist-lift-backplate {
          opacity: 0.72;
          transform: translate3d(54px, 0, 10px) scaleX(0.92);
        }

        .playlist-lift-cover-wrap,
        .playlist-lift-copy {
          position: absolute;
        }

        .playlist-lift-cover-wrap {
          z-index: 3;
          left: 0;
          top: 8px;
          width: 148px;
          height: 136px;
          border-radius: 24px;
          overflow: hidden;
          box-shadow:
            0 20px 40px rgba(26, 70, 84, 0.24),
            0 0 0 1px rgba(255,255,255,0.28),
            0 0 22px rgba(255,255,255,0.12),
            inset 0 1px 1px rgba(255,255,255,0.32);
          transform: translate3d(60px, 0, 30px) scale(1);
          transition:
            transform 420ms cubic-bezier(0.2, 1.06, 0.22, 1),
            border-radius 420ms cubic-bezier(0.2, 1.06, 0.22, 1);
          transform-style: preserve-3d;
          will-change: transform;
        }

        .playlist-lift-cover-wrap::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.22), transparent 34%),
            radial-gradient(circle at 70% 12%, rgba(255,255,255,0.28), transparent 26%);
          mix-blend-mode: screen;
          opacity: 0.72;
        }

        .playlist-lift-preview.is-visible .playlist-lift-cover-wrap {
          border-radius: 26px;
          transform: translate3d(-62px, 0, 92px) scale(1);
        }

        .playlist-lift-preview.is-leaving .playlist-lift-cover-wrap {
          transform: translate3d(60px, 0, 30px) scale(1);
        }

        .playlist-lift-cover {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .playlist-lift-play-mark {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,0.96);
          font-size: 2.7rem;
          text-shadow: 0 6px 22px rgba(0,0,0,0.55);
          background:
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.22), transparent 30%),
            linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.28));
        }

        .playlist-lift-copy {
          z-index: 2;
          left: 216px;
          right: 30px;
          top: 0;
          bottom: 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
          padding-top: 2px;
          opacity: 0.72;
          transform: translate3d(-36px, 0, 14px) scale(1);
          transition:
            opacity 260ms ease,
            transform 420ms cubic-bezier(0.2, 1.06, 0.22, 1);
          will-change: transform, opacity;
        }

        .playlist-lift-preview.is-visible .playlist-lift-copy {
          opacity: 1;
          transform: translate3d(-18px, 0, 48px) scale(1);
        }

        .playlist-lift-preview.is-leaving .playlist-lift-copy {
          opacity: 0.72;
          transform: translate3d(-36px, 0, 14px) scale(1);
        }

        .playlist-lift-kicker {
          color: rgba(255,255,255,0.68);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .playlist-lift-title {
          margin-top: 5px;
          color: rgba(255,255,255,0.98);
          font-size: 1.08rem;
          font-weight: 850;
          line-height: 1.12;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0 3px 14px rgba(0,0,0,0.44);
        }

        .playlist-lift-subtitle {
          margin-top: 9px;
          color: rgba(255,255,255,0.58);
          font-size: 0.74rem;
          font-weight: 650;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .playlist-lift-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          opacity: 0.78;
          transform: translate3d(-10px, 8px, 0) scale(1);
          transition:
            opacity 260ms ease,
            transform 420ms cubic-bezier(0.2, 1.06, 0.22, 1);
        }

        .playlist-lift-preview.is-visible .playlist-lift-actions {
          opacity: 1;
          transform: translate3d(0, 0, 18px) scale(1);
        }

        .playlist-lift-preview.is-leaving .playlist-lift-actions {
          opacity: 0.78;
          transform: translate3d(-10px, 8px, 0) scale(1);
        }

        .playlist-lift-actions span {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 0 13px;
          color: rgba(255,255,255,0.86);
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.26),
            0 8px 18px rgba(26, 70, 84, 0.12);
          font-size: 0.66rem;
          font-weight: 850;
          white-space: nowrap;
        }

        .playlist-lift-actions span:first-child {
          color: rgba(10,10,14,0.92);
          background: rgba(255,255,255,0.9);
          border-color: rgba(255,255,255,0.76);
        }

        .playlist-detail-hero {
          position: relative;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          align-items: center;
          gap: 16px;
          margin: 2px 0 16px;
          padding: 14px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background:
            radial-gradient(circle at 24% 12%, rgba(34, 211, 238, 0.2), transparent 36%),
            radial-gradient(circle at 82% 82%, rgba(217, 119, 6, 0.2), transparent 36%),
            rgba(255,255,255,0.055);
          box-shadow:
            0 24px 48px rgba(0,0,0,0.28),
            0 0 32px rgba(34,211,238,0.08),
            inset 0 1px 1px rgba(255,255,255,0.26);
          overflow: hidden;
          transform: translate3d(0, 0, 42px);
          transform-style: preserve-3d;
        }

        .playlist-detail-cover-shell {
          position: relative;
          z-index: 1;
          width: 92px;
          height: 92px;
          border-radius: 22px;
          padding: 2px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.72), rgba(34,211,238,0.28), rgba(217,119,6,0.32));
          box-shadow:
            0 20px 42px rgba(0,0,0,0.34),
            0 0 28px rgba(34,211,238,0.16);
          transform: translate3d(0, 0, 24px) rotateX(1deg);
        }

        .playlist-detail-cover {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          border-radius: 20px;
          color: rgba(255,255,255,0.74);
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .playlist-detail-copy {
          position: relative;
          z-index: 1;
          min-width: 0;
          transform: translate3d(0, 0, 16px);
        }

        .playlist-detail-copy span {
          color: rgba(34, 211, 238, 0.82);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .playlist-detail-copy h4 {
          margin-top: 6px;
          color: var(--ms-text-primary);
          font-size: 1.12rem;
          font-weight: 800;
          line-height: 1.18;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          text-shadow: 0 2px 12px rgba(0,0,0,0.38);
        }

        .playlist-detail-copy p {
          margin-top: 8px;
          color: rgba(255,255,255,0.58);
          font-size: 0.78rem;
        }

        .playlist-panel-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border-radius: 20px;
          color: var(--ms-text-muted);
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.09);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.12);
          text-align: center;
          padding: 24px;
        }

        .playlist-panel-state__icon {
          font-size: 2rem;
          opacity: 0.65;
        }

        .playlist-panel-state__icon.is-spinning {
          animation: playlist-spin 1s linear infinite;
        }

        .playlist-panel-state p {
          color: var(--ms-text-muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        @keyframes playlist-detail-float-in {
          from {
            opacity: 0;
            transform: translate3d(0, 34px, -80px) rotateX(7deg) scale(0.965);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotateX(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes playlist-detail-float-out {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotateX(0) scale(1);
            filter: blur(0);
          }
          to {
            opacity: 0;
            transform: translate3d(0, 20px, -72px) rotateX(5deg) scale(0.965);
            filter: blur(6px);
          }
        }

        @keyframes playlist-folder-settle {
          from {
            opacity: 0;
            transform: translate3d(-10px, 14px, -24px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes playlist-track-float-in {
          from {
            opacity: 0;
            transform: translate3d(0, 22px, -46px) rotateX(6deg) scale(0.975);
            filter: blur(5px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotateX(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes playlist-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .playlist-stage {
            perspective: 860px;
            --playlist-card-overhang: 96px;
          }

          .playlist-stage.is-detail-open .playlist-root-layer {
            transform: translate3d(-8px, -4px, -48px) rotateY(-2deg) scale(0.97);
            opacity: 0.18;
          }

          .playlist-detail-hero {
            grid-template-columns: 76px minmax(0, 1fr);
            gap: 12px;
            padding: 12px;
            border-radius: 20px;
          }

          .playlist-detail-cover-shell {
            width: 76px;
            height: 76px;
            border-radius: 19px;
          }

          .playlist-detail-cover {
            border-radius: 17px;
          }

          .playlist-detail-copy h4 {
            font-size: 1rem;
          }

          .playlist-folder-card,
          .playlist-track-card {
            border-radius: 15px;
          }

          .playlist-lift-preview {
            left: -72px;
            width: min(356px, calc(100% + 68px));
            height: 118px;
            transform: translate3d(var(--lift-source-x), var(--lift-source-y), -58px) rotateX(8deg) rotateY(-18deg) scale(var(--lift-source-scale));
          }

          .playlist-lift-backplate {
            left: 68px;
            border-radius: 23px;
          }

          .playlist-lift-preview.is-visible .playlist-lift-backplate {
            transform: translate3d(0, 0, 32px) scaleX(1);
          }

          .playlist-lift-preview.is-visible {
            transform: translate3d(-16px, -3px, 112px) rotateX(2deg) rotateY(-7deg) scale(1);
          }

          .playlist-lift-preview.is-leaving {
            transform: translate3d(var(--lift-source-x), var(--lift-source-y), -46px) rotateX(8deg) rotateY(-16deg) scale(var(--lift-source-scale));
          }

          .playlist-lift-inner,
          .playlist-lift-preview.is-leaving .playlist-lift-inner {
            transform: translate3d(44px, 0, 0) rotateY(-4deg) scale(0.72);
          }

          .playlist-lift-preview.is-visible .playlist-lift-inner {
            transform: translate3d(0, 0, 0) rotateY(0deg) scale(1);
          }

          .playlist-lift-cover-wrap {
            top: 7px;
            width: 96px;
            height: 104px;
            border-radius: 19px;
          }

          .playlist-lift-preview.is-visible .playlist-lift-cover-wrap {
            border-radius: 21px;
            transform: translate3d(-12px, 0, 58px) scale(1);
          }

          .playlist-lift-preview.is-leaving .playlist-lift-cover-wrap {
            transform: translate3d(38px, 0, 26px) scale(1);
          }

          .playlist-lift-copy {
            left: 136px;
            right: 14px;
            transform: translate3d(-26px, 0, 14px) scale(1);
          }

          .playlist-lift-preview.is-visible .playlist-lift-copy {
            transform: translate3d(-12px, 0, 34px) scale(1);
          }

          .playlist-lift-preview.is-leaving .playlist-lift-copy {
            transform: translate3d(-26px, 0, 14px) scale(1);
          }

          .playlist-lift-play-mark {
            font-size: 2.15rem;
          }

          .playlist-lift-title {
            margin-top: 5px;
            font-size: 0.94rem;
          }

          .playlist-lift-subtitle {
            margin-top: 7px;
            font-size: 0.68rem;
          }

          .playlist-lift-actions {
            gap: 6px;
            margin-top: 8px;
          }

          .playlist-lift-actions span {
            min-height: 28px;
            padding: 0 10px;
            font-size: 0.58rem;
          }

          .playlist-card-actions span {
            min-height: 28px;
            padding: 0 10px;
            font-size: 0.62rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .playlist-panel-frame,
          .playlist-panel-back,
          .playlist-panel-close,
          .playlist-root-layer,
          .playlist-folder-card,
          .playlist-track-card,
          .playlist-lift-preview,
          .playlist-lift-inner,
          .playlist-lift-backplate,
          .playlist-lift-cover-wrap,
          .playlist-lift-copy,
          .playlist-lift-actions,
          .playlist-folder-stack,
          .playlist-track-stack {
            transition: none !important;
          }

          .playlist-detail-layer,
          .playlist-detail-layer.is-closing,
          .playlist-folder-card,
          .playlist-track-card,
          .playlist-panel-state__icon.is-spinning {
            animation: none !important;
          }

          .playlist-stage.is-detail-open .playlist-root-layer,
          .playlist-folder-card:hover,
          .playlist-folder-card:focus-visible,
          .playlist-folder-card.is-lifted,
          .playlist-track-card:hover,
          .playlist-track-card:focus-visible,
          .playlist-track-card.is-lifted,
          .playlist-lift-preview,
          .playlist-lift-preview.is-visible,
          .playlist-lift-preview.is-leaving,
          .playlist-lift-inner,
          .playlist-lift-backplate,
          .playlist-lift-cover-wrap,
          .playlist-lift-copy,
          .playlist-lift-actions,
          .playlist-folder-stack.has-lifted-card .playlist-folder-card:not(.is-lifted),
          .playlist-track-stack.has-lifted-card .playlist-track-card:not(.is-lifted) {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }

          .playlist-track-card {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};
