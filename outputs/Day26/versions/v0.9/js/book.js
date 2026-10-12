/* P2 书籍录入页逻辑（F2 手动输入书籍名称）
 * 用户动作：在输入框手填书名并提交 → 系统写入 book，展示该书卡片，引导进入书写空间。
 * 全程不依赖外部书库，纯手动、轻量、零等待（见 PRD §F2）。 */

const form = document.getElementById('book-form');
const input = document.getElementById('book-title');
const emptyTip = document.getElementById('book-empty');
const card = document.getElementById('book-card');
const nameEl = document.getElementById('book-name');
const dateEl = document.getElementById('book-date');
const toNote = document.getElementById('to-note');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  const title = input.value.trim();

  // 空输入：温柔拦截，不抛生硬报错（见 TECH_DESIGN §7）
  if (!title) {
    emptyTip.hidden = false;
    input.focus();
    return;
  }
  emptyTip.hidden = true;

  // 写入一条 book，并轻柔展示确认卡片
  const book = store.addBook(title);
  nameEl.textContent = book.title;
  dateEl.textContent = formatDate(book.created_at);
  card.hidden = false;
  input.value = '';

  // 引导进入该书的书写空间（把 bookId 带到 P3）
  toNote.href = 'note.html?book=' + encodeURIComponent(book.id);
  setTimeout(function () { toNote.focus(); }, 300);
});

// 把 ISO 时间转成温柔的中文日期
function formatDate(iso) {
  const d = new Date(iso);
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '年' + pad(d.getMonth() + 1) + '月' + pad(d.getDate()) + '日 '
       + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
