'use strict';
/* Day 24 · 刁钻输入探针：快速连点 / 超长文本 / 空值，并记录所有非 2xx 响应
 * 用法：NODE_PATH=.../node_modules node outputs/Day24/probe2.cjs [端口]
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PORT = Number(process.argv[2] || 8792);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
const bad = [];

function attach(page) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)));
  page.on('requestfailed', (r) =>
    errors.push('requestfailed: ' + r.method() + ' ' + r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(r.status() + ' ' + r.request().method() + ' ' + r.url());
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  attach(page);
  await page.setViewport({ width: 1180, height: 900 });

  const ready = () => page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 });

  await page.goto(BASE + '/check.html?api=' + BASE, { waitUntil: 'load', timeout: 40000 });
  await ready().catch(() => errors.push('首屏读取超时'));

  /* ---- A. ③ 写入测试：快速连点 3 次 ---- */
  console.log('=== A. 写入测试 · 快速连点 3 次 ===');
  await page.evaluate(() => {
    const b = document.getElementById('write-test');
    b.click(); b.click(); b.click();
  });
  await sleep(2500);
  console.log('write-box: ' + await page.$eval('#write-box', (el) => el.textContent.trim()).catch(() => '(无)'));

  /* ---- B. ⑤ 改写：超长文本 3000 字 ---- */
  await ready().catch(() => {});
  console.log('=== B. 改写 · 超长文本 3000 字 ===');
  const longText = '长'.repeat(3000);
  await page.$eval('#patch-content', (el, v) => { el.value = v; }, longText);
  await page.click('#patch-save');
  await page.waitForFunction(() => {
    const el = document.getElementById('patch-box');
    return el && el.textContent && el.textContent.indexOf('改写中') === -1;
  }, { timeout: 15000 }).catch(() => {});
  console.log('patch-box: ' + await page.$eval('#patch-box', (el) => el.textContent.replace(/\s+/g, ' ').slice(0, 200)).catch(() => '(无)'));

  /* ---- C. ⑤ 改写：改成空白（应走温柔提示，不发请求） ---- */
  console.log('=== C. 改写 · 正文改成空白 ===');
  await page.$eval('#patch-content', (el) => { el.value = '   '; });
  await page.click('#patch-save');
  await sleep(400);
  console.log('patch-box: ' + await page.$eval('#patch-box', (el) => el.textContent.trim()).catch(() => '(无)'));

  /* ---- D. ⑥ 删除：连点「确认删除」两次 ---- */
  console.log('=== D. 删除 · 连点确认两次 ===');
  await page.click('#delete-test');
  await page.waitForSelector('#delete-confirm', { timeout: 8000 });
  await page.evaluate(() => {
    const c = document.getElementById('delete-confirm');
    c.click(); c.click();
  });
  await sleep(1500);
  console.log('delete-box: ' + await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').slice(0, 260)).catch(() => '(无)'));

  console.log('\n================ 非 2xx 响应 ================');
  if (!bad.length) console.log('（无）'); else bad.forEach((b) => console.log('  ' + b));

  console.log('\n================ 控制台报错 ================');
  if (!errors.length) console.log('（无）'); else errors.forEach((e) => console.log('✗ ' + e));

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
