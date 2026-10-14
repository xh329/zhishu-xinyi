/* Day 28 板块② · 核心流程重复检测（线上实跑）
 *
 * 用法：NODE_PATH=/c/Users/lenovo/.workbuddy/binaries/node/workspace/node_modules \
 *        node outputs/Day28/recheck-core-flow.cjs
 *
 * 目的：在**公网正式站**上，用**全新浏览器环境**把核心流程重跑一遍，
 *       确认"昨天的修复、今天的验收"没有把主链路跑坏（回归检测）。
 * 纪律：只走页面上看得见、点得到的元素；每一步判定 PASS / FAIL 并留证据。
 * 产出：shots/flow-1..7-*.png + 核心流程重复检测.txt / .json（均落在 Day 28，不覆盖 Day 27 证据）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const BASE = 'https://zhishu-xinyi-70127.app.workbuddy.host/';
const OUT = path.join(__dirname, 'shots');
const LOGTXT = path.join(__dirname, '核心流程重复检测.txt');
const LOGJSON = path.join(__dirname, '核心流程重复检测.json');

fs.mkdirSync(OUT, { recursive: true });
const lines = [];
const log = [];
const say = (s) => { lines.push(s); console.log(s); };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), fullPage: true });

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zhishu-day28-'));
  say('== Day 28 · 核心流程重复检测（公网实跑） ==');
  say('站点：' + BASE);
  say('环境：全新 user-data-dir = ' + profile);
  say('时间：' + new Date().toISOString());
  say('');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    userDataDir: profile,
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=430,900'],
    defaultViewport: { width: 430, height: 900, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  let consoleErrors = 0;
  page.on('console', (m) => { if (m.type() === 'error') { consoleErrors++; say('   [Console 红字] ' + m.text()); } });

  let fail = null;
  const mark = (step, name, ok, extra) => {
    log.push({ step, name, ok, ...extra });
    say('  → ' + (ok ? 'PASS' : 'FAIL') + ' · ' + name);
    if (!ok && fail === null) fail = step;
  };

  // 1. 打开首页
  say('--- 1 · 打开首页 ---');
  {
    const t = Date.now();
    const r = await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2500);
    await shot(page, 'flow-1-首页.png');
    say('  HTTP ' + r.status() + '，耗时 ' + (Date.now() - t) + 'ms');
    const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120));
    say('  页面文本片段：' + bodyText);
    mark(1, '打开首页（HTTP 200 且已渲染）', r.status() === 200, { status: r.status() });
  }

  // 2. 进入收书页并收下一本书
  say('');
  say('--- 2 · 收下一本书 ---');
  if (!fail) {
    const entry = await page.$('a.entry');
    if (!entry) { mark(2, '找到「开始今天的阅读」入口', false); }
    else {
      await entry.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await wait(1500);
      await page.type('#book-title', '活着', { delay: 40 });
      await shot(page, 'flow-2-收下这本书.png');
      await page.click('#book-form button.entry');
      await wait(1300);
      const ok = await page.evaluate(() => { const c = document.getElementById('book-card'); return !!(c && !c.hidden); });
      await shot(page, 'flow-3-已收下.png');
      mark(2, '收下这本书（出现「已收下」）', ok);
    }
  }

  // 3. 写心得并保存
  say('');
  say('--- 3 · 写一段心得并保存 ---');
  if (!fail) {
    await page.click('#to-note');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await wait(1500);
    await page.type('#note-content', '读了几页，心里安静下来。原来慢慢读，也是一种休息。', { delay: 15 });
    const mood = await page.$('.mood-item');
    if (mood) await mood.click();
    await shot(page, 'flow-4-写心得.png');
    await page.click('#save-note');
    await wait(1300);
    const tip = await page.evaluate(() => { const t = document.getElementById('saved-tip'); return t ? t.textContent.trim() : ''; });
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length);
    say('  保存提示语：' + JSON.stringify(tip) + '；notes 条数 = ' + n);
    await shot(page, 'flow-5-保存后.png');
    mark(3, '写心得并保存（有提示 + 落盘 1 条）', /收好|保存/.test(tip) && n === 1, { tip, notes: n });
  }

  // 4. 刷新确认持久化
  say('');
  say('--- 4 · 刷新确认（持久化） ---');
  if (!fail) {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length);
    say('  刷新前 notes=' + before + '，刷新后 notes=' + after);
    await shot(page, 'flow-6-刷新后.png');
    mark(4, '刷新后数据仍在', after === before && after > 0, { before, after });
  }

  // 5. 心迹页可达 + 改写/删除按钮在
  say('');
  say('--- 5 · 心迹页：改写 / 删除可达 ---');
  if (!fail) {
    const back = await page.$('a[href*="#/notes"]');
    if (!back) { mark(5, '找到「心迹」入口', false); }
    else {
      await back.click();
      await wait(2500);
      const has = await page.evaluate(() => ({
        edit: !!document.querySelector('[data-action="edit-note"]'),
        del: !!document.querySelector('[data-action="delete-note"]'),
      }));
      await shot(page, 'flow-7-心迹.png');
      say('  改写按钮：' + has.edit + '，删除按钮：' + has.del);
      mark(5, '心迹页有「改写」「删除」', has.edit && has.del, has);
    }
  }

  // 6. 改写链路
  say('');
  say('--- 6 · 改写一段心得 ---');
  if (!fail) {
    await page.click('[data-action="edit-note"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await wait(1500);
    const prefilled = await page.evaluate(() => { const t = document.getElementById('note-content'); return t ? t.value : ''; });
    say('  改写页带出原文：' + JSON.stringify(prefilled));
    await page.evaluate(() => { const t = document.getElementById('note-content'); t.value = ''; });
    await page.type('#note-content', '改一改：慢慢读，是在把自己找回来。', { delay: 15 });
    await page.click('#save-note');
    await wait(1500);
    const updated = await page.evaluate(() => {
      const n = JSON.parse(localStorage.getItem('zhishu_notes') || '[]');
      return { len: n.length, hasUpdated: !!(n[0] && n[0].updated_at), content: n[0] ? n[0].content : '' };
    });
    say('  改写后：条数=' + updated.len + '，有 updated_at=' + updated.hasUpdated + '，正文=' + JSON.stringify(updated.content));
    mark(6, '改写链路通（带出原文 + 写入 updated_at）', prefilled.length > 0 && updated.hasUpdated, updated);
  }

  // 7. 删除链路 + 再刷新
  say('');
  say('--- 7 · 删除 + 再刷新 ---');
  if (!fail) {
    await page.goto(BASE + 'index.html#/notes', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2200);
    const del = await page.$('[data-action="delete-note"]');
    if (!del) { mark(7, '心迹页有删除按钮', false); }
    else {
      await del.click();
      await wait(800);
      const confirmText = await page.evaluate(() => { const c = document.querySelector('.nc-actions-confirm'); return c ? c.textContent.replace(/\s+/g, ' ').trim() : ''; });
      say('  删除二次确认文案：' + JSON.stringify(confirmText));
      await page.click('[data-action="confirm-delete"]');
      await wait(2500);
      const n1 = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length);
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await wait(2000);
      const n2 = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length);
      say('  删除后 notes=' + n1 + '，再刷新后 notes=' + n2);
      await shot(page, 'flow-8-删除后.png');
      mark(7, '删除有二次确认且刷新不回来', /删掉|不可找回/.test(confirmText) && n1 === 0 && n2 === 0, { confirmText, n1, n2 });
    }
  }

  say('');
  say('=== 结果 ===');
  say(fail ? ('★ 首个未通过项：第 ' + fail + ' 步') : '★ 核心流程 7 步全部 PASS（线上公网实跑）');
  say('Console 红字数：' + consoleErrors + (consoleErrors === 0 ? ' ✅' : ' ⚠️'));
  say('判定：' + (fail === null ? '✅ 核心流程重复检测通过' : '❌ 存在未通过项，见上'));

  fs.writeFileSync(LOGTXT, lines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(LOGJSON, JSON.stringify({ base: BASE, fail, consoleErrors, log }, null, 2), 'utf8');
  await browser.close();
  console.log('\n落盘：' + LOGTXT);
})().catch((e) => { console.error('脚本失败：', e); process.exit(1); });
