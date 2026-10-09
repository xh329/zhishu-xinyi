/* 栀书心驿 · 检查台逻辑（Day 20 建台；Day 22 补「改写 / 删除」两块）
 *
 * 检查台按「四类操作」排布，一页看完增删改查是否闭环：
 *   ① 探活 /api/health —— 证明接口地址可达、服务在线（查）
 *   ② 并发读 /api/books 与 /api/notes —— 证明页面拿到数据库真实数据（查）
 *   ③ 一次写入测试 —— POST /api/books（增）
 *   ④ 数据最后更新时间 —— 余力加练
 *   ⑤ 改写一段心得 —— PATCH /api/notes/:id，显示「改之前 / 改之后」值对比（改）
 *   ⑥ 删除一段心得 —— DELETE /api/notes/:id，删完重新 GET，确认该条不再返回（删）
 *
 * 两条自我约束：
 *   · ⑤ 的正文与心情由人在页面上手填，页面绝不替用户生成心得内容（AGENTS.md [D6-4] 不代笔内心）；
 *   · ⑥ 删除前必须过二次确认，且服务端还会校验 id 存在性——删错了没法找回，宁可多点一下。
 *
 * 失败都走温柔提示，不抛生硬报错（见 TECH_DESIGN §7）。
 */
(function () {
  'use strict';

  var api = window.ZhiShu.api;

  // Day 23：错误提示统一出口——把裸报错（英文 fetch 原文 / 状态码）翻成中文三类，
  // 检查台只显示人话，不再直接贴 e.message。见 js/api.js 的 friendlyError()。
  function friendly(e) { return window.ZhiShu.friendlyError(e); }
  var healthBox = document.getElementById('health-box');
  var dataBox = document.getElementById('data-box');
  var writeBox = document.getElementById('write-box');
  var lastUpdate = document.getElementById('last-update');
  var writeBtn = document.getElementById('write-test');

  // ⑤⑥ 的 DOM
  var patchTarget = document.getElementById('patch-target');
  var patchForm = document.getElementById('patch-form');
  var patchContent = document.getElementById('patch-content');
  var patchMoods = document.getElementById('patch-moods');
  var patchSave = document.getElementById('patch-save');
  var patchBox = document.getElementById('patch-box');
  var deleteBtn = document.getElementById('delete-test');
  var deleteBox = document.getElementById('delete-box');

  // 心情标签枚举（与 note.html / TECH_DESIGN §4.1 一致）
  var MOODS = ['平静', '温暖', '触动', '治愈', '思索', '困惑', '轻盈', '惆怅'];
  var MOOD_JOIN = '、';

  var titleMap = {};      // book_id → 书名
  var pick = null;        // 当前改写目标（GET 返回里的原始对象）
  var selectedMoods = []; // 当前在④里勾着的心情

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

  function moodsOf(n) {
    return Array.isArray(n.mood) ? n.mood.slice() : (n.mood ? [n.mood] : []);
  }
  function moodsText(arr) {
    return (arr && arr.length) ? arr.join(MOOD_JOIN) : '（未选）';
  }

  /* ---- ① 健康状态 ---- */
  api.health().then(function (d) {
    healthBox.className = 'state ok';
    healthBox.textContent = '在线 · ' + JSON.stringify(d);
  }).catch(function (e) {
    var f = friendly(e);
    healthBox.className = 'state err';
    healthBox.textContent = '离线（' + f.label + '）· ' + f.message;
  });

  /* ---- ② 核心表真实数据 ---- */
  Promise.all([api.getBooks(), api.getNotes()]).then(function (arr) {
    var books = arr[0];
    var notes = arr[1];
    var last = latestOf(books, notes);

    // 接口返回的 notes 只有 book_id，没有书名；用已读到的 books 建一张 id→书名 映射来补全
    titleMap = {};
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
        var title = titleMap[n.book_id];
        var head = title ? '《' + escapeHtml(title) + '》' : '未关联书名';
        return '<li>' + head + '：' + escapeHtml((n.content || '').slice(0, 22)) + (n.content && n.content.length > 22 ? '…' : '') + '</li>';
      }).join('') + '</ul>';
    }
    dataBox.className = 'state ok';
    dataBox.innerHTML = html;

    // ④ 最后更新时间
    lastUpdate.textContent = last ? ('最新一条记录更新于 ' + fmt(last)) : '暂无记录';

    // 顺手把④的改写目标指向「列表里最新一段」（GET 按 created_at 倒序，第一条即最新）
    setupPatch(notes.length ? notes[0] : null);
  }).catch(function (e) {
    var f = friendly(e);
    dataBox.className = 'state err';
    dataBox.textContent = '读取失败（' + f.label + '）· ' + f.message;
    setupPatch(null, e);
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
      var f = friendly(e);
      writeBox.className = 'state err';
      // 重复写入会被接口以 409 duplicate 拒绝，属正常，单独说明
      writeBox.textContent = '写入返回（' + f.label + '）：' + f.message +
        (e.code === 'duplicate' ? '（已存在，属正常）' : '');
    });
  });

  /* ================= ⑤ 改写一段心得（PATCH） ================= */

  function setupPatch(note, err) {
    if (!note) {
      var f = err ? friendly(err) : null;
      patchTarget.textContent = err
        ? '取不到心得列表（' + f.label + '）：' + f.message
        : 'notes 表还是空的，先写一段心得再来试改写。';
      patchForm.hidden = true;
      return;
    }
    pick = note;
    var title = titleMap[note.book_id];
    patchTarget.innerHTML = '改写目标：<code>' + escapeHtml(note.id) + '</code> · ' +
      (title ? '《' + escapeHtml(title) + '》' : '未关联书名') +
      '<br><span class="diff-before">改之前</span> 正文：' + escapeHtml(note.content) +
      ' ／ 心情：' + escapeHtml(moodsText(moodsOf(note))) +
      ' ／ 改写时间：' + escapeHtml(note.updated_at ? fmt(note.updated_at) : '（还没改过）');

    // 回填表单：正文照抄原样（改不改由人决定，页面不自作主张）
    patchContent.value = note.content;
    selectedMoods = moodsOf(note);
    patchMoods.innerHTML = '';
    MOODS.forEach(function (m) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mood-item' + (selectedMoods.indexOf(m) !== -1 ? ' selected' : '');
      btn.textContent = m;
      btn.setAttribute('aria-pressed', selectedMoods.indexOf(m) !== -1 ? 'true' : 'false');
      btn.addEventListener('click', function () {
        var i = selectedMoods.indexOf(m);
        if (i === -1) selectedMoods.push(m); else selectedMoods.splice(i, 1);
        btn.classList.toggle('selected', selectedMoods.indexOf(m) !== -1);
        btn.setAttribute('aria-pressed', selectedMoods.indexOf(m) !== -1 ? 'true' : 'false');
      });
      patchMoods.appendChild(btn);
    });
    patchForm.hidden = false;
  }

  // 改之前 / 改之后 并排表——交付截图要的就是这张
  function diffTable(before, touched) {
    var rows = [
      ['正文', escapeHtml(before.content), escapeHtml(touched.content)],
      ['心情', escapeHtml(moodsText(before.mood)), escapeHtml(moodsText(touched.mood))],
      ['改写时间', escapeHtml(before.updated_at ? fmt(before.updated_at) : '（还没改过）'),
        escapeHtml(touched.updated_at ? fmt(touched.updated_at) : '—')],
    ];
    return '<table class="diff-table"><thead><tr><th>字段</th><th>改之前</th><th>改之后</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var same = r[1] === r[2];
        return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td><td class="' +
          (same ? 'diff-same' : 'diff-changed') + '">' + r[2] + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  patchSave.addEventListener('click', function () {
    if (!pick) return;
    var text = patchContent.value.trim();
    if (!text) {
      patchBox.hidden = false;
      patchBox.className = 'state err';
      patchBox.textContent = '正文不能改成空白，写一点再存吧。';
      return;
    }
    var before = { content: pick.content, mood: moodsOf(pick), updated_at: pick.updated_at };
    // 没改任何东西就先别发请求：PATCH 的意义是"改我动的字段"，没动就别动数据库
    if (text === before.content && selectedMoods.join(',') === before.mood.join(',')) {
      patchBox.hidden = false;
      patchBox.className = 'state err';
      patchBox.textContent = '正文和心情都跟原来一样，先改一处再保存。';
      return;
    }

    patchBox.hidden = false;
    patchBox.className = 'state';
    patchBox.textContent = '改写中…';
    patchSave.disabled = true;

    api.updateNote(pick.id, { content: text, mood: selectedMoods.slice() }).then(function (note) {
      patchSave.disabled = false;
      patchBox.className = 'state ok';
      patchBox.innerHTML =
        '<p>接口返回 200 <code>{"ok":true,"note":{…}}</code> —— ' +
        'GET <code>/api/notes</code> 里这一段的值已经跟着变了：</p>' +
        diffTable(before, { content: note.content, mood: moodsOf(note), updated_at: note.updated_at });
      // 目标更新为改后的样子，方便接着再改一次或转去⑤删它
      pick = note;
    }).catch(function (e) {
      patchSave.disabled = false;
      var f = friendly(e);
      patchBox.className = 'state err';
      patchBox.textContent = '改写没成（' + f.label + (f.status ? ' ' + f.status : '') + '）· ' + f.message;
    });
  });

  /* ================= ⑥ 删除一段心得（DELETE） ================= */

  deleteBtn.addEventListener('click', function () {
    // 二次确认：先把"后果"说清楚，再让人决定（删除比新增更容易出事，就栽在这一步）
    openDeleteConfirm();
  });

  function openDeleteConfirm() {
    if (!pick) {
      deleteBox.hidden = false;
      deleteBox.className = 'state err';
      deleteBox.textContent = '还没取到可删的心得（notes 表可能是空的）。';
      return;
    }
    deleteBox.hidden = false;
    deleteBox.className = 'state';
    deleteBox.innerHTML =
      '<p>要把 <code>' + escapeHtml(pick.id) + '</code> 这段删掉吗？删掉后不可找回。</p>' +
      '<div class="diff-actions">' +
        '<button type="button" class="entry subtle" id="delete-cancel">留一留</button>' +
        '<button type="button" class="entry subtle danger" id="delete-confirm">确认删除</button>' +
      '</div>';
    document.getElementById('delete-cancel').addEventListener('click', function () {
      deleteBox.className = 'state';
      deleteBox.textContent = '好，那就留着它。';
    });
    document.getElementById('delete-confirm').addEventListener('click', doDelete);
  }

  function doDelete() {
    var id = pick.id;
    var beforeCount = null;
    deleteBox.className = 'state';
    deleteBox.textContent = '删除中…';

    // 删之前先数一遍（GET），删完再数一遍——「该条不再返回」才算闭环
    api.getNotes().then(function (ns) {
      beforeCount = ns.length;
      return api.removeNote(id);
    }).then(function () {
      return api.getNotes();
    }).then(function (after) {
      var stillThere = after.some(function (n) { return n.id === id; });
      deleteBox.className = 'state ok';
      deleteBox.innerHTML =
        '<p>接口返回 200 <code>{"ok":true,"id":"' + escapeHtml(id) + '"}</code></p>' +
        '<table class="diff-table"><thead><tr><th>核对项</th><th>删除前</th><th>删除后</th></tr></thead><tbody>' +
          '<tr><th>GET /api/notes 条数</th><td>' + beforeCount + ' 段</td><td class="diff-changed">' + after.length + ' 段</td></tr>' +
          '<tr><th>返回里还有 ' + escapeHtml(id) + ' 吗</th><td>有</td><td class="' +
            (stillThere ? 'diff-same' : 'diff-changed') + '">' +
            (stillThere ? '还在（异常，请复查）' : '已消失 ✓') + '</td></tr>' +
        '</tbody></table>' +
        '<p class="diff-note">现在返回的 id：' +
          escapeHtml(after.slice(0, 6).map(function (n) { return n.id; }).join('、')) +
          (after.length > 6 ? ' …' : '') + '</p>';
      // 删掉的那条不能再当改写目标了，重新指向当前最新一段
      setupPatch(after.length ? after[0] : null);
    }).catch(function (e) {
      var f = friendly(e);
      deleteBox.className = 'state err';
      deleteBox.textContent = '删除返回（' + f.label + (f.status ? ' ' + f.status : '') + '）：' + f.message;
    });
  }
})();
