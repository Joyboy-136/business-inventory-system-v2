(function () {
  const user = initLayout({ active: 'archived', roles: ['owner'] });
  if (!user) return;

  const state = { q: '', page: 1 };
  const tbody = $('#tbody');
  const pager = $('#pager');
  const search = $('#search');
  const clearBtn = $('#clearSearch');

  function ownerMeta(type, p) {
    return {
      type, rows: [['Product', p.id + ' · ' + p.name]], reason: '', amount: 0,
      requester: { username: user.username, name: user.name, idNo: user.idNo }, approver: { name: user.name }, self: true, via: 'owner'
    };
  }

  function matching() {
    const q = state.q.trim().toLowerCase();
    return DB.archivedProducts()
      .filter(p => !q || [p.id, p.name, p.category, p.barcode].some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  }

  function render() {
    const list = matching();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    if (!slice.length) {
      tbody.innerHTML = '<tr><td class="empty" colspan="7">' + (state.q.trim() ? 'No archived products match “' + esc(state.q.trim()) + '”.' : 'No archived products.') + '</td></tr>';
    } else {
      tbody.innerHTML = slice.map(p =>
        '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.category) + '</td><td>' + peso(p.price) + '</td><td>' + esc(p.stock) + '</td>' +
        '<td>' + esc(formatDate(p.archivedAt)) + '<br><small class="muted">by ' + esc(p.archivedBy || 'unknown') + (p.archiveReason ? ' · ' + esc(p.archiveReason) : '') + '</small></td>' +
        '<td><div class="cell-actions">' +
          '<button type="button" class="icon-btn" data-act="restore" data-id="' + esc(p.id) + '" aria-label="Restore ' + esc(p.name) + '" title="Restore">' + icon('restore', 18) + '</button>' +
          '<button type="button" class="icon-btn danger" data-act="delete" data-id="' + esc(p.id) + '" aria-label="Delete ' + esc(p.name) + ' permanently" title="Delete permanently">' + icon('trash', 18) + '</button>' +
        '</div></td></tr>').join('');
    }
    renderPagination(pager, state.page, pages, n => { state.page = n; render(); });
  }

  search.addEventListener('input', () => { state.q = search.value; state.page = 1; clearBtn.classList.toggle('hidden', !search.value); render(); });
  clearBtn.addEventListener('click', () => { search.value = ''; state.q = ''; state.page = 1; clearBtn.classList.add('hidden'); render(); search.focus(); });

  tbody.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const p = DB.find(btn.dataset.id);
    if (!p || !p.archived) { toast('That product is no longer archived.', 'error'); render(); return; }

    if (btn.dataset.act === 'restore') {
      const problem = productConflict(p, p.id);
      if (problem) { toast('Cannot restore: ' + problem, 'error'); return; }
      const ok = await confirmDialog({ title: 'Restore product?', message: '“' + p.name + '” will go back to the inventory list and the POS.', confirmText: 'Restore' });
      if (!ok) return;
      const products = DB.products();
      const t = products.find(x => x.id === p.id);
      t.archived = false;
      t.archivedAt = '';
      t.archivedBy = '';
      t.archiveReason = '';
      if (!DB.saveProducts(products)) return;
      logAction('Archive', 'Restored product', p.id + ' · ' + p.name, user, ownerMeta('product.restore', p));
      toast('“' + p.name + '” was restored.');
      render();
    } else {
      const ok = await confirmDialog({
        title: 'Delete permanently?',
        message: '“' + p.name + '” will be removed for good. Past sales that include it will stay in the records. This cannot be undone.',
        confirmText: 'Delete permanently', danger: true
      });
      if (!ok) return;
      if (!DB.saveProducts(DB.products().filter(x => x.id !== p.id))) return;
      logAction('Archive', 'Permanently deleted product', p.id + ' · ' + p.name, user, ownerMeta('product.delete', p));
      toast('“' + p.name + '” was deleted permanently.');
      render();
    }
  });

  render();
})();