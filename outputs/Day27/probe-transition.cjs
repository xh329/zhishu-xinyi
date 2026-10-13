const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900 });
  await page.goto('http://127.0.0.1:8138/book.html', { waitUntil: 'networkidle2' });
  const r1 = await page.evaluate(() => {
    const g = (el) => { const s = getComputedStyle(el); return s.animationName + ' ' + s.animationDuration + ' delay=' + s.animationDelay; };
    const panel = document.querySelector('.panel');
    const kids = Array.from(panel.children).map((c) => c.className + ' → ' + g(c));
    return { viewbar: g(document.querySelector('.glow') ? panel : panel), kids };
  });
  console.log('== book.html（.panel 子元素错开）==');
  r1.kids.forEach((k) => console.log(' ', k));
  await page.goto('http://127.0.0.1:8138/index.html#/books', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 300));
  const r2 = await page.evaluate(() => {
    const g = (el) => { const s = getComputedStyle(el); return s.animationName + ' ' + s.animationDuration + ' delay=' + s.animationDelay; };
    const view = document.querySelector('#view-books');
    const kids = Array.from(view.children).map((c) => c.className + ' → ' + g(c));
    return { viewbar: g(document.querySelector('.viewbar')), kids };
  });
  console.log('== index.html#/books（.viewbar 先落定，.shelf 随后）==');
  console.log('  .viewbar →', r2.viewbar);
  r2.kids.forEach((k) => console.log(' ', k));
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
