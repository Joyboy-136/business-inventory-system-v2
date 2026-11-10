(function () {
  const user = initLayout({ active: 'add' });
  if (!user) return;
  const isOwner = user.role === 'owner';

  const editId = new URLSearchParams(location.search).get('id');
  let editing = null;
  if (editId) {
    editing = DB.find(editId);
    if (!editing || editing.archived) {
      flash('That product was not found.', 'error');
      location.replace('products.html');
      return;
    }
  }
  if (!isOwner) $('#staffNote').classList.remove('hidden');

  const f = {
    name: $('#pName'), category: $('#pCategory'), price: $('#pPrice'), cost: $('#pCost'), barcode: $('#pBarcode'),
    qty: $('#pQty'), desc: $('#pDesc'), upload: $('#upload'), file: $('#fileInput')
  };
  let image = editing ? (editing.image || '') : '';

  const cats = CATEGORIES.slice();
  if (editing && cats.indexOf(editing.category) === -1) cats.push(editing.category);
  f.category.innerHTML = '<option value="" disabled selected>Select category</option>' +
    cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');

  if (editing) {
    $('#pageTitle').textContent = 'Edit Product';
    document.title = 'Edit Product · Sales & Inventory';
    f.name.value = editing.name;
    f.category.value = editing.category;
    f.price.value = editing.price;
    f.cost.value = editing.cost || 0;
    f.barcode.value = editing.barcode || '';
    f.qty.value = editing.stock;
    f.qty.disabled = true;
    $('#qtyHint').classList.remove('hidden');
    f.desc.value = editing.description || '';
    if (!isOwner) $('#costField').classList.add('hidden');
  }

  function drawUpload() {
    if (image) {
      f.upload.innerHTML = '<img src="' + esc(image) + '" alt="Product image preview"><span>Click to change image</span>' +
        '<button type="button" class="link-btn" id="removeImg">Remove image</button>';
      $('#removeImg').addEventListener('click', e => { e.stopPropagation(); image = ''; drawUpload(); });
    } else {
      f.upload.innerHTML = '<span data-icon="upload" data-size="26"></span><span>Upload product image</span><small>(optional)</small>';
      hydrateIcons(f.upload);
    }
  }
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Image is too large (max 5 MB).'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that image.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not read that image.'));
        img.onload = () => {
          const scale = Math.min(1, 400 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  async function handleFile(file) {
    if (!file) return;
    setError('image', '');
    try { image = await readImage(file); drawUpload(); }
    catch (err) { setError('image', err.message); }
    f.file.value = '';
  }
  f.upload.addEventListener('click', () => f.file.click());
  f.upload.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.file.click(); } });
  f.file.addEventListener('change', () => handleFile(f.file.files[0]));
  ['dragover', 'dragenter'].forEach(ev => f.upload.addEventListener(ev, e => { e.preventDefault(); f.upload.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => f.upload.addEventListener(ev, e => { e.preventDefault(); f.upload.classList.remove('drag'); }));
  f.upload.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
  drawUpload();

  function setError(key, msg) {
    const el = document.getElementById('err-' + key);
    if (el) el.textContent = msg;
  }
  function mark(el, bad) { el.classList.toggle('invalid', !!bad); }
  function validate() {
    let ok = true;
    ['pName', 'pCategory', 'pPrice', 'pCost', 'pBarcode', 'pQty', 'image'].forEach(k => setError(k, ''));
    [f.name, f.category, f.qty, f.barcode].forEach(el => mark(el, false));
    mark($('#priceGroup'), false);
    mark($('#costGroup'), false);

    const name = f.name.value.trim();
    if (!name) { setError('pName', 'Product name is required.'); mark(f.name, true); ok = false; }
    else if (productConflict({ name }, editing ? editing.id : null)) {
      setError('pName', 'A product with this name already exists (it may be archived).'); mark(f.name, true); ok = false;
    }
    if (!f.category.value) { setError('pCategory', 'Please select a category.'); mark(f.category, true); ok = false; }

    const price = Number(f.price.value);
    if (f.price.value.trim() === '' || !isFinite(price) || price <= 0) {
      setError('pPrice', 'Enter a price greater than 0.'); mark($('#priceGroup'), true); ok = false;
    }
    if (isOwner || !editing) {
      const cost = Number(f.cost.value);
      if (f.cost.value.trim() === '' || !isFinite(cost) || cost < 0) {
        setError('pCost', 'Enter the cost (0 or more).'); mark($('#costGroup'), true); ok = false;
      }
    }
    const barcode = f.barcode.value.trim();
    if (barcode && productConflict({ barcode }, editing ? editing.id : null)) {
      setError('pBarcode', 'This barcode is already used by another product.'); mark(f.barcode, true); ok = false;
    }
    if (!editing) {
      const qty = Number(f.qty.value);
      if (f.qty.value.trim() === '' || !Number.isInteger(qty) || qty < 0) {
        setError('pQty', 'Enter a whole number, 0 or more.'); mark(f.qty, true); ok = false;
      }
    }
    return ok;
  }

  $('#productForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) {
      const firstBad = $('.invalid input, input.invalid, select.invalid');
      if (firstBad) firstBad.focus();
      return;
    }
    const data = {
      name: f.name.value.trim(),
      category: f.category.value,
      price: round2(Number(f.price.value)),
      barcode: f.barcode.value.trim(),
      description: f.desc.value.trim(),
      image
    };
    let result;
    if (editing) {
      if (isOwner) data.cost = round2(Number(f.cost.value));
      const changes = {}, before = {};
      Object.keys(data).forEach(k => {
        const old = k === 'description' || k === 'barcode' || k === 'image' ? (editing[k] || '') : editing[k];
        if (data[k] !== old) { changes[k] = data[k]; before[k] = old; }
      });
      if (!Object.keys(changes).length) { toast('No changes to save.', 'error'); return; }
      result = await submitChange('product.edit', { id: editing.id, changes, before }, { title: 'Save changes', showDetails: true });
    } else {
      data.cost = round2(Number(f.cost.value));
      data.stock = Number(f.qty.value);
      result = await submitChange('product.add', { data }, { title: 'Add product', showDetails: true });
    }
    if (result.status === 'applied') { flash(result.message); location.href = 'products.html'; }
    else if (result.status === 'pending') { flash('Request sent. The owner needs to approve it.'); location.href = 'products.html'; }
  });

  $('#cancelBtn').addEventListener('click', async () => {
    const changed = !editing
      ? (f.name.value.trim() || f.price.value || f.cost.value || f.barcode.value.trim() || f.qty.value || f.desc.value.trim() || image || f.category.value)
      : (f.name.value.trim() !== editing.name || Number(f.price.value) !== editing.price || Number(f.cost.value) !== (editing.cost || 0) ||
         f.barcode.value.trim() !== (editing.barcode || '') || f.category.value !== editing.category ||
         f.desc.value.trim() !== (editing.description || '') || image !== (editing.image || ''));
    if (changed) {
      const ok = await confirmDialog({ title: 'Discard changes?', message: 'You have unsaved changes. Leave this page without saving?', confirmText: 'Discard', danger: true });
      if (!ok) return;
    }
    location.href = 'products.html';
  });
})();