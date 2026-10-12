/* 栀书心驿 · 公网接口客户端（Day 20 建；Day 23 补统一错误提示）
 *
 * Day 23：新增 friendlyError()——把所有裸报错（英文「Failed to fetch」、
 * 「请求失败（500）」等）统一归类为「输入错 / 网络错 / 服务端错」三类并翻译成中文，
 * 供 views.js、check.js 等界面层统一调用。详见本文件中部「三类错误 → 中文人话」段。
 *
 * 把页面数据来源从浏览器 localStorage 切到云函数（按 api-contract.md）：
 *   store 层原本是本地存储；今天起，index.html 四个视图与检查台改读这个 Z.api。
 * 所有方法返回 Promise；失败时抛带 { code, status } 的错误，便于视图层做四态（错误态）展示。
 *
 * 对应契约（api-contract.md）：
 *   GET  /api/health             → health()
 *   GET  /api/books              → getBooks()
 *   GET  /api/notes              → getNotes()
 *   GET  /api/books/:id/notes    （第 4 项 · Day 21 起实现）本客户端先以 getNotes 客户端过滤兜底
 *   POST /api/books              → addBook(title)            （已实现 · Day 18）
 *   POST /api/notes              → addNote(...)             （第 5 项 · 尚未实现，暂会返回 method_not_allowed）
 *   PATCH /api/notes/:id         → updateNote(id, fields)   （第 7 项 · 已实现 · Day 22）
 *   DELETE /api/notes/:id        → removeNote(id)           （第 8 项 · 已实现 · Day 22）
 *
 * 注意（AGENTS.md [D6-4]）：本文件只负责「把请求发到云端并回传数据」，
 * 绝不替用户生成读书心得正文——正文永远来自用户本人在 note.html 写下的内容。
 */
window.ZhiShu = window.ZhiShu || {};

