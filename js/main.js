/* 栀书心驿 · 主视图逻辑（Day 8 · mock 数据版）
 *
 * 职责：
 *   1. 模拟异步加载（setTimeout 假装有网络/读取耗时）；
 *   2. 渲染「最近在读」与「最近的读书心得」两个区块；
 *   3. 完整覆盖 加载中 / 成功 / 空 / 错误 四种状态。
 *
 * 数据来源：window.mockBooks / window.mockNotes（js/mock.js）。
 * 接真实 API 是第 3 周的事——届时把 loadData() 换成 store / fetch 即可，
 *   下面的 渲染 与 四态 逻辑一行都不用动。
 *
 * 调试：在地址后加 ?preview= 可强制查看某态（便于截图与验收）：
 *   index.html?preview=loading   只看加载态
 *   index.html?preview=empty     空状态（新用户）
 *   index.html?preview=error     错误态（读取失败）
 *   index.html?preview=success   成功态（默认即此，可不写）
 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var preview = params.get('preview'); // loading | empty | error | success | null

  function $(id) { return document.getElementById(id); }
  var booksBox = $('books-state');
  var notesBox = $('notes-state');
  var statBox = $('stat');

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 把某个区块挂载为指定状态视图
  function mountState(box, type, opts) {
    box.innerHTML = '';
    box.appendChild(window.ZhiShu.createStateView(Object.assign({ type: type }, opts || {})));
  }

  function renderBooks(books) {
    booksBox.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'card-grid book-grid';
    books.forEach(function (b) { grid.appendChild(window.ZhiShu.createBookCard(b)); });
    booksBox.appendChild(grid);
  }

  function renderNotes(notes) {
    notesBox.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'card-grid notes-grid';
    notes.forEach(function (n) { grid.appendChild(window.ZhiShu.createNoteCard(n)); });
    notesBox.appendChild(grid);
  }

  function updateStat(books, notes) {
    if (!statBox) return;
    statBox.textContent = '已读 ' + books.length + ' 本 · 写下 ' + notes.length + ' 段心得';
  }

  // 模拟"取数"：默认成功；preview 可改结果
  function loadData() {
    return delay(700).then(function () {
      if (preview === 'error') throw new Error('mock-fetch-failed');
      if (preview === 'empty') return { books: [], notes: [] };
      return { books: window.mockBooks, notes: window.mockNotes };
    });
  }

  function boot() {
    // 仅演示加载态：一直停在 loading（用于截图/验收）
    if (preview === 'loading') {
      mountState(booksBox, 'loading');
      mountState(notesBox, 'loading');
      return;
    }

    // 正常流程：先 loading，再出结果
    mountState(booksBox, 'loading');
    mountState(notesBox, 'loading');

    loadData().then(function (data) {
      updateStat(data.books, data.notes);

      if (data.books.length === 0) {
        mountState(booksBox, 'empty', {
          message: '书架还空着，今天收一本进来吧。',
          actionText: '添加一本书',
          actionHref: 'book.html',
        });
      } else {
        renderBooks(data.books);
      }

      if (data.notes.length === 0) {
        mountState(notesBox, 'empty', {
          message: '还没开始，今天就是第一天。',
          actionText: '写第一段心得',
          actionHref: 'note.html',
        });
      } else {
        renderNotes(data.notes);
      }
    }).catch(function () {
      var retry = function () { boot(); };
      mountState(booksBox, 'error', {
        message: '这一页暂时打不开，过会儿再来看看。',
        actionText: '轻轻重试',
        onAction: retry,
      });
      mountState(notesBox, 'error', {
        message: '这一页暂时打不开，过会儿再来看看。',
        actionText: '轻轻重试',
        onAction: retry,
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
