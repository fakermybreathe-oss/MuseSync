import React, { useState } from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import { LiquidStateProvider } from '../components/LiquidStateContext';
import { LiquidSwitch } from '../components/LiquidSwitch';
import type { PlayerMode, PlatformAuth } from '../types';
import { CARTOON_AVATARS } from '../components/AvatarSelector';
import { LiquidPhysicsWrapper } from '../components/LiquidPhysicsWrapper';
import { useWallpaper } from '../contexts/WallpaperContext';

// 🤖 卡通头像自适应矢量 SVG 与图片 CDN 分流渲染引擎
const renderMemberAvatar = (avatarUrl: string | undefined) => {
  if (avatarUrl && avatarUrl.startsWith('cartoon_avatar_index_')) {
    const idStr = avatarUrl.replace('cartoon_avatar_index_', '');
    const id = parseInt(idStr, 10);
    const avatarItem = CARTOON_AVATARS.find(a => a.id === id);
    if (avatarItem) {
      return (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: avatarItem.bgColor 
        }}>
          {avatarItem.renderSvg()}
        </div>
      );
    }
  }
  return (
    <img 
      src={avatarUrl || 'https://y.gtimg.cn/mediastyle/global/img/album_300.png'} 
      alt="" 
      referrerPolicy="no-referrer"
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
};

interface TopBarProps {
  playerMode: PlayerMode;
  onModeChange: (mode: PlayerMode) => void;
  neteaseAuth: PlatformAuth;
  qqAuth: PlatformAuth;
  onNeteaseLogin: () => void;
  onQQLogin: () => void;
  onOpenPlaylist: () => void;
  roomId: string;
  isPublic?: boolean;
  isHost?: boolean;
  onPublicChange?: (isPublic: boolean) => void;
  immersive?: boolean;
  