(function (Z) {
  'use strict';

  // 接口基地址来自 js/config.js（用户部署前填入自己的 CloudBase 环境地址）
  // 每次请求实时读取，避免脚本加载顺序带来的捕获时机问题（也更稳）。
  function getBase() {
    return (window.ZhiShuConfig && window.ZhiShuConfig.API_BASE_URL || '').replace(/\/+$/, '');
  }
  // MVP 单用户本地场景，user_id 固定为 local（上云后由登录态提供）
  var USER_ID = 'local';

  /* ============================================================
   * 三类错误 → 中文人话（Day 23 统一错误提示）
   * ------------------------------------------------------------
   * 改之前的问题：错误在各处临时拼字，用户可能看到——
   *   · 浏览器 fetch 的英文原文「Failed to fetch」——纯英文裸报错；
   *   · 「请求失败（500）」——只有状态码、没有说明的黑话。
   * 今天统一：无论错误来自哪一层，先经 friendlyError() 归成三类，再输出同一套温柔中文：
   *   ① input   输入错   —— 参数缺失/格式不对/重复/资源不存在：告诉用户"改哪里"
   *   ② network 网络错   —— 断网 / 连不上 / CORS 被拦 / 地址没配：提示"检查连接"
   *   ③ server  服务端错 —— 服务异常(5xx) / 未知：承认是驿站这边的问题，不甩锅给用户
   * ============================================================ */
  var ERROR_KINDS = {
    input:   { label: '输入错',   message: '有几处还需要你确认一下，改好再试一次吧。' },
    network: { label: '网络错',   message: '网络好像断了一下，检查一下连接，再试一次吧。' },
    server:  { label: '服务端错', message: '驿站这边出了点小状况，过一会儿再来看看吧。' },
  };

  // 把任意错误归类成三类之一（优先看服务端 error 码，其次看 HTTP 状态码）
  function classifyError(err) {
    var e = err || {};
    var code = String(e.code || '');
    var status = Number(e.status || 0);
    if (code === 'invalid_param' || code === 'duplicate' || code === 'not_found') return 'input';
    if (status === 400 || status === 404 || status === 409) return 'input';
    if (code === 'network' || code === 'no_base_url') return 'network';
    if (status === 0 && !code) return 'network';  // fetch 直接失败，没带任何状态
    if (code === 'server_error' || status >= 500) return 'server';
    return 'server';                              // 兜底：一律当作服务端错
  }

  /* 统一出口：把裸报错翻译成 { kind, label, message, code, status }
   * 优先用服务端给的中文说明（更具体，如「这本书已经在书架上了，无需重复收录」）；
   * 服务端没给说明、或给的是英文/技术话，就换成该类的通用人话。 */
  function friendlyError(err) {
    var e = err || {};
    var kind = classifyError(e);
    var info = ERROR_KINDS[kind];
    var serverMsg = typeof e.serverMessage === 'string' ? e.serverMessage.trim() : '';
    var hintMsg = typeof e.hint === 'string' ? e.hint.trim() : '';
    return {
      kind: kind,
      label: info.label,
      message: serverMsg || hintMsg || info.message,
      code: e.code || ('http_' + (e.status || 'unknown')),
      status: Number(e.status || 0),
    };
  }
  Z.friendlyError = friendlyError;

  /* 统一的请求通道：
   *   - 拦截「没配地址」的情况，给一句人话（hint）；
   *   - 解析 JSON，按契约判断 ok 字段；
   *   - 业务失败（ok:false）或 HTTP 失败都抛带 code / status 的错误，交给视图层做错误态；
   *   - 网络层错误（CORS 被拦 / 断网 / DNS 失败）也透传，code 标记为 network。
   * 注意：这里只负责"把错误带出来"，不负责拼给用户看的字——那由 friendlyError() 统一做。 */
  function request(path, options) {
    var BASE = getBase();
    if (!BASE || BASE.indexOf('<你的环境ID>') !== -1) {
      var ne = new Error('no_base_url');
      ne.code = 'no_base_url';
      ne.hint = '还没有配置接口地址，请在 js/config.js 里填入你的 CloudBase 环境公网地址。';
      return Promise.reject(ne);
    }
    var url = BASE + path;
    return fetch(url, options).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
        if (res.ok && data && data.ok !== false) return data;
        var err = new Error('http_' + res.status);
        err.status = res.status;
        err.code = (data && data.error) || ('http_' + res.status);
        // 服务端若给了说明就原样带上；不带 message 视作"没给人话"，交给 friendlyError 补
        err.serverMessage = (data && data.message) || '';
        throw err;
      });
    }).catch(function (err) {
      // 走到这里：要么是上面主动抛的业务错误（有 status / code），
      // 要么是 fetch 自身失败（断网 / DNS / CORS 被拦）——后者标记为 network。
      if (!err.status && !err.code) err.code = 'network';
      throw err;
    });
  }

  function postOpts(body) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  // 带 body 的通用选项（PATCH 用）
  function jsonOpts(method, body) {
    return {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    };
  }

  var api = {
    // 探活：GET /api/health
    health: function () {
      return request('/api/health');
    },

    // 书籍列表：GET /api/books?user_id=local&limit=
    getBooks: function (limit) {
      var q = '?user_id=' + USER_ID + '&limit=' + (limit || 100);
      return request('/api/books' + q).then(function (d) { return d.books || []; });
    },

    // 心得列表：GET /api/notes?user_id=local&limit=
    getNotes: function (limit) {
      var q = '?user_id=' + USER_ID + '&limit=' + (limit || 100);
      return request('/api/notes' + q).then(function (d) { return d.notes || []; });
    },

    // 某本书的心得：/api/books/:id/notes 尚未实现（Day 21 起），先拉全量再客户端过滤，书页可用
    getNotesByBook: function (bookId) {
      return api.getNotes().then(function (notes) {
        return notes.filter(function (n) { return n.book_id === bookId; });
      });
    },

    // 新增书籍：POST /api/books（已实现）
    addBook: function (title) {
      return request('/api/books', postOpts({ title: title })).then(function (d) { return d.book; });
    },

    // 新增心得：POST /api/notes（第 5 项 · 尚未实现，当前会返回 method_not_allowed）
    addNote: function (bookId, content, mood) {
      return request('/api/notes', postOpts({ book_id: bookId, content: content, mood: mood || [] }))
        .then(function (d) { return d.note; });
    },

    // 改写心得：PATCH /api/notes/:id（第 7 项 · Day 22 已实现）
    // fields 只放真的要改的字段（content / mood），不放的字段服务端不会动——
    // 这就是"改一处"与"整条覆盖"的区别（PATCH 与 PUT 的分别）。
    updateNote: function (id, fields) {
      return request('/api/notes/' + encodeURIComponent(id), jsonOpts('PATCH', fields))
        .then(function (d) { return d.note; });
    },

    // 删除心得：DELETE /api/notes/:id（第 8 项 · Day 22 已实现）
    // 服务端会校验 id 是否存在：不存在的 id 回 404 + 中文说明，不会假装删成功。
    removeNote: function (id) {
      return request('/api/notes/' + encodeURIComponent(id), { method: 'DELETE' });
    },
  };

  Z.api = api;
})(window.ZhiShu);
