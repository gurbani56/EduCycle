/* Create or edit a listing (JSON sent with fetch). */
EC.page(async () => {
  const { $, esc } = EC;
  const form = $('#resourceForm');
  const editId = EC.params().get('id');
  const [meta, locRes] = await Promise.all([EC.meta(), EC.api('/locations')]);
  const locations = locRes.items;

  EC.fillSelect($('#category'), meta.categories, { placeholder: 'Choose a category' });
  EC.fillSelect($('#condition'), meta.conditions, { placeholder: 'Choose condition' });
  EC.fillSelect($('#department'), meta.departments, { value: 'All Departments' });
  EC.fillSelect($('#semester'), meta.semesters.map((s) => ({ value: s, label: `Semester ${s}` })), { placeholder: 'Any semester' });
  EC.form.counter($('#description'), $('#descCount'));

  function renderLocations(selected, extra) {
    const opts = locations.map((l) => ({ value: l.id, label: l.area ? `${l.name} — ${l.area}` : l.name }));
    // In edit mode, a listing may point at a location that is no longer approved; show it but flag it.
    if (extra && !locations.some((l) => l.id === extra.id)) opts.unshift({ value: '', label: `${extra.name} (no longer approved, choose another)` });
    EC.fillSelect($('#location'), opts, { placeholder: locations.length ? 'Choose an approved pickup point' : 'No approved pickup points yet', value: selected });
    $('#noLocations').classList.toggle('d-none', locations.length > 0);
    preview();
  }
  function preview() {
    const l = locations.find((x) => x.id === $('#location').value);
    const box = $('#locPreview');
    if (!l) { box.classList.add('d-none'); return; }
    box.innerHTML = `<span class="ico"><i class="bi bi-pin-map" aria-hidden="true"></i></span><div><div class="fw-semibold">${esc(l.name)}</div>${l.area ? `<div class="small text-muted">${esc(l.area)}</div>` : ''}${l.description ? `<div class="small mt-1">${esc(l.description)}</div>` : ''}</div>`;
    box.classList.remove('d-none');
  }
  $('#location').addEventListener('change', preview);
  renderLocations('');

  EC.bindSuggestForm($('#suggestForm'), { modal: $('#suggestModal') });

  let existing = null;
  if (editId) {
    try {
      existing = (await EC.api(`/resources/${encodeURIComponent(editId)}`)).resource;
    } catch (err) {
      form.outerHTML = EC.errorState(err);
      return;
    }
    if (!existing.isOwner) { form.outerHTML = EC.state({ icon: 'bi-lock', title: 'You can only edit your own listings' }); return; }
    document.title = 'Edit listing | EduCycle';
    $('#pageTitle').textContent = 'Edit listing';
    $('#crumb').textContent = existing.title;
    $('#pageSub').textContent = 'Update the details of your listing. Students see changes immediately.';
    $('#submitBtn').textContent = 'Save changes';
    ['title', 'description', 'category', 'condition', 'department', 'quantity'].forEach((k) => { form.elements[k].value = existing[k] ?? ''; });
    form.elements.semester.value = existing.semester || '';
    const radio = form.querySelector(`input[name="type"][value="${existing.type}"]`); if (radio) radio.checked = true;
    renderLocations(existing.location && existing.location.usable ? existing.location.id : '', existing.location);
    if (existing.status !== 'Reserved') {
      $('#statusWrap').classList.remove('d-none');
      $('#status').value = existing.status;
    } else {
      $('#statusWrap').classList.remove('d-none');
      $('#status').disabled = true;
      $('#status').innerHTML = '<option>Reserved for an accepted request</option>';
      $('#statusHelp').textContent = 'Availability changes automatically when the exchange finishes or is cancelled.';
    }
  }

  function validate(v) {
    const e = {};
    if ((v.title || '').length < 3) e.title = 'Enter a title of at least 3 characters.';
    if (!v.category) e.category = 'Choose a category.';
    if (!v.condition) e.condition = 'Choose the condition.';
    if ((v.description || '').length < 10) e.description = 'Describe the item in at least 10 characters.';
    if (!v.type) e.type = 'Choose Donate, Lend or Exchange.';
    const q = Number(v.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 20) e.quantity = 'Enter a quantity between 1 and 20.';
    if (!v.location) e.location = 'Choose an approved pickup point.';
    return e;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(form);
    const v = EC.form.values(form);
    const errs = validate(v);
    if (errs.type) form.querySelector('.choice-cards').classList.add('is-invalid'); else form.querySelector('.choice-cards').classList.remove('is-invalid');
    if (Object.keys(errs).length) return EC.form.errors(form, errs, 'Please correct the highlighted fields.');

    const body = {};
    ['title', 'description', 'category', 'condition', 'type', 'quantity', 'location', 'department', 'semester'].forEach((k) => { if (v[k] !== undefined && v[k] !== '') body[k] = v[k]; });
    if (existing && !$('#status').disabled) body.status = $('#status').value;

    const btn = $('#submitBtn');
    EC.form.busy(btn, true, existing ? 'Saving…' : 'Publishing…');
    try {
      const { resource } = existing
        ? await EC.api(`/resources/${existing.id}`, { method: 'PATCH', body })
        : await EC.api('/resources', { method: 'POST', body });
      EC.flash(existing ? 'Your changes have been saved.' : 'Your listing is live. Students can now request it.');
      location.href = `resource-details.html?id=${resource.id}`;
    } catch (err) {
      if (err.fields && err.fields.type) form.querySelector('.choice-cards').classList.add('is-invalid');
      EC.form.handleError(form, err);
      EC.form.busy(btn, false);
    }
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'type') { form.querySelector('.choice-cards').classList.remove('is-invalid'); form.querySelector('[data-error-for="type"]').textContent = ''; } });
});
