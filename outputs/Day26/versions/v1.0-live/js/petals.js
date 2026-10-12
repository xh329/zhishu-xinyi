/* 花瓣飘落动景（淡粉色小花瓣）
 * 纯前端、零依赖：在 #petals 容器内动态生成柔和淡粉花瓣 SVG，
 * 随机化位置/大小/飘落与摇曳节奏，营造放松、轻盈的诗意氛围。
 * 尊重系统"减少动态效果"偏好（prefers-reduced-motion: reduce）时完全不渲染。
 */

(function () {
  'use strict';

  // 系统要求减少动态效果时，不放花瓣，保持安静
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var uid = 0;

  // 三套淡粉渐变：上浅下略深，低饱和、柔和不刺眼，让人放松
  var PALETTES = [
    { top: '#fdeef4', bottom: '#f7cad9' },
    { top: '#fbe9f0', bottom: '#f3bdd1' },
    { top: '#fff1f4', bottom: '#f9d6e0' }
  ];

  // 圆润花瓣：顶部带小缺口（樱花瓣般的柔美），无中脉，不再像叶或虫
  var PETAL_PATH = 'M25 60 C10 56 5 38 12 22 C16 13 21 9 24 15 ' +
                   'C25 11 25 11 26 15 C29 9 34 13 38 22 ' +
                   'C45 38 40 56 25 60 Z';

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function petalSVG() {
    var p = pick(PALETTES);
    var id = 'pg' + (++uid);
    return '<svg viewBox="0 0 50 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + p.top + '"/>' +
        '<stop offset="1" stop-color="' + p.bottom + '"/>' +
      '</linearGradient></defs>' +
      '<path d="' + PETAL_PATH + '" fill="url(#' + id + ')" opacity="0.92"/>' +
      '<ellipse cx="25" cy="44" rx="6.5" ry="13" fill="#ffffff" opacity="0.18"/>' +
    '</svg>';
  }

  function makePetal() {
    var wrap = document.createElement('div');
    wrap.className = 'petal';

    var size = rand(7, 14);            // 细碎小花瓣
    var left = rand(0, 100);          // 起始水平位置（百分比）
    var fallDur = rand(10, 17);       // 飘落节奏（细碎雨感）
    var fallDelay = -rand(0, fallDur); // 负延迟：加载时即散布在不同高度
    var swayDur = rand(4, 7);         // 左右摇曳周期（偏慢）
    var sway = rand(14, 34);          // 摇曳幅度（细碎花瓣收窄）
    var spin = rand(160, 320);        // 温和翻转，不过度旋转

    wrap.style.left = left + '%';
    wrap.style.width = size + 'px';
    wrap.style.height = (size * 1.28) + 'px';  // 与 SVG 比例一致，不变形
    wrap.style.setProperty('--fall-dur', fallDur + 's');
    wrap.style.animationDelay = fallDelay + 's';

    var inner = document.createElement('div');
    inner.className = 'petal-inner';
    inner.style.setProperty('--sway-dur', swayDur + 's');
    inner.style.setProperty('--sway', sway + 'px');
    inner.style.setProperty('--spin', spin + 'deg');
    inner.innerHTML = petalSVG();

    wrap.appendChild(inner);
    return wrap;
  }

  function init() {
    var container = document.getElementById('petals');
    if (!container) {
      container = document.createElement('div');
      container.className = 'petals';
      container.id = 'petals';
      container.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(container, document.body.firstChild);
    }

    // 花瓣数量随屏幕宽度变化，偏密以呈现"细碎花瓣雨"
    var count = Math.max(16, Math.min(40, Math.round(window.innerWidth / 38)));
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      frag.appendChild(makePetal());
    }
    container.appendChild(frag);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
