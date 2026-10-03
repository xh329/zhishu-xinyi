'use strict';

// 栀书心驿 · 书籍云函数（GET 列表 / POST 新增）
// GET  /api/books  → 书籍列表（书架）       api-contract.md 第 2 项（Day 17 实现）
// POST /api/books  → 新增书籍（录入书名）   api-contract.md 第 1 项（Day 18 实现）
// 部署位置：cloudfunctions/books/
//
// CloudBase HTTP 触发：event 携带请求信息，返回值须为标准 HTTP 响应 { statusCode, headers, body }。
// 一个函数同时承载 GET（列表读取）与 POST（写入），对应契约里同路径的不同方法。

const { getPool, shapeBook } = require('./db');

// 统一 CORS 头（原契约约定 Day 16–20 随真实接口处理；Day 17 落地真实接口即补上）
// Day 18 新增 POST：方法白名单补上 POST，否则浏览器跨域写入会被拦。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
    body: JSON.stringify(obj),
  };
}

// 从 CloudBase event 里尽量稳妥地取出查询参数（不同版本字段名可能不同）
function getQuery(event) {
  return event.queryString || event.queryStringParameters || event.queryParameters || {};
}

// 尽量稳妥地取出并解析请求体（CloudBase HTTP 触发把 JSON 体放在 event.body）
function parseBody(event) {
  const raw = event.body;
  if (!raw) return {};
  if (typeof raw === 'object') return raw; // 某些运行环境已预先解析成对象
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

// Date → MySQL DATETIME('YYYY-MM-DD HH:MM:SS')，用本地时间（与 db.toISO 对称，不加 Z）
function toMySQLDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// 生成业务主键 b_xxx（时间戳 36 进制 + 随机串），与契约 id 形态一致、便于排查
function genBookId() {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

exports.main = async (event, context) => {
  // 浏览器跨域预检
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const method = (event.httpMethod || 'GET').toUpperCase();

  // ---------- POST /api/books：新增书籍（F2 录入书名） ----------
  if (method === 'POST') {
    let body;
    try {
      body = parseBody(event);
    } catch (_) {
      return json(400, { ok: false, error: 'invalid_param', message: '请求体格式不正确' });
    }

    // 必填校验：书名（手动录入，不能为空）
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      console.warn('[books] POST /api/books 校验失败：书名不能为空');
      return json(400, { ok: false, error: 'invalid_param', message: '书名不能为空' });
    }

    const id = genBookId();
    const userId = 'local'; // MVP 固定 local；上云后由登录态提供真实用户
    const now = new Date();
    const createdAt = toMySQLDate(now); // 存 DATETIME；响应层再转 ISO 字符串

    try {
      const pool = getPool();
      // 参数化 INSERT，杜绝 SQL 注入
      await pool.query(
        'INSERT INTO books (id, title, user_id, created_at) VALUES (?, ?, ?, ?)',
        [id, title, userId, createdAt]
      );
      // 余力加练：写一条服务端日志，方便以后排查写入问题
      console.log('[books] POST /api/books 新增成功', { id, title, user_id: userId, created_at: createdAt });
      // 响应形状严格对齐契约第 1 项：{ ok:true, book:{ id,title,user_id,created_at } }
      const book = shapeBook({ id, title, user_id: userId, created_at: now });
      return json(201, { ok: true, book });
    } catch (err) {
      // 同一用户重复收录同一书名 → 命中 UNIQUE(user_id,title) → 拒绝，并给中文提示
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        console.warn('[books] POST /api/books 重复收录被拒', { title, user_id: userId });
        return json(409, { ok: false, error: 'duplicate', message: '这本书已经在书架上了，无需重复收录' });
      }
      console.error('[books] POST /api/books 写入失败', err);
      return json(500, { ok: false, error: 'server_error' });
    }
  }

  // ---------- GET /api/books：书籍列表（书架） ----------
  if (method === 'GET') {
    try {
      const pool = getPool();
      const qs = getQuery(event);
      // 可选查询参数：user_id（上云后由登录态提供）；不传则读 local 的全部书
      const userId = qs.user_id || 'local';
      // 余力加练：limit 返回条数限制，做边界钳制，避免超大或非法值
      const limit = qs.limit
        ? Math.max(1, Math.min(100, parseInt(qs.limit, 10) || 100))
        : 100;

      // 参数化查询：user_id、limit 都用 ? 占位，杜绝 SQL 注入
      const [rows] = await pool.query(
        'SELECT id, title, user_id, created_at FROM books WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, limit]
      );
      return json(200, { ok: true, books: rows.map(shapeBook) });
    } catch (err) {
      // 真实异常打到云函数日志，对客户端只给稳定错误码
      console.error('[books] GET /api/books 读取失败', err);
      return json(500, { ok: false, error: 'server_error' });
    }
  }

  // 其他方法（PUT/DELETE 等留到第 4 周）→ 405 方法不被允许
  return json(405, { ok: false, error: 'method_not_allowed' });
};
