(function () {
  var now = new Date().toISOString();
  var books = [{ id: 'b_demo', title: '测试书', user_id: 'local', created_at: now }];
  localStorage.setItem('zhishu_books', JSON.stringify(books));
  var dup = '今天又读了一遍，和昨天的感受几乎一样，像是手误重复记了。';
  var notes = [
    { id: 'n_a', book_id: 'b_demo', content: dup, mood: ['平静'], user_id: 'local', created_at: now },
    { id: 'n_b', book_id: 'b_demo', content: dup, mood: ['平静'], user_id: 'local', created_at: now }
  ];
  localStorage.setItem('zhishu_notes', JSON.stringify(notes));
  return 'seeded books=' + books.length + ' notes=' + notes.length;
})();
