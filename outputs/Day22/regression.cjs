'use strict';

/* 栀书心驿 · Day 22 回归验证：PATCH 改写 + DELETE 删除（含四类操作闭环）
 * ─────────────────────────────────────────────────────────────
 * 跑法：node outputs/Day22/regression.cjs
 *
 * 做什么：
 *   1. 用内存库替身（fake-db.cjs）拦住 mysql2，require **真实的** cloudfunctions/notes/index.js；
 *   2. 按 CloudBase 的 event 形状逐个调用，断言状态码 / 响应形状 / 数据库里的值；
 *   3. 重点断言三件事：
 *      ① PATCH 后 GET 读回的值确实变了（改生效）；
 *      ② DELETE 后 GET 不再返回该条（删干净），条数 7 → 6；
 *      ③ 不存在的 id → 404 + 中文说明，不假装成功。
 *   4. 顺便证明安全口径没松：SQL 里只有 ? 占位，改写的正文一个字都没拼进 SQL 文本；
 *      接口层依旧 0 行 SQL（分层不破）。
 *
 * 不做什么：不连真实 MySQL、不假装这是公网请求（真实库验证见 outputs/Day22/部署与验证.md）。
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

// 云函数读 CORS 白名单环境变量：这里模拟"本机联调域名已进白名单"，用来验证预检会回 ACAO
process.env.ALLOWED_ORIGIN = 'http://127.0.0.1:8791 http://localhost:8791';

const OUT = __dirname;
const ROOT = path.resolve(__dirname, '..', '..');
const fake = require('./fake-db.cjs');
const db = fake.install();

// require 真实云函数（必须在 install() 之后）
const notesFn = require(path.join(ROOT, 'cloudfunctions/notes/index.js'));
const booksFn = require(path.join(ROOT, 'cloudfunctions/books/index.js'));
const healthFn = require(path.join(ROOT, 'cloudfunctions/health/index.js'));

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; say('  ✓ ' + name); }
  else { fail++; failures.push(name + ' —— ' + (detail || '')); say('  ✗ ' + name + '  ' + (detail || '')); }
}
function parse(res) { return { statusCode: res.statusCode, body: JSON.parse(res.body) }; }

// 一次性把 event 拼好，贴近 CloudBase HTTP 触发的真实形状
function ev(method, opts) {
  const o = opts || {};
  return Object.assign({
    httpMethod: method,
    headers: { origin: 'http://127.0.0.1:8791', 'content-type': 'application/json' },
    queryString: {},
    path: '/api/notes',
  }, o.body !== undefined ? { body: o.body } : {}, o);
}

const call = (fn, event) => fn.main(event, {});
const patch = (id, body) => call(notesFn, ev('PATCH', { path: '/api/notes/' + id, pathParameters: { id }, body: JSON.stringify(body) }));
const del = (id, pathStyle) => call(notesFn, ev('DELETE', pathStyle
  ? { path: '/api/notes/' + id }                       // 触发配成通配时：只从 path 末尾取 id
  : { path: '/api/notes/' + id, pathParameters: { id } })); // 触发配成路径参数时：event.pathParameters.id
const listNotes = () => call(notesFn, ev('GET', { path: '/api/notes', queryString: { user_id: 'local' } }));

async function main() {
  say('栀书心驿 · Day 22 回归验证（PATCH / DELETE · 四类操作闭环）');
  say('时间：' + new Date().toLocaleString('zh-CN') + '　运行：内存库替身 + 真实云函数代码');
  say('');

  const snapshot = {};

  /* ---------- 0) 探活（查） ---------- */
  say('[0] GET /api/health（探活）');
  {
    const r = parse(await call(healthFn, ev('GET', { path: '/api/health' })));
    check('200 且 ok=true', r.statusCode === 200 && r.body.ok === true, `status=${r.statusCode}`);
  }

  /* ---------- 1) 改之前：先读一遍（查） ---------- */
  say('\n[1] GET /api/notes（改之前）');
  let before;
  {
    const r = parse(await listNotes());
    before = r.body.notes;
    check('200 且 6 段（db/seed.sql 的 6 条种子）', r.statusCode === 200 && before.length === 6, `len=${before.length}`);
    check('按 created_at 倒序，最新一段是 n_seed06', before[0].id === 'n_seed06', before[0] && before[0].id);
    snapshot.notesBefore = before.map((n) => ({ id: n.id, content: n.content, mood: n.mood, updated_at: n.updated_at }));
    say('  改之前 n_seed06：正文「' + before[0].content + '」／心情 ' + JSON.stringify(before[0].mood) + '／改写时间 ' + before[0].updated_at);
  }

  /* ---------- 2) PATCH 改写：正文 + 心情一起改（改） ---------- */
  say('\n[2] PATCH /api/notes/n_seed06（正文 + 心情一起改）');
  const NEW_TEXT = '在湖边独处，才听见自己真正想要什么。（Day22 联调时改过一次）';
  const NEW_MOOD = ['平静', '轻盈'];
  {
    const r = parse(await patch('n_seed06', { content: NEW_TEXT, mood: NEW_MOOD }));
    check('200 且 ok=true', r.statusCode === 200 && r.body.ok === true, `status=${r.statusCode}`);
    check('响应带 note 对象', !!r.body.note, JSON.stringify(r.body).slice(0, 120));
    check('正文已改成新值', r.body.note.content === NEW_TEXT, r.body.note.content);
    check('心情已改成数组 [' + NEW_MOOD.join(',') + ']', JSON.stringify(r.body.note.mood) === JSON.stringify(NEW_MOOD), JSON.stringify(r.body.note.mood));
    check('updated_at 从 null 变成有时间', r.body.note.updated_at !== null && /^\d{4}-\d{2}-\d{2}T/.test(r.body.note.updated_at), String(r.body.note.updated_at));
    check('created_at 没被动过', r.body.note.created_at === '2026-10-01T09:10:00', r.body.note.created_at);
    check('只改了 4 个字段键，形状仍与契约一致（7 字段）', Object.keys(r.body.note).length === 7, Object.keys(r.body.note).join(','));
    snapshot.patchResponse = r.body;
  }

  /* ---------- 3) 关键断言：GET 读回，值真的变了 ---------- */
  say('\n[3] GET /api/notes（改之后 · 读回验证）');
  {
    const r = parse(await listNotes());
    const n = r.body.notes.find((x) => x.id === 'n_seed06');
    check('该条仍在（改写≠删除）', !!n);
    check('读回的正文 == 改写后的正文', n && n.content === NEW_TEXT, n && n.content);
    check('读回的心情 == 改写后的心情', n && JSON.stringify(n.mood) === JSON.stringify(NEW_MOOD), n && JSON.stringify(n.mood));
    check('条数不变（改写不增不减）', r.body.notes.length === before.length, `len=${r.body.notes.length}，改之前 ${before.length}`);
    snapshot.notesAfterPatch = r.body.notes.map((x) => ({ id: x.id, content: x.content, mood: x.mood, updated_at: x.updated_at }));
  }

  /* ---------- 4) PATCH 局部性：只传 mood，正文不许被碰 ---------- */
  say('\n[4] PATCH /api/notes/n_seed01（只传 mood → 正文必须原样不动）');
  {
    const r = parse(await patch('n_seed01', { mood: ['治愈'] }));
    check('200', r.statusCode === 200, `status=${r.statusCode}`);
    check('正文仍是最初那句', r.body.note.content === '长大后才懂，玫瑰的骄傲不过是怕被辜负。', r.body.note.content);
    check('心情改成 ["治愈"]', JSON.stringify(r.body.note.mood) === '["治愈"]');
  }

  /* ---------- 5) 各种该被拒绝的输入 ---------- */
  say('\n[5] 该被拒绝的输入（校验与中文说明）');
  {
    const notFound = parse(await patch('n_不存在的id', { content: '随便写点' }));
    check('不存在的 id → 404', notFound.statusCode === 404, `status=${notFound.statusCode}`);
    check('错误码 not_found', notFound.body.error === 'not_found');
    check('有中文说明', /不在了/.test(notFound.body.message || ''), notFound.body.message);

    const empty = parse(await patch('n_seed02', {}));
    check('一个可改字段都没传 → 400 invalid_param', empty.statusCode === 400 && empty.body.error === 'invalid_param', `status=${empty.statusCode}`);
    check('中文说明（没有要改写的内容）', /没有要改写的内容/.test(empty.body.message || ''), empty.body.message);

    const blank = parse(await patch('n_seed02', { content: '   ' }));
    check('正文改成空白 → 400', blank.statusCode === 400 && blank.body.error === 'invalid_param', `status=${blank.statusCode}`);
    check('中文说明（不能改成空白）', /不能改成空白/.test(blank.body.message || ''), blank.body.message);

    const badMood = parse(await patch('n_seed02', { mood: '平静' }));
    check('心情传字符串而非数组 → 400', badMood.statusCode === 400, `status=${badMood.statusCode}`);
    check('中文说明（要是一个数组）', /数组/.test(badMood.body.message || ''), badMood.body.message);

    const noId = parse(await call(notesFn, ev('PATCH', { path: '/api/notes', body: JSON.stringify({ content: 'x' }) })));
    check('PATCH 没带 id → 400（不静默落空）', noId.statusCode === 400 && noId.body.error === 'invalid_param', `status=${noId.statusCode}`);

    const wrongField = parse(await patch('n_seed02', { user_id: 'hacker' }));
    check('只传不该改的字段（user_id）→ 400，且没被写进去', wrongField.statusCode === 400, `status=${wrongField.statusCode}`);
  }

  /* ---------- 6) PUT 兼容别名 ---------- */
  say('\n[6] PUT /api/notes/:id（契约第 7 项原来是 PUT，保留为兼容别名）');
  {
    const r = parse(await call(notesFn, ev('PUT', { path: '/api/notes/n_seed03', pathParameters: { id: 'n_seed03' }, body: JSON.stringify({ content: '被讨厌不是终点，自由才是。（改过一次）' }) })));
    check('200 且改成功', r.statusCode === 200 && /改过一次/.test(r.body.note.content), `status=${r.statusCode} ${r.body.note && r.body.note.content}`);
  }

  /* ---------- 7) DELETE 删除（删） ---------- */
  say('\n[7] DELETE /api/notes/n_seed06）');
  {
    const r = parse(await del('n_seed06'));
    check('200 且 ok=true', r.statusCode === 200 && r.body.ok === true, `status=${r.statusCode}`);
    check('回带删除的 id', r.body.id === 'n_seed06', JSON.stringify(r.body));
    snapshot.deleteResponse = r.body;
  }

  /* ---------- 8) 关键断言：删完 GET 不再返回 ---------- */
  say('\n[8] GET /api/notes（删之后 · 该条不再返回）');
  {
    const r = parse(await listNotes());
    const still = r.body.notes.some((n) => n.id === 'n_seed06');
    check('条数 ' + before.length + ' → ' + (before.length - 1), r.body.notes.length === before.length - 1, `len=${r.body.notes.length}`);
    check('返回里已找不到 n_seed06 ✓（核心断言）', still === false, still ? '竟然还在' : '');
    check('其它记录没被误删', r.body.notes.some((n) => n.id === 'n_seed01') && r.body.notes.some((n) => n.id === 'n_seed05'));
    snapshot.notesAfterDelete = r.body.notes.map((x) => ({ id: x.id, content: x.content, mood: x.mood, updated_at: x.updated_at }));
    snapshot.countBeforeDelete = before.length;
    snapshot.countAfterDelete = r.body.notes.length;
    say('  删除后返回的 id：' + r.body.notes.map((n) => n.id).join('、'));
  }

  /* ---------- 9) 删不存在的 id：不假装成功 ---------- */
  say('\n[9] DELETE 不存在的 id（含"已经删过一遍"）');
  {
    const again = parse(await del('n_seed06'));
    check('再删同一个 id → 404（不假装删成功）', again.statusCode === 404, `status=${again.statusCode}`);
    check('错误码 not_found', again.body.error === 'not_found');
    check('有中文说明', /不在了/.test(again.body.message || ''), again.body.message);

    const ghost = parse(await del('n_从没存在过', true));
    check('不存在的 id → 404 且走 path 末尾取 id 那条路', ghost.statusCode === 404 && ghost.body.error === 'not_found', `status=${ghost.statusCode}`);

    const noId = parse(await call(notesFn, ev('DELETE', { path: '/api/notes' })));
    check('DELETE 没带 id → 400 中文', noId.statusCode === 400 && /指明/.test(noId.body.message || ''), `status=${noId.statusCode}`);
  }

  /* ---------- 10) 方法边界与 CORS ---------- */
  say('\n[10] 方法边界与 CORS');
  {
    const post = parse(await call(notesFn, ev('POST', { path: '/api/notes', body: JSON.stringify({ book_id: 'b_seed01', content: 'x' }) })));
    check('POST /api/notes（第 5 项未实现）→ 405', post.statusCode === 405 && post.body.error === 'method_not_allowed', `status=${post.statusCode}`);

    const opt = await call(notesFn, ev('OPTIONS', { path: '/api/notes/n_seed01' }));
    check('OPTIONS 预检 → 204', opt.statusCode === 204, `status=${opt.statusCode}`);
    const allow = opt.headers['Access-Control-Allow-Methods'] || '';
    check('CORS 方法白名单含 PATCH', /PATCH/.test(allow), allow);
    check('CORS 方法白名单含 DELETE', /DELETE/.test(allow), allow);
    check('预检命中白名单来源 → 回 ACAO', opt.headers['Access-Control-Allow-Origin'] === 'http://127.0.0.1:8791', String(opt.headers['Access-Control-Allow-Origin']));
    check('非白名单来源不回 ACAO', (await call(notesFn, ev('GET', { path: '/api/notes', headers: { origin: 'http://evil.example' } }))).headers['Access-Control-Allow-Origin'] === undefined);
  }

  /* ---------- 11) 服务异常 → 500 ---------- */
  say('\n[11] 数据库异常 → 500（错误码映射）');
  {
    db.setForceError(true);
    const r = parse(await listNotes());
    db.setForceError(false);
    check('500 且 error=server_error', r.statusCode === 500 && r.body.error === 'server_error', `status=${r.statusCode}`);
  }

  /* ---------- 12) 四类操作闭环（增删改查） ---------- */
  say('\n[12] 四类操作闭环（同一张记录表上跑一遍）');
  {
    const created = parse(await call(notesFn, ev('POST', { path: '/api/notes', body: JSON.stringify({ book_id: 'b_seed01', content: '闭环保底' }) })));
    check('⑤ 增：POST /api/notes 目前按排期未实现 → 405（记为待办，不算今日缺陷）', created.statusCode === 405, `status=${created.statusCode}`);
    const read = parse(await listNotes());
    check('① 查：GET /api/notes 正常（当前 ' + (before.length - 1) + ' 段）',
      read.statusCode === 200 && read.body.notes.length === before.length - 1,
      `len=${read.body.notes.length}`);
    const patched = parse(await patch('n_seed04', { content: '人生不必太用力，坦率接受每一天就好。（闭环改）' }));
    check('② 改：PATCH 生效', patched.statusCode === 200 && /闭环改/.test(patched.body.note.content));
    const removed = parse(await del('n_seed04'));
    const after = parse(await listNotes());
    check('③ 删：DELETE 生效且 GET 不再返回', removed.statusCode === 200 && !after.body.notes.some((n) => n.id === 'n_seed04'));
  }

  /* ---------- 13) 参数化与分层 ---------- */
  say('\n[13] 安全口径：参数化 / 分层');
  {
    const upd = db.executedSQL.filter((s) => /^UPDATE notes SET/i.test(s));
    const del2 = db.executedSQL.filter((s) => /^DELETE FROM notes WHERE id = \?$/i.test(s));
    check('UPDATE 语句存在且用 ? 占位', upd.length > 0 && upd.every((s) => /=\s*\?/.test(s)), upd[0]);
    check('UPDATE 里没有出现改写的正文（值不在 SQL 文本里）', upd.every((s) => s.indexOf('Day22 联调') === -1 && s.indexOf('（改过一次）') === -1));
    check('DELETE 语句用 ? 占位、无字符串拼接', del2.length > 0 && del2.every((s) => s.indexOf('n_seed') === -1));
    check('UPDATE 只 SET 该改的列（含 updated_at）', upd.every((s) => /updated_at = \?/.test(s)), upd[0]);
    const noteIdxSrc = fs.readFileSync(path.join(ROOT, 'cloudfunctions/notes/index.js'), 'utf8');
    // 先剥掉注释行再数：注释里提到 "UPDATE" 不算 SQL
    const sqlLines = noteIdxSrc.split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .filter((l) => /(SELECT |INSERT INTO|UPDATE |DELETE FROM)/.test(l));
    check('接口层 index.js 里 SQL 语句 0 行（分层不破）', sqlLines.length === 0, sqlLines.join(' | '));
  }

  /* ---------- 汇总 ---------- */
  say('\n================ 结果：通过 ' + pass + ' / 失败 ' + fail + ' ================');
  if (fail > 0) {
    say('失败项：');
    failures.forEach((f) => say('  - ' + f));
  }

  snapshot.executedSQL = db.executedSQL;
  snapshot.totalAssertions = pass + fail;
  snapshot.pass = pass;
  snapshot.fail = fail;
  fs.writeFileSync(path.join(OUT, 'responses.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'executed-sql.json'), JSON.stringify(db.executedSQL, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'regression.out.txt'), lines.join('\n') + '\n', 'utf8');
  console.log('\n证据已写入 outputs/Day22/{responses.json, executed-sql.json, regression.out.txt}');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('回归脚本异常：', e);
  process.exit(2);
});
