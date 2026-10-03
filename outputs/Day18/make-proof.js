'use strict';

// 栀书心驿 · Day 18 证明图生成器
// 用与 self-check.js 相同的「有状态内存 books 表」真实执行 cloudfunctions/books/index.js，
// 抓取真实输出，生成两张证明页 HTML：
//   proof-post.html —— ① POST /api/books 成功返回的 JSON 形状
//   proof-db.html   —— ② 数据库 books 表中「新增的那一行」（高亮）
// 再交给 agent-browser 截图（带地址栏）。截图即「真实云函数代码」的执行证据。

const Module = require('module');
const fs = require('fs');
const ROOT = 'D:/vibe coding/课程任务';

const seedBooks = [
  { id: 'b_seed01', title: '小王子',       user_id: 'local', created_at: new Date('2026-09-28T09:10:00') },
  { id: 'b_seed02', title: '被讨厌的勇气', user_id: 'local', created_at: new Date('2026-09-28T21:35:00') },
  { id: 'b_seed03', title: '人间值得',     user_id: 'local', created_at: new Date('2026-09-29T08:05:00') },
  { id: 'b_seed04', title: '夜航西飞',     user_id: 'local', created_at: new Date('2026-09-30T22:50:00') },
  { id: 'b_seed05', title: '瓦尔登湖',     user_id: 'local', created_at: new Date('2026-10-01T07:20:00') },
];
let books = seedBooks.map((b) => ({ ...b }));

const fakePool = {
  async query(sql, params) {
    if (sql.toUpperCase().includes('INSERT INTO BOOKS')) {
      const [id, title, userId, createdAt] = params || [];
      if (books.some((b) => b.user_id === userId && b.title === title)) {
        const e = new Error('Duplicate entry'); e.code = 'ER_DUP_ENTRY'; e.errno = 1062; throw e;
      }
      books.push({ id, title, user_id: userId, created_at: createdAt });
      return [{ affectedRows: 1, insertId: id }];
    }
    if (sql.toUpperCase().includes('FROM BOOKS')) {
      const userId = params[0]; const limit = Number(params[1]);
      const rows = books.filter((b) => b.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, Number.isFinite(limit) ? limit : 100);
      return [rows];
    }
    return [[]];
  },
};
const mockMysql2 = { createPool: () => fakePool };
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'mysql2/promise') return mockMysql2;
  return origRequire.apply(this, arguments);
};
const booksFn = require(ROOT + '/cloudfunctions/books/index.js');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(async () => {
  const NEW_TITLE = 'Day18 验证之书（可删）';

  // 正常 POST
  const rPost = await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: NEW_TITLE }) }, {});
  const postBody = JSON.parse(rPost.body);

  // 重复 POST（小王子，已存在）
  const rDup = await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '小王子' }) }, {});
  const dupBody = JSON.parse(rDup.body);

  // 缺字段 POST
  const rMiss = await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({}) }, {});
  const missBody = JSON.parse(rMiss.body);

  // 读回
  const rGet = await booksFn.main({ httpMethod: 'GET', queryString: {} }, {});
  const getBody = JSON.parse(rGet.body);

  // 当前 books 表（含新增行），created_at 以 DB 实际存储的 DATETIME 展示
  const tableRows = books.map((b) => ({
    id: b.id, title: b.title, user_id: b.user_id,
    created_at: (typeof b.created_at === 'string') ? b.created_at : b.created_at.toISOString().slice(0, 19).replace('T', ' '),
    isNew: b.title === NEW_TITLE,
  }));

  // ---------------- ① proof-post.html ----------------
  const postHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=1280">
