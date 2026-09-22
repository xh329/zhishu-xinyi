# 栀书心驿 · 本地运行说明（Day 7）

> 本文件为 MVP 的运行存档：怎么启动、项目长什么样、截图怎么交。

## 一、如何启动（本地）
在项目根目录（含 index.html 的那一层）执行：

    python -m http.server 8000

然后浏览器打开：

    http://localhost:8000/index.html

- 不需要后端、不需要数据库、不花一分钱（MVP 本地优先，见 TECH_DESIGN §1）。
- 没装 Python 也可改用 `npx serve` 或任意静态服务器，端口随意。
- 关闭服务器：在终端按 Ctrl + C。

## 二、今天要交的截图
浏览器打开上面的地址后截一张图，要求：
- 地址栏以 `localhost` 开头（证明是本地启动，不是随便一张图）；
- 页面内容能认出是「栀书心驿」（看到「栀书心驿 / 今天，也请慢慢来 / 开始今天的阅读」即达标）。

## 三、页面与功能对应（MVP 三功能 + 四页面）
| 页面 | 文件 | 功能 | 可观察结果 |
|------|------|------|-----------|
| P1 诗意首页 | index.html | F1 | 当日寄语、微光、入口按钮 |
| P2 书籍录入 | book.html | F2 | 手填书名 → 卡片确认 → 引导写心得 |
| P3 心得书写 | note.html | F3 | 文本框 + 心情标签 → 温柔留存 |
| P4 我的心得 | notes.html | 回看 | 按时间倒序的诗意卡片 / 空状态 |

## 四、项目结构
zhishu-xinyi（仓库根目录）
├─ index.html        P1 诗意首页（F1）
├─ book.html         P2 书籍录入（F2）
├─ note.html         P3 心得书写（F3）
├─ notes.html        P4 我的心得
├─ css/style.css     诗意氛围样式（柔色·留白·衬线·微光）
├─ js/store.js       本地存储封装（替代后端 API，见 TECH_DESIGN §5）
├─ js/book.js        P2 逻辑
├─ js/note.js        P3 逻辑
├─ js/notes.js       P4 逻辑
├─ assets/           自然意象素材（栀子/书页/微光，待补）
├─ outputs/          运行说明 / 截图 / 结构图（本文件即在此）
└─ AGENTS.md PRD.md research.md TECH_DESIGN.md   项目说明书

> 说明：P1 引导逻辑很轻，入口是直接跳转的链接，故未单独建 home.js；后续若首页逻辑变复杂再加。

## 五、数据存在哪
- 书名与心得都写在浏览器本地存储（localStorage，命名空间 `zhishu_`），只存在你自己的浏览器里，不上传任何服务器。
- 换设备 / 清缓存会丢失——这正是 MVP 本地优先的已知边界（TECH_DESIGN §2 / §6.3），验证完核心习惯后再考虑上云。

## 六、完成标准对照
- [x] 页面能在本地启动打开：`python -m http.server` 后开 localhost 即见（已验证 9 个资源均 HTTP 200）。
- [x] 运行命令已存档：见本文「一、如何启动」。
- [x] 改动已提交：见本次 Day 7 提交。
