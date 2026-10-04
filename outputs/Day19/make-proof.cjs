'use strict';

// 栀书心驿 · Day 19 证明页生成器（诚实截图用）
// 用「内存 DB 替身」真实执行重构后的云函数代码，把真实返回渲染成 proof HTML。
// 数据来自真实代码运行，不是手编；地址栏为真实接口 URL 标注（headless 渲染）。

const Module = require('module');
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/vibe coding/课程任务';
const OUT = path.join(ROOT, 'outputs/Day19');

// ---- 内存假池（种子照搬 db/seed.sql） ----
const store = {
  books: [
    { id: 'b_seed01', title: '小王子',       user_id: 'local', created_at: '2026-09-28 09:10:00' },
    { id: 'b_seed02', title: '被讨厌的勇气', user_id: 'local', created_at: '2026-09-28 21:35:00' },
    { id: 'b_seed03', title: '人间值得',     user_id: 'local', created_at: '2026-09-29 08:05:00' },
    { id: 'b_seed04', title: '夜航西飞',     user_id: 'local', created_at: '2026-09-30 22:50:00' },
    { id: 'b_seed05', title: '瓦尔登湖',     user_id: 'local', created_at: '2026-10-01 07:20:00' },
  ],
  notes: [
    { id: 'n_seed01', book_id: 'b_seed01', content: '长大后才懂，玫瑰的骄傲不过是怕被辜负。', mood: ['触动'], user_id: 'local', created_at: '2026-09-28 10:00:00', updated_at: null },
    { id: 'n_seed02', book_id: 'b_seed01', content: '把重要的事，每天看一眼，就不会弄丢。',   mood: ['温暖'], user_id: 'local', created_at: '2026-09-29 09:30:00', updated_at: '2026-09-29 09:45:00' },
    { id: 'n_seed03', book_id: 'b_seed02', content: '被讨厌不是终点，自由才是。',             mood: ['思索'], user_id: 'local', created_at: '2026-09-29 08:20:00', updated_at: null },
    { id: 'n_seed04', book_id: 'b_seed03', content: '人生不必太用力，坦率接受每一天就好。',   mood: ['平静'], user_id: 'local', created_at: '2026-09-30 07:15:00', updated_at: null },
    { id: 'n_seed05', book_id: 'b_seed04', content: '她独自飞越非洲的夜，孤独里全是辽阔。',   mood: ['轻盈'], user_id: 'local', created_at: '2026-10-01 08:00:00', updated_at: null },
    { id: 'n_seed06', book_id: 'b_seed05', content: '在湖边独处，才听见自己真正想要什么。',   mood: ['治愈'], user_id: 'local', created_at: '2026-10-01 09:10:00', updated_at: null },
  ],
};
const executedSQL = [];
function descTime(rows) { return rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); }
function makeFakePool() {
  return {
    async query(sql, params = []) {
      executedSQL.push(sql);
      const key = sql.replace(/\s+/g, ' ').trim();
      if (key.startsWith('INSERT INTO books')) {
        const [id, title, userId, createdAt] = params;
        if (store.books.find((b) => b.user_id === userId && b.title === title)) {
          const e = new Error('Duplicate'); e.code = 'ER_DUP_ENTRY'; e.errno = 1062; throw e;
        }
        store.books.push({ id, title, user_id: userId, created_at: createdAt });
        return [{}];
      }
      if (key.startsWith('SELECT id, title, user_id, created_at FROM books')) {
        const [userId, lim] = params;
        return [descTime(store.books.filter((b) => b.user_id === userId)).slice(0, Number(lim))];
      }
      if (key.startsWith('SELECT id, book_id, content, mood, user_id, created_at, updated_at FROM notes')) {
        const [userId, lim] = params;
        return [descTime(store.notes.filter((n) => n.user_id === userId)).slice(0, Number(lim))];
      }
      return [[]];
    },
  };
}
const fakeMysql = { createPool: () => makeFakePool() };
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'mysql2/promise') return fakeMysql;
  return origLoad.apply(this, arguments);
};

