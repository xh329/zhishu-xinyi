'use strict';

// 栀书心驿 · Day 18 本地自检
// 真实执行 cloudfunctions/books/index.js（用「有状态」的 mock mysql2 注入内存 books 表），
// 验证 Day 18 的 POST /api/books 写入接口：
//   1) 正常 POST  → 201 { ok:true, book:{...} }，且内存表真的 +1 行（「数据库多一行」）
//   2) 重复提交   → 409 { ok:false, error:'duplicate', message 中文 }（命中 UNIQUE(user_id,title)）
//   3) 缺必填字段 → 400 { ok:false, error:'invalid_param', message:'书名不能为空' }（中文提示）
//   4) 空白书名   → 同样 400 被拒
//   5) 写入 + 读回 → POST 后再 GET /api/books，新写入的书能被读出来
//   6) INSERT 语句参数化（title/user_id 等走 ? 占位，杜绝注入）
// 不依赖任何真实数据库，纯 Node 即可跑。

const Module = require('module');
const assert = require('assert');

const ROOT = 'D:/vibe coding/课程任务';

// ---- 有状态的内存 books 表（预置 5 本种子书，与 db/seed.sql 同款） ----
const seedBooks = [
  { id: 'b_seed01', title: '小王子',       user_id: 'local', created_at: new Date('2026-09-28T09:10:00') },
  { id: 'b_seed02', title: '被讨厌的勇气', user_id: 'local', created_at: new Date('2026-09-28T21:35:00') },
  { id: 'b_seed03', title: '人间值得',     user_id: 'local', created_at: new Date('2026-09-29T08:05:00') },
  { id: 'b_seed04', title: '夜航西飞',     user_id: 'local', created_at: new Date('2026-09-30T22:50:00') },
  { id: 'b_seed05', title: '瓦尔登湖',     user_id: 'local', created_at: new Date('2026-10-01T07:20:00') },
];
let books = seedBooks.map((b) => ({ ...b }));
let lastInsert = null;          // 最近一次 INSERT 的 { sql, params }（含被拒的重复写入）
let lastSuccessfulInsert = null; // 真正写入成功的 INSERT（用于参数化校验）

const fakePool = {
  async query(sql, params) {
    // ---- INSERT INTO books：写入一条，先做去重判断 ----
    if (sql.toUpperCase().includes('INSERT INTO BOOKS')) {
      lastInsert = { sql, params: params || [] };
      const [id, title, userId, createdAt] = lastInsert.params;
      const dup = books.some((b) => b.user_id === userId && b.title === title);
      if (dup) {
        // 模拟 MySQL 唯一键冲突
        const e = new Error('Duplicate entry');
        e.code = 'ER_DUP_ENTRY';
        e.errno = 1062;
        throw e;
      }
      books.push({ id, title, user_id: userId, created_at: createdAt });
      lastSuccessfulInsert = { sql, params: lastInsert.params };
      return [{ affectedRows: 1, insertId: id }];
    }

    // ---- SELECT ... FROM books：列表读取（过滤 + 排序 + 限制） ----
    if (sql.toUpperCase().includes('FROM BOOKS')) {
      const userId = params[0];
      const limit = Number(params[1]);
      const rows = books
        .filter((b) => b.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, Number.isFinite(limit) ? limit : 100);
      return [rows];
    }

    return [[]];
  },
};

const mockMysql2 = { createPool: () => fakePool };

// 拦截对 'mysql2/promise' 的 require，注入 mock（不影响真实云函数代码）
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'mysql2/promise') return mockMysql2;
  return origRequire.apply(this, arguments);
};

const booksFn = require(ROOT + '/cloudfunctions/books/index.js');

