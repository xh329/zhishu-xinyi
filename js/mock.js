/* 栀书心驿 · 主视图 mock 数据（Day 8）
 *
 * 本文件只服务于「主视图 / mock 数据版」演示：提供本地假数据，
 * 不接任何真实 API（接真实接口是第 3 周的事）。
 * 上云后，js/main.js 里的读取逻辑整体替换为 store / REST 调用即可，
 * 页面与组件层无需改动。
 *
 * 数据字段沿用 PRD §3.1 与 TECH_DESIGN §4：
 *   book:  id / title / created_at
 *   note:  id / book_id / bookTitle(展示用) / content / mood / created_at
 *   mood 取值见 TECH_DESIGN §4.1 枚举，可空。
 */

// 最近在读的书（按录入时间倒序）
window.mockBooks = [
  {
    id: 'b_zhitaoyanguqi',
    title: '被讨厌的勇气',
    created_at: '2026-09-21T08:30:00+08:00',
  },
  {
    id: 'b_xiaowangzi',
    title: '小王子',
    created_at: '2026-09-19T22:10:00+08:00',
  },
  {
    id: 'b_renjianzhide',
    title: '人间值得',
    created_at: '2026-09-15T21:05:00+08:00',
  },
  {
    id: 'b_yehangxifei',
    title: '夜航西飞',
    created_at: '2026-09-12T20:40:00+08:00',
  },
];

// 最近的读书心得（按书写时间倒序）
window.mockNotes = [
  {
    id: 'n_1',
    book_id: 'b_zhitaoyanguqi',
    bookTitle: '被讨厌的勇气',
    content: '所谓自由，就是被别人讨厌。读到这句，忽然松了一口气——原来不必讨好所有人。',
    mood: '治愈',
    created_at: '2026-09-21T08:45:00+08:00',
  },
  {
    id: 'n_2',
    book_id: 'b_xiaowangzi',
    bookTitle: '小王子',
    content: '“你下午四点来，那么从三点起我就开始感到幸福。” 慢一点，也很好。',
    mood: '温暖',
    created_at: '2026-09-19T22:25:00+08:00',
  },
  {
    id: 'n_3',
    book_id: 'b_renjianzhide',
    bookTitle: '人间值得',
    content: '凡事看开一点，与其勉强，不如顺其自然地生活。今天有点被接住的感觉。',
    mood: '平静',
    created_at: '2026-09-15T21:20:00+08:00',
  },
  {
    id: 'n_4',
    book_id: 'b_yehangxifei',
    bookTitle: '夜航西飞',
    content: '她写非洲的天空，辽阔得让人忘记自己。我也想有这样一片可以发呆的天。',
    mood: '思索',
    created_at: '2026-09-12T20:55:00+08:00',
  },
];
