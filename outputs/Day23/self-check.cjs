'use strict';
/* 栀书心驿 · Day 23 自检：三类错误提示统一 + 服务端错误说明
 * ─────────────────────────────────────────────────────────────
 * 两件事：
 *   A) 前端 js/api.js 的 friendlyError()：把「裸报错」翻成三类中文人话，
 *      并打印「改之前 / 改之后」对照，证明英文原文与状态码黑话不再外泄。
 *   B) 云函数 405 / 500 现在都带中文 message（服务端错也给人话）。
 * 运行：node outputs/Day23/self-check.cjs
 */
const path = require('path');
const fs = require('fs');
const Module = require('module');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✓ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + '  ' + (extra || '')); }
}
function hasChinese(s) { return /[\u4e00-\u9fa5]/.test(String(s || '')); }
function hasLatinWord(s) { return /[A-Za-z]{3,}/.test(String(s || '')); } // 有连续英文词=疑似未翻译

/* ================= A) 前端 friendlyError ================= */
console.log('\n[A] 前端：裸报错 → 三类中文人话（js/api.js）');
const sandbox = {};
sandbox.window = {};
sandbox.window.ZhiShu = {};
new Function('window', fs.readFileSync(path.join(__dirname, '../../js/api.js'), 'utf8'))(sandbox.window);
const Z = sandbox.window.ZhiShu;
check('api.js 暴露了 Z.friendlyError', typeof Z.friendlyError === 'function');

const cases = [
  {
    name: '网络错（浏览器英文原文 Failed to fetch）',
    err: Object.assign(new TypeError('Failed to fetch'), { code: 'network' }),
    before: 'Failed to fetch',
    kind: 'network',
  },
  {
    name: '服务端错（旧代码：请求失败（500））',
    err: Object.assign(new Error('http_500'), { status: 500, code: 'server_error', serverMessage: '' }),
    before: '请求失败（500）',
    kind: 'server',
  },
  {
    name: '输入错（参数非法，服务端未给说明）',
    err: Object.assign(new Error('http_400'), { status: 400, code: 'invalid_param', serverMessage: '' }),
    before: '请求失败（400）',
    kind: 'input',
  },
  {
    name: '输入错（服务端已给中文说明，原样保留）',
    err: Object.assign(new Error('x'), { status: 409, code: 'duplicate', serverMessage: '这本书已经在书架上了，无需重复收录' }),
    before: '这本书已经在书架上了，无需重复收录',
    kind: 'input',
  },
  {
    name: '资源不存在（404 not_found → 中文）',
    err: Object.assign(new Error('x'), { status: 404, code: 'not_found', serverMessage: '这段心得好像不在了，也许已经被收起。回「心迹」看看别的吧。' }),
    before: 'not_found',
    kind: 'input',
  },
];

console.log('\n  ── 改之前（裸报错） → 改之后（人话） ──');
cases.forEach((c) => {
  const f = Z.friendlyError(c.err);
  console.log(`  · ${c.name}`);
  console.log(`      改前：${c.before}`);
  console.log(`      改后：[${f.label}] ${f.message}`);
  check(`  归类正确（${c.kind}）`, f.kind === c.kind, `→ ${f.kind}`);
  check(`  含中文、无英文残留`, hasChinese(f.message) && !hasLatinWord(f.message));
});

/* ================= B) 云函数 405 / 500 中文说明 ================= */
console.log('\n[B] 云函数：405 / 500 都带中文说明');

// 用可变替身接管 repository，避免真连数据库
let listNotesFail = false, listBooksFail = false;
const origLoad = Module._load;
Module._load = function (request, parent) {
  if (parent && /cloudfunctions[\\/]notes[\\/]index\.js$/.test(parent.filename || '')) {
    if (request === './notesRepository') {
      return {
        listNotes: async () => { if (listNotesFail) throw new Error('db down'); return []; },
        findNote: async () => null, updateNote: async () => 0, removeNote: async () => 0,
      };
    }
  }
  if (parent && /cloudfunctions[\\/]books[\\/]index\.js$/.test(parent.filename || '')) {
    if (request === './booksRepository') {
      return {
        listBooks: async () => { if (listBooksFail) throw new Error('db down'); return []; },
        createBook: async () => ({ id: 'b_x', title: 't', user_id: 'local', created_at: '2026-10-09T00:00:00' }),
      };
    }
  }
  return origLoad.apply(this, arguments);
};

// 静音云函数里的 console.log（[req] 日志），只保留断言输出
const realLog = console.log;
console.log = () => {};
const notes = require(path.join(__dirname, '../../cloudfunctions/notes/index.js'));
const books = require(path.join(__dirname, '../../cloudfunctions/books/index.js'));
const health = require(path.join(__dirname, '../../cloudfunctions/health/index.js'));
console.log = realLog;

(async () => {
  const r405n = await notes.main({ httpMethod: 'POST', path: '/api/notes', headers: {} });
  const b405n = JSON.parse(r405n.body);
  check('notes 405 带中文 message', r405n.statusCode === 405 && hasChinese(b405n.message), b405n.message);

  const r405b = await books.main({ httpMethod: 'DELETE', path: '/api/books', headers: {} });
  const b405b = JSON.parse(r405b.body);
  check('books 405 带中文 message', r405b.statusCode === 405 && hasChinese(b405b.message), b405b.message);

  const r405h = await health.main({ httpMethod: 'POST', path: '/api/health', headers: {} });
  const b405h = JSON.parse(r405h.body);
  check('health 405 带中文 message', r405h.statusCode === 405 && hasChinese(b405h.message), b405h.message);

  listNotesFail = true;
  const r500n = await notes.main({ httpMethod: 'GET', path: '/api/notes', headers: {} });
  const b500n = JSON.parse(r500n.body);
  check('notes 500 带中文 message', r500n.statusCode === 500 && b500n.error === 'server_error' && hasChinese(b500n.message), b500n.message);

  listBooksFail = true;
  const r500b = await books.main({ httpMethod: 'GET', path: '/api/books', headers: {} });
  const b500b = JSON.parse(r500b.body);
  check('books 500 带中文 message', r500b.statusCode === 500 && hasChinese(b500b.message), b500b.message);

  console.log(`\n================ 结果：通过 ${pass} / 失败 ${fail} ================`);
  process.exit(fail ? 1 : 0);
})();
