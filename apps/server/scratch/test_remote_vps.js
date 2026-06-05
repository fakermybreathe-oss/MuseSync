const axios = require('axios');

async function check() {
  const url = 'https://hanxue-api.windy.indevs.in/api/qq/search?keyword=' + encodeURIComponent('晴天');
  console.log(`[TEST] 正在请求远程 VPS 接口: ${url}`);
  try {
    const res = await axios.get(url, { timeout: 15000 });
    console.log(`[TEST] 远程响应成功！状态码:`, res.status);
    console.log(`[TEST] 搜索数据:`, JSON.stringify(res.data).slice(0, 1000));
  } catch (err) {
    console.error(`[TEST] 远程连接失败:`, err.message);
    if (err.response) {
      console.error(`[TEST] 错误状态码:`, err.response.status);
      console.error(`[TEST] 错误响应体:`, JSON.stringify(err.response.data));
    }
  }
}

check();
