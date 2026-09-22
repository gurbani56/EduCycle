'use strict';

/* ==========================================================
   EduCycle: shared helpers

   * Data is loaded from data/data.json with fetch() and kept in
     sessionStorage, so the pages behave like a working app.
   * Each page has its own script that registers an init function in PAGES.
   * When a backend exists, only the functions in the "Data layer" and
     "State changes" sections need to call the API instead.
   ========================================================== */

const STORAGE_KEY = 'educycle_state_v2';
const PAGES = {};

const CATEGORIES = ['Books', 'Notes', 'Electronics', 'Calculators', 'Lab Equipment'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const TYPES = ['Donate', 'Lend', 'Exchange'];
const DEPARTMENTS = ['Computer Engineering', 'Information Technology', 'Electronics & Computer', 'Mechanical Engineering', 'All Departments'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const STEPS = ['Pending', 'Accepted', 'Handed Over', 'Completed'];
const OPEN_STATUSES = ['Pending', 'Accepted', 'Handed Over'];

/* ---------------- Small utilities ---------------- */

/** Escape text before inserting it into HTML (prevents script injection). */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const formatINR = (n) => '₹' + Number(n).toLocaleString('en-IN');
const todayISO = () => new Date().toISOString().slice(0, 10);
const nextId = (list) => list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
const getParam = (name) => new URLSearchParams(window.location.search).get(name);
const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Fill a <select>. options = array of strings or {value, label}. */
function fillSelect(select, options, placeholder) {
  if (!select) return;
  const first = placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '';
  select.innerHTML = first + options.map((o) => {
    const value = typeof o === 'object' ? o.value : o;
    const label = typeof o === 'object' ? o.label : o;
    return `<option value="${esc(value)}">${esc(label)}</option>`;
  }).join('');
}

const semesterOptions = () => SEMESTERS.map((s) => ({ value: s, label: 'Semester ' + s }));

/* ---------------- Data layer (fetch + sessionStorage) ---------------- */

async function fetchBaseData() {
  // Opened directly from disk (file://): browsers block fetch(), so use the bundled copy of the data.
  if (window.location.protocol === 'file:' && window.EDUCYCLE_FALLBACK_DATA) {
    return JSON.parse(JSON.stringify(window.EDUCYCLE_FALLBACK_DATA));
  }
  try {
    const response = await fetch('data/data.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (err) {
    if (window.EDUCYCLE_FALLBACK_DATA) return JSON.parse(JSON.stringify(window.EDUCYCLE_FALLBACK_DATA));
    throw err;
  }
}

async function loadState() {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* corrupted: reload below */ }
  }
  const state = await fetchBaseData();
  state.session = { loggedIn: false };
  saveState(state);
  return state;
}

const saveState = (state) => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));

/** Development helper (not shown in the UI): open any page with ?reset=1 to restore the sample data. */
function handleResetParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('reset')) return false;
  sessionStorage.removeItem(STORAGE_KEY);
  url.searchParams.delete('reset');
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

/* ---------------- Authentication (demo) ---------------- */

const isLoggedIn = (state) => Boolean(state.session && state.session.loggedIn);

function login(state) {
  state.session = { loggedIn: true, email: state.currentUser.email };
  saveState(state);
}

function logout(state) {
  state.session = { loggedIn: false };
  saveState(state);
  window.location.href = 'index.html';
}

/** Redirect to the login page if the visitor is not logged in. Returns true when allowed. */
function requireLogin(state) {
  if (isLoggedIn(state)) return true;
  const here = window.location.pathname.split('/').pop() + window.location.search;
  window.location.href = 'login.html?required=1&next=' + encodeURIComponent(here);
  return false;
}

/** Only allow redirects to our own pages. */
const safeNext = (next) => (/^[a-z-]+\.html(\?[\w=&%-]*)?$/i.test(next || '') ? next : 'browse.html');

/* ---------------- State changes: resources and requests ---------------- */

function addResource(state, data) {
  const resource = {
    id: nextId(state.resources), ownerId: state.currentUser.id, ownerName: state.currentUser.name,
    status: 'Available', createdAt: todayISO(), ...data
  };
  state.resources.push(resource);
  saveState(state);
  return resource;
}

