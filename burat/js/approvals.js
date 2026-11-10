(function () {
  const user = initLayout({ active: 'approvals' });
  if (!user) return;
  const isOwner = user.role === 'owner';

  if (!isOwner) $('#pageTitle').textContent = 'My Requests';
  document.title = (isOwner ? 'Approvals' : 'My Requests') + ' · Sales & Inventory';

  const listEl = $('#list');
  const state = { tab: 'pending', page: 1 };

  function mine() {
    const all = DB.requests().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return isOwner ? all : all.filter(r => r.requestedBy.username === user.username);
  }

  function card(r) {
    const buttons = isOwner
      ? '<button type="button" class="btn btn-outline btn-sm" data-act="reject" data-id="' + esc(r.id) + '">Reject</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="approve" data-id="' + esc(r.id) + '">Approve</button>'
      : '<button type="button" class="btn btn-outline btn-sm" data-act="cancel" data-id="' + esc(r.id) + '">Cancel request</button>';
    return '<article class="req">' +
      '<header><div><strong>' + esc(r.summary) + '</strong><small>' + esc(r.id) + ' · ' + esc(Changes[r.type] ? Changes[r.type].label : r.type) + ' · ' + esc(formatDate(r.createdAt)) + '</small></div>' +
      requestBadge(r.status) + '</header>' +
      '<p class="req-by">Requested by <strong>' + esc(r.requestedBy.name) + '</strong> (ID ' + esc(r.requestedBy.idNo) + ')</p>' +
      detailsTable(r.rows) +
      '<footer>' + buttons + '</footer></article>';
  }

  function render() {
    const all = mine();
    const pending = all.filter(r => r.status === 'pending');
    $('#pendingCount').textContent = pending.length;
    $$('.tab').forEach(t => { const on = t.dataset.tab === state.tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });

    if (state.tab === 'pending') {
      listEl.innerHTML = pending.length
        ? '<div class="req-list">' + pending.map(card).join('') + '</div>'
        : '<div class="empty-state">' + (isOwner ? 'Nothing is waiting for approval.' : 'You have no pending requests.') + '</div>';
      return;
    }

    const history = all.filter(r => r.status !== 'pending');
    const pages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const slice = history.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    listEl.innerHTML =
      '<div class="table-card"><div class="table-wrap"><table><thead><tr><th>Request</th><th>Requested by</th><th>Date</th><th>Status</th><th>Decided by</th><th>Note</th></tr></thead><tbody>' +
      (slice.length ? slice.map(r =>
        '<tr><td><strong>' + esc(r.summary) + '</strong><br><small class="muted">' + esc(r.id) + '</small></td>' +
        '<td>' + esc(r.requestedBy.name) + '<br><small class="muted">ID ' + esc(r.requestedBy.idNo) + '</small></td>' +
        '<td>' + esc(formatDate(r.createdAt)) + '</td><td>' + requestBadge(r.status) + '</td>' +
        '<td>' + esc(r.decidedBy || '—') + (r.via === 'counter' ? '<br><small class="muted">at the counter</small>' : '') + '</td>' +
        '<td>' + esc(r.note || '—') + '</td></tr>').join('') : '<tr><td class="empty" colspan="6">No past requests yet.</td></tr>') +
      '</tbody></table></div></div><div class="pager" id="histPager"></div>';
    renderPagination($('#histPager'), state.page, pages, n => { state.page = n; render(); });
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => { state.tab = t.dataset.tab; state.page = 1; render(); }));

  listEl.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    let r;
    if (act === 'approve') {
      r = Requests.decide(id, 'approved', user, '');
    } else if (act === 'reject') {
      const v = await formDialog({
        title: 'Reject request', submitText: 'Reject', danger: true,
        fields: [{ id: 'note', label: 'Reason (optional)', type: 'textarea', placeholder: 'Tell the staff why' }]
      });
      if (!v) return;
      r = Requests.decide(id, 'rejected', user, v.note.trim());
    } else {
      const ok = await confirmDialog({ title: 'Cancel this request?', message: 'The owner will no longer see it.', confirmText: 'Cancel request', danger: true });
      if (!ok) return;
      r = Requests.cancel(id, user);
    }
    toast(r.ok ? r.message : r.error, r.ok ? 'success' : 'error');
    buildSidebar('approvals', user);
    render();
  });

  render();
})();