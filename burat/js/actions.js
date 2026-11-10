'use strict';

const FIELD_LABELS = { name: 'Name', category: 'Category', price: 'Price', cost: 'Cost', barcode: 'Barcode', description: 'Description', image: 'Image' };

function fmtField(key, value) {
  if (key === 'price' || key === 'cost') return peso(value || 0);
  if (key === 'image') return value ? 'Image set' : 'No image';
  return value === '' || value == null ? '(empty)' : String(value);
}
function productLabel(id) {
  const p = DB.find(id);
  return p ? p.id + ' · ' + p.name : String(id);
}
function productConflict(data, ignoreId) {
  const all = DB.products().filter(p => p.id !== ignoreId);
  if (data.name != null && all.some(p => p.name.toLowerCase() === String(data.name).toLowerCase())) return 'A product named “' + data.name + '” already exists.';
  if (data.barcode && all.some(p => p.barcode && p.barcode === data.barcode)) return 'The barcode ' + data.barcode + ' is already used by another product.';
  return null;
}
function fail(error) { return { ok: false, error }; }
function done(message) { return { ok: true, message }; }

const Changes = {
  'product.add': {
    label: 'Add product', category: 'Product',
    describe(p) {
      const d = p.data;
      return {
        summary: 'Add product “' + d.name + '”',
        rows: [['Name', d.name], ['Category', d.category], ['Price', peso(d.price)], ['Cost', peso(d.cost || 0)], ['Barcode', d.barcode || '(none)'], ['Starting stock', d.stock]]
      };
    },
    apply(p) {
      const d = p.data;
      const problem = productConflict(d, null);
      if (problem) return fail(problem);
      const products = DB.products();
      const id = DB.nextId();
      products.push({
        id, name: d.name, category: d.category, price: d.price, cost: d.cost || 0, barcode: d.barcode || '', stock: d.stock,
        description: d.description || '', image: d.image || '', archived: false, archivedAt: '', archivedBy: ''
      });
      if (!DB.saveProducts(products)) return fail('Could not save the product.');
      return done('Added “' + d.name + '” (' + id + ').');
    }
  },
  'product.edit': {
    label: 'Edit product', category: 'Product',
    describe(p) {
      const rows = [['Product', productLabel(p.id)]];
      Object.keys(p.changes).forEach(k => rows.push([FIELD_LABELS[k] || k, fmtField(k, p.before && p.before[k]) + ' → ' + fmtField(k, p.changes[k])]));
      return { summary: 'Edit ' + productLabel(p.id), rows };
    },
    apply(p) {
      const products = DB.products();
      const target = products.find(x => x.id === p.id);
      if (!target) return fail('That product no longer exists.');
      if (target.archived) return fail('That product is archived. Restore it first.');
      const problem = productConflict(p.changes, p.id);
      if (problem) return fail(problem);
      Object.assign(target, p.changes);
      if (!DB.saveProducts(products)) return fail('Could not save the product.');
      return done('Updated “' + target.name + '”.');
    }
  },
  'product.restock': {
    label: 'Restock', category: 'Stock',
    describe(p) {
      return { summary: 'Restock ' + productLabel(p.id) + ' by ' + p.qty, rows: [['Product', productLabel(p.id)], ['Quantity received', '+' + p.qty], ['Total cost', peso(p.cost)]] };
    },
    apply(p, ctx) {
      const products = DB.products();
      const target = products.find(x => x.id === p.id);
      if (!target) return fail('That product no longer exists.');
      if (target.archived) return fail('That product is archived. Restore it first.');
      target.stock = Number(target.stock) + p.qty;
      const tx = DB.transactions();
      tx.push({
        id: uid('T'), saleId: uid('PU'), saleNo: '', date: new Date().toISOString(), productId: target.id, product: target.name,
        qty: p.qty, unitPrice: round2(p.cost / p.qty), total: round2(p.cost), cost: round2(p.cost), type: 'Purchase', voided: false,
        username: ctx.requester.username, userName: ctx.requester.name, userIdNo: ctx.requester.idNo
      });
      if (!DB.saveProducts(products) || !DB.saveTransactions(tx)) return fail('Could not save the restock.');
      return done('Added ' + p.qty + ' to ' + target.name + '. New stock: ' + target.stock + '.');
    }
  },
  'product.adjust': {
    label: 'Stock correction', category: 'Stock',
    describe(p) {
      return { summary: 'Correct stock of ' + productLabel(p.id) + ' to ' + p.newStock, rows: [['Product', productLabel(p.id)], ['Stock', p.beforeStock + ' → ' + p.newStock], ['Reason', p.reason]] };
    },
    apply(p) {
      const products = DB.products();
      const target = products.find(x => x.id === p.id);
      if (!target) return fail('That product no longer exists.');
      if (target.archived) return fail('That product is archived. Restore it first.');
      const old = target.stock;
      target.stock = p.newStock;
      if (!DB.saveProducts(products)) return fail('Could not save the correction.');
      return done('Stock of ' + target.name + ' changed from ' + old + ' to ' + p.newStock + '. Reason: ' + p.reason);
    }
  },
  'product.archive': {
    label: 'Archive product', category: 'Archive',
    describe(p) {
      return { summary: 'Archive ' + productLabel(p.id), rows: [['Product', productLabel(p.id)], ['Reason', p.reason || '(none)']] };
    },
    apply(p, ctx) {
      const products = DB.products();
      const target = products.find(x => x.id === p.id);
      if (!target) return fail('That product no longer exists.');
      if (target.archived) return fail('That product is already archived.');
      target.archived = true;
      target.archivedAt = new Date().toISOString();
      target.archivedBy = ctx.requester.name;
      target.archiveReason = p.reason || '';
      if (!DB.saveProducts(products)) return fail('Could not archive the product.');
      return done('Archived “' + target.name + '”. It is hidden from the inventory list.');
    }
  },
  'sale.void': {
    label: 'Void sale', category: 'Sale',
    describe(p) {
      return { summary: 'Void sale ' + p.saleNo, rows: [['Receipt', p.saleNo], ['Total', peso(p.total)], ['Reason', p.reason]] };
    },
    apply(p, ctx) {
      const tx = DB.transactions();
      const rows = tx.filter(t => t.saleId === p.saleId && t.type === 'Sale');
      if (!rows.length) return fail('That sale no longer exists.');
      if (rows[0].voided) return fail('That sale is already voided.');
      const products = DB.products();
      const when = new Date().toISOString();
      rows.forEach(t => {
        t.voided = true;
        t.voidedAt = when;
        t.voidedBy = ctx.requester.name;
        t.voidReason = p.reason;
        const prod = products.find(x => x.id === t.productId);
        if (prod) prod.stock = Number(prod.stock) + t.qty;
      });
      if (!DB.saveProducts(products) || !DB.saveTransactions(tx)) return fail('Could not void the sale.');
      return done('Voided sale ' + p.saleNo + ' and returned the items to stock.');
    }
  }
};

