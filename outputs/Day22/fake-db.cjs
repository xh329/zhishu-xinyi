'use strict';

/* 栀书心驿 · Day 22 验证用的「内存数据库替身」
 * ─────────────────────────────────────────────────────────────
 * 用途：在没有 CloudBase 凭据、也没有真实 MySQL 的环境里，让 outputs/Day22 下的
 *       回归脚本与本地联调服务**真实执行** cloudfunctions/ 里的云函数代码。
 *
 * 做法：拦截 Node 的 require，把 'mysql2/promise' 换成一个内存假连接池，
 *       假池按 SQL 文本分流，操作一张内存表（种子数据照搬 db/seed.sql）。
 * 边界（诚实标注）：这是**替身**，证明的是「接口代码对」，不等于「线上通」。
 *       真实库验证方法见 outputs/Day22/部署与验证.md 第三、四节。
 * ─────────────────────────────────────────────────────────────
 */

const Module = require('module');

// ---- 种子数据（照搬 db/seed.sql，mood 以 JSON 串形态保存，由 db.js 的 shapeNote 解析回数组）----
const books = [
  { id: 'b_seed01', title: '小王子', user_id: 'local', created_at: '2026-09-28 09:10:00' },
  { id: 'b_seed02', title: '被讨厌的勇气', user_id: 'local', created_at: '2026-09-28 21:35:00' },
  { id: 'b_seed03', title: '人间值得', user_id: 'local', created_at: '2026-09-29 08:05:00' },
  { id: 'b_seed04', title: '夜航西飞', user_id: 'local', created_at: '2026-09-30 22:50:00' },
  { id: 'b_seed05', title: '瓦尔登湖', user_id: 'local', created_at: '2026-10-01 07:20:00' },
];

const notes = [
  { id: 'n_seed01', book_id: 'b_seed01', content: '长大后才懂，玫瑰的骄傲不过是怕被辜负。', mood: '["触动"]', user_id: 'local', created_at: '2026-09-28 10:00:00', updated_at: null },
  { id: 'n_seed02', book_id: 'b_seed01', content: '把重要的事，每天看一眼，就不会弄丢。', mood: '["温暖"]', user_id: 'local', created_at: '2026-09-29 09:30:00', updated_at: '2026-09-29 09:45:00' },
  { id: 'n_seed03', book_id: 'b_seed02', content: '被讨厌不是终点，自由才是。', mood: '["思索"]', user_id: 'local', created_at: '2026-09-29 08:20:00', updated_at: null },
  { id: 'n_seed04', book_id: 'b_seed03', content: '人生不必太用力，坦率接受每一天就好。', mood: '["平静"]', user_id: 'local', created_at: '2026-09-30 07:15:00', updated_at: null },
  { id: 'n_seed05', book_id: 'b_seed04', content: '她独自飞越非洲的夜，孤独里全是辽阔。', mood: '["轻盈"]', user_id: 'local', created_at: '2026-10-01 08:00:00', updated_at: null },
  { id: 'n_seed06', book_id: 'b_seed05', content: '在湖边独处，才听见自己真正想要什么。', mood: '["治愈"]', user_id: 'local', created_at: '2026-10-01 09:10:00', updated_at: null },
];

const executedSQL = []; // 每次执行的 SQL 原文（用于"参数化"断言）
const executedParams = []; // 每次执行的参数（用于证明值不在 SQL 文本里）
let forceDBError = false;

const NOTE_COLS = 'id, book_id, content, mood, user_id, created_at, updated_at';

function descByCreated(rows) {
  return rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

// 拆 SET 子句：只取列名（本项目的列名全部来自仓库白名单），值一律从 params 里按序取
function applyUpdate(sql, params) {
  const setPart = sql.replace(/\s+/g, ' ').match(/UPDATE notes SET (.+?) WHERE id = \?/i);
  if (!setPart) return 0;
  const cols = setPart[1].split(',').map((s) => s.trim().split('=')[0].trim());
  const values = params.slice(0, cols.length);
  const id = params[params.length - 1];
  const row = notes.find((n) => n.id === id);
  if (!row) return 0;
  cols.forEach((c, i) => { row[c] = values[i]; });
  return 1;
}

function query(sql, params = []) {
  if (forceDBError) throw new Error('simulated DB failure');
  executedSQL.push(sql);
  executedParams.push(params);

  const key = sql.replace(/\s+/g, ' ').trim();

  if (/^INSERT INTO books/i.test(key)) {
    const [id, title, userId, createdAt] = params;
    if (books.find((b) => b.user_id === userId && b.title === title)) {
      const e = new Error('Duplicate entry'); e.code = 'ER_DUP_ENTRY'; e.errno = 1062; throw e;
    }
    books.push({ id, title, user_id: userId, created_at: createdAt });
    return [{ affectedRows: 1 }];
  }
  if (new RegExp('^SELECT .* FROM books WHERE user_id = \\? ORDER BY created_at DESC LIMIT \\?$').test(key)) {
    const [userId, limit] = params;
    return [descByCreated(books.filter((b) => b.user_id === userId)).slice(0, Number(limit))];
  }
  if (new RegExp('^SELECT ' + NOTE_COLS + ' FROM notes WHERE user_id = \\? ORDER BY created_at DESC LIMIT \\?$').test(key)) {
    const [userId, limit] = params;
    return [descByCreated(notes.filter((n) => n.user_id === userId)).slice(0, Number(limit))];
  }
  if (new RegExp('^SELECT ' + NOTE_COLS + ' FROM notes WHERE id = \\? LIMIT 1$').test(key)) {
    const row = notes.find((n) => n.id === params[0]);
    return [row ? [row] : []];
  }
  if (/^UPDATE notes SET /i.test(key)) {
    return [{ affectedRows: applyUpdate(sql, params) }];
  }
  if (/^DELETE FROM notes WHERE id = \?$/i.test(key)) {
    const i = notes.findIndex((n) => n.id === params[0]);
    if (i === -1) return [{ affectedRows: 0 }];
    notes.splice(i, 1);
    return [{ affectedRows: 1 }];
  }
  return [[]];
}

// 拦住 require('mysql2/promise') —— 全程不碰真实数据库
function install() {
  const fakeMysql = {
    createPool: () => ({ query: async (sql, params) => query(sql, params) }),
  };
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'mysql2/promise') return fakeMysql;
    return origLoad.apply(this, arguments);
  };
  return {
    store: { books, notes },
    executedSQL,
    executedParams,
    setForceError: (v) => { forceDBError = v; },
  };
}

module.exports = { install, store: { books, notes }, executedSQL };
