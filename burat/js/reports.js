(function () {
  const user = initLayout({ active: 'reports', roles: ['owner'] });
  if (!user) return;

  const state = { kind: 'sales', period: 'daily', anchor: new Date() };
  const anchorInput = $('#anchor');
  const host = $('#report');
  anchorInput.value = toInputDate(state.anchor);

  const statusText = p => ({ in: 'In Stock', low: 'Low Stock', out: 'Out of Stock' }[DB.status(p)]);
  const sum = (list, key) => round2(list.reduce((t, x) => t + (Number(x[key]) || 0), 0));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function salesReport() {
    const range = periodRange(state.period, state.anchor);
    const inRange = t => { const d = new Date(t.date); return d >= range.from && d < range.to; };
    const all = DB.transactions().filter(inRange);
    const sales = groupSales(all);
    const valid = sales.filter(s => !s.voided);
    const rows = all.filter(t => t.type === 'Sale' && !t.voided);
    const totalSales = sum(rows, 'total');
    const cogs = sum(rows, 'cost');
    const items = rows.reduce((t, r) => t + r.qty, 0);

    const byProduct = new Map();
    rows.forEach(r => {
      const g = byProduct.get(r.productId) || { name: r.product, qty: 0, sales: 0, cost: 0 };
      g.qty += r.qty; g.sales = round2(g.sales + r.total); g.cost = round2(g.cost + (r.cost || 0));
      byProduct.set(r.productId, g);
    });
    const best = Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty || b.sales - a.sales).slice(0, 10);

    const sections = [{
      title: 'Best-selling products',
      columns: [{ label: 'Rank', type: 'num' }, { label: 'Product', type: 'text' }, { label: 'Qty sold', type: 'num' }, { label: 'Sales', type: 'money' }, { label: 'Cost', type: 'money' }, { label: 'Profit', type: 'money' }],
      rows: best.map((g, i) => [i + 1, g.name, g.qty, g.sales, g.cost, round2(g.sales - g.cost)])
    }];

    if (state.period !== 'daily') {
      const days = [];
      for (let d = new Date(range.from); d < range.to; d = addDays(d, 1)) {
        const next = addDays(d, 1);
        const r = rows.filter(t => { const x = new Date(t.date); return x >= d && x < next; });
        const n = valid.filter(s => { const x = new Date(s.date); return x >= d && x < next; }).length;
        const sl = sum(r, 'total'), co = sum(r, 'cost');
        days.push([formatDay(d), n, r.reduce((t, x) => t + x.qty, 0), sl, co, round2(sl - co)]);
      }
      sections.push({
        title: 'Sales by day',
        columns: [{ label: 'Date', type: 'text' }, { label: 'Txns', type: 'num' }, { label: 'Items', type: 'num' }, { label: 'Sales', type: 'money' }, { label: 'Cost', type: 'money' }, { label: 'Profit', type: 'money' }],
        rows: days
      });
    }

    sections.push({
      title: 'Transactions',
      columns: [{ label: 'Receipt', type: 'text' }, { label: 'Date', type: 'text' }, { label: 'Cashier', type: 'text' }, { label: 'Items', type: 'text' }, { label: 'Status', type: 'text' }, { label: 'Total', type: 'money' }, { label: 'Cost', type: 'money' }],
      rows: sales.map(s => [s.saleNo, formatDate(s.date), s.userName, s.items.map(i => i.name + ' x' + i.qty).join(', '), s.voided ? 'Voided' : 'Completed', s.voided ? 0 : s.total, s.voided ? 0 : s.cost])
    });

    return {
      title: 'Sales Report (' + cap(state.period) + ')',
      subtitle: range.label,
      generated: new Date().toLocaleString('en-US'),
      cards: [
        { label: 'Total sales', value: totalSales, type: 'money' },
        { label: 'Cost of goods sold', value: cogs, type: 'money' },
        { label: 'Gross profit', value: round2(totalSales - cogs), type: 'money' },
        { label: 'Transactions', value: valid.length, type: 'num' },
        { label: 'Items sold', value: items, type: 'num' },
        { label: 'Voided sales', value: sales.length - valid.length, type: 'num' }
      ],
      sections
    };
  }

  function inventoryReport() {
    const active = DB.activeProducts().sort((a, b) => a.name.localeCompare(b.name));
    const archived = DB.archivedProducts().sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
    const value = list => round2(list.reduce((t, p) => t + p.stock * (p.cost || 0), 0));
    const retail = round2(active.reduce((t, p) => t + p.stock * p.price, 0));
    const low = active.filter(p => DB.status(p) !== 'in').sort((a, b) => a.stock - b.stock);
    const units = list => list.reduce((t, p) => t + Number(p.stock), 0);

    return {
      title: 'Inventory Report',
      subtitle: 'Stock as of ' + formatDate(new Date().toISOString()),
      generated: new Date().toLocaleString('en-US'),
      cards: [
        { label: 'Active products', value: active.length, type: 'num' },
        { label: 'Archived products', value: archived.length, type: 'num' },
        { label: 'Low-stock items', value: low.filter(p => p.stock > 0).length, type: 'num' },
        { label: 'Out of stock', value: low.filter(p => p.stock <= 0).length, type: 'num' },
        { label: 'Stock value (cost)', value: value(active), type: 'money' },
        { label: 'Stock value (retail)', value: retail, type: 'money' }
      ],
      sections: [
        {
          title: 'Current stock levels',
          columns: [{ label: 'ID', type: 'text' }, { label: 'Product', type: 'text' }, { label: 'Category', type: 'text' }, { label: 'Stock', type: 'num' }, { label: 'Status', type: 'text' }, { label: 'Cost', type: 'money' }, { label: 'Price', type: 'money' }],
          rows: active.map(p => [p.id, p.name, p.category, p.stock, statusText(p), p.cost || 0, p.price])
        },
        {
          title: 'Low-stock items (' + LOW_STOCK_LIMIT + ' or fewer)',
          columns: [{ label: 'ID', type: 'text' }, { label: 'Product', type: 'text' }, { label: 'Category', type: 'text' }, { label: 'Stock', type: 'num' }, { label: 'Status', type: 'text' }],
          rows: low.map(p => [p.id, p.name, p.category, p.stock, statusText(p)])
        },
        {
          title: 'Active vs archived products',
          columns: [{ label: 'Status', type: 'text' }, { label: 'Products', type: 'num' }, { label: 'Units', type: 'num' }, { label: 'Value (cost)', type: 'money' }],
          rows: [['Active', active.length, units(active), value(active)], ['Archived', archived.length, units(archived), value(archived)], ['Total', active.length + archived.length, units(active) + units(archived), round2(value(active) + value(archived))]]
        },
        {
          title: 'Archived products',
          columns: [{ label: 'ID', type: 'text' }, { label: 'Product', type: 'text' }, { label: 'Category', type: 'text' }, { label: 'Stock', type: 'num' }, { label: 'Archived on', type: 'text' }, { label: 'Archived by', type: 'text' }],
          rows: archived.map(p => [p.id, p.name, p.category, p.stock, formatDate(p.archivedAt), p.archivedBy || ''])
        }
      ]
    };
  }

  function changesReport() {
    const range = periodRange(state.period, state.anchor);
    const entries = DB.log()
      .filter(l => l.meta && new Date(l.date) >= range.from && new Date(l.date) < range.to)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const of = types => entries.filter(l => types.indexOf(l.meta.type) !== -1);
    const by = l => l.meta.requester.name + ' (ID ' + l.meta.requester.idNo + ')';
    const appr = l => l.meta.self ? l.meta.approver.name + ' (own action)' : l.meta.approver.name + (l.meta.via === 'counter' ? ' (at the counter)' : '');
    const voids = of(['sale.void']);
    const archives = of(['product.archive', 'product.restore', 'product.delete']);
    const adjusts = of(['product.adjust']);
    const edits = of(['product.edit']);
    const archiveWord = { 'product.archive': 'Archived', 'product.restore': 'Restored', 'product.delete': 'Deleted permanently' };
    const text = label => ({ label, type: 'text' });

    return {
      title: 'Changes Report (' + cap(state.period) + ')',
      subtitle: range.label,
      generated: new Date().toLocaleString('en-US'),
      cards: [
        { label: 'Total changes', value: voids.length + archives.length + adjusts.length + edits.length, type: 'num' },
        { label: 'Voided sales', value: voids.length, type: 'num' },
        { label: 'Voided amount', value: round2(voids.reduce((t, l) => t + (Number(l.meta.amount) || 0), 0)), type: 'money' },
        { label: 'Archive actions', value: archives.length, type: 'num' },
        { label: 'Stock corrections', value: adjusts.length, type: 'num' },
        { label: 'Product edits', value: edits.length, type: 'num' }
      ],
      sections: [
        {
          title: 'Voided sales',
          columns: [text('Date'), text('Receipt'), { label: 'Amount', type: 'money' }, text('Reason'), text('Done by'), text('Approved by')],
          rows: voids.map(l => [formatDate(l.date), l.meta.rows[0][1], Number(l.meta.amount) || 0, l.meta.reason, by(l), appr(l)])
        },
        {
          title: 'Archived products',
          columns: [text('Date'), text('Product'), text('Action'), text('Reason'), text('Done by'), text('Approved by')],
          rows: archives.map(l => [formatDate(l.date), l.meta.rows[0][1], archiveWord[l.meta.type], l.meta.reason, by(l), appr(l)])
        },
        {
          title: 'Stock corrections',
          columns: [text('Date'), text('Product'), text('Stock change'), text('Reason'), text('Done by'), text('Approved by')],
          rows: adjusts.map(l => [formatDate(l.date), l.meta.rows[0][1], l.meta.rows[1][1], l.meta.reason, by(l), appr(l)])
        },
        {
          title: 'Product edits',
          columns: [text('Date'), text('Product'), text('What changed'), text('Done by'), text('Approved by')],
          rows: edits.map(l => [formatDate(l.date), l.meta.rows[0][1], l.meta.rows.slice(1).map(r => r[0] + ': ' + r[1]).join('; '), by(l), appr(l)])
        }
      ]
    };
  }

  function current() {
    if (state.kind === 'sales') return salesReport();
    return state.kind === 'changes' ? changesReport() : inventoryReport();
  }

  function fileBase() {
    if (state.kind === 'inventory') return 'inventory-report-' + toInputDate(new Date());
    return (state.kind === 'sales' ? 'sales-report-' : 'changes-report-') + state.period + '-' + toInputDate(state.anchor);
  }

  function render() {
    $$('.tab').forEach(t => { const on = t.dataset.kind === state.kind; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
    $$('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.period === state.period));
    $('#salesControls').classList.toggle('hidden', state.kind === 'inventory');
    host.innerHTML = Export.html(current());
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => { state.kind = t.dataset.kind; render(); }));
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => { state.period = b.dataset.period; render(); }));
  anchorInput.addEventListener('change', () => { state.anchor = anchorInput.value ? fromInputDate(anchorInput.value) : new Date(); if (!anchorInput.value) anchorInput.value = toInputDate(state.anchor); render(); });

  $('#printBtn').addEventListener('click', () => {
    logAction('Report', 'Printed report', current().title + ' · ' + current().subtitle, user);
    printHtml(Export.html(current()));
  });
  $('#csvBtn').addEventListener('click', () => {
    const r = current();
    Export.download(fileBase() + '.csv', Export.csv(r), 'text/csv;charset=utf-8');
    logAction('Report', 'Exported CSV', r.title + ' · ' + r.subtitle, user);
    toast('CSV downloaded.');
  });
  $('#pdfBtn').addEventListener('click', () => {
    const r = current();
    Export.download(fileBase() + '.pdf', Export.pdf(r), 'application/pdf');
    logAction('Report', 'Exported PDF', r.title + ' · ' + r.subtitle, user);
    toast('PDF downloaded.');
  });

  render();
})();