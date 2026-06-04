import React, { useState, useEffect } from 'react';
import type { Platform } from '../types';
import { OpticsFilter } from '../components/OpticsFilter';

interface LoginModalProps {
  platform: Platform;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

const SERVER_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://hanxue-api.windy.indevs.in';

export const LoginModal: React.FC<LoginModalProps> = ({ platform, onClose, onSuccess }) => {
  const [qrBase64, setQrBase64] = useState('');
  const [qrStatus, setQrStatus] = useState('初始化中...');
  const [qqCookie, setQqCookie] = useState('');
  const filterId = `login-modal-filter`;

  // 网易云二维码轮询逻辑
  useEffect(() => {
    if (platform !== 'netease') return;

    let unikey = '';
    let timer: any;

    const initQr = async () => {
      try {
        setQrStatus('获取登录码...');
        const keyRes = await fetch(`${SERVER_URL}/api/netease/login/qr/key?timestamp=${Date.now()}`);
        const keyData = await keyRes.json();
        unikey = keyData.data.unikey;

        const qrRes = await fetch(`${SERVER_URL}/api/netease/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}`);
        const qrData = await qrRes.json();
        setQrBase64(qrData.data.qrimg);
        setQrStatus('请使用网易云音乐 APP 扫码');

        timer = setInterval(async () => {
          const checkRes = await fetch(`${SERVER_URL}/api/netease/login/qr/check?key=${unikey}&timestamp=${Date.now()}`);
          const checkData = await checkRes.json();
          if (checkData.code === 800) {
            setQrStatus('二维码已过期，请重新打开');
            clearInterval(timer);
          } else if (checkData.code === 802) {
            setQrStatus('扫码成功，请在手机上确认');
          } else if (checkData.code === 803) {
            setQrStatus('登录成功！');
            clearInterval(timer);
            // 获取账号信息
            try {
              const cookie = checkData.cookie;
              const statusRes = await fetch(`${SERVER_URL}/api/netease/login/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookie })
              });
              const statusData = await statusRes.json();
              if (statusData.data?.profile) {
                onSuccess({
                  loggedIn: true,
                  userId: statusData.data.profile.userId,
                  nickname: statusData.data.profile.nickname,
                  avatar: statusData.data.profile.avatarUrl,
                  cookie
                });
              } else {
                throw new Error("No profile");
              }
            } catch (e) {
              console.error("Fetch profile failed", e);
              // 防御性：就算获取不到详情也视为成功，丝滑关掉弹窗
              onSuccess({
                loggedIn: true,
                userId: 'netease_user',
                nickname: '网易云用户',
                avatar: 'https://p1.music.126.net/SUeqMM8HOIpHvQDEjnGimQ==/109951165647004069.jpg'
              });
            }
          }
        }, 3000);
      } catch (e) {
        console.error(e);
        setQrStatus('加载二维码失败');
      }
    };

    initQr();
    return () => clearInterval(timer);
  }, [platform, onSuccess]);

  const handleQQLogin = async () => {
    if (!qqCookie.trim()) {
      alert('请输入 QQ 音乐 Cookie');
      return;
    }
    setQrStatus('正在登录...');
    try {
      const res = await fetch(`${SERVER_URL}/api/qq/setCookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: qqCookie })
      });
      const data = await res.json();
      if (data.success) {
        // 获取用户信息，如果失败则给个默认的头像（代表登录成功）
        let fallbackUid = 'QQ_USER';
        const uinMatch = qqCookie.match(/(?:^|;) *uin=o?(\d+)/) || qqCookie.match(/(?:^|;) *wxuin=o?(\d+)/);
        if (uinMatch) {
          fallbackUid = uinMatch[1];
        }

        try {
          const userRes = await fetch(`${SERVER_URL}/api/qq/user/detail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: fallbackUid })
          });
          const userData = await userRes.json();
          const creator = userData.creator || userData.data?.creator || {};
          onSuccess({
            loggedIn: true,
            userId: creator.qq || fallbackUid,
            nickname: creator.nick || 'QQ音乐用户',
            avatar: creator.headpic || 'https://y.qq.com/favicon.ico',
            cookie: qqCookie
          });
        } catch (e) {
          onSuccess({
            loggedIn: true,
            userId: fallbackUid,
            nickname: 'QQ音乐用户',
            avatar: 'https://y.qq.com/favicon.ico',
            cookie: qqCookie
          });
        }
      } else {
        setQrStatus('登录失败：' + (data.message || 'Cookie 无效'));
      }
    } catch (e) {
      setQrStatus('网络请求失败');
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <div 
          onClick={e => e.stopPropagation()}
          style={{ position: 'relative' }}
        >
          <OpticsFilter id={filterId} width={320} height={360} radius={24} />
          <div style={{
            width: '320px', height: '360px',
            background: 'var(--ms-glass-bg)',
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
            borderRadius: '24px',
            border: '1px solid var(--ms-glass-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 1px var(--ms-glass-highlight)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '32px 24px'
          }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--ms-text-primary)', marginBottom: '8px' }}>
              {platform === 'netease' ? '网易云音乐登录' : 'QQ 音乐超级会员登录'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ms-text-secondary)', marginBottom: '24px' }}>
              {qrStatus}
            </p>

            {platform === 'netease' ? (
              <div style={{
                width: '180px', height: '180px', background: 'rgba(255,255,255,0.1)',
                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {qrBase64 ? (
                  <img src={qrBase64} alt="QR Code" referrerPolicy="no-referrer" style={{ width: '160px', height: '160px', borderRadius: '8px' }} />
                ) : (
                  <span style={{ color: 'var(--ms-text-muted)' }}>加载中...</span>
                )}
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--ms-text-muted)' }}>
                  由于接口限制，请在浏览器登录 QQ 音乐网页版后，复制完整的 Cookie 粘贴至下方。
                </p>
                <textarea 
                  value={qqCookie}
                  onChange={e => setQqCookie(e.target.value)}
                  placeholder="Paste Cookie here..."
                  style={{
                    width: '100%', height: '80px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--ms-glass-border)',
                    borderRadius: '8px', padding: '12px', color: 'var(--ms-text-primary)',
                    fontFamily: 'inherit', fontSize: '0.8rem', resize: 'none', outline: 'none'
                  }}
                />
                <button 
                  onClick={handleQQLogin}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    background: 'var(--ms-accent)', color: '#FFF',
                    border: 'none', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  验证并登录
                </button>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </>
  );
};
