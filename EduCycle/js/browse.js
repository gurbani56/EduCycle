'use strict';

/* Browse: type tabs + contextual dropdowns in the section header, active filters as removable tags */
(function () {
  const STEP = 6;
  const el = (id) => document.getElementById(id);
  const filters = { q: '', type: '', category: '', condition: '', department: '', semester: '' };
  let all = [];
  let visible = STEP;

  /** Pure function: does a resource match the filters? */
  function matches(r, f) {
    const q = f.q.trim().toLowerCase();
    if (q && !`${r.name} ${r.description} ${r.category} ${r.ownerName}`.toLowerCase().includes(q)) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.condition && r.condition !== f.condition) return false;
    if (f.department && r.department !== f.department && r.department !== 'All Departments') return false;
    if (f.semester && r.semester !== Number(f.semester)) return false;
    return true;
  }

  const countBy = (list, key, value) => list.filter((r) => (value ? r[key] === value : true)).length;

  function renderTabs() {
    const pool = all.filter((r) => matches(r, { ...filters, type: '' }));
    el('typeTabs').querySelectorAll('button').forEach((btn) => {
      const type = btn.dataset.type;
      btn.classList.toggle('active', type === filters.type);
      btn.setAttribute('aria-selected', String(type === filters.type));
      btn.querySelector('.n').textContent = countBy(pool, 'type', type);
    });
  }

  function renderCategoryMenu() {
    const pool = all.filter((r) => matches(r, { ...filters, category: '' }));
    el('categoryBtn').innerHTML = `Category: <strong>${esc(filters.category || 'All')}</strong>`;
    el('categoryMenu').innerHTML = ['', ...CATEGORIES].map((c) => `
      <li><button type="button" class="dropdown-item ${c === filters.category ? 'active' : ''}" data-category="${esc(c)}">
        <span>${c ? esc(c) : 'All categories'}</span><span class="menu-count">${countBy(pool, 'category', c)}</span></button></li>`).join('');
  }

  function renderCatChips() {
    const row = el('catChipRow');
    if (!row) return;
    row.querySelectorAll('.cat-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === filters.category);
    });
  }

  function renderActiveFilters() {
    const labels = {
      q: filters.q && `“${filters.q}”`,
      category: filters.category,
      condition: filters.condition,
      department: filters.department,
      semester: filters.semester && `Semester ${filters.semester}`
    };
    const chips = Object.entries(labels).filter(([, label]) => label).map(([key, label]) =>
      `<span class="filter-chip">${esc(label)}<button type="button" data-clear="${key}" aria-label="Remove filter ${esc(label)}">×</button></span>`);
    const narrowCount = ['condition', 'department', 'semester'].filter((k) => filters[k]).length;
    const badge = el('narrowCount');
    badge.textContent = narrowCount || '';
    el('activeFilters').innerHTML = chips.join('') + (chips.length > 1 ? '<button type="button" class="clear-all" data-clear="all">Clear all</button>' : '');
    el('activeFilters').classList.toggle('d-none', chips.length === 0);
  }

  function render() {
    const results = sortListings(all.filter((r) => matches(r, filters)));
    const available = results.filter((r) => r.status === 'Available').length;
    el('resultCount').textContent = `${results.length} ${results.length === 1 ? 'resource' : 'resources'} · ${available} available`;

    renderTabs();
    renderCategoryMenu();
    renderCatChips();
    renderActiveFilters();

    el('listingList').innerHTML = results.slice(0, visible).map((r) => listingRow(r)).join('');
    el('listingList').classList.toggle('d-none', results.length === 0);
    el('emptyState').classList.toggle('d-none', results.length > 0);

    const remaining = results.length - visible;
    el('showMore').classList.toggle('d-none', remaining <= 0);
    el('showMore').textContent = `Show ${Math.min(STEP, Math.max(remaining, 0))} more`;
  }

  function setFilter(key, value) {
    filters[key] = value;
    visible = STEP;
    render();
  }

  function clearFilter(key) {
    const keys = key === 'all' ? Object.keys(filters) : [key];
    keys.forEach((k) => { filters[k] = ''; });
    ['condition', 'department', 'semester'].forEach((k) => {
      if (keys.includes(k)) el('f' + k[0].toUpperCase() + k.slice(1)).value = '';
    });
    visible = STEP;
    render();
  }

  function bindEvents() {
    el('typeTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (btn) setFilter('type', btn.dataset.type);
    });
    el('categoryMenu').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (btn) setFilter('category', btn.dataset.category);
    });
    const chipRow = el('catChipRow');
    if (chipRow) {
      chipRow.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-category]');
        if (!btn) return;
        setFilter('category', filters.category === btn.dataset.category ? '' : btn.dataset.category);
      });
    }
    [['fCondition', 'condition'], ['fDepartment', 'department'], ['fSemester', 'semester']].forEach(([id, key]) => {
      el(id).addEventListener('change', () => setFilter(key, el(id).value));
    });
    el('narrowClear').addEventListener('click', () => {
      ['condition', 'department', 'semester'].forEach((k) => { filters[k] = ''; });
      ['fCondition', 'fDepartment', 'fSemester'].forEach((id) => { el(id).value = ''; });
      visible = STEP;
      render();
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-clear]');
      if (btn) clearFilter(btn.dataset.clear);
    });
    el('showMore').addEventListener('click', () => { visible += STEP; render(); });
  }

  PAGES.browse = (state) => {
    all = state.resources;
    fillSelect(el('fCondition'), CONDITIONS, 'Any condition');
    fillSelect(el('fDepartment'), DEPARTMENTS.filter((d) => d !== 'All Departments'), 'Any department');
    fillSelect(el('fSemester'), semesterOptions(), 'Any semester');
    filters.q = getParam('q') || '';
    if (CATEGORIES.includes(getParam('category'))) filters.category = getParam('category');
    bindEvents();
    render();
  };
})();
