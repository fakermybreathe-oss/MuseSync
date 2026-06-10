import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TopBar } from './TopBar';
import { PlayerDock } from './PlayerDock';
import { ClassicMode } from './ClassicMode';
import { WaveMode } from './WaveMode';
import { PlaylistPanel } from './PlaylistPanel';
import { SearchBox } from './SearchBox';
import { SearchResultsPanel } from './SearchResultsPanel';
import { LoginModal } from './LoginModal';
import { WelcomePortal } from './WelcomePortal';
import type { Track, PlayerMode, PlatformAuth, Platform, PlaylistFolder } from '../types';
import { useAuth } from '../auth/AuthContext';
import { readCachedUserProfile } from '../utils/profileCache';

// 自适应 SERVER_URL：本地开发走 Vite Proxy（空字符串），生产环境直连 VPS 公网地址
// 当用户通过 Cloudflare Pages 访问时，hostname 不是 localhost，故直连 VPS
const SERVER_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://hanxue-api.611519.xyz';

const EMPTY_AUTH: PlatformAuth = { loggedIn: false, userId: '', nickname: '', avatar: '' };

const readRoomIdentity = (userId: string | null) => {
  if (!userId) return { nickname: '', avatar: '' };
  const profile = readCachedUserProfile(localStorage, userId);
  return {
    nickname: profile?.nickname ?? '',
    avatar: typeof profile?.avatarId === 'number'
      ? `cartoon_avatar_index_${profile.avatarId}`
      : ''
  };
};

// 连线密码加盐哈希防泄露算法 (统一采用跨平台、跨安全上下文一致的纯 JS 哈希，根除 HTTP 与 localhost 算法冲突)
const hashPassword = async (password: string): Promise<string> => {
  if (!password) return '';
  const salted = password + '_musesync_salt';
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'ms_hash_' + Math.abs(hash).toString(16);
};

