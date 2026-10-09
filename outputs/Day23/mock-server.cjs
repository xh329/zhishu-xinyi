'use strict';
/* Day 23 · 本地 mock 服务（只用于交付截图，不改项目代码）
 * ─────────────────────────────────────────────────────────────
 * 两件事：
 *   1) 托管项目根目录静态文件（让交付页有真实可访问的 http 地址）；
 *   2) 提供三类错误端点，供 error-demo.html 真实触发：
 *        GET /input/…   → 400 {ok:false, error:'invalid_param'}（不带 message，模拟"只有错误码"的裸报错）
 *        GET /server/…  → 500 {ok:false, error:'server_error'}（同上）
 *        GET /offline/… → 直接断开 socket（模拟断网 / 连不上）
 * 用法：node outputs/Day23/mock-server.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8791;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1:' + PORT);
  const p = u.pathname;
  const log = (code) => console.log(`[mock] ${new Date().toISOString()} ${req.method} ${p} → ${code}`);
  const sendJson = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(obj));
    log(code);
  };

  // ---- 三类错误端点（故意不带 message，模拟服务端只给错误码）----
  if (p.startsWith('/input/')) return sendJson(400, { ok: false, error: 'invalid_param' });
  if (p.startsWith('/server/')) return sendJson(500, { ok: false, error: 'server_error' });
  if (p.startsWith('/offline/')) { log('socket-destroy'); return req.socket.destroy(); }

  // ---- 静态文件 ----
  let rel = decodeURIComponent(p);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!path.resolve(file).startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 ' + rel); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => console.log('mock-server on http://127.0.0.1:' + PORT));
