// @ts-ignore
import ncmApi from 'NeteaseCloudMusicApi';
// @ts-ignore
import qqMusic from 'qq-music-api';

const ncm = ncmApi as any;

/**
 * Score how well a candidate track matches the target title and artist.
 * Returns a score from 0 to 100. Higher is better.
 */
function scoreTrackMatch(targetTitle: string, targetArtist: string, candidate: any): number {
  let score = 100;
  const candidateTitle = (candidate.songname || candidate.name || '').toLowerCase();
  
  // Try to parse candidate artist from various possible structures
  let candidateArtist = '';
  if (Array.isArray(candidate.singer)) {
    candidateArtist = candidate.singer.map((a: any) => a.name).join(', ').toLowerCase();
  } else if (Array.isArray(candidate.ar)) {
    candidateArtist = candidate.ar.map((a: any) => a.name).join(', ').toLowerCase();
  } else if (typeof candidate.singer === 'string') {
    candidateArtist = candidate.singer.toLowerCase();
  }

  const targetTitleLower = targetTitle.toLowerCase();
  const targetArtistLower = targetArtist.toLowerCase();

  // Handle aliases and subtitles like "(Live版)" or " - Live"
  const cleanTitle = (t: string) => t.replace(/(\(|（).*?(\)|）)/g, '').replace(/-.*/g, '').trim();
  const cClean = cleanTitle(candidateTitle);
  const tClean = cleanTitle(targetTitleLower);

  // Strict check on title containing target title (or vice versa)
  if (!cClean.includes(tClean) && !tClean.includes(cClean)) {
    score -= 50;
  }
  
  // Exact title match is rewarded
  if (candidateTitle === targetTitleLower) {
    score += 10;
  }

  // Strict check on artist
  if (candidateArtist && targetArtistLower && !candidateArtist.includes(targetArtistLower) && !targetArtistLower.includes(candidateArtist)) {
    score -= 30;
  }

  // Penalize bad versions if the original didn't explicitly ask for them
  const badKeywords = ['live', '现场', '伴奏', 'cover', '翻唱', 'remix', 'dj'];
  for (const kw of badKeywords) {
    const originalHasKw = targetTitleLower.includes(kw) || targetArtistLower.includes(kw);
    const candidateHasKw = candidateTitle.includes(kw) || candidateArtist.includes(kw);
    if (!originalHasKw && candidateHasKw) {
      score -= 40; // Penalize heavily if candidate is a live/cover version but original isn't
    }
  }

  return Math.max(0, score);
}

import axios from 'axios';

async function requestQQ(path: string, cookie: string) {
  try {
    const url = new URL(path, 'http://localhost');
    const pathname = url.pathname;
    
    // 把老代码逻辑转成对应的 3200 端口 http 接口请求
    // 假设 3200 是刚才 index.ts 起的服务端口
    let targetUrl = `http://127.0.0.1:3200${pathname}${url.search}`;
    
    // 如果是旧的路径，做一下映射
    if (pathname.includes('getSearchByKey')) {
      targetUrl = `http://127.0.0.1:3200/search${url.search}`;
    } else if (pathname.includes('getMusicPlay')) {
      targetUrl = `http://127.0.0.1:3200/song/urls${url.search}&id=${url.searchParams.get('songmid')}`;
    } else if (pathname.includes('getLyric')) {
      targetUrl = `http://127.0.0.1:3200/lyric?id=${url.searchParams.get('songmid')}`;
    } else if (pathname.includes('getSongInfo')) {
      targetUrl = `http://127.0.0.1:3200/song?id=${url.searchParams.get('songmid')}`;
    }
    
    const headers: Record<string, string> = {};
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    
    const res = await axios.get(targetUrl, { headers, timeout: 5000 });
    return res.data;
  } catch (err: any) {
    console.error(`[requestQQ API error] path=${path}:`, err.message);
    throw err;
  }
}

