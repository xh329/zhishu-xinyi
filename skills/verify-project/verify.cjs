#!/usr/bin/env node
/* ============================================================================
 * 栀书心驿 · 发布前检查（verify-project Skill 的执行器）
 * ----------------------------------------------------------------------------
 * 用法：
 *   node skills/verify-project/verify.cjs              # 文本报告
 *   node skills/verify-project/verify.cjs --json        # JSON 报告
 *   node skills/verify-project/verify.cjs --only 2,3    # 只跑指定编号
 *
 * 退出码：全部通过（无 FAIL）=0；存在 FAIL =1。
 * 设计原则：检查项来自项目真实踩坑记录，判据黑白分明，逐项给「证据」。
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 项目根目录 = 本脚本的上两级（skills/verify-project/verify.cjs -> 根）
const ROOT = path.resolve(__dirname, '..', '..');

const HTML_PAGES = ['index.html', 'book.html', 'note.html', 'notes.html', 'check.html'];

// ---- 小工具 ---------------------------------------------------------------

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch (e) { return null; }
}

// 在项目根跑一个命令，返回 {ok, out}（不抛异常，失败也拿得到输出）
function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out: out || '' };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    return { ok: false, out: String(out) };
  }
}

// 把多行输出压成一行证据（最多 maxLen 字）
function oneLine(s, maxLen = 200) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > maxLen ? t.slice(0, maxLen) + ' …' : t;
}

// ---- 检查项定义 ------------------------------------------------------------
// 每项：{ id, name, kind('static'|'runtime'), run() -> {pass, evidence, note} }

const CHECKS = [];

// #1 公网接口连通性（runtime：纯静态期允许 FAIL 但标注为已知边界）
CHECKS.push({
  id: 1,
  name: '公网接口连通性（/health）',
  kind: 'runtime',
  run() {
    const cfg = read('js/config.js') || '';
    const m = cfg.match(/API_BASE_URL\s*=\s*['"]([^'"]+)['"]/);
    const base = m ? m[1] : null;
    if (!base) {
      // config.js 可能已切回纯静态（不再引 api），这本身不是失败，标注边界
      return {
        pass: true,
        evidence: 'js/config.js 未定义 API_BASE_URL（当前为纯静态离线版，无公网接口）',
        note: '已知边界：静态期无接口，跳过连通性判定',
      };
    }
    // 有基地址则探测
    const url = base.replace(/\/+$/, '') + '/health';
    const r = run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code} %{time_total}s',
      '--max-time', '8', url]);
    const code = (r.out.trim().split(/\s+/)[0] || '000');
    const pass = code === '200';
    return {
      pass,
      evidence: `GET ${url} → HTTP ${oneLine(r.out.trim(), 40)}`,
      note: pass ? '' : '已知边界：公网环境不可用时期望 FAIL，非本次回归',
    };
  },
});

// #2 无硬编码密钥
// 修正记录（Day25 第一遍跑出误报）：
//   初版用 `git grep ... -- .` 扫全仓，把「文档里讲规则」的说明文字也算成命中
//   （AGENTS.md 的红线、TECH_DESIGN.md 的设计说明、outputs/Day23 的扫描证据），共 15 条全是误报。
//   修正：只扫**真正的代码/配置**（js/、cloudfunctions/、db/、根级 *.json），
//   排除 *.md 文档与 outputs/ 证据目录——文档本就是"讲规则"的地方，天然含这些关键词。
const SECRET_RE = /(password|passwd|secret|token|api[_-]?key|AKID[A-Za-z0-9]{12,}|sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,})/i;
const CODE_SCAN_DIRS = ['js', 'cloudfunctions', 'db'];
// 注意：不扫 .env.example —— 模板文件本就该放占位符（如 DB_PASSWORD=你的数据库密码），
// 扫它必然误报。.env.example 的「可入库且无真值」由第 3 项单独把关。
const CODE_SCAN_ROOT_FILES = ['package.json', 'app.json'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'outputs', '.workbuddy']);

// 递归列出待扫描的文本文件（读文件系统，不依赖 git 跟踪状态——
// 发布前检查要覆盖**工作区真实状态**，未提交的新文件同样要扫到）
function collectCodeFiles(dirAbs, acc) {
  let entries = [];
  try { entries = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch (e) { return acc; }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(ent.name)) continue;
    const abs = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) collectCodeFiles(abs, acc);
    else if (/\.(js|cjs|mjs|ts|json|sql|env)$/.test(ent.name) || ent.name === '.env.example') acc.push(abs);
  }
  return acc;
}

CHECKS.push({
  id: 2,
  name: '无硬编码密钥（password/secret/token/ak/sk/ghp_）',
  kind: 'static',
  run() {
    const files = [];
    for (const d of CODE_SCAN_DIRS) collectCodeFiles(path.join(ROOT, d), files);
    for (const f of CODE_SCAN_ROOT_FILES) {
      const abs = path.join(ROOT, f);
      if (fs.existsSync(abs)) files.push(abs);
    }
    const hits = [];
    for (const abs of files) {
      let src;
      try { src = fs.readFileSync(abs, 'utf8'); } catch (e) { continue; }
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      src.split('\n').forEach((line, i) => {
        if (SECRET_RE.test(line)) hits.push({ rel, line: i + 1, text: line.trim() });
      });
    }
    // 过滤：排除注释行、process.env 读取、占位符、空值
    const real = hits.filter((h) => {
      const t = h.text;
      if (/^(\/\/|\*|#|--)/.test(t)) return false;            // 整行注释
      const noComment = t.replace(/\/\/.*$/, '').replace(/#.*$/, ''); // 去掉行尾注释再看
      if (!SECRET_RE.test(noComment)) return false;           // 关键词只出现在注释里
      if (/process\.env\./.test(t)) return false;             // 走环境变量
      if (/<\s*[A-Za-z0-9_一-龥]+\s*>/.test(t)) return false;  // <YOUR_KEY>
      if (/(YOUR_|PLACEHOLDER|EXAMPLE|xxxx|XXXX|\.\.\.|your_)/i.test(t)) return false;
      if (/[一-龥]/.test(t.replace(SECRET_RE, '').replace(/[=:"'\s]/g, ''))) return false; // 值含中文 → 占位符
      if (/=\s*['"]{2}\s*(,|;|$)/.test(t)) return false;       // = "" 空值
      return true;
    }).map((h) => `${h.rel}:${h.line}:${h.text}`);
    return {
      pass: real.length === 0,
      evidence: real.length === 0
        ? `扫描 ${files.length} 个代码/配置文件（js/ cloudfunctions/ db/ 与根级），命中 0 条真实密钥`
        : `命中 ${real.length} 条：${oneLine(real.join(' | '), 300)}`,
    };
  },
});

// #3 .env 不入库
CHECKS.push({
  id: 3,
  name: '.env 不入库（ignore 命中 且 未被跟踪）',
  kind: 'static',
  run() {
    const ig = run('git', ['check-ignore', '.env']);
    const tracked = run('git', ['ls-files']).out.split('\n')
      .filter((l) => /(^|\/)\.env($|\.)/.test(l.trim()) && !/\.env\.example$/.test(l.trim()));
    const ignored = ig.out.trim() !== '';
    const pass = ignored && tracked.length === 0;
    return {
      pass,
      evidence: `check-ignore .env → ${ignored ? '命中(被忽略)' : '未命中'}; 被跟踪的 .env* → ${tracked.length} 个`,
    };
  },
});

// #4 CORS 不用通配符
CHECKS.push({
  id: 4,
  name: 'CORS 白名单（不使用 * 通配符）',
  kind: 'static',
  run() {
    const files = ['cloudfunctions/books/index.js', 'cloudfunctions/notes/index.js'];
    const bad = [];
    let hits = 0;
    for (const f of files) {
      const src = read(f);
      if (src == null) continue;
      src.split('\n').forEach((line, i) => {
        if (/Allow-Origin/.test(line)) {
          hits++;
          if (/['"]\*['"]/.test(line)) bad.push(`${f}:${i + 1}`);
        }
      });
    }
    const usesEnv = files.every((f) => /ALLOWED_ORIGIN/.test(read(f) || ''));
    const pass = bad.length === 0 && usesEnv;
    return {
      pass,
      evidence: `Allow-Origin 相关行 ${hits} 处，通配符赋值 ${bad.length} 处；白名单来源 ALLOWED_ORIGIN=${usesEnv ? '是' : '否'}`,
    };
  },
});

// #5 环境变量只从 process.env 读
CHECKS.push({
  id: 5,
  name: '凭据只从 process.env 读取',
  kind: 'static',
  run() {
    const r = run('grep', ['-rn', '-E', 'DB_PASSWORD|DB_HOST|DB_USER', 'cloudfunctions/']);
    const lines = r.out.split('\n').map((s) => s.trim()).filter(Boolean);
    // 允许的行：process.env.X ；若出现直接赋字面量则视为问题
    const bad = lines.filter((l) => !/process\.env\./.test(l) && !/^\S+:\d+:\s*(\/\/|\*)/.test(l));
    return {
      pass: bad.length === 0,
      evidence: `相关行 ${lines.length} 处，非 process.env 来源 ${bad.length} 处`,
    };
  },
});

// #6 SQL 参数化（复用既有回归）
CHECKS.push({
  id: 6,
  name: 'SQL 参数化 / 无注入（Day22 回归）',
  kind: 'runtime',
  run() {
    const f = 'outputs/Day22/regression.cjs';
    if (read(f) == null) return { pass: false, evidence: `${f} 不存在` };
    const r = run('node', [f]);
    const tail = r.out.trim().split('\n').slice(-3).join(' / ');
    const pass = r.ok && /55\s*\/\s*55|全绿|PASS|通过/.test(r.out);
    return { pass, evidence: oneLine(tail, 240) };
  },
});

// #7 XSS 转义
CHECKS.push({
  id: 7,
  name: 'XSS 转义（innerHTML 插值经 escapeHtml）',
  kind: 'static',
  run() {
    const dir = path.join(ROOT, 'js');
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')); } catch (e) {}
    const suspects = [];
    for (const f of files) {
      const src = read('js/' + f) || '';
      src.split('\n').forEach((line, i) => {
        if (/innerHTML\s*=/.test(line)) {
          // 该行含 ${} 或 + 拼接变量，却没出现 escapeHtml/Esc/esc →
          const hasInterp = /\$\{|""\s*\+|\+\s*["']/.test(line);
          const hasEsc = /escapeHtml|Esc\(|esc\(/.test(line);
          if (hasInterp && !hasEsc) suspects.push(`js/${f}:${i + 1}`);
        }
      });
    }
    return {
      pass: suspects.length === 0,
      evidence: suspects.length === 0
        ? '未发现未转义的 innerHTML 插值'
        : `可疑 ${suspects.length} 处：${oneLine(suspects.join(' | '), 220)}`,
    };
  },
});

// #8 三类错误中文提示
CHECKS.push({
  id: 8,
  name: '三类错误中文提示（Day23 自检）',
  kind: 'runtime',
  run() {
    const f = 'outputs/Day23/self-check.cjs';
    if (read(f) == null) return { pass: false, evidence: `${f} 不存在` };
    const r = run('node', [f]);
    const tail = r.out.trim().split('\n').slice(-3).join(' / ');
    const pass = r.ok && /16\s*\/\s*16|全绿|PASS|通过/.test(r.out);
    return { pass, evidence: oneLine(tail, 240) };
  },
});

// #9 页面脚本引用完整（无断链）  ← 埋雷目标
CHECKS.push({
  id: 9,
  name: '页面脚本引用完整（无断链）',
  kind: 'static',
  run() {
    const broken = [];
    const all = [];
    for (const page of HTML_PAGES) {
      const src = read(page);
      if (src == null) { broken.push(`${page}(缺失)`); continue; }
      const refs = [...src.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
      for (const ref of refs) {
        if (/^https?:/.test(ref)) continue;
        const exists = fs.existsSync(path.join(ROOT, ref));
        all.push(ref);
        if (!exists) broken.push(`${page} → ${ref}`);
      }
    }
    return {
      pass: broken.length === 0,
      evidence: broken.length === 0
        ? `共核对 ${all.length} 条脚本引用，全部存在`
        : `断链 ${broken.length} 条：${oneLine(broken.join(' | '), 260)}`,
    };
  },
});

// #10 favicon 已声明
CHECKS.push({
  id: 10,
  name: 'favicon 已声明（无 /favicon.ico 404 红报错）',
  kind: 'static',
  run() {
    const missing = [];
    for (const page of HTML_PAGES) {
      const src = read(page);
      if (src == null) { missing.push(`${page}(缺失)`); continue; }
      if (!/rel="icon"/.test(src)) missing.push(page);
    }
    return {
      pass: missing.length === 0,
      evidence: missing.length === 0
        ? `${HTML_PAGES.length} 个页面全部声明了 favicon`
        : `未声明 ${missing.length} 个：${missing.join(', ')}`,
    };
  },
});

// ---- 执行 ------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const onlyArg = args.find((a) => a.startsWith('--only'));
  let only = null;
  if (onlyArg) {
    const raw = onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1];
    only = (raw || '').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
  }

  const results = [];
  for (const c of CHECKS) {
    if (only && !only.includes(c.id)) continue;
    let res;
    try { res = c.run(); }
    catch (e) { res = { pass: false, evidence: '检查项执行异常：' + e.message }; }
    results.push({ id: c.id, name: c.name, kind: c.kind, pass: !!res.pass,
      evidence: res.evidence || '', note: res.note || '' });
  }

  const failed = results.filter((r) => !r.pass);
  const summary = {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else {
    const line = '='.repeat(68);
    process.stdout.write(`栀书心驿 · 发布前检查报告\n${line}\n`);
    for (const r of results) {
      const tag = r.pass ? '[PASS]' : '[FAIL]';
      process.stdout.write(`${tag} #${r.id} ${r.name}\n`);
      process.stdout.write(`       证据：${r.evidence}\n`);
      if (r.note) process.stdout.write(`       备注：${r.note}\n`);
    }
    process.stdout.write(`${line}\n`);
    process.stdout.write(`合计 ${summary.total} 项：通过 ${summary.passed}，失败 ${summary.failed}\n`);
    if (failed.length) {
      process.stdout.write(`未通过项：${failed.map((r) => '#' + r.id).join(' ')}\n`);
    }
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
