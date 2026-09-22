/* P3 心得书写页逻辑（F3 书写读书心得）
 * 用户动作：在文本框写下内心感触、可选一个心情标签、点击"温柔留存" → 写入 note，关联该书。
 * 注意（AGENTS.md [D6-4]）：心得正文必须由用户本人书写，下面只做收集、校验与保存，绝不代写。 */

// 心情标签枚举，对应 TECH_DESIGN §4.1（可空）
const MOODS = ['平静', '温暖', '触动', '治愈', '思索', '困惑', '轻盈', '惆怅'];

const bookRef = document.getElementById('book-ref');
const content = document.getElementById('note-content');
const moodList = document.getElementById('mood-list');
const saveBtn = document.getElementById('save-note');
const savedTip = document.getElementById('saved-tip');

// 从 URL 取出书名对应的 bookId（由 P2 的"写几句心得"带过来）
const params = new URLSearchParams(location.search);
const bookId = params.get('book');

// 取出该书标题，显示在书写页顶部
const book = store.getBooks().find(function (b) { return b.id === bookId; });
if (book) {
  bookRef.textContent = '《' + book.title + '》';
} else {
  bookRef.textContent = '（未指定书名，也可直接写下此刻的感受）';
}

// 渲染心情标签，可点选 / 取消
let selectedMood = '';
MOODS.forEach(function (m) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mood-item';
  btn.textContent = m;
  btn.addEventListener('click', function () {
    if (selectedMood === m) {
      selectedMood = '';
      btn.classList.remove('selected');
    } else {
      selectedMood = m;
      moodList.querySelectorAll('.mood-item').forEach(function (el) { el.classList.remove('selected'); });
      btn.classList.add('selected');
    }
  });
  moodList.appendChild(btn);
});

// 保存心得
saveBtn.addEventListener('click', function () {
  const text = content.value.trim();
  if (!text) {
    content.focus();
    // 空内容不保存，给一句温柔的话（不抛生硬报错）
    if (!content.placeholder.includes('慢慢写')) {
      content.placeholder = '写点什么再保存吧。';
    }
    return;
  }

  store.addNote(bookId || '', text, selectedMood);
  content.value = '';
  savedTip.classList.add('show');
  setTimeout(function () { location.href = 'notes.html'; }, 1100);
});
