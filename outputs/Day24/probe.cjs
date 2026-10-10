'use strict';
/* Day 24 · 核心流程探针：真实浏览器跑「检查台」全链路，抓控制台报错
 * 用法：NODE_PATH=.../node_modules node outputs/Day24/probe.cjs [端口]
 * 前置：先起本地联调服务（真实云函数代码 + 内存库替身）
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PORT = Number(process.argv[2] || 8792);
const BASE = 'http://127.0.0.1:' + PORT;

const logs = [];
const errors = [];

function attach(page) {
  page.on('console', (m) => {
    const t = m.type();
    logs.push('[' + t + '] ' + m.text());
    if (t === 'error') errors.push('console.error: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)));
  page.on('requestfailed', (r) =>
    errors.push('requestfailed: ' + r.method() + ' ' + r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  attach(page);
  await page.setViewport({ width: 1180, height: 900 });

  const url = BASE + '/check.html?api=' + BASE;
  await page.goto(url, { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 }).catch(() => errors.push('② 读取块超时未出现数据'));

  const step = async (name, fn) => {
    console.log('\n=== ' + name + ' ===');
    try { await fn(); } catch (e) { errors.push(name + ' → ' + e.message); }
  };

  await step('② 读取 books/notes', async () => {
    const txt = await page.$eval('#data-box', (el) => el.textContent.trim());
    const last = await page.$eval('#last-update', (el) => el.textContent.trim());
    console.log('data-box: ' + txt);
    console.log('last-update: ' + last);
  });

  await step('③ 写入测试（POST /api/books）', async () => {
    await page.click('#write-test');
    await page.waitForFunction(() => {
      const el = document.getElementById('write-box');
      return el && el.textContent && el.textContent.indexOf('写入中') === -1;
    }, { timeout: 15000 });
    console.log('write-box: ' + await page.$eval('#write-box', (el) => el.textContent.trim()));
    await sleep(1500); // 等 location.reload() 触发
  });

  await step('刷新确认（reload 后重读）', async () => {
    await page.waitForFunction(() => {
      const el = document.getElementById('data-box');
      return el && /books 表/.test(el.textContent);
    }, { timeout: 15000 });
    console.log('data-box: ' + await page.$eval('#data-box', (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '(读取失败)'));
  });

  await step('⑤ 改写心得（PATCH）', async () => {
    const target = await page.$eval('#patch-target', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    console.log('patch-target: ' + target);
    const hidden = await page.$eval('#patch-form', (el) => el.hidden);
    console.log('patch-form hidden = ' + hidden);
    if (hidden) throw new Error('改写表单未出现，无法测试 PATCH');
    await page.$eval('#patch-content', (el) => { el.value = '（Day24 探针改写）改一处看看值会不会跟着变。'; });
    await page.click('#patch-save');
    await page.waitForFunction(() => {
      const el = document.getElementById('patch-box');
      return el && el.textContent && el.textContent.indexOf('改写中') === -1;
    }, { timeout: 15000 });
    console.log('patch-box: ' + await page.$eval('#patch-box', (el) => el.textContent.replace(/\s+/g, ' ').trim()));
  });

  await step('⑥ 删除心得（DELETE，二次确认）', async () => {
    await page.click('#delete-test');
    await page.waitForSelector('#delete-confirm', { timeout: 8000 });
    console.log('确认行: ' + await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').trim()));
    await page.click('#delete-confirm');
    await page.waitForFunction(() => {
      const el = document.getElementById('delete-box');
      return el && /接口返回|删除返回/.test(el.textContent);
    }, { timeout: 15000 });
    console.log('delete-box: ' + await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').trim()));
  });

  console.log('\n================ 控制台报错 ================');
  if (errors.length === 0) console.log('（无报错）');
  else errors.forEach((e) => console.log('✗ ' + e));

  console.log('\n================ 全部控制台消息 ================');
  logs.forEach((l) => console.log(l));

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
