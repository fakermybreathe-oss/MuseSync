const qqMusic = require('qq-music-api');

async function testQQ() {
  const id = '004HA6ys0J8rGF';
  console.log(`正在请求 QQ 音乐歌曲 ${id}...`);
  
  const types = ['320', '128', 'm4a', 'flac', 'ape'];
  for (const t of types) {
    try {
      const urlRes = await qqMusic.api('song/url', { id, type: t });
      console.log(`[Type ${t}] response data:`, urlRes.data);
    } catch (e) {
      console.log(`[Type ${t}] error:`, e.message);
    }
  }
}

testQQ();
