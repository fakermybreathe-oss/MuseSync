import React, { useState, useEffect } from 'react';
import type { PlatformAuth } from '../types';
import { AvatarSelector, CARTOON_AVATARS } from '../components/AvatarSelector';
import { ElasticGlassButton, ElasticGlassInput } from '../components/ElasticGlassControls';
import { OpticalGlassSurface } from '../components/OpticalGlassSurface';
import { supabase, isSupabaseAvailable, fetchActiveRooms, type PublicRoom } from '../utils/supabaseClient';
import {
  readCachedUserProfile,
  writeCachedUserProfile
} from '../utils/profileCache';
/* eslint-disable react-hooks/set-state-in-effect */
import { useAuth } from '../auth/AuthContext';

interface WelcomePortalProps {
  onJoin: (roomId: string, password?: string, isPublic?: boolean) => Promise<void> | void;
  onCreate: (password?: string, isPublic?: boolean) => Promise<void> | void;
  isLoading: boolean;
  neteaseAuth: PlatformAuth;
  qqAuth: PlatformAuth;
  initialRoomId: string;
}

export const WelcomePortal: React.FC<WelcomePortalProps> = ({
  onJoin,
  onCreate,
  isLoading,
  neteaseAuth,
  qqAuth,
  initialRoomId
}) => {
  const {
    user,
    profile,
    profileLoading,
    profileError: cloudProfileError,
    saveUserProfile
  } = useAuth();
  const userId = user?.id ?? null;
  const [roomIdInput, setRoomIdInput] = useState(initialRoomId || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  /* ─── 临时 Profile 状态 (新增) ─── */
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(0); // 默认选 0 (皮卡丘)
  const [nicknameError, setNicknameError] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const isProfileBusy = isLoading || profileLoading || isSavingProfile;

  // 联动逻辑：有密码时自动关闭公开选项且不可更改
  useEffect(() => {
    if (usePassword) {
      setIsPublic(false);
    }
  }, [usePassword]);

  // 页面加载时自动从 localStorage 恢复上一次设置过的个人昵称和头像
  useEffect(() => {
    if (!userId) return;

    try {
      const cachedProfile = readCachedUserProfile(localStorage, userId);
      if (!cachedProfile) return;
      setNickname(cachedProfile.nickname);
      setAvatarId(cachedProfile.avatarId);
    } catch (e) {
      console.error('读取本地 Profile 缓存失败', e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || profileLoading || cloudProfileError) return;

    if (!profile) {
      setNickname('');
      setAvatarId(0);
      return;
    }

    setNickname(profile.displayName || '');
    setAvatarId(profile.avatarIndex);
    try {
      const selectedAvatar = CARTOON_AVATARS.find(a => a.id === profile.avatarIndex) || CARTOON_AVATARS[0];
      writeCachedUserProfile(localStorage, userId, {
        nickname: profile.displayName || '',
        avatarId: profile.avatarIndex,
        avatarName: selectedAvatar.name
      });
    } catch (e) {
      console.error('写入本地 Profile 缓存失败', e);
    }
  }, [cloudProfileError, profile, profileLoading, userId]);

  const toProfileMessage = (error: string, action: '读取' | '保存') => {
    const normalized = error.toLowerCase();
    const prefix = action === '读取' ? '云端资料读取失败' : '资料保存失败';

    if (normalized.includes('row-level security') || normalized.includes('permission denied')) {
      return `${prefix}：当前账号没有 profiles 表权限，请检查 RLS 策略。`;
    }
    if (normalized.includes('avatar_index')) return `${prefix}：数据库还没有 avatar_index 字段。`;
    if (normalized.includes('pgrst205') || normalized.includes('profiles')) {
      return `${prefix}：Supabase 还没有应用 profiles 表迁移。`;
    }
    if (normalized.includes('supabase')) return `Supabase 还没有配置，无法${action}资料。`;
    if (error.includes('网络异常')) return error;
    return `${prefix}，请稍后再试。`;
  };

  const profileLoadError = cloudProfileError
    ? toProfileMessage(cloudProfileError, '读取')
    : '';

  // 统一的 Profile 校验和写入方法，创建或加入房间前必须完成云端保存。
  const validateAndSaveProfile = async (): Promise<boolean> => {
    const trimmedNickname = nickname.trim();
    setProfileSaveError('');

    if (!trimmedNickname) {
      setNicknameError(true);
      // 触发轻微的错误抖动反馈
      setTimeout(() => setNicknameError(false), 800);
      setProfileSaveError('请先填写昵称。');
      return false;
    }

    if (!userId) {
      setProfileSaveError('请先登录 MuseSync 账号。');
      return false;
    }

    try {
      const selectedAvatar = CARTOON_AVATARS.find(a => a.id === avatarId) || CARTOON_AVATARS[0];
      writeCachedUserProfile(localStorage, userId, {
        nickname: trimmedNickname,
        avatarId,
        avatarName: selectedAvatar.name
      });
    } catch (e) {
      console.error('保存本地 Profile 失败', e);
      // localStorage 只是兜底缓存，不阻断云端保存。
    }

    setIsSavingProfile(true);
    const error = await saveUserProfile({
      displayName: trimmedNickname,
      avatarIndex: avatarId,
      avatarUrl: `cartoon_avatar_index_${avatarId}`
    });
    setIsSavingProfile(false);

    if (error) {
      setProfileSaveError(toProfileMessage(error, '保存'));
      return false;
    }

    setNickname(trimmedNickname);
    return true;
  };

  const handleJoinClick = async () => {
    if (isProfileBusy) return;
    if (!await validateAndSaveProfile()) return;
    if (!roomIdInput.trim()) return;
    onJoin(roomIdInput.toUpperCase().trim(), usePassword ? passwordInput : undefined, isPublic);
  };

  const handleCreateClick = async () => {
    if (isProfileBusy) return;
    if (!await validateAndSaveProfile()) return;
    onCreate(usePassword ? passwordInput : undefined, isPublic);
  };

  const hasSharedAuth = neteaseAuth.loggedIn || qqAuth.loggedIn;
  const sharedUser = neteaseAuth.loggedIn ? neteaseAuth : qqAuth;

  /* ─── 全网共鸣同频大厅：公共房间实时列表（Supabase 可用时激活）─── */
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);

  // 初始加载 + 轮询刷新。public_rooms 含 login_address，避免浏览器订阅整表 Realtime payload。
  useEffect(() => {
    if (!isSupabaseAvailable || !supabase) return;

    setLobbyLoading(true);
    fetchActiveRooms().then(rooms => {
      setPublicRooms(rooms);
      setLobbyLoading(false);
    });

    const interval = window.setInterval(() => {
      fetchActiveRooms().then(rooms => setPublicRooms(rooms));
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // 一键加入大厅中的在线房间；带密码房间先回填房间号，让用户输入通行密钥。
  const handleJoinPublicRoom = async (room: PublicRoom) => {
    if (isProfileBusy) return;
    if (!await validateAndSaveProfile()) return;
    if (room.has_password) {
      setRoomIdInput(room.room_id);
      setUsePassword(true);
      setIsPublic(room.is_public);
      return;
    }
    onJoin(room.room_id, undefined, room.is_public);
  };

  // 渲染卡通头像（仅限索引 0-9）
  const renderLobbyAvatar = (avatarIndex: number) => {
    const CARTOON_AVATARS_IMPORT = CARTOON_AVATARS;
    const avatar = CARTOON_AVATARS_IMPORT.find(a => a.id === avatarIndex);
    if (!avatar) return <span style={{ fontSize: '1.2rem' }}>🎵</span>;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: avatar.bgColor }}>
        {avatar.renderSvg()}
      </div>
    );
  };


  return (
    <div className="welcome-portal-overlay">
      {/* 浮动晶莹水晶大卡片 (Floating Crystal Card) */}
      <OpticalGlassSurface
        id="portal-card-optics"
        className="crystal-portal-card"
        radius={24}
        edgeDepth={24}
        fallbackWidth={440}
        fallbackHeight={640}
        surfaceType="convex_squircle"
      >
        <div className="portal-card-scroll">
        <div className="portal-header">
          <div className="portal-badge">⚡ MuseSync 同频舱</div>
          <h1 className="portal-title">异地双向同频听歌舱</h1>
          <p className="portal-subtitle">千里共赏 · 毫秒穿透 · 极简美学系统</p>
        </div>

        {/* 若检测到异地已登录，展示温情的共享特权徽章 */}
        {hasSharedAuth && (
          <div className="shared-auth-banner">
            <img src={sharedUser.avatar} alt="" referrerPolicy="no-referrer" />
            <div className="banner-text">
              <span>已成功锁定云端听歌特权</span>
              <small>已共享 {sharedUser.nickname} 的 SVIP 黄金曲库</small>
            </div>
            <div className="pulse-success-dot" />
          </div>
        )}

        <div className="portal-body">
          {/* 1. 舱员昵称与 10宫格卡通形象选择 (新增) */}
          <div className={`portal-input-group ${nicknameError ? 'shake-animation' : ''}`}>
            <label className="input-required-label">舱内昵称</label>
            <ElasticGlassInput
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (e.target.value.trim()) setNicknameError(false);
              }}
              placeholder="请输入您的可爱昵称，如：歌词漫游者"
              maxLength={20}
              disabled={isProfileBusy}
              className={nicknameError ? 'error-border' : ''}
            />
            {nicknameError && <span className="error-text">⚠️ 昵称是同频水晶舱通信的必要标志哦！</span>}
            {profileLoading && <span className="profile-status-text">正在读取云端资料...</span>}
            {!profileSaveError && profileLoadError && <span className="error-text">{profileLoadError}</span>}
            {profileSaveError && <span className="error-text">{profileSaveError}</span>}
          </div>

          <AvatarSelector selectedId={avatarId} onSelect={setAvatarId} />

          <div className="portal-divider" />

          {/* 2. 房间号输入 (自动转为精致大写) */}
          <div className="portal-input-group">
            <label>通道房间号</label>
            <ElasticGlassInput
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="请输入 6 位房间号，如 UMYC3X"
              disabled={isProfileBusy}
            />
          </div>

          {/* 密码通行证 Checkbox 开关 */}
          <div className="password-toggle-row">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                disabled={isProfileBusy}
              />
              <span className="checkmark" />
              使用加密通行安全锁
            </label>

            <label className={`checkbox-container ${usePassword ? 'disabled-label' : ''}`} style={{ opacity: usePassword ? 0.4 : 1, cursor: usePassword ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isProfileBusy || usePassword}
              />
              <span className="checkmark" />
              将房间标记为公开
            </label>
          </div>

          {/* 密码输入框 (带弹性展开动画) */}
          <div className={`portal-input-group password-field ${usePassword ? 'expanded' : 'collapsed'}`}>
            <label>通道加密通行锁 (加盐混淆哈希)</label>
            <ElasticGlassInput
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="请输入房间安全密码"
              disabled={isProfileBusy || !usePassword}
            />
          </div>

          {/* 液态高光按钮组 */}
          <div className="portal-actions">
            <ElasticGlassButton
              className={`portal-btn main-join ${isProfileBusy ? 'loading' : ''}`}
              onClick={handleJoinClick}
              disabled={isProfileBusy}
            >
              {isProfileBusy ? (
                <div className="loading-spinner">
                  <div className="double-bounce1"></div>
                  <div className="double-bounce2"></div>
                </div>
              ) : (
                '穿透登舱'
              )}
            </ElasticGlassButton>

            <ElasticGlassButton
              className="portal-btn sub-create"
              onClick={handleCreateClick}
              disabled={isProfileBusy}
            >
              重组专属新舱
            </ElasticGlassButton>
          </div>
        </div>

        <div className="portal-footer">
          <span>MuseSync 团队 · 液态折射界面</span>
        </div>
        </div>
      </OpticalGlassSurface>

      {/* 🌐 全网共鸣同频舱大厅（Supabase 可用时自动出现）*/}
      {isSupabaseAvailable && (
        <div className="public-lobby-section">
          <div className="lobby-header">
            <div className="lobby-live-dot" />
            <span className="lobby-title">全网共鸣同频舱大厅</span>
            <span className="lobby-count">{publicRooms.length} 个活跃舱房</span>
          </div>

          {lobbyLoading && (
            <div className="lobby-loading">
              <div className="lobby-skeleton" />
              <div className="lobby-skeleton" style={{ opacity: 0.6 }} />
            </div>
          )}

          {!lobbyLoading && publicRooms.length === 0 && (
            <div className="lobby-empty">
              <span>🎵</span>
              <span>暂无活跃的同频舱房，率先开一间？</span>
            </div>
          )}

          {!lobbyLoading && publicRooms.map((room) => (
            <div key={room.room_id} className="lobby-room-card">
              <div className="lobby-avatar">
                {renderLobbyAvatar(room.host_avatar_index)}
              </div>
              <div className="lobby-room-info">
                <div className="lobby-room-id">房间 {room.room_id}</div>
                <div className="lobby-room-badges">
                  {!room.is_public && <span>私密</span>}
                  {room.has_password && <span>有密码</span>}
                </div>
                <div className="lobby-track">
                  {room.current_track_title
                    ? `♪ ${room.current_track_title} — ${room.current_track_artist || ''}`
                    : '🌙 等待中...'}
                </div>
                <div className="lobby-host">房主：{room.host_nickname}</div>
              </div>
              {room.rtt_ms > 0 && (
                <div className="lobby-rtt">{room.rtt_ms}ms</div>
              )}
              <ElasticGlassButton
                className="lobby-join-btn"
                onClick={() => handleJoinPublicRoom(room)}
                disabled={isProfileBusy}
              >
                {room.has_password ? '输入密码' : '加入'}
              </ElasticGlassButton>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .welcome-portal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 20px 24px;
          overflow-x: hidden;
          overflow-y: auto;
        }

        /* 透明厚透镜主卡片 */
        .crystal-portal-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          min-width: 360px;
          flex: 0 1 440px;
          background: var(--ms-glass-panel-fill);
          border: 1px solid rgba(255, 255, 255, 0.58);
          border-radius: 24px;
          padding: 0;
          box-shadow:
            0 30px 76px rgba(0, 0, 0, 0.36),
            inset 0 2px 1px rgba(255, 255, 255, 0.76),
            inset 2px 0 2px rgba(255, 255, 255, 0.14),
            inset -2px 0 2px rgba(255, 255, 255, 0.1),
            inset 0 -3px 3px rgba(0, 0, 0, 0.4);
          display: block;
          animation: card-spring-in 0.85s cubic-bezier(0.19, 1, 0.22, 1) forwards;
          transform: translateY(30px);
          opacity: 0;
          max-height: 90vh;
          overflow: hidden;
        }

        .portal-card-scroll {
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .portal-card-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .portal-card-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
        }

        @keyframes card-spring-in {
          to { transform: translateY(0); opacity: 1; }
        }

        .portal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
        }

        .portal-badge {
          font-size: 0.62rem;
          font-weight: 700;
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 2px 10px;
          letter-spacing: 0;
        }

        .portal-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0;
          margin-top: 2px;
        }

        .portal-subtitle {
          font-size: 0.68rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.28);
        }

        .shared-auth-banner {
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .shared-auth-banner img {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.8);
        }

        .banner-text {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .banner-text span {
          font-size: 0.68rem;
          font-weight: 700;
          color: #fff;
        }

        .banner-text small {
          font-size: 0.55rem;
          color: rgba(255, 255, 255, 0.45);
        }

        .pulse-success-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ef2a6;
          box-shadow: 0 0 8px #4ef2a6;
          animation: pulse-success-breathe 2s infinite;
        }

        @keyframes pulse-success-breathe {
          0%, 100% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .portal-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .portal-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08) 20%, rgba(255, 255, 255, 0.08) 80%, transparent);
          margin: 4px 0;
        }

        .portal-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .portal-input-group label {
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 0;
        }

        .input-required-label::after {
          content: ' *';
          color: #FF8A80;
          font-weight: 900;
        }

        .portal-input-group input {
          height: 38px;
          border-radius: 12px;
          background: rgba(3, 11, 17, 0.52);
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: #fff;
          padding: 0 14px;
          font-size: 0.8rem;
          outline: none;
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            inset 0 -1px 1px rgba(0, 0, 0, 0.28);
        }

        .portal-input-group input:focus {
          border-color: rgba(255, 255, 255, 0.46);
          background: rgba(4, 13, 20, 0.44);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.16),
            inset 0 -1px 1px rgba(0, 0, 0, 0.22);
        }

        .portal-input-group input.error-border {
          border-color: rgba(255, 138, 128, 0.5);
          box-shadow:
            0 0 0 1px rgba(255, 138, 128, 0.16),
            inset 0 2px 1px rgba(255, 255, 255, 0.48),
            inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        .error-text {
          font-size: 0.58rem;
          color: #FF8A80;
          font-weight: 600;
          margin-top: 2px;
        }

        .profile-status-text {
          font-size: 0.58rem;
          color: rgba(255, 255, 255, 0.68);
          font-weight: 600;
          margin-top: 2px;
        }

        /* 密码通行证 Checkbox 开关 */
        .password-toggle-row {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 2px;
        }

        .checkbox-container {
          display: flex;
          align-items: center;
          position: relative;
          padding-left: 22px;
          cursor: pointer;
          font-size: 0.68rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          user-select: none;
        }

        .checkbox-container input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .checkmark {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          height: 13px;
          width: 13px;
          border-radius: 4px;
          background-color: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: all 0.25s ease;
        }

        .checkbox-container:hover input ~ .checkmark {
          border-color: rgba(255, 255, 255, 0.25);
        }

        .checkbox-container input:checked ~ .checkmark {
          background-color: #fff;
          border-color: #fff;
        }

        .checkmark:after {
          content: "";
          position: absolute;
          display: none;
        }

        .checkbox-container input:checked ~ .checkmark:after {
          display: block;
        }

        .checkbox-container .checkmark:after {
          left: 4px;
          top: 1px;
          width: 3.5px;
          height: 6.5px;
          border: solid #000;
          border-width: 0 1.8px 1.8px 0;
          transform: rotate(45deg);
        }

        /* 密码折叠区弹性动画 */
        .password-field {
          transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
          overflow: hidden;
        }

        .password-field.collapsed {
          height: 0;
          opacity: 0;
          margin-top: -6px;
          pointer-events: none;
        }

        .password-field.expanded {
          height: 58px;
          opacity: 1;
          margin-top: 2px;
        }

        /* 按钮组 */
        .portal-actions {
          display: flex;
          gap: 10px;
          margin-top: 6px;
        }

        .portal-btn {
          flex: 1;
          height: 38px;
          border-radius: 12px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
          box-shadow:
            0 8px 18px rgba(0, 0, 0, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            inset 0 -2px 2px rgba(0, 0, 0, 0.18);
        }

        .main-join {
          background: rgba(255, 255, 255, 0.28);
          border-color: rgba(255, 255, 255, 0.42);
        }

        .main-join:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 30px rgba(0, 0, 0, 0.18),
            inset 0 2px 1px rgba(255, 255, 255, 0.8),
            inset 0 -2px 2px rgba(0, 0, 0, 0.2);
          background: rgba(255, 255, 255, 0.2);
        }

        .main-join:active:not(:disabled) {
          transform: translateY(0);
        }

        .sub-create {
          background: rgba(255, 255, 255, 0.1);
        }

        .sub-create:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.58);
          transform: translateY(-2px);
        }

        .sub-create:active:not(:disabled) {
          transform: translateY(0);
        }

        .portal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* 抖动动画 */
        .shake-animation {
          animation: input-shake 0.5s ease-in-out;
        }

        @keyframes input-shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-4px); }
          30%, 60%, 90% { transform: translateX(4px); }
        }

        /* 加载动画 */
        .loading-spinner {
          width: 18px;
          height: 18px;
          position: relative;
        }

        .double-bounce1, .double-bounce2 {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: #fff;
          opacity: 0.6;
          position: absolute;
          top: 0;
          left: 0;
          animation: sk-bounce 2.0s infinite ease-in-out;
        }

        .double-bounce2 {
          animation-delay: -1.0s;
        }

        @keyframes sk-bounce {
          0%, 100% { transform: scale(0.0); }
          50% { transform: scale(1.0); }
        }

        .portal-footer {
          margin-top: 4px;
          text-align: center;
          font-size: 0.55rem;
          color: rgba(255, 255, 255, 0.44);
          font-weight: 500;
          letter-spacing: 0;
        }

        /* ─── Live 公共大厅样式 ─── */
        .public-lobby-section {
          width: 100%;
          max-width: 440px;
          min-width: 360px;
          flex: 0 1 440px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: card-spring-in 1.1s cubic-bezier(0.19, 1, 0.22, 1) forwards;
          transform: translateY(30px);
          opacity: 0;
        }

        .lobby-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 4px;
        }

        .lobby-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ff5f5f;
          box-shadow: 0 0 8px #ff5f5f;
          animation: pulse-success-breathe 1.5s ease-in-out infinite;
          flex-shrink: 0;
        }

        .lobby-title {
          flex: 1;
          font-size: 0.72rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 0;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.32);
        }

        .lobby-count {
          font-size: 0.58rem;
          color: rgba(255, 255, 255, 0.64);
          font-weight: 500;
        }

        .lobby-loading {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lobby-skeleton {
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
        }

        @keyframes skeleton-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .lobby-empty {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.68rem;
          color: rgba(255, 255, 255, 0.35);
        }

        .lobby-room-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(5, 16, 23, 0.48);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow:
            0 12px 26px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            inset 0 -1px 1px rgba(0, 0, 0, 0.22);
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          cursor: default;
        }

        .lobby-room-card:hover {
          background: rgba(255, 255, 255, 0.055);
          border-color: rgba(255, 255, 255, 0.58);
          transform: translateY(-1px);
          box-shadow:
            0 16px 34px rgba(0, 0, 0, 0.2),
            inset 0 2px 1px rgba(255, 255, 255, 0.64),
            inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        .lobby-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.15);
          flex-shrink: 0;
        }

        .lobby-room-info {
          flex: 1;
          min-width: 0;
        }

        .lobby-room-id {
          font-size: 0.6rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.74);
          letter-spacing: 0;
          font-family: 'Courier New', monospace;
        }

        .lobby-track {
          font-size: 0.72rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }

        .lobby-room-badges {
          display: flex;
          gap: 4px;
          margin-top: 3px;
          flex-wrap: wrap;
        }

        .lobby-room-badges span {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 1px 6px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.52rem;
          font-weight: 800;
        }

        .lobby-host {
          font-size: 0.58rem;
          color: rgba(255, 255, 255, 0.62);
          margin-top: 1px;
        }

        .lobby-rtt {
          font-size: 0.58rem;
          font-weight: 700;
          color: hsla(145, 80%, 60%, 0.85);
          font-family: 'Courier New', monospace;
          flex-shrink: 0;
        }

        .lobby-join-btn {
          height: 28px;
          padding: 0 12px;
          border-radius: 8px;
          font-size: 0.68rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.46);
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          flex-shrink: 0;
          transition: all 0.2s ease;
          box-shadow:
            inset 0 2px 1px rgba(255, 255, 255, 0.6),
            inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        .lobby-join-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 8px 18px rgba(0, 0, 0, 0.16),
            inset 0 2px 1px rgba(255, 255, 255, 0.78),
            inset 0 -2px 2px rgba(0, 0, 0, 0.18);
          background: rgba(255, 255, 255, 0.2);
        }

        .lobby-join-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .welcome-portal-overlay {
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 18px;
            padding: 76px 16px 28px;
          }

          .crystal-portal-card {
            width: 100%;
            max-width: 440px;
            min-width: 0;
            max-height: none;
            flex: none;
            margin: 0 auto;
          }

          .portal-card-scroll {
            max-height: none;
            overflow: visible;
            padding: 22px 18px;
          }

          .public-lobby-section {
            width: 100%;
            max-width: 440px;
            min-width: 0;
            flex: none;
            margin: 0 auto;
          }

          .password-toggle-row {
            flex-wrap: wrap;
            row-gap: 10px;
          }
        }

        @media (max-width: 480px) {
          .portal-title {
            font-size: 1.2rem;
          }

          .portal-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .portal-btn {
            width: 100%;
          }

          .lobby-room-card {
            display: grid;
            grid-template-columns: 36px minmax(0, 1fr) auto;
            gap: 6px 8px;
            padding: 10px;
          }

          .lobby-avatar {
            grid-column: 1;
            grid-row: 1 / span 2;
            align-self: center;
          }

          .lobby-room-info {
            grid-column: 2;
            grid-row: 1;
          }

          .lobby-rtt {
            grid-column: 2;
            grid-row: 2;
          }

          .lobby-join-btn {
            grid-column: 3;
            grid-row: 1 / span 2;
            align-self: center;
          }
        }
      `}</style>
    </div>
  );
};
