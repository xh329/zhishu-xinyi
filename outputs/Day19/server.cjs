'use strict';
// Day 19 截图用本地静态服务：强制 no-store，避免 agent-browser 命中 HTTP 缓存。
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/vibe coding/课程任务/outputs/Day19';
const PORT = 8137;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
};
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/proof.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});
srv.listen(PORT, () => console.log('serving on http://localhost:' + PORT));
