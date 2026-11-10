(function () {
  const user = initLayout({ active: 'sales' });
  if (!user) return;

  let cart = [];
  let category = 'All';
  let query = '';

  const scan = $('#scan');
  const clearScan = $('#clearScan');
  const tilesEl = $('#tiles');
  const chipsEl = $('#chips');
  const cartEl = $('#cart');
  const totalEl = $('#saleTotal');
  const paid = $('#paid');
  const payQuick = $('#payQuick');
  const changeBox = $('#changeBox');
  const changeLabel = $('#changeLabel');
  const changeValue = $('#changeValue');
  const errEl = $('#saleErr');
  const completeBtn = $('#completeBtn');

  function lines() {
    const products = DB.products();
    return cart.map(l => ({ line: l, product: products.find(p => p.id === l.id && !p.archived) })).filter(x => x.product);
  }
  function totalOf(list) { return round2(list.reduce((s, x) => s + x.product.price * x.line.qty, 0)); }
  function thumb(p) { return p.image ? '<img src="' + esc(p.image) + '" alt="">' : icon('box', 22, 1.75); }
  function showError(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
  function hideError() { errEl.classList.add('hidden'); }

  function matches() {
    const q = query.trim().toLowerCase();
    return DB.activeProducts().filter(p =>
      (category === 'All' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || String(p.category).toLowerCase().includes(q) || String(p.barcode || '').includes(q)));
  }

  function renderTiles() {
    const all = DB.activeProducts();
    const cats = ['All'].concat(Array.from(new Set(all.map(p => p.category))).sort());
    if (cats.indexOf(category) === -1) category = 'All';
    chipsEl.innerHTML = cats.map(c => '<button type="button" class="chip' + (c === category ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
    const shown = matches();
    tilesEl.innerHTML = shown.length ? shown.map(p =>
      '<button type="button" class="tile" data-id="' + esc(p.id) + '"' + (p.stock <= 0 ? ' disabled' : '') + '>' +
        '<span class="thumb">' + thumb(p) + '</span>' +
        '<strong>' + esc(p.name) + '</strong>' +
        '<span class="tile-price">' + pesoShort(p.price) + '</span>' +
        (p.barcode ? '<small class="tile-code">' + esc(p.barcode) + '</small>' : '') +
        '<small class="' + (p.stock <= 0 ? 'out' : (p.stock <= LOW_STOCK_LIMIT ? 'low' : '')) + '">' + (p.stock <= 0 ? 'Out of stock' : p.stock + ' left') + '</small>' +
      '</button>').join('') : '<p class="muted tiles-empty">No products found.</p>';
  }

  function renderCart() {
    const list = lines();
    cart = list.map(x => x.line);
    cartEl.innerHTML = list.length ? list.map(({ line, product }) =>
      '<div class="cart-line">' +
        '<div class="cart-name"><strong>' + esc(product.name) + '</strong><small>' + pesoShort(product.price) + ' each</small></div>' +
        '<div class="stepper">' +
          '<button type="button" class="step" data-step="-1" data-id="' + esc(product.id) + '" aria-label="Decrease ' + esc(product.name) + '">' + icon('minus', 14) + '</button>' +
          '<input class="qty-input" type="number" min="1" max="' + esc(product.stock) + '" step="1" value="' + line.qty + '" data-id="' + esc(product.id) + '" aria-label="Quantity of ' + esc(product.name) + '">' +
          '<button type="button" class="step" data-step="1" data-id="' + esc(product.id) + '" aria-label="Increase ' + esc(product.name) + '">' + icon('plus', 14) + '</button>' +
        '</div>' +
        '<div class="cart-total">' + pesoShort(round2(product.price * line.qty)) + '</div>' +
        '<button type="button" class="icon-btn danger" data-remove="' + esc(product.id) + '" aria-label="Remove ' + esc(product.name) + '" title="Remove">' + icon('x', 16) + '</button>' +
      '</div>').join('') : '<p class="muted cart-empty">Scan a barcode or tap a product to start a sale.</p>';
    const total = totalOf(list);
    totalEl.textContent = pesoShort(total);
    completeBtn.disabled = !list.length;
    renderPayment(total);
  }

  function renderPayment(total) {
    const denoms = [50, 100, 200, 500, 1000].filter(d => d >= total).slice(0, 4);
    payQuick.innerHTML = total > 0
      ? '<button type="button" class="pay-btn" data-pay="' + total + '">Exact</button>' + denoms.map(d => '<button type="button" class="pay-btn" data-pay="' + d + '">' + pesoShort(d) + '</button>').join('')
      : '';
    const raw = paid.value.trim();
    changeBox.classList.remove('short', 'ok');
    if (total <= 0) { changeLabel.textContent = 'Change'; changeValue.textContent = peso(0); return; }
    if (raw === '') { changeLabel.textContent = 'Change'; changeValue.textContent = peso(0); return; }
    const v = Number(raw);
    if (!isFinite(v) || v < total) {
      changeLabel.textContent = 'Short by';
      changeValue.textContent = peso(round2(total - (isFinite(v) ? v : 0)));
      changeBox.classList.add('short');
    } else {
      changeLabel.textContent = 'Change';
      changeValue.textContent = peso(round2(v - total));
      changeBox.classList.add('ok');
    }
  }

  function addToCart(id) {
    const p = DB.find(id);
    if (!p || p.archived) { toast('That product is no longer available.', 'error'); renderTiles(); renderCart(); return false; }
    if (p.stock <= 0) { toast(p.name + ' is out of stock.', 'error'); return false; }
    const line = cart.find(l => l.id === id);
    if (line) {
      if (line.qty >= p.stock) { toast('Only ' + p.stock + ' ' + p.name + ' in stock.', 'error'); return false; }
      line.qty += 1;
    } else {
      cart.push({ id, qty: 1 });
    }
    hideError();
    renderCart();
    return true;
  }

  function resetScan() {
    scan.value = '';
    query = '';
    clearScan.classList.add('hidden');
    renderTiles();
    scan.focus();
  }

  function handleEnter() {
    const v = scan.value.trim();
    if (!v) return;
    const exact = DB.activeProducts().find(p => p.barcode && p.barcode === v);
    if (exact) { addToCart(exact.id); resetScan(); return; }
    const archived = DB.archivedProducts().find(p => p.barcode && p.barcode === v);
    if (archived) { toast('“' + archived.name + '” is archived and cannot be sold.', 'error'); scan.select(); return; }
    const found = matches();
    if (found.length === 1) { addToCart(found[0].id); resetScan(); return; }
    if (!found.length) { toast('No product found for “' + v + '”.', 'error'); scan.select(); return; }
    toast('Several products match. Tap the one you want.', 'error');
  }

  scan.addEventListener('input', () => {
    query = scan.value;
    clearScan.classList.toggle('hidden', !scan.value);
    renderTiles();
  });
  scan.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleEnter(); } });
  clearScan.addEventListener('click', resetScan);

  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    category = b.dataset.cat;
    renderTiles();
  });
  tilesEl.addEventListener('click', e => {
    const b = e.target.closest('.tile');
    if (b && !b.disabled) addToCart(b.dataset.id);
  });

  cartEl.addEventListener('click', e => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { cart = cart.filter(l => l.id !== rm.dataset.remove); renderCart(); return; }
    const st = e.target.closest('[data-step]');
    if (!st) return;
    const line = cart.find(l => l.id === st.dataset.id);
    const p = DB.find(st.dataset.id);
    if (!line || !p) { renderCart(); return; }
    const next = line.qty + Number(st.dataset.step);
    if (next < 1) { cart = cart.filter(l => l.id !== line.id); }
    else if (next > p.stock) { toast('Only ' + p.stock + ' ' + p.name + ' in stock.', 'error'); return; }
    else line.qty = next;
    renderCart();
  });
  cartEl.addEventListener('change', e => {
    const input = e.target.closest('.qty-input');
    if (!input) return;
    const p = DB.find(input.dataset.id);
    const line = cart.find(l => l.id === input.dataset.id);
    if (!p || !line) { renderCart(); return; }
    let v = parseInt(input.value, 10);
    if (!v || v < 1) v = 1;
    if (v > p.stock) { v = p.stock; toast('Only ' + p.stock + ' ' + p.name + ' in stock.', 'error'); }
    line.qty = v;
    renderCart();
  });

  paid.addEventListener('input', () => { hideError(); renderPayment(totalOf(lines())); });
  payQuick.addEventListener('click', e => {
    const b = e.target.closest('[data-pay]');
    if (!b) return;
    paid.value = b.dataset.pay;
    hideError();
    renderPayment(totalOf(lines()));
  });

  $('#clearCart').addEventListener('click', async () => {
    if (!cart.length) return;
    const ok = await confirmDialog({ title: 'Clear this sale?', message: 'All items will be removed from the current sale.', confirmText: 'Clear', danger: true });
    if (!ok) return;
    cart = [];
    paid.value = '';
    hideError();
    renderCart();
    scan.focus();
  });

  function complete() {
    hideError();
    const list = lines();
    if (!list.length) { showError('Add at least one product first.'); return; }
    const total = totalOf(list);
    const raw = paid.value.trim();
    const received = raw === '' ? total : Number(raw);
    if (!isFinite(received) || received < total) { showError('Amount received is less than the total (' + peso(total) + ').'); paid.focus(); return; }

    const fresh = DB.products();
    for (const { line } of list) {
      const p = fresh.find(x => x.id === line.id);
      if (!p || p.archived) { showError('A product in this sale is no longer available.'); renderTiles(); renderCart(); return; }
      if (line.qty > p.stock) { showError('Only ' + p.stock + ' ' + p.name + ' left in stock.'); renderTiles(); renderCart(); return; }
    }

    const now = new Date().toISOString();
    const saleId = uid('S');
    const saleNo = 'R-' + pad(DB.next('sale'), 6);
    const change = round2(received - total);
    const tx = DB.transactions();
    const items = [];
    list.forEach(({ line }) => {
      const p = fresh.find(x => x.id === line.id);
      p.stock -= line.qty;
      const lineTotal = round2(p.price * line.qty);
      items.push({ name: p.name, qty: line.qty, price: p.price, total: lineTotal });
      tx.push({
        id: uid('T'), saleId, saleNo, date: now, productId: p.id, product: p.name, qty: line.qty, unitPrice: p.price,
        total: lineTotal, cost: round2((p.cost || 0) * line.qty), type: 'Sale', voided: false,
        username: user.username, userName: user.name, userIdNo: user.idNo, received, change
      });
    });
    if (!DB.saveProducts(fresh) || !DB.saveTransactions(tx)) return;
    logAction('Sale', 'Sale completed', saleNo + ' · ' + items.length + ' item' + (items.length === 1 ? '' : 's') + ' · ' + peso(total), user);

    const sale = { saleNo, date: now, userName: user.name, items, total, received, change, voided: false };
    cart = [];
    paid.value = '';
    query = '';
    scan.value = '';
    clearScan.classList.add('hidden');
    renderTiles();
    renderCart();

    const body = document.createElement('div');
    body.className = 'receipt-wrap';
    body.innerHTML = '<p class="sale-done">' + icon('check', 20, 2.5) + ' Sale completed. Stock was updated.</p>' + receiptHtml(sale);
    openModal({
      title: 'Receipt',
      body,
      onClose: () => scan.focus(),
      actions: [
        { label: 'Print receipt', onClick: () => printHtml(receiptHtml(sale)) },
        { label: 'New sale', className: 'btn-blue', primary: true }
      ]
    });
  }

  completeBtn.addEventListener('click', complete);

  document.addEventListener('keydown', e => {
    if (document.querySelector('.modal-overlay')) return;
    if (e.key === 'F2') { e.preventDefault(); scan.focus(); scan.select(); }
    else if (e.key === 'F9' || (e.key === 'Enter' && e.ctrlKey)) { e.preventDefault(); complete(); }
  });

  renderTiles();
  renderCart();
  scan.focus();
})();