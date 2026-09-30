/* 栀书心驿 · 三视图渲染（Day 13 · hash 路由版）
 *
 * 本文件只做两件事：
 *   1. 把四条路由（/home、/books、/books/:id、/notes）注册进 Z.router；
 *   2. 每个视图按「加载中 / 成功 / 空 / 错误」四态渲染数据。
 *
 * 数据全部来自 js/store.js（浏览器本地存储），不新增数据对象、不接后端。
 * 卡片与状态视图复用 js/components.js 的组件，保证与 Day 8 起的视觉一致。
 *
 * 调试：地址里加 ?preview= 可强制查看某一种状态（截图 / 验收用，沿用 Day 8 约定）：
 *   index.html?preview=loading#/books   只看加载态
 *   index.html?preview=empty#/notes     只看空状态
 *   index.html?preview=error#/books     只看错误态
 *   index.html#/notes                   正常态（读真实本地数据）
 */
(function () {
  'use strict';

  var Z = window.ZhiShu;
  var params = new URLSearchParams(location.search);
  var preview = params.get('preview'); // loading | empty | error | success | null

  function el(id) { return document.getElementById(id); }
  function byTimeDesc(a, b) { return new Date(b.created_at) - new Date(a.created_at); }

  // id → 书名的映射：心得卡片要显示《书名》，书页视图要显示标题
  function bookMap() {
    var map = {};
    store.getBooks().forEach(function (b) { map[b.id] = b.title; });
    return map;
  }

  function mount(box, type, opts) {
    var o = { type: type };
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    box.innerHTML = '';
    box.appendChild(Z.createStateView(o));
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* -------- 通用「取数 → 四态」通道 --------
   * fetcher  () => 数组           真正的取数动作（同步读 store，包一层是为了统一捕获异常）
   * render   (box, list) => void  成功态怎么摆
   * emptyOpts                     空状态的文案与行动
   * 加载态因本地读取很快，刻意留 0.65 秒，让"正在翻页"这件事被看见。
   */
  function loadList(box, fetcher, loadingText, render, emptyOpts) {
    mount(box, 'loading', { message: loadingText });
    if (preview === 'loading') return; // 停在这一帧，便于截图

    var retry = function () { loadList(box, fetcher, loadingText, render, emptyOpts); };

    delay(650).then(function () {
      if (preview === 'error') throw new Error('preview-error');
      var list = preview === 'empty' ? [] : fetcher();
      if (!list || list.length === 0) {
        mount(box, 'empty', emptyOpts);
      } else {
        box.innerHTML = '';
        render(box, list);
      }
    }).catch(function () {
      mount(box, 'error', {
        message: '这一页暂时打不开，过会儿再来看看。',
        actionText: '轻轻重试',
        onAction: retry,
      });
    });
  }

  /* ========== 视图一：今日 #/home ========== */
  function homeView() {
    Z.router.crumbs([{ text: '今日' }]);

    var books = store.getBooks();
    var notes = store.getNotes();
    var stat = el('stat');
    if (stat) {
      stat.textContent = books.length || notes.length
        ? '书架上已有 ' + books.length + ' 本 · 写下 ' + notes.length + ' 段心得'
        : '书架还空着，今天可以是第一天。';
    }
  }

  /* ========== 视图二：书架 #/books（数据对象：book 列表） ========== */
  function booksView() {
    Z.router.crumbs([{ text: '书架' }]);

    loadList(
      el('books-box'),
      function () { return store.getBooks().slice().sort(byTimeDesc); },
      '正在为你整理书架…',
      function (box, list) {
        var count = el('books-count');
        if (count) count.textContent = '共 ' + list.length + ' 本';

        var grid = document.createElement('div');
        grid.className = 'card-grid book-grid';
        list.forEach(function (b) {
          // 整张卡片包一层链接：鼠标可点、Tab 可聚焦、读屏可读（余力加练）
          var link = document.createElement('a');
          link.className = 'card-link';
          link.href = '#/books/' + encodeURIComponent(b.id);
          link.appendChild(Z.createBookCard(b));
          grid.appendChild(link);
        });
        box.appendChild(grid);
      },
      {
        message: '书架还空着，今天收一本进来吧。',
        actionText: '收下一本书',
        actionHref: 'book.html',
      }
    );
  }

  /* ========== 视图三：书页 #/books/:id（二级路由 · 数据对象：某本书的 note 列表） ========== */
  function bookDetailView(ctx) {
    var map = bookMap();
    var id = ctx.params.id;
    var title = map[id];

    Z.router.crumbs([
      { text: '书架', href: '#/books' },
      { text: title ? '《' + title + '》' : '这本书不见了' },
    ]);

    el('book-title').textContent = title ? '《' + title + '》' : '这本书不见了';
    var write = el('book-write');
    if (write) {
      write.hidden = !title;
      write.href = 'note.html?book=' + encodeURIComponent(id || '');
    }
    el('book-meta').textContent = title ? '点一处安心的地方，写下读完这一段的自己。' : '';

    // 书不在书架上（比如链接里的 id 过时了）：温柔说明，并给一个回书架的去处
    if (!title) {
      mount(el('book-notes-box'), 'error', {
        message: '这本书好像已经不在书架上了。',
        actionText: '回书架看看',
        onAction: function () { Z.router.go('/books'); },
      });
      return;
    }

    loadList(
      el('book-notes-box'),
      function () { return store.getNotesByBook(id).slice().sort(byTimeDesc); },
      '正在把这一段心事摊开…',
      function (box, list) {
        var count = el('book-notes-count');
        if (count) count.textContent = '已有 ' + list.length + ' 段心得';
        renderNoteCards(box, list, map);
      },
      {
        message: '这本书还没留下心得。读完几句，回来写一点点吧。',
        actionText: '写下第一段',
        actionHref: 'note.html?book=' + encodeURIComponent(id),
      }
    );
  }

  /* ========== 视图四：心迹 #/notes（数据对象：全部 note 列表） ========== */
  function notesView() {
    Z.router.crumbs([{ text: '心迹' }]);

    loadList(
      el('notes-box'),
      function () { return store.getNotes().slice().sort(byTimeDesc); },
      '正在把写下的心迹轻轻摊开…',
      function (box, list) {
        var count = el('notes-count');
        if (count) count.textContent = '共 ' + list.length + ' 段';
        renderNoteCards(box, list, bookMap());
      },
      {
        message: '还没开始，今天就是第一天。读几页，写几句，心就慢慢安下来了。',
        actionText: '收下一本书',
        actionHref: 'book.html',
      }
    );
  }

  // 心得卡片列表（书架视图也要用，所以抽出来）
  function renderNoteCards(box, list, map) {
    var grid = document.createElement('div');
    grid.className = 'card-grid notes-grid';
    list.forEach(function (n) {
      grid.appendChild(Z.createNoteCard({
        id: n.id,
        book_id: n.book_id,
        bookTitle: map[n.book_id] ? '《' + map[n.book_id] + '》' : '未关联书名',
        content: n.content,
        mood: n.mood,
        created_at: n.created_at,
      }));
    });
    box.appendChild(grid);
  }

  /* ========== 心得的改写 / 删除（来自用户真实反馈：写完的心得应能自由增删改，含手误重复记录） ==========
   * 卡片本身是纯 DOM（components.js 只产结构、不碰数据），这里用一次事件委托接管动作。
   * 删除走"就地温柔确认"，不弹生硬的原生 confirm；改写复用写心得页（?edit=）。 */
  function noteActionsHtml(id, bookId) {
    return '<div class="nc-actions">' +
      '<button type="button" class="nc-btn" data-action="edit-note" data-note-id="' + Z.escapeHtml(id) + '" data-book-id="' + Z.escapeHtml(bookId || '') + '">改写</button>' +
      '<button type="button" class="nc-btn nc-btn-ghost" data-action="delete-note" data-note-id="' + Z.escapeHtml(id) + '">删除</button>' +
    '</div>';
  }

  function onNoteAction(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // 改写：跳到写心得页的编辑模式（带上 id、book 与来源视图）
    var edit = t.closest('[data-action="edit-note"]');
    if (edit) {
      var id = edit.getAttribute('data-note-id');
      var bid = edit.getAttribute('data-book-id') || '';
      var from = Z.router.path().indexOf('/books/') === 0 ? 'book' : 'notes';
      location.href = 'note.html?edit=' + encodeURIComponent(id) +
        '&book=' + encodeURIComponent(bid) + '&from=' + from;
      return;
    }

    // 删除：就地换成确认行，不弹原生框
    var del = t.closest('[data-action="delete-note"]');
    if (del) {
      var card = del.closest('.note-card');
      if (card) {
        card.querySelector('.nc-actions').outerHTML =
          '<div class="nc-actions nc-actions-confirm">' +
            '<span class="nc-confirm-text">要把这段心得删掉吗？删掉后不可找回。</span>' +
            '<button type="button" class="nc-btn nc-btn-ghost" data-action="cancel-delete">留下</button>' +
            '<button type="button" class="nc-btn nc-btn-danger" data-action="confirm-delete" data-note-id="' + Z.escapeHtml(del.getAttribute('data-note-id')) + '">删除</button>' +
          '</div>';
      }
      return;
    }

    // 取消删除：还原成"改写 / 删除"（id 与 bookId 仍记在卡片上）
    var cancel = t.closest('[data-action="cancel-delete"]');
    if (cancel) {
      var ccard = cancel.closest('.note-card');
      if (ccard) {
        ccard.querySelector('.nc-actions').outerHTML =
          noteActionsHtml(ccard.getAttribute('data-note-id'), ccard.getAttribute('data-book-id'));
      }
      return;
    }

    // 确认删除：移除该条心得并重渲染当前视图（心迹 / 书页都走同一通道）
    var yes = t.closest('[data-action="confirm-delete"]');
    if (yes) {
      store.removeNote(yes.getAttribute('data-note-id'));
      Z.router.go(Z.router.path());
    }
  }
  document.addEventListener('click', onNoteAction);

  /* ========== 未知路由：温柔承接，不白屏 ==========
   * 处理办法：不悄悄改掉你输的地址（改了反而更让人困惑），
   * 而是把「今日」的内容显示出来，并在上方留一行说明，告诉你这条路还没通。
   * 刷新、前进、后退都保持这个一致结果——这是"切换不出错"的含义。 */
  function notFoundView(ctx) {
    var warn = el('route-warn');
    if (warn) {
      warn.textContent = '「' + ctx.path + '」这条路还没通，先带你回到今日。';
      warn.hidden = false;
    }
    Z.router.crumbs([{ text: '今日' }]);
    homeView();
  }

  /* ========== 注册表：meta.view 决定显示哪个视图区块，meta.title 供读屏播报用 ========== */
  Z.router
    .add('/home', homeView, { view: 'home', title: '今日' })
    .add('/books', booksView, { view: 'books', title: '书架' })
    .add('/books/:id', bookDetailView, { view: 'book', title: '书页' })
    .add('/notes', notesView, { view: 'notes', title: '心迹' })
    .fallback(notFoundView)
    .start();
})();
