import React, { useEffect, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { FluidSlider } from './FluidSlider';
import { TactileButton } from './TactileButton';
import type { Track } from '../types';

interface PlayerDockProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (val: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenPlaylist: () => void;
  /** 播放模式：循环 / 单曲 / 随机 */
  playMode?: 'loop' | 'single' | 'random';
  /** 切换播放模式的回调 */
  onModeChange?: () => void;
  /** 当前音量 0-1 */
  volume?: number;
  /** 音量变更回调 */
  onVolumeChange?: (vol: number) => void;
}

/** 格式化秒数为 m:ss */
const fmtTime = (s: number): string => {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/** 播放模式图标映射 */
const MODE_ICONS: Record<string, string> = {
  loop: '⟳',
  single: '⟲',
  random: '⇝',
};

export const PlayerDock: React.FC<PlayerDockProps> = ({
  currentTrack, isPlaying, progress, currentTime, duration,
  onTogglePlay, onSeek, onPrev, onNext, onOpenPlaylist,
  playMode = 'loop', onModeChange, volume = 0.8, onVolumeChange,
}) => {
  const dockFilterId = 'player-dock-filter';
  /** 是否处于静音状态（记录静音前的音量用于恢复） */
  const [isCompactDock, setIsCompactDock] = useState(() => window.innerWidth <= 768);
  const [mutedVolume, setMutedVolume] = useState<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => setIsCompactDock(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  /** 静音 / 取消静音 */
  const handleMuteToggle = () => {
    if (mutedVolume !== null) {
      // 取消静音：恢复之前的音量
      onVolumeChange?.(mutedVolume);
      setMutedVolume(null);
    } else {
      // 静音：记住当前音量，设为 0
      setMutedVolume(volume);
      onVolumeChange?.(0);
    }
  };

  /** 计算当前是否静音 */
  const isMuted = mutedVolume !== null || volume === 0;

  /** 喇叭图标：根据音量大小显示不同状态 */
  const speakerIcon = isMuted ? '🔇' : volume < 0.5 ? '🔉' : '🔊';

  const DOCK_WIDTH = 1040;
  const DOCK_HEIGHT = 80;
  const DOCK_RADIUS = 40;

  return (
    <div className="musesync-playerdock">
      <div className="desktop-optics-filter">
        <OpticsFilter id={dockFilterId} width={DOCK_WIDTH} height={DOCK_HEIGHT} radius={DOCK_RADIUS} />
      </div>

      <div className="playerdock-glass-panel">
        {/* --- 1. 左侧：曲目信息 --- */}
        <div className="playerdock-left-info" style={{ display: 'flex', alignItems: 'center', width: '180px', flexShrink: 0, gap: '12px' }}>
          {/* 迷你封面 */}
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
            background: 'var(--ms-glass-bg-light)',
          }}>
            {currentTrack && (
              <img
                src={currentTrack.coverUrl}
                referrerPolicy="no-referrer"
                alt={currentTrack.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'cover-fade-in 0.4s ease' }}
                key={currentTrack.id}
              />
            )}
          </div>

          {/* 曲目信息 */}
          <div className="playerdock-track-info" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.85rem', fontWeight: 600, color: 'var(--ms-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentTrack?.title || '等待选曲'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--ms-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
              {currentTrack?.artist || '—'}
            </div>
          </div>
        </div>

        {/* --- 2. 中间：播放控制与进度条 --- */}
        <div className="playerdock-center-controls" style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          {/* 控制按钮组 */}
          <div className="playerdock-button-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TactileButton label="⟨" width={38} height={38} radius={19} color="#A1A1AA" accent="#A1A1AA" onClick={onPrev} />
            <TactileButton
              label={isPlaying ? '❚❚' : '▶'}
              width={50} height={50} radius={25}
              color="#09090B" accent="#D97706"
              onClick={onTogglePlay}
            />
            <TactileButton label="⟩" width={38} height={38} radius={19} color="#A1A1AA" accent="#A1A1AA" onClick={onNext} />
          </div>
          
          {/* 分隔线 */}
          <div className="playerdock-divider" style={{ width: '1px', height: '24px', background: 'var(--ms-glass-border)', flexShrink: 0 }} />

          {/* 进度条组 */}
          <div className="playerdock-progress-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--ms-text-muted)', width: '32px', textAlign: 'right' }}>
              {fmtTime(currentTime)}
            </span>
            <div className="playerdock-progress-slider" style={{ display: 'flex', alignItems: 'center' }}>
              <FluidSlider
                value={progress}
                onChange={onSeek}
                width={isCompactDock ? 190 : undefined}
                height={isCompactDock ? 8 : undefined}
                thumbWidth={isCompactDock ? 48 : undefined}
                thumbHeight={isCompactDock ? 30 : undefined}
              />
            </div>
            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--ms-text-muted)', width: '32px' }}>
              {fmtTime(duration)}
            </span>
          </div>
        </div>

        {/* --- 3. 右侧：功能菜单与音量 --- */}
        <div className="playerdock-right-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '180px', flexShrink: 0, gap: '10px' }}>
          <TactileButton
            label={MODE_ICONS[playMode] || '⟳'}
            width={32} height={32} radius={16}
            color="#A1A1AA" accent="#60A5FA"
            onClick={onModeChange}
          />
          <TactileButton label="≡" width={32} height={32} radius={16} color="#A1A1AA" accent="#A1A1AA" onClick={onOpenPlaylist} />
          
          {/* 音量控制 - 固定展现，体现一体化，使用物理阻尼感的 FluidSlider */}
          <div className="playerdock-volume" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '16px' }}>
            <div style={{ cursor: 'pointer', color: 'var(--ms-text-secondary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }} onClick={handleMuteToggle}>
              {speakerIcon}
            </div>
            <div className="playerdock-volume-slider" style={{ display: 'flex', alignItems: 'center' }}>
              <FluidSlider 
                value={isMuted ? 0 : volume * 100} 
                onChange={(v) => {
                  if (mutedVolume !== null) setMutedVolume(null);
                  onVolumeChange?.(v / 100);
                }}
                width={80}
                height={8}
                thumbWidth={36}
                thumbHeight={24}
                colorStart="#60A5FA"
                colorEnd="#3B82F6"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 注入高拟真自适应底部控制栏 CSS */}
      <style>{`
        .musesync-playerdock {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          width: auto;
          max-width: calc(100vw - 48px);
          transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .desktop-optics-filter {
          display: block;
        }

        .playerdock-glass-panel {
          width: ${DOCK_WIDTH}px; /* 固宽化保证滤镜和高光折射跟大底座1:1严丝合缝 */
          height: ${DOCK_HEIGHT}px;
          border-radius: ${DOCK_RADIUS}px;
          backdrop-filter: url(#${dockFilterId});
          -webkit-backdrop-filter: url(#${dockFilterId});
          background: var(--ms-glass-bg);
          border: 1px solid var(--ms-glass-border);
          box-shadow: 0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 var(--ms-glass-highlight);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .musesync-playerdock {
            bottom: 12px;
            left: 12px;
            right: 12px;
            transform: none;
            max-width: calc(100vw - 24px);
            width: calc(100% - 24px);
          }

          .playerdock-glass-panel {
            width: 100% !important; /* 移动端取消固定宽度 */
            height: 64px; /* 手机端高度紧凑缩减为 64px，更加精致 */
            border-radius: 32px;
            padding: 0 16px;
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 16px 36px rgba(0,0,0,0.4);
            justify-content: space-between;
            gap: 0;
          }

          .desktop-optics-filter {
            display: none !important; /* 隐藏固宽 SVG 滤镜防止撑大 */
          }

          /* 手机端右侧功能区隐藏 */
          .playerdock-right-controls {
            display: none !important;
          }

          /* 手机端中间区域调整：隐藏进度条和分隔线，仅保留控制按钮 */
          .playerdock-center-controls {
            flex: 0 0 auto !important;
          }
          .playerdock-center-controls > div:nth-child(2),
          .playerdock-center-controls > div:nth-child(3) {
            display: none !important; 
          }
          .playerdock-center-controls > div:nth-child(1) {
            gap: 8px !important; /* 减小按钮间距 */
          }
          
          /* 调整按钮的缩放，适应手机高度 */
          .playerdock-center-controls button {
            transform: scale(0.85);
            transform-origin: center;
          }

          .playerdock-left-info {
            flex: 1;
            width: auto !important;
            max-width: calc(100% - 120px);
          }
          
          .playerdock-track-info {
             max-width: 100%;
          }
        }

        @media (max-width: 768px) {
          .musesync-playerdock {
            bottom: max(10px, env(safe-area-inset-bottom));
          }

          .playerdock-glass-panel {
            min-height: 144px;
            height: 144px;
            border-radius: 28px;
            padding: 10px 12px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-rows: 42px 42px 30px;
            grid-template-areas:
              "info actions"
              "buttons buttons"
              "progress progress";
            align-items: center;
            column-gap: 8px;
            row-gap: 5px;
          }

          .playerdock-left-info {
            grid-area: info;
            min-width: 0;
            max-width: none !important;
            width: auto !important;
            gap: 10px !important;
          }

          .playerdock-left-info > div:first-child {
            width: 42px !important;
            height: 42px !important;
            border-radius: 10px !important;
          }

          .playerdock-track-info {
            min-width: 0;
            max-width: 100%;
          }

          .playerdock-right-controls {
            grid-area: actions;
            display: flex !important;
            width: auto !important;
            align-items: center;
            justify-content: flex-end;
            gap: 6px !important;
          }

          .playerdock-right-controls > div,
          .playerdock-volume {
            min-width: 44px;
            min-height: 44px;
            display: flex !important;
            align-items: center;
            justify-content: center;
          }

          .playerdock-volume {
            margin-right: 0 !important;
            gap: 0 !important;
          }

          .playerdock-volume-slider {
            display: none !important;
          }

          .playerdock-center-controls {
            display: contents !important;
          }

          .playerdock-button-row {
            grid-area: buttons;
            justify-content: center;
            gap: 10px !important;
          }

          .playerdock-button-row > div {
            min-width: 44px;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .playerdock-divider {
            display: none !important;
          }

          .playerdock-center-controls > div:nth-child(3).playerdock-progress-row,
          .playerdock-center-controls > .playerdock-progress-row,
          .playerdock-progress-row {
            grid-area: progress;
            width: 100%;
            min-width: 0;
            height: 30px;
            display: flex !important;
            align-items: center !important;
            justify-content: center;
            gap: 6px !important;
          }

          .playerdock-progress-slider {
            flex: 0 0 190px;
            width: 190px;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
};
