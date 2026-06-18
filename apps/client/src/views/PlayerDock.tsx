import React, { useEffect, useRef, useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { FluidSlider } from './FluidSlider';
import { TactileButton } from './TactileButton';
import type { Track } from '../types';
import { Spring } from '../utils/spring';

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

const MOBILE_VOLUME_TRACK_HEIGHT = 70;
const MOBILE_VOLUME_THUMB_WIDTH = 30;
const MOBILE_VOLUME_THUMB_HEIGHT = 28;
const MOBILE_VOLUME_MIN_CENTER = 9;
const MOBILE_VOLUME_MAX_CENTER = MOBILE_VOLUME_TRACK_HEIGHT - 9;
const MOBILE_VOLUME_TRAVEL = MOBILE_VOLUME_MAX_CENTER - MOBILE_VOLUME_MIN_CENTER;

interface VerticalFluidVolumeProps {
  value: number;
  onChange: (value: number) => void;
}

const VerticalFluidVolume: React.FC<VerticalFluidVolumeProps> = ({ value, onChange }) => {
  const filterId = 'mobile-volume-thumb-filter';
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);
  const initialValue = Math.max(0, Math.min(1, value));
  const valueRef = useRef(initialValue);
  const springs = useRef({
    y: new Spring(MOBILE_VOLUME_MAX_CENTER - initialValue * MOBILE_VOLUME_TRAVEL, 220, 24),
    scale: new Spring(0.68, 360, 25),
  });

  useEffect(() => {
    valueRef.current = Math.max(0, Math.min(1, value));
    if (!dragRef.current) {
      springs.current.y.setTarget(MOBILE_VOLUME_MAX_CENTER - valueRef.current * MOBILE_VOLUME_TRAVEL);
    }
  }, [value]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;

      const y = dragRef.current ? springs.current.y.value : springs.current.y.update(dt);
      const scale = springs.current.scale.update(dt);

      if (thumbRef.current) {
        thumbRef.current.style.transform = `translate3d(0, ${y - MOBILE_VOLUME_THUMB_HEIGHT / 2}px, 0) scale(${scale})`;
      }
      if (fillRef.current) {
        const ratio = Math.max(0, Math.min(1, (MOBILE_VOLUME_MAX_CENTER - y) / MOBILE_VOLUME_TRAVEL));
        fillRef.current.style.height = `${ratio * 100}%`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const updateFromPointer = (clientY: number) => {
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = Math.max(MOBILE_VOLUME_MIN_CENTER, Math.min(MOBILE_VOLUME_MAX_CENTER, clientY - rect.top));
    springs.current.y.value = y;
    springs.current.y.velocity = 0;
    const nextValue = Math.max(0, Math.min(1, (MOBILE_VOLUME_MAX_CENTER - y) / MOBILE_VOLUME_TRAVEL));
    valueRef.current = nextValue;
    onChange(nextValue);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = true;
    springs.current.scale.setTarget(0.94);
    updateFromPointer(event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    updateFromPointer(event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = false;
    springs.current.scale.setTarget(0.68);
    springs.current.y.setTarget(MOBILE_VOLUME_MAX_CENTER - valueRef.current * MOBILE_VOLUME_TRAVEL);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 0.05
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -0.05
        : 0;
    if (!delta) return;
    event.preventDefault();
    const nextValue = Math.max(0, Math.min(1, valueRef.current + delta));
    valueRef.current = nextValue;
    springs.current.y.setTarget(MOBILE_VOLUME_MAX_CENTER - nextValue * MOBILE_VOLUME_TRAVEL);
    onChange(nextValue);
  };

  return (
    <div
      ref={sliderRef}
      className="mobile-volume-fluid-slider"
      role="slider"
      aria-label="音量"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <OpticsFilter
        id={filterId}
        width={MOBILE_VOLUME_THUMB_WIDTH}
        height={MOBILE_VOLUME_THUMB_HEIGHT}
        radius={MOBILE_VOLUME_THUMB_HEIGHT / 2}
      />
      <div className="mobile-volume-track">
        <div ref={fillRef} className="mobile-volume-fill" style={{ height: `${value * 100}%` }} />
      </div>
      <div ref={thumbRef} className="mobile-volume-thumb" />
    </div>
  );
};

export const PlayerDock: React.FC<PlayerDockProps> = ({
  currentTrack, isPlaying, progress, currentTime, duration,
  onTogglePlay, onSeek, onPrev, onNext, onOpenPlaylist,
  playMode = 'loop', onModeChange, volume = 0.8, onVolumeChange,
}) => {
  const dockFilterId = 'player-dock-filter';
  /** 是否处于静音状态（记录静音前的音量用于恢复） */
  const [isCompactDock, setIsCompactDock] = useState(() => window.innerWidth <= 768);
  const [dockRenderWidth, setDockRenderWidth] = useState(() => Math.min(1040, Math.max(296, window.innerWidth - 24)));
  const [mutedVolume, setMutedVolume] = useState<number | null>(null);
  const lastAudibleVolumeRef = useRef(volume > 0 ? volume : 0.8);
  const dockPanelRef = useRef<HTMLDivElement>(null);
  const dockSprings = useRef({
    scaleX: new Spring(1, 310, 20),
    scaleY: new Spring(1, 330, 22),
    translateY: new Spring(0, 330, 22),
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => {
      setIsCompactDock(media.matches);
      setDockRenderWidth(media.matches
        ? Math.max(296, window.innerWidth - 24)
        : 1040);
    };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    if (volume > 0) lastAudibleVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const loop = (time: number) => {
      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.032) dt = 0.032;
      if (dt <= 0) dt = 1 / 120;

      const scaleX = dockSprings.current.scaleX.update(dt);
      const scaleY = dockSprings.current.scaleY.update(dt);
      const translateY = dockSprings.current.translateY.update(dt);
      if (dockPanelRef.current) {
        dockPanelRef.current.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const pressDock = () => {
    if (!isCompactDock) return;
    dockSprings.current.scaleX.setTarget(1.012);
    dockSprings.current.scaleY.setTarget(0.975);
    dockSprings.current.translateY.setTarget(1.5);
  };

  const releaseDock = () => {
    dockSprings.current.scaleX.setTarget(1);
    dockSprings.current.scaleY.setTarget(1);
    dockSprings.current.translateY.setTarget(0);
  };

  /** 静音 / 取消静音 */
  const handleMuteToggle = () => {
    if (mutedVolume !== null || volume === 0) {
      // 取消静音：恢复之前的音量
      onVolumeChange?.(mutedVolume && mutedVolume > 0 ? mutedVolume : lastAudibleVolumeRef.current);
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
      <div className="playerdock-optics-filter">
        <OpticsFilter
          id={dockFilterId}
          width={dockRenderWidth}
          height={isCompactDock ? 144 : DOCK_HEIGHT}
          radius={isCompactDock ? 28 : DOCK_RADIUS}
        />
      </div>

      <div
        ref={dockPanelRef}
        className="playerdock-glass-panel"
        onPointerDown={pressDock}
        onPointerUp={releaseDock}
        onPointerCancel={releaseDock}
        onPointerLeave={releaseDock}
      >
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
                onChangeEnd={onSeek}
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
            <button
              type="button"
              className="playerdock-volume-trigger"
              aria-label={isMuted ? '取消静音' : '静音'}
              onClick={handleMuteToggle}
            >
              {speakerIcon}
            </button>
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
            <div className="playerdock-mobile-volume-slider">
              <VerticalFluidVolume
                value={isMuted ? 0 : volume}
                onChange={(nextVolume) => {
                  setMutedVolume(null);
                  onVolumeChange?.(nextVolume);
                }}
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

        .playerdock-optics-filter {
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
          position: relative;
          transform-origin: center bottom;
          will-change: transform;
        }

        .playerdock-volume-trigger {
          width: 20px;
          height: 32px;
          padding: 0;
          border: 0;
          appearance: none;
          background: transparent;
          color: var(--ms-text-secondary);
          font-size: 1.1rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .playerdock-mobile-volume-slider {
          display: none;
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
            backdrop-filter: url(#${dockFilterId});
            -webkit-backdrop-filter: url(#${dockFilterId});
            background: rgba(255, 255, 255, 0.012);
            border: 1px solid rgba(255, 255, 255, 0.24);
            box-shadow:
              0 16px 36px rgba(0, 0, 0, 0.18),
              inset 0 1.5px 0 rgba(255, 255, 255, 0.46),
              inset 0 -1.5px 0 rgba(255, 255, 255, 0.1),
              inset 0 0 20px rgba(255, 255, 255, 0.025);
            justify-content: space-between;
            gap: 0;
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
            padding-right: 38px;
          }

          .playerdock-right-controls > div:not(.playerdock-volume) {
            min-width: 44px;
            min-height: 44px;
            display: flex !important;
            align-items: center;
            justify-content: center;
          }

          .playerdock-volume {
            position: absolute;
            top: 8px;
            right: 8px;
            z-index: 4;
            width: 32px;
            height: 118px;
            min-width: 32px;
            min-height: 118px;
            margin-right: 0 !important;
            gap: 2px !important;
            flex-direction: column;
            align-items: center !important;
            justify-content: flex-start !important;
          }

          .playerdock-volume-slider {
            display: none !important;
          }

          .playerdock-mobile-volume-slider {
            display: flex;
            align-items: flex-start;
            justify-content: center;
          }

          .playerdock-volume-trigger {
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
            border-radius: 14px;
            color: rgba(255, 255, 255, 0.78);
            background: rgba(255, 255, 255, 0.018);
            border: 1px solid rgba(255, 255, 255, 0.16);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.32),
              0 4px 10px rgba(0, 0, 0, 0.12);
            font-size: 0.82rem;
          }

          .mobile-volume-fluid-slider {
            position: relative;
            width: 32px;
            height: 70px;
            cursor: ns-resize;
            touch-action: none;
            outline: none;
          }

          .mobile-volume-fluid-slider:focus-visible {
            outline: 2px solid rgba(255, 255, 255, 0.42);
            outline-offset: 2px;
            border-radius: 16px;
          }

          .mobile-volume-track {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 50%;
            width: 5px;
            transform: translateX(-50%);
            overflow: hidden;
            border-radius: 999px;
            background: rgba(3, 18, 24, 0.34);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow:
              inset 0 1px 3px rgba(0, 0, 0, 0.34),
              0 0 8px rgba(255, 255, 255, 0.04);
          }

          .mobile-volume-fill {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: inherit;
            background: linear-gradient(180deg, rgba(141, 211, 255, 0.9), rgba(77, 163, 255, 0.76));
            box-shadow: 0 0 9px rgba(93, 181, 255, 0.48);
          }

          .mobile-volume-thumb {
            position: absolute;
            top: 0;
            left: 1px;
            width: 30px;
            height: 28px;
            border-radius: 14px;
            transform: translate3d(0, 0, 0) scale(0.68);
            transform-origin: center;
            backdrop-filter: url(#mobile-volume-thumb-filter);
            -webkit-backdrop-filter: url(#mobile-volume-thumb-filter);
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(255, 255, 255, 0.92);
            box-shadow:
              0 5px 12px rgba(0, 0, 0, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 1),
              inset 0 -2px 3px rgba(112, 145, 164, 0.18);
            pointer-events: none;
            will-change: transform;
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