  roomMembers?: Array<{
    id: string;
    nickname: string;
    avatar: string;
    rtt: number;
    isHost: boolean;
  }>;
  onJoinRoom?: (roomId: string, password?: string) => void;
  onLeaveRoom?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  playerMode, onModeChange, neteaseAuth, qqAuth,
  onNeteaseLogin, onQQLogin, onOpenPlaylist, roomId,
  isPublic = false,
  isHost = false,
  onPublicChange,
  immersive = false,
  roomMembers = [],
  onJoinRoom,
  onLeaveRoom
}) => {
  const { currentWallpaper, nextWallpaper } = useWallpaper();
  const [showRoomDrawer, setShowRoomDrawer] = useState(false);
  const [roomDraft, setRoomDraft] = useState({ sourceRoomId: roomId, value: roomId });
  const [tempPassword, setTempPassword] = useState('');
  const tempRoomId = roomDraft.sourceRoomId === roomId ? roomDraft.value : roomId;
  const setTempRoomId = (value: string) => {
    setRoomDraft({ sourceRoomId: roomId, value });
  };

  const handleNeteaseClick = () => {
    if (!isHost) {
      if (neteaseAuth.loggedIn) {
        alert('当前网易云账号是由房主登录共享的，仅房主可以进行更换或退登操作哦。');
      }
      return;
    }
    onNeteaseLogin();
  };

  const handleQQClick = () => {
    if (!isHost) {
      if (qqAuth.loggedIn) {
        alert('当前 QQ 音乐账号是由房主登录共享的，仅房主可以进行更换或退登操作哦。');
      }
      return;
    }
    onQQLogin();
  };

  const MODES: { id: PlayerMode; label: string }[] = [
    { id: 'classic', label: 'Classic' },
    { id: 'wave', label: 'Wave' },
  ];

  if (immersive) {
    return (
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 120,
      }}>
        <LiquidSwitch
          id="topbar-mode"
          options={MODES}
          activeId={playerMode}
          onChange={(id) => onModeChange(id as PlayerMode)}
          width={160}
          height={38}
          radius={19}
        />
      </div>
    );
  }

  const handleJoinSubmit = () => {
    if (!tempRoomId.trim()) return;
    if (onJoinRoom) {
      onJoinRoom(tempRoomId.toUpperCase(), tempPassword);
    }
    setShowRoomDrawer(false);
  };

  const getTogetherDistance = () => {
    if (roomMembers.length < 2) return '正在等待对方加入房间...';
    const m1 = roomMembers[0];
    const m2 = roomMembers[1];
    const maxRtt = Math.max(m1.rtt, m2.rtt);
    
    if (maxRtt > 50) {
      const km = Math.floor(maxRtt * 9.6 + 680);
      return `✈️ 异域同步 | 物理相距 ${km} 公里 (延时 ${maxRtt}ms)`;
    } else {
      const msVal = maxRtt || 2;
      return `🏡 咫尺同频 | 物理零距离 (延时 ${msVal}ms)`;
    }
  };

  const getCompactTogetherDistance = () => {
    if (roomMembers.length < 2) return '等待对方';
    const maxRtt = Math.max(roomMembers[0]?.rtt || 0, roomMembers[1]?.rtt || 0);
    if (maxRtt > 50) {
      return `${Math.floor(maxRtt * 9.6 + 680)} km · ${maxRtt} ms`;
    }
    return `同频 · ${maxRtt || 2} ms`;
  };

  const isTogether = roomMembers.length >= 2;

  // 动态计算极光延迟变色呼吸灯参数
  const getAuroraParams = () => {
    if (!isTogether) return { color: 'rgba(255, 255, 255, 0.15)', shadow: '0 0 8px rgba(255, 255, 255, 0.05)' };
    const m1 = roomMembers[0];
    const m2 = roomMembers[1];
    const maxRtt = Math.max(m1?.rtt || 0, m2?.rtt || 0);

    if (maxRtt < 50) {
      return {
        color: 'hsla(145, 80%, 55%, 0.95)',
        shadow: '0 0 14px hsla(145, 80%, 55%, 0.65)'
      };
    } else if (maxRtt <= 150) {
      return {
        color: 'hsla(200, 90%, 55%, 0.95)',
        shadow: '0 0 14px hsla(200, 90%, 55%, 0.65)'
      };
    } else {
      return {
        color: 'hsla(340, 95%, 65%, 0.95)',
        shadow: '0 0 14px hsla(340, 95%, 65%, 0.65)'
      };
    }
  };

  const aurora = getAuroraParams();

  return (
    <LiquidStateProvider
      initialState={{
        surfaceType: 'convex_squircle',
        bezelWidth: 18,
        glassThickness: 150,
        specularOpacity: 0.86,
        specularSaturation: 1.3,
        refractionLevel: 1.18,
        blurLevel: 0.25,
      }}
    >
      <div className="musesync-topbar">
      <div className="topbar-left-group">
        
        {/* 🚪 退出当前房间，返回登录门脸水晶大堂的极简亚克力返回按钮 */}
        <div style={{ position: 'relative' }}>
          <div className="desktop-optics-filter">
            <OpticsFilter id="tb-leave" width={40} height={36} radius={18} />
          </div>
          <LiquidPhysicsWrapper 
            onClick={onLeaveRoom} 
            className="topbar-btn leave-btn"
            title="退出当前听歌舱，返回欢迎大堂"
            style={{ padding: '0', width: '36px', justifyContent: 'center', display: 'flex', alignItems: 'center', WebkitBackdropFilter: 'url(#tb-leave)', backdropFilter: 'url(#tb-leave)' }}
          >
            <div className="glass-glossy-overlay" />
            <span className="icon" style={{ fontSize: '0.9rem', marginRight: '0', zIndex: 2, position: 'relative' }}>↩</span>
          </LiquidPhysicsWrapper>
        </div>

        <div style={{ position: 'relative' }}>
            <div className="desktop-optics-filter">
              <OpticsFilter id="tb-room" width={200} height={36} radius={18} />
            </div>
            <button
              type="button"
              className="topbar-room-badge cursor-pointer"
              onClick={() => setShowRoomDrawer(!showRoomDrawer)}
              aria-expanded={showRoomDrawer}
              aria-label="房间连接信息"
            >
              <div className="topbar-room-badge__content">
                <div className="pulse-dot" />
                <span className="mono room-text" style={{ fontSize: '0.72rem', color: 'var(--ms-text-primary)', fontWeight: 500 }}>
                  {!isPublic ? '🔒 ' : ''}ROOM {roomId}
                </span>
                <span className="status-text" style={{ fontSize: '0.68rem', color: 'var(--ms-success)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  CONNECTED
                </span>
              </div>
            </button>

          {showRoomDrawer && (
            <div className="room-popover-card">
              <div className="popover-title">🌐 异地通道连接舱</div>
              
              <div className="popover-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="checkbox" 
                  id="popover-is-public"
                  checked={isPublic}
                  disabled={!isHost}
                  onChange={(e) => onPublicChange && onPublicChange(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: isHost ? 'pointer' : 'not-allowed' }}
                />
                <label htmlFor="popover-is-public" style={{ cursor: isHost ? 'pointer' : 'not-allowed', userSelect: 'none' }}>
                  公开此房间到大厅 {!isHost && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>(仅房主可调)</span>}
                </label>
              </div>

              <div className="popover-field">
                <label>通道房间号</label>
                <input 
                  type="text" 
                  value={tempRoomId} 
                  onChange={(e) => setTempRoomId(e.target.value.toUpperCase())}
                  placeholder="如 UMYC3X"
                />
              </div>
              <div className="popover-field">
                <label>加密通行密码 (可选)</label>
                <input 
                  type="password" 
                  value={tempPassword} 
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="留空为公开房间"
                />
              </div>
              <div className="popover-buttons">
                <button className="confirm-btn" onClick={handleJoinSubmit}>穿透同频</button>
                <button className="close-btn" onClick={() => setShowRoomDrawer(false)}>取消</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <div className="desktop-optics-filter">
            <OpticsFilter id="tb-ne" width={neteaseAuth.loggedIn ? 140 : (isHost ? 110 : 90)} height={36} radius={18} />
          </div>
          <LiquidPhysicsWrapper 
            onClick={handleNeteaseClick} 
            className={`topbar-btn login-btn ${neteaseAuth.loggedIn ? 'is-authenticated' : ''}`}
            disabled={!(isHost || neteaseAuth.loggedIn)}
            style={{ 
              cursor: (isHost || neteaseAuth.loggedIn) ? 'pointer' : 'default', 
              opacity: (neteaseAuth.loggedIn || isHost) ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              WebkitBackdropFilter: 'url(#tb-ne)',
              backdropFilter: 'url(#tb-ne)'
            }}
          >
            <div className="glass-glossy-overlay" />
            <div className="platform-auth-content" style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2, position: 'relative' }}>
              <span className="icon">♫</span>
              {neteaseAuth.loggedIn ? (
                <>
                  <img className="platform-login-avatar" src={neteaseAuth.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                  <span className="username" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{neteaseAuth.nickname}</span>
                  <div className="platform-login-status" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ms-success)', flexShrink: 0 }} />
                </>
              ) : (
                <span className="btn-text">{isHost ? '网易云登录' : '未绑定账号'}</span>
              )}
            </div>
          </LiquidPhysicsWrapper>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="desktop-optics-filter">
            <OpticsFilter id="tb-qq" width={qqAuth.loggedIn ? 140 : (isHost ? 110 : 90)} height={36} radius={18} />
          </div>
          <LiquidPhysicsWrapper 
            onClick={handleQQClick} 
            className={`topbar-btn login-btn ${qqAuth.loggedIn ? 'is-authenticated' : ''}`}
            disabled={!(isHost || qqAuth.loggedIn)}
            style={{ 
              cursor: (isHost || qqAuth.loggedIn) ? 'pointer' : 'default', 
              opacity: (qqAuth.loggedIn || isHost) ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              WebkitBackdropFilter: 'url(#tb-qq)',
              backdropFilter: 'url(#tb-qq)'
            }}
          >
            <div className="glass-glossy-overlay" />
            <div className="platform-auth-content" style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2, position: 'relative' }}>
              <span className="icon">♪</span>
              {qqAuth.loggedIn ? (
                <>
                  <img className="platform-login-avatar" src={qqAuth.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                  <span className="username" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{qqAuth.nickname}</span>
                  <div className="platform-login-status" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ms-success)', flexShrink: 0 }} />
                </>
              ) : (
                <span className="btn-text">{isHost ? 'QQ登录' : '未绑定账号'}</span>
              )}
            </div>
          </LiquidPhysicsWrapper>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="desktop-optics-filter">
            <OpticsFilter id="tb-pl" width={80} height={36} radius={18} />
          </div>
          <LiquidPhysicsWrapper 
            onClick={onOpenPlaylist} 
            className="topbar-btn playlist-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitBackdropFilter: 'url(#tb-pl)', backdropFilter: 'url(#tb-pl)' }}
          >
            <div className="glass-glossy-overlay" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2, position: 'relative' }}>
              <span className="mobile-only-icon" style={{ display: 'none' }}>📁</span>
              <span className="btn-text">歌单</span>
            </div>
          </LiquidPhysicsWrapper>
        </div>

      </div>

      <div className="together-cabin-container" style={{ position: 'relative' }}>
        <div className="desktop-optics-filter">
          <OpticsFilter id="tb-cabin" width={480} height={38} radius={19} />
        </div>
        <LiquidPhysicsWrapper 
          className={`together-cabin-glass ${isTogether ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', width: '100%', WebkitBackdropFilter: 'url(#tb-cabin)', backdropFilter: 'url(#tb-cabin)' }}
        >
          <div className="glass-glossy-overlay" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', zIndex: 2, position: 'relative' }}>
            {isTogether && (
              <div 
                className="together-aurora-glow" 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: aurora.color,
                  boxShadow: aurora.shadow,
                  animation: 'aurora-pulse 2s ease-in-out infinite',
                  transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                  flexShrink: 0
                }} 
              />
            )}
            <div className="together-avatars">
              <div className="avatar-wrapper my-avatar">
                {renderMemberAvatar(roomMembers[0]?.avatar)}
              </div>
              <div className={`avatar-wrapper partner-avatar ${isTogether ? 'spring-in' : 'waiting'}`}>
                {isTogether ? (
                  renderMemberAvatar(roomMembers[1]?.avatar)
                ) : (
                  <div className="waiting-placeholder">
                    <span className="plus">+</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="together-info">
              <div className="distance-label">
                <span className="distance-label-full">{getTogetherDistance()}</span>
                <span className="distance-label-compact">{getCompactTogetherDistance()}</span>
              </div>
              {isTogether && (
                <div className="members-badge">
                  {roomMembers[0]?.nickname} 💘 {roomMembers[1]?.nickname}
                </div>
              )}
            </div>
          </div>
        </LiquidPhysicsWrapper>
      </div>

      <div className="topbar-right-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <div className="desktop-optics-filter">
            <OpticsFilter id="tb-wp" width={38} height={38} radius={19} />
          </div>
          <LiquidPhysicsWrapper
            onClick={nextWallpaper}
            className="topbar-btn wallpaper-btn"
            style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitBackdropFilter: 'url(#tb-wp)', backdropFilter: 'url(#tb-wp)' }}
            title={`切换壁纸: ${currentWallpaper.name}`}
          >
          <div className="glass-glossy-overlay" />
          <svg style={{ zIndex: 2, position: 'relative', width: '18px', height: '18px', color: 'var(--ms-text-primary, #fff)', opacity: 0.85 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
            <circle cx="8.5" cy="8.5" r="2" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </LiquidPhysicsWrapper>
        </div>

        <div className="mode-switch-wrapper" style={{ position: 'relative' }}>
          <div className="desktop-optics-filter">
            <OpticsFilter id="tb-mode" width={160} height={38} radius={19} />
          </div>
          <div style={{ WebkitBackdropFilter: 'url(#tb-mode)', backdropFilter: 'url(#tb-mode)', borderRadius: '19px' }}>
            <LiquidSwitch
              id="topbar-mode"
            options={MODES}
            activeId={playerMode}
            onChange={(id) => onModeChange(id as PlayerMode)}
            width={160}
            height={38}
            radius={19}
          />
        </div>
      </div>
    </div>

      <style>{`
        .musesync-topbar {
          position: fixed;
          top: 24px;
          left: 48px;
          right: 48px;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s ease;
        }

        .topbar-left-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .desktop-optics-filter {
          display: block;
        }

        .topbar-room-badge {
          width: 200px;
          min-width: 200px;
          height: 36px;
          padding: 0 16px;
          box-sizing: border-box;
          border-radius: 18px;
          backdrop-filter: url(#tb-room);
          -webkit-backdrop-filter: url(#tb-room);
          border: 0;
          appearance: none;
          background: rgba(255, 255, 255, 0.018) !important;
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.15),
            inset 0 1.6px 16px rgba(0, 0, 0, 0.09),
            inset 0 -1.6px 16px rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          color: var(--ms-text-primary);
          font-family: inherit;
          cursor: pointer;
          user-select: none;
          touch-action: manipulation;
          transform-origin: center center;
          transition:
            transform 180ms cubic-bezier(0.25, 1, 0.5, 1),
            background-color 180ms ease,
            box-shadow 180ms ease;
        }

        .topbar-room-badge__content {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-width: 0;
        }

        .topbar-room-badge:hover {
          background: rgba(255, 255, 255, 0.028) !important;
          box-shadow:
            2px 10px 22px rgba(0, 0, 0, 0.2),
            inset 0.6px 2.4px 16px rgba(0, 0, 0, 0.11),
            inset -0.6px -2.4px 16px rgba(255, 255, 255, 0.16);
        }

        .topbar-room-badge:active {
          transform: translateY(1px) scale(1.018, 0.94);
          background: rgba(255, 255, 255, 0.012) !important;
        }

        .topbar-room-badge:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.42);
          outline-offset: 3px;
        }

        .room-popover-card {
          position: absolute;
          top: 48px;
          left: 0;
          width: 260px;
          background: rgba(20, 20, 20, 0.75);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          z-index: 200;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: slide-popover 0.3s cubic-bezier(0.19, 1, 0.22, 1);
        }

        @keyframes slide-popover {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .popover-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--ms-text-primary);
          letter-spacing: 0.05em;
        }

        .popover-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .popover-field label {
          font-size: 0.65rem;
          color: var(--ms-text-secondary);
        }

        .popover-field input {
          height: 32px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--ms-text-primary);
          padding: 0 10px;
          font-size: 0.75rem;
          outline: none;
          transition: all 0.3s ease;
        }

        .popover-field input:focus {
          border-color: var(--ms-highlight);
          box-shadow: 0 0 8px rgba(255,255,255,0.15);
        }

        .popover-buttons {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .popover-buttons button {
          flex: 1;
          height: 30px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .confirm-btn {
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(200,200,200,0.8));
          color: #000;
        }

        .confirm-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255,255,255,0.25);
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.1);
          color: var(--ms-text-primary);
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ms-success);
          box-shadow: 0 0 8px var(--ms-success);
          animation: pulse-breathe 2s ease-in-out infinite;
        }

        .topbar-btn {
          height: 36px;
          border-radius: 18px;
          border: 0;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.018) !important;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.15),
            inset 0 1.6px 16px rgba(0, 0, 0, 0.09),
            inset 0 -1.6px 16px rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--ms-text-primary);
          font-size: 0.75rem;
          font-weight: 600;
          font-family: inherit;
          position: relative;
          overflow: hidden;
          transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }

        .topbar-btn:hover {
          background: rgba(255, 255, 255, 0.028) !important;
          box-shadow: 
            2px 10px 22px rgba(0, 0, 0, 0.2),
            inset 0.6px 2.4px 16px rgba(0, 0, 0, 0.11),
            inset -0.6px -2.4px 16px rgba(255, 255, 255, 0.16);
        }

        .login-btn {
          padding: 0 16px;
        }

        .playlist-btn {
          padding: 0 20px;
        }

        .together-cabin-container {
          flex: 1;
          max-width: 480px;
          display: flex;
          justify-content: center;
          margin: 0 20px;
        }

        .together-cabin-glass {
          height: 38px;
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.018) !important;
          border: 0;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.15),
            inset 0 1.6px 16px rgba(0, 0, 0, 0.09),
            inset 0 -1.6px 16px rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          width: 100%;
          position: relative;
          overflow: hidden;
          transition: background-color 0.5s cubic-bezier(0.19, 1, 0.22, 1), box-shadow 0.5s cubic-bezier(0.19, 1, 0.22, 1);
        }

        /* 🚀 两个人合体时，长舱触发极佳的“液态软糖/布丁”物理弹性形变动画 */
        .together-cabin-glass.active {
          background: rgba(255, 255, 255, 0.028) !important;
          box-shadow: 
            0 12px 36px rgba(0, 0, 0, 0.35), 
            0 0 18px rgba(255, 255, 255, 0.1),
            inset 0 1px 2px rgba(255, 255, 255, 0.35),
            inset 0 -1.5px 2px rgba(0, 0, 0, 0.45),
            inset 0 0 8px rgba(255, 255, 255, 0.12);
          animation: cabin-pudding-bounce 0.85s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          transform-origin: center center;
        }

        @keyframes cabin-pudding-bounce {
          0% { transform: scaleX(1) scaleY(1); }
          15% { transform: scaleX(1.05) scaleY(0.92); } /* 碰撞挤压变扁 */
          35% { transform: scaleX(0.97) scaleY(1.03); } /* 回缩反弹 */
          55% { transform: scaleX(1.02) scaleY(0.98); } /* 微小震荡 */
          75% { transform: scaleX(0.99) scaleY(1.01); }
          100% { transform: scaleX(1) scaleY(1); }
        }

        .together-avatars {
          display: flex;
          align-items: center;
        }

        .avatar-wrapper {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.2);
          border: 1.5px solid rgba(255, 255, 255, 0.85);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .my-avatar {
          z-index: 10;
        }

        .partner-avatar {
          margin-left: 8px;
          z-index: 9;
        }

        .partner-avatar.spring-in {
          margin-left: -6px;
          animation: avatar-bounce-in 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          border-color: rgba(255, 255, 255, 0.95); /* 剥离绿边，升级为通透晶莹白 */
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.45);
        }

        @keyframes avatar-bounce-in {
          0% { transform: scale(0.2) translateX(40px); opacity: 0; }
          70% { transform: scale(1.15) translateX(-3px); }
          100% { transform: scale(1) translateX(0); opacity: 1; }
        }

        .partner-avatar.waiting {
          border-style: dashed;
          background: transparent;
          border-color: rgba(255, 255, 255, 0.3);
          box-shadow: none;
        }

        .partner-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .my-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .waiting-placeholder {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.45);
          font-weight: 700;
          animation: pulse-waiting 1.5s ease-in-out infinite;
        }

        @keyframes pulse-waiting {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }

        .together-info {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .distance-label {
          font-size: 0.68rem;
          font-weight: 500;
          color: var(--ms-text-primary);
          letter-spacing: 0.02em;
          animation: breathe-together 3s ease-in-out infinite;
        }

        .distance-label-compact {
          display: none;
        }

        .members-badge {
          font-size: 0.55rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.05em;
          margin-top: 1px;
        }

        @keyframes breathe-together {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }

        @keyframes aurora-pulse {
          0%, 100% { opacity: 0.65; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @media (max-width: 992px) {
          .together-cabin-container {
            display: none !important;
          }
        }

        @media (max-width: 768px) {
          .musesync-topbar {
            top: 12px;
            left: 12px;
            right: 12px;
            justify-content: space-between;
          }

          .together-cabin-container {
            display: none !important;
          }

          .topbar-left-group {
            gap: 6px;
          }

          .desktop-optics-filter {
            display: none !important;
          }

          .topbar-room-badge {
            width: auto;
            min-width: 0;
            padding: 0 10px;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(255, 255, 255, 0.018) !important;
            border: 0 !important;
            box-shadow:
              0 4px 12px rgba(0,0,0,0.18),
              inset 0 1.2px 12px rgba(0,0,0,0.08),
              inset 0 -1.2px 12px rgba(255,255,255,0.12) !important;
          }

          .topbar-room-badge__content {
            gap: 6px;
          }

          .topbar-room-badge .room-text {
            font-size: 0.65rem !important;
          }

          .topbar-room-badge .status-text {
            display: none !important;
          }

          .topbar-btn {
            height: 36px;
            width: 36px;
            border-radius: 50%;
            padding: 0 !important;
            justify-content: center;
            align-items: center;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(255, 255, 255, 0.005) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2) !important;
          }

          .topbar-btn .btn-text, .topbar-btn .username {
            display: none !important;
          }

          .topbar-btn .icon {
            font-size: 0.9rem;
          }

          .playlist-btn .mobile-only-icon {
            display: inline-block !important;
            font-size: 0.85rem;
          }

          .login-btn img {
            width: 22px !important;
            height: 22px !important;
            margin: 0 !important;
          }

          .login-btn {
            width: 32px;
            height: 32px;
          }

          .login-btn .platform-auth-content {
            width: 100%;
            height: 100%;
            justify-content: center;
            gap: 0 !important;
          }

          .login-btn.is-authenticated .icon {
            display: none;
          }

          .login-btn.is-authenticated .platform-login-avatar {
            width: 24px !important;
            height: 24px !important;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.52);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
          }

          .login-btn .platform-login-status {
            position: absolute;
            bottom: 1px;
            right: 1px;
            width: 8px !important;
            height: 8px !important;
            box-sizing: border-box;
            border: 1.5px solid rgba(24, 52, 62, 0.82);
            box-shadow: 0 0 6px rgba(65, 232, 139, 0.56);
          }

          .mode-switch-wrapper {
            transform: scale(0.8);
            transform-origin: right center;
          }

          .topbar-left-group {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
          }

          .mode-switch-wrapper {
            flex: 0 0 96px;
            width: 96px;
            height: 38px;
            margin-left: 8px;
            overflow: visible;
            transform: none;
          }

          .mode-switch-wrapper > [data-switch-id="topbar-mode"] {
            transform: scale(0.6);
            transform-origin: left center;
          }
        }

        @media (min-width: 560px) and (max-width: 768px) {
          .topbar-left-group {
            flex: 0 1 auto;
          }

          .together-cabin-container {
            display: flex !important;
            flex: 0 1 190px;
            width: min(190px, 28vw);
            min-width: 142px;
            max-width: 190px;
            margin: 0 6px;
          }

          .together-cabin-glass {
            width: 100%;
            height: 32px;
            min-height: 32px;
            padding: 0 10px;
            border-radius: 16px;
            gap: 7px;
            background: rgba(255, 255, 255, 0.012) !important;
            border-color: rgba(255, 255, 255, 0.18);
            box-shadow:
              0 6px 16px rgba(0, 0, 0, 0.14),
              inset 0 1px 0 rgba(255, 255, 255, 0.3),
              inset 0 -1px 0 rgba(255, 255, 255, 0.08);
          }

          .together-cabin-glass > .glass-glossy-overlay {
            opacity: 0.4;
          }

          .together-cabin-glass > div {
            gap: 7px !important;
          }

          .together-aurora-glow {
            width: 6px !important;
            height: 6px !important;
          }

          .together-avatars {
            flex: 0 0 auto;
          }

          .avatar-wrapper {
            width: 20px;
            height: 20px;
            border-width: 1px;
          }

          .partner-avatar {
            margin-left: -5px;
          }

          .together-info {
            min-width: 0;
          }

          .distance-label {
            max-width: 112px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 0.58rem;
            letter-spacing: 0;
          }

          .distance-label-full,
          .members-badge {
            display: none !important;
          }

          .distance-label-compact {
            display: inline;
          }

          .mode-switch-wrapper {
            margin-left: 0;
          }
        }
      `}</style>
      </div>
    </LiquidStateProvider>
  );
};
