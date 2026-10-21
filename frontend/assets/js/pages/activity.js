/* Your activity: the exchange workflow for both owners and requesters. */
EC.page(async () => {
  const { $, $$, esc } = EC;
  const tabs = ['needs', 'waiting', 'history'];
  let tab = tabs.includes(EC.params().get('tab')) ? EC.params().get('tab') : 'needs';
  let items = [];
  let locations = [];

  const STEPS = ['Pending', 'Accepted', 'Handed Over', 'Completed'];
  function stepper(q) {
    const lend = q.resourceType === 'Lend';
    const labels = ['Requested', 'Accepted', lend ? 'On loan' : 'Handed over', lend ? 'Returned' : 'Completed'];
    const stopped = ['Declined', 'Cancelled'].includes(q.status);
    // For stopped requests, show progress up to the last real step reached.
    let idx = STEPS.indexOf(q.status);
    if (stopped) {
      const reached = (q.history || []).map((h) => STEPS.indexOf(h.status)).filter((i) => i >= 0);
      idx = reached.length ? Math.max(...reached) : 0;
    }
    return `<ol class="stepper${stopped ? ' is-stopped' : ''}" aria-label="Progress: ${esc(q.status)}">
      ${labels.map((l, i) => {
        const cls = i < idx || (q.status === 'Completed' && i === idx) ? 'done' : i === idx ? 'current' : '';
        const icon = cls === 'done' ? '<i class="bi bi-check" aria-hidden="true"></i>' : (stopped && i === idx ? '<i class="bi bi-x" aria-hidden="true"></i>' : i + 1);
        return `<li class="${cls}"><span class="dot">${icon}</span>${esc(stopped && i === idx ? q.status : l)}</li>`;
      }).join('')}
    </ol>`;
  }

  function actions(q) {
    const lend = q.resourceType === 'Lend';
    const a = [];
    let hint = '';
    const locBad = q.location && !q.location.usable;
    if (q.role === 'owner') {
      if (q.status === 'Pending') {
        hint = 'Accepting reserves the item for this student.';
        a.push(`<button class="btn btn-primary btn-sm" data-act="accept" data-id="${q.id}"><i class="bi bi-check-lg" aria-hidden="true"></i>Accept</button>`);
        a.push(`<button class="btn btn-outline-secondary btn-sm" data-act="decline" data-id="${q.id}">Decline</button>`);
      } else if (q.status === 'Accepted') {
        hint = locBad ? 'The pickup point is no longer approved. Choose another one before handing over.' : 'Mark as handed over once the student has the item.';
        a.push(`<button class="btn btn-primary btn-sm" data-act="handover" data-id="${q.id}" ${locBad ? 'disabled' : ''}><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Mark as handed over</button>`);
        a.push(`<button class="btn btn-outline-secondary btn-sm" data-act="location" data-id="${q.id}"><i class="bi bi-geo-alt" aria-hidden="true"></i>Change pickup point</button>`);
      } else if (q.status === 'Handed Over' && lend) {
        hint = 'Confirm once the item has been returned to you.';
        a.push(`<button class="btn btn-primary btn-sm" data-act="complete" data-id="${q.id}"><i class="bi bi-check2-circle" aria-hidden="true"></i>Confirm returned</button>`);
      } else if (q.status === 'Handed Over') {
        hint = 'Waiting for the student to confirm they received it.';
      }
    } else if (q.role === 'requester') {
      if (q.status === 'Pending') {
        hint = 'Waiting for the owner to accept or decline.';
        a.push(`<button class="btn btn-outline-secondary btn-sm" data-act="cancel" data-id="${q.id}">Cancel request</button>`);
      } else if (q.status === 'Accepted') {
        hint = q.location ? `Meet the owner at ${esc(q.location.name)}.` : 'Arrange the pickup with the owner.';
        a.push(`<button class="btn btn-outline-secondary btn-sm" data-act="cancel" data-id="${q.id}">Cancel request</button>`);
      } else if (q.status === 'Handed Over' && !lend) {
        hint = 'Confirm once you have received the item.';
        a.push(`<button class="btn btn-primary btn-sm" data-act="complete" data-id="${q.id}"><i class="bi bi-check2-circle" aria-hidden="true"></i>Confirm received</button>`);
      } else if (q.status === 'Handed Over') {
        hint = 'Return the item to the owner when you are done. They will confirm the return.';
      }
    }
    if (q.status !== 'Pending') a.push(`<a class="btn btn-link btn-sm ms-1" href="grievances.html?request=${q.id}"><i class="bi bi-flag" aria-hidden="true"></i>Report a problem</a>`);
    if (!a.length && !hint) return '';
    return `<div class="xchg-actions">${hint ? `<span class="hint">${hint}</span>` : ''}${a.join('')}</div>`;
  }

  function card(q) {
    const other = q.role === 'owner' ? q.requester : q.owner;
    const who = q.role === 'owner' ? `<strong class="text-ink">${esc(other.name)}</strong> requested your item` : `You requested from <strong class="text-ink">${esc(other.name)}</strong>`;
    const resLink = q.resource.deleted ? `<span>${esc(q.resource.title)} <span class="small text-muted">(listing removed)</span></span>` : `<a href="resource-details.html?id=${esc(q.resource.id)}">${esc(q.resource.title)}</a>`;
    const lastNote = [...(q.history || [])].reverse().find((h) => h.note && ['Declined', 'Cancelled'].includes(h.status));
    return `
      <article class="xchg" id="req-${q.id}">
        <div class="xchg-head">
          <span class="thumb" aria-hidden="true"><i class="bi ${EC.catIcon(q.resource.category)}"></i></span>
          <div class="grow">
            <h2 class="xchg-title">${resLink}</h2>
            <div class="meta">${who} · ${EC.timeAgo(q.createdAt)}</div>
            <div class="d-flex flex-wrap gap-2 mt-2">${EC.typeBadge(q.resourceType)}${EC.requestStatusBadge(q.status, q.resourceType)}</div>
          </div>
        </div>
        <div class="xchg-grid">
          <div>${stepper(q)}</div>
          <dl class="dl-grid mb-0">
            <dt>Pickup point</dt><dd>${q.location ? `${esc(q.location.name)}${q.location.area ? `<span class="d-block small text-muted">${esc(q.location.area)}</span>` : ''}${!q.location.usable ? `<span class="d-block mt-1">${EC.locationStatusBadge(q.location)}</span>` : ''}` : '—'}</dd>
            <dt>Last update</dt><dd>${EC.fmtDateTime(q.updatedAt)}</dd>
          </dl>
        </div>
        ${q.message ? `<p class="quote mt-3"><span class="visually-hidden">Message from ${esc(q.requester.name)}: </span>${esc(q.message)}</p>` : ''}
        ${q.offerDetails ? `<p class="quote mt-2"><strong>Offered in exchange:</strong> ${esc(q.offerDetails)}</p>` : ''}
        ${q.ownerNote ? `<p class="quote mt-2"><strong>Note from owner:</strong> ${esc(q.ownerNote)}</p>` : ''}
        ${lastNote ? `<p class="quote mt-2"><strong>${esc(lastNote.status)}:</strong> ${esc(lastNote.note)}</p>` : ''}
        ${actions(q)}
      </article>`;
  }

  const empty = {
    needs: { icon: 'bi-check2-all', title: 'Nothing needs your action', text: 'When someone requests one of your items, or an item is handed to you, it will appear here.', actions: '<a class="btn btn-outline-secondary" href="list-resource.html">List a resource</a>' },
    waiting: { icon: 'bi-hourglass', title: 'You are not waiting on anyone', text: 'Requests you send to other students appear here until they are completed.', actions: '<a class="btn btn-primary" href="browse.html">Browse resources</a>' },
    history: { icon: 'bi-clock-history', title: 'No past exchanges yet', text: 'Completed, declined and cancelled requests are kept here for your records.' },
  };

  function render() {
    $$('#tabs .nav-link').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    const shown = items.filter((q) => q.bucket === tab);
    $('#list').innerHTML = shown.length ? shown.map(card).join('') : EC.state(empty[tab]);
  }

  async function load() {
    $('#list').innerHTML = EC.loadingBlock('Loading your exchanges…');
    try {
      const data = await EC.api('/requests/mine');
      items = data.items;
      $$('[data-n]').forEach((el) => {
        const n = data.counts[el.dataset.n] || 0;
        el.textContent = n;
        el.classList.toggle('attn', el.dataset.n === 'needs' && n > 0);
      });
      render();
      EC.refreshBell();
    } catch (err) {
      $('#list').innerHTML = EC.errorState(err, 'retry');
      $('#retry').addEventListener('click', load);
    }
  }

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; EC.setParams({ tab }); render();
  });

  /* ---- Accept / change location modal ---- */
  const modalEl = $('#acceptModal');
  const modal = new bootstrap.Modal(modalEl);
  const form = $('#acceptForm');
  let modalMode = null;
  let modalReq = null;

  async function openLocationModal(q, mode) {
    if (!locations.length) locations = (await EC.api('/locations')).items;
    modalMode = mode; modalReq = q;
    EC.form.clear(form); form.reset();
    const current = q.location && q.location.usable ? q.location.id : '';
    EC.fillSelect($('#acceptLocation'), locations.map((l) => ({ value: l.id, label: l.area ? `${l.name} — ${l.area}` : l.name })), { placeholder: 'Choose a pickup point', value: current });
    $('#acceptTitle').textContent = mode === 'accept' ? 'Accept request' : 'Change pickup point';
    $('#acceptIntro').innerHTML = mode === 'accept'
      ? `Accept <strong>${esc(q.requester.name)}</strong>’s request for <strong>${esc(q.resource.title)}</strong>? The item will be reserved for them.`
      : `Choose a new approved pickup point for <strong>${esc(q.resource.title)}</strong>. ${esc(q.requester.name)} will be notified.`;
    $('#acceptNoteWrap').classList.toggle('d-none', mode !== 'accept');
    $('#acceptSubmit').textContent = mode === 'accept' ? 'Accept request' : 'Save pickup point';
    modal.show();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(form);
    const v = EC.form.values(form);
    if (!v.locationId) return EC.form.errors(form, { locationId: 'Choose a pickup point.' });
    const btn = $('#acceptSubmit');
    EC.form.busy(btn, true);
    try {
      if (modalMode === 'accept') await EC.api(`/requests/${modalReq.id}/accept`, { method: 'PATCH', body: { locationId: v.locationId, ownerNote: v.ownerNote } });
      else await EC.api(`/requests/${modalReq.id}/location`, { method: 'PATCH', body: { locationId: v.locationId } });
      modal.hide();
      EC.toast(modalMode === 'accept' ? 'Request accepted. The student has been notified.' : 'Pickup point updated.');
      load();
    } catch (err) { EC.form.handleError(form, err); } finally { EC.form.busy(btn, false); }
  });

  /* ---- Other actions ---- */
  $('#list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const q = items.find((x) => x.id === b.dataset.id);
    const act = b.dataset.act;
    if (act === 'accept' || act === 'location') { openLocationModal(q, act); return; }

    const lend = q.resourceType === 'Lend';
    const dialogs = {
      decline: { title: 'Decline this request?', body: `${esc(q.requester.name)} will be told you could not accept.`, confirmText: 'Decline request', danger: true, reason: { label: 'Reason for the student', placeholder: 'e.g. Already promised to someone else' } },
      cancel: { title: 'Cancel your request?', body: q.status === 'Accepted' ? 'The owner has already accepted. They will be notified and the item will become available again.' : 'The owner will be notified.', confirmText: 'Cancel request', danger: true },
      handover: { title: 'Mark as handed over?', body: lend ? 'Confirm that the student now has the item on loan.' : 'Confirm that you have given the item to the student. They will be asked to confirm receipt.', confirmText: 'Yes, handed over' },
      complete: { title: lend ? 'Confirm the item was returned?' : 'Confirm you received the item?', body: lend ? 'This completes the loan and makes your listing available again.' : 'This completes the exchange.', confirmText: lend ? 'Confirm returned' : 'Confirm received' },
    };
    const ok = await EC.confirm(dialogs[act]);
    if (!ok) return;
    try {
      await EC.api(`/requests/${q.id}/${act}`, { method: 'PATCH', body: ok.reason !== undefined ? { note: ok.reason } : {} });
      EC.toast({ decline: 'Request declined.', cancel: 'Request cancelled.', handover: 'Marked as handed over.', complete: 'Exchange completed. Thank you for sharing.' }[act]);
      load();
    } catch (err) { EC.toast(err.message, { error: true }); load(); }
  });

  load();
});
