/* ==========================================================================
   Admin dashboard (single page, hash routing). Every number and row comes
   from /api/admin/* — the server re-checks the admin role on each request.
   ========================================================================== */
EC.page(async ({ user }) => {
  const { $, $$, esc } = EC;
  if (!user || user.role !== 'admin') { location.replace('admin-login.html'); return; }

  $('#adminName').textContent = user.name;
  $('#adminEmail').textContent = user.email;
  $('#adminAvatar').textContent = EC.initials(user.name);
  $('#logoutBtn').addEventListener('click', () => EC.logout('admin-login.html'));
  const side = $('#adminSide');
  $('#sideToggle').addEventListener('click', () => { const open = side.classList.toggle('open'); $('#sideToggle').setAttribute('aria-expanded', open); });

  const view = $('#view');
  const drawerEl = $('#drawer');
  const drawer = new bootstrap.Offcanvas(drawerEl);
  const meta = await EC.meta();
  const catLabel = Object.fromEntries(meta.grievanceCategories.map((c) => [c.key, c.label]));
  let admins = null;

  const qs = (obj) => { const p = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v); }); return p.toString(); };
  const opt = (items, value, placeholder) => `${placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : ''}${items.map((i) => { const o = typeof i === 'object' ? i : { value: i, label: i }; return `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`; }).join('')}`;
  const tableWrap = (head, rows, emptyMsg) => (rows.length
    ? `<div class="table-wrap"><div class="table-responsive"><table class="table table-hover align-middle"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`
    : EC.state({ icon: 'bi-inbox', title: emptyMsg || 'Nothing to show', text: 'Try changing the filters.' }));
  const openDrawer = (title, html) => { $('#drawerTitle').textContent = title; $('#drawerBody').innerHTML = html; drawer.show(); };
  const userStatusBadge = (s) => (s === 'disabled' ? EC.badge('b-red', 'bi-slash-circle', 'Disabled') : EC.badge('b-green', 'bi-check-circle', 'Active'));
  const modBadge = (r) => (r.moderation && r.moderation.state === 'disabled' ? EC.badge('b-red', 'bi-slash-circle', 'Disabled') : (r.deleted ? EC.badge('b-grey', 'bi-trash', 'Deleted by owner') : ''));

  /* ------------------------------------------------------------ badges */
  async function refreshBadges() {
    try {
      const s = await EC.api('/admin/stats');
      Object.entries({ reportedListings: s.totals.reportedListings, pendingLocations: s.totals.pendingLocations, openGrievances: s.totals.openGrievances }).forEach(([k, v]) => {
        const el = document.querySelector(`[data-badge="${k}"]`);
        el.textContent = v; el.classList.toggle('d-none', !v);
      });
      return s;
    } catch (_) { return null; }
  }

  /* ========================================================== Overview */
  async function overview() {
    view.innerHTML = EC.loadingBlock('Loading dashboard…');
    const [s, act, locs, grv] = await Promise.all([
      refreshBadges(),
      EC.api('/admin/activity?excludeLogins=true&limit=10'),
      EC.api('/admin/locations?status=Pending&limit=5'),
      EC.api('/admin/grievances?status=Open&limit=5'),
    ]);
    if (!s) throw new Error('Could not load statistics.');
    const t = s.totals;
    const kpi = (href, icon, label, val, sub, attn) => `<a class="kpi${attn ? ' attn' : ''}" href="${href}"><div class="lbl"><i class="bi ${icon}" aria-hidden="true"></i>${label}</div><div class="val">${Number(val).toLocaleString('en-IN')}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</a>`;
    const maxBar = (obj) => Math.max(1, ...Object.values(obj));
    const bars = (obj, keys) => {
      const m = maxBar(obj);
      return `<div class="bar-chart">${keys.map((k) => `<div class="bar-row"><span class="truncate">${esc(k)}</span><div class="bar-track" role="presentation"><div class="bar-fill" style="width:${((obj[k] || 0) / m) * 100}%"></div></div><span class="v">${obj[k] || 0}</span></div>`).join('')}</div>`;
    };
    const wMax = Math.max(1, ...s.weekly.map((w) => Math.max(w.listings, w.requests)));
    const weekLabel = (d) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(d));
    const feedIcon = (a) => ({ resource: 'bi-box-seam', request: 'bi-arrow-left-right', location: 'bi-geo-alt', grievance: 'bi-flag', user: 'bi-person', board: 'bi-megaphone' })[a.targetType] || 'bi-activity';

    view.innerHTML = `
      <div class="kpi-grid mb-4">
        ${kpi('#users', 'bi-people', 'Registered users', t.users, `${t.students} students${t.disabledUsers ? ` · ${t.disabledUsers} disabled` : ''}`)}
        ${kpi('#resources', 'bi-box-seam', 'Active resources', t.activeResources, 'Available or reserved')}
        ${kpi('#requests?status=Pending', 'bi-hourglass-split', 'Pending requests', t.pendingRequests, 'Waiting for owners')}
        ${kpi('#requests?status=Completed', 'bi-check2-circle', 'Completed exchanges', t.completedExchanges, '')}
        ${kpi('#locations?status=Pending', 'bi-geo-alt', 'Pending location approvals', t.pendingLocations, 'Need your review', t.pendingLocations > 0)}
        ${kpi('#grievances', 'bi-flag', 'Open grievances', t.openGrievances, t.highPriorityOpen ? `${t.highPriorityOpen} high priority` : 'Open or in review', t.highPriorityOpen > 0)}
        ${t.reportedListings ? kpi('#resources?reported=true', 'bi-exclamation-octagon', 'Reported listings', t.reportedListings, 'Need review', true) : ''}
      </div>

      <div class="row g-4">
        <div class="col-xl-8">
          <div class="panel">
            <div class="d-flex justify-content-between flex-wrap gap-2 mb-2"><h2 class="panel-title mb-0">Activity in the last 8 weeks</h2>
              <div class="legend"><span style="--c:var(--ec-ink-3)">New listings</span><span style="--c:var(--ec-crimson)">Requests</span></div></div>
            <div class="col-chart" role="img" aria-label="Weekly new listings and requests for the last 8 weeks">
              ${s.weekly.map((w) => `<div class="col" title="Week of ${weekLabel(w.weekStart)}: ${w.listings} listings, ${w.requests} requests, ${w.completed} completed">
                <div class="d-flex align-items-end gap-1 w-100 justify-content-center" style="height:100%">
                  <div class="seg l" style="height:${(w.listings / wMax) * 100}%"></div><div class="seg r" style="height:${(w.requests / wMax) * 100}%"></div>
                </div><span class="lbl">${weekLabel(w.weekStart)}</span></div>`).join('')}
            </div>
            <table class="visually-hidden"><caption>Weekly activity</caption><thead><tr><th>Week starting</th><th>Listings</th><th>Requests</th><th>Completed</th></tr></thead><tbody>${s.weekly.map((w) => `<tr><td>${weekLabel(w.weekStart)}</td><td>${w.listings}</td><td>${w.requests}</td><td>${w.completed}</td></tr>`).join('')}</tbody></table>
          </div>
          <div class="row g-4 mt-0">
            <div class="col-md-6"><div class="panel h-100"><h2 class="panel-title">Requests by status</h2>${bars(s.requestsByStatus, meta.requestStatuses)}</div></div>
            <div class="col-md-6"><div class="panel h-100"><h2 class="panel-title">Listings by category</h2>${bars(s.resourcesByCategory, meta.categories)}</div></div>
          </div>
        </div>
        <div class="col-xl-4">
          <div class="panel">
            <div class="d-flex justify-content-between"><h2 class="panel-title">Needs review</h2></div>
            <h3 class="h5 small text-muted text-uppercase">Pending locations</h3>
            ${locs.items.length ? `<ul class="feed mb-3">${locs.items.map((l) => `<li><span class="ico"><i class="bi bi-geo-alt" aria-hidden="true"></i></span><div class="min-w-0"><button class="btn btn-link btn-sm p-0 text-start" data-open-location="${l.id}">${esc(l.name)}</button><div class="meta">${l.proposedBy ? `by ${esc(l.proposedBy.name)}` : 'Imported'} · ${EC.timeAgo(l.createdAt)}</div></div></li>`).join('')}</ul>` : '<p class="small text-muted">No locations waiting.</p>'}
            <h3 class="h5 small text-muted text-uppercase mt-3">Open grievances</h3>
            ${grv.items.length ? `<ul class="feed mb-0">${grv.items.map((g) => `<li><span class="ico"><i class="bi bi-flag" aria-hidden="true"></i></span><div class="min-w-0"><button class="btn btn-link btn-sm p-0 text-start" data-open-grievance="${g.id}">${esc(g.subject)}</button><div class="meta">${esc(g.reference)} · ${EC.timeAgo(g.createdAt)} ${EC.priorityBadge(g.priority)}</div></div></li>`).join('')}</ul>` : '<p class="small text-muted mb-0">No open grievances.</p>'}
          </div>
          <div class="panel">
            <div class="d-flex justify-content-between align-items-center"><h2 class="panel-title mb-2">Recent activity</h2><a class="small" href="#activity">View all</a></div>
            ${act.items.length ? `<ul class="feed">${act.items.map((a) => `<li><span class="ico"><i class="bi ${feedIcon(a)}" aria-hidden="true"></i></span><div><div>${esc(a.summary)}</div><div class="meta">${EC.timeAgo(a.createdAt)}</div></div></li>`).join('')}</ul>` : '<p class="small text-muted mb-0">No activity yet.</p>'}
          </div>
        </div>
      </div>`;
  }

  /* ========================================================= Resources */
  async function resources(params) {
    const f = { q: params.get('q') || '', category: params.get('category') || '', status: params.get('status') || '', moderation: params.get('moderation') || '', reported: params.get('reported') || '', page: Number(params.get('page')) || 1 };
    view.innerHTML = `
      <form class="toolbar" id="filterForm">
        <div class="search-input" style="min-width:240px;flex:1;max-width:380px"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="fq">Search</label><input class="form-control form-control-sm" id="fq" name="q" placeholder="Search title, owner name or email" value="${esc(f.q)}"></div>
        <div class="d-flex flex-wrap gap-2">
          <label class="visually-hidden" for="fcat">Category</label><select class="form-select form-select-sm" id="fcat" name="category" style="width:auto">${opt(meta.categories, f.category, 'All categories')}</select>
          <label class="visually-hidden" for="fst">Availability</label><select class="form-select form-select-sm" id="fst" name="status" style="width:auto">${opt(['Available', 'Reserved', 'Unavailable'], f.status, 'Any availability')}</select>
          <label class="visually-hidden" for="fmod">Moderation</label><select class="form-select form-select-sm" id="fmod" name="moderation" style="width:auto">${opt([{ value: 'active', label: 'Visible' }, { value: 'disabled', label: 'Disabled by admin' }], f.moderation, 'Any visibility')}</select>
          <div class="form-check form-switch mb-0 align-self-center"><input class="form-check-input" type="checkbox" role="switch" id="frep" name="reported" value="true" ${f.reported ? 'checked' : ''}><label class="form-check-label small" for="frep">Reported only</label></div>
        </div>
      </form>
      <div id="tbl">${EC.loadingBlock()}</div><div class="mt-3" id="pager"></div>`;
    bindFilters('resources', f);
    const data = await EC.api(`/admin/resources?${qs({ ...f, sort: f.reported ? 'reports' : '' })}`);
    $('#tbl').innerHTML = tableWrap(['Listing', 'Owner', 'Type', 'Availability', 'Visibility', 'Reports', 'Listed', ''], data.items.map((r) => `
      <tr>
        <td><button class="btn btn-link p-0 text-start row-link" data-open-resource="${r.id}">${esc(r.title)}</button><div class="meta">${esc(r.category)} · ${esc(r.location ? r.location.name : '')}</div></td>
        <td><div>${esc(r.owner.name)}</div><div class="meta">${esc(r.owner.email || '')}</div></td>
        <td>${EC.typeBadge(r.type)}</td>
        <td>${EC.resourceStatusBadge(r.status)}</td>
        <td>${modBadge(r) || EC.badge('b-green', 'bi-eye', 'Visible')}</td>
        <td>${r.reportCount ? EC.badge('b-red', 'bi-flag-fill', String(r.reportCount)) : '<span class="text-muted">0</span>'}</td>
        <td class="small">${EC.fmtDate(r.createdAt)}</td>
        <td class="text-end"><button class="btn btn-outline-secondary btn-sm" data-open-resource="${r.id}">Review</button></td>
      </tr>`), 'No resources match');
    EC.renderPagination($('#pager'), data.pagination, (n) => go('resources', { ...f, page: n }));
  }

  async function openResource(id) {
    openDrawer('Listing', EC.loadingBlock());
    const { resource: r, requests, grievances } = await EC.api(`/admin/resources/${id}`);
    const disabled = r.moderation.state === 'disabled';
    $('#drawerTitle').textContent = r.title;
    $('#drawerBody').innerHTML = `
      <div class="d-flex flex-wrap gap-2 mb-3">${EC.typeBadge(r.type)}${EC.resourceStatusBadge(r.status)}${modBadge(r)}${r.reportCount ? EC.badge('b-red', 'bi-flag-fill', `${r.reportCount} report(s)`) : ''}</div>
      <p style="white-space:pre-line">${esc(r.description)}</p>
      <dl class="dl-grid mb-3">
        <dt>Owner</dt><dd>${esc(r.owner.name)}<span class="d-block small text-muted">${esc(r.owner.email || '')} ${r.owner.status === 'disabled' ? '· account disabled' : ''}</span></dd>
        <dt>Category</dt><dd>${esc(r.category)} · ${esc(r.condition)}</dd>
        <dt>Pickup point</dt><dd>${esc(r.location ? r.location.name : '—')} ${EC.locationStatusBadge(r.location)}</dd>
        <dt>Listed</dt><dd>${EC.fmtDateTime(r.createdAt)}</dd>
        ${disabled ? `<dt>Disabled</dt><dd>${esc(r.moderation.reason)}<span class="d-block small text-muted">${EC.fmtDateTime(r.moderation.at)}</span></dd>` : ''}
      </dl>
      ${r.deleted ? '<div class="alert alert-neutral"><i class="bi bi-trash" aria-hidden="true"></i><div>The owner deleted this listing.</div></div>' : `
      <div class="d-flex gap-2 mb-4">
        ${disabled ? `<button class="btn btn-primary btn-sm" data-moderate="${r.id}" data-state="active"><i class="bi bi-eye" aria-hidden="true"></i>Restore listing</button>`
          : `<button class="btn btn-outline-danger btn-sm" data-moderate="${r.id}" data-state="disabled"><i class="bi bi-slash-circle" aria-hidden="true"></i>Disable listing</button>`}
        <a class="btn btn-outline-secondary btn-sm" href="resource-details.html?id=${r.id}" target="_blank" rel="noopener">Open public page</a>
      </div>`}
      <h3 class="h5">Requests (${requests.length})</h3>
      ${requests.length ? `<ul class="feed mb-4">${requests.map((q) => `<li><div class="flex-grow-1"><div>${esc(q.requester.name)} ${EC.requestStatusBadge(q.status, q.resourceType)}</div><div class="meta">${EC.fmtDateTime(q.createdAt)}${q.location ? ` · ${esc(q.location.name)}` : ''}</div></div></li>`).join('')}</ul>` : '<p class="small text-muted">No requests.</p>'}
      <h3 class="h5">Grievances (${grievances.length})</h3>
      ${grievances.length ? `<ul class="feed">${grievances.map((g) => `<li><div><button class="btn btn-link btn-sm p-0 text-start" data-open-grievance="${g.id}">${esc(g.reference)}: ${esc(g.subject)}</button><div class="meta">${EC.grievanceStatusBadge(g.status)} ${EC.priorityBadge(g.priority)}</div></div></li>`).join('')}</ul>` : '<p class="small text-muted">No grievances.</p>'}`;
  }

  async function moderate(id, state) {
    const disabling = state === 'disabled';
    const ok = await EC.confirm(disabling
      ? { title: 'Disable this listing?', body: 'It will be hidden from Browse. Pending and accepted requests will be cancelled, and the owner and requesters notified.', confirmText: 'Disable listing', danger: true, reason: { label: 'Reason (shown to the owner)', required: true, min: 5, requiredMessage: 'Give a reason of at least 5 characters.' } }
      : { title: 'Restore this listing?', body: 'It will be visible in Browse again and its report count reset.', confirmText: 'Restore listing' });
    if (!ok) return;
    try {
      const res = await EC.api(`/admin/resources/${id}/moderation`, { method: 'PATCH', body: { state, reason: ok.reason || '' } });
      EC.toast(disabling ? `Listing disabled${res.cancelledRequests ? `; ${res.cancelledRequests} request(s) cancelled` : ''}.` : 'Listing restored.');
      openResource(id); route(); refreshBadges();
    } catch (err) { EC.toast(err.message, { error: true }); }
  }

  /* ============================================================= Users */
  async function users(params) {
    const f = { q: params.get('q') || '', role: params.get('role') || '', status: params.get('status') || '', page: Number(params.get('page')) || 1 };
    view.innerHTML = `
      <form class="toolbar" id="filterForm">
        <div class="search-input" style="min-width:240px;flex:1;max-width:380px"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="fq">Search users</label><input class="form-control form-control-sm" id="fq" name="q" placeholder="Search by name or email" value="${esc(f.q)}"></div>
        <div class="d-flex gap-2">
          <label class="visually-hidden" for="frole">Role</label><select class="form-select form-select-sm" id="frole" name="role" style="width:auto">${opt([{ value: 'student', label: 'Students' }, { value: 'admin', label: 'Administrators' }], f.role, 'All roles')}</select>
          <label class="visually-hidden" for="fstat">Status</label><select class="form-select form-select-sm" id="fstat" name="status" style="width:auto">${opt([{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }], f.status, 'Any status')}</select>
        </div>
      </form>
      <div id="tbl">${EC.loadingBlock()}</div><div class="mt-3" id="pager"></div>`;
    bindFilters('users', f);
    const data = await EC.api(`/admin/users?${qs(f)}`);
    $('#tbl').innerHTML = tableWrap(['Name', 'Email', 'Role', 'Department', 'Status', 'Joined', 'Last login', ''], data.items.map((u) => `
      <tr>
        <td><button class="btn btn-link p-0 text-start row-link" data-open-user="${u.id}">${esc(u.name)}</button>${u.isDemo ? ' <span class="badge-ec b-grey">Demo</span>' : ''}</td>
        <td class="small">${esc(u.email)}</td>
        <td>${u.role === 'admin' ? EC.badge('b-dark', 'bi-shield-lock', 'Admin') : EC.badge('b-grey', 'bi-person', 'Student')}</td>
        <td class="small">${esc(u.department || '—')}${u.semester ? ` · Sem ${u.semester}` : ''}</td>
        <td>${userStatusBadge(u.status)}</td>
        <td class="small">${EC.fmtDate(u.createdAt)}</td>
        <td class="small">${u.lastLoginAt ? EC.timeAgo(u.lastLoginAt) : 'Never'}</td>
        <td class="text-end"><button class="btn btn-outline-secondary btn-sm" data-open-user="${u.id}">View</button></td>
      </tr>`), 'No users match');
    EC.renderPagination($('#pager'), data.pagination, (n) => go('users', { ...f, page: n }));
  }

  async function openUser(id) {
    openDrawer('User', EC.loadingBlock());
    const { user: u, counts, recentActivity } = await EC.api(`/admin/users/${id}`);
    const self = u.id === user.id;
    $('#drawerTitle').textContent = u.name;
    $('#drawerBody').innerHTML = `
      <div class="d-flex gap-2 mb-3">${u.role === 'admin' ? EC.badge('b-dark', 'bi-shield-lock', 'Admin') : EC.badge('b-grey', 'bi-person', 'Student')}${userStatusBadge(u.status)}</div>
      <dl class="dl-grid mb-3">
        <dt>Email</dt><dd>${esc(u.email)}</dd>
        <dt>Department</dt><dd>${esc(u.department || '—')}${u.semester ? `, semester ${u.semester}` : ''}</dd>
        <dt>Joined</dt><dd>${EC.fmtDateTime(u.createdAt)}</dd>
        <dt>Last login</dt><dd>${u.lastLoginAt ? EC.fmtDateTime(u.lastLoginAt) : 'Never'}</dd>
        ${u.status === 'disabled' && u.statusReason ? `<dt>Disabled because</dt><dd>${esc(u.statusReason)}</dd>` : ''}
      </dl>
      <div class="kpi-grid mb-3" style="grid-template-columns:repeat(3,1fr)">
        <div class="kpi"><div class="lbl">Listings</div><div class="val">${counts.listings}</div></div>
        <div class="kpi"><div class="lbl">Requests made</div><div class="val">${counts.requestsMade}</div></div>
        <div class="kpi"><div class="lbl">Completed</div><div class="val">${counts.completed}</div></div>
        <div class="kpi"><div class="lbl">Requests received</div><div class="val">${counts.requestsReceived}</div></div>
        <div class="kpi"><div class="lbl">Grievances</div><div class="val">${counts.grievances}</div></div>
      </div>
      ${u.role === 'student' && !self ? `<div class="mb-4">${u.status === 'active'
        ? `<button class="btn btn-outline-danger btn-sm" data-user-status="${u.id}" data-to="disabled"><i class="bi bi-person-x" aria-hidden="true"></i>Disable account</button><div class="form-text">The student is signed out immediately and their listings are hidden from Browse.</div>`
        : `<button class="btn btn-primary btn-sm" data-user-status="${u.id}" data-to="active"><i class="bi bi-person-check" aria-hidden="true"></i>Re-activate account</button>`}</div>` : '<p class="small text-muted">Administrator accounts are managed with the <code>create-admin</code> script.</p>'}
      <h3 class="h5">Recent activity</h3>
      ${recentActivity.length ? `<ul class="timeline">${recentActivity.map((a) => `<li><time>${EC.fmtDateTime(a.createdAt)}</time>${esc(a.summary)}</li>`).join('')}</ul>` : '<p class="small text-muted">No activity recorded.</p>'}`;
  }

  async function setUserStatus(id, to) {
    const disabling = to === 'disabled';
    const ok = await EC.confirm(disabling
      ? { title: 'Disable this account?', body: 'The student will be signed out and cannot sign in until re-activated. Their listings will be hidden.', confirmText: 'Disable account', danger: true, reason: { label: 'Reason (kept in the activity log)', required: true, requiredMessage: 'Give a reason.' } }
      : { title: 'Re-activate this account?', body: 'The student will be able to sign in again.', confirmText: 'Re-activate' });
    if (!ok) return;
    try {
      await EC.api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status: to, reason: ok.reason || '' } });
      EC.toast(disabling ? 'Account disabled.' : 'Account re-activated.');
      openUser(id); route();
    } catch (err) { EC.toast(err.message, { error: true }); }
  }

  /* ========================================================== Requests */
  async function requests(params) {
    const f = { status: params.get('status') || '', type: params.get('type') || '', q: params.get('q') || '', from: params.get('from') || '', to: params.get('to') || '', page: Number(params.get('page')) || 1 };
    view.innerHTML = `
      <ul class="nav nav-underline mb-3" id="statusTabs" role="tablist">${['', ...meta.requestStatuses].map((s) => `<li class="nav-item"><button class="nav-link${f.status === s ? ' active' : ''}" type="button" data-status="${s}">${s || 'All'}<span class="count" data-n="${s}"></span></button></li>`).join('')}</ul>
      <form class="toolbar" id="filterForm">
        <div class="search-input" style="min-width:220px;flex:1;max-width:340px"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="fq">Resource</label><input class="form-control form-control-sm" id="fq" name="q" placeholder="Search by resource title" value="${esc(f.q)}"></div>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <label class="visually-hidden" for="ftype">Type</label><select class="form-select form-select-sm" id="ftype" name="type" style="width:auto">${opt(meta.types, f.type, 'All types')}</select>
          <label class="small text-muted" for="ffrom">From</label><input class="form-control form-control-sm" type="date" id="ffrom" name="from" value="${esc(f.from)}" style="width:auto">
          <label class="small text-muted" for="fto">To</label><input class="form-control form-control-sm" type="date" id="fto" name="to" value="${esc(f.to)}" style="width:auto">
          <input type="hidden" name="status" value="${esc(f.status)}">
        </div>
      </form>
      <div id="tbl">${EC.loadingBlock()}</div><div class="mt-3" id="pager"></div>`;
    bindFilters('requests', f);
    $('#statusTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-status]'); if (b) go('requests', { ...f, status: b.dataset.status, page: 1 }); });
    const data = await EC.api(`/admin/requests?${qs(f)}`);
    const total = Object.values(data.statusCounts).reduce((a, b) => a + b, 0);
    $$('#statusTabs [data-n]').forEach((el) => { el.textContent = el.dataset.n ? (data.statusCounts[el.dataset.n] || 0) : total; });
    $('#tbl').innerHTML = tableWrap(['Resource', 'Requester', 'Owner', 'Type', 'Status', 'Pickup point', 'Requested', 'Updated'], data.items.map((q) => `
      <tr>
        <td>${q.resource.deleted ? esc(q.resource.title) : `<button class="btn btn-link p-0 text-start row-link" data-open-resource="${q.resource.id}">${esc(q.resource.title)}</button>`}</td>
        <td><div>${esc(q.requester.name)}</div><div class="meta">${esc(q.requester.email || '')}</div></td>
        <td><div>${esc(q.owner.name)}</div><div class="meta">${esc(q.owner.email || '')}</div></td>
        <td>${EC.typeBadge(q.resourceType)}</td>
        <td>${EC.requestStatusBadge(q.status, q.resourceType)}</td>
        <td class="small">${esc(q.location ? q.location.name : '—')}${q.location && !q.location.usable ? ` ${EC.locationStatusBadge(q.location)}` : ''}</td>
        <td class="small">${EC.fmtDate(q.createdAt)}</td>
        <td class="small">${EC.timeAgo(q.updatedAt)}</td>
      </tr>`), 'No requests match');
    EC.renderPagination($('#pager'), data.pagination, (n) => go('requests', { ...f, page: n }));
  }

  /* ========================================================= Locations */
  async function locations(params) {
    const f = { status: params.get('status') || '', q: params.get('q') || '', page: Number(params.get('page')) || 1 };
    view.innerHTML = `
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <ul class="nav nav-underline flex-grow-1" id="statusTabs" role="tablist">${['', 'Pending', 'Approved', 'Rejected'].map((s) => `<li class="nav-item"><button class="nav-link${f.status === s ? ' active' : ''}" type="button" data-status="${s}">${s || 'All'}<span class="count" data-n="${s}"></span></button></li>`).join('')}</ul>
        <button class="btn btn-primary btn-sm" type="button" id="addLocation"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add location</button>
      </div>
      <form class="toolbar" id="filterForm"><div class="search-input" style="min-width:220px;flex:1;max-width:340px"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="fq">Search locations</label><input class="form-control form-control-sm" id="fq" name="q" placeholder="Search name or area" value="${esc(f.q)}"><input type="hidden" name="status" value="${esc(f.status)}"></div></form>
      <div id="tbl">${EC.loadingBlock()}</div><div class="mt-3" id="pager"></div>`;
    bindFilters('locations', f);
    $('#statusTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-status]'); if (b) go('locations', { ...f, status: b.dataset.status, page: 1 }); });
    $('#addLocation').addEventListener('click', () => locationForm(null));
    const data = await EC.api(`/admin/locations?${qs(f)}`);
    const total = Object.values(data.statusCounts).reduce((a, b) => a + b, 0);
    $$('#statusTabs [data-n]').forEach((el) => { const n = el.dataset.n ? (data.statusCounts[el.dataset.n] || 0) : total; el.textContent = n; el.classList.toggle('attn', el.dataset.n === 'Pending' && n > 0); });
    $('#tbl').innerHTML = tableWrap(['Location', 'Proposed by', 'Submitted', 'Status', 'In use', ''], data.items.map((l) => `
      <tr>
        <td><button class="btn btn-link p-0 text-start row-link" data-open-location="${l.id}">${esc(l.name)}</button><div class="meta">${esc(l.area || 'Area not set')}</div></td>
        <td class="small">${l.source === 'migration' ? 'Imported from prototype' : l.proposedBy ? `${esc(l.proposedBy.name)}<span class="d-block text-muted">${l.source === 'admin' ? 'Administrator' : esc(l.proposedBy.email || '')}</span>` : '—'}</td>
        <td class="small">${EC.fmtDate(l.createdAt)}</td>
        <td>${EC.locationStatusBadge(l)}</td>
        <td class="small">${EC.plural(l.usage.listings, 'listing')}${l.usage.activeExchanges ? `<span class="d-block text-muted">${EC.plural(l.usage.activeExchanges, 'active exchange')}</span>` : ''}</td>
        <td class="text-end"><button class="btn ${l.status === 'Pending' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" data-open-location="${l.id}">${l.status === 'Pending' ? 'Review' : 'Manage'}</button></td>
      </tr>`), 'No locations match');
    EC.renderPagination($('#pager'), data.pagination, (n) => go('locations', { ...f, page: n }));
  }

  async function openLocation(id) {
    openDrawer('Location', EC.loadingBlock());
    const { location: l } = await EC.api(`/admin/locations/${id}`);
    $('#drawerTitle').textContent = l.name;
    const actions = [];
    if (l.status !== 'Approved') actions.push(`<button class="btn btn-primary btn-sm" data-loc-act="approve" data-id="${l.id}"><i class="bi bi-check-lg" aria-hidden="true"></i>Approve</button>`);
    if (l.status !== 'Rejected') actions.push(`<button class="btn btn-outline-danger btn-sm" data-loc-act="reject" data-id="${l.id}"><i class="bi bi-x-lg" aria-hidden="true"></i>Reject</button>`);
    if (l.status === 'Approved') actions.push(`<button class="btn btn-outline-secondary btn-sm" data-loc-act="${l.active ? 'disable' : 'enable'}" data-id="${l.id}">${l.active ? '<i class="bi bi-pause-circle" aria-hidden="true"></i>Disable' : '<i class="bi bi-play-circle" aria-hidden="true"></i>Re-enable'}</button>`);
    actions.push(`<button class="btn btn-outline-secondary btn-sm" data-loc-act="edit" data-id="${l.id}"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</button>`);
    $('#drawerBody').innerHTML = `
      <div class="mb-3">${EC.locationStatusBadge(l)}</div>
      ${l.source === 'migration' ? '<div class="alert alert-warning"><i class="bi bi-info-circle" aria-hidden="true"></i><div>Imported from the original prototype. Its details have not been verified. Add the campus area with <strong>Edit</strong> and confirm it is a real, suitable spot before approving.</div></div>' : ''}
      <dl class="dl-grid mb-3">
        <dt>Name</dt><dd>${esc(l.name)}</dd>
        <dt>Campus area</dt><dd>${esc(l.area || '—')}</dd>
        <dt>Description</dt><dd>${esc(l.description || '—')}</dd>
        <dt>Proposed by</dt><dd>${l.proposedBy ? `${esc(l.proposedBy.name)}<span class="d-block small text-muted">${esc(l.proposedBy.email || '')}</span>` : (l.source === 'migration' ? 'Migration script' : '—')}</dd>
        <dt>Submitted</dt><dd>${EC.fmtDateTime(l.createdAt)}</dd>
        ${l.reviewedBy ? `<dt>Reviewed</dt><dd>${esc(l.reviewedBy.name)}, ${EC.fmtDateTime(l.reviewedAt)}</dd>` : ''}
        ${l.status === 'Rejected' ? `<dt>Rejection reason</dt><dd>${esc(l.rejectionReason)}</dd>` : ''}
        <dt>In use</dt><dd>${EC.plural(l.usage.listings, 'listing')}, ${EC.plural(l.usage.activeExchanges, 'active exchange')}</dd>
      </dl>
      ${l.usage.listings && l.status === 'Approved' && l.active ? '<p class="small text-muted">Disabling or rejecting this location stops its listings from being requested until owners choose another point. Owners in active exchanges are notified.</p>' : ''}
      <div class="d-flex flex-wrap gap-2 mb-4">${actions.join('')}</div>
      <h3 class="h5">Approval history</h3>
      <ul class="timeline">${l.history.map((h) => `<li><time>${EC.fmtDateTime(h.at)}</time><strong>${esc(h.action.charAt(0).toUpperCase() + h.action.slice(1))}</strong>${h.by ? ` by ${esc(h.by)}` : ''}${h.note ? `<div class="small text-muted">${esc(h.note)}</div>` : ''}</li>`).join('')}</ul>`;
  }

  async function locationAction(act, id) {
    try {
      if (act === 'edit') { const { location } = await EC.api(`/admin/locations/${id}`); locationForm(location); return; }
      if (act === 'approve') {
        const ok = await EC.confirm({ title: 'Approve this location?', body: 'Students will be able to choose it for pickups straight away. Make sure it is a real, public and suitable spot.', confirmText: 'Approve' });
        if (!ok) return;
        await EC.api(`/admin/locations/${id}/approve`, { method: 'PATCH' });
        EC.toast('Location approved.');
      }
      if (act === 'reject') {
        const ok = await EC.confirm({ title: 'Reject this location?', body: 'The student who suggested it will see your reason.', confirmText: 'Reject', danger: true, reason: { label: 'Reason', required: true, min: 5, requiredMessage: 'Give a reason of at least 5 characters.', placeholder: 'e.g. Not publicly accessible after 5 pm' } });
        if (!ok) return;
        await EC.api(`/admin/locations/${id}/reject`, { method: 'PATCH', body: { reason: ok.reason } });
        EC.toast('Location rejected.');
      }
      if (act === 'disable' || act === 'enable') {
        const ok = await EC.confirm(act === 'disable'
          ? { title: 'Disable this location?', body: 'It will disappear from the pickup dropdowns. Listings using it cannot be requested until the owner picks another point.', confirmText: 'Disable', danger: true }
          : { title: 'Re-enable this location?', confirmText: 'Re-enable' });
        if (!ok) return;
        await EC.api(`/admin/locations/${id}`, { method: 'PATCH', body: { active: act === 'enable' } });
        EC.toast(act === 'disable' ? 'Location disabled.' : 'Location re-enabled.');
      }
      openLocation(id); route(); refreshBadges();
    } catch (err) { EC.toast(err.message, { error: true }); }
  }

  function locationForm(l) {
    openDrawer(l ? `Edit ${l.name}` : 'Add a location', `
      <form id="locForm" novalidate>
        <div class="form-alert d-none"></div>
        ${l ? '' : '<p class="small text-muted">Locations added by an administrator are approved immediately.</p>'}
        <div class="mb-3"><label class="form-label" for="lName">Name<span class="req" aria-hidden="true">*</span></label><input class="form-control" id="lName" name="name" maxlength="80" value="${esc(l ? l.name : '')}"><div class="invalid-feedback" data-error-for="name"></div></div>
        <div class="mb-3"><label class="form-label" for="lArea">Campus area or building<span class="req" aria-hidden="true">*</span></label><input class="form-control" id="lArea" name="area" maxlength="120" value="${esc(l ? l.area : '')}"><div class="invalid-feedback" data-error-for="area"></div></div>
        <div class="mb-3"><label class="form-label" for="lDesc">Description</label><textarea class="form-control" id="lDesc" name="description" rows="3" maxlength="400">${esc(l ? l.description : '')}</textarea><div class="invalid-feedback" data-error-for="description"></div></div>
        <div class="d-flex gap-2"><button class="btn btn-primary" type="submit">${l ? 'Save changes' : 'Add location'}</button>${l ? `<button class="btn btn-outline-secondary" type="button" data-open-location="${l.id}">Back</button>` : ''}</div>
      </form>`);
    const form = $('#locForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      EC.form.clear(form);
      const v = EC.form.values(form);
      const errs = {};
      if ((v.name || '').length < 3) errs.name = 'Enter at least 3 characters.';
      if ((v.area || '').length < 3) errs.area = 'Enter the campus area or building.';
      if (Object.keys(errs).length) return EC.form.errors(form, errs);
      const btn = form.querySelector('[type=submit]');
      EC.form.busy(btn, true);
      try {
        const { location } = l
          ? await EC.api(`/admin/locations/${l.id}`, { method: 'PATCH', body: v })
          : await EC.api('/admin/locations', { method: 'POST', body: v });
        EC.toast(l ? 'Location updated.' : 'Location added and approved.');
        openLocation(location.id); route();
      } catch (err) { EC.form.handleError(form, err); EC.form.busy(btn, false); }
    });
  }

  /* ======================================================== Grievances */
  async function grievances(params) {
    const f = { status: params.get('status') || '', category: params.get('category') || '', priority: params.get('priority') || '', q: params.get('q') || '', page: Number(params.get('page')) || 1 };
    view.innerHTML = `
      <ul class="nav nav-underline mb-3" id="statusTabs" role="tablist">${['', ...meta.grievanceStatuses].map((s) => `<li class="nav-item"><button class="nav-link${f.status === s ? ' active' : ''}" type="button" data-status="${s}">${s === 'Rejected' ? 'Not upheld' : (s || 'All')}<span class="count" data-n="${s}"></span></button></li>`).join('')}</ul>
      <form class="toolbar" id="filterForm">
        <div class="search-input" style="min-width:220px;flex:1;max-width:340px"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="fq">Search grievances</label><input class="form-control form-control-sm" id="fq" name="q" placeholder="Reference or subject" value="${esc(f.q)}"></div>
        <div class="d-flex gap-2">
          <label class="visually-hidden" for="fcat">Category</label><select class="form-select form-select-sm" id="fcat" name="category" style="width:auto">${opt(meta.grievanceCategories.map((c) => ({ value: c.key, label: c.label })), f.category, 'All categories')}</select>
          <label class="visually-hidden" for="fpri">Priority</label><select class="form-select form-select-sm" id="fpri" name="priority" style="width:auto">${opt([{ value: 'high', label: 'High priority' }, { value: 'normal', label: 'Normal priority' }], f.priority, 'Any priority')}</select>
          <input type="hidden" name="status" value="${esc(f.status)}">
        </div>
      </form>
      <div id="tbl">${EC.loadingBlock()}</div><div class="mt-3" id="pager"></div>`;
    bindFilters('grievances', f);
    $('#statusTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-status]'); if (b) go('grievances', { ...f, status: b.dataset.status, page: 1 }); });
    const data = await EC.api(`/admin/grievances?${qs(f)}`);
    const total = Object.values(data.statusCounts).reduce((a, b) => a + b, 0);
    $$('#statusTabs [data-n]').forEach((el) => { const n = el.dataset.n ? (data.statusCounts[el.dataset.n] || 0) : total; el.textContent = n; el.classList.toggle('attn', el.dataset.n === 'Open' && n > 0); });
    $('#tbl').innerHTML = tableWrap(['Reference', 'Subject', 'Category', 'Student', 'Priority', 'Status', 'Assigned', 'Submitted', ''], data.items.map((g) => `
      <tr>
        <td class="small font-monospace">${esc(g.reference)}</td>
        <td><button class="btn btn-link p-0 text-start row-link" data-open-grievance="${g.id}">${esc(g.subject)}</button></td>
        <td class="small">${esc(g.categoryLabel)}</td>
        <td class="small">${esc(g.submittedBy ? g.submittedBy.name : '—')}</td>
        <td>${g.priority === 'high' ? EC.priorityBadge('high') : '<span class="small text-muted">Normal</span>'}</td>
        <td>${EC.grievanceStatusBadge(g.status)}</td>
        <td class="small">${esc(g.assignedTo ? g.assignedTo.name : '—')}</td>
        <td class="small">${EC.fmtDate(g.createdAt)}</td>
        <td class="text-end"><button class="btn btn-outline-secondary btn-sm" data-open-grievance="${g.id}">Open</button></td>
      </tr>`), 'No grievances match');
    EC.renderPagination($('#pager'), data.pagination, (n) => go('grievances', { ...f, page: n }));
  }

  async function openGrievance(id) {
    openDrawer('Grievance', EC.loadingBlock());
    if (!admins) admins = (await EC.api('/admin/admins')).items;
    const { grievance: g } = await EC.api(`/admin/grievances/${id}`);
    $('#drawerTitle').textContent = g.reference;
    $('#drawerBody').innerHTML = `
      <div class="d-flex flex-wrap gap-2 mb-2">${EC.grievanceStatusBadge(g.status)}${EC.priorityBadge(g.priority)}</div>
      <h3 class="h4">${esc(g.subject)}</h3>
      <dl class="dl-grid mb-3">
        <dt>Category</dt><dd>${esc(g.categoryLabel)}</dd>
        <dt>Student</dt><dd>${g.submittedBy ? `<button class="btn btn-link btn-sm p-0" data-open-user="${g.submittedBy.id}">${esc(g.submittedBy.name)}</button><span class="d-block small text-muted">${esc(g.submittedBy.email)}</span>` : '—'}</dd>
        <dt>Submitted</dt><dd>${EC.fmtDateTime(g.createdAt)}</dd>
        ${g.resolvedAt ? `<dt>Closed</dt><dd>${EC.fmtDateTime(g.resolvedAt)}</dd>` : ''}
        ${g.resource ? `<dt>Listing</dt><dd><button class="btn btn-link btn-sm p-0 text-start" data-open-resource="${g.resource.id}">${esc(g.resource.title)}</button><span class="d-block small text-muted">Owner: ${esc(g.resource.owner || '—')} · ${esc(g.resource.status)}${g.resource.moderation === 'disabled' ? ' · disabled' : ''}${g.resource.deleted ? ' · deleted' : ''}</span></dd>` : ''}
        ${g.request ? `<dt>Exchange</dt><dd>${esc(g.request.resourceTitle)} <span class="d-block small text-muted">${esc(g.request.requester || '')} → ${esc(g.request.owner || '')} · ${esc(g.request.status)} · ${EC.fmtDate(g.request.createdAt)}</span></dd>` : ''}
      </dl>
      <h4 class="h5">Description</h4>
      <p class="quote mb-4" style="white-space:pre-line">${esc(g.description)}</p>
      <form id="grvForm" class="panel-muted mb-4" novalidate>
        <h4 class="h5">Update</h4>
        <div class="form-alert d-none"></div>
        <div class="row g-2 mb-2">
          <div class="col-sm-6"><label class="form-label" for="gStatus">Status</label><select class="form-select form-select-sm" id="gStatus" name="status">${opt(meta.grievanceStatuses.map((s) => ({ value: s, label: s === 'Rejected' ? 'Rejected (not upheld)' : s })), g.status)}</select><div class="invalid-feedback" data-error-for="status"></div></div>
          <div class="col-sm-6"><label class="form-label" for="gAssign">Assigned to</label><select class="form-select form-select-sm" id="gAssign" name="assignedTo">${opt(admins.map((a) => ({ value: a.id, label: a.name })), g.assignedTo ? g.assignedTo.id : '', 'Unassigned')}</select><div class="invalid-feedback" data-error-for="assignedTo"></div></div>
        </div>
        <label class="form-label" for="gResp">Response to the student</label>
        <textarea class="form-control" id="gResp" name="response" rows="4" maxlength="1500" placeholder="The student sees this response.">${esc(g.adminResponse)}</textarea>
        <div class="form-text">Required before marking as Resolved or Rejected. The student is notified of status and response changes.</div>
        <div class="invalid-feedback" data-error-for="response"></div>
        <button class="btn btn-primary btn-sm mt-2" type="submit">Save update</button>
      </form>
      <h4 class="h5">History</h4>
      <ul class="timeline">${g.history.map((h) => `<li><time>${EC.fmtDateTime(h.at)}</time>${[h.status ? `Status: <strong>${esc(h.status)}</strong>` : '', h.response ? 'response updated' : ''].filter(Boolean).join(' · ') || 'Updated'} <span class="text-muted">by ${esc(h.by)}</span></li>`).join('')}</ul>`;
    const form = $('#grvForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      EC.form.clear(form);
      const v = EC.form.values(form);
      const body = {};
      if (v.status !== g.status) body.status = v.status;
      if ((v.response || '') !== (g.adminResponse || '')) body.response = v.response || '';
      if ((v.assignedTo || '') !== (g.assignedTo ? g.assignedTo.id : '')) body.assignedTo = v.assignedTo || '';
      if (!Object.keys(body).length) return EC.form.alert(form, 'Nothing has changed.', 'info');
      const btn = form.querySelector('[type=submit]');
      EC.form.busy(btn, true);
      try {
        await EC.api(`/admin/grievances/${g.id}`, { method: 'PATCH', body });
        EC.toast(`Grievance ${g.reference} updated. The student has been notified.`);
        openGrievance(g.id); route(); refreshBadges();
      } catch (err) { EC.form.handleError(form, err); EC.form.busy(btn, false); }
    });
  }

  /* ========================================================== Activity */
  async function activity(params) {
    const f = { group: params.get('group') || '', logins: params.get('logins') || '', page: Number(params.get('page')) || 1 };
    const groups = [{ value: 'resource', label: 'Resources' }, { value: 'request', label: 'Requests' }, { value: 'location', label: 'Locations' }, { value: 'grievance', label: 'Grievances' }, { value: 'board', label: 'Community requests' }, { value: 'user', label: 'Accounts' }, { value: 'auth', label: 'Registrations and logins' }, { value: 'admin', label: 'Admin actions' }];
    view.innerHTML = `
      <form class="toolbar" id="filterForm">
        <div class="d-flex gap-3 align-items-center flex-wrap">
          <label class="visually-hidden" for="fgroup">Type</label><select class="form-select form-select-sm" id="fgroup" name="group" style="width:auto">${opt(groups, f.group, 'All activity')}</select>
          <div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" id="flog" name="logins" value="true" ${f.logins ? 'checked' : ''}><label class="form-check-label small" for="flog">Include sign-ins</label></div>
        </div>
      </form>
      <div id="tbl">${EC.loadingBlock()}</div><div class="mt-3" id="pager"></div>`;
    bindFilters('activity', f);
    const data = await EC.api(`/admin/activity?${qs({ group: f.group, excludeLogins: f.logins ? '' : 'true', page: f.page })}`);
    $('#tbl').innerHTML = tableWrap(['When', 'Event', 'By', 'Action'], data.items.map((a) => `
      <tr>
        <td class="small text-nowrap">${EC.fmtDateTime(a.createdAt)}</td>
        <td>${esc(a.summary)}${a.details && a.details.reason ? `<div class="meta">Reason: ${esc(a.details.reason)}</div>` : ''}</td>
        <td class="small">${a.actor ? `${esc(a.actor.name)}${a.actor.role === 'admin' ? ' <span class="badge-ec b-dark">Admin</span>' : ''}` : '<span class="text-muted">System</span>'}</td>
        <td class="small font-monospace text-muted">${esc(a.action)}</td>
      </tr>`), 'No activity recorded');
    EC.renderPagination($('#pager'), data.pagination, (n) => go('activity', { ...f, page: n }));
  }

  /* ============================================================ Router */
  const views = { overview, resources, users, requests, locations, grievances, activity };
  const titles = { overview: 'Overview', resources: 'Resources', users: 'Users', requests: 'Requests & exchanges', locations: 'Location management', grievances: 'Grievances', activity: 'Activity log' };

  function go(name, params) {
    const q = qs({ ...params, page: params.page > 1 ? params.page : '' });
    location.hash = q ? `${name}?${q}` : name;
  }
  function bindFilters(name, f) {
    const form = $('#filterForm'); if (!form) return;
    let t;
    const submit = () => { const v = EC.form.values(form); EC.$$('input[type=checkbox]', form).forEach((c) => { v[c.name] = c.checked ? c.value : ''; }); go(name, { ...f, ...v, page: 1 }); };
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    form.addEventListener('change', (e) => { if (e.target.type !== 'search' && e.target.name !== 'q') submit(); });
    const q = form.querySelector('[name=q]');
    if (q) {
      q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(submit, 450); });
      if (document.activeElement === document.body && f.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
  }

  let lastName = null;
  async function route() {
    const [name, query] = (location.hash.slice(1) || 'overview').split('?');
    const v = views[name] ? name : 'overview';
    $$('.admin-nav a').forEach((a) => { const on = a.dataset.view === v; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#viewTitle').textContent = titles[v];
    document.title = `${titles[v]} | EduCycle admin`;
    side.classList.remove('open');
    const keepFocus = lastName === v;
    lastName = v;
    if (!keepFocus && drawerEl.classList.contains('show')) drawer.hide();
    try {
      await views[v](new URLSearchParams(query || ''));
      if (!keepFocus) view.focus({ preventScroll: true });
    } catch (err) {
      view.innerHTML = EC.errorState(err, 'retryView');
      const r = $('#retryView'); if (r) r.addEventListener('click', route);
    }
  }

  // Delegated drawer and action handlers (work from any view or the drawer itself).
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-resource],[data-open-user],[data-open-location],[data-open-grievance],[data-moderate],[data-user-status],[data-loc-act]');
    if (!t) return;
    const safe = (p) => p.catch((err) => { $('#drawerBody').innerHTML = EC.errorState(err); });
    if (t.dataset.openResource) safe(openResource(t.dataset.openResource));
    else if (t.dataset.openUser) safe(openUser(t.dataset.openUser));
    else if (t.dataset.openLocation) safe(openLocation(t.dataset.openLocation));
    else if (t.dataset.openGrievance) safe(openGrievance(t.dataset.openGrievance));
    else if (t.dataset.moderate) moderate(t.dataset.moderate, t.dataset.state);
    else if (t.dataset.userStatus) setUserStatus(t.dataset.userStatus, t.dataset.to);
    else if (t.dataset.locAct) locationAction(t.dataset.locAct, t.dataset.id);
  });

  window.addEventListener('hashchange', route);
  $('#refreshBtn').addEventListener('click', () => { refreshBadges(); route(); });
  refreshBadges();
  route();
});