function updateResource(state, id, data) {
  const resource = state.resources.find((r) => r.id === id);
  if (!resource) return null;
  Object.assign(resource, data);
  saveState(state);
  return resource;
}

function deleteResource(state, id) {
  state.resources = state.resources.filter((r) => r.id !== id);
  saveState(state);
}

function addRequest(state, resource, message) {
  const request = {
    id: nextId(state.requests), resourceId: resource.id, resourceName: resource.name, category: resource.category,
    quantity: resource.quantity, type: resource.type, requesterId: state.currentUser.id, requesterName: state.currentUser.name,
    ownerId: resource.ownerId, ownerName: resource.ownerName, status: 'Pending', message: message || '', date: todayISO()
  };
  state.requests.push(request);
  saveState(state);
  return request;
}

/** Move a request/transaction to a new status and apply side effects on the resource. */
function setRequestStatus(state, id, status) {
  const request = state.requests.find((r) => r.id === id);
  if (!request) return { ok: false, message: 'Request not found.' };
  const resource = state.resources.find((r) => r.id === request.resourceId);

  if (status === 'Accepted' && resource && resource.status !== 'Available') {
    return { ok: false, message: 'This resource is already reserved for another request.' };
  }
  request.status = status;
  if (resource) {
    if (status === 'Accepted') resource.status = 'Reserved';
    if (status === 'Completed') resource.status = 'Unavailable';
  }
  saveState(state);
  return { ok: true };
}

/** The current user's most recent request for a resource (or undefined). */
function latestRequestFor(state, resourceId) {
  return state.requests
    .filter((r) => r.resourceId === resourceId && r.requesterId === state.currentUser.id)
    .sort((a, b) => b.id - a.id)[0];
}

/** Requests the current user must act on as the owner (respond, hand over, confirm). */
const actionCount = (state) => state.requests.filter((r) => r.ownerId === state.currentUser.id && OPEN_STATUSES.includes(r.status)).length;

/* ---------------- Impact ---------------- */

function impactOf(state, category, quantity) {
  const factor = state.impactFactors[category] || { money: 0, co2: 0 };
  const qty = quantity || 1;
  return { money: factor.money * qty, co2: Math.round(factor.co2 * qty * 10) / 10 };
}

const formatImpact = (i) => `${formatINR(i.money)} saved · ${i.co2} kg CO₂ avoided`;

/** Total impact of the user's completed exchanges. */
function calcImpact(state) {
  const uid = state.currentUser.id;
  const total = { count: 0, money: 0, co2: 0 };
  state.requests
    .filter((r) => r.status === 'Completed' && (r.ownerId === uid || r.requesterId === uid))
    .forEach((r) => {
      const i = impactOf(state, r.category, r.quantity);
      total.count += 1; total.money += i.money; total.co2 += i.co2;
    });
  total.co2 = Math.round(total.co2 * 10) / 10;
  return total;
}

/* ---------------- Reusable HTML builders ---------------- */

const CATEGORY_ICONS = { 'Books': 'bi-book', 'Notes': 'bi-journal-text', 'Electronics': 'bi-cpu', 'Calculators': 'bi-calculator', 'Lab Equipment': 'bi-tools' };
const CATEGORY_CLASS = { 'Books': 'cat-books', 'Notes': 'cat-notes', 'Electronics': 'cat-electronics', 'Calculators': 'cat-calculators', 'Lab Equipment': 'cat-lab' };
const STATUS_CLASS = {
  'Available': 'available', 'Reserved': 'reserved', 'Unavailable': 'unavailable', 'Pending': 'pending', 'Accepted': 'accepted',
  'Handed Over': 'handed', 'Completed': 'completed', 'Rejected': 'rejected', 'Cancelled': 'cancelled'
};

const categoryIcon = (c) => CATEGORY_ICONS[c] || 'bi-box-seam';
const categoryClass = (c) => CATEGORY_CLASS[c] || 'cat-other';
const typeTag = (type) => `<span class="tag tag-${esc(String(type).toLowerCase())}">${esc(type)}</span>`;
const statusDot = (status, label) => `<span class="status status-${STATUS_CLASS[status] || 'pending'}">${esc(label || status)}</span>`;

