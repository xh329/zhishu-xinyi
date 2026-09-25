# Day 10｜修复前后差异摘要（余力加练）

## 1. 问题（截图定位）

- 页面：`note.html?book=...`（写心得页 / P3）
- 操作：文本框留空，点击「温柔留存」
- 现象：**页面毫无反应**——没有提示、没有跳转，按钮像失灵了一样。
- 证据图：`before-note-empty-save.png`

## 2. 自然语言描述（交给 AI 的说法）

> 在写心得页，文本框为空时点「温柔留存」没有任何反馈，按钮像坏了一样；
> 希望它像收书页那样给一句温柔的提示，而不是让人以为按钮失灵。

## 3. 根因

`js/note.js` 原本用 `content.placeholder.includes('慢慢写')` 决定要不要改提示语，
可占位文案本身就已包含「慢慢写」，这个条件**恒为 false**，提示永远不出现。

## 4. 改了什么

| 文件 | 改动 |
| --- | --- |
| `js/note.js` | 空内容时改为显示 `#note-empty` 可见提示；用户重新输入时自动收起 |
| `note.html` | 在 `.note-actions` 内新增 `<p id="note-empty" class="hint" hidden>` 温柔提示 |

```diff
     // 空内容：温柔拦截并给出可见提示（与 P2 录入页 #book-empty 一致），不抛生硬报错
+    emptyTip.hidden = false;
     content.focus();
-    if (!content.placeholder.includes('慢慢写')) {
-      content.placeholder = '写点什么再保存吧。';
-    }
     return;
```

## 5. 验证结果（截图）

| 图 | 说明 |
| --- | --- |
| `before-note-empty-save.png` | 点「温柔留存」（空内容）→ 页面无任何反馈 |
| `after-note-empty-save.png` | 同样操作 → 按钮下方出现「还没写下什么呢，等想说了再留存吧。」 |

- 两图**地址栏完全一致**（`http://127.0.0.1:8123/note.html?book=b_mugtisq7w59b`），画面只有这一处差异，可直接对比。
- 回归验证：输入文字后提示自动收起；填写内容后保存仍能写入并跳转「我的心得」；页面 `errors` / `console` 均为空。
