import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import axios from 'axios';
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

import fs from 'fs';
import path from 'path';

// 自定义简易 dotenv 加载器，免安装第三方依赖，自动读取并装载本地 .env 环境变量
const loadEnvFile = () => {
  try {
    const envPaths = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), 'apps/server/.env'),
      __dirname ? path.join(__dirname, '.env') : '',
      __dirname ? path.join(__dirname, '../.env') : '',
      __dirname ? path.join(__dirname, '../../.env') : ''
    ].filter(Boolean);
    
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        });
        console.log(`[自研Env加载器] 成功加载环境变量文件: ${envPath}`);
        break;
      }
    }
  } catch (e) {
    console.error('[自研Env加载器] 加载 .env 失败:', e);
  }
};
loadEnvFile();

import Fastify from 'fastify';
import cors from '@fastify/cors';

import { Server } from 'socket.io';
import https from 'https';
import http from 'http';
import { Member, RoomState, Track } from '@musesync/shared';
import { spawn } from 'child_process';
// @ts-ignore
import ncmApi from 'NeteaseCloudMusicApi';
// @ts-ignore
import qqMusic from 'qq-music-api';
import { musicService, patchQQCookie } from './services/musicService';
import { upsertPublicRoom, deactivatePublicRoom, getRoomAuth } from './services/supabaseService';
import {
  buildPublicRoomPayload,
  removeMemberAndPromoteHost,
  resolveClientIp,
  resolveRoomCreationSettings
} from './services/roomSync';

// 全局未捕获异常防御拦截，防止进程退出崩溃
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [全局拦截] 未处理的 Promise 拒绝 (Unhandled Rejection) at:', promise, '原因:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ [全局拦截] 未捕获的致命异常 (Uncaught Exception) 抛出:', err);
});

const ncm = ncmApi as any;
let globalQQCookie = '';
const CHINA_IP = '116.25.146.177'; // 伪装中国大陆 IP 以绕过海外机房风控限制

// 帮助函数：过滤敏感 Cookie 字符串后再下发给游客，保障信息安全
const stripCookie = (auth: PlatformAuth | undefined): PlatformAuth | undefined => {
  if (!auth) return undefined;
  const copy = { ...auth };
  delete copy.cookie;
  return copy;
};

const fastify = Fastify({ logger: true });

// Setup CORS
fastify.register(cors, { origin: '*' });

// 3. Room State & Multitenancy (多房间与密码共享机制)
interface ExtendedRoomState {
  roomId: string;
  password?: string;
  hostId: string;
  members: Array<{
    id: string;
    nickname: string;
    avatar: string;
    rtt: number;
    joinedAt: number;
    isHost: boolean;
    ip?: string;
  }>;
  track: Track | null;
  position: number;
  isPlaying: boolean;
  lastSyncAt: number;
  playlist: Track[];
  playMode: 'loop' | 'single' | 'random';
  neteaseAuth?: PlatformAuth;
  qqAuth?: PlatformAuth;
  isPublic?: boolean;
}

// 统一使用的默认鉴权类型
interface PlatformAuth {
  loggedIn: boolean;
  userId: string;
  nickname: string;
  avatar: string;
  cookie?: string;
}

const rooms = new Map<string, ExtendedRoomState>();

// 获取或初始化房间，并从云端异步加载持久化的历史登录态
const getOrCreateRoom = (roomId: string, password?: string, isPublic?: boolean): ExtendedRoomState => {
  if (!rooms.has(roomId)) {
    const security = resolveRoomCreationSettings(undefined, password, isPublic);
    const newRoom: ExtendedRoomState = {
      roomId,
      password: security.password,
      hostId: '',
      members: [],
      track: null,
      position: 0,
      isPlaying: false,
      lastSyncAt: Date.now(),
      playlist: [],
      playMode: 'loop',
      isPublic: security.isPublic
    };
    rooms.set(roomId, newRoom);

    // 异步拉取数据库记录以还原历史登录凭证环境，实现免密复用
    void (async () => {
      try {
        const credentials = await getRoomAuth(roomId);
        if (credentials) {
          if (credentials.neteaseAuth && credentials.neteaseAuth.loggedIn) {
            newRoom.neteaseAuth = credentials.neteaseAuth;
            console.log(`[账号自愈] 房间 ${roomId} 从 Supabase 恢复网易云登录态: ${credentials.neteaseAuth.nickname}`);
          }
          if (credentials.qqAuth && credentials.qqAuth.loggedIn) {
            newRoom.qqAuth = credentials.qqAuth;
            console.log(`[账号自愈] 房间 ${roomId} 从 Supabase 恢复 QQ 音乐登录态: ${credentials.qqAuth.nickname}`);
            if (credentials.qqAuth.cookie) {
              globalQQCookie = credentials.qqAuth.cookie;
              musicService.setQQCookie(credentials.qqAuth.cookie);
              // 同步给本地的 3200 端口解密进程
              fetch(`http://127.0.0.1:3200/user/setCookie?cookie=${encodeURIComponent(credentials.qqAuth.cookie)}`).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error(`[账号自愈] 房间 ${roomId} 自动读取登录态发生异常:`, err);
      }
    })();
  }
  return rooms.get(roomId)!;
};

// 1. Audio Proxy Endpoint (TASK-004)
// Preserves HTTP Range for seamless seek and injects Referer to bypass anti-leech
// 支持带 Referer 跟随 302 的辅助请求函数
const getWithRedirect = (urlStr: string, options: any, maxRedirects = 5): Promise<http.IncomingMessage> => {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));
    const targetUrl = new URL(urlStr);
    const client = targetUrl.protocol === 'https:' ? https : http;
    client.get(targetUrl, options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let newUrl = res.headers.location;
        if (!newUrl.startsWith('http')) newUrl = new URL(newUrl, urlStr).toString();
        resolve(getWithRedirect(newUrl, options, maxRedirects - 1));
      } else {
        resolve(res);
      }
    }).on('error', reject);
  });
};