function describeChange(type, payload) { return Changes[type].describe(payload); }

function executeChange(type, payload, requester, approver, via) {
  const def = Changes[type];
  const r = def.apply(payload, { requester, approver });
  if (!r.ok) return r;
  let detail = r.message;
  if (requester.username !== approver.username) {
    detail += ' · requested by ' + requester.name + ' (ID ' + requester.idNo + '), approved by ' + approver.name + (via === 'counter' ? ' at the counter' : '');
  }
  const d = describeChange(type, payload);
  const meta = {
    type, rows: d.rows, reason: payload.reason || '', amount: payload.total || 0,
    requester: { username: requester.username, name: requester.name, idNo: requester.idNo },
    approver: { name: approver.name }, self: requester.username === approver.username, via: via || ''
  };
  logAction(def.category, def.label, detail, requester, meta);
  return r;
}

const Requests = {
  create(type, payload, requester, status, approver, via) {
    const d = describeChange(type, payload);
    const list = DB.requests();
    const req = {
      id: 'REQ-' + pad(DB.next('request'), 4), type, payload, summary: d.summary, rows: d.rows, status: status || 'pending',
      createdAt: new Date().toISOString(),
      requestedBy: { username: requester.username, name: requester.name, idNo: requester.idNo },
      decidedAt: status === 'approved' ? new Date().toISOString() : '', decidedBy: approver ? approver.name : '', note: '', via: via || ''
    };
    list.push(req);
    DB.saveRequests(list);
    if (req.status === 'pending') logAction('Request', 'Change requested', req.id + ': ' + d.summary, requester);
    return req;
  },
  decide(id, decision, owner, note) {
    const list = DB.requests();
    const req = list.find(r => r.id === id);
    if (!req || req.status !== 'pending') return fail('That request is no longer pending.');
    if (decision === 'approved') {
      const r = executeChange(req.type, req.payload, req.requestedBy, owner, 'approvals');
      if (!r.ok) return r;
      req.via = 'approvals';
      req.status = 'approved';
      req.decidedAt = new Date().toISOString();
      req.decidedBy = owner.name;
      req.note = note || '';
      DB.saveRequests(list);
      return r;
    }
    req.status = 'rejected';
    req.decidedAt = new Date().toISOString();
    req.decidedBy = owner.name;
    req.note = note || '';
    DB.saveRequests(list);
    logAction('Approval', 'Rejected request', req.id + ': ' + req.summary + ' (requested by ' + req.requestedBy.name + ')' + (note ? ' · ' + note : ''), owner);
    return done('Request ' + req.id + ' was rejected.');
  },
  cancel(id, user) {
    const list = DB.requests();
    const req = list.find(r => r.id === id);
    if (!req || req.status !== 'pending') return fail('That request is no longer pending.');
    if (req.requestedBy.username !== user.username) return fail('You can only cancel your own requests.');
    req.status = 'cancelled';
    req.decidedAt = new Date().toISOString();
    DB.saveRequests(list);
    logAction('Request', 'Request cancelled', req.id + ': ' + req.summary, user);
    return done('Request ' + req.id + ' was cancelled.');
  }
};

