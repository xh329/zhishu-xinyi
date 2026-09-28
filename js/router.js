/* 栀书心驿 · 极简 hash 路由（Day 13）
 *
 * 今日问题：页面之间怎么切换，选哪种方式？为什么？
 *   答：选 **hash 路由（#/xxx）在同一份文档里切换视图**。
 *   理由（三条，都是从本项目处境推出来的）：
 *     1. 本项目是纯静态站，托管在 GitHub Pages——服务器只认识真实文件。
 *        若用 History API 造出 /books 这种「漂亮路径」，刷新或直接粘贴链接都会 404，
 *        除非额外配置服务端 rewrite，而静态托管不能改服务器配置。
 *     2. hash 后面的内容不会发给服务器，所以「刷新」「深链」「浏览器前进/后退」三种情况
 *        全都自然可用，零配置、零后端依赖。
 *     3. 今日目标是"够用就好"：三个视图 + 一个带参数的详情页，原生 JS 六十多行就够，
 *        引入 Vue Router / React Router 的学习成本远大于收益。
 *
 * 不做（今日边界）：嵌套路由、路由守卫、懒加载、路由过渡动画之外的进阶用法。
 *
 * 对外 API：
 *   Z.router.add(path, handler, meta)  注册路由，支持 '/books/:id' 形式的参数
 *   Z.router.fallback(handler)         注册未知路由处理器（温柔承接，不白屏）
 *   Z.router.start()                   首次渲染 + 监听 hashchange
 *   Z.router.go(path)                  跳转（留下历史，可后退）
 *   Z.router.replace(path)             跳转（不留下历史）
 *   Z.router.back()                    返回上一页
 *   Z.router.crumbs(items)             更新面包屑
 */
window.ZhiShu = window.ZhiShu || {};

(function (Z) {
  'use strict';

  var table = [];            // 路由表：[{ re, keys, handler, meta }]
  var fallbackHandler = null;
  var dom = {};              // 导航壳层的 DOM 引用
  var started = false;

  function $(sel) { return document.querySelector(sel); }

  // 把 '/books/:id' 编译成正则，同时记下参数名
  function compile(path) {
    var keys = [];
    var source = path.replace(/\/?:([A-Za-z0-9_]+)/g, function (all, key) {
      keys.push(key);
      return '/([^/]+)';
    });
    return { keys: keys, re: new RegExp('^' + source + '$') };
  }

  // 取当前路径：空 hash 视作 '/home'
  function currentPath() {
    var raw = String(location.hash || '').replace(/^#/, '');
    if (!raw || raw === '/') return '/home';
    return raw.charAt(0) === '/' ? raw : '/' + raw;
  }

  // 把所有视图区块隐藏，只显示传入的那一个
  function showView(name) {
    var views = document.querySelectorAll('.view');
    Array.prototype.forEach.call(views, function (v) { v.hidden = true; });
    if (name) {
      var target = document.getElementById('view-' + name);
      if (target) target.hidden = false;
    }
  }

  // 高亮当前所在的导航标签（子路由也算在父级导航下，如 #/books/x 高亮「书架」）
  function highlightNav(path) {
    if (!dom.nav) return;
    var links = dom.nav.querySelectorAll('a[data-route]');
    var best = '';
    Array.prototype.forEach.call(links, function (a) {
      a.removeAttribute('aria-current');
      var base = a.getAttribute('data-route');
      if ((path === base || path.indexOf(base + '/') === 0) && base.length > best.length) {
        best = base;
      }
    });
    Array.prototype.forEach.call(links, function (a) {
      if (a.getAttribute('data-route') === best) a.setAttribute('aria-current', 'page');
    });
  }

  function clearBox(el) {
    if (el) el.textContent = '';
  }

  var router = {
    add: function (path, handler, meta) {
      var c = compile(path);
      c.handler = handler;
      c.meta = meta || {};
      c.path = path;
      table.push(c);
      return this;
    },

    fallback: function (handler) {
      fallbackHandler = handler;
      return this;
    },

    // 更新面包屑：items = [{ text, href }]，最后一项不带 href 即为"当前所在"
    crumbs: function (items) {
      if (!dom.crumbs) return;
      clearBox(dom.crumbs);
      (items || []).forEach(function (item, idx) {
        var last = idx === items.length - 1;
        if (item.href && !last) {
          var a = document.createElement('a');
          a.href = item.href;
          a.textContent = item.text;
          dom.crumbs.appendChild(a);
          dom.crumbs.appendChild(document.createTextNode(' › '));
        } else {
          var span = document.createElement('span');
          span.textContent = item.text;
          if (last) span.setAttribute('aria-current', 'page');
          dom.crumbs.appendChild(span);
          if (!last) dom.crumbs.appendChild(document.createTextNode(' › '));
        }
      });
    },

    go: function (path) {
      var next = path.charAt(0) === '#' ? path : '#' + path;
      if (location.hash === next) {
        render(); // 同一个地址再点一次，也重新渲染一次（重试时有用）
      } else {
        location.hash = next;
      }
    },

    // 用 replace 换掉地址，不留历史（用于修正写错的路径，避免用户陷入"后退死循环"）
    replace: function (path) {
      var next = String(path).charAt(0) === '#' ? path : '#' + path;
      if (location.hash === next) return;
      location.replace(location.pathname + location.search + next);
    },

    back: function () {
      if (history.length > 1) history.back();
      else this.go('/home');
    },

    path: currentPath,

    start: function () {
      if (started) return this;
      started = true;

      dom.nav = $('#main-nav');
      dom.crumbs = $('#crumbs');
      dom.back = $('#back-btn');
      dom.warn = $('#route-warn');
      dom.live = $('#route-live');

      if (!location.hash) this.replace('/home'); // 首次进入就写下 #/home，便于分享与刷新

      if (dom.back) {
        dom.back.addEventListener('click', function () { router.back(); });
      }

      window.addEventListener('hashchange', render);
      render();
      return this;
    },
  };

  function render() {
    var path = currentPath();
    var ctx = { path: path, params: {} };
    var entry = null;

    for (var i = 0; i < table.length; i++) {
      var m = table[i].re.exec(path);
      if (m) {
        entry = table[i];
        entry.keys.forEach(function (k, idx) {
          ctx.params[k] = decodeURIComponent(m[idx + 1]);
        });
        break;
      }
    }

    highlightNav(path);
    if (dom.warn) dom.warn.hidden = true;

    var handler = entry ? entry.handler : fallbackHandler;
    if (!handler) return;

    showView(entry ? entry.meta.view : 'home');

    // 余力加练（无障碍）：视图换了，用一段隐藏的实时播报告诉读屏用户"现在在哪儿"。
    // 为什么不用"把焦点移到标题"：那样会在标题上留下一圈焦点框，视觉上反而像出了毛病；
    // 播报区域既传达了位置变化，也不打扰眼睛。
    if (dom.live) {
      var title = entry && entry.meta.title ? entry.meta.title : '今日';
      dom.live.textContent = '已切换到' + title;
    }

    handler(ctx);
  }

  Z.router = router;
})(window.ZhiShu);