fastify.get('/proxy/audio', async (request, reply) => {
  const { url } = request.query as { url: string };
  if (!url) return reply.code(400).send('URL required');

  const range = request.headers.range;

  let referer = 'https://music.163.com/';
  if (url.includes('qq.com') || url.includes('qpic.cn') || url.includes('tencent')) {
    referer = 'https://y.qq.com/';
  }

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0',
      'Referer': referer, 
      ...(range ? { 'Range': range } : {})
    }
  };

  try {
    const proxyRes = await getWithRedirect(url, options);
    
    // 深度克隆并清理源站响应头，防止被源站 CDN header 污染或发生跨域冲突
    const cleanHeaders = { ...proxyRes.headers };
    delete cleanHeaders['content-encoding'];
    delete cleanHeaders['transfer-encoding'];
    delete cleanHeaders['access-control-allow-origin'];
    delete cleanHeaders['access-control-allow-headers'];
    delete cleanHeaders['access-control-allow-methods'];
    delete cleanHeaders['access-control-expose-headers'];

    reply.headers(cleanHeaders);

    // 强行注入允许所有源跨域的 Header，以完美适配前端 audio 标签的 crossOrigin="anonymous"
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', '*');
    reply.header('X-Accel-Buffering', 'no');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');

    reply.code(proxyRes.statusCode || 200);
    return reply.send(proxyRes);
  } catch (err: any) {
    console.error('Audio proxy error:', err);
    return reply.code(500).send('Proxy error');
  }
});

// ==========================================
// 🎵 2. 网易云音乐 API 集成 (Netease)
// ==========================================

fastify.get('/api/netease/search', async (request, reply) => {
  const { keyword, cookie, roomId } = request.query as { keyword: string, cookie?: string, roomId?: string };
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.neteaseAuth && room.neteaseAuth.cookie) {
      cookieToUse = room.neteaseAuth.cookie;
    }
  }
  try {
    const res = await ncm.cloudsearch({ keywords: keyword, limit: 30, cookie: cookieToUse, realIP: CHINA_IP });
    const songs = res.body.result.songs || [];
    const tracks: Track[] = songs.map((s: any) => ({
      id: String(s.id),
      title: s.name,
      artist: s.ar?.map((a: any) => a.name).join(', ') || s.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
      album: s.al?.name || s.album?.name || 'Unknown',
      coverUrl: s.al?.picUrl || s.album?.picUrl || 'https://via.placeholder.com/200',
      duration: (s.dt || s.duration || 0) / 1000,
      platform: 'netease',
      audioUrl: ''
    }));
    return reply.send(tracks);
  } catch (e) {
    return reply.code(500).send({ error: 'Netease Search failed' });
  }
});

fastify.post('/api/netease/user/playlist', async (request, reply) => {
  const { uid, cookie, roomId } = request.body as { uid: string, cookie?: string, roomId?: string };
  if (!uid) return reply.send([]);
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.neteaseAuth && room.neteaseAuth.cookie) {
      cookieToUse = room.neteaseAuth.cookie;
    }
  }
  try {
    const plRes = await ncm.user_playlist({ uid, cookie: cookieToUse, realIP: CHINA_IP });
    const playlists = plRes.body.playlist || [];
    const folders = playlists.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      coverUrl: p.coverImgUrl || 'https://via.placeholder.com/200',
      trackCount: p.trackCount || 0,
      platform: 'netease'
    }));
    return reply.send(folders);
  } catch (e) {
    return reply.code(500).send({ error: 'Netease Playlist failed' });
  }
});

fastify.post('/api/netease/playlist/tracks', async (request, reply) => {
  const { id, cookie, roomId } = request.body as { id: string, cookie?: string, roomId?: string };
  if (!id) return reply.send([]);
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.neteaseAuth && room.neteaseAuth.cookie) {
      cookieToUse = room.neteaseAuth.cookie;
    }
  }
  try {
    const tracksRes = await ncm.playlist_track_all({ id, limit: 100, cookie: cookieToUse, realIP: CHINA_IP });
    const songs = tracksRes.body.songs || [];
    const tracks: Track[] = songs.map((s: any) => ({
      id: String(s.id),
      title: s.name,
      artist: s.ar?.map((a: any) => a.name).join(', ') || s.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
      album: s.al?.name || s.album?.name || 'Unknown',
      coverUrl: s.al?.picUrl || s.album?.picUrl || 'https://via.placeholder.com/200',
      duration: (s.dt || s.duration || 0) / 1000,
      platform: 'netease',
      audioUrl: ''
    }));
    return reply.send(tracks);
  } catch(e) {
    return reply.code(500).send({ error: 'Netease Tracks failed' });
  }
});