async function submitChange(type, base, opts = {}) {
  const user = Auth.current();
  if (!user) { location.replace('index.html'); return { status: 'cancelled' }; }
  const def = Changes[type];
  const custom = opts.fields || [];
  const isOwner = user.role === 'owner';
  let counterOwner = null;
  let values = {};

  if (!isOwner || custom.length) {
    const fields = custom.slice();
    if (!isOwner) {
      fields.push(
        { section: 'Verify your identity', note: 'Enter your name and ID number exactly as they appear on your account.' },
        { id: 'idName', label: 'Your full name', placeholder: 'e.g. ' + user.name },
        { id: 'idNo', label: 'Your ID number', placeholder: 'e.g. ' + user.idNo },
        { id: 'ownerPw', label: 'Owner password (optional)', type: 'password', hint: 'Leave blank to send this to the owner for approval. If the owner is at the counter, they can type their password here to approve it now.' }
      );
    }
    const intro =
      (isOwner ? '' : '<div class="notice">Changes by staff need the owner’s approval before they take effect.</div>') +
      (opts.introHtml || '') + (opts.showDetails ? detailsTable(def.describe(base).rows) : '');
    const v = await formDialog({
      title: opts.title || def.label,
      introHtml: intro, fields,
      submitText: opts.submitText || (isOwner ? 'Confirm' : 'Submit'),
      danger: opts.danger,
      validate: v => {
        const problem = opts.validate ? opts.validate(v) : null;
        if (problem) return problem;
        if (!isOwner) {
          if (!v.idName.trim() || !v.idNo.trim()) return 'Enter your name and ID number.';
          if (v.idName.trim().toLowerCase() !== user.name.toLowerCase() || v.idNo.trim().toLowerCase() !== user.idNo.toLowerCase()) {
            return 'The name and ID number do not match your account.';
          }
          if (v.ownerPw) {
            const r = Auth.verifyOwner(v.ownerPw);
            if (r.error) return r.error;
            counterOwner = r.user;
          }
        }
        return null;
      }
    });
    if (!v) return { status: 'cancelled' };
    values = v;
  }

  const payload = Object.assign({}, base);
  custom.forEach(f => {
    if (f.section) return;
    payload[f.id] = f.type === 'number' ? Number(values[f.id]) : String(values[f.id]).trim();
  });

  if (isOwner) {
    const r = executeChange(type, payload, user, user, 'owner');
    if (!r.ok) { toast(r.error, 'error'); return { status: 'error', message: r.error }; }
    toast(r.message);
    return { status: 'applied', message: r.message };
  }
  if (counterOwner) {
    const r = executeChange(type, payload, user, counterOwner, 'counter');
    if (!r.ok) { toast(r.error, 'error'); return { status: 'error', message: r.error }; }
    Requests.create(type, payload, user, 'approved', counterOwner, 'counter');
    toast(r.message + ' Approved by the owner.');
    return { status: 'applied', message: r.message };
  }
  Requests.create(type, payload, user, 'pending');
  toast('Request sent. The owner needs to approve it.');
  return { status: 'pending' };
}