/** Available first, then reserved, then unavailable; newest first inside each group. */
function sortListings(list) {
  const rank = { Available: 0, Reserved: 1, Unavailable: 2 };
  return [...list].sort((a, b) =>
    (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || (b.createdAt || '').localeCompare(a.createdAt || '') || b.id - a.id);
}

/** One resource as a row in a list (used on Home, Browse and Details). */
function listingRow(r) {
  return `
    <a class="listing${r.status === 'Unavailable' ? ' is-closed' : ''}" href="resource-details.html?id=${r.id}">
      <span class="listing-glyph ${categoryClass(r.category)}"><i class="bi ${categoryIcon(r.category)}" aria-hidden="true"></i></span>
      <span class="listing-main">
        <span class="listing-name">${esc(r.name)}</span>
        <span class="listing-meta">${esc(r.category)} · ${esc(r.condition)} · ${esc(r.location)}</span>
      </span>
      <span class="listing-sub">${typeTag(r.type)}${statusDot(r.status)}<span class="listing-owner">${esc(r.ownerName)}</span></span>
      <span class="listing-go" aria-hidden="true">→</span>
    </a>`;
}

/** Status stepper: Pending → Accepted → Handed Over → Completed. Pass '' for a neutral preview. */
function stepper(status) {
  if (status === 'Rejected' || status === 'Cancelled') return '';
  const index = STEPS.indexOf(status);
  const allDone = status === 'Completed';
  const items = STEPS.map((step, i) => {
    const done = allDone || i < index;
    const current = !allDone && i === index;
    const dot = done ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : i + 1;
    return `<li class="${done ? 'done' : current ? 'current' : ''}"><span class="dot">${dot}</span><span class="lbl">${step}</span></li>`;
  }).join('');
  return `<ol class="stepper" aria-label="Exchange progress">${items}</ol>`;
}

/** Plain-language status of a request, from the current user's point of view. */
function requestStatusText(state, req) {
  const isOwner = req.ownerId === state.currentUser.id;
  switch (req.status) {
    case 'Pending': return isOwner ? 'Waiting for your response' : `Waiting for ${req.ownerName} to respond`;
    case 'Accepted': return isOwner ? 'You accepted. Arrange the hand-over' : `Accepted by ${req.ownerName}`;
    case 'Handed Over': return isOwner ? 'Handed over. Mark it complete once confirmed' : `Handed over by ${req.ownerName}`;
    case 'Completed': return 'Completed';
    case 'Rejected': return isOwner ? 'You declined this request' : `Declined by ${req.ownerName}`;
    case 'Cancelled': return 'Request cancelled';
    default: return req.status;
  }
}

/** Grouped facts about an exchange: status, person, pick-up, impact. */
function exchangeMeta(state, req) {
  const isOwner = req.ownerId === state.currentUser.id;
  const resource = state.resources.find((r) => r.id === req.resourceId);
  const rows = [
    ['Status', statusDot(req.status, requestStatusText(state, req))],
    [isOwner ? 'Requested by' : 'Owner', `${esc(isOwner ? req.requesterName : req.ownerName)} <span class="sub">· ${formatDate(req.date)}</span>`]
  ];
  if (['Accepted', 'Handed Over'].includes(req.status) && resource) rows.push(['Pick-up', esc(resource.location)]);
  if (req.status === 'Completed') rows.push(['Impact', formatImpact(impactOf(state, req.category, req.quantity))]);
  if (req.message) rows.push(['Note', `<span class="sub">“${esc(req.message)}”</span>`]);
  return `<dl class="meta-list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

/* ---------------- Toast notifications ---------------- */

function showToast(message, type = 'success') {
  const area = document.getElementById('toast-area');
  if (!area) return;
  const el = document.createElement('div');
  el.className = `toast align-items-center border-0 ${type === 'error' ? 'toast-eco-error' : 'toast-eco-success'}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  area.appendChild(el);
  el.addEventListener('hidden.bs.toast', () => el.remove());
  new bootstrap.Toast(el, { delay: 3500 }).show();
}

/* ---------------- Navbar & footer ---------------- */

function renderNavbar(state) {
  const active = document.body.dataset.active || document.body.dataset.page;
  const logged = isLoggedIn(state);
  const badge = logged ? actionCount(state) : 0;

  const links = [
    { key: 'browse', href: 'browse.html', label: 'Browse' },
    { key: 'board', href: 'request-board.html', label: 'Request board' }
  ];
  if (logged) links.push({ key: 'activity', href: 'activity.html', label: 'Activity', badge });

  const linkItems = links.map((l) =>
    `<li class="nav-item"><a class="nav-link ${l.key === active ? 'active' : ''}" href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''}>${l.label}${l.badge ? `<span class="nav-badge" aria-label="${l.badge} need your action">${l.badge}</span>` : ''}</a></li>`).join('');

  const account = logged
    ? `<div class="dropdown">
         <button class="btn p-0 border-0" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Account menu"><span class="avatar">${esc(initials(state.currentUser.name))}</span></button>
         <ul class="dropdown-menu dropdown-menu-end">
           <li><span class="dropdown-item-text small text-muted">${esc(state.currentUser.name)}</span></li>
           <li><a class="dropdown-item" href="my-listings.html">My listings</a></li>
           <li><a class="dropdown-item" href="list-resource.html">Give a resource</a></li>
           <li><hr class="dropdown-divider"></li>
           <li><button class="dropdown-item" id="logoutBtn" type="button">Log out</button></li>
         </ul>
       </div>`
    : `<a class="nav-plain" href="login.html">Log in</a>
       <a class="btn btn-accent btn-sm" href="login.html#register">Sign up</a>`;

  document.getElementById('site-nav').innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-eco sticky-top" data-bs-theme="dark" aria-label="Main navigation">
      <div class="container">
        <a class="navbar-brand" href="index.html">EduCycle</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu"
                aria-controls="navMenu" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="navMenu">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">${linkItems}</ul>
          <div class="nav-tools">
            <form class="nav-search" id="navSearch" role="search">
              <input type="search" id="navSearchInput" placeholder="Search resources" aria-label="Search resources" autocomplete="off">
              <button type="submit" aria-label="Search"><i class="bi bi-search" aria-hidden="true"></i></button>
            </form>
            ${account}
          </div>
        </div>
      </div>
    </nav>`;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout(state));

  const searchForm = document.getElementById('navSearch');
  const searchInput = document.getElementById('navSearchInput');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) { searchInput.focus(); return; }
    window.location.href = 'browse.html?q=' + encodeURIComponent(q);
  });

  // Press "/" anywhere to jump to search
  if (!window.__searchShortcutBound) {
    window.__searchShortcutBound = true;
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !e.metaKey && !e.ctrlKey) {
        const input = document.getElementById('navSearchInput');
        if (input) { e.preventDefault(); input.focus(); }
      }
    });
  }
}

function renderFooter(state) {
  const logged = isLoggedIn(state);
  const accountLinks = logged
    ? `<a href="my-listings.html">My listings</a><a href="activity.html">Your activity</a><a href="list-resource.html">Give a resource</a>`
    : `<a href="login.html">Log in</a><a href="login.html#register">Register</a><a href="list-resource.html">List a resource</a>`;
  document.getElementById('site-footer').innerHTML = `
    <footer class="site-footer tex-purple">
      <div class="container footer-grid">
        <div class="footer-brand">
          <div class="footer-logo"><span class="icon-circle" aria-hidden="true"><i class="bi bi-recycle"></i></span>EduCycle</div>
          <p>Educational resource reuse and exchange platform. Donate, lend, borrow and exchange academic resources on your campus.</p>
        </div>
        <nav class="footer-col" aria-label="Explore">
          <h3>Explore</h3>
          <a href="browse.html">Browse resources</a>
          <a href="request-board.html">Request board</a>
          <a href="index.html#how-it-works">How it works</a>
        </nav>
        <nav class="footer-col" aria-label="Account">
          <h3>Account</h3>
          ${accountLinks}
        </nav>
      </div>
    </footer>`;
}

/* ---------------- Page bootstrap ---------------- */

function showFatalError(err) {
  console.error(err);
  const main = document.getElementById('main');
  if (main) {
    main.innerHTML = `<div class="container py-5"><div class="alert alert-danger">
      <strong>Could not load the data.</strong> Open the site with VS Code “Live Server”, or run
      <code>python -m http.server</code> in this folder, and try again.</div></div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (handleResetParam()) return;
  let state;
  try {
    state = await loadState();
  } catch (err) {
    showFatalError(err);
    return;
  }
  renderNavbar(state);
  renderFooter(state);
  const init = PAGES[document.body.dataset.page];
  if (init) init(state);
});
