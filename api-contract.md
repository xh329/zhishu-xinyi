# 栀书心驿 · 接口契约（api-contract）

> **性质**：第 3 周（Day 16–20）建数据表、写真实接口的**唯一依据**。
> **Day 15 状态**：仅登记占位，**不实现**。云函数 `/api/health` 已先行上线（见下），其余接口待 Day 16 起逐个落地。
> **推导来源**：前端 `index.html` 四个视图（#/home 今日 / #/books 书架 / #/books/:id 书页 / #/notes 心迹），以及本地存储层 `js/store.js`（`store.js` 的函数已与下方 REST 接口一一对应，上云时把函数体换成 `fetch` 即可）。
> **约定**：所有接口以 JSON 通信；成功响应带 `ok: true`，失败带 `ok: false` 与 `error` 错误码。跨域（CORS）Day 15 **不处理**，Day 16–20 再补。

---

## 一、数据模型（两张表）

### 1. books（书籍表）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键，形如 `b_xxx`（时间戳+随机串） |
| `title` | string | 书名，手动录入，**必填** |
| `user_id` | string | 用户标识。MVP 本地态固定为 `local`；上云后改为真实登录用户 |
| `created_at` | string(ISO8601) | 收书时间 |

### 2. notes（读书心得 / 心迹表）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键，形如 `n_xxx` |
| `book_id` | string | 外键 → `books.id`，关联所属书籍 |
| `content` | string | 心得正文 |
| `mood` | string[] | 心情标签数组，**可空** |
| `user_id` | string | 用户标识 |
| `created_at` | string(ISO8601) | 写下时间 |
| `updated_at` | string(ISO8601)\|null | 改写时间，未改过为 null |

### 数据库实现（Day 16 落地 · MySQL 方言）
> 两张表分别存什么、靠哪个字段关联，已定：
> - **books** 存「用户收录的每本书的元信息」（书名、归属用户、收录时间）；
> - **notes** 存「用户为某本书写下的读书心得」（正文、心情、时间）；
> - **关联字段：`notes.book_id` → `books.id`**（一对多：一本书可有多段心得，一段心得只属于一本书）。
>
> 建表脚本 `db/schema.sql`、种子脚本 `db/seed.sql`（每表 ≥5 行、可重复执行）。下表为契约字段到 SQL 列类型的落地映射，类型选择理由见「为什么这么选」。

| 表 | 字段 | SQL 列类型 | 约束 | 为什么这么选 |
| --- | --- | --- | --- | --- |
| books | `id` | `VARCHAR(32)` | PK | 形如 `b_xxx` 的业务短字符串主键，保留前缀可读性、便于排查，故不用自增整数 |
| books | `title` | `VARCHAR(255)` | NOT NULL | 书名必填；长度一般 < 100 字，`VARCHAR` 足够且省空间 |
| books | `user_id` | `VARCHAR(32)` | NOT NULL DEFAULT 'local' | 与 id 同源的字符串风格；MVP 固定 `local`，上云改真实登录用户 |
| books | `created_at` | `DATETIME` | NOT NULL | 收书时间；用 `DATETIME` 便于排序/范围查询（接口层仍收发 ISO8601 字符串，云函数做 `DATETIME ↔ ISO8601` 转换，契约字段不变） |
| books | — | — | UNIQUE(`user_id`,`title`) | **业务唯一约束加在业务字段上**：同一用户不重复收录同一书名；若允许重读再收录可删除 |
| notes | `id` | `VARCHAR(32)` | PK | 形如 `n_xxx` |
| notes | `book_id` | `VARCHAR(32)` | NOT NULL, FK→books.id | **关联字段**；`ON DELETE CASCADE`——删书时连同其心得一起清理，避免孤儿数据 |
| notes | `content` | `TEXT` | NOT NULL | 心得正文长度不定，用 `TEXT` 避免 `VARCHAR` 截断 |
| notes | `mood` | `JSON` | NULL（可空） | 心情标签是数组 `["平静"]`，`JSON` 类型原生存数组；不支持 JSON 的实例可退化为 `VARCHAR/TEXT` 存 JSON 串 |
| notes | `user_id` | `VARCHAR(32)` | NOT NULL DEFAULT 'local' | 同 books.user_id |
| notes | `created_at` | `DATETIME` | NOT NULL | 写下时间，理由同 books.created_at |
| notes | `updated_at` | `DATETIME` | NULL | 改写时间；未改过为 NULL，允许空 |