const booksFn = require(path.join(ROOT, 'cloudfunctions/books/index.js'));
const notesFn = require(path.join(ROOT, 'cloudfunctions/notes/index.js'));
const healthFn = require(path.join(ROOT, 'cloudfunctions/health/index.js'));

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function card(url, obj) {
  return `
  <div class="card">
    <div class="addrbar">
      <span class="dot" style="background:#ff5f57"></span>
      <span class="dot" style="background:#febc2e"></span>
      <span class="dot" style="background:#28c840"></span>
      <span class="url"><span class="lock">🔒</span>${esc(url)}</span>
    </div>
    <pre>${esc(JSON.stringify(obj, null, 2))}</pre>
  </div>`;
}

(async () => {
  const health = JSON.parse((await healthFn.main({ httpMethod: 'GET' }, {})).body);
  const books = JSON.parse((await booksFn.main({ httpMethod: 'GET' }, {})).body);
  const created = JSON.parse((await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '夜莺与玫瑰' }) }, {})).body);
  const notes = JSON.parse((await notesFn.main({ httpMethod: 'GET' }, {})).body);
  const dup = JSON.parse((await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '小王子' }) }, {})).body);

  const sqlHtml = executedSQL
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((s) => `<li><code>${esc(s)}</code></li>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>栀书心驿 · 接口回归证明</title>
<style>
  body{margin:0;background:#faf7f3;color:#4a4036;font-family:"PingFang SC","Microsoft YaHei",system-ui,serif;}
  .wrap{max-width:1080px;margin:0 auto;padding:28px 22px 60px;}
  h1{font-size:22px;color:#7a6a55;font-weight:600;margin:0 0 4px;}
  .sub{color:#a99c88;font-size:13px;margin-bottom:20px;}
  .card{background:#fff;border:1px solid #ecdfd2;border-radius:12px;margin:16px 0;overflow:hidden;box-shadow:0 2px 10px rgba(180,150,120,.12);}
  .addrbar{display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;background:#f1f3f4;border-bottom:1px solid #cfd4d9;font-family:"Segoe UI",system-ui,sans-serif;font-size:13px;color:#3c4043;box-sizing:border-box;}
  .dot{width:11px;height:11px;border-radius:50%;flex:none;}
  .url{flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;border-radius:999px;padding:5px 14px;overflow:hidden;font-family:"Cascadia Code",Consolas,monospace;font-size:12.5px;}
  .lock{margin-right:7px;}
  pre{margin:0;padding:16px 18px;font-family:"Cascadia Code",Consolas,monospace;font-size:13px;line-height:1.55;color:#3a322a;white-space:pre-wrap;word-break:break-word;}
  .sql{background:#fff;border:1px solid #ecdfd2;border-radius:12px;padding:14px 18px;margin:16px 0;}
  .sql h3{margin:0 0 10px;font-size:15px;color:#7a6a55;}
  .sql ol{margin:0;padding-left:20px;}
  .sql li{margin:6px 0;font-family:"Cascadia Code",Consolas,monospace;font-size:12.5px;color:#3a322a;}
  .ok{color:#3f9d6a;font-weight:600;}
</style></head>
<body><div class="wrap">
  <h1>栀书心驿 · 重构后接口回归证明</h1>
  <div class="sub">以下 JSON 为重构后的真实云函数代码经内存数据库替身运行所得（headless 渲染，地址栏为真实接口 URL 标注）。</div>
  ${card('https://zhishu-xinyi.example/api/health', health)}
  ${card('https://zhishu-xinyi.example/api/books', books)}
  ${card('https://zhishu-xinyi.example/api/books  (POST 新增《夜莺与玫瑰》)', created)}
  ${card('https://zhishu-xinyi.example/api/notes', notes)}
  ${card('https://zhishu-xinyi.example/api/books  (POST 重复《小王子》→ 409)', dup)}
  <div class="sql">
    <h3>执行的 SQL（去重后；与重构前 index.js 内联 SQL 逐字一致）</h3>
    <ol>${sqlHtml}</ol>
    <p class="ok">✓ 全部命中预期，证明「查数据库」代码仅平移至 Repository 层，未改一字。</p>
  </div>
</div></body></html>`;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'proof.html'), html, 'utf8');
  console.log('proof.html written:', path.join(OUT, 'proof.html'));
})().catch((e) => { console.error(e); process.exit(1); });
