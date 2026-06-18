const fs = require('fs');
let code = fs.readFileSync('apps/server/src/index.ts', 'utf-8');
const oldCode = `    // 强行注入允许所有源跨域的 Header，以完美适配前端 audio 标签的 crossOrigin="anonymous"
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', '*');
    reply.header('X-Accel-Buffering', 'no');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');

    reply.code(proxyRes.statusCode || 200);
    return reply.send(proxyRes);`;

const newCode = `    // Fastify 处理 stream 默认会清除 Content-Length 并采用 chunked 编码
    // 这里我们直接接管底层的 raw response 来彻底解决音频无法拖拽同步 (Range Error) 的问题
    reply.raw.writeHead(proxyRes.statusCode || 200, cleanHeaders);
    proxyRes.pipe(reply.raw);
    return reply;`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('apps/server/src/index.ts', code);
  console.log("SUCCESS");
} else {
  console.log("FAILED to find oldCode");
}
