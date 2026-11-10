'use strict';

const LOW_STOCK_LIMIT = 10;
const PAGE_SIZE = 8;
const CATEGORIES = ['Beverages', 'Snacks', 'Food', 'Hygiene', 'Household'];
const BUSINESS_NAME = 'Small Business Store';

const KEYS = {
  users: 'sbis2_users',
  products: 'sbis2_products',
  transactions: 'sbis2_transactions',
  requests: 'sbis2_requests',
  log: 'sbis2_log',
  counters: 'sbis2_counters',
  lock: 'sbis2_lock',
  session: 'sbis2_session',
  flash: 'sbis2_flash',
  nav: 'sbis2_nav'
};

const NAV = [
  { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', roles: ['owner', 'staff'] },
  { key: 'products', label: 'Product Management', href: 'products.html', roles: ['owner', 'staff'] },
  { key: 'add', label: 'Add/Edit Product', href: 'add-product.html', roles: ['owner', 'staff'] },
  { key: 'archived', label: 'Archived Products', href: 'archived.html', roles: ['owner'] },
  { key: 'sales', label: 'Point of Sale', href: 'sales.html', roles: ['owner', 'staff'] },
  { key: 'history', label: 'Sales History', href: 'sales-history.html', roles: ['owner', 'staff'] },
  { key: 'inventory', label: 'Inventory Monitoring', href: 'inventory.html', roles: ['owner', 'staff'] },
  { key: 'reports', label: 'Reports', href: 'reports.html', roles: ['owner'] },
  { key: 'approvals', label: 'Approvals', staffLabel: 'My Requests', href: 'approvals.html', roles: ['owner', 'staff'], badge: true },
  { key: 'staff', label: 'Staff', href: 'staff.html', roles: ['owner'] },
  { key: 'activity', label: 'Activity Log', href: 'activity.html', roles: ['owner'] },
  { key: 'flow', label: 'Navigation Flow', href: 'flow.html', roles: ['owner'] }
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function peso(n) {
  return '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pesoShort(n) {
  return '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return date + ' ' + time;
}
function formatDay(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad(n, len) { return String(n).padStart(len, '0'); }

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function startOfMonth(d) { const x = startOfDay(d); x.setDate(1); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toInputDate(d) { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1, 2) + '-' + pad(x.getDate(), 2); }
function fromInputDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}
function periodRange(kind, anchor) {
  const short = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (kind === 'weekly') {
    const from = startOfWeek(anchor), to = addDays(from, 7);
    return { from, to, label: 'Week of ' + short(from) + ' – ' + short(addDays(to, -1)) + ', ' + addDays(to, -1).getFullYear() };
  }
  if (kind === 'monthly') {
    const from = startOfMonth(anchor);
    return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1), label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
  }
  const from = startOfDay(anchor);
  return { from, to: addDays(from, 1), label: formatDay(from) };
}

const sha256 = (function () {
  const K = [], H0 = [];
  let n = 2, c = 0;
  while (c < 64) {
    let prime = true;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
    if (prime) {
      if (c < 8) H0[c] = (Math.pow(n, 0.5) % 1 * 4294967296) | 0;
      K[c] = (Math.pow(n, 1 / 3) % 1 * 4294967296) | 0;
      c++;
    }
    n++;
  }
  return function (msg) {
    const bytes = Array.from(new TextEncoder().encode(msg));
    const bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 255);
    for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 255);
    const H = H0.slice(), w = new Array(64);
    for (let o = 0; o < bytes.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const mj = (a & b) ^ (a & cc) ^ (b & cc);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();

const ICONS = {
  box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  restock: '<path d="M16 16h6"/><path d="M19 13v6"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
};
function icon(name, size = 20, stroke = 2) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}
function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(el => {
    if (el.dataset.done) return;
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20, Number(el.dataset.stroke) || 2);
    el.dataset.done = '1';
  });
}

function toast(message, type = 'success') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4000);
}
function flash(message, type = 'success') {
  try { sessionStorage.setItem(KEYS.flash, JSON.stringify({ message, type })); } catch (e) { }
}
function showFlash() {
  try {
    const raw = sessionStorage.getItem(KEYS.flash);
    if (!raw) return;
    sessionStorage.removeItem(KEYS.flash);
    const f = JSON.parse(raw);
    toast(f.message, f.type);
  } catch (e) { }
}

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Could not save. Browser storage may be full or blocked.', 'error'); return false; }
  }
};

