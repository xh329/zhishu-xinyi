/* 栀书心驿 · 公网接口客户端（Day 20）
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
 *   POST /api/notes              → addNote(...)             （第 5 项 · Day 21 起，暂会返回 method_not_allowed）
 *   DELETE /api/notes/:id        → removeNote(id)           （第 8 项 · Day 21 起）
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

  /* 统一的请求通道：
   *   - 拦截「没配地址」的情况，给一句人话；
   *   - 解析 JSON，按契约判断 ok 字段；
   *   - 业务失败（ok:false）或 HTTP 失败都抛带 code 的错误，交给视图层做错误态；
   *   - 网络层错误（CORS 被拦 / 断网 / DNS 失败）也透传，code 标记为 network。 */
  function request(path, options) {
    var BASE = getBase();
    if (!BASE || BASE.indexOf('<你的环境ID>') !== -1) {
      var ne = new Error('还没有配置接口地址。请在 js/config.js 填入你的 CloudBase 环境公网地址（形如 https://<环境ID>.api.tcloudbase.com）。');
      ne.code = 'no_base_url';
      return Promise.reject(ne);
    }
    var url = BASE + path;
    return fetch(url, options).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
        if (res.ok && data && data.ok !== false) return data;
        var err = new Error((data && data.message) || ('请求失败（' + res.status + '）'));
        err.status = res.status;
        err.code = (data && data.error) || ('http_' + res.status);
        throw err;
      });
    }).catch(function (err) {
      if (!err.status) err.code = err.code || 'network'; // 网络 / CORS 层错误
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

    // 新增心得：POST /api/notes（Day 21 起实现；当前会返回 method_not_allowed）
    addNote: function (bookId, content, mood) {
      return request('/api/notes', postOpts({ book_id: bookId, content: content, mood: mood || [] }))
        .then(function (d) { return d.note; });
    },

    // 删除心得：DELETE /api/notes/:id（Day 21 起实现）
    removeNote: function (id) {
      return request('/api/notes/' + encodeURIComponent(id), { method: 'DELETE' });
    },
  };

  Z.api = api;
})(window.ZhiShu);
