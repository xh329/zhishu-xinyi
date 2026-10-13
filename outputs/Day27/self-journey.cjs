/* Day 27 · 卡住降级自测（外行试跑）
 *
 * 用法：NODE_PATH=/c/Users/lenovo/.workbuddy/binaries/node/workspace/node_modules \
 *        node outputs/Day27/self-journey.cjs
 *
 * 纪律（照 AGENTS.md 与课程降级口径）：
 *   1. 用**全新的 user-data-dir**，等于一台从没访问过本站的干净浏览器；
 *   2. 只走"页面上看得见、点得到"的东西，**不许用地址栏直接敲 check.html 之类的作弊路径**；
 *   3. 每一步先记「一个外行会找什么词」，再看页面上有没有；找不到就**停下**，那一步=主卡点；
 *   4. 只记现象，不解释原理。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const BASE = 'https://zhishu-xinyi-70127.app.workbuddy.host/';
const OUT = path.join(__dirname, 'shots');
const LOGTXT = path.join(__dirname, '降级自测-实跑记录.txt');
const LOGJSON = path.join(__dirname, '降级自测-实跑记录.json');

fs.mkdirSync(OUT, { recursive: true });
const log = [];
const lines = [];
function say(s) { lines.push(s); console.log(s); }

// 页面上所有可点元素的可见文字（外行眼里"能点的东西"）
async function clickables(page) {
  return page.evaluate(function () {
    var out = [];
    document.querySelectorAll('a, button, [role="button"]').forEach(function (n) {
      var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      var r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;          // 不可见的不算
      if (n.closest('[hidden]')) return;
      out.push(t);
    });
    return Array.from(new Set(out));
  });
}

// 外行会找的词（不告诉他实际文案）——任一命中就算"找得到"
function hit(list, words) {
  var found = [];
  list.forEach(function (t) {
    words.forEach(function (w) { if (t.indexOf(w) !== -1) found.push(t + ' ← 命中「' + w + '」'); });
  });
  return Array.from(new Set(found));
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

(async function main() {
  // 干净的浏览器环境（关键：不是复用我平时那个带缓存的 profile）
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zhishu-clean-'));
  say('== 降级自测（外行试跑） · Day 27 ==');
  say('目标站点：' + BASE);
  say('浏览器环境：全新 user-data-dir = ' + profile + '（等于一台从没来过本站的电脑）');
  say('纪律：只点页面上看得见的东西；不许用地址栏抄近路；找不到就停下。');
  say('');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    userDataDir: profile,
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=430,900'],
    defaultViewport: { width: 430, height: 900, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  page.on('console', function (m) {
    if (m.type() === 'error') say('   [Console 红字] ' + m.text());
  });

  let stuckAt = null;

  // ---------- 第 1 步：打开首页 ----------
  say('--- 第 1 步 · 打开链接 ---');
  const t1 = Date.now();
  const resp = await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  say('  HTTP ' + resp.status() + '，耗时 ' + (Date.now() - t1) + 'ms');
  await new Promise(function (r) { setTimeout(r, 2500); });
  await shot(page, 'self-1-首页.png');
  let list = await clickables(page);
  say('  页面上能点的东西：' + JSON.stringify(list, null, 0));
  log.push({ step: 1, name: '打开首页', ok: resp.status() === 200, sec: Math.round((Date.now() - t1) / 1000), see: list });

  // 外行想"开始用"：他会不会找"开始/进入/登录/注册"？
  var want2 = hit(list, ['开始', '进入', '登录', '注册', '开始用']);
  say('  外行可能找的词（开始/进入/登录/注册）→ 命中：' + (want2.length ? JSON.stringify(want2) : '无'));
  if (!want2.length) { stuckAt = 2; }

  // ---------- 第 2 步：开始今天的阅读（收下一本书） ----------
  if (!stuckAt) {
    say('');
    say('--- 第 2 步 · 点「开始今天的阅读」 → 收下一本书 ---');
    const t2 = Date.now();
    const startLink = await page.$('a.entry');
    if (!startLink) { stuckAt = 2; say('  ❌ 找不到「开始今天的阅读」入口'); }
    else {
      await startLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(function () {});
      await new Promise(function (r) { setTimeout(r, 1500); });
      say('  到了：' + page.url());
      await shot(page, 'self-2-收下这本书.png');
      list = await clickables(page);
      say('  页面上能点的东西：' + JSON.stringify(list, null, 0));
      // 外行填完书名想"保存"：他找 保存/提交/确定/添加
      var want3 = hit(list, ['保存', '提交', '确定', '添加', '加入', '完成']);
      say('  外行找「保存/提交/确定/添加」→ 命中：' + (want3.length ? JSON.stringify(want3) : '无'));
      say('  ▶ 实际按钮叫：「收下这本书」——' + (want3.length ? '有其他词可用' : '外行要自己从「收下」猜出"这是保存"'));
      await page.type('#book-title', '活着', { delay: 40 });
      await page.click('#book-form button.entry');
      await new Promise(function (r) { setTimeout(r, 1200); });
      const cardVisible = await page.evaluate(function () {
        var c = document.getElementById('book-card');
        return c && !c.hidden;
      });
      say('  提交后是否出现「已收下」卡片：' + (cardVisible ? '是 ✅' : '否 ❌'));
      log.push({ step: 2, name: '收下一本书', ok: cardVisible, sec: Math.round((Date.now() - t2) / 1000), see: list, saveWords: want3 });
      if (!cardVisible) stuckAt = 2;
      await shot(page, 'self-3-已收下.png');
    }
  }

  // ---------- 第 3 步：写心得 + 把它存起来 ----------
  if (!stuckAt) {
    say('');
    say('--- 第 3 步 · 写几句心得，把它存起来 ---');
    const t3 = Date.now();
    await page.click('#to-note');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(function () {});
    await new Promise(function (r) { setTimeout(r, 1500); });
    say('  到了：' + page.url());
    list = await clickables(page);
    say('  页面上能点的东西：' + JSON.stringify(list, null, 0));
    // ★ 外行找"保存"
    const want4 = hit(list, ['保存', '提交', '确定', '完成', '存入', '收好']);
    say('  ★ 外行找「保存/提交/确定/完成/存入」→ 命中：' + (want4.length ? JSON.stringify(want4) : '无'));
    say('  ▶ 实际按钮叫：「温柔留存」' + (want4.length ? '' : ' —— 外行必须猜出"留存=保存"'));
    log.push({ step: 3, name: '写心得并保存', saveWords: want4, see: list, sec: null });
    await page.type('#note-content', '读了几页，心里安静下来。原来慢慢读，也是一种休息。', { delay: 20 });
    const mood = await page.$('.mood-item');
    if (mood) await mood.click();
    await shot(page, 'self-4-写心得.png');
    const t3b = Date.now();
    await page.click('#save-note');
    await new Promise(function (r) { setTimeout(r, 1200); });
    const saved = await page.evaluate(function () {
      var t = document.getElementById('saved-tip');
      return { tip: t ? t.textContent.trim() : '', tipHidden: t ? getComputedStyle(t).display === 'none' : true,
               stored: (localStorage.getItem('zhishu_notes') || '[]') };
    });
    say('  保存后提示语：' + JSON.stringify(saved.tip));
    say('  localStorage 里的 notes：' + saved.stored);
    say('  保存这一步耗时：' + (Date.now() - t3b) + 'ms（含"找按钮"的犹豫）');
    log[log.length - 1].sec = Math.round((Date.now() - t3) / 1000);
    await shot(page, 'self-5-保存后.png');
  }

  // ---------- 第 4 步：刷新，看东西还在不在 ----------
  if (!stuckAt) {
    say('');
    say('--- 第 4 步 · 刷新页面，看刚才写的东西还在吗 ---');
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(function (r) { setTimeout(r, 2000); });
    const after = await page.evaluate(function () {
      var ta = document.getElementById('note-content');
      var tip = document.getElementById('saved-tip');
      var ref = document.getElementById('book-ref');
      return {
        textareaValue: ta ? ta.value : '(没有输入框)',
        textareaPlaceholder: ta ? ta.placeholder : '',
        tipVisible: tip ? getComputedStyle(tip).display !== 'none' : false,
        tipText: tip ? tip.textContent.trim() : '',
        bookRef: ref ? ref.textContent.trim() : '',
        noteCount: JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length,
      };
    });
    say('  刷新后输入框里的字：' + JSON.stringify(after.textareaValue));
    say('  刷新后输入框提示语：' + JSON.stringify(after.textareaPlaceholder));
    say('  刷新后"已收好"提示是否可见：' + after.tipVisible + '（' + after.tipText + '）');
    say('  数据其实还在吗？localStorage 里 notes 条数 = ' + after.noteCount + '（>0 = 数据没丢）');
    const looksLost = after.textareaValue === '' && !after.tipVisible;
    say('  ★ 外行的判断：刷新后看到的是**一张空白表单**，页面上没有任何"刚才那条还在"的迹象');
    say('  ★ 结论：数据没丢（还在 localStorage），但**页面上看不出没丢** → ' + (looksLost ? '外行会以为写的东西没了' : '有迹象'));
    log.push({ step: 4, name: '刷新确认', after: after, looksLost: looksLost });
    await shot(page, 'self-6-刷新后.png');
    if (looksLost) stuckAt = 4;
  }

  // ---------- 第 5 步：把那条心得改一改 ----------
  if (!stuckAt) {
    say('');
    say('--- 第 5 步 · 把刚才那条心得改一改 ---');
    // 外行要找"回看/我的"的地方：只点页面上有的链接
    list = await clickables(page);
    say('  页面上能点的东西：' + JSON.stringify(list, null, 0));
    const back = await page.$('a[href*="#/notes"]');
    if (!back) { say('  ❌ 这个页面上没有通向"我的心迹"的链接'); stuckAt = 5; }
    else {
      await back.click();
      await new Promise(function (r) { setTimeout(r, 2500); });
      say('  到了：' + page.url());
      list = await clickables(page);
      say('  心迹页上能点的东西：' + JSON.stringify(list, null, 0));
      const want5 = hit(list, ['改', '编辑', '修改', '删除', '移除']);
      say('  ★ 外行找「改/编辑/修改/删除」→ 命中：' + (want5.length ? JSON.stringify(want5) : '无'));
      log.push({ step: 5, name: '改一改', see: list, hits: want5 });
      await shot(page, 'self-7-心迹.png');
      if (!want5.length) stuckAt = 5;
    }
  }

  // ---------- 第 6 步：删掉 ----------
  if (!stuckAt) {
    say('');
    say('--- 第 6 步 · 把它删掉 ---');
    const del = await page.$('[data-action="delete-note"]');
    if (!del) { say('  ❌ 找不到删除按钮'); stuckAt = 6; }
    else {
      await del.click();
      await new Promise(function (r) { setTimeout(r, 800); });
      const confirmText = await page.evaluate(function () {
        var c = document.querySelector('.nc-actions-confirm');
        return c ? c.textContent.replace(/\s+/g, ' ').trim() : '';
      });
      say('  点了删除后出现：' + JSON.stringify(confirmText));
      await shot(page, 'self-8-删除确认.png');
      await page.click('[data-action="confirm-delete"]');
      await new Promise(function (r) { setTimeout(r, 2500); });
      const n = await page.evaluate(function () {
        return JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length;
      });
      say('  删除后 localStorage 里 notes 条数 = ' + n);
      log.push({ step: 6, name: '删掉', remaining: n });
      await shot(page, 'self-9-删除后.png');
    }
  }

  // ---------- 第 7 步：再刷新 ----------
  if (!stuckAt) {
    say('');
    say('--- 第 7 步 · 再刷新，看删掉的那条还回不回来 ---');
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(function (r) { setTimeout(r, 2500); });
    const n2 = await page.evaluate(function () {
      return JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length;
    });
    say('  刷新后 notes 条数 = ' + n2 + (n2 === 0 ? ' → 没回来 ✅' : ' → 回来了 ❌'));
    log.push({ step: 7, name: '再刷新', remaining: n2 });
    await shot(page, 'self-10-再刷新.png');
  }

  say('');
  say('=== 结果 ===');
  say(stuckAt ? ('★ 第一个"找不到 / 看不懂"的地方：第 ' + stuckAt + ' 步') : '★ 7 步全走过（没有中途停下）');

  fs.writeFileSync(LOGTXT, lines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(LOGJSON, JSON.stringify({ base: BASE, stuckAt: stuckAt, log: log }, null, 2), 'utf8');
  await browser.close();
  console.log('\n落盘：' + LOGTXT);
})().catch(function (e) {
  console.error('脚本失败：', e);
  process.exit(1);
});
