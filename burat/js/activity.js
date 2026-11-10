(function () {
  const user = initLayout({ active: 'activity', roles: ['owner'] });
  if (!user) return;

  const state = { q: '', page: 1 };
  const tbody = $('#tbody');
  const pager = $('#pager');
  const search = $('#search');
  const clearBtn = $('#clearSearch');
  const catSel = $('#category');

  const log = DB.log().slice().reverse();
  const cats = Array.from(new Set(log.map(l => l.category))).sort();
  catSel.innerHTML = '<option value="all">All categories</option>' + cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');

  function render() {
    const q = state.q.trim().toLowerCase();
    const list = log.filter(l =>
      (catSel.value === 'all' || l.category === catSel.value) &&
      (!q || [l.name, l.idNo, l.category, l.action, l.detail].some(v => String(v).toLowerCase().includes(q))));
    const pages = Math.max(1, Math.ceil(list.length / 10));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * 10, state.page * 10);
    tbody.innerHTML = slice.length ? slice.map(l =>
      '<tr><td>' + esc(formatDate(l.date)) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.idNo || '—') + '</td><td>' + esc(l.category) + '</td><td>' + esc(l.action) + '</td><td class="detail-cell">' + esc(l.detail) + '</td></tr>').join('')
      : '<tr><td class="empty" colspan="6">No activity found.</td></tr>';
    renderPagination(pager, state.page, pages, n => { state.page = n; render(); });
  }

  search.addEventListener('input', () => { state.q = search.value; state.page = 1; clearBtn.classList.toggle('hidden', !search.value); render(); });
  clearBtn.addEventListener('click', () => { search.value = ''; state.q = ''; state.page = 1; clearBtn.classList.add('hidden'); render(); search.focus(); });
  catSel.addEventListener('change', () => { state.page = 1; render(); });

  render();
})();