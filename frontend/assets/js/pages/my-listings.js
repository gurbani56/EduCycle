/* My listings: status tabs, availability toggle, edit and delete. */
EC.page(async () => {
  const { $, $$, esc } = EC;
  let status = '';
  let items = [];

  function row(r) {
    const loc = r.location;
    const disabled = r.moderation && r.moderation.state === 'disabled';
    const toggle = r.status === 'Reserved' || disabled ? ''
      : `<button class="btn btn-outline-secondary btn-sm" type="button" data-toggle="${esc(r.id)}">${r.status === 'Available' ? '<i class="bi bi-pause-circle" aria-hidden="true"></i>Mark unavailable' : '<i class="bi bi-play-circle" aria-hidden="true"></i>Mark available'}</button>`;
    return `
      <tr>
        <td>
          <div class="d-flex gap-3 align-items-center">
            <span class="thumb" aria-hidden="true"><i class="bi ${EC.catIcon(r.category)}"></i></span>
            <div class="min-w-0">
              <a class="row-link" href="resource-details.html?id=${esc(r.id)}">${esc(r.title)}</a>
              <div class="meta">${esc(r.category)} · ${esc(r.condition)} · listed ${EC.fmtDate(r.createdAt)}</div>
              ${disabled ? `<div class="small text-danger mt-1"><i class="bi bi-slash-circle" aria-hidden="true"></i> Disabled by an administrator: ${esc(r.moderation.reason)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${EC.typeBadge(r.type)}</td>
        <td>${disabled ? EC.badge('b-red', 'bi-slash-circle', 'Disabled') : EC.resourceStatusBadge(r.status)}</td>
        <td><div class="small">${esc(loc ? loc.name : '—')}</div>${loc && !loc.usable ? `<div class="mt-1">${EC.locationStatusBadge(loc)}</div>` : ''}</td>
        <td>${r.openRequests ? `<a href="activity.html?tab=needs" class="small fw-semibold">${EC.plural(r.openRequests, 'open request')}${r.pendingRequests ? ` (${r.pendingRequests} new)` : ''}</a>` : '<span class="small text-muted">None</span>'}</td>
        <td class="text-end">
          <div class="d-flex gap-2 justify-content-end flex-wrap">
            ${toggle}
            <a class="btn btn-outline-secondary btn-sm" href="list-resource.html?id=${esc(r.id)}" aria-label="Edit ${esc(r.title)}"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</a>
            <button class="btn btn-outline-danger btn-sm" type="button" data-delete="${esc(r.id)}" aria-label="Delete ${esc(r.title)}"><i class="bi bi-trash" aria-hidden="true"></i></button>
          </div>
        </td>
      </tr>`;
  }

  function render() {
    const shown = status ? items.filter((r) => r.status === status) : items;
    if (!items.length) {
      $('#list').innerHTML = EC.state({ icon: 'bi-box-seam', title: 'You have not listed anything yet', text: 'List a textbook, calculator or lab kit you no longer need. It takes about two minutes.', actions: '<a class="btn btn-primary" href="list-resource.html">List a resource</a>' });
      return;
    }
    if (!shown.length) { $('#list').innerHTML = EC.state({ icon: 'bi-filter', title: `No ${status.toLowerCase()} listings` }); return; }
    $('#list').innerHTML = `<div class="table-wrap"><div class="table-responsive"><table class="table table-hover align-middle">
      <thead><tr><th scope="col">Listing</th><th scope="col">Type</th><th scope="col">Availability</th><th scope="col">Pickup point</th><th scope="col">Requests</th><th scope="col" class="text-end"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${shown.map(row).join('')}</tbody></table></div></div>`;
  }

  async function load() {
    $('#list').innerHTML = EC.loadingBlock('Loading your listings…');
    try {
      const data = await EC.api('/resources/mine');
      items = data.items;
      const c = data.statusCounts;
      $$('[data-n]').forEach((el) => { const k = el.dataset.n; el.textContent = k ? (c[k] || 0) : items.length; });
      render();
    } catch (err) {
      $('#list').innerHTML = EC.errorState(err, 'retry');
      $('#retry').addEventListener('click', load);
    }
  }

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]'); if (!b) return;
    status = b.dataset.status;
    $$('#tabs .nav-link').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b); });
    render();
  });

  $('#list').addEventListener('click', async (e) => {
    const tg = e.target.closest('[data-toggle]');
    const del = e.target.closest('[data-delete]');
    if (tg) {
      const r = items.find((x) => x.id === tg.dataset.toggle);
      const to = r.status === 'Available' ? 'Unavailable' : 'Available';
            tg.disabled = true;
      try {
        await EC.api(`/resources/${r.id}`, { method: 'PATCH', body: { status: to } });
        EC.toast(`“${r.title}” is now ${to.toLowerCase()}.`);
        load();
      } catch (err) { EC.toast(err.message, { error: true }); tg.disabled = false; }
    }
    if (del) {
      const r = items.find((x) => x.id === del.dataset.delete);
      const ok = await EC.confirm({
        title: 'Delete this listing?', danger: true, confirmText: 'Delete listing',
        body: `<strong>${esc(r.title)}</strong> will be removed from Browse. Any pending requests will be cancelled and the students notified. This cannot be undone.`,
      });
      if (!ok) return;
      try {
        await EC.api(`/resources/${r.id}`, { method: 'DELETE' });
        EC.toast('Listing deleted.');
        load();
      } catch (err) { EC.toast(err.message, { error: true }); }
    }
  });

  load();
});
