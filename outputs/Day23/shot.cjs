'use strict';
/* Day 23 · 交付截图（headless Chrome + puppeteer-core）
 * 用法：NODE_PATH=C:/Users/lenovo/.workbuddy/binaries/node/workspace/node_modules \
 *        node outputs/Day23/shot.cjs
 * 前置：先起 outputs/Day23/mock-server.cjs（端口 8791）
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const OUT = 'D:/vibe coding/课程任务/outputs/Day23';

const SHOTS = [
  {
    url: 'http://127.0.0.1:8791/outputs/Day23/proof-secret-scan.html',
    file: 'Day23-密钥排查-搜索结果0条.png',
    width: 1180, height: 1000,
  },
  {
    url: 'http://127.0.0.1:8791/outputs/Day23/error-demo.html',
    file: 'Day23-三类错误-中文提示.png',
    width: 1180, height: 1060,
    waitFor: () => document.title.indexOf('就绪') !== -1,
  },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2'],
  });
  for (const s of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 2 });
    await page.goto(s.url, { waitUntil: 'load', timeout: 40000 });
    if (s.waitFor) await page.waitForFunction(s.waitFor, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: OUT + '/' + s.file, fullPage: true });
    console.log('已截图：' + s.file);
    await page.close();
  }
  await browser.close();
  console.log('done');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
