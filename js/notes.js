/* P4 我的心得列表页逻辑（回看沉淀的内心）
 *
 * Day 12 筛选交互：按书名或关键字轻轻筛一筛——
 *   有结果：只显示匹配的卡片，并回执「找到了几篇」（结果规则）；
 *   无结果：温柔承接的空状态文案，换一个词或去写下一篇（空状态文案）；
 *   清空后：恢复显示全部心得（恢复规则）。
 * 筛选只读 localStorage（store.getNotes），不改动任何存量数据。 */

const listEl = document.getElementById('notes-list');
const emptyEl = document.getElementById('empty');
const filterInput = document.getElementById('filter-input');
const filterStatus = document.getElementById('filter-status');
const filterEmptyEl = document.getElementById('filter-empty');
const filterEmptyText = document.getElementById('filter-empty-text');

// 建一个 bookId → 书名 的映射，方便卡片上显示《书名》，筛选时也用它匹配书名
const bookMap = {};
store.getBooks().forEach(function (b) { bookMap[b.id] = b.title; });

// 全量心得按书写时间从新到旧排列；筛选只是在这个副本上做，不动原数据
const allNotes = store.getNotes().slice().sort(function (a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
});

// 把一组心得渲染成卡片列表（Day 12 起渲染可被筛选反复调用）
function renderNotes(list) {
  listEl.innerHTML = '';
  list.forEach(function (n) {
    const bookName = bookMap[n.book_id] ? '《' + bookMap[n.book_id] + '》' : '（未关联书名）';

    const card = document.createElement('div');
    card.className = 'note-card';

    const top = document.createElement('div');
    top.className = 'nc-top';
    const name = document.createElement('span');
    name.className = 'nc-book';
    name.textContent = bookName;
    top.appendChild(name);
    // mood 可能是单字符串（旧数据）或数组（多选），统一成数组后成组展示（整体靠右，不散开）
    const moods = Array.isArray(n.mood) ? n.mood : (n.mood ? [n.mood] : []);
    if (moods.length) {
      const moodsWrap = document.createElement('span');
      moodsWrap.className = 'nc-moods';
      moods.forEach(function (m) {
        const mood = document.createElement('span');
        mood.className = 'nc-mood';
        mood.textContent = m;
        moodsWrap.appendChild(mood);
      });
      top.appendChild(moodsWrap);
    }

    const date = document.createElement('div');
    date.className = 'nc-date';
    date.textContent = formatDate(n.created_at);

    const body = document.createElement('div');
    body.className = 'nc-content';
    body.textContent = n.content;

    card.appendChild(top);
    card.appendChild(date);
    card.appendChild(body);
    listEl.appendChild(card);
  });
}

/* 应用当前筛选条件，处理三种情况：
 * ① 输入为空（或清空）：恢复全部，回到「全空」或「全量」两种原始状态；
 * ② 有匹配：只渲染匹配卡片 + 一行回执（aria-live 区域，见 notes.html）；
 * ③ 无匹配：隐藏列表，显示温柔的空状态文案。 */
function applyFilter() {
  const raw = filterInput.value.trim();
  const kw = raw.toLowerCase();

  if (kw === '') {
    // 清空恢复：回到没有筛选词的原始视图
    filterStatus.textContent = '';
    filterEmptyEl.hidden = true;
    if (allNotes.length === 0) {
      listEl.hidden = true;
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      listEl.hidden = false;
      renderNotes(allNotes);
    }
    return;
  }

  const matched = allNotes.filter(function (n) {
    const bookName = (bookMap[n.book_id] || '').toLowerCase();
    const content = (n.content || '').toLowerCase();
    return bookName.indexOf(kw) !== -1 || content.indexOf(kw) !== -1;
  });

  emptyEl.hidden = true; // 有筛选词时，「全空」状态不参与

  if (matched.length === 0) {
    // 无结果：温柔承接，不吓人，给一个可点的去处
    listEl.hidden = true;
    filterStatus.textContent = '';
    filterEmptyText.textContent = '「' + raw + '」还没有对应的心得。换一个词试试，或者去写下一篇吧。';
    filterEmptyEl.hidden = false;
  } else {
    // 有结果：只显示匹配的卡片，并回执找到了几篇
    listEl.hidden = false;
    filterEmptyEl.hidden = true;
    renderNotes(matched);
    filterStatus.textContent = '轻轻找到了 ' + matched.length + ' 篇与「' + raw + '」相关的心得';
  }
}

// 每次输入（包括原生清空按钮的 ✕）都会重新应用筛选；本地数据量小，无需防抖
filterInput.addEventListener('input', applyFilter);

// 初次进入页面：等价于「筛选词为空」的情况，渲染全部
applyFilter();

function formatDate(iso) {
  const d = new Date(iso);
  const pad = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '年' + pad(d.getMonth() + 1) + '月' + pad(d.getDate()) + '日 '
       + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