fastify.post('/api/netease/song/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { title, artist, cookie, roomId } = request.body as any;
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.neteaseAuth && room.neteaseAuth.cookie) {
      cookieToUse = room.neteaseAuth.cookie;
    }
  }
  try {
    const result = await musicService.resolveNeteaseWithFallback(id, title, artist, cookieToUse);
    return reply.send(result);
  } catch (e) {
    console.error("Netease API Failed:", e);
    return reply.code(500).send({ error: 'Netease Song URL failed' });
  }
});

fastify.get('/api/netease/login/qr/key', async (request, reply) => {
  const res = await ncm.login_qr_key({ timestamp: Date.now() });
  return reply.send(res.body);
});
fastify.get('/api/netease/login/qr/create', async (request, reply) => {
  const { key, qrimg } = request.query as any;
  const res = await ncm.login_qr_create({ key, qrimg, timestamp: Date.now() });
  return reply.send(res.body);
});
fastify.get('/api/netease/login/qr/check', async (request, reply) => {
  const { key } = request.query as any;
  const res = await ncm.login_qr_check({ key, timestamp: Date.now() });
  return reply.send(res.body);
});
fastify.post('/api/netease/login/status', async (request, reply) => {
  const { cookie } = request.body as { cookie?: string };
  const res = await ncm.login_status({ cookie, timestamp: Date.now() });
  return reply.send(res.body);
});

// ==========================================
// 🎵 3. QQ 音乐 API 集成 (QQ)
// ==========================================

fastify.post('/api/qq/setCookie', async (request, reply) => {
  const { cookie, roomId } = request.body as { cookie: string, roomId?: string };
  try {
    globalQQCookie = cookie;
    qqMusic.setCookie(cookie);
    musicService.setQQCookie(cookie);
    axios.get(`http://127.0.0.1:3200/user/setCookie?cookie=${encodeURIComponent(cookie)}`).catch(() => {});
    
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        if (!room.qqAuth) {
          room.qqAuth = { loggedIn: true, nickname: 'QQ用户', avatar: '', cookie: cookie, userId: 'QQ_USER' };
        } else {
          room.qqAuth.cookie = cookie;
          room.qqAuth.loggedIn = true;
        }
        
        // 即时同步保存至 Supabase 数据库大厅
        const payload = buildPublicRoomPayload(roomId, room);
        if (payload) void upsertPublicRoom(payload);
        console.log(`[Cookie同步] 已将 QQ 音乐 Cookie 即时同步保存至房间 ${roomId} 并推送到云端。`);
      }
    }
    return reply.send({ success: true });
  } catch (e) {
    return reply.send({ success: false, message: 'Invalid Cookie' });
  }
});

fastify.post('/api/qq/user/detail', async (request, reply) => {
  const { id } = request.body as { id: string };
  try {
    const res = await qqMusic.api('user/detail', { id });
    return reply.send(res);
  } catch (e) {
    return reply.send({ creator: { nick: `QQ用户_${id.slice(0, 4)}`, headpic: 'https://y.gtimg.cn/mediastyle/global/img/album_300.png' } });
  }
});

