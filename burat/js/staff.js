(function () {
  const user = initLayout({ active: 'staff', roles: ['owner'] });
  if (!user) return;

  const state = { q: '', page: 1 };
  const tbody = $('#tbody');
  const pager = $('#pager');
  const search = $('#search');
  const clearBtn = $('#clearSearch');

  function matching() {
    const q = state.q.trim().toLowerCase();
    return DB.users().filter(u => u.role === 'staff' && (!q || [u.name, u.idNo, u.username].some(v => String(v).toLowerCase().includes(q))));
  }

  function render() {
    const list = matching();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    tbody.innerHTML = slice.length ? slice.map(u =>
      '<tr><td>' + esc(u.idNo) + '</td><td>' + esc(u.name) + '</td><td>' + esc(u.username) + '</td><td>Staff</td>' +
      '<td><span class="badge ' + (u.active ? 'badge-in' : 'badge-out') + '">' + (u.active ? 'Active' : 'Deactivated') + '</span></td>' +
      '<td><div class="cell-actions">' +
        '<button type="button" class="icon-btn" data-act="edit" data-u="' + esc(u.username) + '" aria-label="Edit ' + esc(u.name) + '" title="Edit">' + icon('pencil', 18) + '</button>' +
        '<button type="button" class="icon-btn' + (u.active ? ' danger' : '') + '" data-act="toggle" data-u="' + esc(u.username) + '" aria-label="' + (u.active ? 'Deactivate ' : 'Activate ') + esc(u.name) + '" title="' + (u.active ? 'Deactivate' : 'Activate') + '">' + icon(u.active ? 'ban' : 'check', 18) + '</button>' +
      '</div></td></tr>').join('')
      : '<tr><td class="empty" colspan="6">' + (state.q.trim() ? 'No staff match “' + esc(state.q.trim()) + '”.' : 'No staff yet.') + '</td></tr>';
    renderPagination(pager, state.page, pages, n => { state.page = n; render(); });
  }

  search.addEventListener('input', () => { state.q = search.value; state.page = 1; clearBtn.classList.toggle('hidden', !search.value); render(); });
  clearBtn.addEventListener('click', () => { search.value = ''; state.q = ''; state.page = 1; clearBtn.classList.add('hidden'); render(); search.focus(); });

  function taken(field, value, ignoreUser) {
    return DB.users().some(u => u.username !== ignoreUser && String(u[field]).toLowerCase() === String(value).trim().toLowerCase());
  }

  $('#addStaff').addEventListener('click', async () => {
    const v = await formDialog({
      title: 'Add staff', submitText: 'Add staff',
      fields: [
        { id: 'name', label: 'Full name', maxlength: 60 },
        { id: 'idNo', label: 'ID number', placeholder: 'e.g. STF-002', maxlength: 20 },
        { id: 'username', label: 'Username', hint: 'Letters, numbers, dot or underscore.', maxlength: 20 },
        { id: 'password', label: 'Password', type: 'password', hint: 'At least 6 characters.' }
      ],
      validate: v => {
        if (!v.name.trim()) return 'Enter the staff member’s name.';
        if (!v.idNo.trim()) return 'Enter an ID number.';
        if (taken('idNo', v.idNo)) return 'That ID number is already used.';
        if (!/^[a-z0-9._]{3,20}$/i.test(v.username.trim())) return 'Username must be 3–20 letters, numbers, dots or underscores.';
        if (taken('username', v.username)) return 'That username is already taken.';
        if (v.password.length < 6) return 'The password must be at least 6 characters.';
        return null;
      }
    });
    if (!v) return;
    const users = DB.users();
    users.push(makeUser(v.idNo.trim(), v.name.trim(), v.username.trim().toLowerCase(), 'staff', v.password));
    if (!DB.saveUsers(users)) return;
    logAction('Staff', 'Added staff', v.name.trim() + ' (ID ' + v.idNo.trim() + ')', user);
    toast('Staff added.');
    render();
  });

  tbody.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const users = DB.users();
    const u = users.find(x => x.username === btn.dataset.u && x.role === 'staff');
    if (!u) { render(); return; }

    if (btn.dataset.act === 'edit') {
      const v = await formDialog({
        title: 'Edit staff', submitText: 'Save',
        fields: [
          { id: 'name', label: 'Full name', value: u.name, maxlength: 60 },
          { id: 'idNo', label: 'ID number', value: u.idNo, maxlength: 20 },
          { id: 'password', label: 'New password (optional)', type: 'password', hint: 'Leave blank to keep the current password.' }
        ],
        validate: v => {
          if (!v.name.trim()) return 'Enter the staff member’s name.';
          if (!v.idNo.trim()) return 'Enter an ID number.';
          if (taken('idNo', v.idNo, u.username)) return 'That ID number is already used.';
          if (v.password && v.password.length < 6) return 'The password must be at least 6 characters.';
          return null;
        }
      });
      if (!v) return;
      const fresh = DB.users();
      const t = fresh.find(x => x.username === u.username);
      t.name = v.name.trim();
      t.idNo = v.idNo.trim();
      if (v.password) { t.salt = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10); t.hash = Auth.hashPw(t.salt, v.password); }
      if (!DB.saveUsers(fresh)) return;
      logAction('Staff', 'Edited staff', t.name + ' (ID ' + t.idNo + ')' + (v.password ? ' · password reset' : ''), user);
      toast('Staff updated.');
      render();
    } else {
      const ok = await confirmDialog({
        title: u.active ? 'Deactivate staff?' : 'Activate staff?',
        message: u.active ? u.name + ' will no longer be able to log in. Their past records are kept.' : u.name + ' will be able to log in again.',
        confirmText: u.active ? 'Deactivate' : 'Activate', danger: u.active
      });
      if (!ok) return;
      u.active = !u.active;
      if (!DB.saveUsers(users)) return;
      logAction('Staff', u.active ? 'Activated staff' : 'Deactivated staff', u.name + ' (ID ' + u.idNo + ')', user);
      toast(u.active ? 'Staff activated.' : 'Staff deactivated.');
      render();
    }
  });

  render();
})();