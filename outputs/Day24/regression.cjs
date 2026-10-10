'use strict';
/* Day 24 · 核心流程回归验证（修复后重跑同一份清单）
 * 清单即《核心流程测试清单.md》里的 C1–C10，逐条跑真实浏览器断言。
 * 用法：node outputs/Day24/regression.cjs [端口] [输出文件]
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Users/lenovo/.agent-browser/browsers/chrome-154.0.8037.57/chrome.exe';
const PORT = Number(process.argv[2] || 8797);
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = 'D:/vibe coding/课程任务/outputs/Day24/' + (process.argv[3] || '回归验证-修复后.txt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lines = [];
const results = [];
const say = (s) => { lines.push(s); console.log(s); };
function check(name, ok, detail) {
  results.push({ name, ok });
  say((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   —— ' + detail : ''));
}

const counters = { post: 0, patch: 0, del: 0, get: 0, health: 0 };
function resetCounters() { counters.post = counters.patch = counters.del = counters.get = counters.health = 0; }
let consoleErrors = [];
let badResponses = [];
let faviconHits = 0;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 900 });

  page.on('request', (r) => {
    const u = r.url(), m = r.method();
    if (u.indexOf('/favicon') !== -1) faviconHits++;
    if (u.indexOf('/api/health') !== -1) counters.health++;
    else if (m === 'POST' && u.indexOf('/api/books') !== -1) counters.post++;
    else if (m === 'PATCH' && u.indexOf('/api/notes') !== -1) counters.patch++;
    else if (m === 'DELETE' && u.indexOf('/api/notes') !== -1) counters.del++;
    else if (m === 'GET' && u.indexOf('/api/') !== -1) counters.get++;
  });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(BASE, '')); });

  const ready = () => page.waitForFunction(() => {
    const el = document.getElementById('data-box');
    return el && /books 表/.test(el.textContent);
  }, { timeout: 15000 });
  const booksText = () => page.$eval('#data-box', (el) => (el.textContent.match(/books 表：(\d+) 本/) || [])[1]);
  const clickReal = async (sel) => {
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
    await sleep(250);
    const b = await (await page.$(sel)).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    return b;
  };

  say('=== Day 24 核心流程回归验证（修复后）===');
  say('时间：' + new Date().toISOString());
  say('页面：' + BASE + '/check.html?api=' + BASE);
  say('');

  /* ---------- C1 打开检查台 → 读取 books/notes ---------- */
  say('C1 打开检查台 → 读取 books / notes');
  resetCounters();
  await page.goto(BASE + '/check.html?api=' + BASE, { waitUntil: 'load', timeout: 40000 });
  await ready().catch(() => {});
  const b0 = await booksText();
  const notesLine = await page.$eval('#data-box', (el) => (el.textContent.match(/notes 表：(\d+) 段/) || [])[1]);
  const lastUpd = await page.$eval('#last-update', (el) => el.textContent.trim());
  check('C1.1 ② 读到 books 表条数', !!b0, 'books 表：' + b0 + ' 本');
  check('C1.2 ② 读到 notes 表条数', !!notesLine, 'notes 表：' + notesLine + ' 段');
  check('C1.3 ④ 显示最后更新时间', /更新于/.test(lastUpd), lastUpd);
  check('C1.4 ① 健康状态在线', /在线/.test(await page.$eval('#health-box', (el) => el.textContent)), (await page.$eval('#health-box', (el) => el.textContent)).slice(0, 40));

  /* ---------- C2 ③ 单击写入：恰好 1 次 POST ---------- */
  say('\nC2 ③ 单击「写入一条测试书籍」→ 恰好 1 次 POST /api/books');
  resetCounters();
  await clickReal('#write-test');
  await page.waitForFunction(() => /写入成功/.test(document.getElementById('write-box').textContent), { timeout: 15000 }).catch(() => {});
  const writeMsg = await page.$eval('#write-box', (el) => el.textContent.trim());
  check('C2.1 单次点击只发 1 次 POST', counters.post === 1, 'POST 次数 = ' + counters.post);
  check('C2.2 反馈显示写入成功', /写入成功/.test(writeMsg), writeMsg.slice(0, 50));
  await sleep(1500);
  await ready().catch(() => {});

  /* ---------- C3 ③ 真人双击（120ms）：仍只 1 次 POST ---------- */
  say('\nC3 ③ 真实鼠标双击（间隔 120ms）→ 仍只 1 次 POST（修复前为 2 次）');
  resetCounters();
  const wbox = await clickReal('#write-test');
  await sleep(120);
  await page.mouse.click(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2);
  await sleep(400);
  const postAfterDouble = counters.post;
  await sleep(1500);
  await ready().catch(() => {});
  check('C3.1 双击只发 1 次 POST', postAfterDouble === 1, 'POST 次数 = ' + postAfterDouble);

  /* ---------- C4 ③ 跨秒双击：仍只 1 次 POST、只多 1 条书 ---------- */
  say('\nC4 ③ 跨秒双击（第二下落在下一秒）→ 只多 1 条书（修复前真的多插 1 条）');
  resetCounters();
  const beforeC4 = Number(await booksText());
  const skew = await page.evaluate(() => Date.now() % 1000);
  await sleep(Math.max(0, (1000 - skew) - 60));
  const wbox2 = await clickReal('#write-test');
  await sleep(120);
  await page.mouse.click(wbox2.x + wbox2.width / 2, wbox2.y + wbox2.height / 2);
  await sleep(400);
  const postC4 = counters.post;
  await sleep(1500);
  await ready().catch(() => {});
  const afterC4 = Number(await booksText());
  check('C4.1 跨秒双击只发 1 次 POST', postC4 === 1, 'POST 次数 = ' + postC4);
  check('C4.2 只新增 1 条书籍（无重复插入）', afterC4 - beforeC4 === 1, beforeC4 + ' → ' + afterC4);

  /* ---------- C5 刷新确认 ---------- */
  say('\nC5 刷新确认：② 的条数/更新时间跟着变（写入触发 reload）');
  check('C5.1 写入后 books 条数已增长', afterC4 > Number(b0), b0 + ' → ' + afterC4);

  /* ---------- C6 ⑤ 改写（PATCH） ---------- */
  say('\nC6 ⑤ 改写一段心得 → PATCH 200，改后值读回');
  resetCounters();
  await page.$eval('#patch-content', (el) => { el.value = '（Day24 回归）改一处，看看值跟不跟着变。'; });
  await clickReal('#patch-save');
  await page.waitForFunction(() => /接口返回 200|改写没成/.test(document.getElementById('patch-box').textContent), { timeout: 15000 }).catch(() => {});
  const patchMsg = await page.$eval('#patch-box', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  check('C6.1 恰好 1 次 PATCH', counters.patch === 1, 'PATCH 次数 = ' + counters.patch);
  check('C6.2 返回 200 并给出前后对比', /接口返回 200/.test(patchMsg) && /改之后/.test(patchMsg), patchMsg.slice(0, 60));

  /* ---------- C7 ⑤ 空正文：温柔提示且不发请求 ---------- */
  say('\nC7 ⑤ 正文改成空白 → 温柔中文提示，且不发请求');
  resetCounters();
  await page.$eval('#patch-content', (el) => { el.value = '   '; });
  await clickReal('#patch-save');
  await sleep(500);
  const blankMsg = await page.$eval('#patch-box', (el) => el.textContent.trim());
  check('C7.1 空白正文被前端拦下', /不能改成空白/.test(blankMsg), blankMsg);
  check('C7.2 未发出 PATCH 请求', counters.patch === 0, 'PATCH 次数 = ' + counters.patch);

  /* ---------- C8 ⑤ 未改动：提示且不发请求 ---------- */
  say('\nC8 ⑤ 正文与心情都没动 → 提示「先改一处」，且不发请求');
  resetCounters();
  // 从接口取「当前这条心得的正文」，填回输入框 —— 这样才算真的没改动
  const currentContent = await page.evaluate(async (base) => {
    const r = await fetch(base + '/api/notes?user_id=local&limit=100');
    const d = await r.json();
    return d.notes[0].content;
  }, BASE);
  await page.$eval('#patch-content', (el, v) => { el.value = v; }, currentContent);
  await clickReal('#patch-save');
  await sleep(500);
  const sameMsg = await page.$eval('#patch-box', (el) => el.textContent.trim());
  check('C8.1 未改动被前端拦下', /先改一处/.test(sameMsg), sameMsg.slice(0, 60));
  check('C8.2 未发出 PATCH 请求', counters.patch === 0, 'PATCH 次数 = ' + counters.patch);

  /* ---------- C9 ⑥ 删除（二次确认）→ 恰好 1 次 DELETE，删后不再返回 ---------- */
  say('\nC9 ⑥ 删除一段心得 → 二次确认 → 恰好 1 次 DELETE，删后 GET 不再返回');
  resetCounters();
  await clickReal('#delete-test');
  await page.waitForSelector('#delete-confirm', { timeout: 8000 });
  const confirmTxt = await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  check('C9.1 先出二次确认行（未直接删）', /不可找回/.test(confirmTxt) && counters.del === 0, '此时 DELETE 次数 = ' + counters.del);
  await clickReal('#delete-confirm');
  await page.waitForFunction(() => /接口返回 200|删除返回/.test(document.getElementById('delete-box').textContent), { timeout: 15000 }).catch(() => {});
  const delMsg = await page.$eval('#delete-box', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  check('C9.2 确认后只发 1 次 DELETE', counters.del === 1, 'DELETE 次数 = ' + counters.del);
  check('C9.3 删后 GET 不再返回该条', /已消失 ✓/.test(delMsg), delMsg.slice(0, 90));

  /* ---------- C10 ⑥ 程序化连点确认：防御性只 1 次 DELETE ---------- */
  say('\nC10 ⑥ 同一 tick 连点两次「确认删除」→ 防御性仍只 1 次 DELETE（修复前为 2 次 → 404）');
  resetCounters();
  await clickReal('#delete-test');
  await page.waitForSelector('#delete-confirm', { timeout: 8000 });
  await page.evaluate(() => { const c = document.getElementById('delete-confirm'); c.click(); c.click(); });
  await sleep(2500);
  check('C10.1 连点确认只发 1 次 DELETE', counters.del === 1, 'DELETE 次数 = ' + counters.del);
  const del404 = badResponses.filter((b) => /^404 DELETE/.test(b));
  check('C10.2 没有出现 404 DELETE 报错', del404.length === 0, del404.length ? del404.join(' | ') : '（无）');

  /* ---------- C11 控制台 / favicon ---------- */
  say('\nC11 全程控制台干净（含 favicon 不再 404）');
  check('C11.1 浏览器未自动请求 /favicon.ico', faviconHits === 0, 'favicon 请求次数 = ' + faviconHits);
  check('C11.2 全程控制台零 error', consoleErrors.length === 0, consoleErrors.length ? consoleErrors.join(' | ') : '（无）');
  const unexpected = badResponses.filter((b) => !/^409 POST/.test(b));
  check('C11.3 无非预期 4xx/5xx（409 已作为正常路径剔除）', unexpected.length === 0, unexpected.length ? unexpected.join(' | ') : '（无）');

  const pass = results.filter((r) => r.ok).length;
  say('');
  say('================ 汇总 ================');
  say('断言通过：' + pass + ' / ' + results.length);
  say(pass === results.length ? '结论：全部通过（修复有效，且未引入回归）。' : '结论：存在失败项，见上方 FAIL 行。');

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log('\n报告已写入：' + OUT);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(2); });
