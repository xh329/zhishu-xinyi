'use strict';

/* 栀书心驿 · Day 22 交付截图生成（无头 Chromium 真实点击，不是画出来的）
 * ─────────────────────────────────────────────────────────────
 * 前置：另开一个终端先起本地联调服务（同源托管静态页 + 真实云函数）
 *   node outputs/Day22/mock-api.cjs 8791
 * 跑法：
 *   NODE_PATH=<workspace>/node_modules node outputs/Day22/make-shots.cjs
 *
 * 出两张图（对应今日交付要求）：
 *   ① Day22-patch-改之前与改之后.png   —— ⑤ 改写：PATCH 200 + 值对比表（正文 / 心情 / 改写时间）
 *   ② Day22-delete-删除后GET不再返回.png —— ⑥ 删除：DELETE 200 + GET 条数 6→5 且该条已消失 ✓
 *
 * 诚实标注：接口域名是 127.0.0.1（本地替身），不是 apigw 公网域名；
 *   页面上那条灰底地址栏是 headless 截图里**渲染出来的真实 URL**，不是 OS 浏览器的外观。
 * 数据说明：改的、删的是本地内存库里的 db/seed.sql 种子行，不触碰任何真实数据库。
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const BASE = 'http://127.0.0.1:8791';
const PAGE_URL = BASE + '/check.html?api=' + BASE;
const OUT = __dirname;

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 注入一条"渲染出来的地址栏"，显示当前真实 location.href（headless 截图不含浏览器 chrome）。
// 用 absolute 而不是 fixed：fullPage 截图里 fixed 元素会悬在半空，absolute 则稳稳落在页面最顶上。
const ADDBAR = `(function () {
  var old = document.getElementById('__addrbar');
  if (old) old.remove();
  var b = document.createElement('div');
  b.id = '__addrbar';
  b.style.cssText = 'position:absolute;left:0;right:0;top:0;height:44px;z-index:2147483647;' +
    'display:flex;align-items:center;gap:8px;padding:0 14px;background:#f1f3f4;' +
    'border-bottom:1px solid #cfd4d9;font-family:Segoe UI,system-ui,sans-serif;' +
    'font-size:14px;color:#3c4043;box-sizing:border-box;';
  b.innerHTML =
    '<span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;flex:none;"></span>' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#febc2e;flex:none;"></span>' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#28c840;flex:none;margin-right:10px;"></span>' +
    '<span style="flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;' +
    'border-radius:999px;padding:5px 14px;overflow:hidden;">' +
    '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#202124;">' + location.href + '</span></span>';
  document.body.appendChild(b);
  document.body.style.paddingTop = '44px';
  return 'bar:' + location.href;
})()`;

async function waitFor(page, fnBody, timeout) {
  const t0 = Date.now();
  for (;;) {
    const ok = await page.evaluate(fnBody);
    if (ok) return true;
    if (Date.now() - t0 > (timeout || 8000)) return false;
    await sleep(150);
  }
}

(async () => {
  say('Day 22 · 交付截图（headless Chromium · ' + new Date().toLocaleString('zh-CN') + '）');
  say('页面：' + PAGE_URL + '　（静态页与接口同源，接口由真实云函数代码处理）');
  say('');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--hide-scrollbars'],
    defaultViewport: { width: 1180, height: 900 },
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  const apiCalls = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.url().indexOf('/api/') !== -1) apiCalls.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(BASE, '')); });

  await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });
  const ready = await waitFor(page, 'document.getElementById("patch-form") && !document.getElementById("patch-form").hidden');
  if (!ready) throw new Error('⑤ 改写区没就绪，页面可能没读到笔记列表');
  await sleep(400);

  /* ================= ① PATCH 改写：改之前 / 改之后 ================= */
  const targetText = await page.$eval('#patch-target', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  say('【⑤ 改写】' + targetText);
  const before = await page.$eval('#patch-content', (el) => el.value);
  say('  改之前正文（表单回填值）：' + before);

  // 人来改：把正文补一句联调说明，并把心情从「治愈」换成「平静」+「轻盈」
  const after = before + '（Day22 联调时改过一次）';
  await page.$eval('#patch-content', (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, after);
  const moodToggled = await page.evaluate(() => {
    var btns = Array.prototype.slice.call(document.querySelectorAll('#patch-moods .mood-item'));
    var picked = [];
    btns.forEach(function (b) {
      var want = (b.textContent === '平静' || b.textContent === '轻盈'); // 想让它选中的
      var isOn = b.classList.contains('selected');
      if (want !== isOn) b.click();
      if (want) picked.push(b.textContent);
    });
    return picked.join('、');
  });
  say('  改之后正文：' + after);
  say('  心情改成：' + moodToggled);

  await page.click('#patch-save');
  const patched = await waitFor(page, 'document.getElementById("patch-box").className.indexOf("ok") !== -1');
  say('  PATCH 结果：' + (patched ? '接口回 200，页面已渲染对比表' : '超时（见截图内容）'));
  const diffText = await page.$eval('#patch-box', (el) => el.innerText.replace(/\n+/g, ' | ').trim());
  say('  对比表内容：' + diffText);
  await page.evaluate(ADDBAR);
  await page.screenshot({ path: path.join(OUT, 'Day22-patch-改之前与改之后.png'), fullPage: true });
  say('  已截图 → Day22-patch-改之前与改之后.png');

  /* ================= ② DELETE 删除：GET 不再返回 ================= */
  await page.click('#delete-test');
  await waitFor(page, 'document.getElementById("delete-confirm") !== null');
  const confirmText = await page.$eval('#delete-box', (el) => el.innerText.replace(/\s+/g, ' ').trim());
  say('');
  say('【⑥ 删除】二次确认文案：' + confirmText);
  await page.click('#delete-confirm');
  const deleted = await waitFor(page, 'document.getElementById("delete-box").className.indexOf("ok") !== -1');
  say('  DELETE 结果：' + (deleted ? '接口回 200，页面已重新 GET 核对' : '超时（见截图内容）'));
  const delText = await page.$eval('#delete-box', (el) => el.innerText.replace(/\n+/g, ' | ').trim());
  say('  核对表内容：' + delText);
  await page.evaluate(ADDBAR);
  await page.screenshot({ path: path.join(OUT, 'Day22-delete-删除后GET不再返回.png'), fullPage: true });
  say('  已截图 → Day22-delete-删除后GET不再返回.png');

  say('');
  say('本次页面发出的接口请求（域名 ' + BASE + '，本地替身，非公网）：');
  apiCalls.forEach((l) => say('  ' + l));
  say('Console error：' + consoleErrors.length + ' 条' + (consoleErrors.length ? ' → ' + consoleErrors.join(' | ') : ''));

  fs.writeFileSync(path.join(OUT, '浏览器层验证.txt'), lines.join('\n') + '\n', 'utf8');
  await browser.close();
  console.log('\n日志已写入 outputs/Day22/浏览器层验证.txt');
})().catch((e) => { console.error('ERR', e); process.exit(1); });
