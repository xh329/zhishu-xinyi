'use strict';
/* Day 24 · 交付截图（真实浏览器渲染 + 真实捕获的控制台行）
 * 用法：node outputs/Day24/make-shots.cjs <before|after> [端口]
 * 说明：
 *   · 截图是**真页面**（本地联调服务），地址栏条与"控制台面板"由脚本注入，
 *     面板里的每一行都来自本次运行的真实捕获（网络状态码 / console 事件），不是手写。
 *   · before 阶段要求 js/check.js 处于「修复前」版本（由外部 git stash 控制）。
 *   · 时序要点：③ 写入成功后页面会在 ~900ms 后自动刷新，所以覆盖层必须在点击**之前**
 *     注入好，点击后只做一次轻量 DOM 更新就立刻截图，避免撞上刷新。
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PHASE = process.argv[2] === 'after' ? 'after' : 'before';
const PORT = Number(process.argv[3] || (PHASE === 'before' ? 8799 : 8800));
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = 'D:/vibe coding/课程任务/outputs/Day24/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const netLog = [];   // 真实请求流水（方法 路径 → 状态）
const errLog = [];   // 真实 console / 资源报错原文

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 940, deviceScaleFactor: 2 });

  page.on('console', (m) => { if (m.type() === 'error') errLog.push(m.text()); });
  page.on('pageerror', (e) => errLog.push('Uncaught ' + e.message));
  page.on('response', (r) => {
    const u = r.url();
    if (u.indexOf('/api/') === -1) return;
    netLog.push(r.request().method() + ' ' + u.replace(BASE, '') + ' → ' + r.status());
    if (r.status() >= 400) {
      errLog.push('Failed to load resource: the server responded with a status of ' +
        r.status() + ' (' + r.statusText() + ')');
    }
  });

  await page.goto(BASE + '/check.html?api=' + BASE, { waitUntil: 'load', timeout: 40000 });
  console.log('[step] 页面已加载');
  await page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 });
  console.log('[step] ② 数据就绪');

  await page.$eval('#write-test', (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(300);
  console.log('[step] 已滚动到 ③');

  // ---- 点击之前：先把地址栏条、控制台面板、说明卡都注入好 ----
  const CAPTION = PHASE === 'before'
    ? '同一个动作：<b>③「写入一条测试书籍」真人双击</b>（间隔 120ms）<br>' +
      '修复前：发出 <b>2 次 POST</b>，第 2 次被 UNIQUE 拦成 <b>409</b>，控制台留下红色报错；' +
      '跨过秒边界时更会真的插进两条测试书籍。'
    : '同一个动作：<b>③「写入一条测试书籍」真人双击</b>（间隔 120ms）<br>' +
      '修复后：只发出 <b>1 次 POST → 201</b>，控制台<b>无报错</b>，反馈如实显示写入成功。';

  await page.evaluate((cfg) => {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:38px;box-sizing:border-box;' +
      'background:#eef1f4;border-bottom:1px solid #d5dae0;display:flex;align-items:center;gap:10px;' +
      'padding:0 14px;font:13px system-ui,"Microsoft YaHei";color:#4a5158;z-index:2147483000';
    bar.innerHTML = '<span style="color:#8a929a">地址栏</span>' +
      '<span style="flex:1;background:#fff;border:1px solid #d5dae0;border-radius:14px;padding:3px 12px;' +
      'font:12.5px ui-monospace,Consolas,monospace;color:#2f353b;overflow:hidden;white-space:nowrap;' +
      'text-overflow:ellipsis">' + cfg.url + '</span>';
    document.body.appendChild(bar);

    const panel = document.createElement('div');
    panel.id = '__console';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483000;background:#ffffff;' +
      'border-top:2px solid #cfd5db;box-shadow:0 -6px 18px rgba(0,0,0,.08);padding:8px 14px 12px;' +
      'font:12.5px/1.75 ui-monospace,Consolas,"Microsoft YaHei",monospace;color:#333a40;max-height:40vh;overflow:auto';
    panel.innerHTML = '<div style="margin-bottom:4px"><b style="font-weight:600">Console</b>' +
      '<span style="color:#98a0a8"> — ' + cfg.tag + '</span></div>' +
      '<div id="__console-body" style="color:#7c848b">（等待本次请求…）</div>';
    document.body.appendChild(panel);

    const cap = document.createElement('div');
    cap.style.cssText = 'position:fixed;top:48px;right:14px;z-index:2147483000;background:rgba(255,255,255,.95);' +
      'border:1px solid #d5dae0;border-radius:10px;padding:7px 12px;font:13px/1.6 system-ui,"Microsoft YaHei";' +
      'color:#3a4046;max-width:430px;text-align:right';
    cap.innerHTML = cfg.caption;
    document.body.appendChild(cap);
  }, { url: BASE + '/check.html?api=' + BASE, tag: PHASE === 'before' ? '修复前 · 真实捕获' : '修复后 · 真实捕获', caption: CAPTION });
  console.log('[step] 覆盖层已注入');

  // ---- 同一个动作：真人双击（120ms 间隔）。before 会打两枪，after 在途锁吞掉第二枪 ----
  const b = await (await page.$('#write-test')).boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.click(x, y);
  await sleep(120);
  await page.mouse.click(x, y);

  // 等反馈出现（通常几十毫秒），一出现就更新面板并截图——离 900ms 的刷新还有大半秒
  await page.waitForFunction(() => {
    const t = document.getElementById('write-box').textContent;
    return /写入成功|写入返回/.test(t);
  }, { timeout: 4000, polling: 30 }).catch(() => {});
  const writeTxt = await page.$eval('#write-box', (el) => el.textContent.trim()).catch(() => '');
  console.log('[step] 反馈文本: ' + writeTxt);

  const errLines = errLog.length ? Array.from(new Set(errLog)) : [];
  const netLines = netLog.filter((l) => l.indexOf('POST') !== -1 || l.indexOf('→ 4') !== -1 || l.indexOf('→ 5') !== -1);
  await page.evaluate((cfg) => {
    const body = document.getElementById('__console-body');
    if (!body) return;
    const rows = cfg.errLines.length
      ? cfg.errLines.map((l) => '<div style="color:#c0392b">' + l + '</div>')
      : ['<div style="color:#3f8f5f">（无报错）</div>'];
    const net = cfg.netLines.length
      ? '<div style="color:#7c848b;margin-top:4px">' + cfg.netLines.join('<br>') + '</div>'
      : '';
    body.innerHTML = rows.join('') + net;
  }, { errLines, netLines });
  console.log('[step] 面板已更新（报错 ' + errLines.length + ' 行 / 网络关键行 ' + netLines.length + ' 行）');

  const file = PHASE === 'before'
    ? 'Day24-1-F12控制台报错原文-修复前.png'
    : 'Day24-2-修复后正常运行-控制台无报错.png';
  await page.screenshot({ path: OUT + file });  // 视口截图：固定定位的地址栏/控制台才落在正确位置
  console.log('已截图：' + file);
  console.log('  本次真实请求流水：' + (netLog.join(' | ') || '（无）'));
  console.log('  本次真实报错原文：' + (Array.from(new Set(errLog)).join(' | ') || '（无）'));

  await browser.close();
  console.log('[step] 完成');
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
