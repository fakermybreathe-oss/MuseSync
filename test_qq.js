const qqMusic = require('qq-music-api');

qqMusic.setCookie('your-cookie-here'); // 忽略，只测试普通歌曲

async function test() {
  try {
    console.log("Searching for 晴天...");
    const qqSearch = await qqMusic.api('search', { key: '晴天 周杰伦' });
    const qqList = qqSearch.data?.list || [];
    
    if (qqList.length > 0) {
      const song = qqList[0];
      console.log(`Found: ${song.songname} by ${song.singer[0].name}, id: ${song.songmid}`);
      
      const types = ['320', '128', 'm4a', 'flac'];
      for (const t of types) {
        console.log(`Trying type ${t}...`);
        const urlRes = await qqMusic.api('song/url', { id: song.songmid, type: t }).catch(e => {
            console.log("Error:", e);
            return { data: {} };
        });
        console.log(`Response for ${t}:`, urlRes.data);
      }
    } else {
      console.log("No search results.");
    }
  } catch (err) {
    console.error(err);
  }
}

test();
