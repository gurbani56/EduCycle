/* Resource details: information, pickup point, request flow and reporting. */
EC.page(async ({ user }) => {
  const { $, esc } = EC;
  const id = EC.params().get('id');
  const root = $('#detailRoot');
  if (!id) { root.innerHTML = EC.state({ icon: 'bi-question-circle', title: 'No resource selected', actions: '<a class="btn btn-primary" href="browse.html">Browse resources</a>' }); return; }

  let r;
  try {
    r = (await EC.api(`/resources/${encodeURIComponent(id)}`)).resource;
  } catch (err) {
    root.innerHTML = err.status === 404 || err.status === 400
      ? EC.state({ icon: 'bi-box', title: 'This resource is not available', text: 'It may have been removed by its owner or by an administrator.', actions: '<a class="btn btn-primary" href="browse.html">Browse other resources</a>' })
      : EC.errorState(err);
    return;
  }

  document.title = `${r.title} | EduCycle`;
  $('#crumb').textContent = r.title;
  const loc = r.location;
  const next = encodeURIComponent(location.pathname + location.search);
  const typeHelp = {
    Donate: 'The owner is giving this away. It is yours to keep.',
    Lend: 'You borrow it and return it to the owner when you are done.',
    Exchange: 'The owner would like something in return. Say what you can offer.',
  }[r.type];

  function actionBlock() {
    if (r.isOwner) {
      return `
        <div class="alert alert-neutral mb-3"><i class="bi bi-person-badge" aria-hidden="true"></i><div>This is your listing.${r.pendingRequests ? ` <strong>${EC.plural(r.pendingRequests, 'request')}</strong> waiting for your answer.` : ''}</div></div>
        ${r.moderation && r.moderation.state === 'disabled' ? `<div class="alert alert-danger"><i class="bi bi-slash-circle" aria-hidden="true"></i><div><strong>Disabled by an administrator.</strong> ${esc(r.moderation.reason)}</div></div>` : ''}
        <div class="d-grid gap-2">
          ${r.pendingRequests ? '<a class="btn btn-primary" href="activity.html?tab=needs">Review requests</a>' : ''}
          <a class="btn btn-outline-secondary" href="list-resource.html?id=${esc(r.id)}"><i class="bi bi-pencil" aria-hidden="true"></i>Edit listing</a>
          <a class="btn btn-link" href="my-listings.html">Manage my listings</a>
        </div>`;
    }
    if (!user) {
      if (!r.requestable) return `<div class="alert alert-warning"><i class="bi bi-hourglass-split" aria-hidden="true"></i><div>${esc(r.unavailableReason || 'This resource cannot be requested right now.')}</div></div>`;
      return `<p class="small text-muted">Log in with your student account to request this resource.</p>
        <div class="d-grid gap-2"><a class="btn btn-primary" href="login.html?next=${next}">Log in to request</a><a class="btn btn-outline-secondary" href="login.html?mode=register&next=${next}">Create an account</a></div>`;
    }
    if (user.role !== 'student') return '<p class="small text-muted mb-0">Administrators cannot request resources.</p>';
    if (r.myOpenRequest) {
      return `<div class="alert alert-info"><i class="bi bi-info-circle" aria-hidden="true"></i><div>You have already requested this. Status: <strong>${esc(r.myOpenRequest.status)}</strong>.</div></div>
        <a class="btn btn-outline-secondary w-100" href="activity.html?tab=waiting">Go to Your activity</a>`;
    }
    if (!r.requestable) {
      return `<div class="alert alert-warning"><i class="bi bi-hourglass-split" aria-hidden="true"></i><div>${esc(r.unavailableReason || 'This resource cannot be requested right now.')}</div></div>
        <button class="btn btn-primary w-100" type="button" disabled>Request unavailable</button>`;
    }
    return `<button class="btn btn-primary btn-lg w-100" type="button" id="openRequest"><i class="bi bi-send" aria-hidden="true"></i>Request this resource</button>
      <h3 class="h5 mt-4 mb-2">What happens next</h3>
      <ol class="next-steps">
        <li>The owner gets a notification and accepts or declines.</li>
        <li>If accepted, the item is reserved for you and you can see the agreed pickup point.</li>
        <li>Meet at the pickup point, then confirm the hand-over in Your activity.</li>
      </ol>`;
  }

  root.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-7">
        <div class="detail-media mb-4"><div class="ph" aria-hidden="true"><i class="bi ${EC.catIcon(r.category)}"></i><span class="small text-uppercase fw-semibold">${esc(r.category)}</span></div></div>
        <div class="d-flex flex-wrap gap-2 mb-2">${EC.typeBadge(r.type)}${EC.resourceStatusBadge(r.status)}</div>
        <h1 class="mb-2">${esc(r.title)}</h1>
        <p class="meta mb-4">Listed ${EC.fmtDate(r.createdAt)} by <strong class="text-ink">${esc(r.owner ? r.owner.name : '')}</strong></p>
        <h2 class="h3">Description</h2>
        <p style="white-space: pre-line">${esc(r.description)}</p>
        <h2 class="h3 mt-4">Details</h2>
        <dl class="dl-grid panel">
          <dt>Listing type</dt><dd>${esc(r.type)} <span class="text-muted small d-block">${esc(typeHelp)}</span></dd>
          <dt>Category</dt><dd>${esc(r.category)}</dd>
          <dt>Condition</dt><dd>${esc(r.condition)}</dd>
          <dt>Quantity</dt><dd>${esc(r.quantity)}</dd>
          <dt>Suited for</dt><dd>${esc(r.department || 'All Departments')}${r.semester ? `, semester ${esc(r.semester)}` : ''}</dd>
        </dl>
      </div>
      <div class="col-lg-5">
        <div class="action-panel">
          <div class="panel">
            <h2 class="panel-title"><i class="bi bi-geo-alt" aria-hidden="true"></i>Pickup point</h2>
            ${loc ? `<div class="loc-card mb-4"><span class="ico"><i class="bi bi-pin-map" aria-hidden="true"></i></span><div class="min-w-0">
              <div class="fw-semibold">${esc(loc.name)}</div>
              ${loc.area ? `<div class="small text-muted">${esc(loc.area)}</div>` : ''}
              ${loc.usable && loc.description ? `<div class="small mt-1">${esc(loc.description)}</div>` : ''}
              <div class="mt-2">${EC.locationStatusBadge(loc)}</div>
              ${!loc.usable ? '<div class="small text-muted mt-2">Exchanges can only be arranged at approved pickup points. This one is waiting for an administrator.</div>' : ''}
            </div></div>` : ''}
            ${actionBlock()}
          </div>
          ${!r.isOwner && user && user.role === 'student' ? `<p class="small text-muted mt-3 mb-0"><i class="bi bi-flag" aria-hidden="true"></i> Something wrong with this listing? <button class="btn btn-link btn-sm p-0 align-baseline" type="button" id="openReport">Report it</button></p>` : ''}
          <p class="small text-muted mt-2 mb-0"><i class="bi bi-shield-check" aria-hidden="true"></i> Meet in the open at the pickup point. <a href="safety.html">Safety guidelines</a></p>
        </div>
      </div>
    </div>`;

  /* ---- Request ---- */
  const reqModalEl = $('#requestModal');
  const reqModal = new bootstrap.Modal(reqModalEl);
  const reqForm = $('#requestForm');
  EC.form.counter($('#reqMessage'), $('#reqCount'));
  const openReq = $('#openRequest');
  if (openReq) {
    openReq.addEventListener('click', () => {
      EC.form.clear(reqForm);
      $('#reqName').textContent = r.title;
      $('#reqLoc').textContent = loc ? loc.name : '';
      $('#offerWrap').classList.toggle('d-none', r.type !== 'Exchange');
      reqModal.show();
    });
  }
  reqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(reqForm);
    const v = EC.form.values(reqForm);
    if (r.type === 'Exchange' && !v.offerDetails) return EC.form.errors(reqForm, { offerDetails: 'Describe what you can offer in exchange.' });
    const btn = $('#reqSubmit');
    EC.form.busy(btn, true, 'Sending…');
    try {
      await EC.api('/requests', { method: 'POST', body: { resourceId: r.id, message: v.message, offerDetails: v.offerDetails || '' } });
      reqModal.hide();
      EC.flash('Request sent. You will be notified when the owner responds.');
      location.href = 'activity.html?tab=waiting';
    } catch (err) {
      EC.form.handleError(reqForm, err);
    } finally { EC.form.busy(btn, false); }
  });

  /* ---- Report (grievance) ---- */
  const repModal = new bootstrap.Modal($('#reportModal'));
  const repForm = $('#reportForm');
  const openRep = $('#openReport');
  if (openRep) openRep.addEventListener('click', () => { EC.form.clear(repForm); repForm.reset(); repModal.show(); });
  repForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(repForm);
    const v = EC.form.values(repForm);
    const errs = {};
    if (!v.category) errs.category = 'Choose a reason.';
    if ((v.description || '').length < 20) errs.description = 'Please give at least 20 characters of detail.';
    if (Object.keys(errs).length) return EC.form.errors(repForm, errs);
    const btn = $('#repSubmit');
    EC.form.busy(btn, true, 'Submitting…');
    try {
      const label = repForm.querySelector(`#repCategory option[value="${v.category}"]`).textContent;
      const { grievance } = await EC.api('/grievances', { method: 'POST', body: { category: v.category, subject: `${label}: ${r.title}`.slice(0, 120), description: v.description, resourceId: r.id } });
      repModal.hide();
      EC.toast(`Report submitted. Reference ${grievance.reference}.`);
    } catch (err) {
      EC.form.handleError(repForm, err);
    } finally { EC.form.busy(btn, false); }
  });

  /* ---- More in category ---- */
  try {
    const more = await EC.api(`/resources?category=${encodeURIComponent(r.category)}&limit=4`);
    const items = more.items.filter((x) => x.id !== r.id).slice(0, 3);
    if (items.length) {
      $('#moreList').innerHTML = items.map((x) => `<div class="col-sm-6 col-lg-4">${EC.resourceCard(x)}</div>`).join('');
      $('#moreLink').href = `browse.html?category=${encodeURIComponent(r.category)}`;
      $('#moreSection').classList.remove('d-none');
    }
  } catch (_) { /* optional section */ }
});
