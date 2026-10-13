const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
  const src = 'file:///' + path.resolve('D:/vibe coding/课程任务/outputs/Day27/资源检查结果-证据页.html').replace(/\\/g, '/');
  await page.goto(src, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 400));
  const out = 'D:/vibe coding/课程任务/outputs/Day27/shots/资源检查-证据.png';
  await page.screenshot({ path: out, fullPage: true });
  console.log('saved:', out);
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
