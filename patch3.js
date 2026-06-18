const fs = require('fs');
let code = fs.readFileSync('apps/server/src/index.ts', 'utf-8');
const regex = /\/\/\s*强行注入允许所有源跨域的 Header，以完美适配前端 audio 标签的 crossOrigin=[\s\S]*?return reply\.send\(proxyRes\);/g;
const newCode = `    // Fastify 处理 stream 默认会清除 Content-Length 并采用 chunked 编码
    // 这里我们直接接管底层的 raw response 来彻底解决音频无法拖拽同步 (Range Error) 的问题
    reply.raw.writeHead(proxyRes.statusCode || 200, cleanHeaders);
    proxyRes.pipe(reply.raw);
    
    // 必须返回 reply 以表明已接管处理
    return reply;`;

// 移除之前的全局标志并直接匹配
const matchRegex = /\/\/\s*强行注入允许所有源跨域的 Header，以完美适配前端 audio 标签的 crossOrigin=[\s\S]*?return reply\.send\(proxyRes\);/;
if (matchRegex.test(code)) {
  code = code.replace(matchRegex, newCode);
  fs.writeFileSync('apps/server/src/index.ts', code);
  console.log('SUCCESS');
} else {
  console.log('FAILED to match regex');
}
