'use strict';

/* Request board: what other students are looking for */
(function () {
  const el = (id) => document.getElementById(id);
  const filters = { type: '', category: '' };

  function postRow(state, post) {
    const mine = isLoggedIn(state) && post.userId === state.currentUser.id;
    const action = mine
      ? `<button class="btn btn-sm btn-outline-eco" type="button" data-close="${post.id}">Close request</button>`
      : `<button class="btn btn-sm btn-eco" type="button" data-offer="${post.id}">I have this</button>`;
    return `
      <article class="post-row">
        <div class="post-main">
          <div class="post-title"><h3>${esc(post.title)}</h3>${typeTag(post.type)}</div>
          <p class="post-desc">${esc(post.description)}</p>
          <p class="post-meta">${esc(post.category)} · Needed for ${esc(post.duration)} · ${esc(mine ? 'You' : post.userName)} · ${formatDate(post.date)}</p>
        </div>
        <div class="post-action">${action}</div>
      </article>`;
  }

  const inScope = (p, f) => p.status === 'Open' && (!f.type || p.type === f.type) && (!f.category || p.category === f.category);

  function render(state) {
    const open = state.board.filter((p) => p.status === 'Open');
    const pool = open.filter((p) => inScope(p, { ...filters, type: '' }));
    el('boardTabs').querySelectorAll('button').forEach((btn) => {
      const type = btn.dataset.type;
      btn.classList.toggle('active', type === filters.type);
      btn.setAttribute('aria-selected', String(type === filters.type));
      btn.querySelector('.n').textContent = type ? pool.filter((p) => p.type === type).length : pool.length;
    });

    const catPool = open.filter((p) => inScope(p, { ...filters, category: '' }));
    el('boardCategoryBtn').innerHTML = `Category: <strong>${esc(filters.category || 'All')}</strong>`;
    el('boardCategoryMenu').innerHTML = ['', ...CATEGORIES].map((c) => `
      <li><button type="button" class="dropdown-item ${c === filters.category ? 'active' : ''}" data-category="${esc(c)}">
        <span>${c ? esc(c) : 'All categories'}</span><span class="menu-count">${catPool.filter((p) => !c || p.category === c).length}</span></button></li>`).join('');

    const posts = state.board.filter((p) => inScope(p, filters)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    el('boardList').innerHTML = posts.map((p) => postRow(state, p)).join('');
    el('boardList').classList.toggle('d-none', posts.length === 0);
    el('boardEmpty').classList.toggle('d-none', posts.length > 0);
  }

  function bindPostForm(state) {
    const form = el('postForm');
    const pairs = [
      [el('postTitle'), RULES.length('Item name', 3, 60)],
      [el('postCategory'), RULES.required('Category')],
      [el('postType'), RULES.required('Type')],
      [el('postDuration'), RULES.length('Duration', 2, 30)],
      [el('postDescription'), RULES.length('Details', 10, 200)]
    ];
    pairs.forEach(([input, rule]) => liveValidate(input, rule));

    const open = () => {
      if (!requireLogin(state)) return;
      bootstrap.Modal.getOrCreateInstance(el('postModal')).show();
    };
    el('composer').addEventListener('click', open);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!checkAll(pairs)) return;
      state.board.push({
        id: nextId(state.board), userId: state.currentUser.id, userName: state.currentUser.name,
        title: el('postTitle').value.trim(), category: el('postCategory').value, type: el('postType').value,
        duration: el('postDuration').value.trim(), description: el('postDescription').value.trim(), status: 'Open', date: todayISO()
      });
      saveState(state);
      form.reset();
      clearValidation(form);
      bootstrap.Modal.getOrCreateInstance(el('postModal')).hide();
      render(state);
      showToast('Your request is on the board.');
    });
  }

  function bindOffer(state) {
    let activePost = null;

    el('boardList').addEventListener('click', (e) => {
      const offerBtn = e.target.closest('[data-offer]');
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const post = state.board.find((p) => p.id === Number(closeBtn.dataset.close));
        if (post) { post.status = 'Closed'; saveState(state); render(state); showToast('Request closed.'); }
        return;
      }
      if (!offerBtn) return;
      if (!requireLogin(state)) return;
      activePost = state.board.find((p) => p.id === Number(offerBtn.dataset.offer));
      if (!activePost) return;

      const available = state.resources.filter((r) => r.ownerId === state.currentUser.id && r.status === 'Available');
      el('offerTitle').textContent = activePost.title;
      el('offerNone').classList.toggle('d-none', available.length > 0);
      el('offerFields').classList.toggle('d-none', available.length === 0);
      el('confirmOffer').disabled = available.length === 0;
      fillSelect(el('offerListing'), available.map((r) => ({ value: r.id, label: r.name })));
      bootstrap.Modal.getOrCreateInstance(el('offerModal')).show();
    });

    el('confirmOffer').addEventListener('click', () => {
      if (!activePost) return;
      bootstrap.Modal.getOrCreateInstance(el('offerModal')).hide();
      el('offerMessage').value = '';
      showToast(`Your offer was sent to ${activePost.userName}.`);
    });
  }

  PAGES.board = (state) => {
    fillSelect(el('postCategory'), CATEGORIES, 'Select category');
    fillSelect(el('postType'), TYPES, 'Select type');
    el('boardTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (btn) { filters.type = btn.dataset.type; render(state); }
    });
    el('boardCategoryMenu').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (btn) { filters.category = btn.dataset.category; render(state); }
    });
    bindPostForm(state);
    bindOffer(state);
    render(state);
  };
})();
