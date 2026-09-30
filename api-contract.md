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
| 7 | `/api/notes/:id` | PUT | 改写心得 `store.updateNote` | — |
| 8 | `/api/notes/:id` | DELETE | 收起心得 `store.removeNote` | — |

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
  - `title` 缺失/空白 → 400 `{ "ok": false, "error": "invalid_param", "message": "书名不能为空" }`

### 2. GET /api/books —— 书籍列表（书架）
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

### 7. PUT /api/notes/:id —— 改写心得
- **路径参数**：`id`（心得主键）
- **请求体**（JSON，字段均可选）：
  ```json
  { "content": "重新写过的句子。", "mood": ["治愈"] }
  ```
- **响应**（200）：
  ```json
  { "ok": true, "note": { "id": "n_xxx", "content": "…", "mood": ["治愈"], "updated_at": "…" } }
  ```
- **错误返回**：
  - 心得不存在 → 404 `{ "ok": false, "error": "not_found" }`
  - 无可更新字段 → 400 `{ "ok": false, "error": "invalid_param" }`

### 8. DELETE /api/notes/:id —— 收起 / 删除心得
- **路径参数**：`id`（心得主键）
- **响应**（200）：
  ```json
  { "ok": true, "id": "n_xxx" }
  ```
  （也可返回 204 No Content，前端口侧兼容即可）
- **错误返回**：心得不存在 → 404 `{ "ok": false, "error": "not_found" }`

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

## 五、Day 15 占位说明
- 仅 `/api/health` 真实可访问（云函数已部署）。
- `books` / `notes` 两表与其余 8 个接口**今天不建、不写**，仅在本文登记。
- 前端页面仍读 `localStorage`（见 `js/store.js`），待 Day 16 起按本契约逐个切换为云端接口。
- 跨域（CORS）配置不在今日范围， Day 16–20 随真实接口一并处理。
