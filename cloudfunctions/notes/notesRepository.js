'use strict';

// 栀书心驿 · 心得数据访问层（Repository）
// ─────────────────────────────────────────────────────────────
// 分层职责（Day 19 重构）：
//   · 本文件是「数据访问层」——notes 表所有 SQL 查询集中在这里；
//   · 接口层 index.js 只负责「接请求、调函数、返响应」，不再直接写 SQL；
//   · 基础设施层 db.js 提供连接池与「行 → 契约形状」的映射（toISO / shapeNote）。
//
// 行为约束：SQL 文本与契约响应形状与原先完全一致，此处只做「位置迁移」，不改动任何逻辑。
// 因此重构后所有接口行为不变、响应形状不变。
// ─────────────────────────────────────────────────────────────

const { getPool, shapeNote } = require('./db');

// 全部心得列表（心迹 · 记录表读取）：按 user_id 查询，写入时间倒序，limit 钳制 [1,100]。
// 返回：已按契约形状 shapeNote 后的心得对象数组。
async function listNotes(userId, limit) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(100, limit || 100));
  const [rows] = await pool.query(
    'SELECT id, book_id, content, mood, user_id, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, safeLimit]
  );
  return rows.map(shapeNote);
}

module.exports = { listNotes };
