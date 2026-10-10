'use strict';
/* Day 24 · 后果验证：③ 写入双击跨过「秒边界」时会真的插入两条测试书籍吗？
 * 依据：标题 = '测试书籍·' + toLocaleTimeString('zh-CN')，只到秒 —— 跨秒即不同标题，UNIQUE 约束拦不住。
 * 做法：等到当前秒的 ~60ms 前再点第一下，第二下（+120ms）自然落在下一秒。
 * 用法：node outputs/Day24/repro-boundary.cjs [端口]
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PORT = Number(process.argv[2] || 8796);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bookCount() {
  const r = await fetch(BASE + '/api/books?user_id=local&limit=100');
  const d = await r.json();
  return d.books.map((b) => b.title);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 900 });
  const posted = [];
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && r.url().indexOf('/api/books') !== -1) posted.push(r.status());
  });

  const before = await bookCount();
  console.log('写入前 books 数 = ' + before.length + '：' + before.join('、'));

  await page.goto(BASE + '/check.html?api=' + BASE, { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 });
  await page.$eval('#write-test', (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const box = await (await page.$('#write-test')).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;

  // 等到当前秒的 ~60ms 之前
  const skew = await page.evaluate(() => Date.now() % 1000);
  const wait = (1000 - skew) - 60;
  console.log('当前秒内已过 ' + skew + 'ms，再等 ' + wait + 'ms 后点第一下（第二下 +120ms 将落到下一秒）');
  await sleep(wait > 0 ? wait : 0);

  await page.mouse.click(x, y);
  await sleep(120);
  await page.mouse.click(x, y);

  await sleep(2500);
  const after = await bookCount();
  const newTitles = after.filter((t) => before.indexOf(t) === -1);
  console.log('POST /api/books 响应状态序列 = [' + posted.join(', ') + ']');
  console.log('写入后 books 数 = ' + after.length);
  console.log('新增标题 = ' + (newTitles.length ? newTitles.join('、') : '（无）'));
  console.log(newTitles.length > 1
    ? '【结论】跨秒双击 → 真的插入了 ' + newTitles.length + ' 条测试书籍（UNIQUE(user_id,title) 拦不住）。'
    : '【结论】只插入 ' + newTitles.length + ' 条。');

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
