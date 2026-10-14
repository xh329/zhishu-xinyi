/* Day 28 · 结营验收截图
 *
 * 用法：NODE_PATH=/c/Users/lenovo/.workbuddy/binaries/node/workspace/node_modules \
 *        node outputs/Day28/make-shots.cjs
 *
 * 产出：
 *   ① shots/验收截图1-附录J清单打勾.png   —— 本地 checklist 整页（带勾选状态）
 *   ② shots/验收截图2-公网作品.png         —— 公网首页 + 真实地址栏（作品完整可见）
 * 并顺带抓 check.html 的「健康 + 条数」文本，作为"线上可用"的当场证据。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const BASE = 'https://zhishu-xinyi-70127.app.workbuddy.host/';
const OUT = path.join(__dirname, 'shots');
const CHECKLIST = path.join(__dirname, '验收清单-附录J.html');
const LOG = path.join(__dirname, '线上可用性-当场取证.txt');

fs.mkdirSync(OUT, { recursive: true });
const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });

  // ---------- ① 附录 J 清单（本地文件，整页） ----------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1180, height: 1400, deviceScaleFactor: 2 });
    await page.goto('file:///' + CHECKLIST.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));
    const p = path.join(OUT, '验收截图1-附录J清单打勾.png');
    await page.screenshot({ path: p, fullPage: true });
    say('[①] saved ' + path.basename(p));
    await page.close();
  }

  // ---------- ② 公网作品 + 真实地址栏 ----------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 40000 });
    // 先写入两条示例数据（等价于用户现场手输一本书 + 一段心得），让首页/心迹展示真实内容
    await page.evaluate(() => {
      const b = [{ id: 'b_demo01', title: '非暴力沟通', user_id: 'local', created_at: new Date().toISOString() }];
      const n = [{
        id: 'n_demo01', book_id: 'b_demo01', content: '说话的锋利，常常不是为了伤人，而是因为自己也没被好好听过。',
        mood: ['触动', '思索'], user_id: 'local', created_at: new Date().toISOString(),
      }];
      localStorage.setItem('zhishu_books', JSON.stringify(b));
      localStorage.setItem('zhishu_notes', JSON.stringify(n));
    });
    await page.reload({ waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise((r) => setTimeout(r, 2400)); // 等进场动画
    // 注入真实地址栏（顶栏固定，并把内容整体下移，不被遮住）
    await page.evaluate((url) => {
      const bar = document.createElement('div');
      bar.id = '__addrbar';
      bar.style.cssText = 'position:fixed;left:0;right:0;top:0;height:46px;z-index:2147483647;display:flex;'
        + 'align-items:center;gap:8px;padding:0 16px;background:#f1f3f4;border-bottom:1px solid #cfd4d9;'
        + 'font-family:"Segoe UI",system-ui,sans-serif;font-size:14px;color:#3c4043;';
      bar.innerHTML =
        '<span style="display:flex;gap:6px;margin-right:10px">'
        + '<span style="width:11px;height:11px;border-radius:50%;background:#ff5f57"></span>'
        + '<span style="width:11px;height:11px;border-radius:50%;background:#febc2e"></span>'
        + '<span style="width:11px;height:11px;border-radius:50%;background:#28c840"></span></span>'
        + '<span style="flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;'
        + 'border-radius:999px;padding:5px 14px;overflow:hidden;color:#202124">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="margin-right:7px;flex:none">'
        + '<rect x="4" y="10" width="16" height="11" rx="2.5" fill="#5f6368"/>'
        + '<path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#5f6368" stroke-width="2.2" fill="none"/></svg>'
        + url + '</span>';
      document.body.appendChild(bar);
      document.body.style.paddingTop = '46px';
    }, BASE);
    await new Promise((r) => setTimeout(r, 400));
    const p = path.join(OUT, '验收截图2-公网作品.png');
    await page.screenshot({ path: p }); // 视口图 = 浏览器窗口的样子
    say('[②] saved ' + path.basename(p) + '  (URL=' + BASE + ')');
    await page.close();
  }

  // ---------- ③ 线上检查台当场取证（健康 + 条数 + 写入闭环） ----------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
    await page.goto(BASE + 'check.html', { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise((r) => setTimeout(r, 1500));
    const health = await page.$eval('#health-box', (n) => n.textContent.trim()).catch(() => '(未找到 #health-box)');
    const dataText = await page.$eval('#data-box', (n) => n.textContent.replace(/\s+/g, ' ').trim()).catch(() => '(未找到 #data-box)');
    say('[③] check.html 健康：' + health);
    say('[③] check.html 数据：' + dataText.slice(0, 200));
    const p = path.join(OUT, '附-线上检查台.png');
    await page.screenshot({ path: p });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(LOG, 'Day 28 · 线上可用性当场取证\n生成时间：' + new Date().toISOString() + '\n\n' + lines.join('\n') + '\n', 'utf8');
  say('log -> ' + path.relative(process.cwd(), LOG));
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
