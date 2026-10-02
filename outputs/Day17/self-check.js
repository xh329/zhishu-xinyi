'use strict';

// 栀书心驿 · Day 17 本地自检
// 真实执行两个云函数（用 mock 的 mysql2 注入假数据），验证：
//   1) SQL 读的是正确的表、参数化（user_id / limit 都走 ? 占位）
//   2) 响应形状 {ok, books/notes} 与契约一致
//   3) 405 / 500 错误路径正确
//   4) DATETIME→ISO 转换、mood JSON 解析正确（"对不上"的地方已补齐）
// 不依赖任何真实数据库，纯 Node 即可跑。

const Module = require('module');
const assert = require('assert');

const ROOT = 'D:/vibe coding/课程任务';

// ---- mock mysql2/promise ----
let calls = [];
let forceError = false;

const fakePool = {
  async query(sql, params) {
    calls.push({ sql, params: params || [] });
    if (forceError) throw new Error('mock DB down');

    let rows = [];
    if (sql.includes('FROM books')) {
      rows = [
        { id: 'b_seed01', title: '小王子', user_id: 'local', created_at: new Date('2026-09-28T09:10:00') },
        { id: 'b_seed02', title: '被讨厌的勇气', user_id: 'local', created_at: new Date('2026-09-28T21:35:00') },
        { id: 'b_seed03', title: '人间值得', user_id: 'local', created_at: new Date('2026-09-29T08:05:00') },
        { id: 'b_seed04', title: '夜航西飞', user_id: 'local', created_at: new Date('2026-09-30T22:50:00') },
        { id: 'b_seed05', title: '瓦尔登湖', user_id: 'local', created_at: new Date('2026-10-01T07:20:00') },
      ];
    } else if (sql.includes('FROM notes')) {
      rows = [
        { id: 'n_seed01', book_id: 'b_seed01', content: '长大后才懂，玫瑰的骄傲不过是怕被辜负。', mood: ['触动'], user_id: 'local', created_at: new Date('2026-09-28T10:00:00'), updated_at: null },
        { id: 'n_seed02', book_id: 'b_seed01', content: '把重要的事，每天看一眼，就不会弄丢。', mood: ['温暖'], user_id: 'local', created_at: new Date('2026-09-29T09:30:00'), updated_at: new Date('2026-09-29T09:45:00') },
        { id: 'n_seed03', book_id: 'b_seed02', content: '被讨厌不是终点，自由才是。', mood: ['思索'], user_id: 'local', created_at: new Date('2026-09-29T08:20:00'), updated_at: null },
        { id: 'n_seed04', book_id: 'b_seed03', content: '人生不必太用力，坦率接受每一天就好。', mood: ['平静'], user_id: 'local', created_at: new Date('2026-09-30T07:15:00'), updated_at: null },
        { id: 'n_seed05', book_id: 'b_seed04', content: '她独自飞越非洲的夜，孤独里全是辽阔。', mood: ['轻盈'], user_id: 'local', created_at: new Date('2026-10-01T08:00:00'), updated_at: null },
        { id: 'n_seed06', book_id: 'b_seed05', content: '在湖边独处，才听见自己真正想要什么。', mood: ['治愈'], user_id: 'local', created_at: new Date('2026-10-01T09:10:00'), updated_at: null },
      ];
    }

    // 让 mock 也真正执行 LIMIT ?（真实 MySQL 会做切片，这里模拟以便端到端验证条数限制）
    if (sql.toUpperCase().includes('LIMIT ?') && params.length) {
      const lim = Number(params[params.length - 1]);
      if (Number.isFinite(lim)) rows = rows.slice(0, lim);
    }
    return [rows];
  },
};

const mockMysql2 = { createPool: () => fakePool };

// 注入 mock：拦截对 'mysql2/promise' 的 require
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'mysql2/promise') return mockMysql2;
  return origRequire.apply(this, arguments);
};

const booksFn = require(ROOT + '/cloudfunctions/books/index.js');
const notesFn = require(ROOT + '/cloudfunctions/notes/index.js');

async function run() {
  // 1) GET /api/books 默认
  calls = [];
  let r = await booksFn.main({ httpMethod: 'GET', queryString: {} }, {});
  let body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.books.length, 5);
  assert.strictEqual(body.books[0].title, '小王子');
  assert.strictEqual(body.books[0].created_at, '2026-09-28T09:10:00', 'DATETIME→ISO 应正确');
  assert.ok(calls[0].sql.includes('FROM books'), '应读 books 表');
  assert.ok(calls[0].sql.includes('user_id = ?'), 'user_id 必须参数化');
  assert.deepStrictEqual(calls[0].params, ['local', 100], '默认参数应 [local,100]');

  // 2) GET /api/books?limit=3
  calls = [];
  r = await booksFn.main({ httpMethod: 'GET', queryString: { user_id: 'local', limit: '3' } }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(body.books.length, 3);
  assert.deepStrictEqual(calls[0].params, ['local', 3]);

  // 3) POST /api/books → 405（今天不做写）
  r = await booksFn.main({ httpMethod: 'POST', queryString: {} }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 405);
  assert.strictEqual(body.error, 'method_not_allowed');

  // 4) GET /api/notes 默认
  calls = [];
  r = await notesFn.main({ httpMethod: 'GET', queryString: {} }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.notes.length, 6);
  assert.deepStrictEqual(body.notes[0].mood, ['触动'], 'mood JSON 应解析为数组');
  assert.strictEqual(body.notes[0].created_at, '2026-09-28T10:00:00');
  assert.strictEqual(body.notes[1].updated_at, '2026-09-29T09:45:00', 'updated_at 非 null 也要转 ISO');
  assert.ok(calls[0].sql.includes('FROM notes'), '应读 notes 表');
  assert.ok(calls[0].sql.includes('mood'), '应 SELECT mood 列');
  assert.deepStrictEqual(calls[0].params, ['local', 100]);

  // 5) GET /api/notes?limit=2
  calls = [];
  r = await notesFn.main({ httpMethod: 'GET', queryString: { limit: '2' } }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(body.notes.length, 2);
  assert.deepStrictEqual(calls[0].params, ['local', 2]);

  // 6) DB 异常 → 500 server_error
  forceError = true;
  r = await notesFn.main({ httpMethod: 'GET', queryString: {} }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 500);
  assert.strictEqual(body.error, 'server_error');
  forceError = false;

  console.log('✅ self-check 全部通过：');
  console.log('   GET /api/books → 读 books 表，参数化 [user_id,limit]，{ok,books}，DATETIME→ISO 正确');
  console.log('   GET /api/notes → 读 notes 表，mood→数组、updated_at→ISO，参数化正确');
  console.log('   非 GET → 405；DB 异常 → 500');
}

run().catch((e) => { console.error('❌ self-check 失败:', e.message); process.exit(1); });
