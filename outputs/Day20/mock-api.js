/* 栀书心驿 · 本地 mock 云函数（Day 20 本地联调用，仅供联调，不部署）
 *
 * 完全按 api-contract.md 的形状返回数据，用来验证「前端从 mock 切到公网接口」这条链路是否打通：
 *   GET  /api/health      → { ok:true, service:'zhishu-xinyi' }
 *   GET  /api/books       → { ok:true, books:[...] }   （5 条种子）
 *   GET  /api/notes       → { ok:true, notes:[...] }   （5 条种子，book_id 对应上面的书）
 *   POST /api/books       → { ok:true, book:{...} }    （回显写入）
 *   OPTIONS               → 204 预检，reflect Origin
 *
 * CORS：reflect 请求方 Origin（本地联调用，方便前端以 http://localhost:PORT 跨域读取）。
 * 注意：这只是本地验证替身；真实数据来自你部署在 CloudBase 的云函数 + 云数据库。
 */
'use strict';
const http = require('http');
const PORT = 8787;

const books = [
  { id: 'b_1', title: '被讨厌的勇气', user_id: 'local', created_at: '2026-09-21T08:30:00' },
  { id: 'b_2', title: '小王子', user_id: 'local', created_at: '2026-09-19T22:10:00' },
  { id: 'b_3', title: '人间值得', user_id: 'local', created_at: '2026-09-15T21:05:00' },
  { id: 'b_4', title: '夜航西飞', user_id: 'local', created_at: '2026-09-12T20:40:00' },
  { id: 'b_5', title: '克拉克森的农场', user_id: 'local', created_at: '2026-09-10T19:00:00' },
];
const notes = [
  { id: 'n_1', book_id: 'b_1', content: '所谓自由，就是被别人讨厌。读到这句，忽然松了一口气——原来不必讨好所有人。', mood: ['治愈'], user_id: 'local', created_at: '2026-09-21T08:45:00', updated_at: null },
  { id: 'n_2', book_id: 'b_2', content: '“你下午四点来，那么从三点起我就开始感到幸福。” 慢一点，也很好。', mood: ['温暖'], user_id: 'local', created_at: '2026-09-19T22:25:00', updated_at: null },
  { id: 'n_3', book_id: 'b_3', content: '凡事看开一点，与其勉强，不如顺其自然地生活。今天有点被接住的感觉。', mood: ['平静'], user_id: 'local', created_at: '2026-09-15T21:20:00', updated_at: null },
  { id: 'n_4', book_id: 'b_4', content: '她写非洲的天空，辽阔得让人忘记自己。我也想有这样一片可以发呆的天。', mood: ['思索'], user_id: 'local', created_at: '2026-09-12T20:55:00', updated_at: null },
  { id: 'n_5', book_id: 'b_5', content: '农忙时节，土地最诚实。种下去的，秋天都会回来。', mood: ['轻盈'], user_id: 'local', created_at: '2026-09-10T19:20:00', updated_at: null },
];

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
function send(res, status, obj, req) {
  res.writeHead(status, corsHeaders(req));
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  if (path === '/api/health') return send(res, 200, { ok: true, service: 'zhishu-xinyi' }, req);
  if (path === '/api/books') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let title = '测试书籍';
        try { title = (JSON.parse(body).title) || title; } catch (e) {}
        const book = { id: 'b_' + Date.now(), title, user_id: 'local', created_at: new Date().toISOString().slice(0, 19) };
        books.unshift(book);   // 真写进内存表：这样「写入 → 刷新首页」能看到条数跟着变（与真实云函数一致）
        send(res, 201, { ok: true, book }, req);
      });
      return;
    }
    return send(res, 200, { ok: true, books }, req);
  }
  if (path === '/api/notes') return send(res, 200, { ok: true, notes }, req);

  send(res, 404, { ok: false, error: 'not_found' }, req);
});

server.listen(PORT, () => console.log('[mock-api] 已启动 http://localhost:' + PORT));
