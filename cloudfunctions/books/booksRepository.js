'use strict';

// 栀书心驿 · 书籍数据访问层（Repository）
// ─────────────────────────────────────────────────────────────
// 分层职责（Day 19 重构）：
//   · 本文件是「数据访问层」——books 表所有 SQL 查询集中在这里；
//   · 接口层 index.js 只负责「接请求、做校验、调函数、返响应」，不再直接写 SQL；
//   · 基础设施层 db.js 提供连接池与「行 → 契约形状」的映射（toISO / shapeBook）。
//
// 行为约束：SQL 文本与契约响应形状与原先完全一致，此处只做「位置迁移」，不改动任何逻辑。
// 因此重构后所有接口行为不变、响应形状不变。
// ─────────────────────────────────────────────────────────────

const { getPool, shapeBook } = require('./db');

// 书籍列表（书架）：按 user_id 查询，收录时间倒序，limit 钳制在 [1,100]。
// 返回：已按契约形状 shapeBook 后的书籍对象数组（不含分页元信息，与重构前一致）。
async function listBooks(userId, limit) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(100, limit || 100));
  const [rows] = await pool.query(
    'SELECT id, title, user_id, created_at FROM books WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, safeLimit]
  );
  return rows.map(shapeBook);
}

// 新增书籍：参数化 INSERT，杜绝 SQL 注入。
// 入参 createdAt 为 DATETIME 字符串（来自接口层的 toMySQLDate）；
// 返回 shapeBook 后的书籍对象。重复收录会抛 ER_DUP_ENTRY，由接口层捕获转成 duplicate。
async function createBook({ id, title, userId, createdAt }) {
  const pool = getPool();
  await pool.query(
    'INSERT INTO books (id, title, user_id, created_at) VALUES (?, ?, ?, ?)',
    [id, title, userId, createdAt]
  );
  return shapeBook({ id, title, user_id: userId, created_at: createdAt });
}

module.exports = { listBooks, createBook };
