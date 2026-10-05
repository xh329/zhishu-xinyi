// 栀书心驿 · 健康检查云函数（CloudBase 云函数 · Node.js）
// 文件位置：cloudfunctions/health/index.js
//
// 职责（Day 15 唯一目标）：
//   1. 仅响应 GET /api/health；
//   2. 不连数据库、不写任何业务逻辑；
//   3. 返回固定 JSON：{ "ok": true, "service": "zhishu-xinyi" }。
//
// 这是上云后的第一个函数，也是后续真实业务接口（建表、读写）的占位与探路。
// CloudBase 云函数通过「HTTP 触发」对外暴露：event 携带请求信息，
// 返回值需是标准 HTTP 响应对象 { statusCode, headers, body }。
//
// Day 20：补上 CORS（此前缺失），且只允许白名单来源（ALLOWED_ORIGIN 环境变量），禁止 *。

'use strict';

// 统一 CORS 头：白名单来自环境变量 ALLOWED_ORIGIN（逗号/空格分隔）。命中才回 ACAO，否则不带。
let CORS_HEADERS = {};
function corsHeaders(event) {
  const headers = (event && event.headers) || {};
  const origin = headers.origin || headers.Origin || '';
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const base = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (allowed.indexOf(origin) !== -1) base['Access-Control-Allow-Origin'] = origin;
  return base;
}
function setCors(event) { CORS_HEADERS = corsHeaders(event); }

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    body: JSON.stringify(obj),
  };
}

exports.main = async (event, context) => {
  setCors(event); // Day 20：按白名单计算 CORS 头

  const method = (event.httpMethod || 'GET').toUpperCase();

  // 浏览器跨域预检
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // 只接受 GET，其他方法礼貌回 405（方法不被允许）
  if (method !== 'GET') {
    return json(405, {
      ok: false,
      error: 'method_not_allowed',
      service: 'zhishu-xinyi',
    });
  }

  // 健康检查：固定返回，证明服务在线、路由可达
  return json(200, {
    ok: true,
    service: 'zhishu-xinyi',
  });
};