export const musicService = {
  qqCookie: '',

  setQQCookie(cookie: string) {
    this.qqCookie = cookie;
  },

  async resolveNeteaseWithFallback(id: string, providedTitle?: string, providedArtist?: string): Promise<{ audioUrl: string, lyrics: string, isFallback: boolean }> {
    console.log(`\n=================== 🎵 [互补引擎] 开始处理网易云单曲: ${id} ===================`);
    
    // 提前并行发起获取歌词和歌曲详情的请求，最大化并发网络速度并提供时长对比依据
    const lyricPromise = ncm.lyric({ id }).catch((e: any) => {
      console.error("[互补引擎] 网易云歌词获取失败:", e);
      return { body: { lrc: { lyric: '' } } };
    });
    const detailPromise = ncm.song_detail({ ids: id }).catch((e: any) => {
      console.error("[互补引擎] 网易云详情获取失败:", e);
      return { body: { songs: [] } };
    });

    // 1. 获取播放链接
    const urlRes = await ncm.song_url_v1({ id, level: 'exhigh' });
    const urlData = urlRes.body?.data?.[0];
    let audioUrl = urlData?.url || '';

    // 2. 等待详情返回，进行极其严密的时长对比试听检测
    const detailRes = await detailPromise;
    const songData = detailRes.body?.songs?.[0];

    const fee = urlData?.fee ?? 0;
    const duration = songData ? (songData.dt / 1000) : 0;
    const actualDuration = urlData ? (urlData.time / 1000) : 0;

    // 极其智能的保底检测：若链接实际时长（如30秒）明显少于歌曲在详情里的总时长（相差10秒以上），则判定绝对属于受限试听版
    const isShortAudio = actualDuration > 0 && duration > 0 && actualDuration < duration - 10;
    let isLimited = !audioUrl || !!(urlData?.freeTrialInfo) || (fee > 0 && fee !== 8) || isShortAudio;
    let isFallback = false;

    console.log(`[互补引擎] 网易音轨自审状态:
      - 原始链接: ${audioUrl ? '有' : '无'}
      - 官方总时长: ${duration.toFixed(1)} 秒
      - 音轨实际时长: ${actualDuration.toFixed(1)} 秒
      - 判定为试听阉割版: ${isShortAudio ? '【是 (时长异常截断)】' : '否'}
      - fee 付费标识: ${fee}
      - 互补触发状态: ${isLimited ? '【🔥 启动跨端超级会员互补】' : '直接播放原始音源'}`);

    // 互补机制：如果是受限音乐，向 QQ 音乐发送跨端检索
    if (isLimited) {
      const title = songData?.name || providedTitle;
      const artist = (songData?.ar?.[0]?.name) || providedArtist || '';
      
      if (title) {
        const keyword = `${title} ${artist}`.trim();
        
        console.log(`[互补引擎] 正在向 QQ 音乐发送检索请求, 检索词: "${keyword}"`);
        
        try {
          const fallbackPromise = (async () => {
            const qqSearch = await requestQQ(`/getSearchByKey?key=${encodeURIComponent(keyword)}`, musicService.qqCookie);
            const qqList = qqSearch.response?.data?.song?.list || qqSearch.data?.song?.list || qqSearch.data?.list || qqSearch.list || qqSearch.data || [];
            
            console.log(`[互补引擎] QQ 音乐搜索返回候选列表数: ${qqList.length}`);
            
            if (qqList.length > 0) {
              // Find best match based on scoring
              let bestSong = null;
              let highestScore = -1;
              
              for (const song of qqList) {
                const score = scoreTrackMatch(title, artist, song);
                if (score > highestScore) {
                  highestScore = score;
                  bestSong = song;
                }
              }
              
              console.log(`[互补引擎] 评分完成. 最高匹配分值: ${highestScore}, 目标 Mid: ${bestSong?.songmid || '无'}`);
              
              // Only accept if score is reasonable (e.g., > 50)
              if (bestSong && highestScore > 50) {
                const qqMid = bestSong.songmid || bestSong.mid || bestSong.id;
                
                // 100% 达成“音质尽量高”：按无损 FLAC -> 320k -> 128k -> m4a 顺序降级探测，最后进行不带 type 的自适应保底
                console.log(`[互补引擎] 正在使用 SVIP Cookie 穿透获取 QQ 播放音轨, Mid: ${qqMid}`);
                const qualityTypes = ['flac', '320', '128', 'm4a'];
                let fallbackUrl = '';
                
                for (const q of qualityTypes) {
                  console.log(`[互补引擎] 尝试申请高音质: ${q}`);
                  const qqUrlRes = await requestQQ(`/getMusicPlay?songmid=${qqMid}&type=${q}`, musicService.qqCookie).catch(() => ({}));
                  const playUrlObj = qqUrlRes?.response?.playUrl?.[qqMid] || qqUrlRes?.data?.playUrl?.[qqMid] || {};
                  if (playUrlObj.url) {
                    fallbackUrl = playUrlObj.url;
                    console.log(`[互补引擎] 成功索取到高音质音轨! 实际音质: ${q}`);
                    break;
                  }
                }
                
                // 极致保底自适应
                if (!fallbackUrl) {
                  console.log(`[互补引擎] 高音质均不可用，发起默认自适应请求...`);
                  const qqUrlRes = await requestQQ(`/getMusicPlay?songmid=${qqMid}`, musicService.qqCookie).catch(() => ({}));
                  const playUrlObj = qqUrlRes?.response?.playUrl?.[qqMid] || qqUrlRes?.data?.playUrl?.[qqMid] || {};
                  fallbackUrl = playUrlObj.url || '';
                  if (fallbackUrl) {
                    console.log(`[互补引擎] 成功索取到默认自适应音轨!`);
                  }
                }
                
                if (fallbackUrl) {
                  return fallbackUrl;
                }
              }
            }
            return '';
          })();

          // 超时熔断机制，最长等待 5 秒
          let timeoutId: NodeJS.Timeout;
          const timeoutPromise = new Promise<string>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('QQ Fallback Timeout')), 5000);
          });
          // 防止解脱的 Promise 触发 UnhandledRejection
          timeoutPromise.catch(() => {});

          const fallbackUrl = await Promise.race([fallbackPromise, timeoutPromise]);
          clearTimeout(timeoutId!);

          if (fallbackUrl) {
            audioUrl = fallbackUrl;
            isFallback = true;
            console.log(`[互补引擎] 恭喜! 网易云受限歌曲已被 QQ 音乐无损音轨成功替换。`);
          } else {
            console.log(`[互补引擎] 互补替换未成功, 回退至网易云原始试听链接。`);
          }
        } catch (err) {
          console.error("[互补引擎] QQ 互补替换发生严重异常:", err);
        }
      }
    }

    // 3. 等待刚才并行的歌词请求返回
    const lyricRes = await lyricPromise;
    const lyrics = lyricRes.body?.lrc?.lyric || '';

    console.log(`=================== 🎵 [互补引擎] 网易云处理结束 ===================\n`);
    return { audioUrl, lyrics, isFallback };
  },

  async resolveQQWithFallback(id: string, providedTitle?: string, providedArtist?: string): Promise<{ audioUrl: string, lyrics: string, isFallback: boolean }> {
    console.log(`\n=================== 🎵 [互补引擎] 开始处理 QQ 音乐单曲: ${id} ===================`);
    
    // 提前并行发起获取歌词请求
    const lyricPromise = requestQQ(`/getLyric?songmid=${id}`, musicService.qqCookie).catch((e: any) => {
      console.error("[互补引擎] QQ 歌词获取失败:", e);
      return { response: { lyric: '' } };
    });

    // 1. 获取 QQ 播放链接 (同样引入无损 FLAC -> 320k 降级探测与自适应保底)
    console.log(`[互补引擎] 正在使用 SVIP Cookie 穿透获取 QQ 本地高音质音轨, Mid: ${id}`);
    const qualityTypes = ['flac', '320', '128', 'm4a'];
    let audioUrl = '';
    
    for (const q of qualityTypes) {
      console.log(`[互补引擎] 尝试申请高音质: ${q}`);
      const qqUrlRes = await requestQQ(`/getMusicPlay?songmid=${id}&type=${q}`, musicService.qqCookie).catch(() => ({}));
      const playUrlObj = qqUrlRes?.response?.playUrl?.[id] || qqUrlRes?.data?.playUrl?.[id] || {};
      if (playUrlObj.url) {
        audioUrl = playUrlObj.url;
        console.log(`[互补引擎] 成功索取到本地高音质音轨! 实际音质: ${q}`);
        break;
      }
    }
    
    if (!audioUrl) {
      console.log(`[互补引擎] 高音质均不可用，发起默认自适应请求...`);
      const qqUrlRes = await requestQQ(`/getMusicPlay?songmid=${id}`, musicService.qqCookie).catch(() => ({}));
      const playUrlObj = qqUrlRes?.response?.playUrl?.[id] || qqUrlRes?.data?.playUrl?.[id] || {};
      audioUrl = playUrlObj.url || '';
      if (audioUrl) {
        console.log(`[互补引擎] 成功索取到默认自适应音轨!`);
      }
    }

    let isFallback = false;
    let targetLyrics = '';

    console.log(`[互补引擎] QQ 原始音轨状态: - 链接: ${audioUrl ? '有' : '无 (需要版权或更高会员权限)'}`);

    // 如果获取不到 URL，向网易云进行跨端检索
    if (!audioUrl) {
      console.log(`[互补引擎] 检测到 QQ 音轨缺失，启动跨端检索网易云音乐...`);
      try {
        let title = providedTitle;
        let artist = providedArtist;
        
        if (!title) {
          const detailRes = await requestQQ(`/getSongInfo?songmid=${id}`, musicService.qqCookie).catch(() => ({}));
          const songData = detailRes?.response?.data?.[0] || detailRes?.data?.[0];
          if (songData) {
            title = songData.songname || songData.name;
            artist = songData.singer?.map((s: any) => s.name).join(', ') || '';
          }
        }

        if (title) {
          const keyword = `${title} ${artist}`.trim();

          console.log(`[互补引擎] 网易云搜索检索词: "${keyword}"`);
          const ncmSearch = await ncm.cloudsearch({ keywords: keyword, limit: 10 }).catch(() => ({ body: { result: { songs: [] } } }));
          const ncmList = ncmSearch.body?.result?.songs || [];

          console.log(`[互补引擎] 网易云检索返回候选列表数: ${ncmList.length}`);

          if (ncmList.length > 0) {
            let bestSong = null;
            let highestScore = -1;

            for (const song of ncmList) {
              const score = scoreTrackMatch(title, artist || '', song);
              if (score > highestScore) {
                highestScore = score;
                bestSong = song;
              }
            }

            console.log(`[互补引擎] 匹配完成. 最高匹配分值: ${highestScore}, 目标ID: ${bestSong?.id || '无'}`);

            if (bestSong && highestScore > 50) {
              const ncmId = String(bestSong.id);
              const urlResN = await ncm.song_url_v1({ id: ncmId, level: 'exhigh' }).catch(() => ({ body: { data: [] } }));
              const urlDataN = urlResN.body?.data?.[0];
              const fbAudioUrl = urlDataN?.url || '';

              if (fbAudioUrl) {
                audioUrl = fbAudioUrl;
                isFallback = true;
                console.log(`[互补引擎] 恭喜! QQ 缺失歌曲已被网易云高品质音轨成功替换。`);

                // 拉取网易云歌词作为 Fallback 歌词
                const ncmLrc = await ncm.lyric({ id: ncmId }).catch(() => ({ body: { lrc: { lyric: '' } } }));
                targetLyrics = ncmLrc.body?.lrc?.lyric || '';
                return { audioUrl, lyrics: targetLyrics, isFallback };
              }
            }
          }
        }
      } catch (err) {
        console.error("[互补引擎] 网易云互补替换发生严重异常:", err);
      }
    }

    const lyricRes = await lyricPromise;
    targetLyrics = lyricRes?.response?.lyric || lyricRes?.data?.lyric || '';

    console.log(`=================== 🎵 [互补引擎] QQ 处理结束 ===================\n`);
    return { audioUrl, lyrics: targetLyrics, isFallback };
  }
};
