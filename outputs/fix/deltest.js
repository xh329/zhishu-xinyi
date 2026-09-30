(function () {
  var cards = document.querySelectorAll('.note-card');
  var before = cards.length;
  var lsBefore = JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length;
  // 点第一张卡的「删除」
  var delBtn = document.querySelector('.note-card [data-action="delete-note"]');
  if (!delBtn) return JSON.stringify({ error: 'no delete button', before: before, lsBefore: lsBefore });
  delBtn.click();
  // 就地出现确认行，点「删除」确认
  var confirmBtn = document.querySelector('.note-card [data-action="confirm-delete"]');
  if (!confirmBtn) return JSON.stringify({ error: 'no confirm button', before: before, lsBefore: lsBefore });
  confirmBtn.click();
  // 重渲染后
  var afterCards = document.querySelectorAll('.note-card').length;
  var lsAfter = JSON.parse(localStorage.getItem('zhishu_notes') || '[]').length;
  var remaining = JSON.parse(localStorage.getItem('zhishu_notes') || '[]').map(function (n) { return n.content; });
  return JSON.stringify({ beforeCards: before, lsBefore: lsBefore, afterCards: afterCards, lsAfter: lsAfter, remainingContents: remaining });
})();