function makeUser(idNo, name, username, role, password) {
  const salt = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
  return { idNo, name, username, role, salt, hash: sha256(salt + ':' + password), active: true };
}
function sampleUsers() {
  return [
    makeUser('OWN-001', 'Owner', 'owner', 'owner', 'owner123'),
    makeUser('STF-001', 'Staff Demo', 'staff', 'staff', 'staff123')
  ];
}
function sampleProducts() {
  const p = (id, name, category, price, cost, stock, barcode) => ({
    id, name, category, price, cost, barcode, stock, description: '', image: '', archived: false, archivedAt: '', archivedBy: ''
  });
  const list = [
    p('P001', 'Product A', 'Beverages', 50, 30, 20, '480100000011'),
    p('P002', 'Product B', 'Snacks', 35, 20, 15, '480100000028'),
    p('P003', 'Product C', 'Hygiene', 120, 80, 8, '480100000035'),
    p('P004', 'Product D', 'Household', 75, 45, 25, '480100000042'),
    p('P005', 'Product E', 'Beverages', 60, 35, 12, '480100000059'),
    p('P006', 'Iced Coffee', 'Beverages', 60, 25, 20, '480100000066'),
    p('P007', 'Burger', 'Food', 80, 45, 10, '480100000073'),
    p('P008', 'Fries', 'Food', 40, 18, 8, '480100000080'),
    p('P009', 'Water', 'Beverages', 20, 8, 50, '480100000097'),
    p('P010', 'Sandwich', 'Food', 70, 38, 15, '480100000103'),
    p('P011', 'Old Brand Soap', 'Hygiene', 55, 35, 4, '480100000110')
  ];
  const old = list[10];
  old.archived = true;
  old.archivedAt = new Date(Date.now() - 5 * 86400000).toISOString();
  old.archivedBy = 'Owner';
  return list;
}
function sampleTransactions(products) {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const active = products.filter(p => !p.archived);
  const now = Date.now();
  const today = startOfDay(now).getTime();
  const rows = [];
  const sales = [];
  for (let d = 27; d >= 0; d--) {
    const count = 2 + Math.floor(rnd() * 4);
    for (let s = 0; s < count; s++) {
      let when;
      if (d === 0) when = Math.max(today + 60000, now - (30 + s * 47) * 60000);
      else when = startOfDay(addDays(now, -d)).getTime() + (9 + Math.floor(rnd() * 10)) * 3600000 + Math.floor(rnd() * 60) * 60000;
      sales.push({ when, items: 1 + Math.floor(rnd() * 3), who: rnd() < 0.8 ? 0 : 1 });
    }
  }
  sales.sort((a, b) => a.when - b.when);
  sales.forEach((s, i) => {
    const n = i + 1;
    const picked = [];
    while (picked.length < s.items) {
      const p = active[Math.floor(rnd() * active.length)];
      if (picked.indexOf(p) === -1) picked.push(p);
    }
    const lines = picked.map(p => ({ p, qty: 1 + Math.floor(rnd() * 3) }));
    const total = lines.reduce((t, l) => t + l.p.price * l.qty, 0);
    const received = Math.ceil(total / 50) * 50;
    const who = s.who === 0 ? { username: 'staff', userName: 'Staff Demo', userIdNo: 'STF-001' } : { username: 'owner', userName: 'Owner', userIdNo: 'OWN-001' };
    lines.forEach((l, k) => rows.push(Object.assign({
      id: 'T' + n + '-' + k, saleId: 'S' + n, saleNo: 'R-' + pad(n, 6), date: new Date(s.when).toISOString(),
      productId: l.p.id, product: l.p.name, qty: l.qty, unitPrice: l.p.price, total: round2(l.p.price * l.qty),
      cost: round2(l.p.cost * l.qty), type: 'Sale', voided: false, received, change: round2(received - total)
    }, who)));
  });
  [[20, 'P001', 30], [14, 'P004', 24], [9, 'P009', 40], [6, 'P006', 20], [3, 'P002', 25]].forEach((r, i) => {
    const p = products.find(x => x.id === r[1]);
    rows.push({
      id: 'TP' + i, saleId: 'PU' + i, saleNo: '', date: new Date(startOfDay(addDays(now, -r[0])).getTime() + 8 * 3600000).toISOString(),
      productId: p.id, product: p.name, qty: r[2], unitPrice: 0, total: round2(p.cost * r[2]), cost: round2(p.cost * r[2]),
      type: 'Purchase', voided: false, username: 'owner', userName: 'Owner', userIdNo: 'OWN-001'
    });
  });
  return { rows, saleCount: sales.length };
}
function seedBusinessData() {
  const products = sampleProducts();
  const t = sampleTransactions(products);
  Store.set(KEYS.products, products);
  Store.set(KEYS.transactions, t.rows);
  Store.set(KEYS.requests, []);
  Store.set(KEYS.log, []);
  Store.set(KEYS.counters, { sale: t.saleCount, request: 0, log: 0 });
}
(function ensureSeed() {
  try {
    if (localStorage.getItem(KEYS.users) === null) Store.set(KEYS.users, sampleUsers());
    if (localStorage.getItem(KEYS.products) === null) seedBusinessData();
  } catch (e) { }
})();

