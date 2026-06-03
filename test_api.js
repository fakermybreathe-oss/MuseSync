const http = require('http');

async function testApi() {
  console.log("1. 搜索网易云歌曲 'I NEED YOU'...");
  const searchRes = await fetch('http://localhost:8080/api/netease/search?keyword=I%20NEED%20YOU');
  const searchData = await searchRes.json();
  
  if (!searchData || searchData.length === 0) {
     console.log("未找到歌曲");
     return;
  }
  
  const song = searchData[0];
  console.log(`2. 找到歌曲: ${song.title} by ${song.artist}, ID: ${song.id}`);
  
  console.log(`3. 请求歌曲详情与回退 URL...`);
  const songRes = await fetch(`http://localhost:8080/api/netease/song/${song.id}`);
  const songData = await songRes.json();
  
  console.log("4. 后端返回的数据为:");
  console.log(JSON.stringify(songData, null, 2));

  if (songData.audioUrl) {
      console.log(`5. 尝试请求代理链接: http://localhost:8080/proxy/audio?url=${encodeURIComponent(songData.audioUrl)}`);
      http.get(`http://localhost:8080/proxy/audio?url=${encodeURIComponent(songData.audioUrl)}`, (res) => {
          console.log(`代理层状态码: ${res.statusCode}`);
          console.log(`代理层 Headers:`, res.headers);
      }).on('error', (e) => {
          console.error("代理请求错误:", e.message);
      });
  } else {
      console.log("警告: 返回的 audioUrl 为空！");
  }
}

testApi();