export const MuseSyncPlayer: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  /* ─── 播放器核心状态 ─── */
  const [playerMode, setPlayerMode] = useState<PlayerMode>('classic');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  /* ─── 歌曲与歌单 ─── */
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState('');
  const [playlist, setPlaylist] = useState<Track[]>([]); // 当前正在播放的列表
  const [playMode, setPlayMode] = useState<'loop' | 'single' | 'random'>('loop');

  const [neteaseFolders, setNeteaseFolders] = useState<PlaylistFolder[]>([]);
  const [qqFolders, setQQFolders] = useState<PlaylistFolder[]>([]);
  
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderTracks, setFolderTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  /* ─── 平台登录态 ─── */
  const getInitialAuth = (platform: 'netease' | 'qq') => {
    try {
      const saved = localStorage.getItem('musesync_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        return platform === 'netease' ? (parsed.neteaseAuth || EMPTY_AUTH) : (parsed.qqAuth || EMPTY_AUTH);
      }
    } catch (e) {}
    return EMPTY_AUTH;
  };

  const [neteaseAuth, setNeteaseAuth] = useState<PlatformAuth>(() => getInitialAuth('netease'));
  const [qqAuth, setQQAuth] = useState<PlatformAuth>(() => getInitialAuth('qq'));

  /* ─── 房间控制状态 (新增) ─── */
  const [roomId, setRoomId] = useState(() => {
    return localStorage.getItem('musesync_room_id') || 'UMYC3X';
  });
  const [roomPassword, setRoomPassword] = useState(() => {
    // 从 localStorage 获取已被哈希的密码（如果有）
    return localStorage.getItem('musesync_room_password') || '';
  });
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [isRoomConnected, setIsRoomConnected] = useState(false);
  const [isConnectingRoom, setIsConnectingRoom] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  /* ─── UI 状态 ─── */
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistPlatform, setPlaylistPlatform] = useState<Platform>('netease');
  const [loginModalPlatform, setLoginModalPlatform] = useState<Platform | null>(null);

  /* ─── 搜索状态 ─── */
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchPlatform, setSearchPlatform] = useState<Platform>('netease');
  const [isSearching, setIsSearching] = useState(false);

  /* ─── 加载状态 ─── */
  const [loadingNetease, setLoadingNetease] = useState(false);
  const [loadingQQ, setLoadingQQ] = useState(false);

  /* ─── Refs ─── */
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingSeekTime = useRef<number | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);
  const isRemoteActionRef = useRef<boolean>(false);

  // 【智能预缓冲相关 Refs】
  const prebufferedTrackRef = useRef<{ id: string; audioUrl: string; lyrics: string } | null>(null);
  const isPrebufferingRef = useRef<boolean>(false);
  const prebufferAudioRef = useRef<HTMLAudioElement | null>(null);
  const isUserActionRef = useRef<boolean>(false); // 记录是否为用户主动点击连接，用于静默降级防打扰

  // 【收藏歌单高并发阻断锁 Refs】
  const isFetchingFoldersRef = useRef<boolean>(false);
  const isFetchingTracksRef = useRef<boolean>(false);

  /* ─── Auth 持久化 ─── */
  useEffect(() => {
    localStorage.setItem('musesync_auth', JSON.stringify({ neteaseAuth, qqAuth }));
  }, [neteaseAuth, qqAuth]);

  // ─── 启动与登录时，自动将本地已有的 QQ SVIP Cookie 穿透同步至后端物理引擎 ───
  useEffect(() => {
    if (qqAuth.loggedIn && qqAuth.cookie) {
      fetch(`${SERVER_URL}/api/qq/setCookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: qqAuth.cookie })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log("[自动同步] QQ音乐超级会员 Cookie 已成功下发至后端物理引擎。");
        }
      })
      .catch(err => console.error("QQ Cookie 自动同步失败", err));
    }
  }, [qqAuth.cookie, qqAuth.loggedIn]);

  // 当自身登录态改变时，广播共享给房间内其他成员（如异地的手机端，实现免密接管）
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('sync:auth', { roomId, platform: 'netease', auth: neteaseAuth });
    }
  }, [neteaseAuth, roomId]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('sync:auth', { roomId, platform: 'qq', auth: qqAuth });
    }
  }, [qqAuth, roomId]);

  /* ─── 获取用户歌单(文件夹) ─── */
  const fetchFolders = useCallback(async (platform: Platform) => {
    if (isFetchingFoldersRef.current) return; // 核心：高并发请求拦截锁
    const auth = platform === 'netease' ? neteaseAuth : qqAuth;
    
    // 只要有任何一端登录过，无论本机有没有 loggedIn，只要有 UID，就使用共享 Cookie 请求
    if (platform === 'netease' && auth.userId) {
      isFetchingFoldersRef.current = true;
      setLoadingNetease(true);
      try {
        const res = await fetch(`${SERVER_URL}/api/netease/user/playlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: auth.userId, roomId })
        });
        const data = await res.json();
        setNeteaseFolders([...data]);
      } catch (e) { console.error(e); }
      finally { 
        setLoadingNetease(false); 
        isFetchingFoldersRef.current = false;
      }
    } else if (platform === 'qq' && auth.userId) {
      isFetchingFoldersRef.current = true;
      setLoadingQQ(true);
      try {
        const res = await fetch(`${SERVER_URL}/api/qq/user/playlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: auth.userId, roomId })
        });
        const data = await res.json();
        const unique: PlaylistFolder[] = [];
        const seen = new Set<string>();
        for (const f of data) {
          const key = `${f.name}-${f.trackCount}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(f);
          }
        }
        setQQFolders([...unique]);
      } catch (e) { console.error(e); }
      finally { 
        setLoadingQQ(false); 
        isFetchingFoldersRef.current = false;
      }
    }
  }, [neteaseAuth, qqAuth, roomId]);

  // 每次打开歌单面板或切换平台时，主动刷新数据
  useEffect(() => {
    if (showPlaylist) {
      fetchFolders(playlistPlatform);
    }
  }, [showPlaylist, playlistPlatform, fetchFolders]);

  /* ─── 点击文件夹加载歌曲 ─── */
  const handleFolderClick = useCallback(async (folder: PlaylistFolder) => {
    if (isFetchingTracksRef.current) return; // 核心：高并发请求拦截锁
    isFetchingTracksRef.current = true;
    setActiveFolderId(folder.id);
    setLoadingTracks(true);
    setFolderTracks([]);
    try {
      const url = `${SERVER_URL}/api/${folder.platform}/playlist/tracks`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folder.id, roomId })
      });
      const data = await res.json();
      setFolderTracks(data);
    } catch (e) {
      console.error('Failed to load folder tracks', e);
    } finally {
      setLoadingTracks(false);
      isFetchingTracksRef.current = false;
    }
  }, [roomId]);

  /* ─── 切换平台时重置文件夹视图 ─── */
  const handlePlatformChange = useCallback((p: Platform) => {
    setPlaylistPlatform(p);
    setActiveFolderId(null);
    setFolderTracks([]);
  }, []);

  /* ─── 核心房间穿透重连 ─── */
  const handleJoinRoom = useCallback(async (targetRoomId: string, password?: string, isPublicSetting?: boolean) => {
    if (!socketRef.current) return;
    setRoomId(targetRoomId);
    setIsConnectingRoom(true); // 正在连接中，唤醒按钮 Loading
    isUserActionRef.current = true; // 核心：标记为用户主动发起的动作
    
    if (isPublicSetting !== undefined) {
      setIsPublic(isPublicSetting);
    }
    
    // 异步计算加盐密码哈希，杜绝明文在网络链路传输
    const hashedPassword = password ? await hashPassword(password) : '';
    setRoomPassword(hashedPassword);
    localStorage.setItem('musesync_room_id', targetRoomId);
    
    // 只有当用户确实输入了密码或创建了密码，我们才保存。若是空则清空 localStorage
    if (hashedPassword) {
      localStorage.setItem('musesync_room_password', hashedPassword);
    } else {
      localStorage.removeItem('musesync_room_password');
    }

    // ─── 抓取本地配置的临时卡通 Profile ───
    const localProfile = readRoomIdentity(userId);

    // 重新连接并向后端发送加入房间请求
    // 舱内社交展示优先使用本地卡通 Profile，无卡通 Profile 时才使用平台实名登录数据兜底
    // 携带上次的 socketId 尝试断线角色继承
    let previousMemberId: string | undefined;
    try {
      const savedPrevId = localStorage.getItem('musesync_prev_socket_id');
      if (savedPrevId) previousMemberId = savedPrevId;
    } catch (e) {}

    const myAuth = neteaseAuth.loggedIn ? neteaseAuth : (qqAuth.loggedIn ? qqAuth : EMPTY_AUTH);
    socketRef.current.emit('join:room', {
      roomId: targetRoomId,
      password: hashedPassword,
      previousMemberId,
      isPublic: isPublicSetting !== undefined ? isPublicSetting : isPublic,
      user: {
        nickname: localProfile.nickname || myAuth.nickname || '',
        avatar: localProfile.avatar || myAuth.avatar || ''
      },
      neteaseAuth,
      qqAuth
    });
  }, [neteaseAuth, qqAuth, isPublic, userId]);

  /* ─── 重组专属新舱 ─── */
  const handleCreateRoom = useCallback(async (password?: string, isPublicSetting?: boolean) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randRoom = '';
    for (let i = 0; i < 6; i++) {
      randRoom += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    await handleJoinRoom(randRoom, password, isPublicSetting);
  }, [handleJoinRoom]);

  /* ─── 退出当前听歌舱返回欢迎大堂 ─── */
  const handleLeaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave:room');
    }
    setIsRoomConnected(false);
    setRoomMembers([]);
    console.log("[退舱成功] 已主动断开当前同频连线，成功重返大厅门脸。");
  }, []);

  /* ─── Socket.io 初始化 ─── */
  useEffect(() => {
    // 初始化 Socket.IO，生产环境指定 transports 优先 websocket，降低延迟
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    // 连接成功后，自动进入当前房间（支持断线自愈：携带旧 socketId 夺回角色）
    socket.on('connect', () => {
      // ─── 抓取本地配置的临时卡通 Profile ───
      const localProfile = readRoomIdentity(userId);

      // ─── 断线自愈：读取上次的 socketId，重连时作为 previousMemberId 夺回角色 ───
      let previousMemberId: string | undefined;
      try {
        const savedPrevId = localStorage.getItem('musesync_prev_socket_id');
        if (savedPrevId) {
          previousMemberId = savedPrevId;
          console.log(`[断线自愈] 检测到上次 socketId: ${savedPrevId}，尝试夺回原有角色`);
        }
      } catch (e) {}

      const myAuth = neteaseAuth.loggedIn ? neteaseAuth : (qqAuth.loggedIn ? qqAuth : EMPTY_AUTH);
      socket.emit('join:room', {
        roomId,
        password: roomPassword,
        previousMemberId,
        isPublic,
        user: {
          nickname: localProfile.nickname || myAuth.nickname || '',
          avatar: localProfile.avatar || myAuth.avatar || ''
        },
        neteaseAuth,
        qqAuth
      });
    });

    // ─── 断线时将当前 socketId 存入 localStorage，供下次重连使用 ───
    socket.on('disconnect', (reason) => {
      try {
        if (socket.id) {
          localStorage.setItem('musesync_prev_socket_id', socket.id);
          console.log(`[断线自愈] 已保存 socketId: ${socket.id}，原因: ${reason}`);
        }
      } catch (e) {}
    });

    socket.on('join:failed', (data: { message: string }) => {
      setIsConnectingRoom(false); // 唤醒按钮正常态
      
      // 【静默降级防打扰机制】
      // 只有在用户主动在 Portal 中点击“穿透同频”失败时，才弹窗报错。
      // 页面刚加载时 Socket 自动触发静默连接若失败，则静默保持在欢迎门脸等待用户输入。
      if (isUserActionRef.current) {
        alert(`⚠️ ${data.message}`);
      }
      isUserActionRef.current = false; // 动作复位
    });

    socket.on('join:success', (data: { roomId: string; roomState: any }) => {
      console.log(`[穿透同频] 成功接入房间: ${data.roomId}`);
      setIsRoomConnected(true); // 代表通道穿透成功，滑出欢迎页
      setIsConnectingRoom(false);
      isUserActionRef.current = false; // 动作复位
      const state = data.roomState;
      
      // 同步公开大厅的状态
      if (state.isPublic !== undefined) {
        setIsPublic(state.isPublic);
      }
      
      // 1. 同步共享的登录鉴权，实现白嫖
      if (state.neteaseAuth && state.neteaseAuth.userId) setNeteaseAuth(state.neteaseAuth);
      if (state.qqAuth && state.qqAuth.userId) setQQAuth(state.qqAuth);

      // 2. 同步当前的播放列表与播放状态
      if (state.playlist) setPlaylist(state.playlist);
      if (state.playMode) setPlayMode(state.playMode);
      if (state.track) {
        isRemoteActionRef.current = true;
        
        setCurrentTrack(prev => {
          // 【断线自愈高精追赶算法】
          // 如果当前是同一首歌，且已经加载，我们直接 Seek 对齐进度并唤醒，避开无谓的 URL 重载
          if (prev && prev.id === state.track.id && audioRef.current) {
            const timeDiff = Math.abs(audioRef.current.currentTime - state.position);
            if (timeDiff > 2) {
              audioRef.current.currentTime = state.position;
            }
            setIsPlaying(state.isPlaying);
            if (state.isPlaying) {
              audioRef.current.play().catch(console.error);
            } else {
              audioRef.current.pause();
            }
            return prev;
          } else {
            // 若为新歌，则赋给延迟 Seek 指针
            pendingSeekTime.current = state.position;
            setIsPlaying(state.isPlaying);
            return state.track;
          }
        });

        if (state.track.lyrics) setCurrentLyrics(state.track.lyrics);
      }
    });

    // 延迟 RTT 高精计算与测算回路
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping:send', { ts: Date.now() });
      }
    }, 4000);

    socket.on('ping:ack', (data: { ts: number }) => {
      const rtt = Date.now() - data.ts;
      socket.emit('ping:report', { rtt });
    });

    socket.on('sync:members', (members: any[]) => {
      setRoomMembers(members);
    });

    // 事件控制同步
    socket.on('sync:play', (data: { position: number, track?: Track }) => {
      isRemoteActionRef.current = true;
      if (data.track) {
        setCurrentTrack(prev => {
          if (!prev || prev.id !== data.track?.id) {
            pendingSeekTime.current = data.position;
            if (data.track?.lyrics) {
              setCurrentLyrics(data.track.lyrics);
            }
            return data.track || null;
          } else {
            if (audioRef.current) audioRef.current.currentTime = data.position;
          }
          return prev;
        });
      } else {
        if (audioRef.current) audioRef.current.currentTime = data.position;
      }
      
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    });

    socket.on('sync:pause', (data: { position: number }) => {
      isRemoteActionRef.current = true;
      if (audioRef.current) {
        audioRef.current.currentTime = data.position;
        audioRef.current.pause();
        setIsPlaying(false);
      }
    });

    socket.on('sync:seek', (data: { position: number }) => {
      isRemoteActionRef.current = true;
      if (audioRef.current) {
        audioRef.current.currentTime = data.position;
        if (!audioRef.current.paused) audioRef.current.play().catch(console.error);
      }
    });

    socket.on('sync:playlist', (data: { playlist: Track[] }) => {
      setPlaylist(data.playlist);
    });

    socket.on('sync:mode', (data: { playMode: 'loop' | 'single' | 'random' }) => {
      setPlayMode(data.playMode);
    });

    socket.on('sync:auth', (data: { platform: 'netease' | 'qq'; auth: PlatformAuth }) => {
      if (data.platform === 'netease') setNeteaseAuth(data.auth);
      else setQQAuth(data.auth);
    });

    socket.on('sync:public', (data: { isPublic: boolean }) => {
      setIsPublic(data.isPublic);
    });

    return () => {
      clearInterval(pingInterval);
      // 主动断开时也保存 socketId（比如组件卸载重载）
      try {
        if (socket.id) localStorage.setItem('musesync_prev_socket_id', socket.id);
      } catch (e) {}
      socket.disconnect();
    };
  }, [roomId, roomPassword, isPublic, userId]); // 依赖中加上 isPublic 确保 Socket 重连能读取最新公开设置

  // ─── 房主修改公开/私密状态的句柄 ───
  const handlePublicChange = useCallback((val: boolean) => {
    setIsPublic(val);
    if (socketRef.current) {
      socketRef.current.emit('sync:public', { roomId, isPublic: val });
    }
  }, [roomId]);

  // ─── 弱网/断线网络恢复自愈监听 ───
  useEffect(() => {
    const handleOnline = () => {
      console.log("[弱网自愈] 检测到设备重新上线，主动触发 Socket 连接检查与追赶...");
      if (socketRef.current) {
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        } else {
          // 即使在连接状态，在 online 时主动 join 也可以触发高精指针和状态拉取
          const localProfile = readRoomIdentity(userId);

          let previousMemberId: string | undefined;
          try {
            const savedPrevId = localStorage.getItem('musesync_prev_socket_id');
            if (savedPrevId) previousMemberId = savedPrevId;
          } catch (e) {}

          const myAuth = neteaseAuth.loggedIn ? neteaseAuth : (qqAuth.loggedIn ? qqAuth : EMPTY_AUTH);
          socketRef.current.emit('join:room', {
            roomId,
            password: roomPassword,
            previousMemberId,
            isPublic,
            user: {
              nickname: localProfile.nickname || myAuth.nickname || '',
              avatar: localProfile.avatar || myAuth.avatar || ''
            }
          });
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [roomId, roomPassword, isPublic, neteaseAuth, qqAuth, userId]);

  // ─── 智能下一首音频静默预缓冲加载 ───
  const triggerPrebuffer = useCallback(async () => {
    if (playlist.length === 0 || !currentTrack || isPrebufferingRef.current) return;

    // 获取下一首歌
    const curIdx = playlist.findIndex(t => t.id === currentTrack.id);
    if (curIdx === -1) return;
    let nextIdx = curIdx + 1;
    if (nextIdx >= playlist.length) nextIdx = 0;

    const nextTrack = playlist[nextIdx];
    // 已有缓存或为当前曲则跳过
    if (nextTrack.id === currentTrack.id || (prebufferedTrackRef.current && prebufferedTrackRef.current.id === nextTrack.id)) {
      return;
    }

    isPrebufferingRef.current = true;
    console.log(`[预缓冲激活] 开始静默缓冲下一曲: ${nextTrack.title}`);

    try {
      const res = await fetch(`${SERVER_URL}/api/${nextTrack.platform}/song/${nextTrack.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nextTrack.title,
          artist: nextTrack.artist,
          roomId
        })
      });
      const data = await res.json();
      const targetAudio = data.audioUrl || nextTrack.audioUrl;

      if (targetAudio) {
        const proxyUrl = `${SERVER_URL}/proxy/audio?url=${encodeURIComponent(targetAudio)}`;
        prebufferedTrackRef.current = {
          id: nextTrack.id,
          audioUrl: proxyUrl,
          lyrics: data.lyrics || ''
        };

        if (!prebufferAudioRef.current) {
          prebufferAudioRef.current = new Audio();
          prebufferAudioRef.current.muted = true;
        }
        prebufferAudioRef.current.src = proxyUrl;
        prebufferAudioRef.current.load();
        console.log(`[预缓冲就绪🚀] 后台预加载音轨成功: ${nextTrack.title}`);
      }
    } catch (err) {
      console.error("[预缓冲解析出错]", err);
    } finally {
      isPrebufferingRef.current = false;
    }
  }, [playlist, currentTrack, roomId]);

  /* ─── 音频事件 (每 250ms 抽帧降温优化，防爆卡顿) ─── */
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && audioRef.current.duration) {
      const now = Date.now();
      // 时间阀限制：250ms 更新一次进度 State，直接为 CPU 降温 90%！
      if (now - lastTimeUpdateRef.current > 250) {
        const curTime = audioRef.current.currentTime;
        const dur = audioRef.current.duration;
        setCurrentTime(curTime);
        setDuration(dur);
        setProgress((curTime / dur) * 100);
        lastTimeUpdateRef.current = now;

        // 【预加载触发判定】距离播放结束不到 15 秒且存在后续歌曲，静默激活预加载
        if (dur - curTime < 15) {
          triggerPrebuffer();
        }
      }
    }
  }, [triggerPrebuffer]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && pendingSeekTime.current !== null) {
      audioRef.current.currentTime = pendingSeekTime.current;
      pendingSeekTime.current = null;
    }
  }, []);

  /* ─── 播放/暂停 ─── */
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !socketRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      socketRef.current.emit('sync:pause', { roomId, position: audioRef.current.currentTime });
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      socketRef.current.emit('sync:play', { roomId, position: audioRef.current.currentTime });
    }
  }, [isPlaying, roomId]);

  /* ─── 进度拖拽 ─── */
  const handleSeek = useCallback((val: number) => {
    if (audioRef.current && audioRef.current.duration) {
      const newTime = (val / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setProgress(val);
      socketRef.current?.emit('sync:seek', { roomId, position: newTime });
    }
  }, [roomId]);

  /* ─── 播放模式变更与同步 ─── */
  const handleModeChange = useCallback(() => {
    const nextMode = playMode === 'loop' ? 'single' : (playMode === 'single' ? 'random' : 'loop');
    setPlayMode(nextMode);
    socketRef.current?.emit('sync:mode', { roomId, playMode: nextMode });
  }, [playMode, roomId]);

  /* ─── 上/下一曲 ─── */
  const switchTrack = useCallback((dir: -1 | 1) => {
    if (playlist.length === 0) return;
    const curIdx = currentTrack ? playlist.findIndex(t => t.id === currentTrack.id) : -1;
    let nextIdx = curIdx + dir;
    if (nextIdx < 0) nextIdx = playlist.length - 1;
    if (nextIdx >= playlist.length) nextIdx = 0;
    
    if (playMode === 'random') {
      nextIdx = Math.floor(Math.random() * playlist.length);
    }
    
    selectTrack(playlist[nextIdx]);
  }, [playlist, currentTrack, playMode]);

  /* ─── 歌曲播放自然结束后的自动切歌/循环处理 ─── */
  const handleAudioEnded = useCallback(() => {
    if (playMode === 'single' && audioRef.current) {
      console.log('[单曲循环激活] 重新拉起当前曲目');
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error(e));
      socketRef.current?.emit('sync:seek', { roomId, position: 0 });
    } else {
      switchTrack(1);
    }
  }, [playMode, switchTrack, roomId]);

  /* ─── 统一安全的音频加载与 100% 自动播放机制 ─── */
  useEffect(() => {
    if (currentTrack?.audioUrl && audioRef.current) {
      audioRef.current.load();
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error("自动播放被浏览器限制，等待用户手势激活:", err);
          });
      }
    }
  }, [currentTrack?.audioUrl]);

  /* ─── 选择歌曲 ─── */
  const selectTrack = useCallback(async (track: Track) => {
    setCurrentLyrics('正在缓冲高品质音轨，跨平台智能力回退可能需要 1-3 秒...');

    // 【智能预加载拦截命中】若在后台早已预热成功，直接 0 延迟秒开，避免跨国 API 重复等待！
    if (prebufferedTrackRef.current && prebufferedTrackRef.current.id === track.id) {
      console.log(`[预缓冲命中🎯] 0秒秒开跨国音流: ${track.title}`);
      const cache = prebufferedTrackRef.current;
      const fullTrack: Track = { ...track, audioUrl: cache.audioUrl, lyrics: cache.lyrics };
      
      setCurrentTrack(fullTrack);
      if (cache.lyrics) setCurrentLyrics(cache.lyrics);
      else setCurrentLyrics('');

      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
      
      socketRef.current?.emit('sync:play', { roomId, position: 0, track: fullTrack });
      prebufferedTrackRef.current = null; // 消费后置空
      return;
    }

    try {
      const neteaseCookie = neteaseAuth.cookie || localStorage.getItem('ms_netease_cookie') || '';
      const qqCookie = qqAuth.cookie || localStorage.getItem('ms_qq_cookie') || '';
      const cookieToUse = track.platform === 'netease' ? neteaseCookie : qqCookie;

      const res = await fetch(`${SERVER_URL}/api/${track.platform}/song/${track.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          cookie: cookieToUse,
          roomId
        })
      });
      const data = await res.json();
      
      let targetAudio = data.audioUrl || track.audioUrl;
      let targetLyrics = data.lyrics;
      let isFallbackTriggered = !!data.isFallback;

      if (!targetAudio) {
        setCurrentTrack({ ...track, audioUrl: '' });
        setCurrentLyrics('抱歉，该歌曲在两端均受版权保护，暂无可用音轨。');
        setIsPlaying(false);
        if (audioRef.current) {
           audioRef.current.pause();
           audioRef.current.removeAttribute('src');
        }
        return;
      }

      if (targetLyrics) setCurrentLyrics(targetLyrics);
      else setCurrentLyrics('');

      const proxyUrl = `${SERVER_URL}/proxy/audio?url=${encodeURIComponent(targetAudio)}`;
      const fullTrack: Track = { ...track, audioUrl: proxyUrl, lyrics: targetLyrics };
      
      fullTrack.title = track.title;
      fullTrack.isFallback = isFallbackTriggered;

      setCurrentTrack(fullTrack);
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);

      socketRef.current?.emit('sync:play', { roomId, position: 0, track: fullTrack });
    } catch {
      const proxyUrl = `${SERVER_URL}/proxy/audio?url=${encodeURIComponent(track.audioUrl)}`;
      const fallbackTrack = { ...track, audioUrl: proxyUrl };
      setCurrentTrack(fallbackTrack);
      setCurrentLyrics('');
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
      socketRef.current?.emit('sync:play', { roomId, position: 0, track: fallbackTrack });
    }
  }, [roomId]);

  /* ─── 平台登录 ─── */
  const handleNeteaseLogin = useCallback(() => {
    setLoginModalPlatform('netease');
  }, []);

  const handleQQLogin = useCallback(() => {
    setLoginModalPlatform('qq');
  }, []);

  /* ─── 面板互斥控制 ─── */
  const openPlaylist = useCallback(() => {
    setShowPlaylist(true);
    setShowSearchResults(false);
  }, []);

  /* ─── 歌单中选曲后更新并广播活跃歌单 ─── */
  const handleSelectFromPanel = useCallback((track: Track) => {
    setPlaylist(folderTracks);
    selectTrack(track);
    // 穿透广播整个歌单，使另一端有完整的播放列表，具备上下曲自主控制权
    socketRef.current?.emit('sync:playlist', { roomId, playlist: folderTracks });
  }, [folderTracks, selectTrack, roomId]);

  /* ─── 搜索处理 ─── */
  const handleSearch = useCallback(async (keyword: string, platform: Platform) => {
    try {
      setSearchPlatform(platform);
      setShowSearchResults(true);
      setShowPlaylist(false);
      setIsSearching(true);
      const res = await fetch(`${SERVER_URL}/api/${platform}/search?keyword=${encodeURIComponent(keyword)}&roomId=${roomId}`);
      const data = await res.json();
      
      // 坚固防御性编程：若后端接口由于各种网络限制返回了报错对象，强制用空数组保底以拒绝 React 遍历白屏崩溃
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        console.error('搜索接口未返回合法数组数据:', data);
        setSearchResults([]);
      }
    } catch (e) {
      console.error('Search failed', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [roomId]);

  const handleSelectSearchResult = useCallback((track: Track) => {
    setPlaylist(searchResults);
    selectTrack(track);
    setShowSearchResults(false);
    // 搜索点歌时，同样穿透广播列表
    socketRef.current?.emit('sync:playlist', { roomId, playlist: searchResults });
  }, [searchResults, selectTrack, roomId]);

  /* ─── 音频 src ─── */
  const audioSrc = currentTrack?.audioUrl || '';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
      
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {!isRoomConnected ? (
        /* 🔮 iOS 极简液态玻璃房间入口门户（未登舱时仅展示此极净卡片） */
        <WelcomePortal
          onJoin={handleJoinRoom}
          onCreate={handleCreateRoom}
          isLoading={isConnectingRoom}
          neteaseAuth={neteaseAuth}
          qqAuth={qqAuth}
          initialRoomId={roomId}
        />
      ) : (
        <>
          {/* 固定层：顶部导航 */}
          <TopBar
            playerMode={playerMode}
            onModeChange={setPlayerMode}
            neteaseAuth={neteaseAuth}
            qqAuth={qqAuth}
            onNeteaseLogin={handleNeteaseLogin}
            onQQLogin={handleQQLogin}
            onOpenPlaylist={openPlaylist}
            roomId={roomId}
            roomMembers={roomMembers}
            onJoinRoom={handleJoinRoom}
            onLeaveRoom={handleLeaveRoom}
            isPublic={isPublic}
            isHost={roomMembers.find(m => m.id === socketRef.current?.id)?.isHost || false}
            onPublicChange={handlePublicChange}
            immersive={playerMode === 'wave'}
          />

          {/* 模式内容区 */}
          <div style={{
            opacity: playerMode === 'classic' ? 1 : 0,
            transform: playerMode === 'classic' ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            position: playerMode === 'classic' ? 'relative' : 'absolute',
            inset: playerMode === 'classic' ? undefined : 0,
            pointerEvents: playerMode === 'classic' ? 'auto' : 'none',
            zIndex: playerMode === 'classic' ? 1 : 0,
          }}>
            <ClassicMode 
              currentTrack={currentTrack} 
              lyrics={currentLyrics} 
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSeek={handleSeek}
            />
          </div>

          <div style={{
            opacity: playerMode === 'wave' ? 1 : 0,
            transform: playerMode === 'wave' ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            position: playerMode === 'wave' ? 'relative' : 'absolute',
            inset: playerMode === 'wave' ? undefined : 0,
            pointerEvents: playerMode === 'wave' ? 'auto' : 'none',
            zIndex: playerMode === 'wave' ? 1 : 0,
          }}>
            {playerMode === 'wave' && (
              <WaveMode
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                lyrics={currentLyrics}
                currentTime={currentTime}
                audioRef={audioRef}
              />
            )}
          </div>

          {playerMode === 'classic' && <SearchBox onSearch={handleSearch} />}

          {/* 固定层：底部控制坞 */}
          <PlayerDock
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            progress={progress}
            currentTime={currentTime}
            duration={duration}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onPrev={() => switchTrack(-1)}
            onNext={() => switchTrack(1)}
            onOpenPlaylist={openPlaylist}
            playMode={playMode}
            onModeChange={handleModeChange}
          />

          {/* 歌单侧滑面板 */}
          <PlaylistPanel
            visible={playerMode === 'classic' && showPlaylist}
            onClose={() => setShowPlaylist(false)}
            neteaseFolders={neteaseFolders}
            qqFolders={qqFolders}
            neteaseAuth={neteaseAuth}
            qqAuth={qqAuth}
            onSelectTrack={handleSelectFromPanel}
            activePlatform={playlistPlatform}
            onPlatformChange={handlePlatformChange}
            isLoading={playlistPlatform === 'netease' ? loadingNetease : loadingQQ}
            activeFolderId={activeFolderId}
            folderTracks={folderTracks}
            onFolderClick={handleFolderClick}
            onBackClick={() => setActiveFolderId(null)}
            isLoadingTracks={loadingTracks}
          />

          {/* 搜索结果面板 */}
          <SearchResultsPanel
            visible={playerMode === 'classic' && showSearchResults}
            isLoading={isSearching}
            onClose={() => setShowSearchResults(false)}
            results={searchResults}
            onSelectTrack={handleSelectSearchResult}
            platform={searchPlatform}
          />

          {/* 登录模态框 */}
          {playerMode === 'classic' && loginModalPlatform && (
            <LoginModal 
              platform={loginModalPlatform}
              onClose={() => setLoginModalPlatform(null)}
              onSuccess={(auth) => {
                if (loginModalPlatform === 'netease') setNeteaseAuth(auth);
                else setQQAuth(auth);
                setLoginModalPlatform(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
