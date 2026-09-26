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
const emptyTip = document.getElementById('note-empty');
const undoBtn = document.getElementById('undo-save');
const failTip = document.getElementById('save-fail');

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

// 渲染心情标签，可多选 / 取消（人们的感受往往是多面的，不止一个词能描述）
let selectedMoods = [];
const moodButtons = []; // 记录 { 按钮, 心情 }，撤销时用它把选中状态恢复回去
MOODS.forEach(function (m) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mood-item';
  btn.textContent = m;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', function () {
    const idx = selectedMoods.indexOf(m);
    if (idx === -1) {
      selectedMoods.push(m);
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      selectedMoods.splice(idx, 1);
      btn.classList.remove('selected');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
  moodButtons.push({ btn: btn, mood: m });
  moodList.appendChild(btn);
});

// 依据 selectedMoods 同步所有心情按钮的选中外观（撤销回填时用）
function syncMoodButtons() {
  moodButtons.forEach(function (pair) {
    const on = selectedMoods.indexOf(pair.mood) !== -1;
    pair.btn.classList.toggle('selected', on);
    pair.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// 用户重新写起来后，收起"空内容"提示（提示只在真的没写时才出现）
content.addEventListener('input', function () {
  if (!emptyTip.hidden && content.value.trim()) emptyTip.hidden = true;
});

// ---- Day 11 交互反馈：保存按钮的状态机 ----
// idle（空闲）→ busy（收存中：按钮禁用 + 加载动画，防连点）→ done（已收好：成功反馈 + 撤销窗口）
// 失败时回到 idle 并温柔提示。原布局与最终跳转行为保持不变。
let saveState = 'idle';
let redirectTimer = null;
let lastSaved = null; // 撤销要用：{ id, text, moods }

// 把按钮恢复到"空闲"外观
function resetSaveButton() {
  saveBtn.disabled = false;
  saveBtn.classList.remove('busy', 'done');
  saveBtn.textContent = '温柔留存';
}

saveBtn.addEventListener('click', function () {
  if (saveState !== 'idle') return; // 收存中 / 已收好期间再点不生效（连点防护）

  const text = content.value.trim();
  if (!text) {
    // 空内容：温柔拦截并给出可见提示（与 P2 录入页 #book-empty 一致），不抛生硬报错
    emptyTip.hidden = false;
    content.focus();
    return;
  }
  emptyTip.hidden = true;
  failTip.hidden = true;

  // ① 处理期间：禁用按钮并显示加载，让用户明确"正在生效"
  saveState = 'busy';
  saveBtn.disabled = true;
  saveBtn.classList.add('busy');
  saveBtn.textContent = '正在收存';

  // 本地写入其实很快，刻意停 0.6 秒让反馈可被感知；上云后把这里换成真实请求即可
  setTimeout(function () {
    let note;
    try {
      note = store.addNote(bookId || '', text, selectedMoods.slice());
    } catch (e) {
      // ② 失败：localStorage 写不进去（隐私模式 / 存储配额满），温柔告知并允许重试
      saveState = 'idle';
      resetSaveButton();
      failTip.hidden = false;
      return;
    }

    // ③ 成功：按钮定格为"已收好"，提示浮现，并给出反悔（撤销）窗口
    lastSaved = { id: note.id, text: text, moods: selectedMoods.slice() };
    saveState = 'done';
    saveBtn.classList.remove('busy');
    saveBtn.classList.add('done');
    saveBtn.textContent = '已收好';
    content.value = '';
    savedTip.textContent = '已为你收好，去"我的心得"看看吧。';
    savedTip.classList.add('show');
    undoBtn.hidden = false;

    // 1.6 秒内不撤销，就去"我的心得"（与原跳转行为一致，只是留出了反悔时间）
    redirectTimer = setTimeout(function () {
      location.href = 'notes.html';
    }, 1600);
  }, 600);
});

// ④ 撤销：把刚存进去的心得取回来，正文与心情回填，回到可继续修改的空闲态
// undoBtn 是原生 button，键盘 Enter / 空格即可触发（余力加练：键盘操作）
undoBtn.addEventListener('click', function () {
  if (saveState !== 'done') return;
  clearTimeout(redirectTimer);

  try {
    store.removeNote(lastSaved.id);
  } catch (e) {
    // 极少数情况取回失败：这条心得其实已收好，如实告知并照常去列表页
    failTip.textContent = '没能取回，不过这条心得已经好好收着了，去"我的心得"看看吧。';
    failTip.hidden = false;
    redirectTimer = setTimeout(function () { location.href = 'notes.html'; }, 1200);
    return;
  }

  // 取回成功：内容与心情标签都放回去
  content.value = lastSaved.text;
  selectedMoods = lastSaved.moods.slice();
  syncMoodButtons();

  saveState = 'idle';
  resetSaveButton();
  undoBtn.hidden = true;
  savedTip.classList.remove('show');
  savedTip.textContent = '已取回，想改哪里，慢慢改。';
  content.focus();
});
