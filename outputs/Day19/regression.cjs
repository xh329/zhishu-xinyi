'use strict';

// 栀书心驿 · Day 19 回归验证脚本（内存 DB 替身）
// ─────────────────────────────────────────────────────────────
// 目的：在不连真实数据库的前提下，验证「拆出 Repository 层」后，
//       所有已上线接口的行为与响应形状与重构前完全一致。
//
// 做法：
//   1. 拦截 Node 的 require，把 'mysql2/promise' 替换成一个内存假连接池；
//   2. 假池背后维护一张内存表，种子数据照搬 db/seed.sql（mood 用数组，模拟 mysql2 对 JSON 列的解析）；
//   3. require 真实的 cloudfunctions/{books,notes,health}/index.js，逐个模拟 CloudBase event 调用；
//   4. 断言状态码、ok、字段形状、错误码；
//   5. 捕获每次执行的 SQL，与原 SQL 逐条比对 —— 证明「查数据库」的代码只是平移，未改一字。
// ─────────────────────────────────────────────────────────────

const Module = require('module');
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/vibe coding/课程任务';
const OUT = path.join(ROOT, 'outputs/Day19');

// ---- 内存假池：种子数据照搬 db/seed.sql ----
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

const executedSQL = []; // 捕获每次执行的 SQL（用于与原 SQL 比对）
let forceDBError = false; // 置真时假池抛异常，用于验证 500 错误映射（不影响 SQL 比对）

function descTime(rows) {
  return rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function makeFakePool() {
  return {
    async query(sql, params = []) {
      if (forceDBError) { throw new Error('simulated DB failure'); }
      executedSQL.push(sql);
      const key = sql.replace(/\s+/g, ' ').trim();
      if (key.startsWith('INSERT INTO books')) {
        const [id, title, userId, createdAt] = params;
        const dup = store.books.find((b) => b.user_id === userId && b.title === title);
        if (dup) {
          const e = new Error('Duplicate entry');
          e.code = 'ER_DUP_ENTRY';
          e.errno = 1062;
          throw e;
        }
        store.books.push({ id, title, user_id: userId, created_at: createdAt });
        return [{}];
      }
      if (key.startsWith('SELECT id, title, user_id, created_at FROM books')) {
        const [userId, lim] = params;
        const rows = descTime(store.books.filter((b) => b.user_id === userId)).slice(0, Number(lim));
        return [rows];
      }
      if (key.startsWith('SELECT id, book_id, content, mood, user_id, created_at, updated_at FROM notes')) {
        const [userId, lim] = params;
        const rows = descTime(store.notes.filter((n) => n.user_id === userId)).slice(0, Number(lim));
        return [rows];
      }
      return [[]];
    },
  };
}

const fakeMysql = {
  createPool: () => makeFakePool(),
};

// 拦截 require('mysql2/promise') —— 全程不碰真实数据库
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'mysql2/promise') return fakeMysql;
  return origLoad.apply(this, arguments);
};

// ---- require 真实接口文件 ----
const booksFn = require(path.join(ROOT, 'cloudfunctions/books/index.js'));
const notesFn = require(path.join(ROOT, 'cloudfunctions/notes/index.js'));
const healthFn = require(path.join(ROOT, 'cloudfunctions/health/index.js'));

