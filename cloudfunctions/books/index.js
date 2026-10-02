'use strict';

// 栀书心驿 · 书籍列表读取云函数（GET /api/books）
// 核心表 books 的「列表读取」接口（Day 17 实现 · 对应 api-contract.md 第 2 项）
// 部署位置：cloudfunctions/books/
//
// CloudBase HTTP 触发：event 携带请求信息，返回值须为标准 HTTP 响应 { statusCode, headers, body }。
// 今日只做读，不做写：收到非 GET 一律 405（POST /api/books 留到 Day 18）。

const { getPool, shapeBook } = require('./db');

// 统一 CORS 头（原契约约定 Day 16–20 随真实接口处理；Day 17 落地真实接口即补上）
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

exports.main = async (event, context) => {
  // 浏览器跨域预检
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  // 只接受 GET；其他方法礼貌回 405（方法不被允许）
  if ((event.httpMethod || 'GET').toUpperCase() !== 'GET') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

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
    console.error('[books] GET /api/books failed:', err);
    return json(500, { ok: false, error: 'server_error' });
  }
};
