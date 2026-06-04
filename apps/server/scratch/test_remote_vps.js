const axios = require('axios');

async function check() {
  const url = 'http://207.57.131.146:8080/api/qq/search?keyword=晴天';
  console.log(`[TEST] 正在请求远程 VPS 接口: ${url}`);
  try {
    const res = await axios.get(url, { timeout: 15000 });
    console.log(`[TEST] 远程响应成功！状态码:`, res.status);
    console.log(`[TEST] 搜索结果条数:`, res.data?.length || 0);
  } catch (err) {
    console.error(`[TEST] 远程连接失败:`, err.message);
  }
}

check();
