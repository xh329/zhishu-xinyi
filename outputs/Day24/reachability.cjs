'use strict';
/* Day 24 · 可达性对照实验：用「真实鼠标事件」（分开的事件任务）模拟真人双击，
 * 分别测 ③ 写入按钮 与 ⑥ 确认删除按钮，看是否真的会发出第二次请求。
 * 用法：node outputs/Day24/reachability.cjs [端口]
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PORT = Number(process.argv[2] || 8794);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 900 });

  const writes = [];
  const deletes = [];
  const consoleErrors = [];
  page.on('request', (r) => {
    const u = r.url();
    if (r.method() === 'POST' && u.indexOf('/api/books') !== -1) writes.push(u);
    if (r.method() === 'DELETE' && u.indexOf('/api/notes') !== -1) deletes.push(u);
  });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().indexOf('/api/') !== -1) console.log('   [HTTP ' + r.status() + '] ' + r.request().method() + ' ' + r.url().replace(BASE, ''));
  });

  const ready = () => page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 });

  await page.goto(BASE + '/check.html?api=' + BASE, { waitUntil: 'load', timeout: 40000 });
  await ready();

  // ---------- 实验 1：③ 写入按钮，真实双击 ----------
  console.log('=== 实验 1：③「写入一条测试书籍」真实双击（间隔 120ms）===');
  await page.$eval('#write-test', (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const wb = await page.$('#write-test');
  const wbox = await wb.boundingBox();
  await page.mouse.click(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2);
  await sleep(120);
  await page.mouse.click(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2);
  await sleep(2500);
  console.log('  POST /api/books 次数 = ' + writes.length);
  console.log('  write-box = "' + await page.$eval('#write-box', (el) => el.textContent.trim()).catch(() => '(无)') + '"');

  // ---------- 实验 2：⑥ 确认删除按钮，真实双击 ----------
  await ready().catch(() => {});
  console.log('=== 实验 2：⑥「确认删除」真实双击（间隔 120ms）===');
  await page.click('#delete-test');
  await page.waitForSelector('#delete-confirm', { timeout: 8000 });
  const cb = await page.$('#delete-confirm');
  const cbox = await cb.boundingBox();
  await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
  await sleep(120);
  const stillThere = await page.$('#delete-confirm');
  console.log('  第二次点击时 #delete-confirm 还在吗 = ' + (stillThere ? '在' : '已不在（被"删除中…"替换）'));
  if (stillThere) {
    await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
  }
  await sleep(2500);
  console.log('  DELETE /api/notes 次数 = ' + deletes.length);
  console.log('  delete-box = "' + await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').slice(0, 160)).catch(() => '(无)') + '"');

  console.log('\n控制台报错：' + (consoleErrors.length ? consoleErrors.join(' | ') : '（无）'));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
