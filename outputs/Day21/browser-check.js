/* Day 21 · 浏览器层交叉验证（补齐 ①-3 换浏览器 / ③-1 Console 红字 两项「未执行」）
 *
 * 用法：NODE_PATH=<workspace>/node_modules node outputs/Day21/browser-check.js
 *
 * 做什么：
 *   A 浏览器：开首页/检查台 → 点「写入测试」→ 页面自动刷新 → 全程录 Console 与 Network
 *   B 浏览器（全新 profile，等价换一个浏览器）：再开一次 → 比对条数是否一致
 * 不做什么：不假装这是公网请求（域名是 127.0.0.1:8787，公网 FAIL 的结论不变）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const STATIC = 'http://127.0.0.1:8137';
const API = 'http://127.0.0.1:8787';
const SHOTS = 'D:/vibe coding/课程任务/outputs/Day21/shots';
const LOG = path.join(__dirname, '浏览器层交叉验证.txt');

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function attach(page, bag) {
  page.on('console', (m) => bag.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => bag.pageerror.push(String((e && e.message) || e)));
  page.on('requestfailed', (r) => bag.failed.push(r.url() + ' :: ' + ((r.failure() || {}).errorText)));
  page.on('response', (r) => {
    const u = r.url();
    if (u.indexOf('/api/') !== -1) bag.api.push(r.status() + ' ' + r.request().method() + ' ' + u);
  });
}

async function textOf(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? el.textContent.trim().replace(/\s+/g, ' ') : '(未找到 ' + s + ')';
  }, sel);
}

(async () => {
  say('Day 21 · 浏览器层交叉验证（' + new Date().toLocaleString('zh-CN') + '）');
  say('A 浏览器：Chromium 154 headless · 静态 ' + STATIC + ' · 接口 ' + API);
  say('目的：补齐同伴清单里当日标记「未执行」的 ①-3（换浏览器）与 ③-1（Console 红字）两步。');
  say('');

  const browserA = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--hide-scrollbars'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const bagA = { console: [], pageerror: [], failed: [], api: [] };
  const page = await browserA.newPage();
  attach(page, bagA);

  await page.goto(STATIC + '/index.html?api=' + API + '#/home', { waitUntil: 'networkidle2' });
  await sleep(1500);
  say('【①-1 首页】底部统计 = ' + (await textOf(page, '#stat')));
  await page.screenshot({ path: SHOTS + '/flow-1-home.png' });

  const check = await browserA.newPage();
  attach(check, bagA);
  await check.goto(STATIC + '/check.html?api=' + API, { waitUntil: 'networkidle2' });
  await sleep(1500);
  say('【①-2 检查台】健康 = ' + (await textOf(check, '#health-box')));
  say('              读库（写入前）= ' + (await textOf(check, '#data-box')));
  say('              更新时间（写入前）= ' + (await textOf(check, '#last-update')));
  await check.screenshot({ path: SHOTS + '/flow-2-check-before.png' });

  const before = (await textOf(check, '#data-box')).match(/books 表：(\d+) 本/);

  await check.click('#write-test');
  await sleep(500);
  say('【②-3 写入】按钮反馈 = ' + (await textOf(check, '#write-box')));
  await check.screenshot({ path: SHOTS + '/flow-3-write-ok.png' });

  await sleep(2500); // check.js 写入成功后 900ms 自动 reload
  await sleep(1200);
  const dataAfter = await textOf(check, '#data-box');
  const after = dataAfter.match(/books 表：(\d+) 本/);
  say('【②-4 刷新后】读库 = ' + dataAfter);
  say('                更新时间（写入后）= ' + (await textOf(check, '#last-update')));
  say('                条数变化：' + (before ? before[1] : '?') + ' → ' + (after ? after[1] : '?'));
  await check.screenshot({ path: SHOTS + '/flow-4-check-after.png' });

  const hosts = Array.from(new Set(bagA.api.map((l) => {
    const m = l.match(/^(\d+) (\w+) (https?:\/\/[^/]+)/);
    return m ? m[3] : '(未解析)';
  })));
  say('【②-5 域名】接口请求域名 = ' + JSON.stringify(hosts) +
    ' → 期望公网时为 apigw.tencentcs.com；本次是 127.0.0.1（本地路径），按判定标准此步 FAIL');

  const errs = bagA.console.filter((c) => c.type === 'error');
  say('【③-1 Console】error = ' + errs.length + ' 条 ／ warning = ' +
    bagA.console.filter((c) => c.type === 'warning').length + ' 条');
  say('             JS 未捕获异常 = ' + bagA.pageerror.length + ' ／ 请求失败 = ' + bagA.failed.length);
  errs.forEach((e) => say('   ↳ ' + e.text.slice(0, 160)));
  bagA.pageerror.forEach((e) => say('   ↳ pageerror: ' + e.slice(0, 160)));
  bagA.failed.forEach((e) => say('   ↳ requestfailed: ' + e.slice(0, 160)));

  say('【③-2 Network】接口请求明细：');
  bagA.api.forEach((l) => say('   ' + l));
  say('         非 2xx 的接口请求 = ' + bagA.api.filter((l) => !/^(200|201|204)/.test(l)).length);

  await browserA.close();

  say('');
  say('B 浏览器（全新 user-data-dir = 一个从没打开过本站的干净浏览器）');
  const browserB = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: 'C:/Users/lenovo/AppData/Local/Temp/zhishu-profile-B',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--hide-scrollbars'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const bagB = { console: [], pageerror: [], failed: [], api: [] };
  const pageB = await browserB.newPage();
  attach(pageB, bagB);
  await pageB.goto(STATIC + '/check.html?api=' + API, { waitUntil: 'networkidle2' });
  await sleep(1800);
  const dataB = await textOf(pageB, '#data-box');
  say('【①-3】B 浏览器健康 = ' + (await textOf(pageB, '#health-box')));
  say('        B 浏览器读库 = ' + dataB);
  await pageB.screenshot({ path: SHOTS + '/flow-5-fresh-browser.png' });

  const cnts = dataAfter.match(/books 表：(\d+) 本[\s\S]*?notes 表：(\d+) 段/);
  const cntsB = dataB.match(/books 表：(\d+) 本[\s\S]*?notes 表：(\d+) 段/);
  const a1 = cnts ? cnts[1] + '/' + cnts[2] : '?';
  const b1 = cntsB ? cntsB[1] + '/' + cntsB[2] : '?';
  say('        A 浏览器 books/notes = ' + a1 + ' ／ B 浏览器 = ' + b1);
  say('        判定：' + (a1 === b1 && a1 !== '?'
    ? 'PASS —— 全新浏览器（零本地数据）读到相同条数，证明数据来自服务端而非本机缓存'
    : 'FAIL —— 条数不一致'));
  say('        注：这是「换一个干净浏览器 profile」，不等同物理换台设备；真·跨设备仍要有公网 URL。');
  say('        B 浏览器 Console error = ' + bagB.console.filter((c) => c.type === 'error').length + ' 条');
  await browserB.close();

  fs.writeFileSync(LOG, lines.join('\n') + '\n', 'utf8');
  console.log('\n日志已写入 ' + LOG);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
