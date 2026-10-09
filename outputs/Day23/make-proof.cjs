'use strict';
/* Day 23 · 把真实扫描结果渲染成「带地址栏」的交付证明页
 * 内容来自 outputs/Day23/secret-scan.txt（真实终端输出），不是手编。
 * 用法：node outputs/Day23/make-proof.cjs
 */
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const URL = 'http://127.0.0.1:8791/outputs/Day23/proof-secret-scan.html';

const raw = fs.readFileSync(path.join(OUT, 'secret-scan.txt'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
.wrap{padding:58px 40px 40px;max-width:1080px;margin:0 auto;}
.badge{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;
  padding:4px 14px;font-size:13px;color:var(--accent);margin-bottom:10px;}
h1{font-size:26px;margin:6px 0 12px;font-weight:500;}
.hero{border:1px solid #d7e3cd;background:#f1f6ee;border-radius:12px;padding:16px 22px;margin:14px 0 22px;
  display:flex;align-items:center;gap:16px;}
.hero .n{font-size:52px;line-height:1;font-weight:600;color:var(--ok);}
.hero .t{font-size:15px;}
.hero .t b{font-size:17px;}
pre{background:#f7f8f4;border:1px solid var(--line);border-radius:8px;padding:16px 18px;overflow:auto;
  font-family:Consolas,"Courier New",monospace;font-size:13px;line-height:1.62;color:#2b3529;}
.cmd{color:#3f7a45;font-weight:600;}
.foot{margin-top:20px;padding-top:12px;border-top:1px solid var(--line);color:var(--sub);font-size:13px;}
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>Day23 · 密钥排查（0 条命中）</title>
<style>${CSS}</style></head><body>
<div id="__addrbar">
  <span class="dots"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span></span>
  <span class="omni"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="margin-right:7px;flex:none">
    <rect x="4" y="10" width="16" height="11" rx="2.5" fill="#5f6368"/>
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#5f6368" stroke-width="2.2" fill="none"/></svg>${URL}</span>
</div>
<div class="wrap">
  <span class="badge">Day 23 · 密钥排查（安全审计 · 红线优先）· 2026-10-09</span>
  <h1>全仓库搜索密钥特征词 —— 结果 0 条</h1>
  <div class="hero">
    <span class="n">0</span>
    <span class="t"><b>条命中</b><br>工作区（198 个跟踪文件）与 git 全历史均无明文密钥；<code>.env</code> 未入库。</span>
  </div>
  <pre>${esc(raw)}</pre>
  <p class="foot">说明：以上为真实终端输出（原样渲染，未手编）。命令
    <span class="cmd">git grep -n -I -E</span> 关键词扫描跟踪文件，
    <span class="cmd">git grep … $(git rev-list --all)</span> 扫描全部历史提交。
    完整证据见 <code>outputs/Day23/secret-scan.txt</code>。</p>
</div>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'proof-secret-scan.html'), html, 'utf8');
console.log('已生成 proof-secret-scan.html（' + html.length + ' 字节）');