async function run() {
  const NEW_TITLE = 'Day18 验证之书（可删）';

  // 1) 正常 POST：新增一本不存在的书
  let r = await booksFn.main(
    { httpMethod: 'POST', body: JSON.stringify({ title: NEW_TITLE }) },
    {}
  );
  let body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 201, '正常 POST 应返回 201');
  assert.strictEqual(body.ok, true, '成功响应 ok 应为 true');
  assert.ok(body.book && body.book.id.startsWith('b_'), 'book.id 应为 b_ 前缀');
  assert.strictEqual(body.book.title, NEW_TITLE, 'book.title 应回显录入的书名');
  assert.strictEqual(body.book.user_id, 'local', 'book.user_id 应为 local');
  assert.ok(body.book.created_at.includes('T'), 'book.created_at 应为 ISO 字符串');
  assert.strictEqual(books.length, 6, '内存 books 表应由 5 行变为 6 行（数据库多一行）');
  console.log('✅ 正常 POST：', JSON.stringify(body));

  // 2) 重复提交：再收录一本已存在的种子书（小王子）→ 应被拒
  const before = books.length;
  r = await booksFn.main(
    { httpMethod: 'POST', body: JSON.stringify({ title: '小王子' }) },
    {}
  );
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 409, '重复提交应返回 409');
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error, 'duplicate', '重复错误码应为 duplicate');
  assert.ok(/书架/.test(body.message), '重复提示应含「书架」且为中文: ' + body.message);
  assert.strictEqual(books.length, before, '重复提交不应新增行');
  console.log('✅ 重复提交被拒：', JSON.stringify(body));

  // 3) 缺必填字段：不传 title → 400 中文提示
  r = await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({}) }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 400, '缺 title 应返回 400');
  assert.strictEqual(body.error, 'invalid_param', '错误码应为 invalid_param');
  assert.strictEqual(body.message, '书名不能为空', '缺失提示应为「书名不能为空」');
  console.log('✅ 缺字段被拒：', JSON.stringify(body));

  // 4) 空白书名：只传空格 → 同样被拒（trim 后为空）
  r = await booksFn.main({ httpMethod: 'POST', body: JSON.stringify({ title: '   ' }) }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(body.message, '书名不能为空');
  console.log('✅ 空白书名被拒：', JSON.stringify(body));

  // 5) 写入 + 读回：GET /api/books 应能看到刚写入的那本
  r = await booksFn.main({ httpMethod: 'GET', queryString: {} }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.books.length, 6, '读回应包含全部 6 本');
  const found = body.books.find((b) => b.title === NEW_TITLE);
  assert.ok(found, '刚写入的书应能被 GET 读出来');
  assert.ok(found.created_at.includes('T'), '读回的 created_at 应为 ISO');
  console.log('✅ 写入后读回：在 GET /api/books 中找到新行', JSON.stringify(found));

  // 6) INSERT 语句参数化校验
  assert.ok(lastSuccessfulInsert.sql.toUpperCase().includes('INSERT INTO BOOKS'), '应执行 INSERT INTO books');
  assert.ok(lastSuccessfulInsert.sql.includes('?'), 'SQL 应使用 ? 占位（参数化）');
  assert.strictEqual(lastSuccessfulInsert.params[1], NEW_TITLE, 'title 应以参数传入，而非拼进 SQL');
  console.log('✅ INSERT 参数化：', lastSuccessfulInsert.sql, 'params=', JSON.stringify(lastSuccessfulInsert.params));

  // 7) 其他方法（PUT）→ 405，确保不越界到本周未做的接口
  r = await booksFn.main({ httpMethod: 'PUT', body: '{}' }, {});
  body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 405);
  assert.strictEqual(body.error, 'method_not_allowed');
  console.log('✅ PUT 等非本周方法 → 405 method_not_allowed');

  console.log('\n🎉 self-check 全部通过：POST /api/books 写入接口逻辑正确（正常 / 重复 / 缺字段 / 写入读回 / 参数化 / 方法边界）。');
}

run().catch((e) => {
  console.error('❌ self-check 失败:', e.message);
  process.exit(1);
});
