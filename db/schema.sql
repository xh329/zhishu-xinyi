-- ============================================================
-- 栀书心驿（zhishu-xinyi）· 数据库结构
-- 文件：db/schema.sql
-- 方言：MySQL（兼容 CloudBase 云数据库 MySQL / TDSQL-C）
-- 可重复执行：每次先 DROP 再 CREATE，结构幂等、重跑不报错
-- 设计依据：api-contract.md §一「数据模型（两张表）」
--
-- 两张表分别存什么、靠哪个字段关联：
--   books  —— 存“用户收录的每本书的元信息”（书名、归属用户、收录时间）
--   notes  —— 存“用户为某本书写下的读书心得”（正文、心情、时间）
--   关联字段：notes.book_id → books.id（一对多：一本书可有多段心得）
-- ============================================================

-- 先删子表，再删父表（外键约束要求子表先不存在才能删父表）
DROP TABLE IF EXISTS `notes`;
DROP TABLE IF EXISTS `books`;

-- ------------------------------------------------------------
-- 表 1：books（书籍表）
-- 存什么：用户收录的每一本书的元信息
-- ------------------------------------------------------------
CREATE TABLE `books` (
  `id`         VARCHAR(32)  NOT NULL COMMENT '主键，形如 b_xxx（时间戳+随机串），业务生成的短字符串，非自增整数',
  `title`      VARCHAR(255) NOT NULL COMMENT '书名，手动录入，必填',
  `user_id`    VARCHAR(32)  NOT NULL DEFAULT 'local' COMMENT '用户标识；MVP 本地态固定 local，上云后改为真实登录用户',
  `created_at` DATETIME     NOT NULL COMMENT '收书时间（DB 列类型 DATETIME；接口层收发 ISO8601 字符串，由云函数做格式转换）',
  PRIMARY KEY (`id`),
  -- 业务唯一约束：只加在业务字段上（用户 + 书名），不约束 id
  -- 同一用户不重复收录同一书名；若业务允许重读再收录，可删除本约束
  UNIQUE KEY `uk_books_user_title` (`user_id`, `title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='书籍表：用户收录的书籍元信息';

-- ------------------------------------------------------------
-- 表 2：notes（读书心得 / 心迹表）
-- 存什么：用户为某本书写下的读书心得（正文、心情、时间）
-- 关联：book_id → books.id（一对多）
-- ------------------------------------------------------------
CREATE TABLE `notes` (
  `id`         VARCHAR(32) NOT NULL COMMENT '主键，形如 n_xxx',
  `book_id`    VARCHAR(32) NOT NULL COMMENT '外键 → books.id，所属书籍',
  `content`    TEXT         NOT NULL COMMENT '心得正文，长度不定，用 TEXT 避免 VARCHAR 截断',
  `mood`       JSON        NULL     COMMENT '心情标签数组，如 ["平静"]；可空（用户不点也算合法）',
  `user_id`    VARCHAR(32) NOT NULL DEFAULT 'local' COMMENT '用户标识',
  `created_at` DATETIME    NOT NULL COMMENT '写下时间',
  `updated_at` DATETIME    NULL     COMMENT '改写时间，未改过为 NULL',
  PRIMARY KEY (`id`),
  -- 外键：心得必须挂在已存在的书之下；删书时连同其心得一起清理（CASCADE）
  CONSTRAINT `fk_notes_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='读书心得 / 心迹表：用户为书所写的心得';
