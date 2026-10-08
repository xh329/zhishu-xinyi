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
//
// Day 22 新增（PATCH / DELETE，契约第 7、8 项）：改写与删除的 SQL 同样只落在本文件，
// 接口层 index.js 依旧不写一行 SQL——分层约定不因为加接口而松动。
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

// 单条心得（Day 22 · PATCH/DELETE 用）：按主键取一行，取不到返回 null。
// 为什么先「取一条」而不是直接 UPDATE/DELETE：接口要能分辨「改成功了」和「这条压根不存在」，
// 才能给出 404 + 中文说明，而不是含糊地回一句 ok。
async function findNote(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, book_id, content, mood, user_id, created_at, updated_at FROM notes WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length ? shapeNote(rows[0]) : null;
}

// 局部改写（PATCH /api/notes/:id）：只 SET 调用方真的要改的字段，并刷新 updated_at。
// fields 可能含：content（string）、mood（数组或 null）、updatedAt（DATETIME 字符串）。
// 安全说明：SQL 里被拼进去的只有「列名」，且列名来自本函数自己的白名单（不是请求体原文）；
// 所有值一律走 ? 占位参数化，不做字符串拼接。
// 返回：受影响行数（0 = 该 id 不存在，交给接口层转 404）。
async function updateNote(id, fields) {
  const pool = getPool();
  const sets = [];
  const params = [];

  if (fields.content !== undefined) {
    sets.push('content = ?');
    params.push(fields.content);
  }
  if (fields.mood !== undefined) {
    sets.push('mood = ?');
    // mood 是 JSON 列：传 JSON 字符串（null 保持 SQL NULL），避免 mysql2 把数组拍成 "a,b" 这种非法 JSON
    params.push(fields.mood === null ? null : JSON.stringify(fields.mood));
  }
  sets.push('updated_at = ?');
  params.push(fields.updatedAt);
  params.push(id);

  const [res] = await pool.query('UPDATE notes SET ' + sets.join(', ') + ' WHERE id = ?', params);
  return res.affectedRows || 0;
}

// 删除一条心得（DELETE /api/notes/:id，契约第 8 项）。
// 返回受影响行数（0 = 该 id 不存在 → 接口层转 404）。
async function removeNote(id) {
  const pool = getPool();
  const [res] = await pool.query('DELETE FROM notes WHERE id = ?', [id]);
  return res.affectedRows || 0;
}

module.exports = { listNotes, findNote, updateNote, removeNote };
