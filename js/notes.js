/* P4 我的心得列表页逻辑（回看沉淀的内心）
 * 读取全部 note，按时间倒序以诗意卡片展示；无记录时展示空状态文案。 */

const listEl = document.getElementById('notes-list');
const emptyEl = document.getElementById('empty');

// 建一个 bookId → 书名 的映射，方便卡片上显示《书名》
const bookMap = {};
store.getBooks().forEach(function (b) { bookMap[b.id] = b.title; });

// 取出全部心得，按书写时间从新到旧排列
const notes = store.getNotes().slice().sort(function (a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
});

if (notes.length === 0) {
  emptyEl.hidden = false;
  listEl.hidden = true;
} else {
  notes.forEach(function (n) {
    const bookName = bookMap[n.book_id] ? '《' + bookMap[n.book_id] + '》' : '（未关联书名）';

    const card = document.createElement('div');
    card.className = 'note-card';

    const top = document.createElement('div');
    top.className = 'nc-top';
    const name = document.createElement('span');
    name.className = 'nc-book';
    name.textContent = bookName;
    top.appendChild(name);
    if (n.mood) {
      const mood = document.createElement('span');
      mood.className = 'nc-mood';
      mood.textContent = n.mood;
      top.appendChild(mood);
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

function formatDate(iso) {
  const d = new Date(iso);
  const pad = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '年' + pad(d.getMonth() + 1) + '月' + pad(d.getDate()) + '日 '
       + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
