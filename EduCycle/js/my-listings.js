'use strict';

/* My listings: manage what you give (edit, delete), grouped by status */
(function () {
  const el = (id) => document.getElementById(id);
  const TABS = ['', 'Available', 'Reserved', 'Unavailable'];
  let current = '';
  let pendingDeleteId = null;

  const mine = (state) => state.resources.filter((r) => r.ownerId === state.currentUser.id);

  function row(r) {
    return `
      <div class="listing manage${r.status === 'Unavailable' ? ' is-closed' : ''}">
        <span class="listing-glyph ${categoryClass(r.category)}"><i class="bi ${categoryIcon(r.category)}" aria-hidden="true"></i></span>
        <span class="listing-main">
          <a class="listing-name" href="resource-details.html?id=${r.id}">${esc(r.name)}</a>
          <span class="listing-meta">${esc(r.category)} · Qty ${esc(r.quantity)} · ${esc(r.location)}</span>
        </span>
        <span class="listing-sub">${typeTag(r.type)}${statusDot(r.status)}</span>
        <span class="row-actions">
          <a class="btn btn-sm btn-outline-eco" href="list-resource.html?edit=${r.id}">Edit</a>
          <button class="btn btn-sm btn-soft-danger" type="button" data-delete="${r.id}">Delete</button>
        </span>
      </div>`;
  }

  function render(state) {
    const items = sortListings(mine(state));
    el('listingsTabs').querySelectorAll('button').forEach((btn) => {
      const status = btn.dataset.status;
      btn.classList.toggle('active', status === current);
      btn.setAttribute('aria-selected', String(status === current));
      btn.querySelector('.n').textContent = status ? items.filter((r) => r.status === status).length : items.length;
    });

    const shown = current ? items.filter((r) => r.status === current) : items;
    el('manageList').innerHTML = shown.map(row).join('');
    el('manageList').classList.toggle('d-none', shown.length === 0);
    el('manageEmpty').classList.toggle('d-none', shown.length > 0);
    el('emptyText').textContent = items.length === 0
      ? 'You have not listed anything yet.'
      : `Nothing is currently ${current.toLowerCase()}.`;
  }

  function bindDelete(state) {
    el('manageList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delete]');
      if (!btn) return;
      pendingDeleteId = Number(btn.dataset.delete);
      const resource = state.resources.find((r) => r.id === pendingDeleteId);
      el('deleteName').textContent = resource ? resource.name : 'this listing';
      bootstrap.Modal.getOrCreateInstance(el('deleteModal')).show();
    });
    el('confirmDelete').addEventListener('click', () => {
      if (pendingDeleteId === null) return;
      deleteResource(state, pendingDeleteId);
      pendingDeleteId = null;
      bootstrap.Modal.getOrCreateInstance(el('deleteModal')).hide();
      render(state);
      showToast('Listing deleted.');
    });
  }

  PAGES.listings = (state) => {
    if (!requireLogin(state)) return;
    el('listingsTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-status]');
      if (!btn || !TABS.includes(btn.dataset.status)) return;
      current = btn.dataset.status;
      render(state);
    });
    bindDelete(state);
    render(state);
  };
})();
