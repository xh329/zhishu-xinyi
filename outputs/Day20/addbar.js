(function () {
  var old = document.getElementById('__addrbar');
  if (old) old.remove();   // 已有就重画：hash 路由切视图后地址栏文字才不会过期
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
  document.body.style.paddingTop = '44px';
  var s = document.createElement('style');
  s.textContent = '.music-btn{top:56px!important} .music-hint{display:none!important}';
  document.head.appendChild(s);
  return 'bar:' + location.href;
})();
