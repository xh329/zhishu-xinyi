const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'https://zhishu-xinyi-70127.app.workbuddy.host/';
const TAG = process.argv[3] || 'before';
const OUTDIR = 'D:/vibe coding/课程任务/outputs/Day27/shots';

const PAGES = [
  ['01-今日首页', ''],
  ['02-收下一本书', 'book.html'],
  ['03-写心得', 'note.html'],
  ['04-书架', 'index.html#/books'],
  ['05-心迹', 'index.html#/notes'],
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true });
  for (const [name, url] of PAGES) {
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise((r) => setTimeout(r, 2200)); // 等进场动画走完
    const p = `${OUTDIR}/转换-${TAG}-${name}.png`;
    await page.screenshot({ path: p });
    console.log('saved:', path.basename(p));
  }
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
