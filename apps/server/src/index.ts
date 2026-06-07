import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import https from 'https';
import http from 'http';
import { Member, RoomState, Track } from '@musesync/shared';
import { spawn } from 'child_process';
import path from 'path';
// @ts-ignore
import ncmApi from 'NeteaseCloudMusicApi';
// @ts-ignore
import qqMusic from 'qq-music-api';
import { musicService } from './services/musicService';
import { upsertPublicRoom, deactivatePublicRoom } from './services/supabaseService';
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

// 获取或初始化房间，默认免密
const getOrCreateRoom = (roomId: string, password?: string, isPublic?: boolean): ExtendedRoomState => {
  if (!rooms.has(roomId)) {
    const security = resolveRoomCreationSettings(undefined, password, isPublic);
    rooms.set(roomId, {
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
    });
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
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    // 强制指示 Nginx 禁用代理缓冲，实现零延迟音频流式直吐，消除 1Panel/OpenResty 的缓冲加载堵塞
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
  const { keyword } = request.query as { keyword: string };
  try {
    const res = await ncm.cloudsearch({ keywords: keyword, limit: 30, realIP: CHINA_IP });
    const songs = res.body.result.songs || [];
    const tracks: Track[] = songs.map((s: any) => ({
      id: String(s.id),
      title: s.name,
      artist: s.ar?.map((a: any) => a.name).join(', ') || s.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
      album: s.al?.name || s.album?.name || 'Unknown',
      coverUrl: s.al?.picUrl || s.album?.picUrl || 'https://via.placeholder.com/200',
      duration: (s.dt || s.duration || 0) / 1000,
      platform: 'netease',
      audioUrl: '' // 将在点击播放时获取
    }));
    return reply.send(tracks);
  } catch (e) {
    return reply.code(500).send({ error: 'Netease Search failed' });
  }
});

fastify.post('/api/netease/user/playlist', async (request, reply) => {
  const { uid, cookie } = request.body as { uid: string, cookie?: string };
  if (!uid) return reply.send([]);
  try {
    const plRes = await ncm.user_playlist({ uid, cookie, realIP: CHINA_IP });
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
  const { id, cookie } = request.body as { id: string, cookie?: string };
  if (!id) return reply.send([]);
  try {
    const tracksRes = await ncm.playlist_track_all({ id, limit: 100, cookie, realIP: CHINA_IP });
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
  const { title, artist, cookie } = request.body as any;
  try {
    const result = await musicService.resolveNeteaseWithFallback(id, title, artist, cookie);
    return reply.send(result);
  } catch (e) {
    console.error("Netease API Failed:", e);
    return reply.code(500).send({ error: 'Netease Song URL failed' });
  }
});

// 网易云二维码登录路由
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
  const { cookie } = request.body as { cookie: string };
  try {
    globalQQCookie = cookie;
    qqMusic.setCookie(cookie);
    musicService.setQQCookie(cookie); // 同时同步到互补模块，实现 SVIP 会员身份穿透！
    
    // 强行同步到本地 3200 端口服务的全局内存中，确保代理端获取音乐 vkey 100% 携带 SVIP 权限
    fetch(`http://127.0.0.1:3200/user/setCookie?cookie=${encodeURIComponent(cookie)}`).catch(err => {
      console.error('[Sync Cookie to 3200 Error]', err);
    });

    console.log("[QQ Cookie Saved & Synced to 3200]");
    return reply.send({ success: true });
  } catch (e) {
    return reply.send({ success: false, message: 'Invalid Cookie' });
  }
});

fastify.post('/api/qq/user/detail', async (request, reply) => {
  const { id } = request.body as { id: string };
  try {
    const res = await qqMusic.api('user/detail', { id });
    console.log('[QQ User Detail] res:', JSON.stringify(res).slice(0, 300));
    return reply.send(res);
  } catch (e) {
    console.error('[QQ User Detail Error]', e);
    // 强力保底：即使请求官方接口失败（如 VPS 机房 IP 被屏蔽），也返回默认的合法结构，杜绝前端登录卡死
    return reply.send({
      creator: {
        nick: `QQ用户_${id.slice(0, 4)}`,
        headpic: 'https://y.gtimg.cn/mediastyle/global/img/album_300.png'
      }
    });
  }
});

