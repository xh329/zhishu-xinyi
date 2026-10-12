#!/usr/bin/env node
/* ============================================================================
 * outputs/Day26/release.cjs —— 发布 / 回滚演练工具（Day 26）
 * ----------------------------------------------------------------------------
 * 为什么需要它：WorkBuddy 静态托管**没有版本历史**，「回退」只能靠
 *   「把上一版产物重新发布」。所以本脚本把三件事固化成可复现动作：
 *     ① build      从仓库构建发布产物（静态子集）到 outputs/publish-site/
 *     ② fingerprint 算产物指纹（文件清单 + sha256 + 总指纹 + 版本标记）
 *     ③ check      抓线上产物算指纹，与本地发布产物逐文件比对 → 回答
 *                   「线上现在到底是哪一版」
 *     ④ archive    把线上当前产物下载归档（回退前必须先备份线上！）
 *
 * 用法（在项目根目录执行）：
 *   node outputs/Day26/release.cjs build
 *   node outputs/Day26/release.cjs fingerprint outputs/publish-site
 *   node outputs/Day26/release.cjs check https://<你的站点>/
 *   node outputs/Day26/release.cjs archive https://<你的站点>/ outputs/Day26/versions/v0.9
 *
 * 只用 Node 内置模块，零依赖（不装 puppeteer 也能跑）。
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');          // 项目根 = D:/vibe coding/课程任务
const PUBLISH_DIR = path.join(ROOT, 'outputs', 'publish-site');

/* ---- 发布产物 = 站点静态子集：5 个页面 + css/ + js/ + assets/（不含 md 文档与后端代码）---- */
const STATIC_DIRS = ['css', 'js', 'assets'];

function listFiles(dir) {
  const out = [];
  function walk(cur, rel) {
    for (const name of fs.readdirSync(cur).sort()) {
      const abs = path.join(cur, name);
      const r = rel ? rel + '/' + name : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs, r);
      else out.push(r);
    }
  }
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith('.html')) out.push(f);
  }
  for (const d of STATIC_DIRS) {
    const abs = path.join(dir, d);
    if (fs.existsSync(abs)) walk(abs, d);
  }
  return out.sort();
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* 版本标记：从 index.html 里读 <meta name="app-version"> 与页脚 .foot-ver */
function readVersionLabel(html) {
  const meta = /<meta\s+name="app-version"\s+content="([^"]+)"/i.exec(html);
  const foot = /<span class="foot-ver"[^>]*>([^<]+)</i.exec(html);
  if (!meta && !foot) return '（无版本标记 = 上次发布留下的旧版）';
  return (meta ? 'meta=' + meta[1] : 'meta=缺失') + (foot ? ' / 页脚=' + foot[1].trim() : ' / 页脚=缺失');
}

/* ---------------- ① build ---------------- */
function build() {
  const files = listFiles(ROOT);
  // 重建：先清空目标，避免旧版残留文件混进新产物（这是最容易骗过自己的坑）
  fs.rmSync(PUBLISH_DIR, { recursive: true, force: true });
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    const dst = path.join(PUBLISH_DIR, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  console.log('[build] 已重建发布产物：' + PUBLISH_DIR);
  console.log('[build] 复制 ' + files.length + ' 个文件（5 页面 + css/ + js/ + assets/）');
  const idx = fs.readFileSync(path.join(PUBLISH_DIR, 'index.html'), 'utf8');
  console.log('[build] 版本标记：' + readVersionLabel(idx));
  return files;
}

/* ---------------- ② fingerprint ---------------- */
function fingerprintDir(dir, files) {
  const list = files || listFiles(dir);
  const rows = list.map((rel) => ({ rel, hash: sha256(fs.readFileSync(path.join(dir, rel))) }));
  return finalize(rows, fs.readFileSync(path.join(dir, 'index.html'), 'utf8'));
}

function finalize(rows, indexHtml) {
  const overall = sha256(rows.map((r) => r.rel + ':' + r.hash).join('\n'));
  return { rows, overall, version: readVersionLabel(indexHtml), count: rows.length };
}

function printFp(title, fp) {
  console.log('== ' + title + ' ==');
  console.log('  版本标记：' + fp.version);
  console.log('  文件数  ：' + fp.count);
  console.log('  总指纹  ：sha256:' + fp.overall.slice(0, 16) + '…');
  for (const r of fp.rows) console.log('    ' + r.rel.padEnd(32, ' ') + r.hash.slice(0, 12));
}

/* ---------------- 抓取（https 通用）---------------- */
function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('http://') ? http : https;
    mod.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuf(new URL(res.headers.location, url).href).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('请求超时')); });
  });
}

