/* Day 27 · 定向验证（降级自测的补充）
 *   A. 空白表单上是否误显示「已为你收好」？（全新环境、0 条数据时）
 *   B. 「改写」这条链路走不走得通？（点改写 → 是否带出原文 → 保存 → 是否回到列表）
 * 用法：NODE_PATH=... node outputs/Day27/probe-tip-and-edit.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const BASE = 'https://zhishu-xinyi-70127.app.workbuddy.host/';
const OUT = path.join(__dirname, 'shots');
const L = [];
function say(s) { L.push(s); console.log(s); }

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zhishu-probe-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, userDataDir: profile, headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check'],
    defaultViewport: { width: 430, height: 900, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();

  // ---------- A. 空白表单上的「已为你收好」 ----------
  say('=== A. 全新环境、0 条数据时打开写心得页 ===');
  await page.goto(BASE + 'note.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1500);
  const fresh = await page.evaluate(function () {
    var tip = document.getElementById('saved-tip');
    var ta = document.getElementById('note-content');
    return {
      notesInStorage: JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length,
      textareaEmpty: ta ? ta.value === '' : null,
      tipDisplay: tip ? getComputedStyle(tip).display : '(无)',
      tipVisibility: tip ? getComputedStyle(tip).visibility : '(无)',
      tipOpacity: tip ? getComputedStyle(tip).opacity : '(无)',
      tipText: tip ? tip.textContent.trim() : '',
      tipHiddenAttr: tip ? tip.hasAttribute('hidden') : null,
    };
  });
  say('  localStorage 里 notes 条数 = ' + fresh.notesInStorage + '（0 = 这一页上什么都没写过）');
  say('  输入框是空的吗：' + fresh.textareaEmpty);
  say('  「已为你收好」提示 → display=' + fresh.tipDisplay + ' / visibility=' + fresh.tipVisibility +
      ' / opacity=' + fresh.tipOpacity + ' / hidden 属性=' + fresh.tipHiddenAttr);
  say('  提示文字：' + JSON.stringify(fresh.tipText));
  const misleading = fresh.notesInStorage === 0 && fresh.tipDisplay !== 'none' && parseFloat(fresh.tipOpacity) > 0.01;
  say('  ★ 判定：' + (misleading
    ? '空白表单上**确实显示着"已为你收好"**，而此刻根本没有任何心得 → 会让人误以为已经存过'
    : '提示不可见（或没有误导）'));
  await page.screenshot({ path: path.join(OUT, 'self-11-空白表单上的已收好.png'), fullPage: true });

  // ---------- B. 改写链路 ----------
  say('');
  say('=== B. 改写这条链路走不走得通 ===');
  // 先在干净环境里造一条数据（走真实 UI：收书 → 写心得）
  await page.goto(BASE + 'book.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(800);
  await page.type('#book-title', '被讨厌的勇气', { delay: 30 });
  await page.click('#book-form button.entry');
  await sleep(900);
  await page.click('#to-note');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(function () {});
  await sleep(1200);
  await page.type('#note-content', '原来一切烦恼都来自人际关系，先把课题分清楚。', { delay: 10 });
  await page.click('#save-note');
  await sleep(1200);

  // 回心迹
  await page.goto(BASE + 'index.html#/notes', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(3000);
  const before = await page.evaluate(function () {
    var c = document.querySelector('.nc-content');
    return c ? c.textContent.trim() : '(没看到心得卡片)';
  });
  say('  心迹页上显示的心得：' + JSON.stringify(before));

  const editBtn = await page.$('[data-action="edit-note"]');
  if (!editBtn) { say('  ❌ 找不到「改写」按钮'); }
  else {
    await editBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(function () {});
    await sleep(1500);
    say('  点「改写」后到了：' + page.url());
    const loaded = await page.evaluate(function () {
      var ta = document.getElementById('note-content');
      var ref = document.getElementById('book-ref');
      var on = Array.prototype.filter.call(document.querySelectorAll('.mood-item'), function (b) {
        return b.classList.contains('on') || b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true';
      }).map(function (b) { return b.textContent.trim(); });
      return { value: ta ? ta.value : '(无输入框)', bookRef: ref ? ref.textContent.trim() : '', checkedMoods: on };
    });
    say('  改写页是否带出原文：' + JSON.stringify(loaded.value));
    say('  关联书名显示：' + JSON.stringify(loaded.bookRef) + ' ／ 已选心情：' + JSON.stringify(loaded.checkedMoods));
    await page.screenshot({ path: path.join(OUT, 'self-12-改写页.png'), fullPage: true });
    // 改一个字再保存
    await page.evaluate(function () {
      var ta = document.getElementById('note-content');
      ta.value = ta.value + '（改一个字试试）';
    });
    await page.click('#save-note');
    await sleep(1500);
    const afterSave = await page.evaluate(function () {
      return {
        url: location.href,
        tip: (document.getElementById('saved-tip') || {}).textContent,
        notes: JSON.parse(localStorage.getItem('zhishu_notes') || '[]'),
      };
    });
    say('  改写保存后停在：' + afterSave.url);
    say('  保存后提示：' + JSON.stringify((afterSave.tip || '').trim()));
    say('  localStorage 里那条现在的内容：' + JSON.stringify(afterSave.notes.map(function (n) { return n.content; })));
    const hasUpdatedAt = afterSave.notes.some(function (n) { return !!n.updated_at; });
    say('  是否留下 updated_at（改写痕迹）：' + hasUpdatedAt);
    await page.screenshot({ path: path.join(OUT, 'self-13-改写保存后.png'), fullPage: true });
  }

  fs.writeFileSync(path.join(__dirname, '定向验证-保存提示与改写链路.txt'), L.join('\n') + '\n', 'utf8');
  await browser.close();
  console.log('\n落盘完成');
})().catch(function (e) { console.error(e); process.exit(1); });