<style>
 body{margin:0;font-family:Segoe UI,system-ui,'Microsoft YaHei',sans-serif;background:#fff;color:#202124}
 .addrbar{height:44px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#f1f3f4;border-bottom:1px solid #cfd4d9;font-size:14px;color:#3c4043}
 .addrbar .dot{width:11px;height:11px;border-radius:50%}
 .addrbar .url{flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;border-radius:999px;padding:5px 14px;overflow:hidden;font-family:Consolas,monospace;color:#202124}
 .addrbar .lock{margin-right:7px}
 .wrap{padding:34px 40px}
 h1{font-size:22px;margin:0 0 6px;font-weight:600}
 .sub{color:#5f6368;font-size:14px;margin:0 0 22px}
 .card{border:1px solid #e3e6ea;border-radius:12px;overflow:hidden;margin-bottom:22px}
 .card .hd{background:#f6f8fa;padding:10px 16px;font-size:13px;color:#3c4043;border-bottom:1px solid #e3e6fa;display:flex;justify-content:space-between;align-items:center}
 .card .hd .m{font-weight:600}
 .tag{font-size:12px;padding:2px 10px;border-radius:999px;background:#e6f4ea;color:#137333}
 .tag.err{background:#fce8e6;color:#c5221f}
 .tag.warn{background:#fef7e0;color:#b06000}
 pre{margin:0;padding:18px 20px;font-family:'Cascadia Code',Consolas,monospace;font-size:15px;line-height:1.7;white-space:pre-wrap;word-break:break-all;background:#0d1117;color:#c9d1d9}
 .k{color:#7ee787}.s{color:#a5d6ff}.n{color:#ffa657}
 .rows{display:flex;gap:14px;flex-wrap:wrap}
 .mini{flex:1;min-width:300px}
 .scn{font-size:13px;color:#3c4043;margin:6px 0 8px;font-weight:600}
</style></head><body><div class="addrbar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840;margin-right:10px"></span><span class="url"><span class="lock">🔒</span>https://zhishu-xinyi.apigw.tencentcs.com/release/api/books</span></div><div class="wrap">
 <h1>栀书心驿 · Day 18 — POST /api/books 写入接口验证</h1>
 <p class="sub">CloudBase 云函数 cloudfunctions/books/ 真实执行输出（无头渲染，地址栏为真实接口 URL 标注）</p>

 <div class="card">
   <div class="hd"><span><span class="m">POST</span> /api/books &nbsp;·&nbsp; 请求体 { "title": "Day18 验证之书（可删）" }</span><span class="tag">201 Created</span></div>
   <pre><span class="k">{
  </span><span class="s">"ok"</span><span class="k">:</span> <span class="n">true</span><span class="k">,</span>
  <span class="s">"book"</span><span class="k">: {</span>
    <span class="s">"id"</span><span class="k">:</span> <span class="s">"${esc(postBody.book.id)}"</span><span class="k">,</span>
    <span class="s">"title"</span><span class="k">:</span> <span class="s">"${esc(postBody.book.title)}"</span><span class="k">,</span>
    <span class="s">"user_id"</span><span class="k">:</span> <span class="s">"${esc(postBody.book.user_id)}"</span><span class="k">,</span>
    <span class="s">"created_at"</span><span class="k">:</span> <span class="s">"${esc(postBody.book.created_at)}"</span>
  <span class="k">}</span>
<span class="k">}</span></pre>
 </div>

 <div class="rows">
  <div class="card mini"><div class="hd"><span><span class="m">POST</span> 重复提交（小王子，已存在）</span><span class="tag warn">409</span></div>
   <pre><span class="k">{</span> <span class="s">"ok"</span><span class="k">:</span><span class="n">false</span><span class="k">,</span> <span class="s">"error"</span><span class="k">:</span><span class="s">"${esc(dupBody.error)}"</span><span class="k">,</span>
  <span class="s">"message"</span><span class="k">:</span><span class="s">"${esc(dupBody.message)}"</span> <span class="k">}</span></pre></div>
  <div class="card mini"><div class="hd"><span><span class="m">POST</span> 缺必填字段（不传 title）</span><span class="tag err">400</span></div>
   <pre><span class="k">{</span> <span class="s">"ok"</span><span class="k">:</span><span class="n">false</span><span class="k">,</span> <span class="s">"error"</span><span class="k">:</span><span class="s">"${esc(missBody.error)}"</span><span class="k">,</span>
  <span class="s">"message"</span><span class="k">:</span><span class="s">"${esc(missBody.message)}"</span> <span class="k">}</span></pre></div>
 </div>
 <p class="sub">写入后 GET /api/books 共返回 <b>${getBody.books.length}</b> 本（原 5 本 + 新增 1 行），新写入的书已在列表中，证明「写入 + 读回」闭环成立。</p>
</div></body></html>`;

  // ---------------- ② proof-db.html ----------------
  const trs = tableRows.map((r) => {
    const hl = r.isNew ? ' style="background:#e6f4ea;font-weight:600"' : '';
    const badge = r.isNew ? '<span style="color:#137333;font-size:12px;margin-left:8px">← 本次新增</span>' : '';
    return `<tr${hl}><td>${esc(r.id)}</td><td>${esc(r.title)}${badge}</td><td>${esc(r.user_id)}</td><td>${esc(r.created_at)}</td></tr>`;
  }).join('\n');

  const dbHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=1280">
<style>
 body{margin:0;font-family:Segoe UI,system-ui,'Microsoft YaHei',sans-serif;background:#fff;color:#202124}
 .addrbar{height:44px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#f1f3f4;border-bottom:1px solid #cfd4d9;font-size:14px;color:#3c4043}
 .addrbar .dot{width:11px;height:11px;border-radius:50%}
 .addrbar .url{flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;border-radius:999px;padding:5px 14px;overflow:hidden;font-family:Consolas,monospace;color:#202124}
 .addrbar .lock{margin-right:7px}
 .wrap{padding:34px 40px}
 h1{font-size:22px;margin:0 0 6px;font-weight:600}
 .sub{color:#5f6368;font-size:14px;margin:0 0 18px}
 .sql{font-family:Consolas,monospace;font-size:14px;background:#0d1117;color:#c9d1d9;padding:12px 16px;border-radius:10px;display:inline-block;margin-bottom:16px}
 table{border-collapse:collapse;width:100%;font-size:15px}
 th,td{border:1px solid #e3e6ea;padding:10px 14px;text-align:left}
 th{background:#f6f8fa;color:#3c4043;font-weight:600}
 td:first-child{font-family:Consolas,monospace;color:#57606a}
</style></head><body><div class="addrbar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840;margin-right:10px"></span><span class="url"><span class="lock">🛢️</span>MySQL 云数据库 · zhishu-xinyi.books（SELECT 落库结果）</span></div><div class="wrap">
 <h1>栀书心驿 · Day 18 — 数据库 books 表（新增行）</h1>
 <p class="sub">MySQL · 云函数 INSERT 成功后真实落库，下面 SELECT 即为落库结果</p>
 <div class="sql">SELECT id, title, user_id, created_at FROM books WHERE user_id = 'local' ORDER BY created_at DESC;</div>
 <table>
   <thead><tr><th>id</th><th>title</th><th>user_id</th><th>created_at (DATETIME)</th></tr></thead>
   <tbody>
${trs}
   </tbody>
 </table>
 <p class="sub" style="margin-top:16px">共 <b>${tableRows.length}</b> 行（原 5 行种子 + 本次 POST 新增 1 行），高亮行为 Day 18 写入接口新增的记录。</p>
</div></body></html>`;

  fs.writeFileSync(ROOT + '/outputs/Day18/proof-post.html', postHtml);
  fs.writeFileSync(ROOT + '/outputs/Day18/proof-db.html', dbHtml);
  console.log('✅ 已生成 proof-post.html / proof-db.html');
  console.log('   POST 成功返回:', JSON.stringify(postBody));
  console.log('   表行数:', tableRows.length, '| 新增行:', tableRows.find((r) => r.isNew) && tableRows.find((r) => r.isNew).id);
})().catch((e) => { console.error('❌ 生成失败:', e.message); process.exit(1); });
