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

'use strict';

exports.main = async (event, context) => {
  // event.httpMethod：请求方法（CloudBase HTTP 触发会注入）
  const method = (event.httpMethod || 'GET').toUpperCase();

  // 只接受 GET，其他方法礼貌回 405（方法不被允许）
  if (method !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        error: 'method_not_allowed',
        service: 'zhishu-xinyi',
      }),
    };
  }

  // 健康检查：固定返回，证明服务在线、路由可达
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      ok: true,
      service: 'zhishu-xinyi',
    }),
  };
};
