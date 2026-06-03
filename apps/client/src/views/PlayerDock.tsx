import React from 'react';
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
}

/** 格式化秒数为 m:ss */
const fmtTime = (s: number): string => {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const PlayerDock: React.FC<PlayerDockProps> = ({
  currentTrack, isPlaying, progress, currentTime, duration,
  onTogglePlay, onSeek, onPrev, onNext, onOpenPlaylist
}) => {
  const dockFilterId = 'player-dock-filter';

  return (
    <div className="musesync-playerdock">
      <div className="desktop-optics-filter">
        <OpticsFilter id={dockFilterId} width={880} height={80} radius={40} />
      </div>

      <div className="playerdock-glass-panel">
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
        <div className="playerdock-track-info" style={{ width: '100px', flexShrink: 0 }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, color: 'var(--ms-text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentTrack?.title || '等待选曲'}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--ms-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack?.artist || '—'}
          </div>
        </div>

        {/* 左侧时间 */}
        <span className="mono playerdock-time-left" style={{ fontSize: '0.7rem', color: 'var(--ms-text-muted)', flexShrink: 0, width: '36px', textAlign: 'right' }}>
          {fmtTime(currentTime)}
        </span>

        {/* 进度条 — 给一个固定最小宽度 */}
        <div className="playerdock-slider-wrapper" style={{ width: '330px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FluidSlider value={progress} onChange={onSeek} />
        </div>

        {/* 右侧时间 */}
        <span className="mono playerdock-time-right" style={{ fontSize: '0.7rem', color: 'var(--ms-text-muted)', flexShrink: 0, width: '36px' }}>
          {fmtTime(duration)}
        </span>

        {/* 分隔线 */}
        <div className="playerdock-divider" style={{ width: '1px', height: '32px', background: 'var(--ms-glass-border)', flexShrink: 0 }} />

        {/* 控制按钮组 */}
        <div className="playerdock-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <TactileButton label="⟨" width={38} height={38} radius={19} color="#A1A1AA" accent="#A1A1AA" onClick={onPrev} />
          <TactileButton
            label={isPlaying ? '❚❚' : '▶'}
            width={50} height={50} radius={25}
            color="#09090B" accent="#D97706"
            onClick={onTogglePlay}
          />
          <TactileButton label="⟩" width={38} height={38} radius={19} color="#A1A1AA" accent="#A1A1AA" onClick={onNext} />
          <TactileButton label="≡" width={36} height={36} radius={18} color="#A1A1AA" accent="#A1A1AA" onClick={onOpenPlaylist} />
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
          height: 80px;
          border-radius: 40px;
          backdrop-filter: url(#${dockFilterId});
          -webkit-backdrop-filter: url(#${dockFilterId});
          background: var(--ms-glass-bg);
          border: 1px solid var(--ms-glass-border);
          box-shadow: 0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 var(--ms-glass-highlight);
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
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
            height: 64px; /* 手机端高度紧凑缩减为 64px，更加精致 */
            border-radius: 32px;
            padding: 0 16px;
            gap: 12px;
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 16px 36px rgba(0,0,0,0.4);
            justify-content: space-between; /* 在手机上两端对齐 */
          }

          .desktop-optics-filter {
            display: none !important; /* 隐藏写死 880px 的 SVG 滤镜防止撑大 */
          }

          /* 隐藏时间戳、进度条、分隔线 */
          .playerdock-time-left,
          .playerdock-slider-wrapper,
          .playerdock-time-right,
          .playerdock-divider {
            display: none !important;
          }

          .playerdock-track-info {
            width: auto !important;
            max-width: 140px; /* 手机端防止过长溢出截断 */
            flex-grow: 1;
          }

          .playerdock-controls {
            gap: 4px !important;
          }

          /* 手机底栏隐藏歌单按钮，因为顶栏已经有超精美的 📁 徽章了 */
          .playerdock-controls button:last-child {
            display: none !important;
          }
          
          /* 稍微调整按钮的缩放，适应 64px 手机高度 */
          .playerdock-controls button {
            transform: scale(0.85);
            transform-origin: center;
          }
        }
      `}</style>
    </div>
  );
};