> 可重复执行保障：`schema.sql` 先 `DROP TABLE IF EXISTS`（子表 notes 先于父表 books）再 `CREATE`；`seed.sql` 先 `DELETE FROM`（同样子表先于父表）再 `INSERT`，重跑不报错、数据幂等。

---

## 二、接口总览

| # | 路径 | 方法 | 对应前端动作 | 是否列表读取 |
| --- | --- | --- | --- | --- |
| 0 | `/api/health` | GET | 探活（已上线） | — |
| 1 | `/api/books` | POST | F2 录入书名 `store.addBook` | — |
| 2 | `/api/books` | GET | 书架列表 `store.getBooks` | ✓（书籍列表） |
| 3 | `/api/books/:id` | GET | 书页标题/详情 | — |
| 4 | `/api/books/:id/notes` | GET | 书页的心得列表 `store.getNotesByBook` | ✓（单书心得列表） |
| 5 | `/api/notes` | POST | F3 写心得 `store.addNote` | — |
| 6 | `/api/notes` | GET | **心迹全部心得** `store.getNotes` | ★ **记录表读取**（重点） |
| 7 | `/api/notes/:id` | PATCH（PUT 兼容） | 改写心得 `store.updateNote` / `Z.api.updateNote` | — |
| 8 | `/api/notes/:id` | DELETE | 收起心得 `store.removeNote` / `Z.api.removeNote` | — |

> 课程要求"别忘了列表读取接口"：对栀书心驿而言，核心记录表是 `notes`，因此 **`GET /api/notes`（心迹）就是与案例 `GET /api/favorites` 对等的列表读取接口**，已列入第 6 项。另 `GET /api/books`（第 2 项）也是列表读取。
> 首页 #/home 仅展示"共 N 本 / 共 M 段"，可由 `GET /api/books` + `GET /api/notes` 在前端聚合得出，**Day 15 不单列专用接口**（如需可后续加 `GET /api/today`，此处占位、暂不实现）。

---

## 三、接口详述

### 0. GET /api/health —— 已上线（Day 15）
- **路径**：`/api/health`
- **方法**：GET
- **请求参数**：无
- **响应**（200）：
  ```json
  { "ok": true, "service": "zhishu-xinyi" }
  ```
- **错误返回**：非 GET 方法 → 405 `{ "ok": false, "error": "method_not_allowed" }`
- **部署位置**：`cloudfunctions/health/`

---

### 1. POST /api/books —— 新增书籍（F2 录入书名）
> **状态**：✅ Day 18 已实现 · 部署位置 `cloudfunctions/books/`（同一函数同时承载 GET 列表 + POST 写入；CORS 方法白名单补上 `POST`；写入走**参数化 INSERT**；已加服务端写入日志）。见 `outputs/Day18/部署与验证.md`。

- **请求体**（JSON）：
  ```json
  { "title": "小王子" }
  ```
- **响应**（201）：
  ```json
  {
    "ok": true,
    "book": { "id": "b_xxx", "title": "小王子", "user_id": "local", "created_at": "2026-09-30T12:00:00.000Z" }
  }
  ```
- **错误返回**：
  - `title` 缺失/空白（含纯空格，trim 后为空）→ 400 `{ "ok": false, "error": "invalid_param", "message": "书名不能为空" }`
  - **防重复**：同一用户重复收录同一书名 → 命中 `UNIQUE(user_id, title)` → 409 `{ "ok": false, "error": "duplicate", "message": "这本书已经在书架上了，无需重复收录" }`（数据库层兜底拒绝，接口层转成中文提示）

### 2. GET /api/books —— 书籍列表（书架）
> **状态**：✅ Day 17 已实现 · 部署位置 `cloudfunctions/books/`（参数化 SQL、CORS 头、支持 `?user_id=&limit=`、非 GET 回 405 method_not_allowed）。见 `outputs/Day17/部署与验证.md`。

