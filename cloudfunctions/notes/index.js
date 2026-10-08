'use strict';

// 栀书心驿 · 心得云函数（GET 列表 / PATCH 改写 / DELETE 删除）
// ─────────────────────────────────────────────────────────────
// 分层（Day 19 重构，Day 22 新接口沿用同一分层）：
//   · 接口层（本文件）：接请求、做校验、调 repository、包响应、转错误码——不写一行 SQL；
//   · 数据访问层：cloudfunctions/notes/notesRepository.js（所有 SQL 都在这里）；
//   · 基础设施层：cloudfunctions/notes/db.js（连接池 + 行→契约形状映射）。
// 接口清单：
//   GET    /api/notes        → 全部心得列表       api-contract.md 第 6 项 ★（Day 17 实现）
//   PATCH  /api/notes/:id    → 局部改写一条心得   api-contract.md 第 7 项（Day 22 实现）
//   DELETE /api/notes/:id    → 删除一条心得       api-contract.md 第 8 项（Day 22 实现）
// ─────────────────────────────────────────────────────────────
//
// CloudBase HTTP 触发：event 携带请求信息，返回值须为标准 HTTP 响应 { statusCode, headers, body }。
// 一个函数承载同一路径下的多种方法；带 id 的子路径也由本函数处理（见 getId 的两种取法）。

const repo = require('./notesRepository');

