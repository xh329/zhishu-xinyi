(function () {
  var h = document.querySelector('.music-hint');
  if (h) { h.classList.remove('fade'); h.style.opacity = '1'; }
  var list = [];
  ['.music-btn', '.music-hint', '.topbar', '.topbar-brand', '.mainnav'].forEach(function (s) {
    var n = document.querySelector(s); if (n) list.push({ s: s, el: n });
  });
  document.querySelectorAll('.mainnav a').forEach(function (n, i) {
    list.push({ s: '.mainnav a[' + i + ']', el: n });
  });
  ['.whisper', '.foot', '.hero'].forEach(function (s) {
    var n = document.querySelector(s); if (n) list.push({ s: s, el: n });
  });
  function rect(e) { var r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: Math.round(r.width), h: Math.round(r.height) }; }
  function overlap(a, b) { return !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t); }
  var musicSel = { '.music-btn': 1, '.music-hint': 1 };
  var out = [];
  for (var i = 0; i < list.length; i++) {
    for (var j = i + 1; j < list.length; j++) {
      var ri = rect(list[i].el), rj = rect(list[j].el);
      if (overlap(ri, rj) && (musicSel[list[i].s] || musicSel[list[j].s])) {
        out.push({
          a: list[i].s, b: list[j].s,
          ra: ri, rb: rj,
          textA: (list[i].el.textContent || '').trim().slice(0, 24),
          textB: (list[j].el.textContent || '').trim().slice(0, 24)
        });
      }
    }
  }
  return JSON.stringify({ vw: window.innerWidth, vh: window.innerHeight, hintExists: !!h, overlaps: out });
})();
