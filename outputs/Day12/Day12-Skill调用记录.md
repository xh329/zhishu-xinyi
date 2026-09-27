# Day 12 · Skill 调用记录

## Skill 基本信息

- **名称**：zhishu-frontend-guidelines（栀书心驿 · 前端规范）
- **文件位置**：`.workbuddy/skills/zhishu-frontend-guidelines/SKILL.md`（项目级）
- **结构**：YAML frontmatter（name / description / agent_created: true）+ Markdown 正文（用途 + 六节规范清单）
- **校验**：用 skill-creator 官方 `package_skill.py` 校验，结果「✅ Skill is valid!」

## 调用过程

1. 先尝试用 Skill 工具按名称 `zhishu-frontend-guidelines` 调用 → 系统返回「Can not find skill」（可用技能列表在会话启动时固定，本会话内新建的项目级 Skill 不在其中）。
2. 按今日任务单「卡住降级」路径：**手动加载 SKILL.md 全文**（内容已完整读入上下文），并严格按清单执行当次任务。
3. 调用时间：2026-09-27 21:14–22:00 前后；调用任务：notes.html 筛选交互。

## 调用中 Skill 实际起了什么作用

- **设计阶段（清单第 1–4 节）**：筛选框复用 `.book-input` 的柔色输入语言；回执小字用 `--leaf-ink`；空状态文案写成「一句承接 + 一个可点的去处」；未动 store 层数据，只读不写。
- **实现约束**：label 与输入框 `for/id` 显式关联；结果区加 `aria-live="polite"`（清单第 5 节，余力加练）；代码注释中文、说明为什么。
- **交付阶段（清单第 6 节）**：agent-browser 真实渲染测试 → 三情况测试（有结果 / 无结果 / 清空恢复）全部通过 → 带地址栏截图存本目录。

## 验证证据（见本目录截图）

| 测试 | 断言 | 结果 |
| --- | --- | --- |
| 有结果（输入「小王子」） | 1 张卡片 + 回执「轻轻找到了 1 篇与「小王子」相关的心得」 | ✅ |
| 无结果（输入「月亮与六便士」） | 列表隐藏 + 空状态「……换一个词试试，或者去写下一篇吧。」 | ✅ |
| 清空恢复（清空输入） | 4 张卡片全量恢复 + 回执清空 | ✅ |
| 可访问性 | label 绑定 / 键盘可聚焦 / aria-live=polite / 控制台无报错 | ✅ |

## 说明

- 截图为 headless Chromium 真实渲染，地址栏为注入的真实 URL 标注。
- 按 Day 1 规则 `.workbuddy/` 不入 git，故 SKILL.md 本体在项目内但不随仓库提交；以本记录与本目录截图作为调用证据。