const DB = {
  users() { return Store.get(KEYS.users, []); },
  saveUsers(list) { return Store.set(KEYS.users, list); },
  products() { return Store.get(KEYS.products, []); },
  saveProducts(list) { return Store.set(KEYS.products, list); },
  activeProducts() { return this.products().filter(p => !p.archived); },
  archivedProducts() { return this.products().filter(p => p.archived); },
  transactions() { return Store.get(KEYS.transactions, []); },
  saveTransactions(list) { return Store.set(KEYS.transactions, list); },
  requests() { return Store.get(KEYS.requests, []); },
  saveRequests(list) { return Store.set(KEYS.requests, list); },
  log() { return Store.get(KEYS.log, []); },
  find(id) { return this.products().find(p => p.id === id) || null; },
  nextId() {
    const max = this.products().reduce((m, p) => Math.max(m, parseInt(String(p.id).replace(/\D/g, ''), 10) || 0), 0);
    return 'P' + pad(max + 1, 3);
  },
  next(counter) {
    const c = Store.get(KEYS.counters, { sale: 0, request: 0, log: 0 });
    c[counter] = (c[counter] || 0) + 1;
    Store.set(KEYS.counters, c);
    return c[counter];
  },
  status(p) { return p.stock <= 0 ? 'out' : (p.stock <= LOW_STOCK_LIMIT ? 'low' : 'in'); },
  pendingFor(productId) {
    return this.requests().filter(r => r.status === 'pending' && r.payload && r.payload.id === productId);
  },
  pendingCount(username) {
    return this.requests().filter(r => r.status === 'pending' && (!username || r.requestedBy.username === username)).length;
  }
};

function logAction(category, action, detail, actor, meta) {
  const who = actor || Auth.peek() || { username: 'system', name: 'System', idNo: '', role: '' };
  const list = DB.log();
  list.push({
    id: 'L' + pad(DB.next('log'), 5), date: new Date().toISOString(), category,
    username: who.username, name: who.name, idNo: who.idNo || '', role: who.role || '', action, detail: detail || '', meta: meta || null
  });
  Store.set(KEYS.log, list.length > 1500 ? list.slice(list.length - 1500) : list);
}

function statusBadge(p) {
  const s = DB.status(p);
  const label = { in: 'In Stock', low: 'Low Stock', out: 'Out of Stock' }[s];
  return '<span class="badge badge-' + s + '">' + label + '</span>';
}
function txBadge(t) {
  if (t.voided) return '<span class="badge badge-void">Voided</span>';
  return '<span class="badge badge-' + (t.type === 'Purchase' ? 'purchase' : 'sale') + '">' + esc(t.type) + '</span>';
}
function requestBadge(status) {
  return '<span class="badge badge-' + esc(status) + '">' + esc(status.charAt(0).toUpperCase() + status.slice(1)) + '</span>';
}