// 统一 CORS 头（Day 20：只允许白名单来源，禁止 * 通配符）
// 白名单来自云函数环境变量 ALLOWED_ORIGIN（逗号/空格分隔）。命中才回 Access-Control-Allow-Origin。
// Day 22：方法白名单补上 PATCH / PUT / DELETE——少了它，浏览器预检会直接拦掉改写与删除。
let CORS_HEADERS = {};
function corsHeaders(event) {
  const headers = (event && event.headers) || {};
  const origin = headers.origin || headers.Origin || '';
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const base = {
    'Access-Control-Allow-Methods': 'GET,PATCH,PUT,DELETE,OPTIONS',
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

// 从 CloudBase event 里尽量稳妥地取出查询参数（不同版本字段名可能不同）
function getQuery(event) {
  return event.queryString || event.queryStringParameters || event.queryParameters || {};
}

// 取路径参数 id（形如 /api/notes/n_seed01 里的 n_seed01）。
// Day 22 踩点：CloudBase 的 HTTP 触发把路径参数放在哪儿，取决于触发路径怎么配——
//   ① 配成带参数的路径（如 /api/notes/{id}）→ event.pathParameters.id；
//   ② 配成通配（如 /api/notes/**）        → 只能从 event.path 尾部自己切。
// 两种都支持，取不到就返回空串，由调用方回 400 中文说明，而不是让请求静默落空。
function getId(event) {
  const pp = event.pathParameters || event.pathParameter || {};
  if (pp && pp.id) return String(pp.id);
  const p = event.path || (event.requestContext && event.requestContext.path) || '';
  const m = String(p).match(/\/notes\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : '';
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

// 「这条心得不在了」的统一中文说明：404（不存在）与「删过又删」共用一句，措辞温柔不追责
const GONE_MESSAGE = '这段心得好像不在了，也许已经被收起。回「心迹」看看别的吧。';

exports.main = async (event, context) => {
  setCors(event); // Day 20：按白名单计算本次请求的 CORS 头
  // 浏览器跨域预检
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const method = (event.httpMethod || 'GET').toUpperCase();

  // ---------- GET /api/notes：全部心得列表（★ 心迹 · 记录表读取） ----------
  if (method === 'GET') {
    try {
      const qs = getQuery(event);
      // 可选查询参数：user_id（上云后由登录态提供）；不传则读 local 的全部心得
      const userId = qs.user_id || 'local';
      // 余力加练：limit 返回条数限制，做边界钳制，避免超大或非法值
      const limit = qs.limit
        ? Math.max(1, Math.min(100, parseInt(qs.limit, 10) || 100))
        : 100;

      // 调数据访问层：查询由 repository 完成，接口层只拿回 shapeNote 后的数组
      const notes = await repo.listNotes(userId, limit);
      return json(200, { ok: true, notes });
    } catch (err) {
      // 真实异常打到云函数日志，对客户端只给稳定错误码
      console.error('[notes] GET /api/notes failed:', err);
      return json(500, { ok: false, error: 'server_error' });
    }
  }

  // ---------- PATCH /api/notes/:id：局部改写一条心得（契约第 7 项） ----------
  // 为什么用 PATCH 而不是 PUT：这个接口是「改我点到的字段」（只改正文、或只改心情），
  // 不是「用整条记录覆盖」，语义上正是 PATCH；PUT 保留为兼容别名（Day 22 前契约里登记的是 PUT）。
  if (method === 'PATCH' || method === 'PUT') {
    const id = getId(event);
    if (!id) {
      return json(400, { ok: false, error: 'invalid_param', message: '请指明要改写的是哪一段心得。' });
    }

    let body;
    try {
      body = parseBody(event);
    } catch (_) {
      return json(400, { ok: false, error: 'invalid_param', message: '请求体格式不正确。' });
    }

    // 只挑契约允许改的字段（content 正文 / mood 心情），其余字段一律忽略——白名单，不是黑名单
    const fields = {};
    if (Object.prototype.hasOwnProperty.call(body, 'content')) {
      if (typeof body.content !== 'string') {
        console.warn('[notes] PATCH /api/notes/:id 校验失败：正文不是字符串', { id });
        return json(400, { ok: false, error: 'invalid_param', message: '心得正文得是文字。' });
      }
      const content = body.content.trim();
      if (!content) {
        console.warn('[notes] PATCH /api/notes/:id 校验失败：正文不能改成空白', { id });
        return json(400, { ok: false, error: 'invalid_param', message: '心得正文不能改成空白。' });
      }
      fields.content = content;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'mood')) {
      const mood = body.mood;
      if (mood === null) {
        fields.mood = null; // 清空心情是合法的（契约里 mood 可空）
      } else if (Array.isArray(mood) && mood.every((m) => typeof m === 'string')) {
        fields.mood = mood;
      } else {
        console.warn('[notes] PATCH /api/notes/:id 校验失败：心情标签格式不对', { id });
        return json(400, { ok: false, error: 'invalid_param', message: '心情标签要是一个数组，例如 ["平静"]。' });
      }
    }
    if (Object.keys(fields).length === 0) {
      return json(400, { ok: false, error: 'invalid_param', message: '没有要改写的内容（可以改正文或心情）。' });
    }

    fields.updatedAt = toMySQLDate(new Date()); // 改过就记下改写时间

    try {
      // 先确认这条在不在——不存在就 404 + 中文说明，不让「改空气」也回成功
      const exists = await repo.findNote(id);
      if (!exists) {
        console.warn('[notes] PATCH /api/notes/:id 目标不存在', { id });
        return json(404, { ok: false, error: 'not_found', message: GONE_MESSAGE });
      }

      // 调数据访问层：UPDATE 由 repository 完成（列名白名单 + 值参数化）
      const affected = await repo.updateNote(id, fields);
      if (!affected) {
        // 并发场景兜底：查的时候还在，写的瞬间被删了
        return json(404, { ok: false, error: 'not_found', message: GONE_MESSAGE });
      }

      // 回读改完的样子：响应里带上新值，前端才好在同一张图上做「改之前 / 改之后」对比
      const note = await repo.findNote(id);
      console.log('[notes] PATCH /api/notes/:id 改写成功', { id, changed: Object.keys(fields) });
      return json(200, { ok: true, note });
    } catch (err) {
      console.error('[notes] PATCH /api/notes/:id 改写失败', err);
      return json(500, { ok: false, error: 'server_error' });
    }
  }

  // ---------- DELETE /api/notes/:id：删除一条心得（契约第 8 项） ----------
  if (method === 'DELETE') {
    const id = getId(event);
    if (!id) {
      return json(400, { ok: false, error: 'invalid_param', message: '请指明要收起的是哪一段心得。' });
    }

    try {
      // 删除为什么比新增更容易出事：新增写错只是多一条，删除写错就是数据没了。
      // 所以这里两层保护：① 前端点「删除」先弹二次确认（views.js 的确认行）；
      // ② 服务端按 affectedRows 判断真的删掉了没有——删不存在的 id 回 404，
      //    「已经删过」这件事也不假装成功（幂等但如实）。
      const affected = await repo.removeNote(id);
      if (!affected) {
        console.warn('[notes] DELETE /api/notes/:id 目标不存在（或已删过）', { id });
        return json(404, { ok: false, error: 'not_found', message: GONE_MESSAGE });
      }
      console.log('[notes] DELETE /api/notes/:id 删除成功', { id });
      return json(200, { ok: true, id });
    } catch (err) {
      console.error('[notes] DELETE /api/notes/:id 删除失败', err);
      return json(500, { ok: false, error: 'server_error' });
    }
  }

  // 其他方法（POST 等留到后续）→ 405 方法不被允许
  return json(405, { ok: false, error: 'method_not_allowed' });
};
