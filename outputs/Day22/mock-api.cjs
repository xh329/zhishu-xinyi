'use strict';

/* 栀书心驿 · Day 22 本地联调服务（仅供本地验证，不部署）
 * ─────────────────────────────────────────────────────────────
 * 跑法：node outputs/Day22/mock-api.cjs [端口]       默认 8791
 *
 * 一个端口同时干两件事：
 *   1. /api/* → **真实执行** cloudfunctions/ 里的云函数（mysql2 被内存库替身接住）；
 *   2. 其它路径 → 把项目根目录当静态站发出去（check.html / index.html / js / css …）。
 *
 * 为什么要同源：页面和接口都从 127.0.0.1:8791 出，浏览器不发跨域请求，
 *   就不必为了截图去放宽 CORS 白名单；同时页面上 `?api=http://127.0.0.1:8791`
 *   也只是把接口指回同一个源，行为与线上一致。
 *
 * 诚实标注：这是本地替身，**不等于公网**。地址栏里出现的是 127.0.0.1，不是 apigw 域名。
 * 为什么路径要整段透传：/api/notes/n_seed06 这类子路径也要交到同一个 notes 函数手里，
 *   线上需要在 CloudBase 把该函数的 HTTP 触发路径配成可匹配子路径的形式（见部署与验证.md 第二节）。
 * ─────────────────────────────────────────────────────────────
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 8791);
const ROOT = path.resolve(__dirname, '..', '..');

// 先让云函数认这个来源，再 require 它们
process.env.ALLOWED_ORIGIN = 'http://127.0.0.1:' + PORT + ' http://localhost:' + PORT;

const db = require('./fake-db.cjs').install();
const fns = {
  health: require(path.join(ROOT, 'cloudfunctions/health/index.js')),
  books: require(path.join(ROOT, 'cloudfunctions/books/index.js')),
  notes: require(path.join(ROOT, 'cloudfunctions/notes/index.js')),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, rel);
  // 防目录穿越：只允许发项目根目录内的文件
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 没有这个文件：' + rel);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
  const pathname = url.pathname;

  if (pathname.indexOf('/api/') !== 0) return serveStatic(req, res, pathname);

  // 把 HTTP 请求翻译成 CloudBase event 的形状（真实字段名与线上一致）
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    queryString: Object.fromEntries(url.searchParams),
    path: pathname,
    body: await readBody(req),
  };
  const fn = pathname === '/api/health' ? fns.health
    : pathname.indexOf('/api/books') === 0 ? fns.books
      : fns.notes;

  try {
    const out = await fn.main(event, {});
    const headers = Object.assign({}, out.headers);
    console.log('[mock] ' + req.method + ' ' + pathname + ' → ' + out.statusCode +
      (req.method === 'GET' ? '' : ' ' + String(event.body).slice(0, 90)));
    res.writeHead(out.statusCode, headers);
    res.end(out.body);
  } catch (e) {
    console.error('[mock] 云函数抛出未捕获异常', e);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'server_error' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[mock-api] 已启动 http://127.0.0.1:' + PORT);
  console.log('[mock-api] 静态站根目录：' + ROOT);
  console.log('[mock-api] 内存库：books ' + db.store.books.length + ' 本 / notes ' + db.store.notes.length + ' 段');
});
