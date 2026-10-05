'use strict';
// 项目根静态服务（Day 20 本地联调用，仅供联调，不部署）
// 仅用于让浏览器能加载 index.html / check.html 等静态资源；
// 前端通过 ?api=http://localhost:8787 把接口请求指向 mock-api.js 替身。
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/vibe coding/课程任务';
const PORT = 8211;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  const rel = path.relative(ROOT, fp);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log('[serve-root] http://localhost:' + PORT));
