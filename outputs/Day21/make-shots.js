/* Day 21 · 把三份验收文档渲染成「带地址栏」的 HTML，供 headless 浏览器截图
 *
 * 用法：NODE_PATH=<workspace>/node_modules node outputs/Day21/make-shots.js
 *
 * 说明（诚实标注）：
 *  - 内容是 markdown-it 真实渲染三份 .md 得到的，不是手编；
 *  - 页面顶部的地址栏是内嵌渲染的（headless 截图不含浏览器 chrome），
 *    显示的 URL 就是该文件在本地服务上的真实访问地址。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = __dirname;
const BASE = 'http://127.0.0.1:8137/outputs/Day21';

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

const JOBS = [
  { src: '周验收表-第3周.md', out: 'acceptance.html', tag: '① 周验收表（逐项证据）' },
  { src: '同伴交叉验证-三行结论.md', out: 'peer.html', tag: '② 同伴交叉验证 · 三行结论' },
  { src: '演示提纲.md', out: 'demo.html', tag: '③ 演示提纲（四段结构）' },
];

const CSS = `
:root{--ink:#2f3a2e;--sub:#6b7a68;--line:#e3e7df;--soft:#f7f8f4;--accent:#5f774f;--warn:#b4453a;--ok:#3f7a45;}
*{box-sizing:border-box;}
body{margin:0;background:#fff;color:var(--ink);
  font-family:"Noto Serif SC","Songti SC",Georgia,serif;font-size:15px;line-height:1.75;}
#__addrbar{position:fixed;left:0;right:0;top:0;height:44px;z-index:99999;display:flex;align-items:center;gap:8px;
  padding:0 14px;background:#f1f3f4;border-bottom:1px solid #cfd4d9;
  font-family:"Segoe UI",system-ui,sans-serif;font-size:14px;color:#3c4043;}
#__addrbar .dots{display:flex;gap:6px;margin-right:10px;}
#__addrbar .dot{width:11px;height:11px;border-radius:50%;}
#__addrbar .omni{flex:1;display:flex;align-items:center;background:#fff;border:1px solid #dadce0;
  border-radius:999px;padding:5px 14px;overflow:hidden;color:#202124;}
.wrap{padding:56px 40px 40px;max-width:1180px;margin:0 auto;}
.badge{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;
  padding:4px 14px;font-size:13px;color:var(--accent);margin-bottom:10px;}
h1{font-size:26px;margin:6px 0 14px;font-weight:500;}
h2{font-size:20px;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line);font-weight:500;}
h3{font-size:17px;margin:20px 0 8px;font-weight:500;}
p{margin:8px 0;}
blockquote{margin:12px 0;padding:10px 16px;background:#fbfaf6;border-left:3px solid #cfd9c4;color:#55604f;}
blockquote p{margin:4px 0;}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;}
th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top;}
th{background:var(--soft);font-weight:500;}
tr:nth-child(even) td{background:#fcfcf9;}
code{background:#f2f4ee;padding:1px 5px;border-radius:4px;font-size:13px;
  font-family:Consolas,"Courier New",monospace;}
pre{background:#f7f8f4;border:1px solid var(--line);border-radius:6px;padding:12px 14px;overflow:auto;}
pre code{background:none;padding:0;font-size:13px;line-height:1.6;}
hr{border:none;border-top:1px solid var(--line);margin:22px 0;}
ul,ol{padding-left:24px;margin:8px 0;}
li{margin:4px 0;}
strong{color:#243020;}
`;

function page({ title, body, url, tag }) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>${title}</title>
<style>${CSS}</style></head><body>
<div id="__addrbar">
  <span class="dots"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span></span>
  <span class="omni"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="margin-right:7px;flex:none">
    <rect x="4" y="10" width="16" height="11" rx="2.5" fill="#5f6368"/>
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#5f6368" stroke-width="2.2" fill="none"/></svg>${url}</span>
</div>
<div class="wrap">
  <span class="badge">${tag} · Day 21 · 第 3 周验收 · 2026-10-07</span>
  ${body}
</div>
</body></html>`;
}

JOBS.forEach((j) => {
  const raw = fs.readFileSync(path.join(OUT, j.src), 'utf8');
  const body = md.render(raw);
  const html = page({ title: j.tag, body, url: `${BASE}/${j.out}`, tag: j.tag });
  fs.writeFileSync(path.join(OUT, j.out), html, 'utf8');
  console.log('已生成', j.out, '←', j.src, `(${html.length} 字节)`);
});
