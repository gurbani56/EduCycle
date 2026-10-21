/* Browse: search, filters, sorting and pagination — all state lives in the URL. */
EC.page(async () => {
  const { $, esc } = EC;
  const meta = await EC.meta();
  let locations = [];
  try { locations = (await EC.api('/locations')).items; } catch (_) { /* filter just stays empty */ }

  const p = EC.params();
  const state = {
    q: p.get('q') || '',
    type: p.get('type') || '',
    category: p.get('category') || '',
    condition: p.get('condition') || '',
    department: p.get('department') || '',
    semester: p.get('semester') || '',
    location: p.get('location') || '',
    availability: p.get('availability') === 'all' ? 'all' : '',
    sort: p.get('sort') || 'newest',
    page: Number(p.get('page')) || 1,
  };

  // Populate controls
  $('#q').value = state.q;
  $('#sort').value = ['newest', 'oldest', 'title'].includes(state.sort) ? state.sort : 'newest';
  $('#fAvailable').checked = state.availability !== 'all';
  $('#fType').innerHTML = ['', ...meta.types].map((t) => `
    <div class="form-check"><input class="form-check-input" type="radio" name="fType" id="fType${t || 'All'}" value="${t}" ${state.type === t ? 'checked' : ''}>
    <label class="form-check-label" for="fType${t || 'All'}"><span>${t || 'All types'}</span><span class="n" data-type-count="${t}"></span></label></div>`).join('');
  EC.fillSelect($('#fCategory'), meta.categories, { placeholder: 'All categories', value: state.category });
  EC.fillSelect($('#fCondition'), meta.conditions, { placeholder: 'Any condition', value: state.condition });
  EC.fillSelect($('#fDepartment'), meta.departments, { placeholder: 'Any department', value: state.department });
  EC.fillSelect($('#fSemester'), meta.semesters.map((s) => ({ value: s, label: `Semester ${s}` })), { placeholder: 'Any semester', value: state.semester });
  EC.fillSelect($('#fLocation'), locations.map((l) => ({ value: l.id, label: l.name })), { placeholder: 'Any pickup point', value: state.location });

  const labels = {
    q: (v) => `“${v}”`, type: (v) => v, category: (v) => v, condition: (v) => v, department: (v) => v,
    semester: (v) => `Semester ${v}`, location: (v) => (locations.find((l) => l.id === v) || {}).name || 'Pickup point',
    availability: () => 'Including unavailable',
  };

  function renderChips() {
    const keys = Object.keys(labels).filter((k) => state[k]);
    const n = keys.filter((k) => k !== 'q').length;
    const fc = $('#filterCount'); fc.textContent = n; fc.classList.toggle('d-none', !n);
    $('#chips').innerHTML = keys.map((k) => `<span class="chip">${esc(labels[k](state[k]))}<button type="button" data-clear="${k}" aria-label="Remove filter ${esc(labels[k](state[k]))}"><i class="bi bi-x" aria-hidden="true"></i></button></span>`).join('') +
      (keys.length > 1 ? '<button class="btn btn-link btn-sm" type="button" data-clear="all">Clear all</button>' : '');
  }

  let reqId = 0;
  async function load() {
    const my = ++reqId;
    EC.setParams({ ...state, page: state.page > 1 ? state.page : '', sort: state.sort !== 'newest' ? state.sort : '' });
    renderChips();
    $('#results').innerHTML = EC.skeletonCards(6);
    const qs = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => { if (v) qs.set(k, v); });
    qs.set('limit', 12);
    try {
      const data = await EC.api(`/resources?${qs}`);
      if (my !== reqId) return;
      const total = data.pagination.total;
      $('#resultsHeading').textContent = total ? `${EC.plural(total, 'resource')} found` : 'No resources found';
      EC.$$('[data-type-count]').forEach((el) => {
        const t = el.dataset.typeCount;
        const c = t ? (data.typeCounts[t] || 0) : Object.values(data.typeCounts).reduce((a, b) => a + b, 0);
        el.textContent = c;
      });
      if (!data.items.length) {
        const filtered = Object.keys(labels).some((k) => state[k]);
        $('#results').innerHTML = `<div class="col-12">${EC.state({
          icon: 'bi-search', title: filtered ? 'Nothing matches these filters' : 'No resources listed yet',
          text: filtered ? 'Try removing a filter or searching for something more general. You can also ask the community for what you need.' : 'When students list items, they appear here.',
          actions: `${filtered ? '<button class="btn btn-outline-secondary" type="button" data-clear="all">Clear filters</button>' : ''}<a class="btn btn-primary" href="request-board.html">Post a community request</a>`,
        })}</div>`;
      } else {
        $('#results').innerHTML = data.items.map((r) => `<div class="col-sm-6 col-xl-4">${EC.resourceCard(r)}</div>`).join('');
      }
      EC.renderPagination($('#pager'), data.pagination, (n) => { state.page = n; load(); $('#resultsHeading').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    } catch (err) {
      if (my !== reqId) return;
      $('#resultsHeading').textContent = 'Resources';
      $('#results').innerHTML = `<div class="col-12">${EC.errorState(err, 'retryBrowse')}</div>`;
      $('#retryBrowse').addEventListener('click', load);
    }
  }

  const set = (k, v) => { state[k] = v; state.page = 1; load(); };

  let t;
  $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => set('q', e.target.value.trim()), 350); });
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(t); set('q', $('#q').value.trim()); });
  $('#sort').addEventListener('change', (e) => set('sort', e.target.value));
  $('#fAvailable').addEventListener('change', (e) => set('availability', e.target.checked ? '' : 'all'));
  $('#fType').addEventListener('change', (e) => set('type', e.target.value));
  [['#fCategory', 'category'], ['#fCondition', 'condition'], ['#fDepartment', 'department'], ['#fSemester', 'semester'], ['#fLocation', 'location']]
    .forEach(([sel, k]) => $(sel).addEventListener('change', (e) => set(k, e.target.value)));

  function clear(k) {
    const keys = k === 'all' ? Object.keys(labels) : [k];
    keys.forEach((key) => { state[key] = ''; });
    $('#q').value = state.q;
    $('#fAvailable').checked = state.availability !== 'all';
    ['#fCategory', '#fCondition', '#fDepartment', '#fSemester', '#fLocation'].forEach((s) => { $(s).value = state[s.slice(2).toLowerCase()] || ''; });
    const radio = document.querySelector(`input[name="fType"][value="${state.type}"]`); if (radio) radio.checked = true;
    state.page = 1; load();
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-clear]'); if (b) clear(b.dataset.clear); });
  $('#clearFilters').addEventListener('click', () => clear('all'));

  load();
});