- **查询参数**：`user_id`（可选，上云后由登录态提供）
- **响应**（200）：
  ```json
  {
    "ok": true,
    "books": [
      { "id": "b_xxx", "title": "小王子", "user_id": "local", "created_at": "..." }
    ]
  }
  ```
- **错误返回**：服务异常 → 500 `{ "ok": false, "error": "server_error" }`

### 3. GET /api/books/:id —— 书籍详情
- **路径参数**：`id`（书籍主键）
- **响应**（200）：
  ```json
  { "ok": true, "book": { "id": "b_xxx", "title": "小王子", "user_id": "local", "created_at": "..." } }
  ```
- **错误返回**：书籍不存在 → 404 `{ "ok": false, "error": "not_found", "message": "这本书不在书架上" }`

### 4. GET /api/books/:id/notes —— 某本书的心得列表（书页）
- **路径参数**：`id`（书籍主键）
- **响应**（200）：
  ```json
  {
    "ok": true,
    "book_id": "b_xxx",
    "notes": [
      { "id": "n_xxx", "book_id": "b_xxx", "content": "…", "mood": ["平静"], "user_id": "local", "created_at": "…", "updated_at": null }
    ]
  }
  ```
- **错误返回**：书籍不存在 → 404 `{ "ok": false, "error": "not_found" }`

### 5. POST /api/notes —— 新增心得（F3 写心得）
- **请求体**（JSON）：
  ```json
  { "book_id": "b_xxx", "content": "读完这一段，心静了些。", "mood": ["平静"] }
  ```
- **响应**（201）：
  ```json
  {
    "ok": true,
    "note": { "id": "n_xxx", "book_id": "b_xxx", "content": "…", "mood": ["平静"], "user_id": "local", "created_at": "…", "updated_at": null }
  }
  ```
- **错误返回**：
  - `book_id` / `content` 缺失 → 400 `{ "ok": false, "error": "invalid_param" }`
  - `book_id` 对应书籍不存在 → 404 `{ "ok": false, "error": "not_found" }`

### 6. GET /api/notes —— 全部心得列表（★ 心迹 · 记录表读取）
> **状态**：✅ Day 17 已实现 · 部署位置 `cloudfunctions/notes/`（参数化 SQL、CORS 头、支持 `?user_id=&limit=`、非 GET 回 405 method_not_allowed）。见 `outputs/Day17/部署与验证.md`。

- **查询参数**：`user_id`（可选）
- **响应**（200）：
  ```json
  {
    "ok": true,
    "notes": [
      { "id": "n_xxx", "book_id": "b_xxx", "content": "…", "mood": ["平静"], "user_id": "local", "created_at": "…", "updated_at": null }
    ]
  }
  ```
- **错误返回**：服务异常 → 500 `{ "ok": false, "error": "server_error" }`

### 7. PATCH /api/notes/:id —— 改写心得（局部更新）
> **状态**：✅ Day 22 已实现 · 部署位置 `cloudfunctions/notes/`（与 GET 列表同一函数；CORS 方法白名单补上 `PATCH/PUT/DELETE`）。本地 55 条断言回归全过（`outputs/Day22/regression.cjs`），见 `outputs/Day22/部署与验证.md`。
> **为什么从 PUT 改成 PATCH**：这个接口改的是「调用方点到的字段」（只改正文、或只改心情），不是整条覆盖——语义上正是 PATCH。**PUT 保留为兼容别名**（同一函数同一分支处理，行为一致），Day 15 登记的 PUT 调用方不受影响。
> **触发路径注意**：带 `:id` 的子路径也由本函数处理。代码同时兼容 `event.pathParameters.id`（触发配成路径参数）与 URL 末尾解析（触发配成通配），部署时把 HTTP 触发路径配成可匹配子路径的形式即可。

- **路径参数**：`id`（心得主键）
- **请求体**（JSON，字段均可选，**只允许** `content` / `mood`，其余字段一律忽略）：
  ```json
  { "content": "重新写过的句子。", "mood": ["治愈"] }
  ```
