/* 栀书心驿 · 可复用组件（Day 8 · 余力加练）
 *
 * 暴露 window.ZhiShu 命名空间，提供三个纯函数式 DOM 组件：
 *   - createBookCard(book)      书名卡片（区块2「最近在读」复用）
 *   - createNoteCard(note)      心得卡片（区块3「最近的读书心得」复用）
 *   - createStateView(opts)     状态视图（加载 / 空 / 错误，四态复用）
 *
 * 设计原则：
 *   1. 组件只产 DOM，不碰数据来源——mock 与未来的 store/API 都能喂它；
 *   2. 所有用户文本经 escapeHtml 转义，避免注入（即便数据来自本地）；
 *   3. 视觉沿用 style.css 的诗意基底（柔色、留白、衬线、圆角）。
 * 视觉约束（Day 9 设计规则沉淀，所有组件须遵守）：
 *   4. 文字颜色须满足 WCAG AA（对比度 ≥ 4.5:1）：正文/副文用 --ink / --ink-soft；品牌字、标签、选中态用 --leaf-ink；禁止直接拿 --leaf 作文字色。
 *   5. 交互元素必须具备三种状态：:hover、:focus-visible、:active；禁用只有 hover 的按钮。
 *   6. 组件级容器复用 .card 规范：圆角 18px、白底半透明、内边距 20-24px；文字使用 overflow-wrap 防长内容溢出；移动端热区不小于 44px。
 */
window.ZhiShu = window.ZhiShu || {};

(function (Z) {
  'use strict';

  // 心情标签枚举（与 TECH_DESIGN §4.1 保持一致）
  var MOODS = ['平静', '温暖', '触动', '治愈', '思索', '困惑', '轻盈', '惆怅'];
  Z.isMood = function (m) { return MOODS.indexOf(m) !== -1; };

  // 把 ISO 时间转成温和的中文日期："2026-09-21T08:30:00+08:00" → "9月21日"
  Z.formatDate = function (iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  };

  // 基础转义，防 XSS（哪怕数据来自本地，也养成习惯）
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  Z.escapeHtml = escapeHtml;

  // ---- 书名卡片 ----
  Z.createBookCard = function (book) {
    var el = document.createElement('article');
    el.className = 'card book-card';
    el.innerHTML =
      '<p class="card-label">在读</p>' +
      '<h3 class="card-name">' + escapeHtml(book.title) + '</h3>' +
      '<p class="card-date">' + escapeHtml(Z.formatDate(book.created_at)) + ' 收入书架</p>';
    return el;
  };

  // ---- 心得卡片 ----
  Z.createNoteCard = function (note) {
    var el = document.createElement('article');
    el.className = 'card note-card';
    // mood 可能为单字符串（旧数据）或数组（多选），统一成数组后成组渲染
    var moods = Array.isArray(note.mood) ? note.mood : (note.mood ? [note.mood] : []);
    var moodHtml = moods.length
      ? '<span class="nc-moods">' + moods.map(function (m) {
          return '<span class="nc-mood">' + escapeHtml(m) + '</span>';
        }).join('') + '</span>'
      : '';
    el.innerHTML =
      '<div class="nc-top">' +
        '<span class="nc-book">' + escapeHtml(note.bookTitle || '未命名') + '</span>' +
        moodHtml +
      '</div>' +
      '<p class="nc-date">' + escapeHtml(Z.formatDate(note.created_at)) + '</p>' +
      '<p class="nc-content">' + escapeHtml(note.content) + '</p>';
    return el;
  };

  // ---- 状态视图：加载 / 空 / 错误 ----
  // opts: { type:'loading'|'empty'|'error', message, actionText, actionHref, onAction }
  Z.createStateView = function (opts) {
    var el = document.createElement('div');
    el.className = 'state-view state-' + opts.type;

    if (opts.type === 'loading') {
      el.innerHTML =
        '<div class="spinner" aria-hidden="true"></div>' +
        '<p class="state-text">' + escapeHtml(opts.message || '正在为你翻开书页…') + '</p>';
    } else if (opts.type === 'empty') {
      el.innerHTML =
        '<p class="state-text">' + escapeHtml(opts.message || '还没开始，今天就是第一天。') + '</p>' +
        (opts.actionText
          ? '<a class="entry subtle" href="' + escapeHtml(opts.actionHref || 'book.html') + '">' + escapeHtml(opts.actionText) + '</a>'
          : '');
    } else if (opts.type === 'error') {
      el.innerHTML =
        '<p class="state-text">' + escapeHtml(opts.message || '这一页暂时打不开，过会儿再来看看。') + '</p>' +
        (opts.actionText
          ? '<button class="entry subtle" type="button">' + escapeHtml(opts.actionText) + '</button>'
          : '');
      if (opts.onAction) {
        el.querySelector('button').addEventListener('click', opts.onAction);
      }
    }
    return el;
  };
})(window.ZhiShu);
