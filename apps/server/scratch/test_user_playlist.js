const axios = require('axios');

async function test() {
  const uid = '2123613811';
  try {
    console.log(`[TEST] 正在请求用户歌单列表, uid: ${uid}`);
    const res = await axios.post('http://localhost:8080/api/qq/user/playlist', { uid });
    console.log(`[TEST] 接口返回状态:`, res.status);
    const folders = res.data;
    console.log(`[TEST] 获取到的歌单总数:`, folders.length);
    if (folders.length > 0) {
      console.log(`[TEST] 歌单列表前3项详情:`);
      folders.slice(0, 3).forEach((f, i) => {
        console.log(`  第 ${i + 1} 项:`, {
          id: f.id,
          name: f.name,
          coverUrl: f.coverUrl,
          trackCount: f.trackCount,
          platform: f.platform
        });
      });
    }
  } catch (err) {
    console.error(`[TEST] 请求用户歌单列表失败:`, err.message);
  }
}

test();
