const api = require('@sansenjian/qq-music-api');

console.log('--- 开始测试远程 QQ 音乐搜索接口 ---');
api.getSearchByKey({ params: { w: '晴天' } })
  .then(res => {
     console.log('✅ 测试成功，数据回执长度:', JSON.stringify(res).length);
     console.log('回执样本:', JSON.stringify(res).slice(0, 500));
  })
  .catch(err => {
     console.error('❌ 接口发生异常，报错详情如下:');
     console.error(err);
  });
