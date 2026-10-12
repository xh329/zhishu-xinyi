#!/usr/bin/env node
/* ============================================================================
 * outputs/Day26/shot-terminal.cjs —— 把命令输出渲染成一张「终端风」截图
 * 用途：Day 26 交付截图 ②——回滚前后的提交记录 + 版本指纹对照。
 * 用法：node shot-terminal.cjs <txt文件> <out.png> ["标题"]
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const [txtFile, outFile, title] = process.argv.slice(2);
if (!txtFile || !outFile) { console.error('用法：shot-terminal.cjs <txt> <out.png> ["标题"]'); process.exit(1); }

const raw = fs.readFileSync(txtFile, 'utf8').replace(/\n$/, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = raw.split('\n').map((ln) => {
  let cls = 'l';
  if (/^(\$|#)/.test(ln)) cls = 'l cmd';
  else if (/8730940|v1\.0/.test(ln)) cls = 'l cur';
  else if (/2c7d38c/.test(ln)) cls = 'l prev';
  else if (/✅/.test(ln)) cls = 'l ok';
  else if (/⚠|不一致|无版本标记/.test(ln)) cls = 'l warn';
  return `<div class="${cls}">${esc(ln) || '&nbsp;'}</div>`;
}).join('\n');

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#202124;font-family:"Microsoft YaHei",sans-serif;padding:26px;display:inline-block}
.card{background:#1b1b1f;border:1px solid #3c4043;border-radius:12px;overflow:hidden;min-width:1040px}
.bar{height:40px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#2a2a2f;border-bottom:1px solid #3c4043}
.dot{width:11px;height:11px;border-radius:50%}
.t{margin-left:10px;color:#9aa0a6;font-size:13px}
.body{padding:18px 22px;font-family:Consolas,"Courier New",monospace;font-size:15px;line-height:1.85;color:#e8eaed;white-space:pre-wrap}
.l.cmd{color:#8ab4f8;font-weight:bold}
.l.cur{color:#81c995}
.l.prev{color:#fdd663}
.l.ok{color:#81c995}
.l.warn{color:#f28b82}
</style></head><body><div class="card">
<div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="t">${esc(title || 'git-bash —— 栀书心驿')}</span></div>
<div class="body">${lines}</div>
</div></body></html>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--force-device-scale-factor=1'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1160, height: 200, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    const el = await page.$('.card');
    await el.screenshot({ path: path.resolve(outFile) });
    console.log('[shot] ' + outFile);
  } finally { await browser.close(); }
})().catch((e) => { console.error('[error] ' + e.message); process.exit(1); });
