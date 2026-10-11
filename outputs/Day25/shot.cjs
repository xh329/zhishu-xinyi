/* ============================================================================
 * outputs/Day25/shot.cjs —— 把 verify-project 的检查报告渲染成一张「终端风」截图
 * 用途：Day25 交付截图——图里能直接看出「故意留的问题被 Skill 查出来了」。
 * 运行：NODE_PATH=<workspace>/node_modules node outputs/Day25/shot.cjs
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const ROOT = path.resolve(__dirname, '..', '..');

// 报告来源：优先用命令行传入的 txt 文件，默认「埋雷后」
const reportFile = process.argv[2] || path.join(ROOT, 'outputs/Day25/检查报告-埋雷后.txt');
const outFile = process.argv[3] || path.join(ROOT, 'outputs/Day25/Day25-发布前检查-故意留的问题被查出.png');
const captionText = process.argv[4] || '故意把 book.html 的脚本引用改坏（js/book.js → js/book-view.js），检查 Skill 精确报出断链';

const raw = fs.readFileSync(reportFile, 'utf8');

// 把纯文本转成带高亮的 HTML 行
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const lines = raw.replace(/\n$/, '').split('\n').map((ln) => {
  let cls = 'l';
  if (/^\[FAIL\]/.test(ln)) cls = 'l fail';
  else if (/^\[PASS\]/.test(ln)) cls = 'l pass';
  else if (/未通过项|失败 [1-9]/.test(ln)) cls = 'l warn';
  else if (/^==/.test(ln)) cls = 'l sep';
  else if (/^\s+证据：/.test(ln)) cls = 'l evi';
  else if (/^\s+备注：/.test(ln)) cls = 'l note';
  else if (/栀书心驿|合计/.test(ln)) cls = 'l title';
  return `<div class="${cls}">${esc(ln) || '&nbsp;'}</div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f6f3ee; font-family:"Microsoft YaHei","Segoe UI",sans-serif; padding:28px; }
  .card { width:1000px; margin:0 auto; background:#fff; border-radius:12px;
          box-shadow:0 8px 30px rgba(0,0,0,.12); overflow:hidden; }
  .head { background:#2f2b28; color:#f3ece4; padding:14px 20px; display:flex; align-items:center; gap:10px; }
  .dot { width:11px; height:11px; border-radius:50%; }
  .dot.r{background:#ff5f57}.dot.y{background:#febc2e}.dot.g{background:#28c840}
  .head .ttl { margin-left:8px; font-size:13px; color:#cfc6bb; font-family:Consolas,Monaco,monospace; }
  .term { background:#1e1c1a; padding:18px 22px 22px; font-family:Consolas,"Courier New",monospace;
          font-size:13.5px; line-height:1.62; color:#d8d2c9; white-space:pre-wrap; word-break:break-all; }
  .l { }
  .l.pass { color:#4ec9a0; }
  .l.fail { color:#ff6b6b; background:rgba(255,107,107,.10); font-weight:700; }
  .l.warn { color:#ffb454; font-weight:700; }
  .l.evi  { color:#9aa7b8; }
  .l.note { color:#c9a86a; }
  .l.sep  { color:#5c5751; }
  .l.title{ color:#e8e2d8; }
  .cap { padding:14px 20px; background:#fffaf5; border-top:1px solid #eee6dc;
         font-size:13.5px; color:#5b5348; line-height:1.7; }
  .cap b { color:#b4562f; }
  .cap .tag { display:inline-block; background:#fde8e0; color:#b4562f; border-radius:4px;
              padding:1px 7px; font-size:12px; margin-right:6px; }
</style></head>
<body>
  <div class="card">
    <div class="head">
      <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      <span class="ttl">D:\\vibe coding\\课程任务 — node skills/verify-project/verify.cjs</span>
    </div>
    <div class="term">${lines}</div>
    <div class="cap">
      <span class="tag">埋雷验证</span>${esc(captionText)}
    </div>
  </div>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 900, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const card = await page.$('.card');
  await card.screenshot({ path: outFile });
  await browser.close();
  console.log('截图已生成：' + outFile);
})().catch((e) => { console.error(e); process.exit(1); });
