'use strict';
/* Day 24 · Bug 聚焦复现（修复前）
 * 现象假设：检查台 ⑥「确认删除」按钮在请求飞行期间没禁用 → 连点会发第二次 DELETE
 *          → 服务端按契约如实回 404 → 控制台红色报错 + 反馈被覆盖
 * 用法：node outputs/Day24/repro.cjs [端口]
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PORT = Number(process.argv[2] || 8792);
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = 'D:/vibe coding/课程任务/outputs/Day24/' + (process.argv[3] || '复现证据-修复前.txt');

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 900 });

  const requests = [];
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') { const t = m.text(); consoleErrors.push(t); say('  [console.error] ' + t); }
  });
  page.on('pageerror', (e) => { const t = 'pageerror: ' + e.message; consoleErrors.push(t); say('  ' + t); });
  page.on('response', (r) => {
    const s = r.status();
    if (s >= 400) say('  [HTTP ' + s + '] ' + r.request().method() + ' ' + r.url());
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.indexOf('/api/') !== -1) {
      requests.push(r.method() + ' ' + u.replace(BASE, ''));
      say('  → ' + r.method() + ' ' + u.replace(BASE, ''));
    }
  });

  say('=== Day 24 Bug 复现（修复前）===');
  say('时间：' + new Date().toISOString());
  say('页面：' + BASE + '/check.html?api=' + BASE);
  say('');
  say('【复现步骤】');
  say('  1. 打开检查台，等 ② 读完 books/notes');
  say('  2. 滚到 ⑥「删除一段心得」，点一次「删除列表里最新一段」');
  say('  3. 在确认行上，快速连点两次「确认删除」');
  say('');

  await page.goto(BASE + '/check.html?api=' + BASE, { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 });

  const target = await page.$eval('#patch-target', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  say('【步骤 1-2】改写目标（= ⑥ 要删的那条）: ' + target.slice(0, 80));
  say('');

  say('【步骤 3】点「删除列表里最新一段」，再连点两次「确认删除」：');
  say('  —— 网络请求流水 ——');
  await page.click('#delete-test');
  await page.waitForSelector('#delete-confirm', { timeout: 8000 });
  const beforeTxt = await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  say('  确认行文本: ' + beforeTxt);

  const snapshots = [];
  page.exposeFunction('__snap', (t) => { snapshots.push(t); });
  await page.evaluate(() => {
    const box = document.getElementById('delete-box');
    const seen = [];
    const rec = () => {
      const t = box.textContent.replace(/\s+/g, ' ').trim();
      if (seen[seen.length - 1] !== t) { seen.push(t); window.__snap(t); }
    };
    rec();
    window.__snapTimer = setInterval(rec, 60);
  });

  await page.evaluate(() => {
    const c = document.getElementById('delete-confirm');
    c.click(); c.click();
  });
  await new Promise((r) => setTimeout(r, 3000));
  await page.evaluate(() => clearInterval(window.__snapTimer));

  say('');
  say('  —— ⑥ 反馈区文本变化（按时间顺序）——');
  snapshots.forEach((s, i) => say('   [' + (i + 1) + '] ' + s.slice(0, 200)));
  say('');
  say('  —— 控制台报错原文 ——');
  if (!consoleErrors.length) say('   （无）');
  consoleErrors.forEach((e, i) => say('   (' + (i + 1) + ') ' + e));

  const delReqs = requests.filter((r) => /^DELETE/.test(r));
  say('');
  say('【判读】DELETE 请求次数 = ' + delReqs.length + '（' + delReqs.join(' , ') + '）');
  say('【判读】控制台红报错条数 = ' + consoleErrors.length);
  say('【结论】' + (delReqs.length > 1 && consoleErrors.length > 0
    ? '复现成功：按钮未禁用 → 重复 DELETE → 控制台 404 红报错，且删除反馈被第二次失败覆盖。'
    : '未复现（与假设不符，需重新定位）。'));

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log('\n证据已写入：' + OUT);
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
