/* 栀书心驿 · 检查台逻辑（Day 20）
 *
 * 只做三件事 + 一个余力加练：
 *   ① 探活 /api/health —— 证明接口地址可达、服务在线；
 *   ② 并发读 /api/books 与 /api/notes —— 证明页面真的拿到数据库真实数据；
 *   ③ 一次写入测试 —— POST /api/books 写一条测试记录，验证「写」链路通不通；
 *   ④ 余力加练 —— 取 books/notes 里最新一条的更新/创建时间，显示「数据最后更新时间」。
 *
 * 失败都走温柔提示，不抛生硬报错（见 TECH_DESIGN §7）。
 */
(function () {
  'use strict';

  var api = window.ZhiShu.api;
  var healthBox = document.getElementById('health-box');
  var dataBox = document.getElementById('data-box');
  var writeBox = document.getElementById('write-box');
  var lastUpdate = document.getElementById('last-update');
  var writeBtn = document.getElementById('write-test');

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ISO 时间 → 温和的中文日期时间
  function fmt(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '年' + pad(d.getMonth() + 1) + '月' + pad(d.getDate()) + '日 '
      + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // 找 books/notes 里最新的一条 created_at / updated_at
  function latestOf(books, notes) {
    var last = '';
    books.concat(notes).forEach(function (r) {
      var t = r.updated_at || r.created_at;
      if (t && String(t) > last) last = String(t);
    });
    return last;
  }

  /* ---- ① 健康状态 ---- */
  api.health().then(function (d) {
    healthBox.className = 'state ok';
    healthBox.textContent = '在线 · ' + JSON.stringify(d);
  }).catch(function (e) {
    healthBox.className = 'state err';
    healthBox.textContent = '离线 · ' + (e.message || e.code || '未知错误');
  });

  /* ---- ② 核心表真实数据 ---- */
  Promise.all([api.getBooks(), api.getNotes()]).then(function (arr) {
    var books = arr[0];
    var notes = arr[1];
    var last = latestOf(books, notes);

    // 接口返回的 notes 只有 book_id，没有书名；用已读到的 books 建一张 id→书名 映射来补全
    var titleMap = {};
    books.forEach(function (b) { titleMap[b.id] = b.title; });

    var html = '<p>books 表：' + books.length + ' 本</p>';
    if (books.length) {
      html += '<ul class="check-list">' + books.slice(0, 5).map(function (b) {
        return '<li>' + escapeHtml(b.title) + '（' + escapeHtml(fmt(b.created_at)) + '）</li>';
      }).join('') + '</ul>';
    }
    html += '<p>notes 表：' + notes.length + ' 段</p>';
    if (notes.length) {
      html += '<ul class="check-list">' + notes.slice(0, 5).map(function (n) {
        var title = n.bookTitle || titleMap[n.book_id];
        var head = title ? '《' + escapeHtml(title) + '》' : '未关联书名';
        return '<li>' + head + '：' + escapeHtml((n.content || '').slice(0, 22)) + (n.content && n.content.length > 22 ? '…' : '') + '</li>';
      }).join('') + '</ul>';
    }
    dataBox.className = 'state ok';
    dataBox.innerHTML = html;

    // ④ 最后更新时间
    lastUpdate.textContent = last ? ('最新一条记录更新于 ' + fmt(last)) : '暂无记录';
  }).catch(function (e) {
    dataBox.className = 'state err';
    dataBox.textContent = '读取失败 · ' + (e.message || e.code || '未知错误');
  });

  /* ---- ③ 一次写入测试 ---- */
  writeBtn.addEventListener('click', function () {
    writeBox.hidden = false;
    writeBox.className = 'state';
    writeBox.textContent = '写入中…';
    var title = '测试书籍·' + new Date().toLocaleTimeString('zh-CN');
    api.addBook(title).then(function (b) {
      writeBox.className = 'state ok';
      writeBox.textContent = '写入成功：' + b.title + '（' + b.id + '）— 刷新首页即可见';
      // 写入成功后刷新本页，让 ② 的数据与 ④ 的更新时间跟着变
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) {
      writeBox.className = 'state err';
      // 重复写入会被接口以 409 duplicate 拒绝，属正常，单独说明
      writeBox.textContent = '写入返回：' + (e.message || e.code || '未知错误') +
        (e.code === 'duplicate' ? '（已存在，属正常）' : '');
    });
  });
})();
