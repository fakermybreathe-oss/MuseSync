import React, { useState, useEffect } from 'react';
import type { PlatformAuth } from '../types';
import { AvatarSelector, CARTOON_AVATARS } from '../components/AvatarSelector';
import { supabase, isSupabaseAvailable, fetchPublicRooms, type PublicRoom } from '../utils/supabaseClient';

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
  const [roomIdInput, setRoomIdInput] = useState(initialRoomId || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  /* ─── 临时 Profile 状态 (新增) ─── */
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(0); // 默认选 0 (皮卡丘)
  const [nicknameError, setNicknameError] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  // 联动逻辑：有密码时自动关闭公开选项且不可更改
  useEffect(() => {
    if (usePassword) {
      setIsPublic(false);
    }
  }, [usePassword]);

  // 页面加载时自动从 localStorage 恢复上一次设置过的个人昵称和头像
  useEffect(() => {
    try {
      const saved = localStorage.getItem('musesync_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nickname) setNickname(parsed.nickname);
        if (typeof parsed.avatarId === 'number') setAvatarId(parsed.avatarId);
      }
    } catch (e) {
      console.error('读取本地 Profile 缓存失败', e);
    }
  }, []);

  // 统一的 Profile 校验和写入本地方法，校验通过后调用回调
  const validateAndSaveProfile = (): boolean => {
    if (!nickname.trim()) {
      setNicknameError(true);
      // 触发轻微的错误抖动反馈
      setTimeout(() => setNicknameError(false), 800);
      return false;
    }

    try {
      // 找到对应的卡通头像 SVG 并把名字、索引等一并缓存
      const selectedAvatar = CARTOON_AVATARS.find(a => a.id === avatarId) || CARTOON_AVATARS[0];
      const profile = {
        nickname: nickname.trim(),
        avatarId: avatarId,
        avatarName: selectedAvatar.name
      };
      localStorage.setItem('musesync_user_profile', JSON.stringify(profile));
      return true;
    } catch (e) {
      console.error('保存本地 Profile 失败', e);
      return true; // 即使 localStorage 满也不阻断用户使用
    }
  };

  const handleJoinClick = () => {
    if (!validateAndSaveProfile()) return;
    if (!roomIdInput.trim()) return;
    onJoin(roomIdInput.toUpperCase().trim(), usePassword ? passwordInput : undefined, isPublic);
  };

  const handleCreateClick = () => {
    if (!validateAndSaveProfile()) return;
    onCreate(usePassword ? passwordInput : undefined, isPublic);
  };

  const hasSharedAuth = neteaseAuth.loggedIn || qqAuth.loggedIn;
  const sharedUser = neteaseAuth.loggedIn ? neteaseAuth : qqAuth;

  /* ─── 全网共鸣同频大厅：公共房间实时列表（Supabase 可用时激活）─── */
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);

  // 初始加载 + Supabase 实时订阅
  useEffect(() => {
    if (!isSupabaseAvailable || !supabase) return;

    // 首次加载
    setLobbyLoading(true);
    fetchPublicRooms().then(rooms => {
      setPublicRooms(rooms);
      setLobbyLoading(false);
    });

    // 实时订阅 public_rooms 表变动（新增/更新/删除）
    const channel = supabase
      .channel('public-rooms-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'public_rooms' },
        () => {
          // 任意变动时重新拉取列表
          fetchPublicRooms().then(rooms => setPublicRooms(rooms));
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  // 一键加入大厅中的公共房间
  const handleJoinPublicRoom = (roomId: string) => {
    if (!validateAndSaveProfile()) return;
    onJoin(roomId, undefined); // 公开房间无密码
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
      <div className="crystal-portal-card">
        <div className="portal-header">
          <div className="portal-badge">⚡ MuseSync Cabin</div>
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
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (e.target.value.trim()) setNicknameError(false);
              }}
              placeholder="请输入您的可爱昵称，如：歌词漫游者"
              maxLength={20}
              disabled={isLoading}
              className={nicknameError ? 'error-border' : ''}
            />
            {nicknameError && <span className="error-text">⚠️ 昵称是同频水晶舱通信的必要标志哦！</span>}
          </div>

          <AvatarSelector selectedId={avatarId} onSelect={setAvatarId} />

          <div className="portal-divider" />

          {/* 2. 房间号输入 (自动转为精致大写) */}
          <div className="portal-input-group">
            <label>通道房间号</label>
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="请输入 6 位房间号，如 UMYC3X"
              disabled={isLoading}
            />
          </div>

          {/* 密码通行证 Checkbox 开关 */}
          <div className="password-toggle-row" style={{ display: 'flex', gap: '20px' }}>
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                disabled={isLoading}
              />
              <span className="checkmark" />
              使用加密通行安全锁
            </label>

            <label className={`checkbox-container ${usePassword ? 'disabled-label' : ''}`} style={{ opacity: usePassword ? 0.4 : 1, cursor: usePassword ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isLoading || usePassword}
              />
              <span className="checkmark" />
              公开此房间到大厅
            </label>
          </div>

          {/* 密码输入框 (带弹性展开动画) */}
          <div className={`portal-input-group password-field ${usePassword ? 'expanded' : 'collapsed'}`}>
            <label>通道加密通行锁 (加盐混淆哈希)</label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="请输入房间安全密码"
              disabled={isLoading || !usePassword}
            />
          </div>

          {/* 液态高光按钮组 */}
          <div className="portal-actions">
            <button
              className={`portal-btn main-join ${isLoading ? 'loading' : ''}`}
              onClick={handleJoinClick}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="loading-spinner">
                  <div className="double-bounce1"></div>
                  <div className="double-bounce2"></div>
                </div>
              ) : (
                '穿透登舱'
              )}
            </button>

            <button
              className="portal-btn sub-create"
              onClick={handleCreateClick}
              disabled={isLoading}
            >
              重组专属新舱
            </button>
          </div>
        </div>

        <div className="portal-footer">
          <span>MuseSync Team · Built with Neumorphic Refraction Art</span>
        </div>
      </div>

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
              <span>暂无公开的同频舱房，率先开一间？</span>
            </div>
          )}

          {!lobbyLoading && publicRooms.map((room) => (
            <div key={room.room_id} className="lobby-room-card">
              <div className="lobby-avatar">
                {renderLobbyAvatar(room.host_avatar_index)}
              </div>
              <div className="lobby-room-info">
                <div className="lobby-room-id">ROOM {room.room_id}</div>
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
              <button
                className="lobby-join-btn"
                onClick={() => handleJoinPublicRoom(room.room_id)}
                disabled={isLoading}
              >
                加入
              </button>
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
          padding: 20px 24px;
          overflow-y: auto; /* 允许在小屏手机上上下滚动 */
        }

        .welcome-portal-overlay::before {
          content: "";
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 140%;
          background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.03) 0%, transparent 40%),
                      radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.02) 0%, transparent 45%);
          filter: blur(80px);
          animation: aurora-flow 25s ease infinite alternate;
        }

        @keyframes aurora-flow {
          0% { transform: rotate(0deg) scale(1); }
          100% { transform: rotate(3deg) scale(1.08); }
        }

        /* 晶莹水晶大卡片 (Neumorphic Glassmorphic specs) */
        .crystal-portal-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          background: linear-gradient(180deg, 
            rgba(255, 255, 255, 0.12) 0%, 
            rgba(255, 255, 255, 0.03) 40%, 
            rgba(255, 255, 255, 0.01) 75%, 
            rgba(0, 0, 0, 0.55) 100%
          );
          backdrop-filter: blur(35px);
          -webkit-backdrop-filter: blur(35px);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-bottom: 1.5px solid rgba(255, 255, 255, 0.35); /* 底部高折射白边 */
          border-radius: 24px;
          padding: 24px 28px;
          box-shadow: 
            0 24px 60px rgba(0, 0, 0, 0.6), 
            0 0 0 1px rgba(0, 0, 0, 0.85), /* 3D立体液晶边 */
            inset 0 1px 1px rgba(255, 255, 255, 0.45),
            inset 0 -1.5px 2px rgba(0, 0, 0, 0.7),
            inset 0 0 10px rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: card-spring-in 0.85s cubic-bezier(0.19, 1, 0.22, 1) forwards;
          transform: translateY(30px);
          opacity: 0;
          max-height: 90vh; /* 确保不超出视口 */
          overflow-y: auto; /* 卡片内溢出可滚动 */
        }

        .crystal-portal-card::-webkit-scrollbar {
          width: 4px;
        }
        .crystal-portal-card::-webkit-scrollbar-thumb {
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
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .portal-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.02em;
          margin-top: 2px;
        }

        .portal-subtitle {
          font-size: 0.68rem;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 500;
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
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.05em;
        }

        .input-required-label::after {
          content: ' *';
          color: #FF8A80;
          font-weight: 900;
        }

        .portal-input-group input {
          height: 38px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #fff;
          padding: 0 14px;
          font-size: 0.8rem;
          outline: none;
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }

        .portal-input-group input:focus {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(0, 0, 0, 0.4);
          box-shadow: 0 0 10px rgba(255,255,255,0.05), inset 0 2px 4px rgba(0,0,0,0.35);
        }

        .portal-input-group input.error-border {
          border-color: rgba(255, 138, 128, 0.5);
          box-shadow: 0 0 8px rgba(255, 138, 128, 0.15), inset 0 2px 4px rgba(0,0,0,0.3);
        }

        .error-text {
          font-size: 0.58rem;
          color: #FF8A80;
          font-weight: 600;
          margin-top: 2px;
        }

        /* 密码通行证 Checkbox 开关 */
        .password-toggle-row {
          display: flex;
          align-items: center;
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
          border: none;
          transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .main-join {
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(215,215,215,0.85));
          color: #000;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 6px 16px rgba(0,0,0,0.25);
        }

        .main-join:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(255, 255, 255, 0.12);
          background: #fff;
        }

        .main-join:active:not(:disabled) {
          transform: translateY(0);
        }

        .sub-create {
          background: rgba(255, 255, 255, 0.07);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sub-create:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.2);
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
          background-color: #000;
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
          color: rgba(255, 255, 255, 0.22);
          font-weight: 500;
          letter-spacing: 0.05em;
        }

        /* ─── Live 公共大厅样式 ─── */
        .public-lobby-section {
          width: 100%;
          max-width: 440px;
          margin-top: 16px;
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
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: 0.04em;
        }

        .lobby-count {
          font-size: 0.58rem;
          color: rgba(255, 255, 255, 0.35);
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
          background: linear-gradient(180deg,
            rgba(255, 255, 255, 0.07) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          cursor: default;
        }

        .lobby-room-card:hover {
          background: linear-gradient(180deg,
            rgba(255, 255, 255, 0.11) 0%,
            rgba(255, 255, 255, 0.04) 100%
          );
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
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
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.08em;
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

        .lobby-host {
          font-size: 0.58rem;
          color: rgba(255, 255, 255, 0.35);
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
          border: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(200,200,200,0.8));
          color: #000;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .lobby-join-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
          background: #fff;
        }

        .lobby-join-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