- **行为**：只 SET 传入的字段（列名白名单，值参数化）；`updated_at` 自动刷新为当前时间；响应回读改后的完整记录。
- **响应**（200）：
  ```json
  { "ok": true, "note": { "id": "n_xxx", "book_id": "…", "content": "重新写过的句子。", "mood": ["治愈"], "user_id": "local", "created_at": "…", "updated_at": "…" } }
  ```
- **错误返回**：
  - 没带 id / 无可更新字段 → 400 `{ "ok": false, "error": "invalid_param", "message": "没有要改写的内容（可以改正文或心情）" }`
  - `content` trim 后为空白 → 400 `{ "ok": false, "error": "invalid_param", "message": "心得正文不能改成空白。" }`
  - `mood` 不是数组（也不是 null）→ 400 `{ "ok": false, "error": "invalid_param", "message": "心情标签要是一个数组，例如 [\"平静\"]。" }`
  - **id 不存在 → 404** `{ "ok": false, "error": "not_found", "message": "这段心得好像不在了，也许已经被收起。回「心迹」看看别的吧。" }`（中文说明，不假装成功）

### 8. DELETE /api/notes/:id —— 收起 / 删除心得
> **状态**：✅ Day 22 已实现 · 部署位置 `cloudfunctions/notes/`（与 GET 列表同一函数；前端删除带**二次确认**，见 `js/views.js` 确认行与检查台 ⑥）。

- **路径参数**：`id`（心得主键）
- **响应**（200）：
  ```json
  { "ok": true, "id": "n_xxx" }
  ```
- **校验与幂等口径**：按 `affectedRows` 判断真的删掉了没有——**id 不存在（或已删过）→ 404** `{ "ok": false, "error": "not_found", "message": "这段心得好像不在了，也许已经被收起。回「心迹」看看别的吧。" }`，不返回 200 假装成功；没带 id → 400 `invalid_param`（中文「请指明要收起的是哪一段心得。」）。
- 前端安全垫：SPA 卡片上的「删除」先就地换成确认行（「要把这段心得删掉吗？删掉后不可找回。」+ 留下 / 删除），检查台 ⑥ 同样两步确认。

---

## 四、统一错误约定（占位，Day 16 起细化）

| 错误码 | HTTP | 含义 |
| --- | --- | --- |
| `invalid_param` | 400 | 请求参数缺失或非法 |
| `unauthorized` | 401 | 未登录 / 无权限（上云登录态后启用） |
| `not_found` | 404 | 资源不存在 |
| `method_not_allowed` | 405 | 方法不被允许（如 /api/health 收到非 GET） |
| `server_error` | 500 | 服务端异常 |

错误响应统一形状：
```json
{ "ok": false, "error": "<错误码>", "message": "（可选）人类可读说明" }
```

---