function groupSales(tx) {
  const map = new Map();
  tx.filter(t => t.type === 'Sale').forEach(t => {
    let g = map.get(t.saleId);
    if (!g) {
      g = {
        saleId: t.saleId, saleNo: t.saleNo || t.saleId, date: t.date, username: t.username, userName: t.userName, userIdNo: t.userIdNo,
        items: [], total: 0, cost: 0, voided: !!t.voided, voidedAt: t.voidedAt, voidedBy: t.voidedBy, voidReason: t.voidReason,
        received: t.received, change: t.change
      };
      map.set(t.saleId, g);
    }
    g.items.push({ productId: t.productId, name: t.product, qty: t.qty, price: t.unitPrice, total: t.total, cost: t.cost || 0 });
    g.total = round2(g.total + t.total);
    g.cost = round2(g.cost + (t.cost || 0));
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function receiptHtml(sale) {
  const rows = sale.items.map(i =>
    '<tr><td>' + esc(i.name) + '<br><small>' + esc(i.qty) + ' x ' + pesoShort(i.price) + '</small></td><td class="r">' + pesoShort(i.total) + '</td></tr>').join('');
  return '<div class="receipt">' +
    '<div class="receipt-head"><strong>' + esc(BUSINESS_NAME) + '</strong><span>Official Receipt</span></div>' +
    '<div class="receipt-meta"><span>No. ' + esc(sale.saleNo) + '</span><span>' + esc(formatDate(sale.date)) + '</span><span>Cashier: ' + esc(sale.userName) + '</span></div>' +
    (sale.voided ? '<div class="receipt-void">VOIDED</div>' : '') +
    '<table>' + rows + '</table>' +
    '<div class="receipt-total"><span>Total</span><strong>' + peso(sale.total) + '</strong></div>' +
    (sale.received != null ? '<div class="receipt-line"><span>Received</span><span>' + peso(sale.received) + '</span></div>' +
      '<div class="receipt-line"><span>Change</span><span>' + peso(sale.change || 0) + '</span></div>' : '') +
    '<p class="receipt-foot">Thank you for your purchase!</p></div>';
}

function printHtml(html) {
  let el = document.getElementById('printArea');
  if (!el) {
    el = document.createElement('div');
    el.id = 'printArea';
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  window.print();
}

const Auth = {
  idleLimit: 30 * 60 * 1000,
  maxFails: 5,
  lockMs: 30000,
  hashPw(salt, password) { return sha256(salt + ':' + password); },
  lockLeft(key) {
    const e = Store.get(KEYS.lock, {})[key];
    return e && e.until > Date.now() ? Math.ceil((e.until - Date.now()) / 1000) : 0;
  },
  fail(key) {
    const s = Store.get(KEYS.lock, {});
    const e = s[key] || { fails: 0, until: 0 };
    if (e.until && e.until <= Date.now()) { e.fails = 0; e.until = 0; }
    e.fails += 1;
    if (e.fails >= this.maxFails) { e.until = Date.now() + this.lockMs; e.fails = 0; }
    s[key] = e;
    Store.set(KEYS.lock, s);
  },
  clearFails(key) {
    const s = Store.get(KEYS.lock, {});
    delete s[key];
    Store.set(KEYS.lock, s);
  },
  readSession() {
    try { return JSON.parse(sessionStorage.getItem(KEYS.session)); } catch (e) { return null; }
  },
  end() { try { sessionStorage.removeItem(KEYS.session); } catch (e) { } },
  login(username, password) {
    const left = this.lockLeft('login');
    if (left) return { error: 'Too many failed attempts. Try again in ' + left + ' seconds.' };
    const name = String(username).trim().toLowerCase();
    const user = DB.users().find(u => u.username === name && u.active);
    if (!user || this.hashPw(user.salt, password) !== user.hash) {
      this.fail('login');
      logAction('Security', 'Failed login', 'Username: ' + name, { username: name, name: name, idNo: '', role: '' });
      const after = this.lockLeft('login');
      return { error: after ? 'Too many failed attempts. Try again in ' + after + ' seconds.' : 'Incorrect username or password.' };
    }
    this.clearFails('login');
    const session = { username: user.username, last: Date.now() };
    try { sessionStorage.setItem(KEYS.session, JSON.stringify(session)); } catch (e) { return { error: 'Could not start a session. Check that browser storage is allowed.' }; }
    logAction('Security', 'Login', '', { username: user.username, name: user.name, idNo: user.idNo, role: user.role });
    return { user: this.current() };
  },
  peek() {
    const s = this.readSession();
    if (!s) return null;
    const u = DB.users().find(x => x.username === s.username);
    return u ? { username: u.username, name: u.name, idNo: u.idNo, role: u.role } : null;
  },
  current() {
    const s = this.readSession();
    if (!s) return null;
    if (Date.now() - s.last > this.idleLimit) {
      this.end();
      flash('You were logged out because of inactivity.', 'error');
      return null;
    }
    const u = DB.users().find(x => x.username === s.username);
    if (!u || !u.active) { this.end(); return null; }
    return { username: u.username, name: u.name, idNo: u.idNo, role: u.role };
  },
  touch() {
    const s = this.readSession();
    if (!s || Date.now() - s.last < 5000) return;
    s.last = Date.now();
    try { sessionStorage.setItem(KEYS.session, JSON.stringify(s)); } catch (e) { }
  },
  logout() {
    const u = this.peek();
    if (u) logAction('Security', 'Logout', '', u);
    this.end();
    location.href = 'index.html';
  },
  require(roles) {
    const user = this.current();
    if (!user) { location.replace('index.html'); return null; }
    if (roles && roles.indexOf(user.role) === -1) {
      flash('You do not have access to that page.', 'error');
      location.replace('dashboard.html');
      return null;
    }
    return user;
  },
  verifyOwner(password) {
    const left = this.lockLeft('owner');
    if (left) return { error: 'Too many wrong owner passwords. Try again in ' + left + ' seconds.' };
    const owner = DB.users().find(u => u.role === 'owner' && u.active && this.hashPw(u.salt, password) === u.hash);
    if (!owner) {
      this.fail('owner');
      const after = this.lockLeft('owner');
      return { error: after ? 'Too many wrong owner passwords. Try again in ' + after + ' seconds.' : 'The owner password is incorrect.' };
    }
    this.clearFails('owner');
    return { user: { username: owner.username, name: owner.name, idNo: owner.idNo, role: owner.role } };
  },
  changePassword(username, current, next) {
    const users = DB.users();
    const u = users.find(x => x.username === username);
    if (!u || this.hashPw(u.salt, current) !== u.hash) return false;
    u.salt = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    u.hash = this.hashPw(u.salt, next);
    return DB.saveUsers(users);
  }
};

function openModal({ title, body, actions = [], wide = false, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = 'modal' + (wide ? ' wide' : '');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<h3>' + esc(title) + '</h3><div class="modal-body"></div><div class="modal-actions"></div>';
  const bodyEl = $('.modal-body', box);
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  hydrateIcons(box);

  let closed = false;
  function onKey(e) { if (e.key === 'Escape') api.close(); }
  const api = {
    el: box,
    close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      if (onClose) onClose();
    }
  };
  let primaryBtn = null;
  actions.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.className || 'btn-outline');
    b.textContent = a.label;
    b.addEventListener('click', () => (a.onClick ? a.onClick(api) : api.close()));
    $('.modal-actions', box).appendChild(b);
    if (a.primary) primaryBtn = b;
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' && primaryBtn && e.target.tagName === 'INPUT') { e.preventDefault(); primaryBtn.click(); }
  });
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) api.close(); });
  document.addEventListener('keydown', onKey);
  const first = $('input, select, textarea', bodyEl) || primaryBtn;
  if (first) setTimeout(() => first.focus(), 0);
  return api;
}

