/* Community requests board. */
EC.page(async ({ user }) => {
  const { $, $$, esc } = EC;
  const meta = await EC.meta();
  const state = { type: '', category: '', mine: false, page: 1 };
  const isStudent = user && user.role === 'student';
  let posts = [];
  const next = encodeURIComponent(location.pathname);

  const typeLabel = { Donate: 'Wants a donation', Lend: 'Wants to borrow', Exchange: 'Wants to exchange' };
  $('#typeTabs').innerHTML = ['', ...meta.types].map((t) => `<li class="nav-item" role="presentation"><button class="nav-link${t === '' ? ' active' : ''}" type="button" role="tab" aria-selected="${t === ''}" data-type="${t}">${t ? esc(typeLabel[t]) : 'All'}<span class="count" data-n="${t}"></span></button></li>`).join('');
  EC.fillSelect($('#catFilter'), meta.categories, { placeholder: 'All categories' });
  EC.fillSelect($('#pCategory'), meta.categories, { placeholder: 'Choose' });
  if (isStudent) $('#mineWrap').classList.remove('d-none');

  function post(p) {
    const actions = [];
    if (p.isMine && p.status === 'Open') actions.push(`<button class="btn btn-outline-secondary btn-sm" data-close="${p.id}">Mark as found</button>`);
    else if (!p.isMine && p.status === 'Open') {
      if (!user) actions.push(`<a class="btn btn-outline-secondary btn-sm" href="login.html?next=${next}">Log in to offer</a>`);
      else if (isStudent) actions.push(p.alreadyOffered ? '<span class="small text-muted"><i class="bi bi-check2" aria-hidden="true"></i> You offered a listing</span>' : `<button class="btn btn-primary btn-sm" data-offer="${p.id}">I have this</button>`);
    }
    return `
      <article class="panel">
        <div class="d-flex flex-wrap justify-content-between gap-3">
          <div class="min-w-0 flex-grow-1">
            <div class="d-flex flex-wrap gap-2 mb-2">${EC.badge('b-grey', EC.catIcon(p.category), p.category)}${EC.typeBadge(p.type)}${p.status === 'Closed' ? EC.badge('b-green', 'bi-check-circle', 'Found') : ''}</div>
            <h2 class="h3 mb-1">${esc(p.title)}</h2>
            ${p.description ? `<p class="mb-2">${esc(p.description)}</p>` : ''}
            <p class="meta mb-0">${p.isMine ? 'Posted by you' : `Posted by ${esc(p.author.name)}`} · ${EC.timeAgo(p.createdAt)}${p.duration ? ` · Needed for ${esc(p.duration)}` : ''}${p.isMine && p.offerCount ? ` · <strong class="text-ink">${EC.plural(p.offerCount, 'offer')}</strong> (see notifications)` : ''}</p>
          </div>
          <div class="d-flex align-items-start gap-2">${actions.join('')}</div>
        </div>
      </article>`;
  }

  async function load() {
    $('#list').innerHTML = EC.loadingBlock();
    const qs = new URLSearchParams({ page: state.page });
    if (state.type) qs.set('type', state.type);
    if (state.category) qs.set('category', state.category);
    if (state.mine) qs.set('mine', 'true');
    try {
      const data = await EC.api(`/board?${qs}`);
      posts = data.items;
      $$('[data-n]').forEach((el) => { const t = el.dataset.n; el.textContent = t ? (data.typeCounts[t] || 0) : Object.values(data.typeCounts).reduce((a, b) => a + b, 0); });
      $('#list').innerHTML = data.items.length
        ? `<div class="d-grid gap-3">${data.items.map(post).join('')}</div>`
        : EC.state({ icon: 'bi-megaphone', title: state.mine ? 'You have not posted any requests' : 'No open requests here', text: 'Looking for something that is not listed? Post a request so students who have it can offer it.', actions: '<button class="btn btn-primary" type="button" data-open-post>Post a request</button>' });
      EC.renderPagination($('#pager'), data.pagination, (n) => { state.page = n; load(); });
    } catch (err) {
      $('#list').innerHTML = EC.errorState(err, 'retry'); $('#retry').addEventListener('click', load);
    }
  }

  $('#typeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    state.type = b.dataset.type; state.page = 1;
    $$('#typeTabs .nav-link').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b); });
    load();
  });
  $('#catFilter').addEventListener('change', (e) => { state.category = e.target.value; state.page = 1; load(); });
  $('#mineOnly').addEventListener('change', (e) => { state.mine = e.target.checked; state.page = 1; load(); });

  /* ---- Post ---- */
  const postModal = new bootstrap.Modal($('#postModal'));
  const postForm = $('#postForm');
  function openPost() {
    if (!user) { location.href = `login.html?next=${next}`; return; }
    if (!isStudent) { EC.toast('Only student accounts can post requests.', { error: true }); return; }
    EC.form.clear(postForm); postForm.reset(); postModal.show();
  }
  $('#openPost').addEventListener('click', openPost);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-post]')) openPost(); });
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(postForm);
    const v = EC.form.values(postForm);
    const errs = {};
    if ((v.title || '').length < 3) errs.title = 'Describe what you need in at least 3 characters.';
    if (!v.category) errs.category = 'Choose a category.';
    if (!v.type) errs.type = 'Choose how you would like to get it.';
    if (Object.keys(errs).length) return EC.form.errors(postForm, errs);
    const btn = postForm.querySelector('[type=submit]');
    EC.form.busy(btn, true, 'Posting…');
    try {
      await EC.api('/board', { method: 'POST', body: v });
      postModal.hide(); EC.toast('Your request has been posted.');
      state.page = 1; load();
    } catch (err) { EC.form.handleError(postForm, err); } finally { EC.form.busy(btn, false); }
  });

  /* ---- Offer ---- */
  const offerModal = new bootstrap.Modal($('#offerModal'));
  const offerForm = $('#offerForm');
  let offerPost = null;
  $('#list').addEventListener('click', async (e) => {
    const o = e.target.closest('[data-offer]');
    const c = e.target.closest('[data-close]');
    if (c) {
      const ok = await EC.confirm({ title: 'Mark this request as found?', body: 'It will be closed and no longer shown to other students.', confirmText: 'Mark as found' });
      if (!ok) return;
      try { await EC.api(`/board/${c.dataset.close}/close`, { method: 'PATCH' }); EC.toast('Request closed.'); load(); } catch (err) { EC.toast(err.message, { error: true }); }
    }
    if (o) {
      offerPost = o.dataset.offer;
      const p = posts.find((x) => x.id === offerPost) || { title: '', author: { name: 'A student' } };
      $('#offerFor').textContent = p.title;
      $('#offerWho').textContent = p.author.name;
      EC.form.clear(offerForm); offerForm.reset();
      let mine = [];
      try { mine = (await EC.api('/resources/mine?status=Available')).items.filter((r) => r.requestable || r.status === 'Available'); } catch (_) { /* handled below */ }
      $('#offerNone').classList.toggle('d-none', mine.length > 0);
      $('#offerFields').classList.toggle('d-none', !mine.length);
      $('#offerSubmit').disabled = !mine.length;
      EC.fillSelect($('#offerListing'), mine.map((r) => ({ value: r.id, label: `${r.title} (${r.type})` })), { placeholder: 'Choose a listing' });
      offerModal.show();
    }
  });
  offerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(offerForm);
    const v = EC.form.values(offerForm);
    if (!v.resourceId) return EC.form.errors(offerForm, { resourceId: 'Choose one of your listings.' });
    const btn = $('#offerSubmit');
    EC.form.busy(btn, true, 'Sending…');
    try {
      await EC.api(`/board/${offerPost}/offers`, { method: 'POST', body: v });
      offerModal.hide(); EC.toast('Offer sent. The student has been notified.'); load();
    } catch (err) { EC.form.handleError(offerForm, err); } finally { EC.form.busy(btn, false); }
  });

  load();
});
