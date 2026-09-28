/* Day 13 截图用的示例数据（仅本地浏览器，用于演示成功态）
 * 心得正文一律为占位文本——真实的内心感触请由本人书写（AGENTS.md [D6-4]）。 */
(function () {
  try {
    var books = [
      { id: 'demo_b1', title: '被讨厌的勇气', user_id: 'local', created_at: '2026-09-21T08:30:00+08:00' },
      { id: 'demo_b2', title: '小王子',       user_id: 'local', created_at: '2026-09-19T22:10:00+08:00' },
      { id: 'demo_b3', title: '人间值得',     user_id: 'local', created_at: '2026-09-15T21:05:00+08:00' },
    ];
    var notes = [
      { id: 'demo_n1', book_id: 'demo_b1', content: '（示例心得）读到第 118 页，在这里划了一条线。', mood: ['治愈'], user_id: 'local', created_at: '2026-09-21T08:45:00+08:00' },
      { id: 'demo_n2', book_id: 'demo_b2', content: '（示例心得）第二十一章，合上书停了一会儿。', mood: ['温暖', '思索'], user_id: 'local', created_at: '2026-09-19T22:25:00+08:00' },
      { id: 'demo_n3', book_id: 'demo_b3', content: '（示例心得）今天有点被接住的感觉。', mood: ['平静'], user_id: 'local', created_at: '2026-09-15T21:20:00+08:00' },
    ];
    localStorage.setItem('zhishu_books', JSON.stringify(books));
    localStorage.setItem('zhishu_notes', JSON.stringify(notes));
    return 'seeded books=' + books.length + ' notes=' + notes.length;
  } catch (e) {
    return 'seed-failed:' + e.message;
  }
})();
