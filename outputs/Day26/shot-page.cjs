#!/usr/bin/env node
/* ============================================================================
 * outputs/Day26/shot-page.cjs —— 给「公网地址」截一张带地址栏 + 底部说明的图
 * ----------------------------------------------------------------------------
 * 为什么需要：交付要求「图里要有地址栏和页面」。无头浏览器默认没有浏览器 chrome，
 *   所以这里把**真实 URL** 渲染成一条地址栏叠在页面上（诚实标注，不是 OS 外观）。
 *
 * 用法：
 *   NODE_PATH=<workspace>/node_modules node outputs/Day26/shot-page.cjs <URL> <out.png> ["底部说明"]
 * 注意：screenshot 路径用 D:/ 形式，不要 /d/ 形式（Windows 侧会找不到路径）。
 * ========================================================================== */
'use strict';
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const [url, outFile, caption] = process.argv.slice(2);
if (!url || !outFile) {
  console.error('用法：shot-page.cjs <URL> <out.png> ["底部说明"]');
  process.exit(1);
}

/* 注入脚本：地址栏（上）+ 说明条（下）。同一份代码在浏览器上下文里执行。 */
function buildInjected(barCaption) {
  return `(function () {
  var CAPTION = ${JSON.stringify(barCaption || '')};
  ['__addrbar', '__shotcap'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.remove();
  });

  /* ---- 顶部：地址栏（还原真实 URL）---- */
  var b = document.createElement('div');
  b.id = '__addrbar';
  b.style.cssText = 'position:fixed;left:0;right:0;top:0;height:44px;z-index:2147483647;' +
    'display:flex;align-items:center;gap:8px;padding:0 14px;background:#f1f3f4;' +
    'border-bottom:1px solid #cfd4d9;font-family:Segoe UI,system-ui,sans-serif;' +
    'font-size:14px;color:#3c4043;box-sizing:border-box;';
  var lock = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex:none;margin-right:7px;">' +
    '<rect x="4" y="10" width="16" height="11" rx="2.5" fill="#5f6368"/>' +
    '<path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#5f6368" stroke-width="2.2" fill="none"/></svg>';
  b.innerHTML =
    '<span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;flex:none;"></span>' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#febc2e;flex:none;"></span>' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#28c840;flex:none;margin-right:10px;"></span>' +
    '<span style="flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;' +
    'border-radius:999px;padding:5px 14px;overflow:hidden;">' + lock +
    '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#202124;">' +
    location.href + '</span></span>';
  document.body.appendChild(b);
  document.body.style.paddingTop = '44px';   // 给正文让出地址栏高度，别压住导航

  /* 地址栏会盖住右上角悬浮按钮（音乐开关 top:18px）→ 临时下移（只作用于本次截图） */
  var s = document.createElement('style');
  s.textContent = '.music-btn{top:60px!important} .music-hint{display:none!important}';
  document.head.appendChild(s);

  /* ---- 底部：说明条 ---- */
  if (CAPTION) {
    var c = document.createElement('div');
    c.id = '__shotcap';
    c.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
      'padding:10px 16px;background:rgba(37,42,32,0.94);color:#f4f1e8;' +
      'font-family:Segoe UI,Microsoft YaHei,sans-serif;font-size:14px;line-height:1.5;' +
      'box-sizing:border-box;';
    c.textContent = CAPTION;
    document.body.appendChild(c);
  }
  return 'bar:' + location.href;
})();`;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));           // 等花瓣/淡入动画落定
    await page.evaluate(buildInjected(caption));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: outFile });
    // 顺手打印页面指纹，便于在演练记录里对上
    const info = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="app-version"]');
      const chip = document.querySelector('.foot-ver');
      return { title: document.title, meta: meta ? meta.content : '(无)', chip: chip ? chip.textContent.trim() : '(无)' };
    });
    console.log('[shot] ' + outFile);
    console.log('[shot] title=' + info.title + ' / meta=' + info.meta + ' / 页脚标记=' + info.chip);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('[shot][error] ' + e.message); process.exit(1); });