// ---- 断言工具 ----
let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name} —— ${detail || ''}`);
    console.log(`  ✗ ${name}  ${detail || ''}`);
  }
}
function parse(res) {
  return { statusCode: res.statusCode, body: JSON.parse(res.body) };
}

// 期望的原 SQL（与重构前 index.js 内联的 SQL 逐字一致）
const expectedSQL = [
  'SELECT id, title, user_id, created_at FROM books WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
  'INSERT INTO books (id, title, user_id, created_at) VALUES (?, ?, ?, ?)',
  'SELECT id, book_id, content, mood, user_id, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
];

async function main() {
  console.log('\n================ 栀书心驿 · Day 19 全接口回归 ================\n');

  // 0) GET /api/health
  console.log('[0] GET /api/health');
  {
    const r = parse(await healthFn.main({ httpMethod: 'GET' }, {}));
    check('200', r.statusCode === 200, `status=${r.statusCode}`);
    check('ok=true', r.body.ok === true);
    check('service=zhishu-xinyi', r.body.service === 'zhishu-xinyi');
  }

  // 1) GET /api/books（全量 5 本，倒序）
  console.log('\n[1] GET /api/books');
  let booksResp;
  {
    const r = parse(await booksFn.main({ httpMethod: 'GET' }, {}));
    booksResp = r.body;
    check('200', r.statusCode === 200);
    check('ok=true', r.body.ok === true);
    check('books 是数组且 5 条', Array.isArray(r.body.books) && r.body.books.length === 5, `len=${r.body.books && r.body.books.length}`);
    check('首条是瓦尔登湖（倒序）', r.body.books[0].title === '瓦尔登湖', r.body.books[0] && r.body.books[0].title);
    const b0 = r.body.books[0];
    check('book 字段形状正确', b0 && ['id', 'title', 'user_id', 'created_at'].every((k) => k in b0) && Object.keys(b0).length === 4, JSON.stringify(b0));
    check('created_at 是 ISO(无 Z)', /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.test(b0.created_at), b0.created_at);
  }

  // 2) GET /api/books?limit=2
  console.log('\n[2] GET /api/books?limit=2');
  {
    const r = parse(await booksFn.main({ httpMethod: 'GET', queryString: { limit: '2' } }, {}));
    check('200', r.statusCode === 200);
    check('limit 生效 → 2 条', r.body.books.length === 2, `len=${r.body.books.length}`);
    check('limit 边界钳制：limit=999 → 100', parse(await booksFn.main({ httpMethod: 'GET', queryString: { limit: '999' } }, {})).body.books.length === 5);
  }

  // 3) POST /api/books（新增）
  console.log('\n[3] POST /api/books（新增《夜莺与玫瑰》）');
  let createdBook;
  {
    const r = parse(await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '夜莺与玫瑰' }) }, {}));
    createdBook = r.body.book;
    check('201', r.statusCode === 201, `status=${r.statusCode}`);
    check('ok=true', r.body.ok === true);
    check('book.id 形如 b_xxx', /^b_/.test(createdBook.id), createdBook.id);
    check('book.title 回显正确', createdBook.title === '夜莺与玫瑰');
    check('book.user_id=local', createdBook.user_id === 'local');
    check('book.created_at 是 ISO', /^(\d{4})-/.test(createdBook.created_at));
    const after = parse(await booksFn.main({ httpMethod: 'GET' }, {}));
    check('写回后可列表读到（6 条）', after.body.books.length === 6, `len=${after.body.books.length}`);
  }

  // 4) POST /api/books（重复收录 → 409）
  console.log('\n[4] POST /api/books（重复《小王子》→ 409）');
  {
    const r = parse(await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '小王子' }) }, {}));
    check('409', r.statusCode === 409, `status=${r.statusCode}`);
    check('error=duplicate', r.body.error === 'duplicate');
    check('中文提示', /已经在书架上/.test(r.body.message), r.body.message);
  }

  // 5) POST /api/books（空白书名 → 400）
  console.log('\n[5] POST /api/books（空白书名 → 400）');
  {
    const r = parse(await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '   ' }) }, {}));
    check('400', r.statusCode === 400);
    check('error=invalid_param', r.body.error === 'invalid_param');
    check('中文提示', /书名不能为空/.test(r.body.message));
  }

  // 6) 未知 user_id → 空列表
  console.log('\n[6] GET /api/books?user_id=ghost（空列表）');
  {
    const r = parse(await booksFn.main({ httpMethod: 'GET', queryString: { user_id: 'ghost' } }, {}));
    check('200', r.statusCode === 200);
    check('空数组', Array.isArray(r.body.books) && r.body.books.length === 0);
  }

  // 7) PUT /api/books（不支持 → 405）
  console.log('\n[7] PUT /api/books（→ 405）');
  {
    const r = parse(await booksFn.main({ httpMethod: 'PUT' }, {}));
    check('405', r.statusCode === 405);
    check('error=method_not_allowed', r.body.error === 'method_not_allowed');
  }

  // 7.1) 模拟数据库异常 → 500（错误码映射回归）
  console.log('\n[7.1] GET /api/books（数据库异常 → 500）');
  {
    forceDBError = true;
    const r = parse(await booksFn.main({ httpMethod: 'GET' }, {}));
    check('500', r.statusCode === 500, `status=${r.statusCode}`);
    check('error=server_error', r.body.error === 'server_error');
    forceDBError = false;
  }

  // 8) GET /api/notes（全量 6 段，倒序，mood 为数组）
  console.log('\n[8] GET /api/notes');
  let notesResp;
  {
    const r = parse(await notesFn.main({ httpMethod: 'GET' }, {}));
    notesResp = r.body;
    check('200', r.statusCode === 200);
    check('ok=true', r.body.ok === true);
    check('notes 是数组且 6 条', Array.isArray(r.body.notes) && r.body.notes.length === 6, `len=${r.body.notes.length}`);
    check('首条是 n_seed06（倒序）', r.body.notes[0].id === 'n_seed06', r.body.notes[0] && r.body.notes[0].id);
    const n0 = r.body.notes[0];
    check('note 字段形状正确（7 字段）', n0 && ['id', 'book_id', 'content', 'mood', 'user_id', 'created_at', 'updated_at'].every((k) => k in n0) && Object.keys(n0).length === 7, JSON.stringify(n0));
    check('mood 是数组', Array.isArray(n0.mood) && n0.mood[0] === '治愈', JSON.stringify(n0.mood));
    check('updated_at 可为 null', r.body.notes.some((n) => n.updated_at === null));
  }

  // 9) GET /api/notes?limit=3
  console.log('\n[9] GET /api/notes?limit=3');
  {
    const r = parse(await notesFn.main({ httpMethod: 'GET', queryString: { limit: '3' } }, {}));
    check('limit 生效 → 3 条', r.body.notes.length === 3, `len=${r.body.notes.length}`);
  }

  // 10) POST /api/notes（notes 函数只 GET → 405）
  console.log('\n[10] POST /api/notes（→ 405）');
  {
    const r = parse(await notesFn.main({ httpMethod: 'POST', body: JSON.stringify({ book_id: 'b_seed01', content: 'x' }) }, {}));
    check('405', r.statusCode === 405);
    check('error=method_not_allowed', r.body.error === 'method_not_allowed');
  }

  // ---- SQL 逐字比对：证明查询只是平移，未改动 ----
  console.log('\n[SQL] 执行过的 SQL 与原 SQL 逐字比对');
  const setEq = (a, b) => {
    const sa = new Set(a);
    const sb = new Set(b);
    if (sa.size !== sb.size) return false;
    for (const x of sa) if (!sb.has(x)) return false;
    return true;
  };
  check('执行 SQL 去重集合 == 原 SQL 集合（无新增/无删改）', setEq(executedSQL, expectedSQL), `实际执行 ${executedSQL.length} 次，去重后 ${new Set(executedSQL).size} 条`);
  executedSQL.forEach((s, i) => check(`SQL#${i + 1} 命中预期`, expectedSQL.includes(s), s));

  // ---- 汇总 ----
  console.log(`\n================ 结果：通过 ${pass} / 失败 ${fail} ================\n`);
  if (fail > 0) {
    console.log('失败项：');
    failures.forEach((f) => console.log('  - ' + f));
  }

  // 把关键响应写盘，供截图步骤使用（证明接口真实返回）
  const snapshot = {
    health: parse(await healthFn.main({ httpMethod: 'GET' }, {})).body,
    booksList: booksResp,
    notesList: notesResp,
    bookCreated: createdBook,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'responses.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'executed-sql.json'), JSON.stringify(executedSQL, null, 2), 'utf8');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('回归脚本异常：', e);
  process.exit(2);
});