fastify.get('/api/qq/playlist/detail', async (request, reply) => {
  const { id } = request.query as { id: string };
  try {
    const url = `http://127.0.0.1:3200/getSongListDetail?disstid=${id}`;
    const res = await fetch(url, {
      headers: {
        'Cookie': globalQQCookie || '',
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const json = await res.json();
    const cdlist = json?.response?.cdlist || json?.data?.cdlist;
    const songlist = cdlist?.[0]?.songlist || [];

    const tracks: Track[] = songlist.map((s: any) => {
      const songid = s.songmid || s.mid || s.id;
      const albummid = s.albummid || s.album?.mid;
      let rawCover = albummid 
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` 
        : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png';
      
      if (rawCover.startsWith('//')) {
        rawCover = `https:${rawCover}`;
      }

      return {
        id: String(songid),
        title: s.songname || s.name || s.title || 'Unknown Title',
        artist: s.singer?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: s.albumname || s.album?.name || 'Unknown Album',
        coverUrl: rawCover,
        duration: s.interval || s.time || 0,
        platform: 'qq',
        audioUrl: ''
      };
    });
    return reply.send(tracks);
  } catch (e) {
    console.error('[QQ Playlist Detail Error]', e);
    return reply.code(500).send({ error: 'QQ Playlist detail failed' });
  }
});

fastify.get('/api/qq/search', async (request, reply) => {
  const { keyword } = request.query as { keyword: string };
  try {
    // 使用带 Headers 伪装和 Cookie 携带的本地 3200 中转代理，彻底规避 VPS 机房 IP 直接抓取 QQ 官方接口被屏蔽的问题
    const url = `http://127.0.0.1:3200/getSearchByKey?key=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: {
        'Cookie': globalQQCookie || '',
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0'
      }
    });
    const json = await res.json();
    let list = json?.response?.data?.song?.list || json?.data?.song?.list || json?.data?.list || json?.list || json?.data || [];
    if (!Array.isArray(list)) list = [];

    // ============ 自愈第一步：若 QQ 搜索受风控返回 []，则使用极不易被拦截的 Smartbox 联想，并并发补全详情 (封面、时长) ============
    if (list.length === 0) {
      console.log(`[QQ 搜索自愈] 官方搜索未返回结果，正在尝试使用 Smartbox + 详情并发补全获取 QQ 本地歌曲...`);
      try {
        const sbUrl = `http://127.0.0.1:3200/getSmartbox?key=${encodeURIComponent(keyword)}`;
        const sbRes = await fetch(sbUrl, {
          headers: {
            'Cookie': globalQQCookie || '',
            'Referer': 'https://y.qq.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0'
          }
        });
        const sbJson = await sbRes.json();
        const sbData = sbJson?.response?.data || sbJson?.data || {};
        const sbSongs = sbData?.song?.itemlist || [];
        if (Array.isArray(sbSongs) && sbSongs.length > 0) {
          // 并发请求每一首联想歌曲的完整详情，补全封面与时长
          const detailPromises = sbSongs.map(async (s: any) => {
            const mid = s.mid || s.id;
            try {
              const detailUrl = `http://127.0.0.1:3200/getSongInfo?songmid=${mid}`;
              const dRes = await fetch(detailUrl, {
                headers: {
                  'Cookie': globalQQCookie || '',
                  'Referer': 'https://y.qq.com/',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0'
                }
              });
              const dJson = await dRes.json();
              const songData = dJson?.response?.data?.[0] || dJson?.data?.[0] || dJson?.response?.data || dJson?.data || {};
              return {
                songmid: mid,
                songname: s.name || songData.songname || songData.name,
                singer: s.singer || (Array.isArray(songData.singer) ? songData.singer : []),
                albumname: songData.albumname || songData.album?.name || '',
                albummid: songData.albummid || songData.album?.mid || '',
                interval: songData.interval || songData.time || 0
              };
            } catch (err) {
              return {
                songmid: mid,
                songname: s.name,
                singer: s.singer,
                albumname: '',
                albummid: '',
                interval: 0
              };
            }
          });
          list = await Promise.all(detailPromises);
          console.log(`[QQ 搜索自愈] 联想详情并发补全成功，获取到 ${list.length} 首 QQ 音乐独立歌曲！`);
        }
      } catch (sbErr: any) {
        console.error(`[QQ 搜索自愈] Smartbox 联想补全失败:`, sbErr.message);
      }
    }


    const tracks: Track[] = list.map((s: any) => {
      const songid = s.songmid || s.mid || s.id;
      const albummid = s.albummid || s.album?.mid;
      let rawCover = albummid 
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` 
        : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png';
      
      if (rawCover.startsWith('//')) {
        rawCover = `https:${rawCover}`;
      }

      return {
        id: String(songid),
        title: s.songname || s.name || s.title || 'Unknown Title',
        artist: Array.isArray(s.singer) 
          ? s.singer.map((a: any) => a.name).join(', ') 
          : (typeof s.singer === 'string' ? s.singer : 'Unknown Artist'),
        album: s.albumname || s.album?.name || 'Unknown Album',
        coverUrl: rawCover,
        duration: s.interval || s.time || 0,
        platform: 'qq',
        audioUrl: '' // 将在点击播放时获取
      };
    });
    return reply.send(tracks);
  } catch (e) {
    console.error('[QQ Search Error]', e);
    return reply.code(500).send({ error: 'QQ Search failed' });
  }
});

fastify.post('/api/qq/user/playlist', async (request, reply) => {
  const { uid, cookie } = request.body as { uid: string, cookie?: string };
  console.log(`[QQ Playlist] Requesting for uid: ${uid}`);
  try {
    if (cookie) globalQQCookie = cookie;
    
    // 请求个人主页接口以包含自建歌单和“我喜欢”红心歌单
    const url = `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&reqfrom=1&reqtype=0&hostUin=0&uin=${uid}&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
    const res = await fetch(url, {
      headers: {
        'Cookie': globalQQCookie || '',
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const json = await res.json();
    console.log('[DEBUG HOMEPAGE KEYS]:', Object.keys(json), 'data keys:', json.data ? Object.keys(json.data) : 'no data');
    if (json.data) {
      console.log('[DEBUG mymusic]:', JSON.stringify(json.data.mymusic));
      console.log('[DEBUG mydiss list length]:', json.data.mydiss?.list?.length);
      if (json.data.mydiss?.list) {
        console.log('[DEBUG mydiss sample]:', JSON.stringify(json.data.mydiss.list[0]));
      }
    }
    
    // 拼接“我喜欢”红心歌单与自建歌单
    let folders: any[] = [];

    if (json.data?.mymusic && json.data.mymusic.length > 0) {
      const myFavorite = json.data.mymusic[0];
      let rawCover = myFavorite.picurl || myFavorite.logo || '';
      if (rawCover.startsWith('//')) {
        rawCover = `https:${rawCover}`;
      }
      folders.push({
        id: String(myFavorite.id),
        name: myFavorite.title || '我喜欢',
        coverUrl: rawCover,
        trackCount: myFavorite.num0 || 0,
        platform: 'qq'
      });
    }

    let list = json.data?.mydiss?.list || [];
    const listFolders = list.map((p: any) => {
      let rawCover = p.picurl || p.diss_cover || p.logo || '';
      if (rawCover.startsWith('//')) {
        rawCover = `https:${rawCover}`;
      }
      
      let trackCount = 0;
      if (p.song_cnt !== undefined) {
        trackCount = p.song_cnt;
      } else if (p.subtitle) {
        const match = p.subtitle.match(/(\d+)首/);
        if (match) {
          trackCount = parseInt(match[1], 10);
        }
      }

      return {
        id: String(p.tid || p.dissid || p.id),
        name: p.diss_name || p.title || '未知歌单',
        coverUrl: rawCover,
        trackCount: trackCount,
        platform: 'qq'
      };
    });

    folders = folders.concat(listFolders);
    return reply.send(folders);
  } catch (e) {
    console.error('[QQ Playlist Error]', e);
    return reply.code(500).send({ error: 'QQ User Playlist failed' });
  }
});

fastify.post('/api/qq/playlist/tracks', async (request, reply) => {
  const { id, cookie } = request.body as { id: string, cookie?: string };
  try {
    if (cookie) {
      globalQQCookie = cookie;
      qqMusic.setCookie(cookie);
    }
    const url = `http://127.0.0.1:3200/getSongListDetail?disstid=${id}`;
    const res = await fetch(url, {
      headers: {
        'Cookie': globalQQCookie || '',
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const json = await res.json();
    const cdlist = json?.response?.cdlist || json?.data?.cdlist;
    const songlist = cdlist?.[0]?.songlist || [];

    const tracks: Track[] = songlist.map((s: any) => {
      const songid = s.songmid || s.mid || s.id;
      const albummid = s.albummid || s.album?.mid;
      let rawCover = albummid 
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` 
        : 'https://y.gtimg.cn/mediastyle/global/img/album_300.png';
      
      if (rawCover.startsWith('//')) {
        rawCover = `https:${rawCover}`;
      }

      return {
        id: String(songid),
        title: s.songname || s.name || s.title || 'Unknown Title',
        artist: s.singer?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: s.albumname || s.album?.name || 'Unknown Album',
        coverUrl: rawCover,
        duration: s.interval || s.time || 0,
        platform: 'qq',
        audioUrl: ''
      };
    });
    return reply.send(tracks);
  } catch (e) {
    console.error('[QQ Playlist Tracks Error]', e);
    return reply.send([]);
  }
});

fastify.post('/api/qq/song/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { title, artist, cookie } = request.body as any;
  try {
    const result = await musicService.resolveQQWithFallback(id, title, artist, cookie);
    return reply.send(result);
  } catch (e) {
    console.error("QQ API Failed:", e);
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
    socket.on('join:room', (data: { roomId: string; password?: string; previousMemberId?: string; isPublic?: boolean; user: { nickname: string; avatar: string } }) => {
      const { roomId, password, previousMemberId, isPublic, user } = data;
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

      socket.emit('join:success', {
        roomId,
        roomState: {
          track: room.track,
          position: catchUpPosition,
          isPlaying: room.isPlaying,
          playlist: room.playlist,
          playMode: room.playMode,
          neteaseAuth: room.neteaseAuth,
          qqAuth: room.qqAuth,
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

    // 6. 全局登录鉴权同步 (共享 SVIP 账号)
    socket.on('sync:auth', (data: { roomId: string; platform: 'netease' | 'qq'; auth: PlatformAuth }) => {
      const roomId = data.roomId || currentRoomId;
      const room = rooms.get(roomId);
      if (!room) return;

      if (data.platform === 'netease') {
        room.neteaseAuth = data.auth;
      } else {
        room.qqAuth = data.auth;
        if (data.auth.cookie) {
          globalQQCookie = data.auth.cookie;
          musicService.setQQCookie(data.auth.cookie);
          // 同时也同步给 3200 端口服务，确保其他端共享登录时鉴权无缝穿透
          fetch(`http://127.0.0.1:3200/user/setCookie?cookie=${encodeURIComponent(data.auth.cookie)}`).catch(err => {
            console.error('[Sync Cookie to 3200 via SyncAuth Error]', err);
          });
        }
      }

      // 广播给房间内的其他人（手机端），共享该平台鉴权
      socket.to(roomId).emit('sync:auth', { platform: data.platform, auth: data.auth });
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