function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    let answered = false;
    const done = v => { if (!answered) { answered = true; resolve(v); } };
    openModal({
      title,
      body: '<p class="modal-text">' + esc(message) + '</p>',
      onClose: () => done(false),
      actions: [
        { label: 'Cancel' },
        { label: confirmText, className: danger ? 'btn-danger' : 'btn-primary', primary: true, onClick: api => { done(true); api.close(); } }
      ]
    });
  });
}

function fieldHtml(f) {
  if (f.section) return '<h4 class="form-section">' + esc(f.section) + '</h4>' + (f.note ? '<p class="hint">' + esc(f.note) + '</p>' : '');
  const id = 'ff-' + f.id;
  let control;
  if (f.type === 'select') {
    control = '<select id="' + id + '" class="input">' +
      f.options.map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(f.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
  } else if (f.type === 'textarea') {
    control = '<textarea id="' + id + '" class="textarea short" maxlength="200" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
  } else {
    control = '<input id="' + id + '" class="input" type="' + (f.type || 'text') + '" autocomplete="off" placeholder="' + esc(f.placeholder || '') + '"' +
      ' value="' + esc(f.value == null ? '' : f.value) + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.step ? ' step="' + f.step + '"' : '') +
      (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + '>';
  }
  return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label>' + control + (f.hint ? '<p class="hint">' + esc(f.hint) + '</p>' : '') + '</div>';
}

function formDialog({ title, introHtml = '', fields = [], submitText = 'Submit', danger = false, validate, wide = false }) {
  return new Promise(resolve => {
    let settled = false;
    const finish = v => { if (!settled) { settled = true; resolve(v); } };
    const body = document.createElement('div');
    body.className = 'form-stack';
    body.innerHTML = introHtml + fields.map(fieldHtml).join('') + '<p class="form-error hidden" id="ffErr" role="alert"></p>';
    const err = $('#ffErr', body);
    $$('input, textarea, select', body).forEach(el => el.addEventListener('input', () => err.classList.add('hidden')));
    openModal({
      title, body, wide,
      onClose: () => finish(null),
      actions: [
        { label: 'Cancel' },
        {
          label: submitText, className: danger ? 'btn-danger' : 'btn-primary', primary: true,
          onClick: modal => {
            const values = {};
            fields.forEach(f => { if (!f.section) values[f.id] = $('#ff-' + f.id, body).value; });
            const problem = validate ? validate(values) : null;
            if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
            finish(values);
            modal.close();
          }
        }
      ]
    });
  });
}

function detailsTable(rows) {
  return '<div class="table-card"><table class="mini-table details"><tbody>' +
    rows.map(r => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table></div>';
}

function renderPagination(el, page, pages, onChange) {
  el.innerHTML = '';
  if (pages <= 1) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const make = (label, target, opts = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (opts.active) { b.classList.add('active'); b.setAttribute('aria-current', 'page'); }
    if (opts.aria) b.setAttribute('aria-label', opts.aria);
    b.disabled = !!opts.disabled;
    b.addEventListener('click', () => onChange(target));
    el.appendChild(b);
  };
  make('‹', page - 1, { disabled: page === 1, aria: 'Previous page' });
  const shown = Array.from(new Set([1, pages, page - 1, page, page + 1]))
    .filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  let prev = 0;
  shown.forEach(n => {
    if (n - prev > 1) {
      const gap = document.createElement('span');
      gap.className = 'pager-gap';
      gap.textContent = '…';
      el.appendChild(gap);
    }
    make(String(n), n, { active: n === page, aria: 'Page ' + n });
    prev = n;
  });
  make('›', page + 1, { disabled: page === pages, aria: 'Next page' });
}

function buildSidebar(active, user) {
  const host = document.getElementById('sidebar');
  if (!host) return;
  const pending = DB.pendingCount(user.role === 'owner' ? null : user.username);
  const links = NAV.filter(n => n.roles.indexOf(user.role) !== -1).map(n => {
    const label = user.role === 'staff' && n.staffLabel ? n.staffLabel : n.label;
    const count = n.badge && pending ? '<span class="count">' + pending + '</span>' : '';
    return '<a href="' + n.href + '"' + (n.key === active ? ' class="active" aria-current="page"' : '') + '>' + esc(label) + count + '</a>';
  }).join('');
  host.innerHTML =
    '<a class="brand" href="dashboard.html"><span class="brand-mark">' + icon('box', 24, 1.75) + '</span><span>Sales &amp; Inventory</span></a>' +
    '<nav class="nav" aria-label="Main">' + links + '</nav>';
}

function buildUserMenu(user) {
  const host = document.getElementById('userMenu');
  if (!host) return;
  const isOwner = user.role === 'owner';
  host.innerHTML =
    '<div class="user-menu">' +
      '<button type="button" class="user-btn" id="userBtn" aria-haspopup="true" aria-expanded="false">' +
        '<span class="avatar" data-icon="user" data-size="16"></span>' +
        '<span>' + esc(user.name) + '</span>' +
        '<span data-icon="down" data-size="16"></span>' +
      '</button>' +
      '<div class="menu-pop hidden" id="userPop" role="menu">' +
        '<div class="menu-head"><strong>' + esc(user.name) + '</strong><small>' + (isOwner ? 'Owner' : 'Staff') + ' · ID ' + esc(user.idNo) + '</small></div>' +
        '<button type="button" class="menu-item" id="changePw" role="menuitem">Change password</button>' +
        (isOwner ? '<button type="button" class="menu-item" id="resetData" role="menuitem">Reset sample data</button>' : '') +
        '<button type="button" class="menu-item" id="logoutBtn" role="menuitem">' + icon('logout', 16) + ' Logout</button>' +
      '</div>' +
    '</div>';
  hydrateIcons(host);
  const btn = $('#userBtn', host), pop = $('#userPop', host);
  const setOpen = open => { pop.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', e => { e.stopPropagation(); setOpen(pop.classList.contains('hidden')); });
  document.addEventListener('click', e => { if (!host.contains(e.target)) setOpen(false); });
  $('#logoutBtn', host).addEventListener('click', () => Auth.logout());

  $('#changePw', host).addEventListener('click', async () => {
    setOpen(false);
    const v = await formDialog({
      title: 'Change password',
      fields: [
        { id: 'cur', label: 'Current password', type: 'password' },
        { id: 'next', label: 'New password', type: 'password', hint: 'At least 6 characters.' },
        { id: 'again', label: 'Confirm new password', type: 'password' }
      ],
      submitText: 'Save password',
      validate: v => {
        if (!v.cur) return 'Enter your current password.';
        if (v.next.length < 6) return 'The new password must be at least 6 characters.';
        if (v.next !== v.again) return 'The new passwords do not match.';
        if (!Auth.changePassword(user.username, v.cur, v.next)) return 'The current password is incorrect.';
        return null;
      }
    });
    if (v) { logAction('Security', 'Changed own password', '', user); toast('Password changed.'); }
  });

  const reset = $('#resetData', host);
  if (reset) reset.addEventListener('click', async () => {
    setOpen(false);
    const ok = await confirmDialog({
      title: 'Reset sample data?',
      message: 'This replaces all products, sales, requests and the activity log with the original sample data. Staff accounts are kept.',
      confirmText: 'Reset', danger: true
    });
    if (!ok) return;
    seedBusinessData();
    logAction('Security', 'Reset sample data', '', user);
    flash('Sample data restored.');
    location.reload();
  });
}

function startIdleWatch() {
  ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, () => Auth.touch(), { passive: true }));
  setInterval(() => {
    const s = Auth.readSession();
    if (!s) { location.replace('index.html'); return; }
    if (Date.now() - s.last > Auth.idleLimit) {
      Auth.end();
      flash('You were logged out because of inactivity.', 'error');
      location.replace('index.html');
    }
  }, 5000);
}

function buildNavToggle() {
  const app = $('.app'), top = $('.topbar');
  if (!app || !top || $('#navToggle')) return;
  let hidden = false;
  try {
    const saved = localStorage.getItem(KEYS.nav);
    hidden = saved === null ? window.matchMedia('(max-width: 900px)').matches : saved === 'hidden';
  } catch (e) { }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'navToggle';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-controls', 'sidebar');
  btn.innerHTML = icon('menu', 22);
  const set = h => {
    app.classList.toggle('nav-hidden', h);
    btn.setAttribute('aria-expanded', String(!h));
    btn.setAttribute('aria-label', h ? 'Show menu' : 'Hide menu');
    btn.title = h ? 'Show menu' : 'Hide menu';
    try { localStorage.setItem(KEYS.nav, h ? 'hidden' : 'shown'); } catch (e) { }
  };
  btn.addEventListener('click', () => set(!app.classList.contains('nav-hidden')));
  const left = document.createElement('div');
  left.className = 'topbar-left';
  const first = top.firstElementChild;
  left.appendChild(btn);
  if (first) left.appendChild(first);
  top.insertBefore(left, top.firstChild);
  set(hidden);
}

function initLayout({ active, roles } = {}) {
  const user = Auth.require(roles);
  if (!user) return null;
  buildSidebar(active, user);
  buildUserMenu(user);
  buildNavToggle();
  hydrateIcons();
  const h1 = $('.topbar h1');
  if (h1) document.title = h1.textContent + ' · Sales & Inventory';
  showFlash();
  startIdleWatch();
  return user;
}