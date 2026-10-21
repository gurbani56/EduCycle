/* Student grievances: submission form and "Your grievances" history. */
EC.page(async () => {
  const { $, esc } = EC;
  const form = $('#grievanceForm');
  const p = EC.params();
  const meta = await EC.meta();
  const cats = meta.grievanceCategories;
  EC.fillSelect($('#gCategory'), cats.map((c) => ({ value: c.key, label: c.label })), { placeholder: 'Choose a category' });
  EC.form.counter($('#gDescription'), $('#gCount'));
  $('#gCategory').addEventListener('change', (e) => {
    const c = cats.find((x) => x.key === e.target.value);
    $('#safetyNote').classList.toggle('d-none', !(c && c.highPriority));
  });

  // Related exchange / listing options come from the student's own data.
  const [reqs, mine] = await Promise.allSettled([EC.api('/requests/mine'), EC.api('/resources/mine')]);
  const requests = reqs.status === 'fulfilled' ? reqs.value.items : [];
  EC.fillSelect($('#gRequest'), requests.map((q) => ({ value: q.id, label: `${q.resource.title} — ${q.role === 'owner' ? 'requested by ' + q.requester.name : 'from ' + q.owner.name} (${q.status})` })), { placeholder: 'Not about a specific exchange', value: p.get('request') || '' });
  const listings = mine.status === 'fulfilled' ? mine.value.items : [];
  const resourceOpts = listings.map((r) => ({ value: r.id, label: `${r.title} (your listing)` }));
  // A listing reported from its detail page may belong to someone else.
  const preRes = p.get('resource');
  if (preRes && !resourceOpts.some((o) => o.value === preRes)) {
    try { const { resource } = await EC.api(`/resources/${encodeURIComponent(preRes)}`); resourceOpts.unshift({ value: resource.id, label: resource.title }); } catch (_) { /* ignore */ }
  }
  EC.fillSelect($('#gResource'), resourceOpts, { placeholder: 'Not about a specific listing', value: preRes || '' });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(form);
    const v = EC.form.values(form);
    const errs = {};
    if (!v.category) errs.category = 'Choose a category.';
    if ((v.subject || '').length < 5) errs.subject = 'Write a subject of at least 5 characters.';
    if ((v.description || '').length < 20) errs.description = 'Describe the problem in at least 20 characters.';
    if (Object.keys(errs).length) return EC.form.errors(form, errs);
    const body = { category: v.category, subject: v.subject, description: v.description };
    if (v.requestId) body.requestId = v.requestId;
    if (v.resourceId) body.resourceId = v.resourceId;
    const btn = $('#gSubmit');
    EC.form.busy(btn, true, 'Submitting…');
    try {
      const { grievance } = await EC.api('/grievances', { method: 'POST', body });
      form.reset(); $('#gCount').textContent = '0/2000'; $('#safetyNote').classList.add('d-none');
      const box = $('#successBox');
      box.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i><div><strong>Grievance submitted.</strong> Your reference number is <strong>${esc(grievance.reference)}</strong>. Its status is Open, and you will be notified when an administrator responds.</div>`;
      box.classList.remove('d-none'); box.focus();
      loadMine(grievance.reference);
    } catch (err) { EC.form.handleError(form, err); } finally { EC.form.busy(btn, false); }
  });

  async function loadMine(highlight) {
    $('#mine').innerHTML = EC.loadingBlock();
    try {
      const { items } = await EC.api('/grievances/mine');
      if (!items.length) { $('#mine').innerHTML = EC.state({ icon: 'bi-flag', title: 'No grievances submitted', text: 'Anything you report will be listed here with its status and the administrator’s response.' }); return; }
      const open = highlight || p.get('ref');
      $('#mine').innerHTML = `<div class="accordion" id="gAcc">${items.map((g) => {
        const show = g.reference === open;
        return `
        <div class="accordion-item">
          <h3 class="accordion-header">
            <button class="accordion-button${show ? '' : ' collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#g-${g.id}" aria-expanded="${show}" aria-controls="g-${g.id}">
              <span class="d-flex flex-column flex-md-row gap-1 gap-md-3 w-100 me-3 align-items-md-center">
                <span class="small text-muted font-monospace">${esc(g.reference)}</span>
                <span class="flex-grow-1">${esc(g.subject)}</span>
                <span class="d-flex gap-2">${EC.priorityBadge(g.priority)}${EC.grievanceStatusBadge(g.status)}</span>
              </span>
            </button>
          </h3>
          <div id="g-${g.id}" class="accordion-collapse collapse${show ? ' show' : ''}" data-bs-parent="#gAcc">
            <div class="accordion-body">
              <dl class="dl-grid mb-3">
                <dt>Category</dt><dd>${esc(g.categoryLabel)}</dd>
                <dt>Submitted</dt><dd>${EC.fmtDateTime(g.createdAt)}</dd>
                ${g.request ? `<dt>Exchange</dt><dd>${esc(g.request.resourceTitle)} (${esc(g.request.status)})</dd>` : ''}
                ${g.resource ? `<dt>Listing</dt><dd><a href="resource-details.html?id=${esc(g.resource.id)}">${esc(g.resource.title)}</a></dd>` : ''}
                ${g.resolvedAt ? `<dt>Closed</dt><dd>${EC.fmtDateTime(g.resolvedAt)}</dd>` : ''}
              </dl>
              <h4 class="h5">Your description</h4>
              <p style="white-space:pre-line">${esc(g.description)}</p>
              <h4 class="h5 mt-3">Administrator response</h4>
              ${g.adminResponse ? `<p class="quote" style="white-space:pre-line">${esc(g.adminResponse)}</p><p class="meta">Updated ${EC.fmtDateTime(g.respondedAt)}</p>` : '<p class="text-muted small">No response yet. You will be notified when there is one.</p>'}
              <h4 class="h5 mt-3">History</h4>
              <ul class="timeline">${g.history.map((h) => `<li><time>${EC.fmtDateTime(h.at)}</time>${h.status ? `Status: <strong>${esc(h.status === 'Rejected' ? 'Closed – not upheld' : h.status)}</strong>` : ''}${h.response ? `${h.status ? ' · ' : ''}Response updated` : ''}${!h.status && !h.response ? 'Updated' : ''} <span class="text-muted">by ${esc(h.by)}</span></li>`).join('')}</ul>
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
    } catch (err) { $('#mine').innerHTML = EC.errorState(err); }
  }
  loadMine();
  if (p.get('ref')) setTimeout(() => { const el = document.getElementById('mineTitle'); if (el) el.scrollIntoView(); }, 300);
});
