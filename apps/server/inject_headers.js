// inject_headers.js
const http = require('http');
const https = require('https');

const CHINA_IP = process.env.REAL_IP || '116.25.146.177';

function injectHeaders(options) {
  if (!options || typeof options !== 'object') return;
  try {
    if (!options.headers) {
      options.headers = {};
    }
    options.headers['X-Real-IP'] = CHINA_IP;
    options.headers['X-Forwarded-For'] = CHINA_IP;
    options.headers['Client-IP'] = CHINA_IP;
  } catch (e) {
    // 忽略对只读对象的属性修改异常
  }
}

// 拦截 http.request
const originalHttpRequest = http.request;
http.request = function(arg1, arg2, arg3) {
  let options = arg1;
  if (typeof arg1 === 'string' || (arg1 && arg1.href)) {
    options = arg2 || arg1;
  }
  injectHeaders(options);
  return originalHttpRequest.apply(this, arguments);
};

// 拦截 https.request
const originalHttpsRequest = https.request;
https.request = function(arg1, arg2, arg3) {
  let options = arg1;
  if (typeof arg1 === 'string' || (arg1 && arg1.href)) {
    options = arg2 || arg1;
  }
  injectHeaders(options);
  return originalHttpsRequest.apply(this, arguments);
};

console.log('[自愈守护] 已成功向子进程注入全局 HTTP/HTTPS 大陆 IP 伪装层！');
