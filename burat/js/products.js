(function () {
  const user = initLayout({ active: 'products' });
  if (!user) return;
  const isOwner = user.role === 'owner';

  const state = { q: '', page: 1 };
  const tbody = $('#tbody');
  const pager = $('#pager');
  const search = $('#search');
  const clearBtn = $('#clearSearch');

  if (isOwner) {
    $$('.owner-col').forEach(el => el.classList.remove('hidden'));
    $('#archivedLink').classList.remove('hidden');
  } else {
    $('#staffNote').classList.remove('hidden');
  }
  const colCount = isOwner ? 9 : 8;

  function matching() {
    const q = state.q.trim().toLowerCase();
    return DB.activeProducts().filter(p => !q || [p.id, p.name, p.category, p.barcode].some(v => String(v || '').toLowerCase().includes(q)));
  }

  function render() {
    if (isOwner) $('#archivedLabel').textContent = 'Archived (' + DB.archivedProducts().length + ')';
    const list = matching();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    if (!slice.length) {
      tbody.innerHTML = '<tr><td class="empty" colspan="' + colCount + '">' +
        (state.q.trim() ? 'No products match “' + esc(state.q.trim()) + '”.' : 'No products yet.') + '</td></tr>';
    } else {
      tbody.innerHTML = slice.map(p => {
        const pend = DB.pendingFor(p.id).length ? ' <span class="badge badge-pending">Change pending</span>' : '';
        const btn = (act, ic, label, cls) =>
          '<button type="button" class="icon-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-id="' + esc(p.id) + '" aria-label="' + label + ' ' + esc(p.name) + '" title="' + label + '">' + icon(ic, 18) + '</button>';
        return '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.name) + pend + '</td><td>' + esc(p.category) + '</td><td>' + esc(p.barcode || '—') + '</td><td>' + peso(p.price) + '</td>' +
          (isOwner ? '<td>' + peso(p.cost || 0) + '</td>' : '') +
          '<td>' + esc(p.stock) + '</td><td>' + statusBadge(p) + '</td>' +
          '<td><div class="cell-actions">' + btn('restock', 'restock', 'Restock') + btn('adjust', 'sliders', 'Stock correction') + btn('edit', 'pencil', 'Edit') + btn('archive', 'archive', 'Archive', 'danger') + '</div></td></tr>';
      }).join('');
    }
    renderPagination(pager, state.page, pages, n => { state.page = n; render(); });
  }

  search.addEventListener('input', () => {
    state.q = search.value;
    state.page = 1;
    clearBtn.classList.toggle('hidden', !search.value);
    render();
  });
  clearBtn.addEventListener('click', () => {
    search.value = ''; state.q = ''; state.page = 1;
    clearBtn.classList.add('hidden');
    render();
    search.focus();
  });

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const product = DB.find(btn.dataset.id);
    if (!product || product.archived) { toast('That product is no longer available.', 'error'); render(); return; }
    if (btn.dataset.act === 'edit') location.href = 'add-product.html?id=' + encodeURIComponent(product.id);
    else if (btn.dataset.act === 'archive') archive(product);
    else if (btn.dataset.act === 'restock') restock(product);
    else if (btn.dataset.act === 'adjust') adjust(product);
  });

  function currentStock(p) {
    return '<p class="modal-text">Current stock of <strong>' + esc(p.name) + '</strong>: <strong>' + esc(p.stock) + '</strong></p>';
  }

  async function restock(p) {
    await submitChange('product.restock', { id: p.id }, {
      title: 'Restock product', submitText: 'Add stock',
      introHtml: currentStock(p),
      fields: [
        { id: 'qty', label: 'Quantity received', type: 'number', min: 1, step: 1, placeholder: 'e.g. 20' },
        { id: 'cost', label: 'Total cost (₱)', type: 'number', min: 0, step: '0.01', placeholder: 'e.g. 600' }
      ],
      validate: v => {
        const qty = Number(v.qty), cost = Number(v.cost);
        if (!v.qty.trim() || !Number.isInteger(qty) || qty < 1) return 'Enter a whole number of 1 or more for the quantity.';
        if (!v.cost.trim() || !isFinite(cost) || cost < 0) return 'Enter the total cost (0 or more).';
        return null;
      }
    });
    render();
    buildSidebar('products', user);
  }

  async function adjust(p) {
    await submitChange('product.adjust', { id: p.id, beforeStock: p.stock }, {
      title: 'Stock correction', submitText: 'Save correction',
      introHtml: currentStock(p) + '<p class="hint">Use this when the count on the shelf is different from the system (damaged, lost, miscounted).</p>',
      fields: [
        { id: 'newStock', label: 'Correct stock count', type: 'number', min: 0, step: 1, placeholder: 'e.g. 12' },
        { id: 'reason', label: 'Reason', type: 'textarea', placeholder: 'e.g. 2 packs damaged' }
      ],
      validate: v => {
        const n = Number(v.newStock);
        if (!v.newStock.trim() || !Number.isInteger(n) || n < 0) return 'Enter a whole number, 0 or more.';
        if (n === Number(p.stock)) return 'That is the same as the current stock.';
        if (!v.reason.trim()) return 'Please give a reason.';
        return null;
      }
    });
    render();
    buildSidebar('products', user);
  }

  async function archive(p) {
    await submitChange('product.archive', { id: p.id }, {
      title: 'Archive product', submitText: 'Archive',
      introHtml: '<p class="modal-text">Archive <strong>' + esc(p.name) + '</strong>? It will be hidden from the inventory list and the POS. Nothing is deleted, and the owner can restore it later.</p>',
      fields: [{ id: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'e.g. No longer sold' }]
    });
    render();
    buildSidebar('products', user);
  }

  render();
})();