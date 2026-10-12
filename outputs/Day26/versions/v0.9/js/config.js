/* 栀书心驿 · 前端运行配置（Day 20 · 接公网接口）
 *
 * 前端唯一要请求的接口基地址（API_BASE_URL）。这是公开地址（不是密钥），可安全入库。
 * 真实值来自 Day 18 已验证可用的 CloudBase 公网接口：
 *   https://zhishu-xinyi.apigw.tencentcs.com/release
 * 该地址对应三个 HTTP 触发：/api/health、/api/books、/api/notes。
 *
 * 真正的密钥（数据库账号密码）只在云函数侧，走 CloudBase 环境变量（见各云函数目录下的 db.js），
 * 本文件不写任何密钥（符合 AGENTS.md [D6-5] 隐私红线）。
 *
 * 本地联调：地址栏加 ?api=http://localhost:8787 即可临时指向本地 mock 服务，
 * 不必改动本文件；部署时保持下面这行已是真实公网地址即可。
 * （若你的 CloudBase 环境被重置，把下面这行改回自己的 apigw 地址即可。）
 */
window.ZhiShuConfig = window.ZhiShuConfig || {};

(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var fromQuery = params.get('api'); // 本地联调覆盖：index.html?api=http://localhost:8787
  // 真实公网接口地址（Day 18 验证可用）
  window.ZhiShuConfig.API_BASE_URL =
    fromQuery || 'https://zhishu-xinyi.apigw.tencentcs.com/release';
})();
