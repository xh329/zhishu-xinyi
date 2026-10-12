/* 栀书心驿 · 本地存储封装（store）
 *
 * 对应 TECH_DESIGN §5：MVP 用浏览器 localStorage 替代"后端 API + 数据库"。
 * 函数名与未来云版 REST 接口一一对应，上云时只需把函数体换成 fetch 调用，
 * 页面层（home / book / note / notes.js）基本不动。
 *
 * 数据始终留在用户自己的浏览器里，不上传任何服务器（见 TECH_DESIGN §12）。
 */

// 存储命名空间前缀（TECH_DESIGN §8 可选 STORAGE_KEY）
const STORAGE_KEY = 'zhishu_';
// MVP 单用户本地场景，user_id 固定为 local（上云后改为真实登录用户）
const USER_ID = 'local';

// 生成一个轻量唯一 ID（时间戳 + 随机串），无需引入额外依赖
function makeId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 书名显示统一：剥掉用户自己输入的《》再入库，显示处只负责加一对书名号，
// 避免出现《《被讨厌的勇气》》这样的双书名号（录入提示里本就带着《》，用户照抄很常见）。
function bareTitle(title) {
  return String(title == null ? '' : title).trim().replace(/^《\s*/, '').replace(/\s*》$/, '').trim();
}

// 安全读取：解析失败返回空数组，避免一条坏数据拖垮整个页面
function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY + key)) || [];
  } catch (e) {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(STORAGE_KEY + key, JSON.stringify(list));
}

const store = {
  // F2 录入书名：写入一条 book（对应未来 POST /api/books）
  addBook(title) {
    const books = this.getBooks();
    const book = {
      id: makeId('b_'),
      title: bareTitle(title),
      user_id: USER_ID,
      created_at: new Date().toISOString(),
    };
    books.push(book);
    writeList('books', books);
    return book;
  },

  // 读取全部书籍（对应未来 GET /api/books）：书名统一去掉用户自带的书名号
  getBooks() {
    return readList('books').map((b) => ({ ...b, title: bareTitle(b.title) }));
  },

  // F3 写心得：写入一条 note，关联 book_id（对应未来 POST /api/notes）
  // mood 为心情标签数组（支持多选，可空）；旧数据可能是单字符串，渲染处会做兼容
  addNote(bookId, content, mood) {
    const notes = this.getNotes();
    const note = {
      id: makeId('n_'),
      book_id: bookId,
      content: content.trim(),
      mood: mood || [],
      user_id: USER_ID,
      created_at: new Date().toISOString(),
    };
    notes.push(note);
    writeList('notes', notes);
    return note;
  },

  // 读取全部心得（对应未来 GET /api/notes）
  getNotes() {
    return readList('notes');
  },

  // 读取某本书的心得（对应未来 GET /api/books/:id/notes）
  getNotesByBook(bookId) {
    return this.getNotes().filter((n) => n.book_id === bookId);
  },

  // 改写一条心得（对应未来 PUT /api/notes/:id）：更新正文与心情，留下修改时间
  // 用户反馈：写完的心得应能自由修改，故补齐这一层
  updateNote(id, content, mood) {
    const notes = this.getNotes();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    notes[idx].content = content.trim();
    notes[idx].mood = mood || [];
    notes[idx].updated_at = new Date().toISOString();
    writeList('notes', notes);
    return notes[idx];
  },

  // 删除一条心得（对应未来 DELETE /api/notes/:id）
  removeNote(id) {
    const notes = this.getNotes().filter((n) => n.id !== id);
    writeList('notes', notes);
  },
};

/* ============================================================================
 * 离线可用层（静态部署版）
 * ----------------------------------------------------------------------------
 * 背景：Day 20 起数据层走的是 js/api.js（CloudBase 公网接口）。该环境已不可用，
 *   而本站是纯静态部署（WorkBuddy），没有后端可连。因此把数据来源接回本地存储，
 *   让四个视图、写心得页、检查台在无后端时也能完整跑通。
 *
 * 做法（改动最小、页面逻辑一行不动）：
 *   ① window.ZhiShu.api —— 与 js/api.js 同名同形的异步接口，只是把数据写到
 *      localStorage。views.js / check.js 无需任何修改即可工作。
 *   ② friendlyError —— 原在 api.js 里，是错误文案的统一出口；这里补一份等价的，
 *      让页面在任何情况下都能给出温柔中文，而不是裸报错。
 *   ③ components.js 依赖 window.ZhiShu，离线页面（book/note/notes）也已引入。
 * 说明：真正上云时，把本段注释掉的 api.js / config.js 重新引回即可切回云端。
 * ========================================================================== */
window.ZhiShu = window.ZhiShu || {};
window.ZhiShu.escapeHtml = window.ZhiShu.escapeHtml || function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

(function (Z) {
  // 三类错误 → 中文人话（与 js/api.js 的 friendlyError 保持一致）
  var ERROR_KINDS = {
    input:   { label: '输入错',   message: '有几处还需要你确认一下，改好再试一次吧。' },
    network: { label: '网络错',   message: '网络好像断了一下，检查一下连接，再试一次吧。' },
    server:  { label: '服务端错', message: '驿站这边出了点小状况，过一会儿再来看看吧。' },
  };
  Z.friendlyError = Z.friendlyError || function (err) {
    var e = err || {};
    var kind = e.status === 400 || e.status === 404 || e.status === 409 ? 'input' : 'server';
    var info = ERROR_KINDS[kind];
    return {
      kind: kind,
      label: info.label,
      message: (typeof e.serverMessage === 'string' && e.serverMessage.trim()) || info.message,
      code: e.code || ('local_' + kind),
      status: Number(e.status || 0),
    };
  };

  // 本地数据层的异步包装：把 store 的同步方法包成 Promise，
  // 形状与 js/api.js 完全一致，页面层感受不到差别。
  function asyncFrom(fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      return new Promise(function (resolve) {
        // 刻意留一小段延时，让「正在为你整理…」的加载态能被看见（与云端体验一致）
        setTimeout(function () { resolve(fn.apply(null, args)); }, 220);
      });
    };
  }

  Z.api = {
    health: asyncFrom(function () {
      return { ok: true, mode: 'local', storage: 'localStorage', time: new Date().toISOString() };
    }),
    getBooks: asyncFrom(function (limit) {
      var books = store.getBooks();
      return typeof limit === 'number' ? books.slice(0, limit) : books;
    }),
    getNotes: asyncFrom(function (limit) {
      var notes = store.getNotes();
      return typeof limit === 'number' ? notes.slice(0, limit) : notes;
    }),
    getNotesByBook: asyncFrom(function (bookId) { return store.getNotesByBook(bookId); }),
    addBook: asyncFrom(function (title) { return store.addBook(title); }),
    addNote: asyncFrom(function (bookId, content, mood) { return store.addNote(bookId, content, mood); }),
    updateNote: asyncFrom(function (id, fields) {
      return store.updateNote(id, fields && fields.content, fields && fields.mood);
    }),
    removeNote: asyncFrom(function (id) { return store.removeNote(id); }),
  };
})(window.ZhiShu);