fastify.get('/api/qq/playlist/detail', async (request, reply) => {
  const { id, roomId } = request.query as { id: string, roomId?: string };
  let cookieToUse = globalQQCookie || '';
  if (roomId) {
    const room = rooms.get(roomId);
    if (room && room.qqAuth && room.qqAuth.cookie) cookieToUse = room.qqAuth.cookie;
  }
  try {
    const url = `http://127.0.0.1:3200/getSongListDetail?disstid=${id}`;
    const patchedCookie = patchQQCookie(cookieToUse);
    const res = await axios.get(url, { headers: { 'Cookie': patchedCookie, 'Referer': 'https://y.qq.com/' } });
    const json = res.data;
    const songlist = (json?.response?.cdlist || json?.data?.cdlist)?.[0]?.songlist || [];
    return reply.send(songlist.map((s: any) => ({
      id: String(s.songmid || s.mid || s.id),
      title: s.songname || s.name || s.title || 'Unknown Title',
      artist: s.singer?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      album: s.albumname || s.album?.name || 'Unknown Album',
      coverUrl: (s.albummid || s.album?.mid) ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid || s.album.mid}.jpg` : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
      duration: s.interval || s.time || 0,
      platform: 'qq',
      audioUrl: ''
    })));
  } catch (e) {
    return reply.code(500).send({ error: 'QQ Playlist detail failed' });
  }
});

fastify.get('/api/qq/search', async (request, reply) => {
  const { keyword, cookie, roomId } = request.query as { keyword: string, cookie?: string, roomId?: string };
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.qqAuth && room.qqAuth.cookie) cookieToUse = room.qqAuth.cookie;
  }
  if (!cookieToUse) cookieToUse = globalQQCookie || '';
  const patchedCookie = patchQQCookie(cookieToUse);

  try {
    let list: any[] = [];
    const sbUrl = `http://127.0.0.1:3200/getSearchByKey?key=${encodeURIComponent(keyword)}`;
    try {
      const res = await axios.get(sbUrl, { headers: { 'Cookie': patchedCookie, 'Referer': 'https://y.qq.com/' }, timeout: 5000 });
      if (res.status === 200) {
        const json = res.data;
        list = json?.response?.data?.song?.list || json?.data?.song?.list || json?.data?.list || [];
      }
    } catch (err3200) {
      console.error('[QQ Search 3200 API Error, falling back to musicu]:', err3200);
    }

    if (!Array.isArray(list) || list.length === 0) {
      const musicuRes = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Referer": "https://y.qq.com/", 
          "Cookie": patchedCookie,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({ req_0: { method: "DoSearchForQQMusicDesktop", module: "music.search.SearchCgiService", param: { num_per_page: 30, page_num: 1, query: keyword, search_type: 0 } } })
      });
      const musicuJson = await musicuRes.json();
      list = musicuJson?.req_0?.data?.body?.song?.list || musicuJson?.req_0?.data?.song?.list || [];
    }

    return reply.send(list.map((s: any) => ({
      id: String(s.songmid || s.mid || s.id),
      title: s.songname || s.name || s.title || 'Unknown Title',
      artist: Array.isArray(s.singer) ? s.singer.map((a: any) => a.name).join(', ') : 'Unknown Artist',
      album: s.albumname || s.album?.name || 'Unknown Album',
      coverUrl: (s.albummid || s.album?.mid) ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid || s.album.mid}.jpg` : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
      duration: s.interval || s.time || 0,
      platform: 'qq',
      audioUrl: ''
    })));
  } catch (e) {
    return reply.code(500).send({ error: 'QQ Search failed' });
  }
});

fastify.post('/api/qq/user/playlist', async (request, reply) => {
  const { uid, cookie, roomId } = request.body as { uid: string, cookie?: string, roomId?: string };
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.qqAuth && room.qqAuth.cookie) cookieToUse = room.qqAuth.cookie;
  }
  const targetCookie = cookieToUse || globalQQCookie || '';
  const patchedCookie = patchQQCookie(targetCookie);

  console.log(`[QQ User Playlist] 开始拉取歌单. uid=${uid}, cookieProvided=${!!cookie}, roomId=${roomId}, hasTargetCookie=${!!targetCookie}`);

  let folders: any[] = [];
  
  // 1. 优先调用 3200 本地独立服务以防老 SDK 发生 mymusic 崩溃
  try {
    const url = `http://127.0.0.1:3200/user/getUserPlaylists?uin=${uid}`;
    const res3200 = await axios.get(url, { headers: { 'Cookie': patchedCookie } });
    if (res3200.status === 200) {
      const json3200 = res3200.data;
      const playlists = json3200?.response?.data?.playlists || json3200?.data?.playlists || [];
      if (Array.isArray(playlists) && playlists.length > 0) {
        folders = playlists.map((p: any) => {
          let trackCount = p.song_cnt || p.song_num || p.songnum || 0;
          if (!trackCount && p.subtitle) {
            const match = String(p.subtitle).match(/^\s*(\d+)/);
            if (match) {
              trackCount = parseInt(match[1], 10);
            }
          }
          return {
            id: String(p.tid || p.dissid || p.id || p.dirid),
            name: p.diss_name || p.title || p.dissname || '未命名歌单',
            coverUrl: p.diss_cover || p.picurl || p.pic_url || 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
            trackCount,
            platform: 'qq'
          };
        });
        console.log(`[QQ User Playlist] 成功通过 3200 端口服务拉取到 ${folders.length} 个歌单`);
      }
    }
  } catch (e3200: any) {
    console.error('[QQ User Playlist API 3200 Error, falling back...]:', e3200.message || e3200);
  }

  // 2. 兜底：若 3200 端口服务未能获取到歌单，则回退降级到老版 SDK 的 api调用
  if (folders.length === 0) {
    try {
      if (patchedCookie) {
        qqMusic.setCookie(patchedCookie);
      }
      const res = await qqMusic.api('user/songlist', { id: uid }) as any;
      const list = res?.list || [];
      folders = list.map((p: any) => {
        let trackCount = p.song_cnt || p.song_num || p.songnum || 0;
        if (!trackCount && p.subtitle) {
          const match = String(p.subtitle).match(/^\s*(\d+)/);
          if (match) {
            trackCount = parseInt(match[1], 10);
          }
        }
        return {
          id: String(p.tid || p.id || p.dirid),
          name: p.diss_name || '未命名歌单',
          coverUrl: p.diss_cover || 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
          trackCount,
          platform: 'qq'
        };
      });
      console.log(`[QQ User Playlist] 3200 服务无响应，触发兜底老 SDK 成功拉取到 ${folders.length} 个歌单`);
    } catch (eOldSdk: any) {
      console.error('[QQ User Playlist Old SDK Error, fallback also failed]:', eOldSdk.message || eOldSdk);
    }
  }

  // 保底与校准：校准“我喜欢”歌单的真实歌曲数并确保列表中有该歌单
  let favTrackCount = 0;
  if (patchedCookie) {
    try {
      if (patchedCookie) {
        qqMusic.setCookie(patchedCookie);
      }
      const mapRes = await qqMusic.api('songlist/map', { dirid: 201 }) as any;
      favTrackCount = Object.keys(mapRes?.mid || mapRes?.id || {}).length;
      console.log(`[我喜欢歌单] 成功获取真实歌曲数量 (通过 songlist/map): ${favTrackCount}`);
    } catch (favErr: any) {
      console.error('[我喜欢歌单] 获取歌曲数量失败:', favErr.message || favErr);
    }
  } else {
    console.log('[我喜欢歌单] 未检测到 Cookie，跳过 songlist/map 总数拉取，默认 trackCount=0');
  }

  const favIndex = folders.findIndex((f: any) => f.id === '201' || f.name === '我喜欢' || f.name === '我喜欢的音乐');
  if (favIndex > -1) {
    console.log(`[QQ User Playlist] 列表已存在"我喜欢"歌单，更新歌曲总数为: ${favTrackCount}`);
    folders[favIndex].trackCount = favTrackCount;
    folders[favIndex].id = '201';
    folders[favIndex].name = '我喜欢的音乐';
  } else {
    console.log(`[QQ User Playlist] 列表未检出"我喜欢"歌单，启动保底注入 dirid=201 (数量: ${favTrackCount})...`);
    folders.unshift({
      id: '201',
      name: '我喜欢的音乐',
      coverUrl: 'http://y.gtimg.cn/mediastyle/global/img/cover_like.png',
      trackCount: favTrackCount,
      platform: 'qq'
    });
  }

  return reply.send(folders);
});

fastify.post('/api/qq/playlist/tracks', async (request, reply) => {
  const { id, cookie, roomId } = request.body as { id: string, cookie?: string, roomId?: string };
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.qqAuth && room.qqAuth.cookie) cookieToUse = room.qqAuth.cookie;
  }

  const targetCookie = cookieToUse || globalQQCookie || '';
  const patchedCookie = patchQQCookie(targetCookie);

  // ========== "我喜欢"特殊歌单（dirid=201）：直接通过老版 SDK 获取 map 并批量并发打包拉取 ==========
  if (id === '201' || id === '0') {
    console.log(`[我喜欢歌单] 检测到特殊歌单 ID: ${id}，启动 map 接口与批量打包详情拉取...`);
    try {
      if (patchedCookie) {
        qqMusic.setCookie(patchedCookie);
      }
      // 1. 先通过旧 SDK 成功获取包含 1300+ 首歌的映射 Map
      const mapRes = await qqMusic.api('songlist/map', { dirid: 201 }) as any;
      
      // 注意：老版 SDK mapRes 返回的结构是 { mid: { [songmid]: 1 }, id: { [songid]: 1 } }
      const songMids = mapRes && mapRes.mid ? Object.keys(mapRes.mid) : [];
      console.log(`[我喜欢歌单] 成功获取到 ${songMids.length} 首歌曲的 mid`);

      if (songMids.length > 0) {
        const allSongs: any[] = [];
        const CHUNK_SIZE = 30; // 每批打包 30 首歌，避免官方单次打包超限（500000错误）
        const chunks: string[][] = [];
        
        for (let i = 0; i < songMids.length; i += CHUNK_SIZE) {
          chunks.push(songMids.slice(i, i + CHUNK_SIZE));
        }

        console.log(`[我喜欢歌单] 开始分 ${chunks.length} 批并发拉取歌曲详细数据...`);
        
        // 2. 分批并行发送批量打包请求，仅 14 个并发请求就能秒级拉回全部数据
        await Promise.all(chunks.map(async (chunk, chunkIdx) => {
          try {
            const comm = { ct: 24, cv: 0 };
            const requestBody: any = { comm };
            
            chunk.forEach((mid, idx) => {
              requestBody[`songinfo_${idx}`] = {
                method: 'get_song_detail_yqq',
                param: {
                  song_type: 0,
                  song_mid: mid
                },
                module: 'music.pf_song_detail_svr'
              };
            });

            const res = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=1124214810', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://y.qq.com/'
              },
              body: JSON.stringify(requestBody)
            });
            const data: any = await res.json();
            
            chunk.forEach((mid, idx) => {
              const subRes = data[`songinfo_${idx}`];
              const track = subRes?.data?.track_info;
              if (track && track.name) {
                allSongs.push({
                  id: String(track.mid || track.id || mid),
                  title: track.name,
                  artist: track.singer?.map((s: any) => s.name).join(', ') || 'Unknown Artist',
                  album: track.album?.name || 'Unknown Album',
                  coverUrl: track.album?.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.mid}.jpg` : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
                  duration: track.interval || 0,
                  platform: 'qq',
                  audioUrl: ''
                });
              }
            });
          } catch (chunkErr: any) {
            console.error(`[我喜欢歌单] 第 ${chunkIdx} 批打包拉取详情失败:`, chunkErr.message || chunkErr);
          }
        }));

        console.log(`[我喜欢歌单] 打包获取成功！共加载 ${allSongs.length} 首歌曲详情`);
        return reply.send(allSongs);
      }
    } catch (err: any) {
      console.error('[我喜欢歌单] 批量映射打包获取失败:', err.message || err);
    }
    
    // 如果获取失败或者返回空，保底返回空列表
    return reply.send([]);
  }

  // ========== 普通歌单：走 getSongListDetail 常规路径 ==========
  try {
    const url = `http://127.0.0.1:3200/getSongListDetail?disstid=${id}`;
    const res = await axios.get(url, { headers: { 'Cookie': patchedCookie, 'Referer': 'https://y.qq.com/' } });
    const json = res.data;
    const songlist = (json?.response?.cdlist || json?.data?.cdlist)?.[0]?.songlist || [];
    return reply.send(songlist.map((s: any) => ({
      id: String(s.songmid || s.mid || s.id),
      title: s.songname || s.name || s.title || 'Unknown Title',
      artist: s.singer?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      album: s.albumname || s.album?.name || 'Unknown Album',
      coverUrl: (s.albummid || s.album?.mid) ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid || s.album.mid}.jpg` : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
      duration: s.interval || s.time || 0,
      platform: 'qq',
      audioUrl: ''
    })));
  } catch (e) {
    return reply.send([]);
  }
});

fastify.post('/api/qq/song/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { title, artist, cookie, roomId } = request.body as any;
  let cookieToUse = cookie || '';
  if (!cookieToUse && roomId) {
    const room = rooms.get(roomId);
    if (room && room.qqAuth && room.qqAuth.cookie) cookieToUse = room.qqAuth.cookie;
  }
  
  const targetCookie = cookieToUse || globalQQCookie || '';
  const patchedCookie = patchQQCookie(targetCookie);

  console.log(`[QQ Song URL Request] id=${id}, title=${title}, artist=${artist}, roomId=${roomId}, hasLocalCookie=${!!cookie}, hasRoomCookie=${!!(roomId && rooms.get(roomId)?.qqAuth?.cookie)}, hasGlobalCookie=${!!globalQQCookie}, finalCookieLength=${targetCookie.length}`);

  try {
    const result = await musicService.resolveQQWithFallback(id, title, artist, patchedCookie);
    console.log(`[QQ Song URL Result] id=${id}, isFallback=${result.isFallback}, urlEmpty=${!result.audioUrl}`);
    return reply.send(result);
  } catch (e: any) {
    console.error(`[QQ Song URL Error] id=${id}:`, e.message || e);
    return reply.code(500).send({ error: 'QQ Song URL failed' });
  }
});

// Setup Socket.IO for realtime sync
fastify.ready((err) => {
  if (err) throw err;
  
  const io = new Server(fastify.server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);
    let currentRoomId = '';

    // 1. 用户加入房间事件（支持 previousMemberId 断线重连角色继承）
    socket.on('join:room', (data: { roomId: string; password?: string; previousMemberId?: string; isPublic?: boolean; user: { nickname: string; avatar: string }; neteaseAuth?: PlatformAuth; qqAuth?: PlatformAuth }) => {
      const { roomId, password, previousMemberId, isPublic, user, neteaseAuth, qqAuth } = data;
      const room = getOrCreateRoom(roomId, password, isPublic);

      // 密码强校验逻辑（接收前端已哈希的密码密文进行等值对齐）
      if (room.password && room.password !== password) {
        socket.emit('join:failed', { message: '房间密码错误，请重新输入！' });
        return;
      }

      // 退出原房间
      if (currentRoomId) {
        socket.leave(currentRoomId);
        const oldRoom = rooms.get(currentRoomId);
        if (oldRoom) {
          removeMemberAndPromoteHost(oldRoom, socket.id);
          io.to(currentRoomId).emit('sync:members', oldRoom.members);
        }
      }

      currentRoomId = roomId;
      socket.join(roomId);

      // 【断线自愈身份抢占机制】
      // 若传入 previousMemberId，查找房间中是否存在对应的旧成员记录
      // 若找到，新 Socket 直接继承其角色（isHost、nickname、avatar），无缝恢复身份
      let inheritedRole = false;
      let finalNickname = user.nickname || `听友_${socket.id.slice(0, 4)}`;
      let finalAvatar = user.avatar || 'https://y.gtimg.cn/mediastyle/global/img/album_300.png';
      let finalIsHost = false;

      if (previousMemberId) {
        const prevMemberIndex = room.members.findIndex(m => m.id === previousMemberId);
        if (prevMemberIndex !== -1) {
          const prevMember = room.members[prevMemberIndex];
          // 继承旧成员的角色属性（优先使用旧成员的 nickname/avatar，除非新登录时有新值传入）
          finalIsHost = prevMember.isHost;
          finalNickname = user.nickname || prevMember.nickname;
          finalAvatar = user.avatar || prevMember.avatar;
          
          // 如果继承 host 角色，更新 hostId
          if (finalIsHost) room.hostId = socket.id;
          
          // 移除旧的成员记录（新 socketId 替代）
          room.members.splice(prevMemberIndex, 1);
          inheritedRole = true;
          fastify.log.info(`[断线自愈] Socket ${socket.id} 继承了 ${previousMemberId} 的身份，isHost=${finalIsHost}`);
        }
      }

      // 若未能继承旧身份，按常规逻辑处理
      if (!inheritedRole) {
        finalIsHost = room.members.length === 0;
        if (finalIsHost) room.hostId = socket.id;
      }

      // 【房主凭证注册校验】
      // 只有当加入的成员被判定为 Host (房主) 时，才允许在加入时上传并更新房间登录态；如果是游客，强制忽略，实现只读共享
      if (finalIsHost) {
        if (neteaseAuth && neteaseAuth.loggedIn) {
          // 如果新上传的有 cookie，或者原本没有，执行合并更新
          if (!room.neteaseAuth || !room.neteaseAuth.cookie || neteaseAuth.cookie) {
            room.neteaseAuth = {
              ...room.neteaseAuth,
              ...neteaseAuth,
              cookie: neteaseAuth.cookie || room.neteaseAuth?.cookie
            };
            console.log(`[免密共享] 房主 ${socket.id} 加入/更新，成功注册网易云登录态, 用户: ${neteaseAuth.nickname}`);
          }
        }
        if (qqAuth && qqAuth.loggedIn) {
          // 只要有有效登录态或新 Cookie，执行合并覆盖更新，杜绝空覆盖吞掉有效 Cookie 的 Bug
          if (!room.qqAuth || !room.qqAuth.cookie || qqAuth.cookie) {
            room.qqAuth = {
              ...room.qqAuth,
              ...qqAuth,
              cookie: qqAuth.cookie || room.qqAuth?.cookie
            };
            console.log(`[免密共享] 房主 ${socket.id} 加入/更新，成功注册QQ音乐登录态, 用户: ${qqAuth.nickname}`);
            if (room.qqAuth.cookie) {
              globalQQCookie = room.qqAuth.cookie;
              musicService.setQQCookie(room.qqAuth.cookie);
              // 强行同步到本地 3200 端口服务的全局内存中，确保代理端获取音乐 vkey 100% 携带 SVIP 权限
              fetch(`http://127.0.0.1:3200/user/setCookie?cookie=${encodeURIComponent(room.qqAuth.cookie)}`).catch(err => {
                console.error('[Sync Cookie to 3200 via JoinRoom Error]', err);
              });
            }
          }
        }
      }

      // 反代必须覆盖这些 Header，避免信任客户端自行伪造的值。
      const clientIp = resolveClientIp(socket.handshake.headers, socket.handshake.address);

      // 将新 Socket 注册入房间列表
      room.members.push({
        id: socket.id,
        nickname: finalNickname,
        avatar: finalAvatar,
        rtt: 0,
        joinedAt: Date.now(),
        isHost: finalIsHost,
        ip: clientIp
      });

      // 【高精进度自愈追赶算法】
      // 若当前处于播放中，根据上一次同步时刻推算当下的最真实播放位置，实现重连无缝平滑对齐
      let catchUpPosition = room.position;
      if (room.isPlaying && room.lastSyncAt) {
        const elapsed = (Date.now() - room.lastSyncAt) / 1000;
        catchUpPosition = room.position + elapsed;
        if (room.track && room.track.duration && catchUpPosition > room.track.duration) {
          catchUpPosition = room.track.duration; // 边界保护，最大不超过歌曲总时长
        }
      }

      // 广播给自身：join:success，将敏感 Cookie 剥离，确保游客看不到房主的明文 Cookie
      socket.emit('join:success', {
        roomId,
        roomState: {
          track: room.track,
          position: catchUpPosition,
          isPlaying: room.isPlaying,
          playlist: room.playlist,
          playMode: room.playMode,
          neteaseAuth: stripCookie(room.neteaseAuth),
          qqAuth: stripCookie(room.qqAuth),
          isPublic: room.isPublic
        }
      });

      // 广播最新的成员列表
      io.to(roomId).emit('sync:members', room.members);
    });

    // 2. 心跳与高精延迟测算
    socket.on('ping:send', (data: { ts: number }) => {
      socket.emit('ping:ack', { ts: data.ts, serverTs: Date.now() });
    });

    socket.on('ping:report', (data: { rtt: number }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const member = room.members.find(m => m.id === socket.id);
      if (member) {
        member.rtt = data.rtt;
        // 定期向所有人广播最新延迟，前端以此触发物理距离展示
        io.to(currentRoomId).emit('sync:members', room.members);
      }
    });

    // 3. 多端核心操作同步 (基于具体房间)
    socket.on('sync:play', (data: { roomId: string; position: number; track?: any }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      room.isPlaying = true;
      room.position = data.position;
      if (data.track) room.track = data.track;
      room.lastSyncAt = Date.now();

      socket.to(roomId).emit('sync:play', {
        position: data.position,
        track: data.track,
        ts: room.lastSyncAt
      });
    });

    socket.on('sync:pause', (data: { roomId: string; position: number }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      room.isPlaying = false;
      room.position = data.position;
      room.lastSyncAt = Date.now();

      socket.to(roomId).emit('sync:pause', {
        position: data.position,
        ts: room.lastSyncAt
      });
    });

    socket.on('sync:seek', (data: { roomId: string; position: number }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      room.position = data.position;
      room.lastSyncAt = Date.now();

      socket.to(roomId).emit('sync:seek', {
        position: data.position,
        ts: room.lastSyncAt
      });
    });

    // 4. 播放列表同步 (解决手机端无列表导致切歌失败)
    socket.on('sync:playlist', (data: { roomId: string; playlist: Track[] }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      room.playlist = data.playlist;
      socket.to(roomId).emit('sync:playlist', { playlist: data.playlist });
    });

    // 5. 播放模式同步 (随机、循环、单曲)
    socket.on('sync:mode', (data: { roomId: string; playMode: 'loop' | 'single' | 'random' }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      room.playMode = data.playMode;
      socket.to(roomId).emit('sync:mode', { playMode: data.playMode });
    });

    // 6. 全局登录鉴权同步 (共享 SVIP 账号 - 加固 Host 身份限权)
    socket.on('sync:auth', (data: { roomId: string; platform: 'netease' | 'qq'; auth: PlatformAuth }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      // 严格权限过滤：非房主成员禁止更改/同步或注销登录凭证
      const member = room.members.find(m => m.id === socket.id);
      if (!member || !member.isHost) {
        console.warn(`[鉴权拦截] 非房主 Socket ${socket.id} 试图同步修改 ${data.platform} 登录凭证，拒绝操作。`);
        return;
      }

      if (data.platform === 'netease') {
        room.neteaseAuth = data.auth;
      } else {
        room.qqAuth = data.auth;
        if (data.auth.cookie) {
          globalQQCookie = data.auth.cookie;
          musicService.setQQCookie(data.auth.cookie);
          // 强行同步到本地 3200 端口服务的全局内存中，确保代理端获取音乐 vkey 100% 携带 SVIP 权限
          fetch(`http://127.0.0.1:3200/user/setCookie?cookie=${encodeURIComponent(data.auth.cookie)}`).catch(err => {
            console.error('[Sync Cookie to 3200 via SyncAuth Error]', err);
          });
        }
      }

      // 广播给房间内的其他人（剔除敏感的明文 Cookie，保卫账户安全）
      socket.to(roomId).emit('sync:auth', { platform: data.platform, auth: stripCookie(data.auth) });
    });

    // 6.2 房间公开状态动态同步 (仅 Host 可操纵)
    socket.on('sync:public', (data: { roomId: string; isPublic: boolean }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      const member = room.members.find(m => m.id === socket.id);
      if (member && member.isHost) {
        room.isPublic = data.isPublic;
        socket.to(roomId).emit('sync:public', { isPublic: data.isPublic });
      }
    });

    // 6.5. 主动退出房间事件
    socket.on('leave:room', () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          removeMemberAndPromoteHost(room, socket.id);
          io.to(currentRoomId).emit('sync:members', room.members);
        }
        socket.leave(currentRoomId);
        currentRoomId = '';
      }
    });

    // 7. 断开连接清理
    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          removeMemberAndPromoteHost(room, socket.id);
          io.to(currentRoomId).emit('sync:members', room.members);
        }
      }
    });
  });
});

