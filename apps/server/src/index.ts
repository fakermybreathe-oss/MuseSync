import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import https from 'https';
import http from 'http';
import { Member, RoomState, Track } from '@musesync/shared';
// @ts-ignore
import ncmApi from 'NeteaseCloudMusicApi';
// @ts-ignore
import qqMusic from 'qq-music-api';
import { musicService } from './services/musicService';

// 全局未捕获异常防御拦截，防止进程退出崩溃
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [全局拦截] 未处理的 Promise 拒绝 (Unhandled Rejection) at:', promise, '原因:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ [全局拦截] 未捕获的致命异常 (Uncaught Exception) 抛出:', err);
});

const ncm = ncmApi as any;
let globalQQCookie = '';

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
  }>;
  track: Track | null;
  position: number;
  isPlaying: boolean;
  lastSyncAt: number;
  playlist: Track[];
  playMode: 'loop' | 'single' | 'random';
  neteaseAuth?: PlatformAuth;
  qqAuth?: PlatformAuth;
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
const getOrCreateRoom = (roomId: string, password?: string): ExtendedRoomState => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      password,
      hostId: '',
      members: [],
      track: null,
      position: 0,
      isPlaying: false,
      lastSyncAt: Date.now(),
      playlist: [],
      playMode: 'loop'
    });
  }
  const r = rooms.get(roomId)!;
  // 若新传入了密码且房间原无密码，予以设置
  if (password && !r.password) {
    r.password = password;
  }
  return r;
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
    delete proxyRes.headers['content-encoding'];
    delete proxyRes.headers['transfer-encoding'];
    reply.headers(proxyRes.headers);
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
    const res = await ncm.cloudsearch({ keywords: keyword, limit: 30 });
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
    const plRes = await ncm.user_playlist({ uid, cookie });
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
    const tracksRes = await ncm.playlist_track_all({ id, limit: 100, cookie });
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

fastify.get('/api/netease/song/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const result = await musicService.resolveNeteaseWithFallback(id);
    return reply.send(result);
  } catch (e) {
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
    console.log("[QQ Cookie Saved]");
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
    return reply.code(500).send({ error: 'Failed to fetch QQ user detail' });
  }
});

fastify.get('/api/qq/playlist/detail', async (request, reply) => {
  const { id } = request.query as { id: string };
  try {
    const res = await qqMusic.api('songlist', { id });
    let list = res?.songlist || [];
    if (!Array.isArray(list)) list = [];
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
        artist: s.singer?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: s.albumname || s.album?.name || 'Unknown Album',
        coverUrl: rawCover,
        duration: (s.interval || s.time || 0) * 1000,
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
    const res = await qqMusic.api('search', { key: keyword });
    let list = res?.response?.data?.song?.list || res?.data?.song?.list || res?.data?.list || res?.list || res?.data || [];
    if (!Array.isArray(list)) list = [];
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
        artist: s.singer?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: s.albumname || s.album?.name || 'Unknown Album',
        coverUrl: rawCover,
        duration: (s.interval || s.time || 0) * 1000,
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
    
    // 直接走官方原始接口，不通过库，防止它擅自把结构吞掉报错
    const url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?hostuin=${uid}&sin=0&size=100`;
    const res = await fetch(url, {
      headers: {
        'Cookie': globalQQCookie || '',
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const text = await res.text();
    const match = text.match(/\{.*\}/);
    let list = [];
    if (match) {
      const json = JSON.parse(match[0]);
      list = json.data?.disslist || [];
    }
    
    const folders = list.map((p: any) => {
      let rawCover = p.diss_cover || p.logo || '';
      if (rawCover.startsWith('//')) {
        rawCover = `https:${rawCover}`;
      }
      return {
        id: String(p.tid || p.dissid || p.id),
        name: p.diss_name || p.title || '未知歌单',
        coverUrl: rawCover,
        trackCount: p.song_cnt || 0,
        platform: 'qq'
      };
    });
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
    const folderRes = await qqMusic.api('songlist', { id });
    const songlist = folderRes?.songlist || [];
    
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
        duration: (s.interval || s.time || 0) * 1000,
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

fastify.get('/api/qq/song/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const result = await musicService.resolveQQWithFallback(id);
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

    // 1. 用户加入房间事件
    socket.on('join:room', (data: { roomId: string; password?: string; user: { nickname: string; avatar: string } }) => {
      const { roomId, password, user } = data;
      const room = getOrCreateRoom(roomId, password);

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
          oldRoom.members = oldRoom.members.filter(m => m.id !== socket.id);
          io.to(currentRoomId).emit('sync:members', oldRoom.members);
        }
      }

      currentRoomId = roomId;
      socket.join(roomId);

      // 将自己注册入房间列表
      const isHost = room.members.length === 0;
      if (isHost) room.hostId = socket.id;

      room.members.push({
        id: socket.id,
        nickname: user.nickname || `听友_${socket.id.slice(0, 4)}`,
        avatar: user.avatar || 'https://y.gtimg.cn/mediastyle/global/img/album_300.png',
        rtt: 0,
        joinedAt: Date.now(),
        isHost
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
          qqAuth: room.qqAuth
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
        }
      }

      // 广播给房间内的其他人（手机端），共享该平台鉴权
      socket.to(roomId).emit('sync:auth', { platform: data.platform, auth: data.auth });
    });

    // 6.5. 主动退出房间事件
    socket.on('leave:room', () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.members = room.members.filter(m => m.id !== socket.id);
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
          room.members = room.members.filter(m => m.id !== socket.id);
          io.to(currentRoomId).emit('sync:members', room.members);
        }
      }
    });
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    console.log('MuseSync Backend is running on http://localhost:8080');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
