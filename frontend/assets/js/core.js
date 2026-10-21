/* ==========================================================================
   EduCycle — shared frontend core
   API client (session cookie + CSRF), layout (nav/footer), auth guard,
   formatting helpers, badges, resource cards, toasts and dialogs.
   Every page loads this file first, then its own page script.
   ========================================================================== */
(function () {
  'use strict';

  const EC = (window.EC = {});
  let csrfToken = null;
  let sessionPromise = null;
  let metaPromise = null;

  /* ---------------------------------------------------------------- utils */
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  EC.esc = esc;
  EC.$ = (sel, root = document) => root.querySelector(sel);
  EC.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  EC.params = () => new URLSearchParams(location.search);
  EC.setParams = (obj, { replace = true } = {}) => {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v); });
    const url = location.pathname + (p.toString() ? `?${p}` : '');
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  };
  EC.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  EC.fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
  EC.fmtDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—');
  EC.timeAgo = (d) => {
    if (!d) return '';
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
    const dd = Math.round(h / 24); if (dd < 7) return `${dd} day${dd > 1 ? 's' : ''} ago`;
    return EC.fmtDate(d);
  };
  EC.plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  /* ------------------------------------------------------------ API client */
  class ApiError extends Error {
    constructor(status, body) {
      const e = (body && body.error) || {};
      super(e.message || (status === 0 ? 'Could not reach the server. Check your connection and try again.' : 'Something went wrong. Please try again.'));
      this.status = status; this.code = e.code || 'ERROR'; this.fields = e.fields || null;
    }
  }
  EC.ApiError = ApiError;

  async function ensureCsrf() {
    if (csrfToken) return csrfToken;
    const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    csrfToken = (await r.json()).csrfToken;
    return csrfToken;
  }

  /**
   * EC.api('/resources', { method: 'POST', body: {...} })
   * Sends JSON. Returns parsed JSON or throws ApiError.
   */
  EC.api = async function api(path, { method = 'GET', body, retry = true } = {}) {
    const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (method !== 'GET') {
      opts.headers['X-CSRF-Token'] = await ensureCsrf();
      if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    let res;
    try { res = await fetch(`/api${path}`, opts); } catch (_) { throw new ApiError(0, null); }
    let data = null;
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (res.ok) {
      if (data && data.csrfToken) csrfToken = data.csrfToken;
      return data;
    }
    const err = new ApiError(res.status, data);
    if (err.code === 'CSRF_INVALID' && retry) { csrfToken = null; return api(path, { method, body, form, retry: false }); }
    if (res.status === 401 && ['SESSION_EXPIRED', 'ACCOUNT_DISABLED'].includes(err.code) && EC.user) {
      EC.user = null;
      const isAdmin = document.body.dataset.area === 'admin';
      const target = isAdmin ? '/admin-login.html' : '/login.html';
      location.href = `${target}?reason=${err.code === 'ACCOUNT_DISABLED' ? 'disabled' : 'expired'}&next=${encodeURIComponent(location.pathname + location.search)}`;
    }
    throw err;
  };

  /* --------------------------------------------------------------- session */
  EC.session = function session() {
    if (!sessionPromise) {
      sessionPromise = fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((d) => { csrfToken = d.csrfToken; EC.user = d.user; return d.user; })
        .catch(() => { EC.user = null; return null; });
    }
    return sessionPromise;
  };

  EC.meta = function meta() {
    if (!metaPromise) metaPromise = EC.api('/meta');
    return metaPromise;
  };

  EC.logout = async function logout(redirect = '/index.html') {
    try { await EC.api('/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
    location.href = redirect;
  };

  /* ---------------------------------------------------------------- icons */
  const CAT_ICONS = { Books: 'bi-book', Notes: 'bi-journal-text', Electronics: 'bi-cpu', Calculators: 'bi-calculator', 'Lab Equipment': 'bi-eyedropper', Stationery: 'bi-pencil', Other: 'bi-box-seam' };
  EC.catIcon = (c) => CAT_ICONS[c] || 'bi-box-seam';

  /* --------------------------------------------------------------- badges */
  const badge = (cls, icon, text, title) => `<span class="badge-ec ${cls}"${title ? ` title="${esc(title)}"` : ''}><i class="bi ${icon}" aria-hidden="true"></i>${esc(text)}</span>`;
  EC.badge = badge;
  EC.typeBadge = (t) => ({
    Donate: badge('b-dark', 'bi-gift', 'Donate', 'Given away for free'),
    Lend: badge('b-blue', 'bi-arrow-left-right', 'Lend', 'Borrow and return'),
    Exchange: badge('b-amber', 'bi-shuffle', 'Exchange', 'Swap for something else'),
  })[t] || badge('b-grey', 'bi-tag', t);
  EC.resourceStatusBadge = (s) => ({
    Available: badge('b-green', 'bi-check-circle', 'Available'),
    Reserved: badge('b-amber', 'bi-hourglass-split', 'Reserved'),
    Unavailable: badge('b-grey', 'bi-slash-circle', 'Unavailable'),
  })[s] || badge('b-grey', 'bi-question-circle', s);
  EC.requestStatusBadge = (s, type) => ({
    Pending: badge('b-amber', 'bi-hourglass-split', 'Pending'),
    Accepted: badge('b-blue', 'bi-hand-thumbs-up', 'Accepted'),
    'Handed Over': badge('b-blue', 'bi-box-arrow-right', type === 'Lend' ? 'On loan' : 'Handed over'),
    Completed: badge('b-green', 'bi-check-circle', type === 'Lend' ? 'Returned' : 'Completed'),
    Declined: badge('b-red', 'bi-x-circle', 'Declined'),
    Cancelled: badge('b-grey', 'bi-slash-circle', 'Cancelled'),
  })[s] || badge('b-grey', 'bi-circle', s);
  EC.locationStatusBadge = (l) => {
    if (!l) return '';
    if (l.status === 'Approved' && l.active === false) return badge('b-grey', 'bi-pause-circle', 'Disabled');
    return ({
      Approved: badge('b-green', 'bi-patch-check', 'Approved'),
      Pending: badge('b-amber', 'bi-hourglass-split', 'Awaiting review'),
      Rejected: badge('b-red', 'bi-x-circle', 'Not approved'),
    })[l.status] || '';
  };
  EC.grievanceStatusBadge = (s) => ({
    Open: badge('b-amber', 'bi-envelope-open', 'Open'),
    'In Review': badge('b-blue', 'bi-search', 'In review'),
    Resolved: badge('b-green', 'bi-check-circle', 'Resolved'),
    Rejected: badge('b-grey', 'bi-x-circle', 'Closed – not upheld'),
  })[s] || badge('b-grey', 'bi-circle', s);
  EC.priorityBadge = (p) => (p === 'high' ? badge('priority-high', 'bi-exclamation-triangle-fill', 'High priority') : '');

  /* --------------------------------------------------------- resource card */
  EC.media = (r, cls = 'ph') => `<div class="${cls}" aria-hidden="true"><i class="bi ${EC.catIcon(r.category)}"></i><span>${esc(r.category)}</span></div>`;

  EC.resourceCard = (r) => {
    const loc = r.location;
    const locLine = loc
      ? (loc.usable
        ? `<i class="bi bi-geo-alt" aria-hidden="true"></i><span><span class="visually-hidden">Pickup point: </span>${esc(loc.name)}</span>`
        : `<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>Pickup point awaiting approval</span>`)
      : '';
    return `
      <article class="res-card">
        <div class="res-media">${EC.media(r)}<span class="type-pill">${EC.typeBadge(r.type)}</span></div>
        <div class="res-body">
          <h3 class="res-title"><a href="resource-details.html?id=${esc(r.id)}">${esc(r.title)}</a></h3>
          <div class="res-meta"><span>${esc(r.condition)}</span><span>${esc(r.category)}</span>${r.semester ? `<span>Sem ${esc(r.semester)}</span>` : ''}</div>
          <div class="res-foot">${EC.resourceStatusBadge(r.status)}<span class="meta truncate">by ${esc(r.owner ? r.owner.name : '')}</span></div>
          <div class="res-loc">${locLine}</div>
        </div>
      </article>`;
  };

  /* -------------------------------------------------------------- states */
  EC.state = ({ icon = 'bi-inbox', title, text = '', actions = '', error = false }) => `
    <div class="state${error ? ' is-error' : ''}" role="${error ? 'alert' : 'status'}">
      <div class="state-icon"><i class="bi ${icon}" aria-hidden="true"></i></div>
      <h2 class="h3">${esc(title)}</h2>
      ${text ? `<p>${text}</p>` : ''}
      ${actions ? `<div class="d-flex flex-wrap gap-2 justify-content-center">${actions}</div>` : ''}
    </div>`;
  EC.errorState = (err, retryId) => EC.state({
    icon: 'bi-exclamation-triangle', error: true, title: 'This could not be loaded',
    text: esc(err && err.message ? err.message : 'Please try again.'),
    actions: retryId ? `<button class="btn btn-outline-secondary btn-sm" id="${retryId}" type="button"><i class="bi bi-arrow-clockwise"></i>Try again</button>` : '',
  });
  EC.skeletonCards = (n = 6, col = 'col-sm-6 col-lg-4') => Array.from({ length: n }, () => `<div class="${col}"><div class="skeleton skeleton-card"></div></div>`).join('');
  EC.loadingBlock = (text = 'Loading…') => `<div class="d-flex align-items-center gap-2 text-muted py-4 justify-content-center" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>${esc(text)}</div>`;

  /* ---------------------------------------------------------- pagination */
  EC.renderPagination = (el, p, onPage) => {
    if (!el) return;
    if (!p || p.pages <= 1) { el.innerHTML = ''; return; }
    const pages = [];
    const add = (n) => { if (!pages.includes(n) && n >= 1 && n <= p.pages) pages.push(n); };
    [1, p.page - 1, p.page, p.page + 1, p.pages].forEach(add);
    pages.sort((a, b) => a - b);
    let html = `<nav aria-label="Pagination"><ul class="pagination justify-content-center mb-0">`;
    html += `<li class="page-item${p.page <= 1 ? ' disabled' : ''}"><button class="page-link" data-page="${p.page - 1}" aria-label="Previous page"><i class="bi bi-chevron-left"></i></button></li>`;
    let last = 0;
    pages.forEach((n) => {
      if (n - last > 1) html += '<li class="page-item disabled"><span class="page-link">…</span></li>';
      html += `<li class="page-item${n === p.page ? ' active' : ''}"><button class="page-link" data-page="${n}"${n === p.page ? ' aria-current="page"' : ''}>${n}</button></li>`;
      last = n;
    });
    html += `<li class="page-item${p.page >= p.pages ? ' disabled' : ''}"><button class="page-link" data-page="${p.page + 1}" aria-label="Next page"><i class="bi bi-chevron-right"></i></button></li></ul></nav>`;
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => onPage(Number(b.dataset.page))));
  };

  /* --------------------------------------------------------------- forms */
  EC.form = {
    clear(form) {
      form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
      form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
      const a = form.querySelector('.form-alert'); if (a) { a.classList.add('d-none'); a.innerHTML = ''; }
    },
    /** fields: { fieldName: message }. Maps API field names to inputs via [name] or data-field. */
    errors(form, fields, fallback) {
      let first = null;
      Object.entries(fields || {}).forEach(([name, msg]) => {
        const input = form.querySelector(`[name="${name}"]`) || form.querySelector(`[data-field="${name}"]`);
        const fb = form.querySelector(`[data-error-for="${name}"]`);
        if (input) { input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true'); first = first || input; }
        if (fb) fb.textContent = msg;
      });
      if (fallback) EC.form.alert(form, fallback);
      if (first && first.focus) first.focus();
    },
    alert(form, message, type = 'danger') {
      const a = form.querySelector('.form-alert');
      if (!a) return EC.toast(message, { error: type === 'danger' });
      a.className = `form-alert alert alert-${type}`;
      a.innerHTML = `<i class="bi ${type === 'danger' ? 'bi-exclamation-circle' : 'bi-info-circle'}" aria-hidden="true"></i><div>${esc(message)}</div>`;
      a.setAttribute('role', 'alert');
    },
    handleError(form, err) {
      if (err.fields) EC.form.errors(form, err.fields, err.message);
      else EC.form.alert(form, err.message);
    },
    busy(btn, busy, text) {
      if (!btn) return;
      if (busy) {
        btn.dataset.label = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border" aria-hidden="true"></span>${esc(text || 'Saving…')}`;
      } else {
        btn.disabled = false;
        if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
      }
    },
    values(form) {
      const out = {};
      new FormData(form).forEach((v, k) => { if (typeof v === 'string') out[k] = v.trim(); });
      return out;
    },
    counter(textarea, out) {
      const upd = () => { out.textContent = `${textarea.value.length}/${textarea.maxLength}`; };
      textarea.addEventListener('input', upd); upd();
    },
  };
  // Clear a field's error as soon as the user edits it.
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('is-invalid')) {
      t.classList.remove('is-invalid'); t.removeAttribute('aria-invalid');
      const fb = t.form && t.form.querySelector(`[data-error-for="${t.name}"]`); if (fb) fb.textContent = '';
    }
  });

  EC.fillSelect = (select, items, { placeholder, value } = {}) => {
    const opts = items.map((it) => (typeof it === 'object' ? it : { value: it, label: it }));
    select.innerHTML = (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '') +
      opts.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  };

  /* -------------------------------------------------------------- toasts */
  EC.toast = (message, { error = false, timeout = 5000 } = {}) => {
    let area = document.getElementById('toast-area');
    if (!area) { area = document.createElement('div'); area.id = 'toast-area'; area.className = 'toast-container position-fixed bottom-0 end-0 p-3'; document.body.appendChild(area); }
    const el = document.createElement('div');
    el.className = `toast toast-ec${error ? ' is-error' : ''}`;
    el.setAttribute('role', error ? 'alert' : 'status');
    el.setAttribute('aria-live', error ? 'assertive' : 'polite');
    el.innerHTML = `<div class="toast-body"><i class="bi ${error ? 'bi-exclamation-circle' : 'bi-check-circle'}" aria-hidden="true"></i><div class="flex-grow-1">${esc(message)}</div><button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    area.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: timeout });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    t.show();
  };
  // Show a toast queued by the previous page (e.g. after a redirect).
  EC.flash = (message) => { try { sessionStorage.setItem('ec.flash', message); } catch (_) { /* ignore */ } };
  function showFlash() {
    try { const m = sessionStorage.getItem('ec.flash'); if (m) { sessionStorage.removeItem('ec.flash'); EC.toast(m); } } catch (_) { /* ignore */ }
  }

  /* ------------------------------------------------------------- dialogs */
  /** Promise-based confirmation dialog. Optionally collects a text reason. */
  EC.confirm = ({ title, body = '', confirmText = 'Confirm', danger = false, reason = null }) => new Promise((resolve) => {
    const id = `dlg${Date.now()}`;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal fade" id="${id}" tabindex="-1" aria-labelledby="${id}-t" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
          <form novalidate>
            <div class="modal-header"><h2 class="modal-title" id="${id}-t">${esc(title)}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
            <div class="modal-body">
              ${body ? `<p class="mb-${reason ? '3' : '0'}">${body}</p>` : ''}
              ${reason ? `<label class="form-label" for="${id}-r">${esc(reason.label)}${reason.required ? '<span class="req" aria-hidden="true">*</span>' : '<span class="opt">(optional)</span>'}</label>
                <textarea class="form-control" id="${id}-r" name="reason" rows="3" maxlength="${reason.max || 300}" ${reason.required ? 'required' : ''} placeholder="${esc(reason.placeholder || '')}"></textarea>
                <div class="invalid-feedback" data-error-for="reason"></div>` : ''}
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(confirmText)}</button></div>
          </form>
        </div></div>
      </div>`;
    document.body.appendChild(wrap);
    const modalEl = wrap.firstElementChild;
    const modal = new bootstrap.Modal(modalEl);
    let result = false;
    modalEl.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (reason) {
        const ta = modalEl.querySelector('textarea');
        const v = ta.value.trim();
        if (reason.required && v.length < (reason.min || 1)) {
          ta.classList.add('is-invalid');
          modalEl.querySelector('[data-error-for="reason"]').textContent = reason.requiredMessage || 'Please enter a reason.';
          ta.focus();
          return;
        }
        result = { reason: v };
      } else result = true;
      modal.hide();
    });
    modalEl.addEventListener('shown.bs.modal', () => { const f = modalEl.querySelector('textarea') || modalEl.querySelector('[type=submit]'); if (f) f.focus(); });
    modalEl.addEventListener('hidden.bs.modal', () => { modal.dispose(); wrap.remove(); resolve(result); });
    modal.show();
  });

  /* -------------------------------------------------------------- layout */
  function navLink(href, label, key) {
    const active = document.body.dataset.active === key;
    return `<li class="nav-item"><a class="nav-link${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a></li>`;
  }

  function renderNav(user) {
    const el = document.getElementById('site-nav');
    if (!el) return;
    let right;
    if (user && user.role === 'student') {
      right = `
        <a class="btn btn-primary btn-sm d-none d-lg-inline-flex" href="list-resource.html"><i class="bi bi-plus-lg" aria-hidden="true"></i>List a resource</a>
        <a class="nav-icon-btn" href="notifications.html" aria-label="Notifications" id="navBell"><i class="bi bi-bell" aria-hidden="true"></i><span class="count d-none" id="navBellCount"></span></a>
        <div class="dropdown">
          <button class="account-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Account menu for ${esc(user.name)}">
            <span class="avatar" aria-hidden="true">${esc(EC.initials(user.name))}</span><span class="d-none d-sm-inline">${esc(user.name.split(' ')[0])}</span><i class="bi bi-chevron-down small" aria-hidden="true"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><h6 class="dropdown-header">${esc(user.email)}</h6></li>
            <li><a class="dropdown-item" href="activity.html"><i class="bi bi-arrow-left-right"></i>Your activity</a></li>
            <li><a class="dropdown-item" href="my-listings.html"><i class="bi bi-grid"></i>My listings</a></li>
            <li><a class="dropdown-item" href="notifications.html"><i class="bi bi-bell"></i>Notifications</a></li>
            <li><a class="dropdown-item" href="locations.html"><i class="bi bi-geo-alt"></i>Pickup points</a></li>
            <li><a class="dropdown-item" href="grievances.html"><i class="bi bi-flag"></i>Report a problem</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="account.html"><i class="bi bi-person"></i>Account settings</a></li>
            <li><button class="dropdown-item" type="button" data-action="logout"><i class="bi bi-box-arrow-right"></i>Log out</button></li>
          </ul>
        </div>`;
    } else if (user && user.role === 'admin') {
      right = `<a class="btn btn-dark btn-sm" href="admin.html"><i class="bi bi-speedometer2" aria-hidden="true"></i>Admin dashboard</a>
               <button class="btn btn-outline-secondary btn-sm" type="button" data-action="logout">Log out</button>`;
    } else {
      const next = encodeURIComponent(location.pathname + location.search);
      right = `<a class="btn btn-outline-secondary btn-sm" href="login.html?next=${next}">Log in</a>
               <a class="btn btn-primary btn-sm" href="login.html?mode=register&next=${next}">Create account</a>`;
    }
    el.className = 'site-nav';
    el.innerHTML = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <nav class="navbar navbar-expand-lg" aria-label="Main">
        <div class="container">
          <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"><i class="bi bi-arrow-repeat"></i></span>EduCycle</a>
          <div class="d-flex align-items-center gap-2 order-lg-3 nav-actions">${right}
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain" aria-controls="navMain" aria-expanded="false" aria-label="Toggle navigation"><i class="bi bi-list" aria-hidden="true"></i></button>
          </div>
          <div class="collapse navbar-collapse order-lg-2" id="navMain">
            <ul class="navbar-nav ms-lg-4 me-auto">
              ${navLink('browse.html', 'Browse', 'browse')}
              ${navLink('request-board.html', 'Community requests', 'board')}
              ${navLink('locations.html', 'Pickup points', 'locations')}
              ${navLink('help.html', 'Help', 'help')}
              ${user && user.role === 'student' ? `<li class="nav-item d-lg-none"><a class="nav-link" href="list-resource.html">List a resource</a></li>` : ''}
            </ul>
          </div>
        </div>
      </nav>`;
    el.querySelectorAll('[data-action="logout"]').forEach((b) => b.addEventListener('click', () => EC.logout()));
  }

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.outerHTML = `
      <footer class="site-footer" id="site-footer">
        <div class="container">
          <div class="row gap-row">
            <div class="col-lg-4 col-md-12">
              <a class="brand mb-3" href="index.html"><span class="brand-mark" aria-hidden="true"><i class="bi bi-arrow-repeat"></i></span>EduCycle</a>
              <p class="mb-0" style="max-width: 22rem">A campus platform for students to donate, lend and exchange textbooks, notes, calculators and lab equipment.</p>
            </div>
            <div class="col-6 col-md-4 col-lg-2 offset-lg-1"><h2>Platform</h2><ul>
              <li><a href="browse.html">Browse resources</a></li><li><a href="list-resource.html">List a resource</a></li>
              <li><a href="request-board.html">Community requests</a></li><li><a href="locations.html">Pickup points</a></li></ul></div>
            <div class="col-6 col-md-4 col-lg-2"><h2>Support</h2><ul>
              <li><a href="help.html">Help &amp; FAQ</a></li><li><a href="grievances.html">Report a problem</a></li></ul></div>
          </div>
          <div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} EduCycle.</span><a href="admin-login.html">Administrator access</a></div>
        </div>
      </footer>`;
  }

  async function refreshBell() {
    const c = document.getElementById('navBellCount');
    if (!c || !EC.user) return;
    try {
      const { unreadCount } = await EC.api('/notifications/count');
      c.textContent = unreadCount > 99 ? '99+' : unreadCount;
      c.classList.toggle('d-none', !unreadCount);
      const bell = document.getElementById('navBell');
      if (bell) bell.setAttribute('aria-label', unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications');
    } catch (_) { /* non-critical */ }
  }
  EC.refreshBell = refreshBell;

  /**
   * Entry point for every page: EC.page(async ({ user, meta }) => {...})
   * body[data-auth="student"] pages redirect to login when signed out.
   */
  EC.page = function page(init) {
    const run = async () => {
      const user = await EC.session();
      if (document.body.dataset.area !== 'admin') { renderNav(user); renderFooter(); }
      showFlash();
      const need = document.body.dataset.auth;
      if (need === 'student' && !user) {
        location.replace(`login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      if (need === 'student' && user && user.role !== 'student') {
        const main = document.getElementById('main');
        if (main) main.innerHTML = `<div class="container py-5">${EC.state({ icon: 'bi-shield-lock', title: 'This page is for student accounts', text: 'You are signed in as an administrator. Use the admin dashboard to manage the platform.', actions: '<a class="btn btn-dark" href="admin.html">Open admin dashboard</a>' })}</div>`;
        return;
      }
      if (user && user.role === 'student') { refreshBell(); setInterval(refreshBell, 60000); }
      try {
        await init({ user });
      } catch (err) {
        console.error(err);
        EC.toast(err.message || 'Something went wrong.', { error: true });
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  };
})();