async function fetchSite(base) {
  const baseUrl = base.endsWith('/') ? base : base + '/';
  const bust = '?v=' + Date.now();                 // 破缓存：避免 CDN 把旧副本当成"回滚没生效"
  const files = listFiles(PUBLISH_DIR);           // 用本地产物清单去线上逐个取（同一套文件集合）
  const rows = [];
  let indexHtml = '';
  for (const rel of files) {
    const res = await fetchBuf(baseUrl + rel + bust);
    if (res.status !== 200) {
      rows.push({ rel, hash: '(HTTP ' + res.status + ')', missing: true });
      continue;
    }
    rows.push({ rel, hash: sha256(res.buf) });
    if (rel === 'index.html') indexHtml = res.buf.toString('utf8');
  }
  return finalize(rows, indexHtml);
}

/* ---------------- ③ check ---------------- */
async function check(base) {
  const local = fingerprintDir(PUBLISH_DIR);
  const live = await fetchSite(base);
  printFp('本地发布产物 outputs/publish-site', local);
  console.log('');
  printFp('线上当前版本 ' + base, live);
  console.log('');
  const diff = [];
  for (const r of local.rows) {
    const l = live.rows.find((x) => x.rel === r.rel);
    if (!l || l.hash !== r.hash) diff.push('  ✗ ' + r.rel + '  本地 ' + r.hash.slice(0, 12) + ' / 线上 ' + (l ? l.hash.slice(0, 12) : '缺失'));
  }
  const same = diff.length === 0 && local.overall === live.overall;
  console.log('== 比对结论 ==');
  console.log('  本地总指纹：sha256:' + local.overall.slice(0, 16) + '…');
  console.log('  线上总指纹：sha256:' + live.overall.slice(0, 16) + '…');
  if (same) {
    console.log('  ✅ 一致：线上正在服务的版本 == 本地发布产物（' + local.version + '）');
  } else {
    console.log('  ⚠ 不一致，差异 ' + diff.length + ' 处：');
    diff.forEach((d) => console.log(d));
    console.log('  → 线上版本标记：' + live.version);
  }
  return same;
}

/* ---------------- ④ archive ---------------- */
async function archive(base, dest) {
  const destAbs = path.resolve(ROOT, dest);
  const files = listFiles(PUBLISH_DIR);
  fs.mkdirSync(destAbs, { recursive: true });
  const rows = [];
  let indexHtml = '';
  for (const rel of files) {
    const res = await fetchBuf((base.endsWith('/') ? base : base + '/') + rel + '?v=' + Date.now());
    if (res.status !== 200) { rows.push({ rel, hash: '(HTTP ' + res.status + ')', missing: true }); continue; }
    const dst = path.join(destAbs, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, res.buf);
    rows.push({ rel, hash: sha256(res.buf) });
    if (rel === 'index.html') indexHtml = res.buf.toString('utf8');
  }
  const fp = finalize(rows, indexHtml);
  const manifest = [
    '# 线上产物归档（回退前的「上一版」备份）',
    '',
    '- 归档来源：' + base,
    '- 归档时间：' + new Date().toISOString(),
    '- 版本标记：' + fp.version,
    '- 文件数　：' + fp.count,
    '- 总指纹　：sha256:' + fp.overall,
    '',
    '| 文件 | sha256(前12) |',
    '|------|--------------|',
  ].concat(fp.rows.map((r) => '| ' + r.rel + ' | ' + r.hash.slice(0, 12) + ' |')).join('\n');
  fs.writeFileSync(path.join(destAbs, 'MANIFEST.md'), manifest);
  console.log('[archive] 已归档 ' + fp.count + ' 个文件 → ' + destAbs);
  console.log('[archive] 版本标记：' + fp.version);
  console.log('[archive] 总指纹：sha256:' + fp.overall);
  return fp;
}

/* ---------------- CLI ---------------- */
(async function main() {
  const [cmd, a1, a2] = process.argv.slice(2);
  try {
    if (cmd === 'build') return build();
    if (cmd === 'fingerprint') { printFp('发布产物 ' + (a1 || 'outputs/publish-site'), fingerprintDir(path.resolve(ROOT, a1 || 'outputs/publish-site'))); return; }
    if (cmd === 'check') { const ok = await check(a1); process.exitCode = ok ? 0 : 2; return; }
    if (cmd === 'archive') return archive(a1, a2);
    console.log('用法：\n  release.cjs build\n  release.cjs fingerprint [目录]\n  release.cjs check <站点URL>\n  release.cjs archive <站点URL> <归档目录>');
    process.exitCode = 1;
  } catch (e) {
    console.error('[error] ' + e.message);
    process.exitCode = 3;
  }
})();
