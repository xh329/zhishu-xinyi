'use strict';

// 栀书心驿 · 数据库连接（CloudBase 云函数 · mysql2）
// 连接信息一律走环境变量，不写死任何账号/密码（符合项目隐私红线 AGENTS.md [D6-5]）
// 必填：DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
// 可选：DB_CONNECTION_LIMIT（连接池上限，默认 1，适配云函数低频场景）

let pool = null;

function getPool() {
  if (pool) return pool;
  // 延迟加载 mysql2：非 Node 环境或无依赖时不致崩溃
  const mysql = require('mysql2/promise');
  const cfg = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 1),
    // 云函数冷启动后旧连接可能失效，开启连接保活与等待队列
    enableKeepAlive: true,
    waitForConnections: true,
  };
  pool = mysql.createPool(cfg);
  return pool;
}

// DATETIME('YYYY-MM-DD HH:MM:SS') → ISO8601('YYYY-MM-DDTHH:MM:SS')
// 数据库存的是无时区的朴素时间；接口层统一转成 ISO 字符串（不加 Z，避免被误当 UTC）。
// 这正是「契约响应形状」与「表列类型」对不上的地方：表里是 DATETIME，接口要 ISO 字符串。
function toISO(dt) {
  if (dt == null) return null;
  if (typeof dt === 'string') {
    // 已是字符串：把空格换成 T 即 ISO 本地时间
    return dt.replace(' ', 'T');
  }
  // Date 对象（mysql2 对 DATETIME 列默认返回 Date）：取本地时间格式化
  const pad = (n) => String(n).padStart(2, '0');
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  const ss = pad(dt.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

// 一行 notes 记录 → 契约响应形状
function shapeNote(row) {
  let mood = row.mood;
  // mood 在 MySQL 是 JSON 列；mysql2 通常已自动解析为数组/对象，但兜底再 parse 一次（NULL 即 null）
  if (typeof mood === 'string') {
    try { mood = JSON.parse(mood); } catch (_) { /* 解析失败保留原值 */ }
  }
  return {
    id: row.id,
    book_id: row.book_id,
    content: row.content,
    mood,
    user_id: row.user_id,
    created_at: toISO(row.created_at),
    updated_at: toISO(row.updated_at),
  };
}

// 一行 books 记录 → 契约响应形状
function shapeBook(row) {
  return {
    id: row.id,
    title: row.title,
    user_id: row.user_id,
    created_at: toISO(row.created_at),
  };
}

module.exports = { getPool, toISO, shapeNote, shapeBook };