// ─── 定时同步 Supabase 大厅 ───
// 每 5 秒把所有成员数 > 0 的房间推送到 Supabase，包括私密房和密码房。
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.members.length > 0) {
      const payload = buildPublicRoomPayload(roomId, room);
      if (payload) void upsertPublicRoom(payload);
    } else {
      // 如果房间空了，从 Supabase 标记不活跃，并从内存中清理
      void deactivatePublicRoom(roomId);
      rooms.delete(roomId);
    }
  }
}, 5000);

const start = async () => {
  try {
    // 自动在子进程中拉起 3200 端口的 QQ 音乐底层 API 服务
    try {
      const apiPath = path.resolve(__dirname, '../node_modules/@sansenjian/qq-music-api/dist/app.js');
      const injectScriptPath = path.resolve(__dirname, '../inject_headers.js');
      console.log('[自愈守护] 正在检查并尝试拉起 3200 端口 QQ 音乐底层 API 服务 (带 IP 拦截器), 路径:', apiPath);
      const child = spawn('node', ['-r', injectScriptPath, apiPath], {
        stdio: 'inherit',
        detached: false
      });
      child.on('error', (err) => {
        console.error('[自愈守护] 自动启动 QQ 音乐 API 子进程失败:', err);
      });
      process.on('exit', () => {
        child.kill();
      });
    } catch (spawnErr) {
      console.error('[自愈守护] 尝试自启 3200 子进程发生异常:', spawnErr);
    }

    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    console.log('MuseSync Backend is running on http://localhost:8080');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
