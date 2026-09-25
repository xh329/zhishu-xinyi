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
      title: title.trim(),
      user_id: USER_ID,
      created_at: new Date().toISOString(),
    };
    books.push(book);
    writeList('books', books);
    return book;
  },

  // 读取全部书籍（对应未来 GET /api/books）
  getBooks() {
    return readList('books');
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

  // 删除一条心得（对应未来 DELETE /api/notes/:id）
  removeNote(id) {
    const notes = this.getNotes().filter((n) => n.id !== id);
    writeList('notes', notes);
  },
};