## 五、Day 15/16 状态说明
- **Day 15**：仅 `/api/health` 真实可访问（云函数已部署），`books` / `notes` 两表与其余 8 个接口当时仅登记、未实现。
- **Day 16（已落地）**：`books` / `notes` 两表已建 —— 建表脚本 `db/schema.sql`、种子脚本 `db/seed.sql`（每表 ≥5 行、可重复执行），字段/约束/外键映射见 §一「数据库实现」。两表设计与本契约一致。
- **Day 17（已落地）**：`GET /api/books`（第 2 项，读核心表 `books`）与 `GET /api/notes`（第 6 项 ★ 读记录表 `notes`）两个读取接口已实现——代码见 `cloudfunctions/books/`、`cloudfunctions/notes/`，均为**参数化 SQL**、统一 `{ok, books/notes}` 成功形状与 `{ok:false, error}` 错误形状、云函数返回头已补 **CORS**（`Access-Control-Allow-Origin: *`）、并支持 `?limit=` 条数限制（余力加练）。公网验证需在 CloudBase 导入 `db/schema.sql`+`db/seed.sql` 并部署两函数后由浏览器完成（步骤见 `outputs/Day17/部署与验证.md`，`outputs/Day17/self-check.js` 可在 Node 本地验证 SQL 与响应形状）。
- **Day 18（已落地）**：第 1 项 `POST /api/books`（核心表写入）已实现——`books` 云函数现同时承载 GET 列表与 POST 写入：必填校验（`title` 缺失/空白 → 400 中文「书名不能为空」）、参数化 INSERT、**防重复**（`UNIQUE(user_id,title)` 冲突 → 409 `duplicate`，中文「这本书已经在书架上了，无需重复收录」）、CORS 方法白名单补 `POST`、并新增服务端写入日志（余力加练）。本地已用 `outputs/Day18/self-check.js`（有状态内存表）完成「正常 / 重复 / 缺字段 / 空白书名 / 写入读回 / 参数化 / 方法边界」全路径验证；真实 CloudBase 部署与线上验证步骤（含三条 curl 测试命令与 SELECT 核对）见 `outputs/Day18/部署与验证.md`。
- **Day 19（已落地）**：后端分层重构——`books`/`notes` 的 SQL 全部下沉到 `booksRepository.js` / `notesRepository.js`，`index.js` 不再内联 SQL（实测 index.js 中 SQL 语句 0 行）。**当日未新增接口**，实现覆盖仍为 4/9。
- **Day 20（已落地）**：前端从 `localStorage` 切到云端客户端 `js/api.js`（`Z.api`），读取走 `GET /api/books`、`GET /api/notes`，录入走 `POST /api/books`；新增检查台 `check.html`。**仍未实现**：第 3、4、5、7、8 项（5/9）——其中 `POST /api/notes`（第 5 项）当前回 405 `method_not_allowed`，`addNote` 在前端调用会失败。
- 跨域（CORS）配置：**Day 20 已收紧**——由 `Access-Control-Allow-Origin: *` 改为读云函数环境变量 `ALLOWED_ORIGIN` 的**白名单**（命中才回 ACAO，并带 `Vary: Origin`；OPTIONS 预检回 204；`*` 已禁止）。白名单未命中时不回该头，浏览器侧即被拦。
- **Day 21（第 3 周验收结论）**：**公网部署未落地**。`js/config.js:23` 的 `https://zhishu-xinyi.apigw.tencentcs.com/release` 在验收当日 DNS 解析失败（NXDOMAIN，三个 DNS 服务器一致），HTTP 无法建连；仓库内静态托管域名仍为占位符（详见 `outputs/Day21/公网连通性检查.txt`）。即：本契约 9 项中 **4 项代码已实现并通过本地回归，但均未取得公网可访问的证据**。补做顺序见 `outputs/Day21/周验收表-第3周.md`。
- **Day 22（已落地）**：第 7 项（PUT 调整为 **PATCH**，PUT 保留兼容别名）与第 8 项（DELETE）已实现，实现覆盖 **6/9**——`cloudfunctions/notes/index.js` 现同时承载 GET 列表 + PATCH 改写 + DELETE 删除：id 存在性校验（不存在 → 404 中文「这段心得好像不在了…」）、字段白名单（只认 `content` / `mood`，值参数化）、`updated_at` 自动刷新、CORS 方法白名单补 `PATCH/PUT/DELETE`、服务端写入日志（余力加练）。**新增注意点**：带 `:id` 的子路径由同一函数处理，代码兼容 `pathParameters.id` 与 URL 末尾两种取法，CloudBase 触发路径需配成可匹配子路径的形式（见 `outputs/Day22/部署与验证.md` 第二节）。本地验证：`node outputs/Day22/regression.cjs`（内存库替身 + 真实云函数代码，**55 条断言全过**，含 PATCH 后 GET 读回值已变、DELETE 后 GET 不再返回、不存在 id 的 404、参数化与分层 0 SQL）；浏览器层两张交付截图（`outputs/Day22/Day22-patch-改之前与改之后.png`、`Day22-delete-删除后GET不再返回.png`）。**仍未实现**：第 3、4、5 项（3/9）；公网部署仍未落地（Day 21 的 U1–U4 待办不变）。
- **关于响应形状 `{ok, data, error}` 的说明**：本项目成功响应用**语义化键** `books` / `notes` 承载数据（见 §三），与统一错误形状 `{ok:false, error}` 共同构成一致契约；未使用通用 `data` 键，是有意设计（字段语义更清晰），属契约范围内，不改变"成功 `ok:true` / 失败 `ok:false`+`error`"的统一约定。
