(function () {
  const user = initLayout({ active: 'dashboard' });
  if (!user) return;
  const isOwner = user.role === 'owner';

  const products = DB.activeProducts();
  const allTx = DB.transactions().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const visibleTx = isOwner ? allTx : allTx.filter(t => t.type === 'Sale' && isToday(t.date));

  const lowCount = products.filter(p => DB.status(p) !== 'in').length;
  const units = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const salesToday = round2(allTx.filter(t => t.type === 'Sale' && !t.voided && isToday(t.date)).reduce((s, t) => s + t.total, 0));

  $('#stats').innerHTML =
    '<div class="stat"><span class="stat-icon">' + icon('box', 22) + '</span><div><div class="stat-label">Total Products</div><div class="stat-value">' + products.length + '</div></div></div>' +
    '<a class="stat" href="inventory.html?status=low" title="See low stock items"><span class="stat-icon">' + icon('alert', 22) + '</span><div><div class="stat-label">Low Stock</div><div class="stat-value">' + lowCount + '</div></div></a>' +
    '<div class="stat"><span class="stat-icon">₱</span><div><div class="stat-label">Sales Today</div><div class="stat-value">' + pesoShort(salesToday) + '</div></div></div>' +
    '<div class="stat"><span class="stat-icon">' + icon('db', 22) + '</span><div><div class="stat-label">Units in Stock</div><div class="stat-value">' + units + '</div></div></div>';

  const pending = DB.pendingCount(isOwner ? null : user.username);
  const banner = $('#pendingBanner');
  if (pending) {
    banner.classList.remove('hidden');
    banner.innerHTML = isOwner
      ? '<strong>' + pending + '</strong> change request' + (pending === 1 ? '' : 's') + ' waiting for your approval. <a href="approvals.html">Review now</a>'
      : 'You have <strong>' + pending + '</strong> request' + (pending === 1 ? '' : 's') + ' waiting for the owner. <a href="approvals.html">View</a>';
  }

  if (!isOwner) $('#recentTitle').textContent = 'Today’s Sales';

  function rows(list) {
    if (!list.length) return '<tr><td class="empty" colspan="5">No transactions yet.</td></tr>';
    return list.map(t =>
      '<tr><td>' + esc(formatDate(t.date)) + '</td><td>' + esc(t.product) + '</td><td>' + esc(t.qty) + '</td><td>' +
      peso(t.total) + '</td><td>' + txBadge(t) + '</td></tr>').join('');
  }

  $('#txBody').innerHTML = rows(visibleTx.slice(0, 5));

  $('#viewAll').addEventListener('click', function () {
    const body =
      '<div class="table-card"><div class="table-wrap" style="max-height:60vh;overflow-y:auto"><table><thead><tr>' +
      '<th>Date</th><th>Product</th><th>Quantity</th><th>Total</th><th>Type</th></tr></thead><tbody>' +
      rows(visibleTx) + '</tbody></table></div></div>';
    openModal({
      title: (isOwner ? 'All Transactions' : 'Today’s Sales') + ' (' + visibleTx.length + ')',
      body, wide: true,
      actions: [{ label: 'Close', className: 'btn-primary', primary: true }]
    });
  });
})();