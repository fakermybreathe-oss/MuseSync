const axios = require('axios');

async function run() {
  const favoriteId = '1128669790';
  const baseUrl = 'http://127.0.0.1:3200';
  
  try {
    console.log(`[TEST] 尝试获取“我喜欢”歌单 (${favoriteId}) 的歌曲列表...`);
    const res = await axios.get(`${baseUrl}/getSongListDetail?disstid=${favoriteId}`, { timeout: 5000 });
    console.log(`[TEST] 歌单详情接口响应状态:`, res.status);
    const cdlist = res.data?.response?.cdlist || res.data?.data?.cdlist;
    const songlist = cdlist?.[0]?.songlist || [];
    console.log(`[TEST] 成功解析歌曲数量:`, songlist.length);
    if (songlist.length > 0) {
      console.log(`[TEST] 歌曲全部 Keys:`, Object.keys(songlist[0]));
      console.log(`[TEST] 第一首歌曲信息:`, {
        songmid: songlist[0].songmid || songlist[0].mid,
        songname: songlist[0].songname || songlist[0].name,
        albumname: songlist[0].albumname || songlist[0].album?.name,
        albummid: songlist[0].albummid || songlist[0].album?.mid,
        singer: songlist[0].singer,
        interval: songlist[0].interval || songlist[0].time
      });
    }
  } catch (err) {
    console.error(`[TEST] 获取“我喜欢”歌单失败:`, err.message);
  }
}

run();
