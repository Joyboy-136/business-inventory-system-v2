(function () {
  const user = initLayout({ active: 'history' });
  if (!user) return;
  const isOwner = user.role === 'owner';

  const state = { q: '', page: 1 };
  const tbody = $('#tbody');
  const pager = $('#pager');
  const search = $('#search');
  const clearBtn = $('#clearSearch');
  const fromDate = $('#fromDate');
  const toDate = $('#toDate');

  if (isOwner) $('#dateFilter').classList.remove('hidden');
  else $('#staffNote').classList.remove('hidden');

  function pendingVoid(saleId) {
    return DB.requests().some(r => r.status === 'pending' && r.type === 'sale.void' && r.payload.saleId === saleId);
  }

  function matching() {
    let list = groupSales(DB.transactions());
    if (!isOwner) list = list.filter(s => isToday(s.date));
    else {
      if (fromDate.value) { const from = fromInputDate(fromDate.value); list = list.filter(s => new Date(s.date) >= from); }
      if (toDate.value) { const to = addDays(fromInputDate(toDate.value), 1); list = list.filter(s => new Date(s.date) < to); }
    }
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(s => s.saleNo.toLowerCase().includes(q) || String(s.userName).toLowerCase().includes(q) || s.items.some(i => i.name.toLowerCase().includes(q)));
    return list;
  }

  function render() {
    const list = matching();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    if (!slice.length) {
      tbody.innerHTML = '<tr><td class="empty" colspan="7">' + (isOwner ? 'No sales found.' : 'No sales yet today.') + '</td></tr>';
    } else {
      tbody.innerHTML = slice.map(s => {
        const items = s.items.map(i => i.name + ' ×' + i.qty).join(', ');
        const status = s.voided ? '<span class="badge badge-void">Voided</span>' : (pendingVoid(s.saleId) ? '<span class="badge badge-pending">Void pending</span>' : '<span class="badge badge-sale">Completed</span>');
        const canVoid = !s.voided && !pendingVoid(s.saleId);
        return '<tr><td>' + esc(s.saleNo) + '</td><td>' + esc(formatDate(s.date)) + '</td><td>' + esc(s.userName) + '</td>' +
          '<td class="items-cell" title="' + esc(items) + '">' + esc(items) + '</td><td>' + peso(s.total) + '</td><td>' + status + '</td>' +
          '<td><div class="cell-actions">' +
            '<button type="button" class="icon-btn" data-act="view" data-id="' + esc(s.saleId) + '" aria-label="View receipt ' + esc(s.saleNo) + '" title="View receipt">' + icon('eye', 18) + '</button>' +
            (canVoid ? '<button type="button" class="icon-btn danger" data-act="void" data-id="' + esc(s.saleId) + '" aria-label="Void sale ' + esc(s.saleNo) + '" title="Void sale">' + icon('ban', 18) + '</button>' : '') +
          '</div></td></tr>';
      }).join('');
    }
    renderPagination(pager, state.page, pages, n => { state.page = n; render(); });
  }

  search.addEventListener('input', () => { state.q = search.value; state.page = 1; clearBtn.classList.toggle('hidden', !search.value); render(); });
  clearBtn.addEventListener('click', () => { search.value = ''; state.q = ''; state.page = 1; clearBtn.classList.add('hidden'); render(); search.focus(); });
  [fromDate, toDate].forEach(el => el.addEventListener('change', () => { state.page = 1; render(); }));

  tbody.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const sale = groupSales(DB.transactions()).find(s => s.saleId === btn.dataset.id);
    if (!sale) { toast('That sale no longer exists.', 'error'); render(); return; }

    if (btn.dataset.act === 'view') {
      const body = document.createElement('div');
      body.className = 'receipt-wrap';
      body.innerHTML = receiptHtml(sale) + (sale.voided ? '<p class="hint">Voided by ' + esc(sale.voidedBy) + ' · ' + esc(sale.voidReason || '') + '</p>' : '');
      openModal({
        title: 'Receipt ' + sale.saleNo, body,
        actions: [{ label: 'Print', onClick: () => printHtml(receiptHtml(sale)) }, { label: 'Close', className: 'btn-primary', primary: true }]
      });
    } else {
      await submitChange('sale.void', { saleId: sale.saleId, saleNo: sale.saleNo, total: sale.total }, {
        title: 'Void sale ' + sale.saleNo, submitText: 'Void sale', danger: true,
        introHtml: '<p class="modal-text">Voiding <strong>' + esc(sale.saleNo) + '</strong> (' + esc(peso(sale.total)) + ') returns all of its items to stock and removes it from sales totals.</p>',
        fields: [{ id: 'reason', label: 'Reason', type: 'textarea', placeholder: 'e.g. Customer returned the items' }],
        validate: v => (v.reason.trim() ? null : 'Please give a reason.')
      });
      render();
      buildSidebar('history', user);
    }
  });

  render();
})();