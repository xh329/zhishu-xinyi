/* Day 27 · 修复后验证（本地产物 outputs/publish-site）
 *  1. 两个页面上的动作说明是否真的可见（不是只写进了源码）
 *  2. 用「外行找词」重测一遍：现在搜「保存」能不能命中
 *  3. 核心流程回归：收书 → 写心得 → 刷新仍在 → 心迹 → 改写存在 → 删除 → 再刷新
 *  4. 手机宽度（430×900）跑完整流程（顺带覆盖"余力加练"）
 * 用法：NODE_PATH=... node outputs/Day27/verify-fix.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const BASE = 'http://127.0.0.1:8138/';
const OUT = path.join(__dirname, 'shots');
const L = [];
let fails = 0;
function say(s) { L.push(s); console.log(s); }
function check(name, ok, detail) {
  say('  ' + (ok ? '[PASS]' : '[FAIL]') + ' ' + name + (detail ? ' —— ' + detail : ''));
  if (!ok) fails++;
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function textOf(page, sel) {
  return page.evaluate(function (s) {
    var n = document.querySelector(s);
    if (!n) return null;
    var cs = getComputedStyle(n);
    var r = n.getBoundingClientRect();
    return { text: n.textContent.replace(/\s+/g, ' ').trim(), visible: cs.display !== 'none' && cs.opacity !== '0' && r.height > 0 };
  }, sel);
}
async function clickables(page) {
  return page.evaluate(function () {
    var out = [];
    document.querySelectorAll('a, button, [role="button"]').forEach(function (n) {
      var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      var r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || n.closest('[hidden]')) return;
      out.push(t);
    });
    return Array.from(new Set(out));
  });
}
function hitAny(list, words) {
  var found = [];
  list.forEach(function (t) { words.forEach(function (w) { if (t.indexOf(w) !== -1) found.push(t + ' ←「' + w + '」'); }); });
  return Array.from(new Set(found));
}
// 外行在整页文本里搜"保存"
async function pageHasWord(page, word) {
  return page.evaluate(function (w) { return document.body.innerText.indexOf(w) !== -1; }, word);
}

(async function () {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zhishu-verify-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, userDataDir: profile, headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check'],
    defaultViewport: { width: 430, height: 900, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });

  say('== 修复后验证 · 本地产物 outputs/publish-site ==');
  say('视口：430×900（手机宽度）');
  say('');

  // 1. 收书页的说明
  say('--- 1. 收书页（book.html）：动作说明是否可见 ---');
  await page.goto(BASE + 'book.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);
  const h1 = await textOf(page, '.panel > .hint');
  say('  这段说明：' + JSON.stringify(h1 && h1.text));
  check('说明文字存在且可见', !!(h1 && h1.visible && /保存/.test(h1.text)), '含"保存"二字');
  const list1 = await clickables(page);
  say('  能点的东西：' + JSON.stringify(list1));
  const find1 = hitAny(list1, ['保存', '提交', '确定', '添加']);
  say('  外行找「保存/提交/确定/添加」→ 命中：' + (find1.length ? JSON.stringify(find1) : '按钮上仍无'));
  check('整页文本里能搜到"保存"', await pageHasWord(page, '保存'), '修复前：搜不到');
  await page.screenshot({ path: path.join(OUT, 'fix-1-收书页-修复后.png'), fullPage: true });

  // 2. 收书（流程回归）
  say('');
  say('--- 2. 收下一本书（流程回归） ---');
  await page.type('#book-title', '人间草木', { delay: 30 });
  await page.click('#book-form button.entry');
  await sleep(1100);
  const card = await page.evaluate(function () { var c = document.getElementById('book-card'); return c && !c.hidden; });
  check('收下后出现「已收下」', card);

  // 3. 写心得页的说明
  say('');
  say('--- 3. 写心得页（note.html）：动作说明是否可见 ---');
  await page.click('#to-note');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(function () {});
  await sleep(1400);
  const h2 = await textOf(page, '.note-actions > .hint');
  say('  这段说明：' + JSON.stringify(h2 && h2.text));
  check('说明文字存在且可见', !!(h2 && h2.visible && /保存/.test(h2.text)), '含"保存"二字');
  check('整页文本里能搜到"保存"', await pageHasWord(page, '保存'), '修复前：搜不到');
  const hintPos = await page.evaluate(function () {
    var h = document.querySelector('.note-actions > .hint');
    var b = document.getElementById('save-note');
    return { hintTop: h.getBoundingClientRect().top, btnTop: b.getBoundingClientRect().top };
  });
  check('说明在按钮上方（先看到再点）', hintPos.hintTop < hintPos.btnTop, 'hint ' + Math.round(hintPos.hintTop) + ' < button ' + Math.round(hintPos.btnTop));
  await page.screenshot({ path: path.join(OUT, 'fix-2-写心得页-修复后.png'), fullPage: true });

  // 4. 保存 + 刷新
  say('');
  say('--- 4. 保存 → 刷新（数据落盘回归） ---');
  await page.type('#note-content', '草木有情，慢慢看就好。', { delay: 15 });
  const mood = await page.$('.mood-item');
  if (mood) await mood.click();
  await page.click('#save-note');
  await sleep(1300);
  const savedTip = await page.evaluate(function () {
    var t = document.getElementById('saved-tip');
    return { show: t.classList.contains('show'), text: t.textContent.trim() };
  });
  check('保存后有"已收好"反馈', savedTip.show, JSON.stringify(savedTip.text));
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  const persisted = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length;
  });
  check('刷新后数据仍在（localStorage）', persisted === 1, 'notes=' + persisted);

  // 5. 心迹：改写 / 删除
  say('');
  say('--- 5. 心迹（#/notes）：改写 / 删除是否可达 ---');
  await page.goto(BASE + 'index.html#/notes', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  const list5 = await clickables(page);
  say('  能点的东西：' + JSON.stringify(list5));
  check('页面上有「改写」', list5.some(function (t) { return t === '改写'; }));
  check('页面上有「删除」', list5.some(function (t) { return t === '删除'; }));
  await page.screenshot({ path: path.join(OUT, 'fix-3-心迹-修复后.png'), fullPage: true });

  // 6. 改写链路
  say('');
  say('--- 6. 改写链路 ---');
  await page.click('[data-action="edit-note"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(function () {});
  await sleep(1400);
  const loaded = await page.evaluate(function () { return document.getElementById('note-content').value; });
  check('改写页带出原文', loaded === '草木有情，慢慢看就好。', JSON.stringify(loaded));
  await page.click('#save-note');
  await sleep(1300);
  const updated = await page.evaluate(function () {
    var n = JSON.parse(localStorage.getItem('zhishu_notes') || '[]')[0];
    return { hasUpdatedAt: !!(n && n.updated_at), content: n && n.content };
  });
  check('改写写入 updated_at', updated.hasUpdatedAt);

  // 7. 删除 + 再刷新
  say('');
  say('--- 7. 删除 → 再刷新 ---');
  await page.goto(BASE + 'index.html#/notes', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  await page.click('[data-action="delete-note"]');
  await sleep(800);
  const confirmTxt = await page.evaluate(function () {
    var c = document.querySelector('.nc-actions-confirm');
    return c ? c.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  check('删除有二次确认', /删掉/.test(confirmTxt), JSON.stringify(confirmTxt));
  await page.click('[data-action="confirm-delete"]');
  await sleep(2500);
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2500);
  const left = await page.evaluate(function () { return JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length; });
  check('删除后刷新不回来', left === 0, 'notes=' + left);

  say('');
  say('--- Console 红字 ---');
  check('无 Console 报错', errs.length === 0, errs.length ? errs.join(' | ') : '0 条');

  say('');
  say('=== 合计：' + (fails === 0 ? '全部 PASS ✅' : fails + ' 项 FAIL ❌') + ' ===');
  fs.writeFileSync(path.join(__dirname, '修复后验证-运行记录.txt'), L.join('\n') + '\n', 'utf8');
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(2); });
