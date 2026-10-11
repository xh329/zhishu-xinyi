# 栀书心驿（ZhiShu XinYi）

快节奏时代，给大众一个诗意空间：每天花几分钟读书、写下内心感触、经营内心世界。

纯静态前端（HTML/CSS/原生 JS，hash 路由）+ localStorage。项目规则见 `AGENTS.md`，技术设计见 `TECH_DESIGN.md`。

## 发布前检查（verify-project Skill）

把项目真实踩过的坑（跨域、密钥、重复写入、断链……）沉淀成 10 项检查，一键跑出逐项 PASS/FAIL + 证据：

```bash
node skills/verify-project/verify.cjs              # 文本报告
node skills/verify-project/verify.cjs --json        # JSON 报告
node skills/verify-project/verify.cjs --only 2,9    # 只跑指定项
```

退出码：有 FAIL = 1（可接 CI），全过 = 0。

| # | 检查项 | 类型 |
|---|--------|------|
| 1 | 公网接口连通性 /health | 运行期（静态期标注已知边界） |
| 2 | 无硬编码密钥 | 静态 |
| 3 | .env 不入库 | 静态 |
| 4 | CORS 不用通配符 | 静态 |
| 5 | 凭据只走 process.env | 静态 |
| 6 | SQL 参数化（Day22 回归 55 项） | 运行期 |
| 7 | XSS 转义 | 静态 |
| 8 | 三类错误中文（Day23 自检 16 项） | 运行期 |
| 9 | 页面脚本引用无断链 | 静态 |
| 10 | favicon 已声明 | 静态 |

检查项定义与判定口径见 `skills/verify-project/SKILL.md`；规划与踩坑溯源见 `outputs/Day25/检查项规划.md`。

## 目录速览

- `js/` 前端逻辑；`css/` 样式；`assets/` 静态资源
- `cloudfunctions/` 云函数（books / notes / health，历史后端，接口契约见 `api-contract.md`）
- `db/schema.sql` 数据库表结构
- `outputs/DayN/` 每日任务的证据与脚本
- `skills/verify-project/` 发布前检查 Skill
